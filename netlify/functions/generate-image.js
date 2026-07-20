// Proxy Netlify -> Gemini (image generation).
//
// ⚠️ IMPORTANT : le nom du modèle d'image Gemini évolue régulièrement.
// Comme ton CJC actuel appelle déjà Gemini avec succès pour les images,
// remplace GEMINI_IMAGE_MODEL ci-dessous par le modèle que tu utilises
// déjà là-bas (copie/colle-le depuis ton implémentation existante) si
// celui-ci diffère ou renvoie une erreur 404.
const GEMINI_IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';

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

  const { apiKey, prompt, aspect } = body;
  if (!apiKey || !prompt) {
    return { statusCode: 400, body: 'Paramètres manquants (apiKey, prompt)' };
  }

  const aspectHint = aspect === '16:9'
    ? 'wide 16:9 cinematic landscape composition'
    : 'vertical 9:16 mobile phone composition, portrait orientation';

  const fullPrompt = `${prompt}. ${aspectHint}. Photorealistic, cinematic lighting, high detail, no text, no watermark, no logo.`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || 'Erreur API Gemini' }),
      };
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData);

    if (!imagePart) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Gemini n\'a renvoyé aucune image' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        imageBase64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || 'image/png',
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
