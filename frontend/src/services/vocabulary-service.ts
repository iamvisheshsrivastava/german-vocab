import vocabData from "@/src/data/vocabulary.json";
import { ALL_CATEGORY, VocabWord } from "@/src/models/vocab";

// Load all vocabulary from bundled JSON. Replace src/data/vocabulary.json to
// grow to 1000+ words — no code changes required as long as the shape matches.
export function loadVocabulary(): VocabWord[] {
  return vocabData as VocabWord[];
}

export function getCategories(words: VocabWord[]): string[] {
  const unique = Array.from(new Set(words.map((w) => w.category))).sort();
  return [ALL_CATEGORY, ...unique];
}

// Fisher-Yates shuffle (non-mutating).
function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// If "All" is selected -> shuffle all words together.
// Otherwise filter by category (stable order by id).
export function selectWords(
  words: VocabWord[],
  category: string,
): VocabWord[] {
  if (category === ALL_CATEGORY) {
    return shuffle(words);
  }
  return words
    .filter((w) => w.category === category)
    .sort((a, b) => a.id - b.id);
}
