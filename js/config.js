// Gestion simple des clés API en localStorage. Rien ne part ailleurs que
// vers les fonctions Netlify du pipeline, qui les transmettent aux APIs tierces.

const STORAGE_KEY = 'cjc-studio-keys';

export function getKeys() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveKeys(keys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function hasRequiredKeys() {
  const k = getKeys();
  return Boolean(k.anthropic && k.gemini);
}

export function hasElevenLabs() {
  const k = getKeys();
  return Boolean(k.elevenlabs);
}
