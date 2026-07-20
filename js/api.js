import { getKeys } from './config.js';

async function callFunction(name, payload) {
  const res = await fetch(`/.netlify/functions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`${name} a échoué (${res.status}) : ${errText || res.statusText}`);
  }
  return res.json();
}

/**
 * Génère le script découpé en scènes via Claude.
 * Retourne { title, scenes: [{ text, imagePrompt, durationHint }] }
 */
export async function generateScript({ idea, format, duration, lang }) {
  const { anthropic } = getKeys();
  if (!anthropic) throw new Error('Clé Anthropic manquante (ouvre "Clés API").');

  const data = await callFunction('generate-script', {
    apiKey: anthropic,
    idea,
    format,
    duration,
    lang,
  });
  return data;
}

/**
 * Génère une image pour une scène via Gemini.
 * Retourne { imageBase64, mimeType }
 */
export async function generateImage({ prompt, aspect }) {
  const { gemini } = getKeys();
  if (!gemini) throw new Error('Clé Gemini manquante (ouvre "Clés API").');

  const data = await callFunction('generate-image', {
    apiKey: gemini,
    prompt,
    aspect,
  });
  return data;
}

/**
 * Génère la voix off. Si une clé ElevenLabs est fournie, retourne
 * { audioBase64, mimeType, words: [{ word, start, end }] } avec timing mot-par-mot.
 * Sinon, retourne null pour indiquer un fallback Web Speech API côté client.
 */
export async function generateSpeech({ text, lang }) {
  const { elevenlabs } = getKeys();
  if (!elevenlabs) return null;

  const data = await callFunction('generate-speech', {
    apiKey: elevenlabs,
    text,
    lang,
  });
  return data;
}
