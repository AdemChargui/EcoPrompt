// content.js — EcoRoute v3 (NVIDIA classifier only)
// All classification is done exclusively via nvidia_classifier_server.py
// running locally at http://localhost:8000/classify — no local JS classifier used.

(function () {
  if (window.__ecoRouteLoaded) return;
  window.__ecoRouteLoaded = true;

  const PLATFORM = (() => {
    const host = location.hostname.replace('www.', '');
    const configs = {
      'chatgpt.com': {
        getTextarea: () =>
          document.querySelector('#prompt-textarea') ||
          document.querySelector('div[contenteditable="true"][data-virtualized="false"]') ||
          document.querySelector('div[contenteditable="true"]'),
        getSubmitBtn: () =>
          document.querySelector('[data-testid="send-button"]') ||
          document.querySelector('button[aria-label="Send prompt"]')
      },
      'chat.openai.com': {
        getTextarea: () => document.querySelector('#prompt-textarea') || document.querySelector('div[contenteditable="true"]'),
        getSubmitBtn: () => document.querySelector('[data-testid="send-button"]')
      },
      'claude.ai': {
        getTextarea: () =>
          document.querySelector('div[contenteditable="true"].ProseMirror') ||
          document.querySelector('div[contenteditable="true"]'),
        getSubmitBtn: () =>
          document.querySelector('button[aria-label="Send Message"]') ||
          document.querySelector('button[type="submit"]')
      },
      'gemini.google.com': {
        getTextarea: () =>
          document.querySelector('rich-textarea div[contenteditable="true"]') ||
          document.querySelector('div[contenteditable="true"]'),
        getSubmitBtn: () => document.querySelector('button[aria-label="Send message"]')
      },
      'perplexity.ai': {
        getTextarea: () => document.querySelector('textarea') || document.querySelector('div[contenteditable="true"]'),
        getSubmitBtn: () => document.querySelector('button[aria-label="Submit"]')
      }
    };
    return configs[host] || null;
  })();

  if (!PLATFORM) return;

  const MODEL_NAMES = {
    'chatgpt.com':       { low: 'GPT-4o mini', medium: 'GPT-4o', high: 'o1 / GPT-4.5' },
    'chat.openai.com':   { low: 'GPT-4o mini', medium: 'GPT-4o', high: 'o1 / GPT-4.5' },
    'claude.ai':         { low: 'Claude Haiku', medium: 'Claude Sonnet', high: 'Claude Opus' },
    'gemini.google.com': { low: 'Gemini Flash', medium: 'Gemini Pro', high: 'Gemini Ultra' },
    'perplexity.ai':     { low: 'Standard', medium: 'Pro', high: 'Pro (advanced)' }
  };

  function getModelName(tier) {
    const host = location.hostname.replace('www.', '');
    return (MODEL_NAMES[host] || MODEL_NAMES['chatgpt.com'])[tier];
  }

  let badgeEl = null;
  let overrideTier = null;
  let overrideModelId = null;
  let debounceTimer = null;
  let lastText = '';
  let currentTier = 'low';
  let lastRouteResult = null;
  let lastClassification = null;

  function nvidiaClassify(text, callback) {
    chrome.runtime.sendMessage(
      { type: 'CLASSIFY_ONLY', payload: { promptText: text } },
      (result) => {
        if (chrome.runtime.lastError || !result?.ok) {
          callback(null);
        } else {
          callback(result);
        }
      }
    );
  }

  function createBadge() {
    const el = document.createElement('div');
    el.id = 'ecoroute-badge';
    el.innerHTML = `
      <div class="er-row er-top">
        <span class="er-logo">&#x26a1;</span>
        <span class="er-brand">EcoRoute</span>
        <span class="er-tier-pill" id="er-tier-pill">—</span>
        <button class="er-override-btn" id="er-override-btn" title="Override">&#x25BE;</button>
      </div>
      <div class="er-rec" id="er-rec" style="display:none"></div>
      <div class="er-model-sel" id="er-model-sel" style="display:none"></div>
      <div class="er-row er-stats">
        <span class="er-stat" id="er-wh">—</span>
        <span class="er-sep">·</span>
        <span class="er-stat" id="er-co2">—</span>
        <span class="er-sep">·</span>
        <span class="er-save" id="er-save">—</span>
      </div>
      <div class="er-dropdown" id="er-dropdown" style="display:none">
        <div class="er-dd-title">Override model tier</div>
        <button class="er-dd-opt" data-tier="low">
          <span style="color:#1D9E75;font-size:10px">&#x25B2;</span>
          <span class="er-dd-label">Small</span>
          <span class="er-dd-sub">Haiku · GPT-4o mini · Flash</span>
        </button>
        <button class="er-dd-opt" data-tier="medium">
          <span style="color:#BA7517;font-size:10px">&#x25B2;&#x25B2;</span>
          <span class="er-dd-label">Mid</span>
          <span class="er-dd-sub">Sonnet · GPT-4o · Pro</span>
        </button>
        <button class="er-dd-opt" data-tier="high">
          <span style="color:#D85A30;font-size:10px">&#x25B2;&#x25B2;&#x25B2;</span>
          <span class="er-dd-label">Large</span>
          <span class="er-dd-sub">Opus · o1 · GPT-4.5</span>
        </button>
        <button class="er-dd-opt" data-tier="auto">
          <span style="color:#7F77DD;font-size:10px">&#x2736;</span>
          <span class="er-dd-label">Auto</span>
          <span class="er-dd-sub">Let EcoRoute decide</span>
        </button>
      </div>
    `;
    document.body.appendChild(el);

    el.querySelector('#er-override-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = el.querySelector('#er-dropdown');
      dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    });

    el.querySelectorAll('.er-dd-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        overrideTier = btn.dataset.tier === 'auto' ? null : btn.dataset.tier;
        overrideModelId = null;
        el.querySelector('#er-dropdown').style.display = 'none';
        updateBadge(lastText);
      });
    });

    document.addEventListener('click', () => {
      const dd = el.querySelector('#er-dropdown');
      if (dd) dd.style.display = 'none';
    });

    return el;
  }

  function applyBadgeResult(text, nvidiaResult) {
    if (!badgeEl) return;

    if (!nvidiaResult) {
      const pill = badgeEl.querySelector('#er-tier-pill');
      pill.textContent = 'offline';
      pill.style.background = '#F1EFE8';
      pill.style.color = '#5F5E5A';
      pill.style.border = '1px solid #B4B2A9';
      badgeEl.querySelector('#er-rec').style.display = 'block';
      badgeEl.querySelector('#er-rec').innerHTML =
        '<span style="color:#D85A30;font-size:10px">⚠ nvidia_classifier_server.py not running on port 8000</span>';
      badgeEl.querySelector('#er-model-sel').style.display = 'none';
      return;
    }

    lastClassification = nvidiaResult.classification;
    const effectiveTier = overrideTier || nvidiaResult.tier;
    currentTier = effectiveTier;

    const tierInfo = window.ENERGY.getTierInfo(effectiveTier);
    const energy = window.ENERGY.calcEnergy(effectiveTier, 250);
    const platform = location.hostname.replace('www.', '');
    const defaultTier = window.ENERGY.getDefaultTier(platform);
    const savings = window.ENERGY.calcSavings(defaultTier, effectiveTier);
    const modelName = getModelName(effectiveTier);

    const pill = badgeEl.querySelector('#er-tier-pill');
    pill.textContent = tierInfo.label;
    pill.style.background = tierInfo.colorBg;
    pill.style.color = tierInfo.colorText;
    pill.style.border = `1px solid ${tierInfo.color}55`;

    badgeEl.querySelector('#er-wh').textContent = energy.whDisplay;
    badgeEl.querySelector('#er-co2').textContent = `${energy.co2Display} CO2`;

    const saveEl = badgeEl.querySelector('#er-save');
    if (effectiveTier !== defaultTier && savings.savedWh > 0) {
      saveEl.textContent = `save ${savings.pctSaved}%`;
      saveEl.style.color = '#1D9E75';
    } else if (effectiveTier === defaultTier) {
      saveEl.textContent = 'default';
      saveEl.style.color = '#888780';
    } else {
      saveEl.textContent = 'upgraded';
      saveEl.style.color = '#D85A30';
    }

    const recEl = badgeEl.querySelector('#er-rec');
    const modelSelEl = badgeEl.querySelector('#er-model-sel');

    if (text.trim().length > 3) {
      recEl.style.display = 'block';
      const taskLabel = (lastClassification?.task_type || '').replace('_', ' ');
      recEl.innerHTML =
        `<span style="color:#888">Platform: </span>` +
        `<span style="font-weight:700;color:${tierInfo.color}">${modelName}</span>` +
        (taskLabel ? ` <span style="color:#888;font-size:10px">[${taskLabel}]</span>` : '') +
        (overrideTier ? ' <span style="color:#888;font-size:10px">(manual)</span>' : '');

      if (lastRouteResult?.selection) {
        const s = lastRouteResult.selection;
        const m = s.model;
        modelSelEl.style.display = 'block';
        modelSelEl.innerHTML =
          `<span style="color:#7F77DD;font-size:10px">&#x2771; Route: </span>` +
          `<span style="font-weight:700;color:${m?.color || '#7F77DD'}">${m?.label || s.modelId}</span>` +
          `<span style="color:#888;font-size:9px"> · $${s.estimatedCostUSD?.toFixed(5) || '0'}</span>`;
      } else {
        modelSelEl.style.display = 'none';
      }
    } else {
      recEl.style.display = 'none';
      modelSelEl.style.display = 'none';
    }

    badgeEl.style.opacity = text.trim().length > 0 ? '1' : '0.55';
  }

  function updateBadge(text) {
    if (!badgeEl) return;
    if (!text || text.trim().length === 0) {
      badgeEl.style.opacity = '0.55';
      return;
    }
    const pill = badgeEl.querySelector('#er-tier-pill');
    if (pill.textContent === '—' || pill.textContent === 'offline') {
      pill.textContent = '…';
    }
    nvidiaClassify(text, (result) => applyBadgeResult(text, result));
  }

  function onSubmit() {
    if (!lastText.trim()) return;

    const effectiveTier = overrideTier || (lastClassification
      ? (lastClassification.complexity_score < 0.35 ? 'low'
        : lastClassification.complexity_score < 0.70 ? 'medium' : 'high')
      : 'medium');

    const energy = window.ENERGY.calcEnergy(effectiveTier, 250);
    const platform = location.hostname.replace('www.', '');
    const defaultTier = window.ENERGY.getDefaultTier(platform);
    const savings = window.ENERGY.calcSavings(defaultTier, effectiveTier);

    chrome.runtime.sendMessage({
      type: 'CLASSIFY_AND_ROUTE',
      payload: {
        promptText: lastText,
        overrideModelId: overrideModelId || null,
      }
    }, (routeResult) => {
      if (routeResult) {
        lastRouteResult = routeResult;
        if (routeResult.classification) {
          lastClassification = routeResult.classification;
        }
        updateBadge(lastText);
      }
    });

    chrome.storage.local.get(['ecoStats'], (data) => {
      const stats = data.ecoStats || {
        totalQueries: 0, totalWhUsed: 0,
        totalWhSaved: 0, totalCo2Saved: 0,
        tierCounts: { low: 0, medium: 0, high: 0 }
      };
      stats.totalQueries++;
      stats.totalWhUsed += energy.wh;
      stats.totalWhSaved += Math.max(0, savings.savedWh);
      stats.totalCo2Saved += Math.max(0, savings.savedCo2g);
      stats.tierCounts[effectiveTier] = (stats.tierCounts[effectiveTier] || 0) + 1;
      stats.lastUpdated = Date.now();
      chrome.storage.local.set({ ecoStats: stats });
    });
  }

  function attachListeners() {
    const textarea = PLATFORM.getTextarea();
    if (!textarea) return false;

    const handler = () => {
      const text = textarea.value || textarea.innerText || textarea.textContent || '';
      lastText = text;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => updateBadge(text), 300);
    };

    textarea.removeEventListener('input', handler);
    textarea.addEventListener('input', handler);
    textarea.addEventListener('keyup', handler);

    const submitBtn = PLATFORM.getSubmitBtn();
    if (submitBtn) submitBtn.addEventListener('click', onSubmit);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSubmit();
    });

    return true;
  }

  function init() {
    badgeEl = createBadge();
    let attempts = 0;
    const tryAttach = () => {
      if (attachListeners()) return;
      if (++attempts < 30) setTimeout(tryAttach, 500);
    };
    tryAttach();

    new MutationObserver(() => attachListeners())
      .observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();