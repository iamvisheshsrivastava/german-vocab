import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ALL_CATEGORY, VocabWord } from "@/src/models/vocab";
import {
  LearnViewMode,
  loadLearnViewMode,
  loadReviewedIds,
  resetReviewed,
  saveLearnViewMode,
  saveReviewedIds,
} from "@/src/services/progress-service";
import {
  getCategories,
  loadVocabulary,
  selectWords,
} from "@/src/services/vocabulary-service";
import { ThemeColors, useThemeColors } from "@/src/theme/colors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 60;
const SWIPE_OUT_DURATION = 180;
const MAX_SEARCH_RESULTS = 30;

export function LearnScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const [viewMode, setViewMode] = useState<LearnViewMode>("toReview");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  // While the search field is focused (keyboard open), hide the flashcard UI
  // instead of squeezing it into the remaining space — that caused the card's
  // fixed aspect ratio to overflow and visually break on Android.
  const searchActive = searchFocused || searchQuery.trim().length > 0;

  const translateX = useRef(new Animated.Value(0)).current;

  // Kept in sync every render so the PanResponder (created once, on the
  // first render) always sees the current word list instead of closing
  // over the initial one.
  const filteredWordsRef = useRef(filteredWords);
  filteredWordsRef.current = filteredWords;

  // Load persisted progress + view mode on mount, then rebuild the initial
  // deck from the loaded values directly (not from state, which wouldn't be
  // visible yet in this same tick).
  useEffect(() => {
    (async () => {
      try {
        const [ids, mode] = await Promise.all([
          loadReviewedIds(),
          loadLearnViewMode(),
        ]);
        const idsSet = new Set(ids);
        setReviewedIds(idsSet);
        setViewMode(mode);
        setFilteredWords(
          selectWords(
            allWords,
            ALL_CATEGORY,
            mode === "toReview" ? idsSet : undefined,
          ),
        );
      } finally {
        setReviewedLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist reviewed IDs whenever they change (after initial load).
  useEffect(() => {
    if (!reviewedLoaded) return;
    saveReviewedIds(Array.from(reviewedIds)).catch(() => {});
  }, [reviewedIds, reviewedLoaded]);

  // Stop any in-progress speech when the screen unmounts.
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const currentWord: VocabWord | undefined = filteredWords[currentIndex];

  const goTo = (direction: "next" | "prev") => {
    if (filteredWordsRef.current.length === 0) return;
    Speech.stop();
    const outX = direction === "next" ? -SCREEN_WIDTH : SCREEN_WIDTH;
    Animated.timing(translateX, {
      toValue: outX,
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: true,
    }).start(() => {
      setRevealed(false);
      setCurrentIndex((idx) => {
        const len = filteredWordsRef.current.length;
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

  // Rebuilds the deck for an explicit action (category change, view-mode
  // toggle, reset) — deliberately not reactive to reviewedIds changes, so
  // marking the current card reviewed mid-session doesn't yank it away.
  const rebuildDeck = (
    cat: string,
    mode: LearnViewMode,
    excluded: Set<number>,
  ) => {
    setFilteredWords(
      selectWords(allWords, cat, mode === "toReview" ? excluded : undefined),
    );
    setCurrentIndex(0);
    setRevealed(false);
    translateX.setValue(0);
  };

  const handleSelectCategory = (cat: string) => {
    Speech.stop();
    setCategory(cat);
    rebuildDeck(cat, viewMode, reviewedIds);
    setPickerOpen(false);
  };

  const handleToggleViewMode = (mode: LearnViewMode) => {
    if (mode === viewMode) return;
    Speech.stop();
    setViewMode(mode);
    saveLearnViewMode(mode).catch(() => {});
    rebuildDeck(category, mode, reviewedIds);
  };

  const handleReset = async () => {
    await resetReviewed();
    Speech.stop();
    setReviewedIds(new Set());
    setCategory(ALL_CATEGORY);
    rebuildDeck(ALL_CATEGORY, viewMode, new Set());
    setResetConfirmOpen(false);
  };

  const handleSpeak = () => {
    if (!currentWord) return;
    Speech.stop();
    Speech.speak(currentWord.german, { language: "de-DE", pitch: 1, rate: 0.9 });
  };

  // Matches against both English and German (searches the whole vocabulary,
  // not just the currently selected category).
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return allWords
      .filter(
        (w) =>
          w.english.toLowerCase().includes(q) ||
          w.german.toLowerCase().includes(q),
      )
      .slice(0, MAX_SEARCH_RESULTS);
  }, [allWords, searchQuery]);

  const handleDismissSearch = () => {
    setSearchQuery("");
    setSearchFocused(false);
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleSelectSearchResult = (word: VocabWord) => {
    handleDismissSearch();
    Speech.stop();
    setCategory(ALL_CATEGORY);
    const newList = selectWords(allWords, ALL_CATEGORY);
    const idx = newList.findIndex((w) => w.id === word.id);
    setFilteredWords(newList);
    setCurrentIndex(idx >= 0 ? idx : 0);
    setRevealed(true);
    translateX.setValue(0);
    // Looking a word up via search is not a "reviewed" signal — leave
    // reviewed state untouched; only the card tap-to-reveal flow sets it.
  };

  // Progress reflects the selected category's words; "All" reflects every word.
  const categoryWords = useMemo(
    () =>
      category === ALL_CATEGORY
        ? allWords
        : allWords.filter((w) => w.category === category),
    [allWords, category],
  );
  const total = categoryWords.length;
  const reviewedCount = categoryWords.reduce(
    (count, w) => (reviewedIds.has(w.id) ? count + 1 : count),
    0,
  );
  const percent = total === 0 ? 0 : Math.round((reviewedCount / total) * 100);
  // Distinguishes "this category has no words at all" from "every word in
  // it has already been reviewed and is hidden by the To review filter".
  const allReviewedInCategory =
    viewMode === "toReview" && total > 0 && filteredWords.length === 0;

  return (
    <>
      <View style={styles.container} testID="home-screen">
        {/* Header */}
        <View style={styles.header}>
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

        {/* Word search */}
        <View
          style={[styles.searchWrap, searchActive && styles.searchWrapActive]}
        >
          <View style={styles.searchInputRow}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search English or German..."
              placeholderTextColor={colors.textFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              autoCorrect={false}
              testID="search-input"
            />
            {searchActive ? (
              <Pressable
                onPress={handleDismissSearch}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                testID="search-clear-button"
              >
                <Ionicons name="close-circle" size={18} color={colors.textFaint} />
              </Pressable>
            ) : null}
          </View>
          {searchActive ? (
            <View style={styles.searchResultsBox} testID="search-results">
              {searchQuery.trim().length === 0 ? (
                <Pressable
                  style={styles.searchEmptyPressable}
                  onPress={handleDismissSearch}
                >
                  <Text style={styles.searchEmptyText}>
                    Start typing to search all {allWords.length} words.
                  </Text>
                </Pressable>
              ) : searchResults.length === 0 ? (
                <Text style={styles.searchEmptyText}>No matching words.</Text>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(w) => String(w.id)}
                  keyboardShouldPersistTaps="handled"
                  style={styles.searchResultsList}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.searchResultRow}
                      onPress={() => handleSelectSearchResult(item)}
                      testID={`search-result-${item.id}`}
                    >
                      <Text
                        style={styles.searchResultGerman}
                        numberOfLines={1}
                      >
                        {item.german}
                      </Text>
                      <Text
                        style={styles.searchResultEnglish}
                        numberOfLines={1}
                      >
                        {item.english}
                      </Text>
                    </Pressable>
                  )}
                />
              )}
            </View>
          ) : null}
        </View>

        {searchActive ? null : (
          <>
            {/* Category dropdown */}
            <Pressable
              style={styles.dropdown}
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Category: ${category}. Tap to change.`}
              testID="category-dropdown"
            >
              <Text style={styles.dropdownLabel}>Category</Text>
              <View style={styles.dropdownValueRow}>
                <Text
                  style={styles.dropdownValue}
                  testID="category-value"
                  numberOfLines={1}
                >
                  {category}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textPrimary} />
              </View>
            </Pressable>

            {/* Learn deck view mode */}
            <View style={styles.viewModeRow} testID="view-mode-toggle">
              <Pressable
                style={[
                  styles.viewModeSegment,
                  viewMode === "toReview" && styles.viewModeSegmentActive,
                ]}
                onPress={() => handleToggleViewMode("toReview")}
                accessibilityRole="button"
                accessibilityLabel="Show words to review"
                accessibilityState={{ selected: viewMode === "toReview" }}
                testID="view-mode-to-review"
              >
                <Text
                  style={[
                    styles.viewModeText,
                    viewMode === "toReview" && styles.viewModeTextActive,
                  ]}
                >
                  To review
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.viewModeSegment,
                  viewMode === "all" && styles.viewModeSegmentActive,
                ]}
                onPress={() => handleToggleViewMode("all")}
                accessibilityRole="button"
                accessibilityLabel="Show all words"
                accessibilityState={{ selected: viewMode === "all" }}
                testID="view-mode-all"
              >
                <Text
                  style={[
                    styles.viewModeText,
                    viewMode === "all" && styles.viewModeTextActive,
                  ]}
                >
                  All
                </Text>
              </Pressable>
            </View>

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
                      <View
                        style={styles.reviewedBadge}
                        testID="reviewed-badge"
                      >
                        <Ionicons name="checkmark" size={12} color={colors.success} />
                        <Text style={styles.reviewedBadgeText}>Reviewed</Text>
                      </View>
                    ) : null}
                    <Pressable
                      style={styles.micButton}
                      onPress={handleSpeak}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Pronounce word"
                      testID="speak-button"
                    >
                      <Ionicons name="volume-high" size={20} color="#fff" />
                    </Pressable>
                  </Pressable>
                </Animated.View>
              ) : (
                <View style={styles.emptyState} testID="empty-state">
                  <Text style={styles.emptyText}>
                    {allReviewedInCategory
                      ? "All caught up! You've reviewed every word here."
                      : "No words in this category."}
                  </Text>
                  {allReviewedInCategory ? (
                    <Pressable
                      style={styles.emptyStateAction}
                      onPress={() => handleToggleViewMode("all")}
                      testID="empty-state-view-all"
                    >
                      <Text style={styles.emptyStateActionText}>
                        View all words
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>

            {/* Swipe hint + counter */}
            <View style={styles.footerRow}>
              <View style={styles.swipeHint}>
                <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
                <Text style={styles.swipeHintText}>swipe</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
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
              <Ionicons name="refresh" size={16} color={colors.danger} />
              <Text style={styles.resetText}>Reset Progress</Text>
            </Pressable>
          </>
        )}
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
                    <Ionicons name="checkmark" size={18} color={colors.textPrimary} />
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
    </>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    header: {
      marginTop: 8,
      marginBottom: 20,
    },
    progressRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      marginBottom: 8,
    },
    progressText: {
      fontSize: 14,
      color: c.textSecondary,
      fontWeight: "500",
    },
    percentText: {
      fontSize: 14,
      color: c.textPrimary,
      fontWeight: "700",
    },
    progressBarTrack: {
      height: 6,
      backgroundColor: c.surfaceAlt,
      borderRadius: 3,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: c.inverseSurface,
      borderRadius: 3,
    },
    searchWrap: {
      marginBottom: 16,
    },
    searchInputRow: {
      backgroundColor: c.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: c.textPrimary,
      paddingVertical: 4,
    },
    searchWrapActive: {
      flex: 1,
      marginBottom: 0,
    },
    searchResultsBox: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      marginTop: 8,
      marginBottom: 16,
      overflow: "hidden",
    },
    searchResultsList: {
      flex: 1,
    },
    searchEmptyPressable: {
      flex: 1,
    },
    searchEmptyText: {
      padding: 16,
      fontSize: 14,
      color: c.textMuted,
      textAlign: "center",
    },
    searchResultRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: 12,
    },
    searchResultGerman: {
      fontSize: 15,
      fontWeight: "600",
      color: c.accent,
      flexShrink: 1,
    },
    searchResultEnglish: {
      fontSize: 14,
      color: c.textSecondary,
      flexShrink: 1,
      textAlign: "right",
    },
    dropdown: {
      backgroundColor: c.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 16,
    },
    dropdownLabel: {
      fontSize: 13,
      color: c.textMuted,
      fontWeight: "500",
    },
    dropdownValueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexShrink: 1,
      marginLeft: 12,
    },
    dropdownValue: {
      fontSize: 15,
      color: c.textPrimary,
      fontWeight: "600",
      flexShrink: 1,
      textAlign: "right",
    },
    viewModeRow: {
      flexDirection: "row",
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      padding: 3,
      marginBottom: 16,
    },
    viewModeSegment: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 9,
      alignItems: "center",
    },
    viewModeSegmentActive: {
      backgroundColor: c.surface,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1,
    },
    viewModeText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textMuted,
    },
    viewModeTextActive: {
      color: c.textPrimary,
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
      backgroundColor: c.surface,
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
      borderColor: c.border,
    },
    categoryTag: {
      position: "absolute",
      top: 18,
      left: 20,
      fontSize: 12,
      fontWeight: "600",
      color: c.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    cardEnglish: {
      fontSize: 44,
      fontWeight: "700",
      color: c.textPrimary,
      textAlign: "center",
      letterSpacing: -1,
    },
    cardGerman: {
      marginTop: 24,
      fontSize: 30,
      fontWeight: "600",
      color: c.accent,
      textAlign: "center",
      letterSpacing: -0.5,
    },
    tapHint: {
      marginTop: 24,
      fontSize: 13,
      color: c.textFaint,
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
      backgroundColor: c.successSurface,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    reviewedBadgeText: {
      fontSize: 11,
      color: c.success,
      fontWeight: "600",
    },
    micButton: {
      position: "absolute",
      bottom: 20,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.accent,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 3,
    },
    emptyState: {
      padding: 40,
      alignItems: "center",
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 15,
      textAlign: "center",
    },
    emptyStateAction: {
      marginTop: 16,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 10,
      backgroundColor: c.inverseSurface,
    },
    emptyStateActionText: {
      color: c.inverseText,
      fontSize: 14,
      fontWeight: "600",
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
      color: c.textMuted,
      fontSize: 12,
      marginHorizontal: 4,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    counterText: {
      color: c.textMuted,
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
      color: c.danger,
      fontSize: 14,
      fontWeight: "600",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    pickerSheet: {
      backgroundColor: c.surface,
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
      color: c.textPrimary,
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
      backgroundColor: c.surfaceAlt,
    },
    pickerItemText: {
      fontSize: 16,
      color: c.textPrimary,
      fontWeight: "500",
    },
    pickerItemTextActive: {
      fontWeight: "700",
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
