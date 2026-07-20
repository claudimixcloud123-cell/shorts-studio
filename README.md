# CJC Studio

Génère une vidéo Reels/Shorts complète (script, images, voix off, sous-titres animés, export MP4) à partir d'une simple idée, directement dans le navigateur.

## Pipeline

1. **Script** — Claude (Anthropic) découpe l'idée en scènes (texte de narration + prompt image par scène).
2. **Images** — Gemini génère une image par scène.
3. **Voix off** — ElevenLabs génère la narration avec un timing mot-par-mot précis (nécessite une clé ElevenLabs). Sans clé, la vidéo est produite sans narration (sous-titres estimés uniquement).
4. **Sous-titres** — regroupés par paquets de 2-3 mots façon Reels/TikTok, synchronisés sur la voix.
5. **Rendu MP4** — assemblage final **100% dans le navigateur** avec `ffmpeg.wasm` (effet Ken Burns sur les images, sous-titres incrustés, mux audio). Aucun serveur de rendu vidéo à payer.

## Ce qui manque encore par rapport à ton CJC actuel

Cette version est un module autonome pensé pour être **fusionné avec ton projet CJC existant** (je n'avais pas ton code source). À vérifier/adapter :

- Le nom du modèle Gemini d'image dans `netlify/functions/generate-image.js` (`GEMINI_IMAGE_MODEL`) — remplace-le par celui que ton CJC actuel utilise déjà avec succès.
- Le `voiceId` ElevenLabs par défaut dans `generate-speech.js` — remplace par une voix FR de ta bibliothèque si tu en as une.
- La génération de script suppose un prompt from scratch ; si ton CJC a déjà des prompts affinés (SEO, guide CapCut, etc.), il vaut mieux les reprendre tels quels plutôt que ceux fournis ici.
- Pas d'export Word / autres modules texte (concept, SEO, guide CapCut) — uniquement le pipeline vidéo. Si tu veux les regarder, dis-le-moi et je les ajoute.

## Déploiement sur Netlify (comme d'habitude)

1. Pousse ce dossier sur un repo GitHub (ou dépose-le directement sur Netlify par glisser-déposer si tu préfères, mais dans ce cas les fonctions dans `netlify/functions` doivent quand même être détectées — privilégie GitHub + Netlify si possible).
2. Sur Netlify : **New site from Git** → sélectionne le repo.
3. Build command : laisse **vide** (pas de build, site statique).
4. Publish directory : `.`
5. Functions directory : `netlify/functions` (déjà configuré dans `netlify.toml`, Netlify le détecte automatiquement).
6. Déploie. Aucune variable d'environnement serveur n'est nécessaire : les clés API sont saisies par l'utilisateur dans l'app (bouton "Clés API", en haut à droite) et stockées uniquement dans son navigateur (`localStorage`), puis transmises aux fonctions à chaque appel.

## Test en local

Comme pour tes précédents projets, tu peux servir le dossier avec n'importe quel serveur statique, mais les fonctions Netlify (`/.netlify/functions/...`) ne fonctionneront qu'avec :

```
npm install -g netlify-cli
netlify dev
```

(lancé depuis le dossier du projet — pas besoin de `npm install` de dépendances, les fonctions n'utilisent que `fetch`, disponible nativement).

## Clés API nécessaires

- **Anthropic** : https://console.anthropic.com (clé commençant par `sk-ant-`)
- **Gemini** : https://aistudio.google.com/apikey
- **ElevenLabs** (optionnel mais recommandé pour la voix off) : https://elevenlabs.io — plan gratuit disponible avec quota limité.

## Limites connues

- Le rendu vidéo se fait dans l'onglet du navigateur : pour une vidéo de ~35-60s en 1080x1920, compte 1 à 3 minutes selon l'appareil. Ne ferme pas l'onglet pendant le rendu.
- `ffmpeg.wasm` charge son cœur (~30 Mo) depuis un CDN au premier rendu — nécessite une connexion internet correcte, une seule fois par session.
- Format "Les deux" (9:16 + 16:9) génère deux jeux d'images séparés (un par format) pour un cadrage correct, donc le double d'appels Gemini.
