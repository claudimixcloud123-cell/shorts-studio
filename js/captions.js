// Regroupe une liste de mots timés { word, start, end } en petits paquets
// de 2-4 mots, pour un rendu "sous-titres animés" façon Reels/Shorts,
// plutôt qu'un mot isolé illisible ou une phrase entière statique.

export function groupWordsIntoCaptions(words, maxWordsPerGroup = 3) {
  const groups = [];
  let current = [];

  for (const w of words) {
    current.push(w);
    const endsWithPunctuation = /[.!?,;:]$/.test(w.word);
    if (current.length >= maxWordsPerGroup || endsWithPunctuation) {
      groups.push(makeGroup(current));
      current = [];
    }
  }
  if (current.length) groups.push(makeGroup(current));

  return groups;
}

function makeGroup(wordList) {
  return {
    text: wordList.map((w) => w.word).join(' '),
    start: wordList[0].start,
    end: wordList[wordList.length - 1].end,
  };
}

// Si aucune donnée de timing mot-par-mot n'est disponible (fallback Web Speech API),
// on répartit le texte de la scène uniformément sur la durée estimée de la scène.
export function estimateCaptionsForScene(sceneText, durationSeconds, maxWordsPerGroup = 3) {
  const words = sceneText.split(/\s+/).filter(Boolean);
  const perWord = durationSeconds / Math.max(words.length, 1);
  const timedWords = words.map((word, i) => ({
    word,
    start: i * perWord,
    end: (i + 1) * perWord,
  }));
  return groupWordsIntoCaptions(timedWords, maxWordsPerGroup);
}
