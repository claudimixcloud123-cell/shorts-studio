// Proxy Netlify -> ElevenLabs (text-to-speech avec alignement caractère-par-caractère,
// qu'on regroupe ensuite en mots pour piloter les sous-titres animés).

// Voix multilingue par défaut. Change VOICE_ID pour une voix FR de ta bibliothèque
// ElevenLabs si tu en as une préférée (Voice Library -> "Copy Voice ID").
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // "Rachel", multilingue
const MODEL_ID = 'eleven_multilingual_v2';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: 'JSON invalide' };
  }

  const { apiKey, text, voiceId } = body;
  if (!apiKey || !text) {
    return { statusCode: 400, body: 'Paramètres manquants (apiKey, text)' };
  }

  const voice = voiceId || DEFAULT_VOICE_ID;

  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.45, similarity_boost: 0.8 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { statusCode: response.status, body: JSON.stringify({ error: errText || 'Erreur API ElevenLabs' }) };
    }

    const data = await response.json();
    const { audio_base64: audioBase64, alignment } = data;

    if (!audioBase64 || !alignment) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Réponse ElevenLabs incomplète' }) };
    }

    const words = charsToWords(
      alignment.characters,
      alignment.character_start_times_seconds,
      alignment.character_end_times_seconds
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        audioBase64,
        mimeType: 'audio/mpeg',
        words,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}

// Regroupe l'alignement caractère-par-caractère d'ElevenLabs en mots avec
// leur temps de début/fin, pour piloter des sous-titres animés mot par mot.
function charsToWords(characters, startTimes, endTimes) {
  const words = [];
  let current = '';
  let wordStart = null;

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i];
    if (ch.trim() === '') {
      if (current) {
        words.push({ word: current, start: wordStart, end: endTimes[i - 1] });
        current = '';
        wordStart = null;
      }
      continue;
    }
    if (wordStart === null) wordStart = startTimes[i];
    current += ch;
  }
  if (current) {
    words.push({ word: current, start: wordStart, end: endTimes[endTimes.length - 1] });
  }
  return words;
}
