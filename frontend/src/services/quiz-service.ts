import { VocabWord } from "@/src/models/vocab";

import { shuffle } from "./vocabulary-service";

export type QuizQuestion = {
  word: VocabWord;
  options: string[];
  correctAnswer: string;
};

// Builds `count` questions from a fresh random sample of `words`. Each
// question's 3 wrong options are re-randomized independently, so retaking a
// quiz (or a later question with the same word) never shows the same set of
// distractors twice.
export function generateQuestions(
  words: VocabWord[],
  count: number,
): QuizQuestion[] {
  const sampleSize = Math.max(0, Math.min(count, words.length));
  const chosen = shuffle(words).slice(0, sampleSize);

  return chosen.map((word) => {
    // Some words share the same German translation (e.g. "she"/"they" -> "sie").
    // Track used strings so all 4 options are always distinct.
    const usedGerman = new Set([word.german]);
    const distractors = pickDistractors(words, word, usedGerman);
    const options = shuffle([word.german, ...distractors]);
    return { word, options, correctAnswer: word.german };
  });
}

// Picks up to 3 distractors by random index with rejection, instead of
// shuffling (and copying) the entire word pool per question. Bounded attempt
// count avoids spinning forever on a degenerate pool with few distinct
// German translations.
function pickDistractors(
  words: VocabWord[],
  word: VocabWord,
  usedGerman: Set<string>,
): string[] {
  const distractors: string[] = [];
  const n = words.length;
  if (n === 0) return distractors;
  const maxAttempts = n * 4;
  for (let attempts = 0; distractors.length < 3 && attempts < maxAttempts; attempts++) {
    const candidate = words[Math.floor(Math.random() * n)];
    if (candidate.id === word.id) continue;
    if (usedGerman.has(candidate.german)) continue;
    usedGerman.add(candidate.german);
    distractors.push(candidate.german);
  }
  return distractors;
}
