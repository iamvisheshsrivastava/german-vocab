import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadLearnViewMode, loadReviewedIds, saveLearnViewMode, saveReviewedIds } from "./progress-service";
import { loadQuizHistory, saveQuizResult } from "./quiz-history-service";
import { loadQuizMode, saveQuizMode } from "./quiz-service";
import { rateRecall } from "./spaced-repetition-service";
import { loadWeakWords, recordMissedWords, recordWordReviewed } from "./stats-service";
import {
  BACKUP_VERSION,
  createBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from "./backup-service";

describe("backup-service", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("bundles current progress into a versioned blob", async () => {
    await saveReviewedIds([1, 2]);
    await saveLearnViewMode("reviewed");
    await saveQuizMode("listening");
    await recordWordReviewed();
    await recordMissedWords([1]);
    await saveQuizResult({ correct: 2, answered: 3, timestamp: 123 });
    await rateRecall(1, "good", 1_000);

    const blob = await createBackup();
    expect(blob.version).toBe(BACKUP_VERSION);
    expect(blob.reviewedIds).toEqual([1, 2]);
    expect(blob.learnViewMode).toBe("reviewed");
    expect(blob.quizMode).toBe("listening");
    expect(blob.weakWords).toEqual([{ id: 1, misses: 1 }]);
    expect(blob.quizHistory).toEqual([{ correct: 2, answered: 3, timestamp: 123 }]);
    expect(blob.schedule).toHaveLength(1);
    expect(blob.dailyStats.length).toBeGreaterThan(0);
  });

  it("round-trips a blob through serialize/parse", async () => {
    await saveReviewedIds([7]);
    const blob = await createBackup();
    const text = serializeBackup(blob);
    const result = parseBackup(text);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.blob.reviewedIds).toEqual([7]);
    }
  });

  it("rejects malformed JSON", () => {
    const result = parseBackup("not json{{{");
    expect(result.ok).toBe(false);
  });

  it("rejects an unsupported version", () => {
    const result = parseBackup(JSON.stringify({ version: 99, reviewedIds: [], dailyStats: [], weakWords: [], quizHistory: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/version/i);
  });

  it("restores every piece of progress from a backup, overwriting current state", async () => {
    // Seed some state that should be wiped by the restore below.
    await saveReviewedIds([999]);
    await saveLearnViewMode("all");

    const result = parseBackup(
      JSON.stringify({
        version: BACKUP_VERSION,
        exportedAt: 42,
        reviewedIds: [1, 2, 3],
        learnViewMode: "due",
        quizMode: "listening",
        dailyStats: [],
        weakWords: [{ id: 5, misses: 2 }],
        quizHistory: [{ correct: 1, answered: 1, timestamp: 10 }],
        schedule: [{ id: 1, ef: 2.1, interval: 3, repetitions: 2, due: 50, lastReviewed: 10 }],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await restoreBackup(result.blob);

    expect(await loadReviewedIds()).toEqual([1, 2, 3]);
    expect(await loadLearnViewMode()).toBe("due");
    expect(await loadQuizMode()).toBe("listening");
    expect(await loadWeakWords()).toEqual([{ id: 5, misses: 2 }]);
    expect(await loadQuizHistory()).toEqual([{ correct: 1, answered: 1, timestamp: 10 }]);
  });
});
