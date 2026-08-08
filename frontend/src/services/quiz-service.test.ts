import { VocabWord } from "@/src/models/vocab";

import { generateQuestions } from "./quiz-service";

const words: VocabWord[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  category: "A",
  english: `word${i + 1}`,
  german: `wort${i + 1}`,
}));

describe("generateQuestions", () => {
  it("generates the requested number of questions, capped by the word pool size", () => {
    expect(generateQuestions(words, 5)).toHaveLength(5);
    expect(generateQuestions(words, 100)).toHaveLength(words.length);
    expect(generateQuestions(words, 0)).toHaveLength(0);
  });

  it("each question has 4 distinct options including the correct answer", () => {
    const questions = generateQuestions(words, 10);
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.correctAnswer);
      expect(q.correctAnswer).toBe(q.word.german);
    }
  });

  it("handles a pool smaller than 4 without throwing", () => {
    const tiny = words.slice(0, 2);
    const questions = generateQuestions(tiny, 2);
    expect(questions).toHaveLength(2);
    for (const q of questions) {
      expect(q.options.length).toBeGreaterThan(0);
      expect(q.options).toContain(q.correctAnswer);
    }
  });

  it("de-duplicates distractors that share the same german translation", () => {
    const shared: VocabWord[] = [
      { id: 1, category: "A", english: "she", german: "sie" },
      { id: 2, category: "A", english: "they", german: "sie" },
      { id: 3, category: "A", english: "cat", german: "katze" },
      { id: 4, category: "A", english: "dog", german: "hund" },
    ];
    const questions = generateQuestions(shared, 4);
    for (const q of questions) {
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });
});
