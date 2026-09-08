import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AskScreen } from "@/src/components/AskScreen";
import { LearnScreen } from "@/src/components/LearnScreen";
import { StatsScreen } from "@/src/components/StatsScreen";
import { TestScreen } from "@/src/components/TestScreen";
import { recordActiveSeconds } from "@/src/services/stats-service";
import { ThemeColors, useThemeColors } from "@/src/theme/colors";

type Tab = "learn" | "test" | "ask" | "stats";

const TABS: {
  key: Tab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "learn", label: "Learn", icon: "book-outline", iconActive: "book" },
  { key: "test", label: "Test", icon: "checkmark-done-outline", iconActive: "checkmark-done" },
  { key: "ask", label: "Ask", icon: "chatbubble-ellipses-outline", iconActive: "chatbubble-ellipses" },
  { key: "stats", label: "Stats", icon: "stats-chart-outline", iconActive: "stats-chart" },
];

// Flushes accumulated foreground time to stats-service — periodically while
// active (so a long session or an outright app kill doesn't lose it all)
// and immediately on backgrounding.
function useActiveTimeTracking() {
  const activeSinceRef = useRef<number | null>(Date.now());

  useEffect(() => {
    const flush = () => {
      if (activeSinceRef.current === null) return;
      const elapsedSeconds = (Date.now() - activeSinceRef.current) / 1000;
      activeSinceRef.current = null;
      recordActiveSeconds(elapsedSeconds).catch(() => {});
    };
    const restart = () => {
      activeSinceRef.current = Date.now();
    };

    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        restart();
      } else {
        flush();
      }
    });

    const interval = setInterval(() => {
      if (activeSinceRef.current !== null) {
        flush();
        restart();
      }
    }, 60_000);

    return () => {
      flush();
      subscription.remove();
      clearInterval(interval);
    };
  }, []);
}

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("learn");
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useActiveTimeTracking();

  // Every screen stays permanently mounted (see below), so their own
  // unmount-cleanup Speech.stop() calls never fire on a tab switch. Stop any
  // in-progress speech explicitly whenever the active tab changes so audio
  // from the tab being left behind doesn't keep playing.
  useEffect(() => {
    Speech.stop();
  }, [activeTab]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style={colors.isDark ? "light" : "dark"} />
      <View style={styles.headerRow}>
        <Text style={styles.title} testID="app-title">
          German Vocab
        </Text>
      </View>

      {/* Every screen stays mounted so switching tabs preserves progress. */}
      <View style={[styles.screen, activeTab !== "learn" && styles.hidden]}>
        <LearnScreen />
      </View>
      <View style={[styles.screen, activeTab !== "test" && styles.hidden]}>
        <TestScreen />
      </View>
      <View style={[styles.screen, activeTab !== "ask" && styles.hidden]}>
        <AskScreen />
      </View>
      <View style={[styles.screen, activeTab !== "stats" && styles.hidden]}>
        <StatsScreen active={activeTab === "stats"} />
      </View>

      <View style={styles.tabBar} testID="bottom-tab-bar">
        {TABS.map(({ key, label, icon, iconActive }) => {
          const selected = activeTab === key;
          return (
            <Pressable
              key={key}
              style={styles.tabButton}
              onPress={() => setActiveTab(key)}
              accessibilityRole="tab"
              accessibilityLabel={`${label} tab`}
              accessibilityState={{ selected }}
              testID={`tab-${key}`}
            >
              <Ionicons
                name={selected ? iconActive : icon}
                size={22}
                color={selected ? colors.accent : colors.textMuted}
              />
              <Text style={[styles.tabButtonText, selected && styles.tabButtonTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: c.background,
    },
    headerRow: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: c.textPrimary,
      letterSpacing: -0.5,
    },
    screen: {
      flex: 1,
    },
    hidden: {
      display: "none",
    },
    tabBar: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.background,
      paddingTop: 8,
      paddingBottom: 6,
    },
    tabButton: {
      flex: 1,
      alignItems: "center",
      gap: 3,
      paddingVertical: 4,
    },
    tabButtonText: {
      fontSize: 11,
      fontWeight: "600",
      color: c.textMuted,
    },
    tabButtonTextActive: {
      color: c.accent,
    },
  });
