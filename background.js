// background.js — EcoRoute service worker v2 (NVIDIA classifier only)
// All classification is done exclusively via nvidia_classifier_server.py
// running at http://localhost:8000/classify — no local JS classifier used.

importScripts('modelSelector.js', 'apiKeys.js');

const NVIDIA_ENDPOINT = 'http://localhost:8000/classify';

// ─── Response cache (prompt hash → response) ───────────────────────────────
const RESPONSE_CACHE = new Map();
const CACHE_MAX = 50;

function hashPrompt(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function getCached(promptText) {
  return RESPONSE_CACHE.get(hashPrompt(promptText)) || null;
}

function setCache(promptText, entry) {
  if (RESPONSE_CACHE.size >= CACHE_MAX) {
    RESPONSE_CACHE.delete(RESPONSE_CACHE.keys().next().value);
  }
  RESPONSE_CACHE.set(hashPrompt(promptText), entry);
}

// ─── NVIDIA classifier call ────────────────────────────────────────────────
async function callNvidiaClassifier(text) {
  const res = await fetch(NVIDIA_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`NVIDIA classifier HTTP ${res.status}`);
  return await res.json();
}

// ─── Install / init ────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    ecoStats: {
      totalQueries: 0,
      totalWhUsed: 0,
      totalWhSaved: 0,
      totalCo2Saved: 0,
      tierCounts: { low: 0, medium: 0, high: 0 },
      lastUpdated: Date.now(),
    },
    ecoLastModel: null,
  });
});

// ─── Badge update ──────────────────────────────────────────────────────────
chrome.storage.onChanged.addListener((changes) => {
  if (changes.ecoStats?.newValue) {
    const stats = changes.ecoStats.newValue;
    const saved = stats.totalWhSaved || 0;
    const label = saved > 0
      ? saved < 0.001
        ? `${Math.round(saved * 1e6)}μ`
        : `${(saved * 1000).toFixed(0)}m`
      : '';
    chrome.action.setBadgeText({ text: label });
    chrome.action.setBadgeBackgroundColor({ color: '#1D9E75' });
  }
});

// ─── Message router ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'CLASSIFY_AND_ROUTE') {
    handleClassifyAndRoute(msg.payload).then(sendResponse);
    return true;
  }
  if (msg.type === 'CLASSIFY_ONLY') {
    classifyOnly(msg.payload.promptText).then(sendResponse);
    return true;
  }
  if (msg.type === 'GET_LAST_MODEL') {
    chrome.storage.local.get(['ecoLastModel'], (d) => sendResponse(d.ecoLastModel || null));
    return true;
  }
  if (msg.type === 'SAVE_API_KEY') {
    API_KEYS.save(msg.provider, msg.key).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === 'GET_CONFIGURED_PROVIDERS') {
    API_KEYS.getConfiguredProviders().then(sendResponse);
    return true;
  }
});

// ─── Classify only (for badge live preview) ────────────────────────────────
async function classifyOnly(promptText) {
  try {
    const classification = await callNvidiaClassifier(promptText);
    const tier = classification.complexity_score < 0.35 ? 'low'
      : classification.complexity_score < 0.70 ? 'medium' : 'high';
    return { ok: true, classification, tier };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Core routing logic ────────────────────────────────────────────────────
async function handleClassifyAndRoute(payload) {
  const { promptText, overrideModelId } = payload;

  const cached = getCached(promptText);
  if (cached) return { ...cached, fromCache: true };

  let classification;
  try {
    classification = await callNvidiaClassifier(promptText);
  } catch (err) {
    return {
      selection: null,
      usedModelId: null,
      response: null,
      error: `NVIDIA classifier unavailable: ${err.message}. Make sure nvidia_classifier_server.py is running on port 8000.`,
      fromCache: false,
      perf: null,
    };
  }

  const classificationWithLength = { ...classification, prompt_length: promptText.length };

  const selection = overrideModelId
    ? {
        modelId: overrideModelId,
        model: MODEL_SELECTOR.MODELS[overrideModelId],
        reason: 'Manual override',
        estimatedCostUSD: 0,
        fallbackChain: [overrideModelId],
      }
    : MODEL_SELECTOR.selectModel(classificationWithLength);

  let response = null;
  let usedModelId = null;
  let error = null;

  for (const candidateId of selection.fallbackChain) {
    const model = MODEL_SELECTOR.MODELS[candidateId];
    if (!model) continue;
    if (!MODEL_SELECTOR.checkRateLimit(candidateId)) continue;

    const apiKey = await API_KEYS.get(model.provider);
    if (model.provider !== 'local' && !apiKey) continue;

    const t0 = Date.now();
    try {
      response = await callModel(model, apiKey, promptText);
      MODEL_SELECTOR.recordPerf(candidateId, Date.now() - t0, true);
      usedModelId = candidateId;
      break;
    } catch (err) {
      MODEL_SELECTOR.recordPerf(candidateId, Date.now() - t0, false);
      error = err.message;
    }
  }

  const result = {
    selection,
    classification,
    usedModelId,
    response: response?.text || null,
    error: response ? null : (error || 'All models unavailable or unconfigured'),
    fromCache: false,
    perf: usedModelId ? MODEL_SELECTOR.getPerf(usedModelId) : null,
  };

  if (response?.text) {
    setCache(promptText, result);
    chrome.storage.local.set({ ecoLastModel: { ...selection, usedModelId } });
  }

  return result;
}

// ─── API adapters ──────────────────────────────────────────────────────────
async function callModel(model, apiKey, promptText) {
  switch (model.provider) {
    case 'local':     return callOllama(model, promptText);
    case 'openai':    return callOpenAI(model, apiKey, promptText);
    case 'anthropic': return callAnthropic(model, apiKey, promptText);
    case 'together':  return callTogether(model, apiKey, promptText);
    default: throw new Error(`Unknown provider: ${model.provider}`);
  }
}

async function callOllama(model, promptText) {
  const res = await fetch(model.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model.id, prompt: promptText, stream: false }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const data = await res.json();
  return { text: data.response };
}

async function callOpenAI(model, apiKey, promptText) {
  const res = await fetch(model.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model.model,
      messages: [{ role: 'user', content: promptText }],
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || '' };
}

async function callAnthropic(model, apiKey, promptText) {
  const res = await fetch(model.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: promptText }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const data = await res.json();
  return { text: data.content?.[0]?.text || '' };
}

async function callTogether(model, apiKey, promptText) {
  const res = await fetch(model.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model.model,
      messages: [{ role: 'user', content: promptText }],
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`Together HTTP ${res.status}`);
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || '' };
}