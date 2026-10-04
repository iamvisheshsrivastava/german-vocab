import { VocabWord } from "@/src/models/vocab";
import { storage } from "@/src/utils/storage";

import { shuffle } from "./vocabulary-service";

// "en-de" (default): prompt is the English word, options/answer are German —
// the original direction. "de-en" (issue #28): reversed, prompt is German,
// options/answer are English. Both "reverse" and "listening" modes use
// "de-en" question shape; "listening" additionally tells TestScreen to hide
// the German prompt text and speak it instead.
export type QuizDirection = "en-de" | "de-en";
export type QuizMode = "standard" | "reverse" | "listening";

export type QuizQuestion = {
  word: VocabWord;
  options: string[];
  correctAnswer: string;
  direction: QuizDirection;
};

const MODE_KEY = "gv.quiz.mode.v1";

export async function loadQuizMode(): Promise<QuizMode> {
  const mode = await storage.getItem<string>(MODE_KEY, "standard");
  return mode === "listening" || mode === "reverse" ? mode : "standard";
}

export async function saveQuizMode(mode: QuizMode): Promise<void> {
  await storage.setItem(MODE_KEY, mode);
}

// A quiz mode always implies a direction: "reverse" and "listening" both
// quiz German -> English ("de-en"); only "standard" keeps the original
// English -> German direction.
export function directionForMode(mode: QuizMode): QuizDirection {
  return mode === "standard" ? "en-de" : "de-en";
}

function fieldFor(word: VocabWord, direction: QuizDirection): string {
  return direction === "de-en" ? word.english : word.german;
}

// Builds `count` questions from a fresh random sample of `words`. Each
// question's 3 wrong options are re-randomized independently, so retaking a
// quiz (or a later question with the same word) never shows the same set of
// distractors twice.
export function generateQuestions(
  words: VocabWord[],
  count: number,
  direction: QuizDirection = "en-de",
): QuizQuestion[] {
  const sampleSize = Math.max(0, Math.min(count, words.length));
  const chosen = shuffle(words).slice(0, sampleSize);

  return chosen.map((word) => {
    const correctAnswer = fieldFor(word, direction);
    // Some words share the same translation on either side (e.g.
    // "she"/"they" -> "sie"). Track used strings so all 4 options are
    // always distinct.
    const used = new Set([correctAnswer]);
    const distractors = pickDistractors(words, word, direction, used);
    const options = shuffle([correctAnswer, ...distractors]);
    return { word, options, correctAnswer, direction };
  });
}

// Picks up to 3 distractors by random index with rejection, instead of
// shuffling (and copying) the entire word pool per question. Bounded attempt
// count avoids spinning forever on a degenerate pool with few distinct
// translations.
function pickDistractors(
  words: VocabWord[],
  word: VocabWord,
  direction: QuizDirection,
  used: Set<string>,
): string[] {
  const distractors: string[] = [];
  const n = words.length;
  if (n === 0) return distractors;
  const maxAttempts = n * 4;
  for (let attempts = 0; distractors.length < 3 && attempts < maxAttempts; attempts++) {
    const candidate = words[Math.floor(Math.random() * n)];
    if (candidate.id === word.id) continue;
    const candidateField = fieldFor(candidate, direction);
    if (used.has(candidateField)) continue;
    used.add(candidateField);
    distractors.push(candidateField);
  }
  return distractors;
}
