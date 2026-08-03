import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LearnScreen } from "@/src/components/LearnScreen";
import { TestScreen } from "@/src/components/TestScreen";

type Tab = "learn" | "test";

export default function Index() {
  const [activeTab, setActiveTab] = useState<Tab>("learn");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.headerRow}>
        <Text style={styles.title} testID="app-title">
          German Vocab
        </Text>
      </View>

      <View style={styles.tabBar} testID="top-tab-bar">
        <Pressable
          style={[styles.tabButton, activeTab === "learn" && styles.tabButtonActive]}
          onPress={() => setActiveTab("learn")}
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111",
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
    backgroundColor: "#eceef2",
  },
  tabButtonActive: {
    backgroundColor: "#111",
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5a5a5a",
  },
  tabButtonTextActive: {
    color: "#fff",
  },
  screen: {
    flex: 1,
  },
  hidden: {
    display: "none",
  },
});
