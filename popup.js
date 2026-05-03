// popup.js — EcoRoute v3

function formatWh(wh) {
  if (wh === 0) return '0 mWh';
  if (wh < 0.001) return `${(wh * 1000000).toFixed(1)} μWh`;
  if (wh < 1) return `${(wh * 1000).toFixed(2)} mWh`;
  return `${wh.toFixed(3)} Wh`;
}
function formatCo2(g) {
  if (g === 0) return '0 mg';
  if (g < 0.001) return `${(g * 1000000).toFixed(1)} μg`;
  if (g < 1) return `${(g * 1000).toFixed(2)} mg`;
  return `${g.toFixed(3)} g`;
}

// ── Tab switching ──────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById('tab-stats').style.display  = tab === 'stats'  ? '' : 'none';
    document.getElementById('tab-model').style.display  = tab === 'model'  ? '' : 'none';
    document.getElementById('tab-keys').style.display   = tab === 'keys'   ? '' : 'none';
    if (tab === 'model') renderLastModel();
    if (tab === 'keys')  renderKeys();
  });
});

// ── Stats tab ──────────────────────────────────────────────────────────────
function render(stats) {
  const q = stats.totalQueries || 0;
  const wh = stats.totalWhSaved || 0;
  const co2 = stats.totalCo2Saved || 0;
  const tiers = stats.tierCounts || { low: 0, medium: 0, high: 0 };
  const total = tiers.low + tiers.medium + tiers.high || 1;

  const bannerMain = document.getElementById('impact-main');
  const bannerSub  = document.getElementById('impact-sub');
  if (wh > 0) {
    bannerMain.textContent = formatWh(wh) + ' saved';
    bannerSub.textContent  = `${formatCo2(co2)} CO₂ avoided across ${q} queries`;
  } else {
    bannerMain.textContent = 'No savings yet';
    bannerSub.textContent  = 'Open an AI chat and start typing';
  }

  document.getElementById('stat-queries').textContent = q;
  document.getElementById('stat-wh').textContent  = formatWh(wh);
  document.getElementById('stat-co2').textContent = formatCo2(co2);
  const effPct = q > 0 ? Math.round(((tiers.low || 0) / q) * 100) + '%' : '—';
  document.getElementById('stat-eff').textContent = effPct;

  const setBar = (id, count) => {
    const pct = Math.max(count / total * 100, count > 0 ? 5 : 0);
    document.getElementById('bar-'   + id).style.width = pct.toFixed(1) + '%';
    document.getElementById('count-' + id).textContent = count;
  };
  setBar('low',    tiers.low    || 0);
  setBar('medium', tiers.medium || 0);
  setBar('high',   tiers.high   || 0);
}

chrome.storage.local.get(['ecoStats'], (data) => render(data.ecoStats || {}));
document.getElementById('reset-btn').addEventListener('click', () => {
  if (confirm('Reset all EcoRoute statistics?')) {
    chrome.storage.local.set({ ecoStats: null, ecoLastModel: null }, () => render({}));
  }
});
setInterval(() => {
  chrome.storage.local.get(['ecoStats'], (data) => render(data.ecoStats || {}));
}, 2000);

// ── Model tab ──────────────────────────────────────────────────────────────
const TIER_COLORS = { tiny: '#1D9E75', small: '#378ADD', medium: '#BA7517', large: '#D85A30' };

function renderLastModel() {
  chrome.storage.local.get(['ecoLastModel'], (data) => {
    const m = data.ecoLastModel;
    document.getElementById('model-none').style.display    = m ? 'none' : '';
    document.getElementById('model-details').style.display = m ? '' : 'none';
    if (!m) return;

    const model = m.model || {};
    document.getElementById('m-icon').textContent     = model.icon || '🤖';
    document.getElementById('m-name').textContent     = model.label || m.modelId;
    document.getElementById('m-provider').textContent = (model.provider || '').toUpperCase();
    document.getElementById('m-tier').textContent     = model.tier || '—';
    document.getElementById('m-tier').style.background = TIER_COLORS[model.tier] || '#888';
    document.getElementById('m-reason').textContent   = m.reason || '—';
    document.getElementById('m-cost').textContent     =
      m.estimatedCostUSD != null ? `$${m.estimatedCostUSD.toFixed(6)}` : '—';
    document.getElementById('m-tokens').textContent   =
      m.estimatedTokens != null ? `~${m.estimatedTokens} tokens` : '—';

    const perf = m.perf;
    document.getElementById('m-latency').textContent  = perf ? `${perf.avgMs} ms avg` : 'pending';
    document.getElementById('m-cache').textContent    = m.fromCache ? '✅ yes' : 'no';

    const chain = (m.fallbackChain || []).join(' → ');
    document.getElementById('m-fallback').textContent = chain || '—';
  });
}

// ── API Keys tab ───────────────────────────────────────────────────────────
function renderKeys() {
  chrome.runtime.sendMessage({ type: 'GET_CONFIGURED_PROVIDERS' }, (configured) => {
    if (!configured) return;
    ['openai', 'anthropic', 'together'].forEach(p => {
      const el = document.getElementById('status-' + p);
      if (el) {
        el.textContent = configured[p] ? '✅ set' : '⬜ not set';
        el.style.color = configured[p] ? '#1D9E75' : '#888';
      }
    });
  });
}

document.querySelectorAll('.key-save-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const provider = btn.dataset.provider;
    const input = document.getElementById('input-' + provider);
    const key = input?.value?.trim();
    if (!key) return;

    chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', provider, key }, (res) => {
      const statusEl = document.getElementById('key-save-status');
      if (res?.ok) {
        statusEl.textContent = `✅ ${provider} key saved!`;
        statusEl.style.color = '#1D9E75';
        input.value = '';
        renderKeys();
      } else {
        statusEl.textContent = `❌ Failed to save key`;
        statusEl.style.color = '#D85A30';
      }
      setTimeout(() => { statusEl.textContent = ''; }, 3000);
    });
  });
});
