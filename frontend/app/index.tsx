import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LearnScreen } from "@/src/components/LearnScreen";
import { TestScreen } from "@/src/components/TestScreen";
import { ThemeColors, useThemeColors } from "@/src/theme/colors";

type Tab = "learn" | "test";

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("learn");
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style={colors.isDark ? "light" : "dark"} />
      <View style={styles.headerRow}>
        <Text style={styles.title} testID="app-title">
          German Vocab
        </Text>
      </View>

      <View style={styles.tabBar} testID="top-tab-bar">
        <Pressable
          style={[styles.tabButton, activeTab === "learn" && styles.tabButtonActive]}
          onPress={() => setActiveTab("learn")}
          accessibilityRole="tab"
          accessibilityLabel="Learn tab"
          accessibilityState={{ selected: activeTab === "learn" }}
          testID="tab-learn"
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "learn" && styles.tabButtonTextActive,
            ]}
          >
            Learn
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, activeTab === "test" && styles.tabButtonActive]}
          onPress={() => setActiveTab("test")}
          accessibilityRole="tab"
          accessibilityLabel="Test tab"
          accessibilityState={{ selected: activeTab === "test" }}
          testID="tab-test"
        >
          <Text
            style={[
              styles.tabButtonText,
              activeTab === "test" && styles.tabButtonTextActive,
            ]}
          >
            Test
          </Text>
        </Pressable>
      </View>

      {/* Both screens stay mounted so switching tabs preserves progress. */}
      <View style={[styles.screen, activeTab !== "learn" && styles.hidden]}>
        <LearnScreen />
      </View>
      <View style={[styles.screen, activeTab !== "test" && styles.hidden]}>
        <TestScreen />
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
    },
    title: {
      fontSize: 26,
      fontWeight: "700",
      color: c.textPrimary,
      letterSpacing: -0.5,
    },
    tabBar: {
      flexDirection: "row",
      paddingHorizontal: 20,
      paddingTop: 14,
      gap: 8,
    },
    tabButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
    },
    tabButtonActive: {
      backgroundColor: c.inverseSurface,
    },
    tabButtonText: {
      fontSize: 14,
      fontWeight: "700",
      color: c.textSecondary,
    },
    tabButtonTextActive: {
      color: c.inverseText,
    },
    screen: {
      flex: 1,
    },
    hidden: {
      display: "none",
    },
  });
