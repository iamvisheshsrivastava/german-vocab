import AsyncStorage from "@react-native-async-storage/async-storage";

import { VocabWord } from "@/src/models/vocab";

import { directionForMode, generateQuestions, loadQuizMode, saveQuizMode } from "./quiz-service";

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

  it("defaults to the en-de direction", () => {
    const questions = generateQuestions(words, 5);
    for (const q of questions) {
      expect(q.direction).toBe("en-de");
      expect(q.correctAnswer).toBe(q.word.german);
    }
  });

  it("reverses to de-en when asked", () => {
    const questions = generateQuestions(words, 5, "de-en");
    for (const q of questions) {
      expect(q.direction).toBe("de-en");
      expect(q.correctAnswer).toBe(q.word.english);
      expect(q.options).toContain(q.word.english);
      expect(q.options).not.toContain(q.word.german);
    }
  });

  it("de-duplicates de-en distractors sharing the same english meaning", () => {
    const shared: VocabWord[] = [
      { id: 1, category: "A", english: "right", german: "rechts" },
      { id: 2, category: "A", english: "right", german: "richtig" },
      { id: 3, category: "A", english: "cat", german: "katze" },
      { id: 4, category: "A", english: "dog", german: "hund" },
    ];
    const questions = generateQuestions(shared, 4, "de-en");
    for (const q of questions) {
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });
});

describe("quiz mode preferences", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("defaults to standard mode and maps to en-de direction", async () => {
    expect(await loadQuizMode()).toBe("standard");
    expect(directionForMode("standard")).toBe("en-de");
    expect(directionForMode("reverse")).toBe("de-en");
    expect(directionForMode("listening")).toBe("de-en");
  });

  it("round-trips the saved quiz mode", async () => {
    await saveQuizMode("listening");
    expect(await loadQuizMode()).toBe("listening");
    await saveQuizMode("standard");
    expect(await loadQuizMode()).toBe("standard");
  });
});
