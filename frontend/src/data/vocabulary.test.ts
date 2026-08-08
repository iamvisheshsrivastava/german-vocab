import vocabData from "./vocabulary.json";
import { VocabWord } from "@/src/models/vocab";

const words = vocabData as VocabWord[];

describe("vocabulary.json invariants", () => {
  it("has 2000 entries", () => {
    expect(words.length).toBe(2000);
  });

  it("has unique, contiguous ids starting at 1", () => {
    const ids = words.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(Array.from({ length: words.length }, (_, i) => i + 1));
  });

  it("has no duplicate english values", () => {
    const englishValues = words.map((w) => w.english.trim().toLowerCase());
    expect(new Set(englishValues).size).toBe(englishValues.length);
  });

  it("has no duplicate (english, german) pairs", () => {
    const pairs = words.map((w) => `${w.english.trim().toLowerCase()}::${w.german.trim().toLowerCase()}`);
    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("has non-empty category, english, and german for every entry", () => {
    for (const w of words) {
      expect(w.category.trim().length).toBeGreaterThan(0);
      expect(w.english.trim().length).toBeGreaterThan(0);
      expect(w.german.trim().length).toBeGreaterThan(0);
    }
  });

  it("keeps categories reasonably balanced", () => {
    const counts = new Map<string, number>();
    for (const w of words) {
      counts.set(w.category, (counts.get(w.category) ?? 0) + 1);
    }
    expect(counts.size).toBe(10);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThanOrEqual(100);
    }
  });
});
