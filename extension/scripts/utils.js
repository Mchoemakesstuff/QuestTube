/**
 * QuestTube - Shared Utilities
 * Extension URL helpers for resolving asset paths in content scripts
 */

function extractExtensionBaseUrl(value) {
  if (!value) return '';
  const match = String(value).match(/(chrome-extension|moz-extension):\/\/([a-zA-Z0-9_-]+)\//);
  if (!match) return '';
  return `${match[1]}://${match[2]}/`;
}

const EXTENSION_BASE_URL = (() => {
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      return `chrome-extension://${chrome.runtime.id}/`;
    }
  } catch (error) {
    console.warn('QuestTube: Failed to read chrome runtime id', error);
  }

  try {
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.id) {
      return `moz-extension://${browser.runtime.id}/`;
    }
  } catch (error) {
    console.warn('QuestTube: Failed to read browser runtime id', error);
  }

  try {
    const fromCurrentScript = extractExtensionBaseUrl(document?.currentScript?.src);
    if (fromCurrentScript) {
      return fromCurrentScript;
    }
  } catch (error) {
    console.warn('QuestTube: Failed to read current script URL', error);
  }

  try {
    const fromStack = extractExtensionBaseUrl(new Error().stack || '');
    if (fromStack) {
      return fromStack;
    }
  } catch (error) {
    console.warn('QuestTube: Failed to read stack URL', error);
  }

  return '';
})();

function getAssetUrl(path) {
  const normalized = String(path || '').replace(/^\/+/, '');
  return EXTENSION_BASE_URL ? `${EXTENSION_BASE_URL}${normalized}` : normalized;
}
