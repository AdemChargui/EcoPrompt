# ⚡ EcoRoute — AI Energy Optimizer

> A browser extension that automatically detects prompt complexity and routes each AI query to the most energy-efficient model capable of answering it — passively reducing AI energy consumption without changing user behavior.

**Hackathon submission for IEEE PES Green AI Challenge**
Tracks addressed: **A** (smarter model selection) · **B** (real-time energy cost) · **C** (passive reduction)

---

## The Problem

Every AI query has an energy cost. Asking "what's the capital of France?" on GPT-4.5 consumes ~25x more energy than it needs to. Most users default to the biggest, most powerful model for every task — even simple ones. This wastes energy at massive scale.

**EcoRoute fixes this automatically, without asking users to do anything differently.**

---

## How It Works

```
User types prompt → Complexity classifier → Model tier selected → Badge shows energy cost
                                                                 ↓
                                                     Stats stored → Popup dashboard
```

### Complexity Classifier
A pure JavaScript heuristic engine that analyzes:
- **Token count** — longer prompts need more processing
- **Complexity keywords** — "analyze", "compare", "implement" vs "what is", "define"
- **Code detection** — presence of code blocks, syntax patterns
- **Multi-task patterns** — numbered steps, multiple questions
- **Intent signals** — question marks, data references

Output: score 0–100 → tier: `low` / `medium` / `high`

### Energy Model
Based on published research benchmarks:

| Tier | Examples | Energy/query | CO₂/query |
|------|----------|-------------|-----------|
| Small | Haiku, GPT-4o mini | ~1 mWh | ~0.43 μg |
| Mid | Sonnet, GPT-4o | ~6 mWh | ~2.57 μg |
| Large | Opus, o1, GPT-4.5 | ~25 mWh | ~10.7 μg |

CO₂ intensity: **0.429 kg CO₂/kWh** (IEA Global Average 2024)

### Energy Sources (Published Benchmarks)
- **Luccioni et al. (2023)** "Power Hungry Processing: Watts Driving the Cost of AI Deployment?" — [arxiv.org/abs/2311.16863](https://arxiv.org/abs/2311.16863)
- **Patterson et al. (2021)** "Carbon and the Cloud" — [arxiv.org/abs/2104.10350](https://arxiv.org/abs/2104.10350)
- **IEA (2024)** "Electricity 2024" — global grid carbon intensity
- **Samsi et al. (2023)** "From Words to Watts: Benchmarking the Energy Costs of Large Language Model Inference"

---

## Installation

1. Clone this repo: `git clone https://github.com/YOUR_USERNAME/ecoroute`
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** → select the `ecoroute` folder
5. Visit [claude.ai](https://claude.ai), [chatgpt.com](https://chatgpt.com), or [gemini.google.com](https://gemini.google.com)
6. Start typing — the EcoRoute badge will appear in the bottom-right

---

## Features

- **Real-time badge** — shows model tier, estimated Wh, CO₂ cost as you type
- **Manual override** — click the dropdown to force a specific tier
- **Session dashboard** — popup shows total energy saved, CO₂ avoided, model distribution
- **Multi-platform** — works on ChatGPT, Claude, Gemini, Perplexity
- **Zero behavior change** — passive by default, users don't need to do anything
- **Privacy-first** — no data leaves your browser, all processing is local

---

## Supported Platforms

| Platform | Status |
|----------|--------|
| claude.ai | ✅ |
| chatgpt.com | ✅ |
| gemini.google.com | ✅ |
| perplexity.ai | ✅ |

---

## Project Structure

```
ecoroute/
├── manifest.json      # Chrome Extension Manifest V3
├── classifier.js      # Heuristic prompt complexity scorer
├── energy.js          # Energy/CO₂ estimation model
├── content.js         # Injected badge UI + interaction logic
├── content.css        # Badge styles
├── popup.html         # Extension popup dashboard
├── popup.js           # Dashboard data rendering
├── popup.css          # Dashboard styles
├── background.js      # Service worker + badge counter
└── icons/             # Extension icons
```

---

## Roadmap

- [ ] ONNX.js lightweight ML classifier (replace heuristics)
- [ ] API-level routing (intercept requests and switch models automatically)
- [ ] Carbon intensity by region (use real-time grid data)
- [ ] Weekly/monthly CO₂ report export
- [ ] Firefox support

---

## License
MIT — built for IEEE PES Green AI Hackathon
