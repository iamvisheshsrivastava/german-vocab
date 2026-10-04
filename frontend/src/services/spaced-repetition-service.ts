import { storage } from "@/src/utils/storage";

import { loadWeakWords } from "./stats-service";

// Storage values are limited to primitives/arrays-of-primitives (see
// storage-base.ts), so the schedule is kept as index-aligned arrays rather
// than an array of objects (mirrors stats-service.ts / quiz-history-service.ts).
const IDS_KEY = "gv.sr.ids.v1";
const EF_KEY = "gv.sr.ef.v1";
const INTERVAL_KEY = "gv.sr.interval.v1";
const REPETITIONS_KEY = "gv.sr.repetitions.v1";
const DUE_KEY = "gv.sr.due.v1";
const LAST_REVIEWED_KEY = "gv.sr.lastReviewed.v1";

const DEFAULT_EF = 2.5;
const MIN_EF = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RecallRating = "again" | "hard" | "good" | "easy";

export type ScheduleCard = {
  id: number;
  /** Ease factor, SM-2 style (minimum 1.3, higher = easier). */
  ef: number;
  /** Current interval in days. */
  interval: number;
  repetitions: number;
  /** ms since epoch when this card is next due. */
  due: number;
  /** ms since epoch of the last rating, or null if never rated. */
  lastReviewed: number | null;
};

function freshCard(id: number, now: number, initialEf: number): ScheduleCard {
  return { id, ef: initialEf, interval: 0, repetitions: 0, due: now, lastReviewed: null };
}

export async function loadSchedule(): Promise<Map<number, ScheduleCard>> {
  const [ids, efs, intervals, repetitions, due, lastReviewed] = await Promise.all([
    storage.getItem<readonly number[]>(IDS_KEY, []),
    storage.getItem<readonly number[]>(EF_KEY, []),
    storage.getItem<readonly number[]>(INTERVAL_KEY, []),
    storage.getItem<readonly number[]>(REPETITIONS_KEY, []),
    storage.getItem<readonly number[]>(DUE_KEY, []),
    storage.getItem<readonly number[]>(LAST_REVIEWED_KEY, []),
  ]);
  const idArr = Array.isArray(ids) ? ids : [];
  const efArr = Array.isArray(efs) ? efs : [];
  const intervalArr = Array.isArray(intervals) ? intervals : [];
  const repArr = Array.isArray(repetitions) ? repetitions : [];
  const dueArr = Array.isArray(due) ? due : [];
  const lastArr = Array.isArray(lastReviewed) ? lastReviewed : [];

  const map = new Map<number, ScheduleCard>();
  idArr.forEach((id, i) => {
    if (typeof id !== "number") return;
    map.set(id, {
      id,
      ef: typeof efArr[i] === "number" ? efArr[i] : DEFAULT_EF,
      interval: typeof intervalArr[i] === "number" ? intervalArr[i] : 0,
      repetitions: typeof repArr[i] === "number" ? repArr[i] : 0,
      due: typeof dueArr[i] === "number" ? dueArr[i] : Date.now(),
      lastReviewed: typeof lastArr[i] === "number" ? lastArr[i] : null,
    });
  });
  return map;
}

async function saveSchedule(map: Map<number, ScheduleCard>): Promise<void> {
  const cards = Array.from(map.values());
  await Promise.all([
    storage.setItem(IDS_KEY, cards.map((c) => c.id)),
    storage.setItem(EF_KEY, cards.map((c) => c.ef)),
    storage.setItem(INTERVAL_KEY, cards.map((c) => c.interval)),
    storage.setItem(REPETITIONS_KEY, cards.map((c) => c.repetitions)),
    storage.setItem(DUE_KEY, cards.map((c) => c.due)),
    storage.setItem(LAST_REVIEWED_KEY, cards.map((c) => c.lastReviewed ?? 0)),
  ]);
}

// Concurrent rateRecall calls (rapid flashcard rating) race the same way
// saveReviewedIds/recordMissedWords do — chain every read-modify-write
// through one queue so writes can't clobber each other.
let scheduleWriteQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = scheduleWriteQueue.then(fn);
  scheduleWriteQueue = run.catch(() => {});
  return run;
}

// Words already flagged as weak (missed in quizzes) start with a lower ease
// factor, so the scheduler already treats them as harder before the first
// rating — the two retention signals reinforce each other instead of
// duplicating tracking.
async function initialEfFor(id: number): Promise<number> {
  const weak = await loadWeakWords(200);
  const entry = weak.find((w) => w.id === id);
  if (!entry) return DEFAULT_EF;
  return Math.max(MIN_EF, DEFAULT_EF - entry.misses * 0.1);
}

export async function getCard(id: number, now: number = Date.now()): Promise<ScheduleCard> {
  const map = await loadSchedule();
  const existing = map.get(id);
  if (existing) return existing;
  return freshCard(id, now, await initialEfFor(id));
}

// Applies one SM-2-style update for a single recall rating and persists it.
export function applyRating(
  card: ScheduleCard,
  rating: RecallRating,
  now: number = Date.now(),
): ScheduleCard {
  let { ef, interval, repetitions } = card;

  switch (rating) {
    case "again":
      repetitions = 0;
      interval = 1;
      ef = Math.max(MIN_EF, ef - 0.2);
      break;
    case "hard":
      repetitions += 1;
      interval = Math.max(1, Math.round((interval || 1) * 1.2));
      ef = Math.max(MIN_EF, ef - 0.15);
      break;
    case "good":
      repetitions += 1;
      interval = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(interval * ef);
      break;
    case "easy":
      repetitions += 1;
      interval =
        repetitions === 1 ? 4 : Math.round(Math.max(interval, 1) * ef * 1.3);
      ef = ef + 0.15;
      break;
  }

  return {
    id: card.id,
    ef,
    interval,
    repetitions,
    due: now + interval * DAY_MS,
    lastReviewed: now,
  };
}

// Rates recall for a word, updating (or creating) its schedule entry.
export function rateRecall(
  id: number,
  rating: RecallRating,
  now: number = Date.now(),
): Promise<ScheduleCard> {
  return enqueue(async () => {
    const map = await loadSchedule();
    const current = map.get(id) ?? freshCard(id, now, await initialEfFor(id));
    const next = applyRating(current, rating, now);
    map.set(id, next);
    await saveSchedule(map);
    return next;
  });
}

// Ids currently due for review: either scheduled with `due <= now`, or never
// scheduled at all (a brand-new word is always "due").
export async function loadDueIds(
  allIds: readonly number[],
  now: number = Date.now(),
): Promise<Set<number>> {
  const map = await loadSchedule();
  const due = new Set<number>();
  for (const id of allIds) {
    const card = map.get(id);
    if (!card || card.due <= now) due.add(id);
  }
  return due;
}

export async function resetSchedule(): Promise<void> {
  return enqueue(() =>
    Promise.all([
      storage.removeItem(IDS_KEY),
      storage.removeItem(EF_KEY),
      storage.removeItem(INTERVAL_KEY),
      storage.removeItem(REPETITIONS_KEY),
      storage.removeItem(DUE_KEY),
      storage.removeItem(LAST_REVIEWED_KEY),
    ]).then(() => undefined),
  );
}

// Used by backup-service to bundle/restore the full schedule without going
// through the rating flow.
export async function exportSchedule(): Promise<ScheduleCard[]> {
  const map = await loadSchedule();
  return Array.from(map.values());
}

export async function replaceSchedule(cards: readonly ScheduleCard[]): Promise<void> {
  return enqueue(async () => {
    const map = new Map<number, ScheduleCard>();
    for (const c of cards) {
      if (typeof c?.id !== "number") continue;
      map.set(c.id, {
        id: c.id,
        ef: typeof c.ef === "number" ? c.ef : DEFAULT_EF,
        interval: typeof c.interval === "number" ? c.interval : 0,
        repetitions: typeof c.repetitions === "number" ? c.repetitions : 0,
        due: typeof c.due === "number" ? c.due : Date.now(),
        lastReviewed: typeof c.lastReviewed === "number" ? c.lastReviewed : null,
      });
    }
    await saveSchedule(map);
  });
}
