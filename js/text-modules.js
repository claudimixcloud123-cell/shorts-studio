import { getKeys, hasRequiredKeys } from './config.js';

// ---------- Navigation par onglets ----------
const tabBtns = document.querySelectorAll('.tab-btn');
const tabVideo = document.getElementById('tab-video');
const tabText = document.getElementById('tab-text');

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const isText = btn.dataset.tab === 'text';
    tabVideo.hidden = isText;
    tabText.hidden = !isText;
  });
});

// ---------- Définition des 7 modules (repris de ton app "Shorts Studio" d'origine) ----------
// {s} = langue, {i} = idée/sujet, {x} = niche (pour la voix-off)
function buildModules({ idea, niche, ton, duration, lang }) {
  const s = lang;
  const i = idea;
  const x = niche;

  return [
    {
      id: 'concept',
      title: 'Concept',
      system: `Tu es un expert en stratégie de contenu YouTube Shorts viral. Réponds uniquement en ${s}.`,
      user: `${i}\n\nGénère un concept viral avec:\n1. **Hook d'ouverture** (3 premières secondes)\n2. **Angle unique** (pourquoi ça va exploser)\n3. **Promesse de valeur**\n4. **Idée de fin / CTA**\n5. **Titre principal** + 3 alternatives A/B testables\n\nTon souhaité : ${ton}. Durée cible : ${duration}s.`,
    },
    {
      id: 'script',
      title: 'Script',
      system: `Tu es un scénariste expert YouTube Shorts. Réponds uniquement en ${s}.`,
      user: `${i}\n\nScript complet:\n- Format: [TIMING] | [VISUELS] | [TEXTE ÉCRAN] | [PAROLES]\n- Hook dans les 3 premières secondes\n- Structure narrative tendue\n- CTA final percutant\n\nDurée cible : ${duration}s.`,
    },
    {
      id: 'prompt_video',
      title: 'Prompts vidéo IA',
      system: `Tu es un expert en prompts vidéo IA (Runway, Kling, Sora). Réponds en ${s}, termes techniques en anglais.`,
      user: `${i}\n\n3 prompts vidéo IA professionnels:\n\n**PROMPT 1 - Cinématique:** caméra, mouvement, éclairage\n**PROMPT 2 - Dynamique/Action:** énergie, rythme, effets\n**PROMPT 3 - Minimaliste:** fond épuré, focus sujet\n\nInclure: camera motion, lighting, color palette, mood, 4K, 9:16`,
    },
    {
      id: 'prompt_image',
      title: 'Prompts image IA',
      system: `Tu es un expert en prompts images IA (Midjourney, DALL-E, Stable Diffusion). Réponds en ${s}, termes techniques en anglais.`,
      user: `${i}\n\n4 prompts images:\n\n**THUMBNAIL:** miniature accrocheuse 16:9\n**INTRO (0-3s):** accroche visuelle\n**MILIEU:** visuel central\n**FIN/CTA:** appel à l'action\n\nChaque prompt: style, lighting, composition, mood, negative prompts`,
    },
    {
      id: 'voiceover',
      title: 'Voix-off',
      system: `Tu es un expert en copywriting vocal. Réponds uniquement en ${s}.`,
      user: `${i}\n\nVoix-off professionnelle:\n\n**TEXTE PRINCIPAL:** (adapté à ${x})\n**GUIDE LIVRAISON:** ton, pauses, emphase, émotion\n**PARAMÈTRES ElevenLabs/TTS:** stabilité, clarté, style\n**2 ALTERNATIVES:** version dynamique / version posée`,
    },
    {
      id: 'hashtags',
      title: 'SEO & Hashtags',
      system: `Tu es un expert SEO YouTube. Réponds uniquement en ${s}.`,
      user: `${i}\n\n**TITRE OPTIMISÉ:** (60 car max)\n**DESCRIPTION COURTE:** (150 car)\n**HASHTAGS:**\n🔥 Viraux trending: 5 tags\n🎯 Niche spécifiques: 8 tags\n📈 Longue traîne: 5 tags\n**MOTS-CLÉS:** 10 mots-clés naturels\n**MEILLEURE HEURE DE PUBLICATION**\n**COMMENTAIRE ÉPINGLÉ:** (booste l'engagement)`,
    },
    {
      id: 'capcut',
      title: 'Guide montage CapCut',
      system: `Tu es un expert montage CapCut. Réponds uniquement en ${s}.`,
      user: `${i}\n\n**🎬 TIMELINE:** découpage seconde par seconde\n**✂️ TRANSITIONS:** liste + timing exact (nom CapCut)\n**🎵 MUSIQUE & SON:** type, BPM, effets sonores, timing\n**✨ EFFETS VISUELS:** filtres, animations, LUT couleur\n**📝 TEXTES:** position, timing, animation, polices, couleurs\n**🚀 EXPORT:** résolution, FPS, format optimaux YouTube Shorts`,
    },
  ];
}

// ---------- Appel de la fonction Netlify ----------
async function generateModule({ system, user }) {
  const { anthropic } = getKeys();
  const res = await fetch('/.netlify/functions/generate-module', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: anthropic, system, user }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(errText || `Erreur ${res.status}`);
  }
  const data = await res.json();
  return data.text;
}

// ---------- UI ----------
const formTextIdea = document.getElementById('form-text-idea');
const textInputIdea = document.getElementById('text-input-idea');
const textResultsSection = document.getElementById('text-results');
const textLog = document.getElementById('text-log');
const textModulesGrid = document.getElementById('text-modules-grid');
const btnExportWord = document.getElementById('btn-export-word');

let textDuration = 30;
let textLang = 'Français';
let lastResults = null;
let lastIdea = '';

document.querySelectorAll('#text-duration-select .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#text-duration-select .seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    textDuration = Number(btn.dataset.duration);
  });
});
document.querySelectorAll('#text-lang-select .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#text-lang-select .seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    textLang = btn.dataset.lang;
  });
});

formTextIdea.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!hasRequiredKeys()) {
    alert('Ajoute au moins ta clé Anthropic dans "Clés API" avant de générer.');
    document.getElementById('btn-settings').click();
    return;
  }

  const idea = textInputIdea.value.trim();
  if (!idea) return;
  lastIdea = idea;

  const niche = document.getElementById('text-niche').value.trim() || 'Général';
  const ton = document.getElementById('text-ton').value.trim() || 'Viral & Accroché';

  const modules = buildModules({ idea, niche, ton, duration: textDuration, lang: textLang });

  textResultsSection.hidden = false;
  textLog.innerHTML = '';
  textModulesGrid.innerHTML = '';
  btnExportWord.disabled = true;
  lastResults = {};

  // Crée les cartes vides tout de suite pour un retour visuel immédiat.
  const bodies = {};
  for (const mod of modules) {
    const card = document.createElement('div');
    card.className = 'module-card';
    card.innerHTML = `
      <div class="module-card-header">
        <h3>${mod.title}</h3>
        <button type="button" class="btn-copy" data-mod="${mod.id}">Copier</button>
      </div>
      <div class="module-card-body loading" id="mod-body-${mod.id}">Génération en cours...</div>
    `;
    textModulesGrid.appendChild(card);
    bodies[mod.id] = card.querySelector(`#mod-body-${mod.id}`);
  }

  for (const mod of modules) {
    logLineText(`Génération : ${mod.title}...`);
    try {
      const text = await generateModule({ system: mod.system, user: mod.user });
      lastResults[mod.id] = { title: mod.title, text };
      bodies[mod.id].textContent = text;
      bodies[mod.id].classList.remove('loading');
    } catch (err) {
      bodies[mod.id].textContent = `Erreur : ${err.message}`;
      bodies[mod.id].classList.remove('loading');
      logLineText(`❌ ${mod.title} : ${err.message}`);
    }
  }

  logLineText('✅ Pipeline texte terminé.');
  btnExportWord.disabled = false;
});

// Copie individuelle de chaque module.
textModulesGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-copy');
  if (!btn) return;
  const modId = btn.dataset.mod;
  const body = document.getElementById(`mod-body-${modId}`);
  navigator.clipboard.writeText(body.textContent);
  const original = btn.textContent;
  btn.textContent = 'Copié !';
  setTimeout(() => (btn.textContent = original), 1500);
});

function logLineText(msg) {
  const time = new Date().toLocaleTimeString('fr-FR', { hour12: false });
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<span class="log-time">${time}</span><span>${msg}</span>`;
  textLog.appendChild(line);
}

// ---------- Export Word ----------
btnExportWord.addEventListener('click', async () => {
  if (!lastResults || !window.docx) {
    alert('La librairie Word (docx) n\'a pas fini de charger, réessaie dans un instant.');
    return;
  }

  const { Document, Packer, Paragraph, HeadingLevel } = window.docx;
  const children = [
    new Paragraph({ text: lastIdea || 'Shorts Studio — Export', heading: HeadingLevel.TITLE }),
  ];

  for (const key of Object.keys(lastResults)) {
    const mod = lastResults[key];
    children.push(new Paragraph({ text: mod.title, heading: HeadingLevel.HEADING_1 }));
    for (const line of mod.text.split('\n')) {
      children.push(new Paragraph({ text: line }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(lastIdea || 'shorts-studio').slice(0, 40)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
});
