import { VocabWord } from "@/src/models/vocab";

import { getCategories, selectWords, shuffle } from "./vocabulary-service";

const words: VocabWord[] = [
  { id: 1, category: "A", english: "one", german: "eins" },
  { id: 2, category: "A", english: "two", german: "zwei" },
  { id: 3, category: "B", english: "three", german: "drei" },
  { id: 4, category: "B", english: "four", german: "vier" },
  { id: 5, category: "C", english: "five", german: "fünf" },
];

describe("shuffle", () => {
  it("returns all the same elements without mutating the input", () => {
    const original = [...words];
    const result = shuffle(words);
    expect(result).toHaveLength(words.length);
    expect(new Set(result.map((w) => w.id))).toEqual(new Set(words.map((w) => w.id)));
    expect(words).toEqual(original);
  });
});

describe("getCategories", () => {
  it("returns unique sorted categories prefixed with All", () => {
    expect(getCategories(words)).toEqual(["All", "A", "B", "C"]);
  });
});

describe("selectWords", () => {
  it("filters by category and sorts by id when a specific category is selected", () => {
    const result = selectWords(words, "B");
    expect(result.map((w) => w.id)).toEqual([3, 4]);
  });

  it("returns a shuffled copy of all words when 'All' is selected", () => {
    const result = selectWords(words, "All");
    expect(new Set(result.map((w) => w.id))).toEqual(new Set(words.map((w) => w.id)));
  });

  it("excludes ids present in excludeIds", () => {
    const result = selectWords(words, "A", new Set([1]));
    expect(result.map((w) => w.id)).toEqual([2]);
  });

  it("ignores excludeIds when empty", () => {
    const result = selectWords(words, "A", new Set());
    expect(result.map((w) => w.id).sort()).toEqual([1, 2]);
  });

  it("keeps only ids present in onlyIds", () => {
    const result = selectWords(words, "A", undefined, new Set([2]));
    expect(result.map((w) => w.id)).toEqual([2]);
  });

  it("returns an empty list when onlyIds excludes everything in the category", () => {
    const result = selectWords(words, "A", undefined, new Set());
    expect(result).toEqual([]);
  });
});
