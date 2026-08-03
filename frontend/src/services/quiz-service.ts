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
    const distractors: string[] = [];
    for (const candidate of shuffle(words)) {
      if (distractors.length >= 3) break;
      if (candidate.id === word.id) continue;
      if (usedGerman.has(candidate.german)) continue;
      usedGerman.add(candidate.german);
      distractors.push(candidate.german);
    }
    const options = shuffle([word.german, ...distractors]);
    return { word, options, correctAnswer: word.german };
  });
}
