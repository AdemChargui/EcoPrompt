// energy.js — Energy calculation utilities

window.ENERGY = (() => {
  const TIERS = {
    low: { label: 'Low', color: '#1D9E75', colorBg: '#1D9E7522', colorText: '#1D9E75', whPerToken: 0.000001 },
    medium: { label: 'Mid', color: '#378ADD', colorBg: '#378ADD22', colorText: '#378ADD', whPerToken: 0.000005 },
    high: { label: 'High', color: '#D85A30', colorBg: '#D85A3022', colorText: '#D85A30', whPerToken: 0.00003 },
  };

  const PLATFORM_DEFAULTS = {
    'chatgpt.com': 'medium',
    'chat.openai.com': 'medium',
    'claude.ai': 'medium',
    'gemini.google.com': 'medium',
    'perplexity.ai': 'medium',
  };

  function getTierInfo(tier) {
    return TIERS[tier] || TIERS.medium;
  }

  function getDefaultTier(platform) {
    return PLATFORM_DEFAULTS[platform] || 'medium';
  }

  function calcEnergy(tier, tokens) {
    const info = TIERS[tier] || TIERS.medium;
    const wh = info.whPerToken * tokens;
    const co2 = wh * 0.4; // g CO2 per Wh
    return {
      wh,
      whDisplay: wh < 0.001 ? `${(wh * 1e6).toFixed(0)} µWh` : wh < 1 ? `${(wh * 1000).toFixed(1)} mWh` : `${wh.toFixed(3)} Wh`,
      co2,
      co2Display: co2 < 0.001 ? `${(co2 * 1e6).toFixed(1)} µg` : co2 < 1 ? `${(co2 * 1000).toFixed(2)} mg` : `${co2.toFixed(4)} g`,
    };
  }

  function calcSavings(defaultTier, actualTier) {
    const defInfo = TIERS[defaultTier] || TIERS.medium;
    const actInfo = TIERS[actualTier] || TIERS.medium;
    const savedWh = Math.max(0, defInfo.whPerToken * 250 - actInfo.whPerToken * 250);
    const savedCo2g = savedWh * 0.4;
    const pctSaved = defInfo.whPerToken > 0 ? Math.round((1 - actInfo.whPerToken / defInfo.whPerToken) * 100) : 0;
    return { savedWh, savedCo2g, pctSaved };
  }

  return { TIERS, PLATFORM_DEFAULTS, getTierInfo, getDefaultTier, calcEnergy, calcSavings };
})();