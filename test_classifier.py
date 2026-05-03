"""
nvidia_classifier_server.py — EcoRoute local API
Wraps the NVIDIA prompt-task-and-complexity-classifier and exposes it
on http://localhost:8000/classify so the Chrome extension can fetch it.

Install once:
    pip install fastapi uvicorn transformers torch numpy huggingface_hub

Run:
    python nvidia_classifier_server.py

Test classifier:
    python -c "import requests; r=requests.get('http://localhost:8000/test'); print(r.json())"
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import torch
import torch.nn as nn
from huggingface_hub import PyTorchModelHubMixin
from transformers import AutoModel, AutoTokenizer
import re
import uvicorn
import json

# ── Exact model architecture from NVIDIA HuggingFace model card ──────────

class MeanPooling(nn.Module):
    def __init__(self):
        super(MeanPooling, self).__init__()

    def forward(self, last_hidden_state, attention_mask):
        input_mask_expanded = (
            attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
        )
        sum_embeddings = torch.sum(last_hidden_state * input_mask_expanded, 1)
        sum_mask = input_mask_expanded.sum(1)
        sum_mask = torch.clamp(sum_mask, min=1e-9)
        mean_embeddings = sum_embeddings / sum_mask
        return mean_embeddings


class MulticlassHead(nn.Module):
    def __init__(self, input_size, num_classes):
        super(MulticlassHead, self).__init__()
        self.fc = nn.Linear(input_size, num_classes)

    def forward(self, x):
        x = self.fc(x)
        return x


class CustomModel(nn.Module, PyTorchModelHubMixin):
    def __init__(self, target_sizes, task_type_map, weights_map, divisor_map):
        super(CustomModel, self).__init__()
        self.backbone = AutoModel.from_pretrained("microsoft/DeBERTa-v3-base")
        self.target_sizes = target_sizes
        self.task_type_map = task_type_map
        self.weights_map = weights_map
        self.divisor_map = divisor_map
        target_sizes_list = list(target_sizes.values())
        self.heads = nn.ModuleList([
            MulticlassHead(self.backbone.config.hidden_size, sz)
            for sz in target_sizes_list
        ])
        self.pool = MeanPooling()

    def compute_results(self, preds, target, decimal=4):
        if target == "task_type":
            top2_indices = torch.topk(preds, k=2, dim=1).indices
            softmax_probs = torch.softmax(preds, dim=1)
            top2_probs = softmax_probs.gather(1, top2_indices)
            top2 = top2_indices.detach().cpu().tolist()
            top2_prob = top2_probs.detach().cpu().tolist()
            top2_strings = [
                [self.task_type_map[str(idx)] for idx in sample] for sample in top2
            ]
            top2_prob_rounded = [
                [round(value, 3) for value in sublist] for sublist in top2_prob
            ]
            counter = 0
            for sublist in top2_prob_rounded:
                if sublist[1] < 0.1:
                    top2_strings[counter][1] = "NA"
                counter += 1
            task_type_1 = [sublist[0] for sublist in top2_strings]
            task_type_2 = [sublist[1] for sublist in top2_strings]
            task_type_prob = [sublist[0] for sublist in top2_prob_rounded]
            return (task_type_1, task_type_2, task_type_prob)
        else:
            preds = torch.softmax(preds, dim=1)
            weights = np.array(self.weights_map[target])
            weighted_sum = np.sum(np.array(preds.detach().cpu()) * weights, axis=1)
            scores = weighted_sum / self.divisor_map[target]
            scores = [round(value, decimal) for value in scores]
            if target == "number_of_few_shots":
                scores = [x if x >= 0.05 else 0 for x in scores]
            return scores

    def process_logits(self, logits):
        result = {}
        task_type_results = self.compute_results(logits[0], target="task_type")
        result["task_type_1"] = task_type_results[0]
        result["task_type_2"] = task_type_results[1]
        result["task_type_prob"] = task_type_results[2]
        
        targets = ["creativity_scope", "reasoning", "contextual_knowledge",
                   "number_of_few_shots", "domain_knowledge",
                   "no_label_reason", "constraint_ct"]
        
        for i, target in enumerate(targets, start=1):
            if i < len(logits):
                result[target] = self.compute_results(logits[i], target=target)
        
        if all(k in result for k in ["creativity_scope", "reasoning", "constraint_ct", 
                                       "domain_knowledge", "contextual_knowledge", "number_of_few_shots"]):
            result["prompt_complexity_score"] = [
                round(
                    0.35 * creativity + 0.25 * reasoning + 0.15 * constraint
                    + 0.15 * domain + 0.05 * contextual + 0.05 * few_shots, 5,
                )
                for creativity, reasoning, constraint, domain, contextual, few_shots in zip(
                    result["creativity_scope"], result["reasoning"], result["constraint_ct"],
                    result["domain_knowledge"], result["contextual_knowledge"], result["number_of_few_shots"],
                )
            ]
        
        return result

    def forward(self, batch):
        outputs = self.backbone(
            input_ids=batch["input_ids"],
            attention_mask=batch["attention_mask"]
        )
        pooled = self.pool(outputs.last_hidden_state, batch["attention_mask"])
        logits = [head(pooled) for head in self.heads]
        return self.process_logits(logits)


# ── Load model ────────────────────────────────────────────────────────────
MODEL_NAME = "nvidia/prompt-task-and-complexity-classifier"

print(f"[EcoRoute] Loading {MODEL_NAME} ...")

try:
    from huggingface_hub import hf_hub_download
    
    config_path = hf_hub_download(
        repo_id=MODEL_NAME,
        filename="config.json",
        force_download=False
    )
    
    with open(config_path, 'r') as f:
        config_dict = json.load(f)
    
    print(f"[EcoRoute] Config loaded successfully")
    
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    
    model = CustomModel(
        target_sizes=config_dict['target_sizes'],
        task_type_map=config_dict['task_type_map'],
        weights_map=config_dict['weights_map'],
        divisor_map=config_dict['divisor_map'],
    ).from_pretrained(MODEL_NAME)
    
    model.eval()
    print("[EcoRoute] Model ready ✅")
    
except Exception as e:
    print(f"[EcoRoute] Error loading model: {e}")
    raise


# ── FastAPI server ────────────────────────────────────────────────────────
app = FastAPI(title="EcoRoute NVIDIA Classifier", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)


class ClassifyRequest(BaseModel):
    text: str


class ClassifyResponse(BaseModel):
    complexity_score: float
    task_type: str
    creativity_scope: str
    reasoning_level: str
    constraint_count: int
    raw_scores: dict


def bucket(score: float) -> str:
    if score < 0.35:
        return "low"
    if score < 0.70:
        return "medium"
    return "high"


def count_constraints(text: str) -> int:
    lower = text.lower()
    hits = 0
    for pattern in [r'\b(must|should|need to|have to)\b', 
                    r'\b(but|however|although|unless|except)\b',
                    r'\b(if|when|while|before|after|during)\b',
                    r'\b(with|without|including|excluding)\b']:
        hits += len(re.findall(pattern, lower))
    return hits


def classify_text(text: str) -> dict:
    """Core classification function — shared by /classify and /test"""
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="text must not be empty")

    prompt = [f"Prompt: {text}"]
    encoded = tokenizer(
        prompt,
        return_tensors="pt",
        add_special_tokens=True,
        max_length=512,
        padding="max_length",
        truncation=True,
    )

    with torch.no_grad():
        result = model(encoded)

    complexity_score = float(result["prompt_complexity_score"][0])
    task_type = result["task_type_1"][0]
    creativity = float(result.get("creativity_scope", [0.1])[0])
    reasoning = float(result.get("reasoning", [0.1])[0])

    return {
        "complexity_score": round(complexity_score, 4),
        "task_type": task_type,
        "creativity_scope": bucket(creativity),
        "reasoning_level": bucket(reasoning),
        "constraint_count": count_constraints(text),
        "raw_scores": {
            "task_type_1": task_type,
            "task_type_2": result.get("task_type_2", ["NA"])[0],
            "task_type_prob": float(result.get("task_type_prob", [0.5])[0]),
            "creativity_scope": creativity,
            "reasoning": reasoning,
            "contextual_knowledge": float(result.get("contextual_knowledge", [0.1])[0]),
            "domain_knowledge": float(result.get("domain_knowledge", [0.1])[0]),
            "constraint_ct": float(result.get("constraint_ct", [0.1])[0]),
            "number_of_few_shots": float(result.get("number_of_few_shots", [0])[0]),
            "prompt_complexity_score": complexity_score,
        }
    }


# ── API Endpoints ─────────────────────────────────────────────────────────

@app.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    """Classify a single prompt"""
    return classify_text(req.text)


@app.get("/health")
def health():
    """Health check"""
    return {"status": "ok", "model": MODEL_NAME}


@app.get("/test")
def test_classifier():
    """🎯 BUILT-IN TEST: Classifies sample prompts of varying complexity
    Open http://localhost:8000/test in your browser to see results
    """
    
    test_prompts = [
        # Simple prompts (should be LOW)
        ("Hi", "simple greeting"),
        ("hello", "simple greeting"),
        ("What is 2+2?", "basic math question"),
        ("thanks", "one word"),
        ("What time is it?", "simple question"),
        
        # Medium prompts (should be MEDIUM)
        ("Write a Python function to sort a list", "simple coding task"),
        ("Explain how photosynthesis works", "science explanation"),
        ("Summarize the plot of Romeo and Juliet", "literature summary"),
        ("What are the benefits of exercise?", "health question"),
        ("Write a short poem about spring", "creative writing"),
        
        # Complex prompts (should be HIGH)
        ("Write a Python quicksort algorithm with O(n log n) complexity that handles edge cases for empty arrays, duplicate values, and already sorted arrays. Include detailed comments and type hints.", "complex coding task"),
        ("Explain quantum computing in detail including superposition, entanglement, quantum gates, Shor's algorithm, and real-world applications in cryptography and drug discovery.", "deep technical explanation"),
        ("Create a full microservices architecture design with Docker containers, Kubernetes orchestration, Redis caching layer, PostgreSQL database with sharding, JWT authentication, rate limiting, and horizontal scaling for 1 million concurrent users.", "complex system design"),
        ("Analyze the economic impact of artificial intelligence on global labor markets over the next 20 years, considering automation rates, job displacement, new job creation, income inequality, and policy recommendations.", "detailed analysis"),
        ("Compare and contrast five different sorting algorithms (quicksort, mergesort, heapsort, radix sort, timsort) with time complexity analysis, space complexity analysis, stability, and real-world performance benchmarks.", "technical comparison"),
    ]
    
    results = []
    scores = []
    
    print("\n" + "="*80)
    print("🎯 RUNNING CLASSIFIER TEST")
    print("="*80)
    
    for prompt_text, category in test_prompts:
        result = classify_text(prompt_text)
        score = result["complexity_score"]
        scores.append(score)
        
        emoji = '🟢' if score < 0.25 else '🟡' if score < 0.55 else '🔴'
        
        print(f"\n{emoji} [{score:.4f}] {category}")
        print(f"   Task: {result['task_type']} | Creativity: {result['creativity_scope']} | Reasoning: {result['reasoning_level']}")
        print(f"   \"{prompt_text[:100]}{'...' if len(prompt_text) > 100 else ''}\"")
        
        results.append({
            "prompt": prompt_text[:100],
            "category": category,
            "complexity_score": score,
            "task_type": result["task_type"],
            "creativity_scope": result["creativity_scope"],
            "reasoning_level": result["reasoning_level"],
        })
    
    print("\n" + "="*80)
    print("📊 SUMMARY")
    print("="*80)
    print(f"  Min score:  {min(scores):.4f}")
    print(f"  Max score:  {max(scores):.4f}")
    print(f"  Avg score:  {sum(scores)/len(scores):.4f}")
    print(f"  Range:      {max(scores) - min(scores):.4f}")
    print(f"\n  Suggested thresholds for NVIDIA classifier:")
    print(f"    LOW    → score < 0.25  (Haiku / GPT-4o mini)")
    print(f"    MEDIUM → 0.25 to 0.55  (Sonnet / GPT-4o)")
    print(f"    HIGH   → score > 0.55  (Sonnet 4.6 / Opus)")
    print("="*80)
    
    return {
        "test_results": results,
        "summary": {
            "min_score": round(min(scores), 4),
            "max_score": round(max(scores), 4),
            "avg_score": round(sum(scores)/len(scores), 4),
            "range": round(max(scores) - min(scores), 4),
            "suggested_thresholds": {
                "low_below": 0.25,
                "medium_range": "0.25 - 0.55",
                "high_above": 0.55,
                "model_mapping": {
                    "low": "Haiku 4.5 / GPT-4o mini",
                    "medium": "Sonnet 4.5 / GPT-4o",
                    "high": "Sonnet 4.6 / Opus / GPT-4.5"
                }
            }
        }
    }


@app.get("/quick-test")
def quick_test():
    """Quick test with fewer prompts — faster loading"""
    prompts = ["Hi", "Write a Python sorting algorithm", "Design a complete microservices architecture with Docker and Kubernetes"]
    results = []
    for p in prompts:
        r = classify_text(p)
        results.append({"prompt": p[:60], "score": r["complexity_score"], "task": r["task_type"]})
    return {"results": results}


if __name__ == "__main__":
    print("\n" + "="*60)
    print("🌿 EcoRoute NVIDIA Classifier Server")
    print("="*60)
    print(f"  Classify endpoint: http://localhost:8000/classify")
    print(f"  Health check:      http://localhost:8000/health")
    print(f"  🎯 Full test:      http://localhost:8000/test")
    print(f"  ⚡ Quick test:     http://localhost:8000/quick-test")
    print("="*60 + "\n")
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")