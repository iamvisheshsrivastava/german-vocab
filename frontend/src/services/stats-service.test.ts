import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  computeStreak,
  dateKey,
  loadRecentStats,
  loadTodayStats,
  loadWeakWords,
  recordActiveSeconds,
  recordMissedWords,
  recordTestCompleted,
  recordWordReviewed,
  resetStats,
} from "./stats-service";

describe("stats-service", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("starts with an empty today", async () => {
    const today = await loadTodayStats();
    expect(today).toEqual({
      date: dateKey(),
      wordsReviewed: 0,
      testsGiven: 0,
      testsCorrect: 0,
      testsAnswered: 0,
      activeSeconds: 0,
    });
  });

  it("accumulates words reviewed for today", async () => {
    await recordWordReviewed();
    await recordWordReviewed();
    const today = await loadTodayStats();
    expect(today.wordsReviewed).toBe(2);
  });

  it("accumulates test results for today", async () => {
    await recordTestCompleted(8, 10);
    await recordTestCompleted(3, 5);
    const today = await loadTodayStats();
    expect(today.testsGiven).toBe(2);
    expect(today.testsCorrect).toBe(11);
    expect(today.testsAnswered).toBe(15);
  });

  it("ignores a zero-answered test", async () => {
    await recordTestCompleted(0, 0);
    const today = await loadTodayStats();
    expect(today.testsGiven).toBe(0);
  });

  it("accumulates active seconds and ignores non-positive values", async () => {
    await recordActiveSeconds(30);
    await recordActiveSeconds(0);
    await recordActiveSeconds(-5);
    const today = await loadTodayStats();
    expect(today.activeSeconds).toBe(30);
  });

  it("counts today as a 1-day streak once there is activity", async () => {
    expect(await computeStreak()).toBe(0);
    await recordWordReviewed();
    expect(await computeStreak()).toBe(1);
  });

  it("includes today in recent stats after recording activity", async () => {
    await recordWordReviewed();
    const recent = await loadRecentStats(7);
    expect(recent[recent.length - 1].date).toBe(dateKey());
    expect(recent[recent.length - 1].wordsReviewed).toBe(1);
  });

  it("tracks missed words ranked by miss count", async () => {
    await recordMissedWords([1, 2, 1]);
    await recordMissedWords([1]);
    const weak = await loadWeakWords(10);
    expect(weak[0]).toEqual({ id: 1, misses: 3 });
    expect(weak[1]).toEqual({ id: 2, misses: 1 });
  });

  it("clears everything on resetStats", async () => {
    await recordWordReviewed();
    await recordMissedWords([1]);
    await resetStats();
    expect(await loadTodayStats()).toMatchObject({ wordsReviewed: 0 });
    expect(await loadWeakWords()).toEqual([]);
  });
});
