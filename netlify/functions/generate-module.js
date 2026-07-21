// Proxy Netlify -> Anthropic, générique pour les modules "texte libre"
// (concept, script, prompts image/vidéo, voix-off, SEO, guide CapCut).
// Contrairement à generate-script.js, celui-ci ne force pas de format JSON :
// il renvoie le texte tel quel, exactement comme les modules de ton app d'origine.

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

  const { apiKey, system, user } = body;
  if (!apiKey || !user) {
    return { statusCode: 400, body: 'Paramètres manquants (apiKey, user)' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: system || 'Tu es un assistant expert en création de contenu vidéo courte.',
        messages: [{ role: 'user', content: user }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || 'Erreur API Anthropic' }),
      };
    }

    const textBlock = data.content?.find((c) => c.type === 'text');
    return {
      statusCode: 200,
      body: JSON.stringify({ text: textBlock ? textBlock.text : '' }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
