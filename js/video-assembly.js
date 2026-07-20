// Assemblage vidéo 100% côté navigateur avec ffmpeg.wasm : pas de serveur de rendu,
// pas de coûts de calcul côté back. Convient bien à un déploiement statique Netlify.

import { FFmpeg } from 'https://esm.sh/@ffmpeg/ffmpeg@0.12.10';
import { toBlobURL, fetchFile } from 'https://esm.sh/@ffmpeg/util@0.12.1';

const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
const FONT_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/oswald/Oswald%5Bwght%5D.ttf';

let ffmpegInstance = null;

async function getFFmpeg(onLog) {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  if (onLog) {
    ffmpeg.on('log', ({ message }) => onLog(message));
  }

  await ffmpeg.load({
    coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  // Police pour les sous-titres incrustés (drawtext a besoin d'un fichier de police
  // présent dans le système de fichiers virtuel de ffmpeg.wasm).
  ffmpeg.writeFile('font.ttf', await fetchFile(FONT_URL));

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

const DIMENSIONS = {
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
};

/**
 * Assemble la vidéo finale.
 * @param {Object} params
 * @param {Array<{imageBlob: Blob, duration: number}>} params.scenes - images + durée (s) de chaque scène
 * @param {Blob} params.audioBlob - narration complète (mp3)
 * @param {Array<{text: string, start: number, end: number}>} params.captionGroups - sous-titres timés sur la vidéo entière
 * @param {'9:16'|'16:9'} params.aspect
 * @param {(msg: string) => void} params.onProgress
 * @returns {Promise<Blob>} le fichier mp4 final
 */
export async function assembleVideo({ scenes, audioBlob, captionGroups, aspect, onProgress }) {
  const log = (m) => onProgress && onProgress(m);
  const ffmpeg = await getFFmpeg();
  const { w, h } = DIMENSIONS[aspect] || DIMENSIONS['9:16'];

  // 1. Écrit les images et génère un clip Ken Burns (zoom lent) par scène.
  const clipNames = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const imgName = `scene_${i}.png`;
    const clipName = `clip_${i}.mp4`;
    await ffmpeg.writeFile(imgName, await fetchFile(scene.imageBlob));

    const frames = Math.max(1, Math.round(scene.duration * 25));
    // zoompan : léger zoom avant progressif sur la durée de la scène (effet Ken Burns)
    const zoomFilter =
      `scale=${w * 1.15}:${h * 1.15},` +
      `zoompan=z='min(zoom+0.0015,1.15)':d=${frames}:s=${w}x${h}:fps=25`;

    log(`Rendu de la scène ${i + 1}/${scenes.length}...`);
    await ffmpeg.exec([
      '-loop', '1',
      '-i', imgName,
      '-vf', zoomFilter,
      '-t', String(scene.duration),
      '-pix_fmt', 'yuv420p',
      '-r', '25',
      clipName,
    ]);
    clipNames.push(clipName);
  }

  // 2. Concatène les clips (liste de concat).
  const concatList = clipNames.map((n) => `file '${n}'`).join('\n');
  await ffmpeg.writeFile('concat.txt', concatList);
  log('Assemblage des scènes...');
  await ffmpeg.exec([
    '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
    '-c', 'copy', 'silent_video.mp4',
  ]);

  // 3. Écrit l'audio de narration.
  await ffmpeg.writeFile('narration.mp3', await fetchFile(audioBlob));

  // 4. Construit la chaîne de filtres drawtext pour les sous-titres animés,
  // et mixe la vidéo + l'audio en une seule passe finale.
  const drawtextFilters = captionGroups.map((g) => buildDrawtextFilter(g, h)).join(',');
  const videoFilter = drawtextFilters ? `[0:v]${drawtextFilters}[v]` : null;

  log('Incrustation des sous-titres et export final...');
  const args = ['-i', 'silent_video.mp4', '-i', 'narration.mp3'];
  if (videoFilter) {
    args.push('-filter_complex', videoFilter, '-map', '[v]', '-map', '1:a');
  } else {
    args.push('-map', '0:v', '-map', '1:a');
  }
  args.push(
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest',
    'output.mp4'
  );
  await ffmpeg.exec(args);

  const data = await ffmpeg.readFile('output.mp4');
  return new Blob([data.buffer], { type: 'video/mp4' });
}

// Échappe le texte pour l'utiliser dans un filtre drawtext ffmpeg.
function escapeDrawtext(text) {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, '')
    .replace(/%/g, '\\%');
}

function buildDrawtextFilter(group, videoHeight) {
  const text = escapeDrawtext(group.text.toUpperCase());
  const yPos = Math.round(videoHeight * 0.72); // bas-centre, style Reels
  return (
    `drawtext=fontfile=font.ttf:text='${text}':` +
    `fontsize=54:fontcolor=white:borderw=3:bordercolor=black:` +
    `box=1:boxcolor=black@0.35:boxborderw=14:` +
    `x=(w-text_w)/2:y=${yPos}:` +
    `enable='between(t,${group.start.toFixed(2)},${group.end.toFixed(2)})'`
  );
}
