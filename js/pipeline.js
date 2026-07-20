import { getKeys, saveKeys, hasRequiredKeys, hasElevenLabs } from './config.js';
import { generateScript, generateImage, generateSpeech } from './api.js';
import { groupWordsIntoCaptions, estimateCaptionsForScene } from './captions.js';
import { assembleVideo } from './video-assembly.js';

// ---------- Références DOM ----------
const viewInput = document.getElementById('view-input');
const viewPipeline = document.getElementById('view-pipeline');
const viewResult = document.getElementById('view-result');
const formIdea = document.getElementById('form-idea');
const inputIdea = document.getElementById('input-idea');
const logEl = document.getElementById('pipeline-log');
const scenesPreviewEl = document.getElementById('scenes-preview');
const resultPlayersEl = document.getElementById('result-players');
const btnRestart = document.getElementById('btn-restart');

const modalSettings = document.getElementById('modal-settings');
const btnSettings = document.getElementById('btn-settings');
const btnSaveKeys = document.getElementById('btn-save-keys');

// ---------- État des options de formulaire ----------
let selectedFormat = '9:16';
let selectedDuration = 35;
let selectedLang = 'fr';

document.querySelectorAll('#format-select .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#format-select .seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedFormat = btn.dataset.format;
  });
});
document.querySelectorAll('#duration-select .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#duration-select .seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedDuration = Number(btn.dataset.duration);
  });
});
document.querySelectorAll('#lang-select .seg-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#lang-select .seg-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    selectedLang = btn.dataset.lang;
  });
});

// ---------- Réglages / clés API ----------
btnSettings.addEventListener('click', () => {
  const keys = getKeys();
  document.getElementById('key-anthropic').value = keys.anthropic || '';
  document.getElementById('key-gemini').value = keys.gemini || '';
  document.getElementById('key-elevenlabs').value = keys.elevenlabs || '';
  modalSettings.showModal();
});

btnSaveKeys.addEventListener('click', () => {
  saveKeys({
    anthropic: document.getElementById('key-anthropic').value.trim(),
    gemini: document.getElementById('key-gemini').value.trim(),
    elevenlabs: document.getElementById('key-elevenlabs').value.trim(),
  });
  modalSettings.close();
});

// ---------- Log & étapes visuelles ----------
function logLine(msg) {
  const time = new Date().toLocaleTimeString('fr-FR', { hour12: false });
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `<span class="log-time">${time}</span><span>${msg}</span>`;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStepStatus(step, status) {
  const el = document.querySelector(`.reel-step[data-step="${step}"]`);
  if (!el) return;
  el.classList.remove('active', 'done', 'error');
  const statusEl = el.querySelector('.step-status');
  if (status === 'active') {
    el.classList.add('active');
    statusEl.textContent = 'en cours';
  } else if (status === 'done') {
    el.classList.add('done');
    statusEl.textContent = 'terminé';
  } else if (status === 'error') {
    el.classList.add('error');
    statusEl.textContent = 'erreur';
  } else {
    statusEl.textContent = 'en attente';
  }
}

function base64ToBlob(base64, mimeType) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

// ---------- Soumission du formulaire ----------
formIdea.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!hasRequiredKeys()) {
    alert('Ajoute au moins tes clés Anthropic et Gemini dans "Clés API" avant de lancer une production.');
    btnSettings.click();
    return;
  }

  const idea = inputIdea.value.trim();
  if (!idea) return;

  viewInput.hidden = true;
  viewPipeline.hidden = false;
  viewResult.hidden = true;
  logEl.innerHTML = '';
  scenesPreviewEl.innerHTML = '';
  ['script', 'images', 'voice', 'captions', 'render'].forEach((s) => setStepStatus(s, 'idle'));

  try {
    await runPipeline({ idea, format: selectedFormat, duration: selectedDuration, lang: selectedLang });
  } catch (err) {
    console.error(err);
    logLine(`❌ ${err.message}`);
  }
});

btnRestart.addEventListener('click', () => {
  viewResult.hidden = true;
  viewInput.hidden = false;
  inputIdea.value = '';
});

// ---------- Pipeline complet ----------
async function runPipeline({ idea, format, duration, lang }) {
  // 1. SCRIPT
  setStepStatus('script', 'active');
  logLine(`Génération du script pour "${idea}"...`);
  const script = await generateScript({ idea, format, duration, lang });
  logLine(`Script "${script.title}" généré — ${script.scenes.length} scènes.`);
  setStepStatus('script', 'done');

  // 2. IMAGES
  setStepStatus('images', 'active');
  const aspectsNeeded = format === 'both' ? ['9:16', '16:9'] : [format];
  const sceneImages = {}; // { '9:16': [blob,...], '16:9': [blob,...] }

  for (const aspect of aspectsNeeded) {
    sceneImages[aspect] = [];
    for (let i = 0; i < script.scenes.length; i++) {
      const scene = script.scenes[i];
      logLine(`Image scène ${i + 1}/${script.scenes.length} (${aspect})...`);
      const img = await generateImage({ prompt: scene.imagePrompt, aspect });
      const blob = base64ToBlob(img.imageBase64, img.mimeType);
      sceneImages[aspect].push(blob);

      if (aspect === aspectsNeeded[0]) {
        const card = document.createElement('div');
        card.className = 'scene-card';
        const imgEl = document.createElement('img');
        imgEl.src = URL.createObjectURL(blob);
        card.appendChild(imgEl);
        const idx = document.createElement('span');
        idx.className = 'scene-idx';
        idx.textContent = `#${i + 1}`;
        card.appendChild(idx);
        scenesPreviewEl.appendChild(card);
      }
    }
  }
  logLine('Toutes les images sont générées.');
  setStepStatus('images', 'done');

  // 3. VOIX OFF
  setStepStatus('voice', 'active');
  const fullText = script.scenes.map((s) => s.text).join(' ');
  let audioBlob = null;
  let words = null;

  if (hasElevenLabs()) {
    logLine('Génération de la voix off (ElevenLabs)...');
    const speech = await generateSpeech({ text: fullText, lang });
    audioBlob = base64ToBlob(speech.audioBase64, speech.mimeType);
    words = speech.words;
    logLine('Voix off générée avec timing mot-par-mot.');
  } else {
    logLine('Pas de clé ElevenLabs : la vidéo sera produite sans narration audio (sous-titres estimés uniquement).');
  }
  setStepStatus('voice', 'done');

  // 4. SOUS-TITRES
  setStepStatus('captions', 'active');
  let captionGroups;
  if (words && words.length) {
    captionGroups = groupWordsIntoCaptions(words, 3);
  } else {
    // Fallback : répartit le texte de chaque scène sur sa durée estimée, scène après scène.
    captionGroups = [];
    let cursor = 0;
    for (const scene of script.scenes) {
      const dur = scene.durationHint || duration / script.scenes.length;
      const groups = estimateCaptionsForScene(scene.text, dur, 3).map((g) => ({
        text: g.text,
        start: g.start + cursor,
        end: g.end + cursor,
      }));
      captionGroups.push(...groups);
      cursor += dur;
    }
  }
  logLine(`${captionGroups.length} groupes de sous-titres calculés.`);
  setStepStatus('captions', 'done');

  // 5. RENDU FINAL
  setStepStatus('render', 'active');
  const results = [];

  for (const aspect of aspectsNeeded) {
    logLine(`Assemblage de la vidéo finale (${aspect})... (peut prendre 1-2 min)`);
    const scenesForAssembly = script.scenes.map((scene, i) => ({
      imageBlob: sceneImages[aspect][i],
      duration: scene.durationHint || duration / script.scenes.length,
    }));

    // Si pas d'audio réel, on génère un silence de la durée totale pour que le mux fonctionne.
    const totalDuration = scenesForAssembly.reduce((sum, s) => sum + s.duration, 0);
    const finalAudioBlob = audioBlob || (await makeSilentAudio(totalDuration));

    const videoBlob = await assembleVideo({
      scenes: scenesForAssembly,
      audioBlob: finalAudioBlob,
      captionGroups,
      aspect,
      onProgress: (msg) => logLine(msg),
    });

    results.push({ aspect, blob: videoBlob });
    logLine(`✅ Vidéo ${aspect} prête.`);
  }

  setStepStatus('render', 'done');
  showResult(script.title, results);
}

// Génère un fichier audio silencieux (pour permettre le rendu même sans narration réelle).
async function makeSilentAudio(durationSeconds) {
  const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
    1,
    Math.ceil(44100 * durationSeconds),
    44100
  );
  const buffer = ctx.createBuffer(1, Math.ceil(44100 * durationSeconds), 44100);
  const rendered = await ctx.startRendering().catch(() => buffer);
  return bufferToWavBlob(rendered);
}

function bufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length * numChannels * 2 + 44;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new DataView(arrayBuffer);
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + buffer.length * numChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, buffer.length * numChannels * 2, true);
  let offset = 44;
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    view.setInt16(offset, data[i] * 0x7fff, true);
    offset += 2;
  }
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// ---------- Affichage résultat ----------
function showResult(title, results) {
  viewPipeline.hidden = true;
  viewResult.hidden = false;
  document.getElementById('result-title').textContent = title || 'Ta vidéo est prête';
  resultPlayersEl.innerHTML = '';

  for (const { aspect, blob } of results) {
    const url = URL.createObjectURL(blob);
    const block = document.createElement('div');
    block.className = 'player-block';

    const label = document.createElement('div');
    label.className = 'player-label';
    label.textContent = aspect === '9:16' ? 'FORMAT 9:16 · SHORTS/REELS' : 'FORMAT 16:9 · YOUTUBE';
    block.appendChild(label);

    const video = document.createElement('video');
    video.src = url;
    video.controls = true;
    video.style.width = aspect === '9:16' ? '260px' : '400px';
    block.appendChild(video);

    const link = document.createElement('a');
    link.className = 'download';
    link.href = url;
    link.download = `video-${aspect.replace(':', 'x')}.mp4`;
    link.textContent = 'Télécharger le MP4';
    block.appendChild(link);

    resultPlayersEl.appendChild(block);
  }
}
