// modelSelector.js — EcoRoute AI Model Auto-Selector
// Selects the optimal model based on NVIDIA prompt-task-complexity-classifier output

const MODEL_SELECTOR = (() => {

  // ─── Model Registry ────────────────────────────────────────────────────────
  const MODELS = {
    'phi-2': {
      id: 'phi-2', label: 'Phi-2', tier: 'tiny', provider: 'local',
      endpoint: 'http://localhost:11434/api/generate', costPer1kTokens: 0,
      maxTokens: 2048, strengths: ['qa', 'summarization'],
      wattage: 0.001, color: '#1D9E75', icon: '⚡',
    },
    'stablelm-3b': {
      id: 'stablelm-3b', label: 'StableLM-3B', tier: 'tiny', provider: 'local',
      endpoint: 'http://localhost:11434/api/generate', costPer1kTokens: 0,
      maxTokens: 4096, strengths: ['qa', 'translation', 'summarization'],
      wattage: 0.0015, color: '#1D9E75', icon: '⚡',
    },
    'mistral-7b': {
      id: 'mistral-7b', label: 'Mistral-7B', tier: 'small', provider: 'together',
      endpoint: 'https://api.together.xyz/v1/chat/completions',
      model: 'mistralai/Mistral-7B-Instruct-v0.2', costPer1kTokens: 0.0002,
      maxTokens: 8192, strengths: ['qa', 'summarization', 'analysis', 'translation'],
      wattage: 0.003, color: '#378ADD', icon: '🌿',
    },
    'llama-3-8b': {
      id: 'llama-3-8b', label: 'Llama-3-8B', tier: 'small', provider: 'together',
      endpoint: 'https://api.together.xyz/v1/chat/completions',
      model: 'meta-llama/Llama-3-8b-chat-hf', costPer1kTokens: 0.0002,
      maxTokens: 8192, strengths: ['qa', 'creative_writing', 'summarization'],
      wattage: 0.003, color: '#378ADD', icon: '🌿',
    },
    'codellama-7b': {
      id: 'codellama-7b', label: 'CodeLlama-7B', tier: 'small', provider: 'together',
      endpoint: 'https://api.together.xyz/v1/chat/completions',
      model: 'codellama/CodeLlama-7b-Instruct-hf', costPer1kTokens: 0.0002,
      maxTokens: 16384, strengths: ['code_generation'],
      wattage: 0.003, color: '#7F77DD', icon: '💻',
    },
    'codellama-34b': {
      id: 'codellama-34b', label: 'CodeLlama-34B', tier: 'medium', provider: 'together',
      endpoint: 'https://api.together.xyz/v1/chat/completions',
      model: 'codellama/CodeLlama-34b-Instruct-hf', costPer1kTokens: 0.0008,
      maxTokens: 16384, strengths: ['code_generation'],
      wattage: 0.012, color: '#7F77DD', icon: '💻',
    },
    'wizardcoder-34b': {
      id: 'wizardcoder-34b', label: 'WizardCoder-34B', tier: 'medium', provider: 'together',
      endpoint: 'https://api.together.xyz/v1/chat/completions',
      model: 'WizardLM/WizardCoder-Python-34B-V1.0', costPer1kTokens: 0.0008,
      maxTokens: 8192, strengths: ['code_generation'],
      wattage: 0.012, color: '#7F77DD', icon: '🧙',
    },
    'claude-haiku': {
      id: 'claude-haiku', label: 'Claude Haiku', tier: 'medium', provider: 'anthropic',
      endpoint: 'https://api.anthropic.com/v1/messages',
      model: 'claude-haiku-4-5-20251001', costPer1kTokens: 0.00025,
      maxTokens: 4096, strengths: ['qa', 'summarization', 'translation', 'analysis'],
      wattage: 0.005, color: '#BA7517', icon: '🍃',
    },
    'gpt-3.5-turbo': {
      id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', tier: 'medium', provider: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo', costPer1kTokens: 0.0005,
      maxTokens: 4096, strengths: ['qa', 'analysis', 'summarization', 'translation'],
      wattage: 0.006, color: '#BA7517', icon: '🍃',
    },
    'claude-sonnet': {
      id: 'claude-sonnet', label: 'Claude Sonnet', tier: 'medium', provider: 'anthropic',
      endpoint: 'https://api.anthropic.com/v1/messages',
      model: 'claude-sonnet-4-6', costPer1kTokens: 0.003,
      maxTokens: 8192, strengths: ['creative_writing', 'analysis', 'code_generation'],
      wattage: 0.01, color: '#BA7517', icon: '✨',
    },
    'gpt-4-turbo': {
      id: 'gpt-4-turbo', label: 'GPT-4 Turbo', tier: 'large', provider: 'openai',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4-turbo', costPer1kTokens: 0.01,
      maxTokens: 4096, strengths: ['code_generation', 'analysis', 'reasoning', 'creative_writing'],
      wattage: 0.03, color: '#D85A30', icon: '🔥',
    },
    'claude-opus': {
      id: 'claude-opus', label: 'Claude Opus', tier: 'large', provider: 'anthropic',
      endpoint: 'https://api.anthropic.com/v1/messages',
      model: 'claude-opus-4-6', costPer1kTokens: 0.015,
      maxTokens: 4096, strengths: ['analysis', 'reasoning', 'creative_writing', 'code_generation'],
      wattage: 0.035, color: '#D85A30', icon: '🔥',
    },
    'llama-3-70b': {
      id: 'llama-3-70b', label: 'Llama-3-70B', tier: 'large', provider: 'together',
      endpoint: 'https://api.together.xyz/v1/chat/completions',
      model: 'meta-llama/Llama-3-70b-chat-hf', costPer1kTokens: 0.0009,
      maxTokens: 8192, strengths: ['analysis', 'reasoning', 'creative_writing'],
      wattage: 0.025, color: '#D85A30', icon: '🔥',
    },
  };

  // ─── Provider fallback chains ───────────────────────────────────────────────
  const FALLBACK_CHAINS = {
    'phi-2':          ['phi-2', 'stablelm-3b', 'mistral-7b', 'claude-haiku'],
    'stablelm-3b':    ['stablelm-3b', 'phi-2', 'mistral-7b', 'claude-haiku'],
    'mistral-7b':     ['mistral-7b', 'llama-3-8b', 'claude-haiku', 'gpt-3.5-turbo'],
    'llama-3-8b':     ['llama-3-8b', 'mistral-7b', 'claude-haiku'],
    'codellama-7b':   ['codellama-7b', 'codellama-34b', 'wizardcoder-34b', 'gpt-4-turbo'],
    'codellama-34b':  ['codellama-34b', 'wizardcoder-34b', 'gpt-4-turbo'],
    'wizardcoder-34b':['wizardcoder-34b', 'codellama-34b', 'gpt-4-turbo'],
    'claude-haiku':   ['claude-haiku', 'gpt-3.5-turbo', 'mistral-7b'],
    'gpt-3.5-turbo':  ['gpt-3.5-turbo', 'claude-haiku', 'mistral-7b'],
    'claude-sonnet':  ['claude-sonnet', 'gpt-3.5-turbo', 'claude-haiku'],
    'gpt-4-turbo':    ['gpt-4-turbo', 'claude-opus', 'llama-3-70b'],
    'claude-opus':    ['claude-opus', 'gpt-4-turbo', 'llama-3-70b'],
    'llama-3-70b':    ['llama-3-70b', 'gpt-4-turbo', 'claude-opus'],
  };

  // ─── Decision Matrix ────────────────────────────────────────────────────────
  function selectModel(classification) {
    const {
      complexity_score = 0.5,
      task_type = 'qa',
      creativity_scope = 'low',
      reasoning_level = 'low',
      constraint_count = 0,
    } = classification;

    let modelId;
    let reason;

    if (complexity_score < 0.3) {
      if (task_type === 'translation') {
        modelId = 'stablelm-3b';
        reason = 'Simple translation → local StableLM-3B (zero cost, sufficient)';
      } else {
        modelId = 'phi-2';
        reason = 'Low complexity → Phi-2 local (fastest, zero cost)';
      }
    } else if (complexity_score < 0.7) {
      if (task_type === 'code_generation') {
        if (constraint_count >= 3 || reasoning_level === 'high') {
          modelId = 'codellama-34b';
          reason = 'Medium-complex code with high constraints → CodeLlama-34B';
        } else {
          modelId = 'codellama-7b';
          reason = 'Medium code task → CodeLlama-7B (specialized, efficient)';
        }
      } else if (task_type === 'creative_writing') {
        if (creativity_scope === 'high') {
          modelId = 'claude-sonnet';
          reason = 'Creative writing with high creativity → Claude Sonnet';
        } else {
          modelId = 'llama-3-8b';
          reason = 'Moderate creative task → Llama-3-8B';
        }
      } else if (task_type === 'analysis') {
        if (reasoning_level === 'high') {
          modelId = 'claude-sonnet';
          reason = 'Medium analysis with high reasoning → Claude Sonnet';
        } else {
          modelId = 'mistral-7b';
          reason = 'Standard analysis → Mistral-7B (balanced)';
        }
      } else if (task_type === 'translation') {
        modelId = 'mistral-7b';
        reason = 'Medium translation → Mistral-7B';
      } else {
        modelId = 'claude-haiku';
        reason = 'Medium QA/summarization → Claude Haiku (fast cloud)';
      }
    } else {
      if (task_type === 'code_generation') {
        modelId = 'gpt-4-turbo';
        reason = 'High-complexity code → GPT-4 Turbo (best coding performance)';
      } else if (task_type === 'creative_writing' && creativity_scope === 'high') {
        modelId = 'claude-opus';
        reason = 'Complex creative + high creativity → Claude Opus';
      } else if (reasoning_level === 'high') {
        modelId = 'claude-opus';
        reason = 'High complexity + high reasoning → Claude Opus';
      } else if (task_type === 'analysis') {
        modelId = creativity_scope === 'high' ? 'claude-opus' : 'gpt-4-turbo';
        reason = `Deep analysis → ${creativity_scope === 'high' ? 'Claude Opus' : 'GPT-4 Turbo'}`;
      } else {
        modelId = 'llama-3-70b';
        reason = 'High complexity general task → Llama-3-70B (capable, lower cost)';
      }
    }

    const model = MODELS[modelId];
    const estimatedTokens = Math.ceil((classification.prompt_length || 300) * 1.3);
    const estimatedCostUSD = (estimatedTokens / 1000) * model.costPer1kTokens;

    return {
      modelId, model, reason,
      estimatedCostUSD: +estimatedCostUSD.toFixed(6),
      estimatedTokens,
      fallbackChain: FALLBACK_CHAINS[modelId] || [modelId],
    };
  }

  // ─── Performance Tracker ────────────────────────────────────────────────────
  const _perf = {};
  function recordPerf(modelId, ms, success) {
    if (!_perf[modelId]) _perf[modelId] = { calls: 0, totalMs: 0, errors: 0 };
    _perf[modelId].calls++;
    _perf[modelId].totalMs += ms;
    if (!success) _perf[modelId].errors++;
  }
  function getPerf(modelId) {
    const p = _perf[modelId];
    if (!p || p.calls === 0) return null;
    return { calls: p.calls, avgMs: Math.round(p.totalMs / p.calls), errorRate: +(p.errors / p.calls).toFixed(3) };
  }

  const _rateCounts = {};
  function checkRateLimit(modelId, limitPerMin = 60) {
    const now = Date.now();
    const key = `${modelId}:${Math.floor(now / 60000)}`;
    _rateCounts[key] = (_rateCounts[key] || 0) + 1;
    return _rateCounts[key] <= limitPerMin;
  }

  return { MODELS, FALLBACK_CHAINS, selectModel, recordPerf, getPerf, checkRateLimit };
})();

if (typeof globalThis !== 'undefined') globalThis.MODEL_SELECTOR = MODEL_SELECTOR;