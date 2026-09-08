import { VocabWord } from "@/src/models/vocab";
import { storage } from "@/src/utils/storage";

import { chatComplete } from "./openrouter-service";

// Storage values are limited to primitives/arrays-of-primitives (see
// storage-base.ts), so the cache is kept as three index-aligned arrays
// rather than an array of objects (mirrors quiz-history-service.ts).
const IDS_KEY = "gv.examples.ids.v1";
const SENTENCE_KEY = "gv.examples.sentence.v1";
const TRANSLATION_KEY = "gv.examples.translation.v1";

export type WordExample = {
  sentence: string;
  translation: string;
};

async function loadCache(): Promise<{
  ids: number[];
  sentences: string[];
  translations: string[];
}> {
  const [ids, sentences, translations] = await Promise.all([
    storage.getItem<readonly number[]>(IDS_KEY, []),
    storage.getItem<readonly string[]>(SENTENCE_KEY, []),
    storage.getItem<readonly string[]>(TRANSLATION_KEY, []),
  ]);
  return {
    ids: Array.isArray(ids) ? [...ids] : [],
    sentences: Array.isArray(sentences) ? [...sentences] : [],
    translations: Array.isArray(translations) ? [...translations] : [],
  };
}

export async function getCachedExample(wordId: number): Promise<WordExample | null> {
  const { ids, sentences, translations } = await loadCache();
  const idx = ids.indexOf(wordId);
  if (idx < 0) return null;
  return { sentence: sentences[idx], translation: translations[idx] };
}

// Concurrent generateExample calls (e.g. swiping past a card while its
// example is still in flight) race the same way saveReviewedIds does —
// chain writes through a single queue so each save starts only once the
// previous one has finished.
let exampleWriteQueue: Promise<unknown> = Promise.resolve();

function saveExample(wordId: number, example: WordExample): Promise<void> {
  const write = exampleWriteQueue.then(async () => {
    const { ids, sentences, translations } = await loadCache();
    const idx = ids.indexOf(wordId);
    if (idx >= 0) {
      sentences[idx] = example.sentence;
      translations[idx] = example.translation;
    } else {
      ids.push(wordId);
      sentences.push(example.sentence);
      translations.push(example.translation);
    }
    await Promise.all([
      storage.setItem(IDS_KEY, ids),
      storage.setItem(SENTENCE_KEY, sentences),
      storage.setItem(TRANSLATION_KEY, translations),
    ]);
  });
  exampleWriteQueue = write.catch(() => {});
  return write;
}

// Returns the cached example if we already generated one for this word,
// otherwise asks the model for exactly one and caches it forever — each
// word only ever costs one API call across the whole app lifetime. Throws
// OpenRouterError (via chatComplete) on failure; callers decide how to
// surface that (e.g. a quiet "no key yet" hint vs. a real error).
export async function generateExample(word: VocabWord): Promise<WordExample> {
  const cached = await getCachedExample(word.id);
  if (cached) return cached;

  const content = await chatComplete([
    {
      role: "system",
      content:
        "You are a German A1/A2 vocabulary tutor. Given an English word/phrase and its German translation, reply with EXACTLY two lines and nothing else: line 1 is a short, simple German example sentence (A1/A2 level) that uses the German word naturally; line 2 is that sentence's English translation. No labels, no quotes, no numbering, no extra commentary.",
    },
    {
      role: "user",
      content: `English: ${word.english}\nGerman: ${word.german}`,
    },
  ]);

  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const example: WordExample = {
    sentence: lines[0] ?? word.german,
    translation: lines[1] ?? word.english,
  };
  await saveExample(word.id, example);
  return example;
}
