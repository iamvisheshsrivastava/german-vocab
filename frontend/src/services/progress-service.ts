import { storage } from "@/src/utils/storage";

const REVIEWED_KEY = "gv.reviewed.ids.v1";
const VIEW_MODE_KEY = "gv.learn.viewmode.v1";

export type LearnViewMode = "toReview" | "all";

// Reviewed IDs are stored as a number array via the storage util, which
// handles JSON encoding itself — do not JSON.stringify/parse here.
export async function loadReviewedIds(): Promise<number[]> {
  const ids = await storage.getItem<readonly number[]>(REVIEWED_KEY, []);
  return Array.isArray(ids) ? ids.filter((n): n is number => typeof n === "number") : [];
}

// Concurrent saveReviewedIds calls (e.g. rapid flashcard reveals) race against
// each other in AsyncStorage: two independent setItem calls for the same key
// have no ordering guarantee, so a later call's write can resolve before an
// earlier one's, leaving the earlier (smaller/stale) set as what's on disk.
// Chain writes through a single queue so each one only starts once the
// previous write for this key has actually finished.
let reviewedWriteQueue: Promise<unknown> = Promise.resolve();

export function saveReviewedIds(ids: number[]): Promise<void> {
  const write = reviewedWriteQueue.then(() => storage.setItem(REVIEWED_KEY, ids));
  // Swallow failures in the queue chain itself so one failed write doesn't
  // permanently break the chain for subsequent calls.
  reviewedWriteQueue = write.catch(() => {});
  return write.then(() => undefined);
}

export async function resetReviewed(): Promise<void> {
  await storage.removeItem(REVIEWED_KEY);
}

export async function loadLearnViewMode(): Promise<LearnViewMode> {
  const mode = await storage.getItem<string>(VIEW_MODE_KEY, "toReview");
  return mode === "all" ? "all" : "toReview";
}

export async function saveLearnViewMode(mode: LearnViewMode): Promise<void> {
  await storage.setItem(VIEW_MODE_KEY, mode);
}
