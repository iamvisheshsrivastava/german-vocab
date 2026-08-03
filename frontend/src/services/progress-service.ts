import { storage } from "@/src/utils/storage";

const REVIEWED_KEY = "gv.reviewed.ids.v1";

// Reviewed IDs are stored as a JSON array of numbers via the storage util.
export async function loadReviewedIds(): Promise<number[]> {
  const raw = await storage.getItem<string>(REVIEWED_KEY, "[]");
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) {
      return parsed.filter((n): n is number => typeof n === "number");
    }
    return [];
  } catch {
    return [];
  }
}

export async function saveReviewedIds(ids: number[]): Promise<void> {
  await storage.setItem(REVIEWED_KEY, JSON.stringify(ids));
}

export async function resetReviewed(): Promise<void> {
  await storage.removeItem(REVIEWED_KEY);
}
