// Bundles every locally-stored piece of progress into one versioned JSON
// blob (export), and restores from one (import). Reuses each domain
// service's own load/save surface instead of touching raw storage keys
// directly, so this file stays correct as those services evolve.

import {
  LearnViewMode,
  loadLearnViewMode,
  loadReviewedIds,
  saveLearnViewMode,
  saveReviewedIds,
} from "./progress-service";
import { loadQuizHistory, QuizResult, replaceQuizHistory } from "./quiz-history-service";
import { loadQuizMode, QuizMode, saveQuizMode } from "./quiz-service";
import {
  exportSchedule,
  replaceSchedule,
  ScheduleCard,
} from "./spaced-repetition-service";
import {
  DailyStat,
  loadAllStats,
  loadAllWeakWords,
  replaceAllStats,
  replaceWeakWords,
} from "./stats-service";

// Bump whenever the shape below changes in a way that needs migration logic
// in importBackup().
export const BACKUP_VERSION = 1;

export type BackupBlob = {
  version: typeof BACKUP_VERSION;
  exportedAt: number; // ms since epoch
  reviewedIds: number[];
  learnViewMode: LearnViewMode;
  quizMode: QuizMode;
  dailyStats: DailyStat[];
  weakWords: { id: number; misses: number }[];
  quizHistory: QuizResult[];
  schedule: ScheduleCard[];
};

export async function createBackup(): Promise<BackupBlob> {
  const [reviewedIds, learnViewMode, quizMode, dailyStats, weakWords, quizHistory, schedule] =
    await Promise.all([
      loadReviewedIds(),
      loadLearnViewMode(),
      loadQuizMode(),
      loadAllStats(),
      loadAllWeakWords(),
      loadQuizHistory(),
      exportSchedule(),
    ]);
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    reviewedIds,
    learnViewMode,
    quizMode,
    dailyStats,
    weakWords,
    quizHistory,
    schedule,
  };
}

export function serializeBackup(blob: BackupBlob): string {
  return JSON.stringify(blob, null, 2);
}

export type ParseBackupResult =
  | { ok: true; blob: BackupBlob }
  | { ok: false; error: string };

// Validates shape/version before anything is trusted enough to write to
// storage — a hand-edited or corrupted file should fail loudly here rather
// than partially overwrite existing progress.
export function parseBackup(text: string): ParseBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That doesn't look like valid JSON." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "Backup file is malformed." };
  }
  const p = parsed as Record<string, unknown>;
  if (p.version !== BACKUP_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup version (${String(p.version)}). Expected ${BACKUP_VERSION}.`,
    };
  }
  const isNumberArray = (v: unknown): v is number[] =>
    Array.isArray(v) && v.every((x) => typeof x === "number");
  if (!isNumberArray(p.reviewedIds)) {
    return { ok: false, error: "Backup is missing reviewed word data." };
  }
  if (!Array.isArray(p.dailyStats) || !Array.isArray(p.weakWords) || !Array.isArray(p.quizHistory)) {
    return { ok: false, error: "Backup is missing stats data." };
  }

  const learnViewMode: LearnViewMode =
    p.learnViewMode === "all" || p.learnViewMode === "reviewed" || p.learnViewMode === "due"
      ? p.learnViewMode
      : "toReview";
  const quizMode: QuizMode =
    p.quizMode === "listening" || p.quizMode === "reverse" ? p.quizMode : "standard";

  return {
    ok: true,
    blob: {
      version: BACKUP_VERSION,
      exportedAt: typeof p.exportedAt === "number" ? p.exportedAt : Date.now(),
      reviewedIds: p.reviewedIds,
      learnViewMode,
      quizMode,
      dailyStats: p.dailyStats as DailyStat[],
      weakWords: p.weakWords as { id: number; misses: number }[],
      quizHistory: p.quizHistory as QuizResult[],
      schedule: Array.isArray(p.schedule) ? (p.schedule as ScheduleCard[]) : [],
    },
  };
}

// Overwrites all current progress with what's in `blob`. Callers should
// confirm with the user first — this is destructive, same as resetStats().
export async function restoreBackup(blob: BackupBlob): Promise<void> {
  await Promise.all([
    saveReviewedIds(blob.reviewedIds),
    saveLearnViewMode(blob.learnViewMode),
    saveQuizMode(blob.quizMode),
    replaceAllStats(blob.dailyStats),
    replaceWeakWords(blob.weakWords),
    replaceQuizHistory(blob.quizHistory),
    replaceSchedule(blob.schedule),
  ]);
}
