import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ALL_CATEGORY, VocabWord } from "@/src/models/vocab";
import {
  loadReviewedIds,
  resetReviewed,
  saveReviewedIds,
} from "@/src/services/progress-service";
import {
  getCategories,
  loadVocabulary,
  selectWords,
} from "@/src/services/vocabulary-service";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 60;
const SWIPE_OUT_DURATION = 180;

export default function Index() {
  const allWords = useMemo(() => loadVocabulary(), []);
  const categories = useMemo(() => getCategories(allWords), [allWords]);

  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const [filteredWords, setFilteredWords] = useState<VocabWord[]>(() =>
    selectWords(allWords, ALL_CATEGORY),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<number>>(new Set());
  const [reviewedLoaded, setReviewedLoaded] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;

  // Load persisted progress on mount.
  useEffect(() => {
    (async () => {
      const ids = await loadReviewedIds();
      setReviewedIds(new Set(ids));
      setReviewedLoaded(true);
    })();
  }, []);

  // Persist reviewed IDs whenever they change (after initial load).
  useEffect(() => {
    if (!reviewedLoaded) return;
    saveReviewedIds(Array.from(reviewedIds));
  }, [reviewedIds, reviewedLoaded]);

  const currentWord: VocabWord | undefined = filteredWords[currentIndex];

  const goTo = (direction: "next" | "prev") => {
    if (filteredWords.length === 0) return;
    const outX = direction === "next" ? -SCREEN_WIDTH : SCREEN_WIDTH;
    Animated.timing(translateX, {
      toValue: outX,
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: true,
    }).start(() => {
      setRevealed(false);
      setCurrentIndex((idx) => {
        const len = filteredWords.length;
        return direction === "next" ? (idx + 1) % len : (idx - 1 + len) % len;
      });
      translateX.setValue(-outX);
      Animated.timing(translateX, {
        toValue: 0,
        duration: SWIPE_OUT_DURATION,
        useNativeDriver: true,
      }).start();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_THRESHOLD) {
          goTo("next");
        } else if (g.dx > SWIPE_THRESHOLD) {
          goTo("prev");
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const handleCardTap = () => {
    if (!currentWord) return;
    if (!revealed) {
      setRevealed(true);
      if (!reviewedIds.has(currentWord.id)) {
        setReviewedIds((prev) => {
          const next = new Set(prev);
          next.add(currentWord.id);
          return next;
        });
      }
    } else {
      setRevealed(false);
    }
  };

  const handleSelectCategory = (cat: string) => {
    setCategory(cat);
    setFilteredWords(selectWords(allWords, cat));
    setCurrentIndex(0);
    setRevealed(false);
    translateX.setValue(0);
    setPickerOpen(false);
  };

  const handleReset = async () => {
    await resetReviewed();
    setReviewedIds(new Set());
    setRevealed(false);
    setResetConfirmOpen(false);
  };

  const total = allWords.length;
  const reviewedCount = reviewedIds.size;
  const percent = total === 0 ? 0 : Math.round((reviewedCount / total) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.container} testID="home-screen">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title} testID="app-title">
            German Vocabulary
          </Text>
          <View style={styles.progressRow}>
            <Text style={styles.progressText} testID="progress-text">
              {reviewedCount} / {total} reviewed
            </Text>
            <Text style={styles.percentText} testID="progress-percent">
              {percent}%
            </Text>
          </View>
          <View style={styles.progressBarTrack} testID="progress-bar">
            <View
              style={[styles.progressBarFill, { width: `${percent}%` }]}
              testID="progress-bar-fill"
            />
          </View>
        </View>

        {/* Category dropdown */}
        <Pressable
          style={styles.dropdown}
          onPress={() => setPickerOpen(true)}
          testID="category-dropdown"
        >
          <Text style={styles.dropdownLabel}>Category</Text>
          <View style={styles.dropdownValueRow}>
            <Text style={styles.dropdownValue} testID="category-value">
              {category}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#111" />
          </View>
        </Pressable>

        {/* Card area */}
        <View style={styles.cardArea}>
          {currentWord ? (
            <Animated.View
              style={[styles.cardWrap, { transform: [{ translateX }] }]}
              {...panResponder.panHandlers}
              testID="vocab-card-wrap"
            >
              <Pressable
                onPress={handleCardTap}
                style={styles.card}
                testID="vocab-card"
              >
                <Text style={styles.categoryTag} testID="card-category">
                  {currentWord.category}
                </Text>
                <Text
                  style={styles.cardEnglish}
                  testID="card-english"
                  numberOfLines={2}
                  adjustsFontSizeToFit
                >
                  {currentWord.english}
                </Text>
                {revealed ? (
                  <Text
                    style={styles.cardGerman}
                    testID="card-german"
                    numberOfLines={2}
                    adjustsFontSizeToFit
                  >
                    {currentWord.german}
                  </Text>
                ) : (
                  <Text style={styles.tapHint} testID="card-hint">
                    Tap to reveal
                  </Text>
                )}
                {reviewedIds.has(currentWord.id) ? (
                  <View style={styles.reviewedBadge} testID="reviewed-badge">
                    <Ionicons name="checkmark" size={12} color="#1a7f37" />
                    <Text style={styles.reviewedBadgeText}>Reviewed</Text>
                  </View>
                ) : null}
              </Pressable>
            </Animated.View>
          ) : (
            <View style={styles.emptyState} testID="empty-state">
              <Text style={styles.emptyText}>No words in this category.</Text>
            </View>
          )}
        </View>

        {/* Swipe hint + counter */}
        <View style={styles.footerRow}>
          <View style={styles.swipeHint}>
            <Ionicons name="chevron-back" size={14} color="#8a8a8a" />
            <Text style={styles.swipeHintText}>swipe</Text>
            <Ionicons name="chevron-forward" size={14} color="#8a8a8a" />
          </View>
          {filteredWords.length > 0 ? (
            <Text style={styles.counterText} testID="card-counter">
              {currentIndex + 1} / {filteredWords.length}
            </Text>
          ) : null}
        </View>

        {/* Reset */}
        <Pressable
          style={styles.resetButton}
          onPress={() => setResetConfirmOpen(true)}
          testID="reset-button"
        >
          <Ionicons name="refresh" size={16} color="#b42318" />
          <Text style={styles.resetText}>Reset Progress</Text>
        </Pressable>
      </View>

      {/* Category picker modal */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPickerOpen(false)}
          testID="picker-backdrop"
        >
          <Pressable style={styles.pickerSheet} testID="picker-sheet">
            <Text style={styles.pickerTitle}>Select Category</Text>
            <FlatList
              data={categories}
              keyExtractor={(c) => c}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.pickerItem,
                    item === category && styles.pickerItemActive,
                  ]}
                  onPress={() => handleSelectCategory(item)}
                  testID={`picker-item-${item}`}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      item === category && styles.pickerItemTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                  {item === category ? (
                    <Ionicons name="checkmark" size={18} color="#111" />
                  ) : null}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reset confirmation modal */}
      <Modal
        visible={resetConfirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setResetConfirmOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmSheet} testID="reset-confirm-sheet">
            <Text style={styles.confirmTitle}>Reset Progress?</Text>
            <Text style={styles.confirmBody}>
              This will clear all reviewed words. This cannot be undone.
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
                onPress={handleReset}
                testID="reset-confirm-button"
              >
                <Text style={styles.confirmDestructiveText}>Reset</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f5f5f7",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    marginTop: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111",
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: "#5a5a5a",
    fontWeight: "500",
  },
  percentText: {
    fontSize: 14,
    color: "#111",
    fontWeight: "700",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#e5e5ea",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#111",
    borderRadius: 3,
  },
  dropdown: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ececef",
    marginBottom: 16,
  },
  dropdownLabel: {
    fontSize: 13,
    color: "#8a8a8a",
    fontWeight: "500",
  },
  dropdownValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dropdownValue: {
    fontSize: 15,
    color: "#111",
    fontWeight: "600",
  },
  cardArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cardWrap: {
    width: "100%",
    aspectRatio: 0.78,
    maxHeight: "100%",
  },
  card: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#ececef",
  },
  categoryTag: {
    position: "absolute",
    top: 18,
    left: 20,
    fontSize: 12,
    fontWeight: "600",
    color: "#8a8a8a",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  cardEnglish: {
    fontSize: 44,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
    letterSpacing: -1,
  },
  cardGerman: {
    marginTop: 24,
    fontSize: 30,
    fontWeight: "600",
    color: "#2b6cb0",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  tapHint: {
    marginTop: 24,
    fontSize: 13,
    color: "#b5b5bd",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  reviewedBadge: {
    position: "absolute",
    top: 18,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e6f4ea",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  reviewedBadgeText: {
    fontSize: 11,
    color: "#1a7f37",
    fontWeight: "600",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#8a8a8a",
    fontSize: 15,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  swipeHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  swipeHintText: {
    color: "#8a8a8a",
    fontSize: 12,
    marginHorizontal: 4,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  counterText: {
    color: "#8a8a8a",
    fontSize: 13,
    fontWeight: "500",
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
    color: "#b42318",
    fontSize: 14,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  pickerSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: "60%",
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 12,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickerItemActive: {
    backgroundColor: "#f5f5f7",
  },
  pickerItemText: {
    fontSize: 16,
    color: "#111",
    fontWeight: "500",
  },
  pickerItemTextActive: {
    fontWeight: "700",
  },
  confirmSheet: {
    backgroundColor: "#fff",
    marginHorizontal: 32,
    marginBottom: "auto",
    marginTop: "auto",
    borderRadius: 20,
    padding: 24,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },
  confirmBody: {
    fontSize: 14,
    color: "#5a5a5a",
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
    backgroundColor: "#f0f0f2",
  },
  confirmCancelText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "600",
  },
  confirmDestructive: {
    backgroundColor: "#b42318",
  },
  confirmDestructiveText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
