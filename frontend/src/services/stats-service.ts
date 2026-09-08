import { storage } from "@/src/utils/storage";

// Storage values are limited to primitives/arrays-of-primitives (see
// storage-base.ts), so daily rows are kept as index-aligned arrays rather
// than an array of objects (mirrors quiz-history-service.ts).
const DATES_KEY = "gv.stats.dates.v1";
const WORDS_REVIEWED_KEY = "gv.stats.wordsReviewed.v1";
const TESTS_GIVEN_KEY = "gv.stats.testsGiven.v1";
const TESTS_CORRECT_KEY = "gv.stats.testsCorrect.v1";
const TESTS_ANSWERED_KEY = "gv.stats.testsAnswered.v1";
const ACTIVE_SECONDS_KEY = "gv.stats.activeSeconds.v1";

// Only the most recent days are kept — this is a lightweight progress view,
// not a full analytics history.
const MAX_DAYS = 60;

const WEAK_IDS_KEY = "gv.stats.weakWordIds.v1";
const WEAK_COUNTS_KEY = "gv.stats.weakWordCounts.v1";
const MAX_WEAK_WORDS = 200;

export type DailyStat = {
  date: string; // YYYY-MM-DD, local calendar day
  wordsReviewed: number;
  testsGiven: number;
  testsCorrect: number;
  testsAnswered: number;
  activeSeconds: number;
};

// Local (not UTC) calendar day, so "today" matches what the user's clock says.
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function loadDaily(): Promise<DailyStat[]> {
  const [dates, wordsReviewed, testsGiven, testsCorrect, testsAnswered, activeSeconds] =
    await Promise.all([
      storage.getItem<readonly string[]>(DATES_KEY, []),
      storage.getItem<readonly number[]>(WORDS_REVIEWED_KEY, []),
      storage.getItem<readonly number[]>(TESTS_GIVEN_KEY, []),
      storage.getItem<readonly number[]>(TESTS_CORRECT_KEY, []),
      storage.getItem<readonly number[]>(TESTS_ANSWERED_KEY, []),
      storage.getItem<readonly number[]>(ACTIVE_SECONDS_KEY, []),
    ]);
  const dates_ = Array.isArray(dates) ? dates : [];
  const num = (a: unknown): number[] => (Array.isArray(a) ? (a as number[]) : []);
  const wr = num(wordsReviewed);
  const tg = num(testsGiven);
  const tc = num(testsCorrect);
  const ta = num(testsAnswered);
  const as_ = num(activeSeconds);
  return dates_.map((date, i) => ({
    date,
    wordsReviewed: wr[i] ?? 0,
    testsGiven: tg[i] ?? 0,
    testsCorrect: tc[i] ?? 0,
    testsAnswered: ta[i] ?? 0,
    activeSeconds: as_[i] ?? 0,
  }));
}

async function saveDaily(rows: DailyStat[]): Promise<void> {
  await Promise.all([
    storage.setItem(DATES_KEY, rows.map((r) => r.date)),
    storage.setItem(WORDS_REVIEWED_KEY, rows.map((r) => r.wordsReviewed)),
    storage.setItem(TESTS_GIVEN_KEY, rows.map((r) => r.testsGiven)),
    storage.setItem(TESTS_CORRECT_KEY, rows.map((r) => r.testsCorrect)),
    storage.setItem(TESTS_ANSWERED_KEY, rows.map((r) => r.testsAnswered)),
    storage.setItem(ACTIVE_SECONDS_KEY, rows.map((r) => r.activeSeconds)),
  ]);
}

// Concurrent record* calls (rapid flashcard reveals, a test finishing right
// as the app backgrounds) race the same way saveReviewedIds does — chain
// every read-modify-write through one queue.
let statsWriteQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = statsWriteQueue.then(fn);
  statsWriteQueue = run.catch(() => {});
  return run;
}

async function bumpToday(patch: Partial<Omit<DailyStat, "date">>): Promise<void> {
  return enqueue(async () => {
    const rows = await loadDaily();
    const key = dateKey();
    const idx = rows.findIndex((r) => r.date === key);
    if (idx >= 0) {
      const row = rows[idx];
      rows[idx] = {
        date: row.date,
        wordsReviewed: row.wordsReviewed + (patch.wordsReviewed ?? 0),
        testsGiven: row.testsGiven + (patch.testsGiven ?? 0),
        testsCorrect: row.testsCorrect + (patch.testsCorrect ?? 0),
        testsAnswered: row.testsAnswered + (patch.testsAnswered ?? 0),
        activeSeconds: row.activeSeconds + (patch.activeSeconds ?? 0),
      };
    } else {
      rows.push({
        date: key,
        wordsReviewed: patch.wordsReviewed ?? 0,
        testsGiven: patch.testsGiven ?? 0,
        testsCorrect: patch.testsCorrect ?? 0,
        testsAnswered: patch.testsAnswered ?? 0,
        activeSeconds: patch.activeSeconds ?? 0,
      });
    }
    await saveDaily(rows.slice(-MAX_DAYS));
  });
}

export function recordWordReviewed(): Promise<void> {
  return bumpToday({ wordsReviewed: 1 });
}

export function recordTestCompleted(correct: number, answered: number): Promise<void> {
  if (answered <= 0) return Promise.resolve();
  return bumpToday({ testsGiven: 1, testsCorrect: correct, testsAnswered: answered });
}

export function recordActiveSeconds(seconds: number): Promise<void> {
  const whole = Math.round(seconds);
  if (whole <= 0) return Promise.resolve();
  return bumpToday({ activeSeconds: whole });
}

export async function loadRecentStats(days = 7): Promise<DailyStat[]> {
  const rows = await loadDaily();
  return rows.slice(-days);
}

export async function loadTodayStats(): Promise<DailyStat> {
  const rows = await loadDaily();
  const key = dateKey();
  return (
    rows.find((r) => r.date === key) ?? {
      date: key,
      wordsReviewed: 0,
      testsGiven: 0,
      testsCorrect: 0,
      testsAnswered: 0,
      activeSeconds: 0,
    }
  );
}

// Consecutive days (ending today) with any recorded activity.
export async function computeStreak(): Promise<number> {
  const rows = await loadDaily();
  const activeDates = new Set(
    rows
      .filter((r) => r.wordsReviewed > 0 || r.testsGiven > 0 || r.activeSeconds > 0)
      .map((r) => r.date),
  );
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const key = dateKey(cursor);
    if (!activeDates.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Words missed in quiz questions, most-missed first — the retention signal
// for a 30-day cram: these are the words worth drilling again in Learn.
export async function recordMissedWords(wordIds: number[]): Promise<void> {
  if (wordIds.length === 0) return;
  return enqueue(async () => {
    const [ids, counts] = await Promise.all([
      storage.getItem<readonly number[]>(WEAK_IDS_KEY, []),
      storage.getItem<readonly number[]>(WEAK_COUNTS_KEY, []),
    ]);
    const idArr = Array.isArray(ids) ? [...ids] : [];
    const countArr = Array.isArray(counts) ? [...counts] : [];
    for (const id of wordIds) {
      const idx = idArr.indexOf(id);
      if (idx >= 0) {
        countArr[idx] += 1;
      } else {
        idArr.push(id);
        countArr.push(1);
      }
    }
    // Cap so the arrays can't grow unbounded over a long history — drop the
    // least-missed entries first, they're the least useful signal.
    if (idArr.length > MAX_WEAK_WORDS) {
      const order = idArr
        .map((id, i) => ({ id, count: countArr[i] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, MAX_WEAK_WORDS);
      await Promise.all([
        storage.setItem(WEAK_IDS_KEY, order.map((o) => o.id)),
        storage.setItem(WEAK_COUNTS_KEY, order.map((o) => o.count)),
      ]);
    } else {
      await Promise.all([
        storage.setItem(WEAK_IDS_KEY, idArr),
        storage.setItem(WEAK_COUNTS_KEY, countArr),
      ]);
    }
  });
}

export async function loadWeakWords(limit = 10): Promise<{ id: number; misses: number }[]> {
  const [ids, counts] = await Promise.all([
    storage.getItem<readonly number[]>(WEAK_IDS_KEY, []),
    storage.getItem<readonly number[]>(WEAK_COUNTS_KEY, []),
  ]);
  const idArr = Array.isArray(ids) ? ids : [];
  const countArr = Array.isArray(counts) ? counts : [];
  return idArr
    .map((id, i) => ({ id, misses: countArr[i] ?? 0 }))
    .sort((a, b) => b.misses - a.misses)
    .slice(0, limit);
}

export async function resetStats(): Promise<void> {
  await Promise.all([
    storage.removeItem(DATES_KEY),
    storage.removeItem(WORDS_REVIEWED_KEY),
    storage.removeItem(TESTS_GIVEN_KEY),
    storage.removeItem(TESTS_CORRECT_KEY),
    storage.removeItem(TESTS_ANSWERED_KEY),
    storage.removeItem(ACTIVE_SECONDS_KEY),
    storage.removeItem(WEAK_IDS_KEY),
    storage.removeItem(WEAK_COUNTS_KEY),
  ]);
}
