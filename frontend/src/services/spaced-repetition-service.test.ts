import AsyncStorage from "@react-native-async-storage/async-storage";

import { recordMissedWords } from "./stats-service";
import {
  applyRating,
  getCard,
  loadDueIds,
  rateRecall,
  resetSchedule,
} from "./spaced-repetition-service";

const NOW = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

describe("spaced-repetition-service", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("gives an unscheduled word a default card that's immediately due", async () => {
    const card = await getCard(1, NOW);
    expect(card).toMatchObject({ id: 1, ef: 2.5, interval: 0, repetitions: 0, due: NOW });
    expect(card.lastReviewed).toBeNull();
  });

  it("lowers the initial ease factor for words already flagged as weak", async () => {
    await recordMissedWords([1, 1, 1]);
    const card = await getCard(1, NOW);
    expect(card.ef).toBeLessThan(2.5);
    expect(card.ef).toBeCloseTo(2.2, 5);
  });

  it("resets repetitions and interval to 1 day on 'again'", () => {
    const card = { id: 1, ef: 2.5, interval: 10, repetitions: 3, due: NOW, lastReviewed: NOW };
    const next = applyRating(card, "again", NOW);
    expect(next.repetitions).toBe(0);
    expect(next.interval).toBe(1);
    expect(next.ef).toBeLessThan(card.ef);
    expect(next.due).toBe(NOW + DAY_MS);
  });

  it("grows the interval through the standard SM-2 progression on 'good'", () => {
    let card = { id: 1, ef: 2.5, interval: 0, repetitions: 0, due: NOW, lastReviewed: null as number | null };
    card = applyRating(card, "good", NOW);
    expect(card.interval).toBe(1);
    card = applyRating(card, "good", NOW);
    expect(card.interval).toBe(6);
    card = applyRating(card, "good", NOW);
    expect(card.interval).toBe(Math.round(6 * card.ef));
  });

  it("grows the ease factor and interval faster on 'easy'", () => {
    const card = { id: 1, ef: 2.5, interval: 6, repetitions: 2, due: NOW, lastReviewed: NOW };
    const next = applyRating(card, "easy", NOW);
    expect(next.ef).toBeGreaterThan(card.ef);
    expect(next.interval).toBeGreaterThan(card.interval);
  });

  it("persists ratings via rateRecall and reflects them in getCard", async () => {
    await rateRecall(5, "good", NOW);
    const card = await getCard(5, NOW);
    expect(card.repetitions).toBe(1);
    expect(card.interval).toBe(1);
    expect(card.due).toBe(NOW + DAY_MS);
  });

  it("treats never-scheduled and overdue words as due, future ones as not due", async () => {
    await rateRecall(1, "easy", NOW); // pushes well into the future
    await rateRecall(2, "again", NOW - 2 * DAY_MS); // due in the past
    const due = await loadDueIds([1, 2, 3], NOW);
    expect(due.has(1)).toBe(false);
    expect(due.has(2)).toBe(true);
    expect(due.has(3)).toBe(true); // never scheduled
  });

  it("clears the whole schedule on reset", async () => {
    await rateRecall(1, "good", NOW);
    await resetSchedule();
    const card = await getCard(1, NOW);
    expect(card.repetitions).toBe(0);
    expect(card.lastReviewed).toBeNull();
  });
});
