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

export async function saveReviewedIds(ids: number[]): Promise<void> {
  await storage.setItem(REVIEWED_KEY, ids);
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
