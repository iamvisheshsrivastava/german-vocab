import { storage } from "@/src/utils/storage";

// Storage values are limited to primitives/arrays-of-primitives (see
// storage-base.ts), so a run's fields are kept as three index-aligned
// arrays rather than an array of objects.
const CORRECT_KEY = "gv.quiz.history.correct.v1";
const ANSWERED_KEY = "gv.quiz.history.answered.v1";
const TIMESTAMP_KEY = "gv.quiz.history.timestamp.v1";

// Only the most recent runs are kept — this is a lightweight "last/best
// score" affordance, not a full analytics history.
const MAX_HISTORY = 10;

export type QuizResult = {
  correct: number;
  answered: number;
  /** ms since epoch, i.e. Date.now() at completion time. */
  timestamp: number;
};

export async function loadQuizHistory(): Promise<QuizResult[]> {
  const [correct, answered, timestamp] = await Promise.all([
    storage.getItem<readonly number[]>(CORRECT_KEY, []),
    storage.getItem<readonly number[]>(ANSWERED_KEY, []),
    storage.getItem<readonly number[]>(TIMESTAMP_KEY, []),
  ]);
  const c = Array.isArray(correct) ? correct : [];
  const a = Array.isArray(answered) ? answered : [];
  const t = Array.isArray(timestamp) ? timestamp : [];
  const len = Math.min(c.length, a.length, t.length);
  const results: QuizResult[] = [];
  for (let i = 0; i < len; i++) {
    results.push({ correct: c[i], answered: a[i], timestamp: t[i] });
  }
  return results;
}

// Appends the most recently completed run, keeping only the last
// MAX_HISTORY entries (most recent last).
export async function saveQuizResult(result: QuizResult): Promise<void> {
  const existing = await loadQuizHistory();
  const next = [...existing, result].slice(-MAX_HISTORY);
  await Promise.all([
    storage.setItem(
      CORRECT_KEY,
      next.map((r) => r.correct),
    ),
    storage.setItem(
      ANSWERED_KEY,
      next.map((r) => r.answered),
    ),
    storage.setItem(
      TIMESTAMP_KEY,
      next.map((r) => r.timestamp),
    ),
  ]);
}

export async function loadLastQuizResult(): Promise<QuizResult | null> {
  const history = await loadQuizHistory();
  return history.length > 0 ? history[history.length - 1] : null;
}

export async function loadBestQuizResult(): Promise<QuizResult | null> {
  const history = await loadQuizHistory();
  if (history.length === 0) return null;
  return history.reduce((best, r) => {
    const bestPct = best.answered === 0 ? 0 : best.correct / best.answered;
    const rPct = r.answered === 0 ? 0 : r.correct / r.answered;
    return rPct > bestPct ? r : best;
  });
}
