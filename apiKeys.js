// apiKeys.js — API key management

const API_KEYS = (() => {
  const STORAGE_KEY = 'ecoroute_api_keys';

  async function save(provider, key) {
    const keys = await getAll();
    keys[provider] = key;
    await chrome.storage.local.set({ [STORAGE_KEY]: keys });
  }

  async function get(provider) {
    const keys = await getAll();
    return keys[provider] || null;
  }

  async function getAll() {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    return result[STORAGE_KEY] || {};
  }

  async function remove(provider) {
    const keys = await getAll();
    delete keys[provider];
    await chrome.storage.local.set({ [STORAGE_KEY]: keys });
  }

  async function getConfiguredProviders() {
    const keys = await getAll();
    return Object.keys(keys).filter(k => keys[k]);
  }

  return { save, get, getAll, remove, getConfiguredProviders };
})();