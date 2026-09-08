import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { clearApiKey, getApiKey } from "@/src/services/openrouter-service";
import { resetReviewed } from "@/src/services/progress-service";
import {
  computeStreak,
  DailyStat,
  dateKey,
  loadRecentStats,
  loadTodayStats,
  loadWeakWords,
  resetStats,
} from "@/src/services/stats-service";
import { loadVocabulary } from "@/src/services/vocabulary-service";
import { ThemeColors, useThemeColors } from "@/src/theme/colors";

const RECENT_DAYS = 7;

function formatMinutes(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

function dayLabel(iso: string): string {
  // iso is a local YYYY-MM-DD produced by dateKey(); parse it as local, not UTC.
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
}

// `active` reflects whether this tab is the one currently shown — all tabs
// stay permanently mounted (see app/index.tsx) so switching back to Stats
// doesn't remount it, meaning a plain mount-only effect would never re-run
// and show stale numbers. Refresh explicitly whenever this tab becomes active.
export function StatsScreen({ active }: { active: boolean }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const allWords = useMemo(() => loadVocabulary(), []);
  const wordById = useMemo(() => new Map(allWords.map((w) => [w.id, w])), [allWords]);

  const [loaded, setLoaded] = useState(false);
  const [streak, setStreak] = useState(0);
  const [today, setToday] = useState<DailyStat | null>(null);
  const [recent, setRecent] = useState<DailyStat[]>([]);
  const [weakWords, setWeakWords] = useState<{ id: number; misses: number }[]>([]);
  const [hasKey, setHasKey] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [s, t, r, w, key] = await Promise.all([
      computeStreak(),
      loadTodayStats(),
      loadRecentStats(RECENT_DAYS),
      loadWeakWords(8),
      getApiKey(),
    ]);
    setStreak(s);
    setToday(t);
    setRecent(r);
    setWeakWords(w);
    setHasKey(key !== null);
    setLoaded(true);
  }, []);

  // Refresh every time this tab becomes active, not just on first mount —
  // stats change constantly while using Learn/Test.
  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  const handleResetProgress = async () => {
    await resetReviewed();
    await resetStats();
    setResetConfirmOpen(false);
    refresh();
  };

  const handleRemoveKey = async () => {
    await clearApiKey();
    setHasKey(false);
  };

  const maxWordsReviewed = Math.max(1, ...recent.map((r) => r.wordsReviewed));

  const weekTotals = recent.reduce(
    (acc, r) => ({
      words: acc.words + r.wordsReviewed,
      tests: acc.tests + r.testsGiven,
      correct: acc.correct + r.testsCorrect,
      answered: acc.answered + r.testsAnswered,
      seconds: acc.seconds + r.activeSeconds,
    }),
    { words: 0, tests: 0, correct: 0, answered: 0, seconds: 0 },
  );
  const weekAccuracy =
    weekTotals.answered === 0 ? null : Math.round((weekTotals.correct / weekTotals.answered) * 100);

  if (!loaded || !today) {
    return <View style={styles.container} testID="stats-loading" />;
  }

  const todayAccuracy =
    today.testsAnswered === 0 ? null : Math.round((today.testsCorrect / today.testsAnswered) * 100);

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        testID="stats-screen"
      >
        <Text style={styles.pageTitle}>Stats</Text>

        {/* Streak */}
        <View style={styles.streakCard}>
          <Ionicons name="flame" size={26} color={streak > 0 ? colors.warning : colors.textFaint} />
          <View style={styles.streakTextCol}>
            <Text style={styles.streakNumber} testID="stat-streak">
              {streak} day{streak === 1 ? "" : "s"}
            </Text>
            <Text style={styles.streakLabel}>current streak</Text>
          </View>
        </View>

        {/* Today */}
        <Text style={styles.sectionTitle}>Today</Text>
        <View style={styles.statRow}>
          <View style={styles.statTile}>
            <Text style={styles.statValue} testID="stat-today-words">
              {today.wordsReviewed}
            </Text>
            <Text style={styles.statLabel}>words reviewed</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue} testID="stat-today-tests">
              {today.testsGiven}
            </Text>
            <Text style={styles.statLabel}>tests taken</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue} testID="stat-today-time">
              {formatMinutes(today.activeSeconds)}
            </Text>
            <Text style={styles.statLabel}>time spent</Text>
          </View>
        </View>
        {todayAccuracy !== null ? (
          <Text style={styles.accuracyLine}>
            Today&apos;s accuracy: <Text style={styles.accuracyValue}>{todayAccuracy}%</Text> (
            {today.testsCorrect}/{today.testsAnswered})
          </Text>
        ) : null}

        {/* Last 7 days */}
        <Text style={styles.sectionTitle}>Last {RECENT_DAYS} days</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartRow}>
            {recent.map((r) => {
              const heightPct = Math.max(4, Math.round((r.wordsReviewed / maxWordsReviewed) * 100));
              const isToday = r.date === dateKey();
              return (
                <View key={r.date} style={styles.chartBarCol}>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBarFill,
                        { height: `${heightPct}%` },
                        isToday && styles.chartBarFillToday,
                      ]}
                    />
                  </View>
                  <Text style={styles.chartBarLabel}>{dayLabel(r.date)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={styles.chartCaption}>Words reviewed per day</Text>
          <View style={styles.weekSummaryRow}>
            <Text style={styles.weekSummaryText}>
              {weekTotals.words} words &middot; {weekTotals.tests} tests
              {weekAccuracy !== null ? ` · ${weekAccuracy}% accuracy` : ""}
            </Text>
          </View>
        </View>

        {/* Weak words */}
        <Text style={styles.sectionTitle}>Words to drill</Text>
        {weakWords.length === 0 ? (
          <Text style={styles.emptyHint}>
            Words you get wrong in Test show up here, most-missed first.
          </Text>
        ) : (
          <View style={styles.weakList}>
            {weakWords.map(({ id, misses }) => {
              const word = wordById.get(id);
              if (!word) return null;
              return (
                <View key={id} style={styles.weakRow} testID={`weak-word-${id}`}>
                  <View style={styles.weakWordCol}>
                    <Text style={styles.weakGerman}>{word.german}</Text>
                    <Text style={styles.weakEnglish}>{word.english}</Text>
                  </View>
                  <View style={styles.weakMissBadge}>
                    <Text style={styles.weakMissText}>
                      {misses}&times; missed
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* OpenRouter connection */}
        <Text style={styles.sectionTitle}>Ask AI</Text>
        <View style={styles.settingsRow}>
          <View style={styles.settingsTextCol}>
            <Text style={styles.settingsLabel}>OpenRouter key</Text>
            <Text style={styles.settingsValue}>
              {hasKey ? "Connected" : "Not connected — add one in the Ask tab"}
            </Text>
          </View>
          {hasKey ? (
            <Pressable onPress={handleRemoveKey} testID="stats-remove-key">
              <Text style={styles.removeKeyText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Danger zone */}
        <Text style={styles.sectionTitle}>Reset</Text>
        <Pressable
          style={styles.resetButton}
          onPress={() => setResetConfirmOpen(true)}
          testID="stats-reset-button"
        >
          <Ionicons name="refresh" size={16} color={colors.danger} />
          <Text style={styles.resetText}>Reset Progress &amp; Stats</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={resetConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setResetConfirmOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmSheet} testID="reset-confirm-sheet">
            <Text style={styles.confirmTitle}>Reset everything?</Text>
            <Text style={styles.confirmBody}>
              This clears all reviewed words, stats, streaks, and drill history. This
              cannot be undone.
            </Text>
            <View style={styles.confirmButtons}>
              <Pressable
                style={[styles.confirmBtn, styles.confirmCancel]}
                onPress={() => setResetConfirmOpen(false)}
                testID="reset-cancel-button"
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, styles.confirmDestructive]}
                onPress={handleResetProgress}
                testID="reset-confirm-button"
              >
                <Text style={styles.confirmDestructiveText}>Reset</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
    },
    scrollContent: {
      paddingTop: 8,
      paddingBottom: 32,
    },
    pageTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: c.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 16,
    },
    streakCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 16,
      paddingHorizontal: 18,
      marginBottom: 24,
    },
    streakTextCol: {},
    streakNumber: {
      fontSize: 20,
      fontWeight: "700",
      color: c.textPrimary,
    },
    streakLabel: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 2,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 10,
      marginTop: 4,
    },
    statRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
    },
    statTile: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 14,
      alignItems: "center",
    },
    statValue: {
      fontSize: 18,
      fontWeight: "700",
      color: c.textPrimary,
    },
    statLabel: {
      fontSize: 11,
      color: c.textMuted,
      marginTop: 4,
      textAlign: "center",
    },
    accuracyLine: {
      fontSize: 12,
      color: c.textMuted,
      marginBottom: 24,
    },
    accuracyValue: {
      color: c.textPrimary,
      fontWeight: "700",
    },
    chartCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
      marginBottom: 24,
    },
    chartRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      height: 90,
    },
    chartBarCol: {
      flex: 1,
      alignItems: "center",
      height: "100%",
      justifyContent: "flex-end",
    },
    chartBarTrack: {
      width: 14,
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderRadius: 7,
      justifyContent: "flex-end",
      overflow: "hidden",
    },
    chartBarFill: {
      width: "100%",
      backgroundColor: c.textFaint,
      borderRadius: 7,
    },
    chartBarFillToday: {
      backgroundColor: c.accent,
    },
    chartBarLabel: {
      fontSize: 10,
      color: c.textMuted,
      marginTop: 6,
    },
    chartCaption: {
      fontSize: 11,
      color: c.textFaint,
      textAlign: "center",
      marginTop: 10,
    },
    weekSummaryRow: {
      marginTop: 8,
      alignItems: "center",
    },
    weekSummaryText: {
      fontSize: 12,
      color: c.textSecondary,
      fontWeight: "500",
    },
    emptyHint: {
      fontSize: 13,
      color: c.textMuted,
      marginBottom: 24,
      lineHeight: 19,
    },
    weakList: {
      marginBottom: 24,
    },
    weakRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 8,
      gap: 12,
    },
    weakWordCol: {
      flexShrink: 1,
    },
    weakGerman: {
      fontSize: 15,
      fontWeight: "700",
      color: c.accent,
    },
    weakEnglish: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 2,
    },
    weakMissBadge: {
      backgroundColor: c.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    weakMissText: {
      fontSize: 11,
      fontWeight: "600",
      color: c.textSecondary,
    },
    settingsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 24,
    },
    settingsTextCol: {
      flexShrink: 1,
    },
    settingsLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textPrimary,
    },
    settingsValue: {
      fontSize: 12,
      color: c.textMuted,
      marginTop: 2,
    },
    removeKeyText: {
      fontSize: 13,
      fontWeight: "700",
      color: c.danger,
    },
    resetButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 14,
      marginBottom: 4,
    },
    resetText: {
      color: c.danger,
      fontSize: 14,
      fontWeight: "600",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    confirmSheet: {
      backgroundColor: c.surface,
      marginHorizontal: 32,
      marginBottom: "auto",
      marginTop: "auto",
      borderRadius: 20,
      padding: 24,
    },
    confirmTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: c.textPrimary,
      marginBottom: 8,
    },
    confirmBody: {
      fontSize: 14,
      color: c.textSecondary,
      lineHeight: 20,
      marginBottom: 20,
    },
    confirmButtons: {
      flexDirection: "row",
      gap: 10,
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
    },
    confirmCancel: {
      backgroundColor: c.surfaceAlt,
    },
    confirmCancelText: {
      color: c.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    confirmDestructive: {
      backgroundColor: c.danger,
    },
    confirmDestructiveText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
    },
  });
