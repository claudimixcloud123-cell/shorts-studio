// Proxy Netlify -> Anthropic Messages API.
// Reçoit la clé API du client (bring-your-own-key), ne la stocke jamais,
// évite juste le blocage CORS d'un appel direct navigateur -> api.anthropic.com.

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

  const { apiKey, idea, format, duration, lang } = body;
  if (!apiKey || !idea) {
    return { statusCode: 400, body: 'Paramètres manquants (apiKey, idea)' };
  }

  const nScenes = Math.max(3, Math.min(8, Math.round(Number(duration || 35) / 6)));
  const langLabel = lang === 'en' ? 'English' : 'français';

  const systemPrompt = `Tu es scénariste pour des vidéos courtes verticales (Reels/Shorts). Tu réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans balises markdown.`;

  const userPrompt = `Sujet : "${idea}"
Langue de sortie : ${langLabel}
Durée cible totale : environ ${duration || 35} secondes
Nombre de scènes : ${nScenes}
Format vidéo : ${format || '9:16'}

Écris un script accrocheur découpé en ${nScenes} scènes pour une vidéo courte. Pour chaque scène fournis :
- "text" : le texte de narration (voix off), phrase courte et percutante, rythme rapide, adapté à l'oral
- "imagePrompt" : une description visuelle détaillée en anglais pour un générateur d'image (style cinématographique, cohérent avec les autres scènes, sans texte incrusté)
- "durationHint" : durée approximative en secondes de cette scène (nombre)

La première scène doit accrocher immédiatement (hook). La dernière doit conclure ou inciter à l'action.

Réponds avec ce format JSON exact :
{
  "title": "titre court de la vidéo",
  "scenes": [
    { "text": "...", "imagePrompt": "...", "durationHint": 5 }
  ]
}`;

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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
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
    if (!textBlock) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Réponse Claude vide' }) };
    }

    const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Le script généré n\'est pas un JSON valide', raw: cleaned }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(parsed),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
