import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ALL_CATEGORY } from "@/src/models/vocab";
import {
  loadLastQuizResult,
  QuizResult,
  saveQuizResult,
} from "@/src/services/quiz-history-service";
import { generateQuestions, QuizQuestion } from "@/src/services/quiz-service";
import {
  getCategories,
  loadVocabulary,
} from "@/src/services/vocabulary-service";
import { ThemeColors, useThemeColors } from "@/src/theme/colors";

function formatQuizDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const QUICK_COUNTS = [10, 20, 30, 100, 200];
const DEFAULT_COUNT = 10;

type Phase = "setup" | "active" | "complete";

export function TestScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const allWords = useMemo(() => loadVocabulary(), []);
  const categories = useMemo(() => getCategories(allWords), [allWords]);

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedCount, setSelectedCount] = useState(DEFAULT_COUNT);
  const [customText, setCustomText] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORY);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const questionPool = useMemo(
    () =>
      category === ALL_CATEGORY
        ? allWords
        : allWords.filter((w) => w.category === category),
    [allWords, category],
  );

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState({ correct: 0, answered: 0 });
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);

  const currentQuestion: QuizQuestion | undefined = questions[currentIndex];

  // Stop any in-progress speech when the screen unmounts.
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  // Load the most recent persisted quiz result once on mount, so the setup
  // screen can show it even before the user starts a new quiz.
  useEffect(() => {
    loadLastQuizResult()
      .then(setLastResult)
      .catch(() => {});
  }, []);

  const handleSpeakOption = (option: string) => {
    Speech.stop();
    Speech.speak(option, { language: "de-DE", pitch: 1, rate: 0.9 });
  };

  const startQuiz = (count: number) => {
    const clamped = Math.max(1, Math.min(count, questionPool.length));
    setQuestions(generateQuestions(questionPool, clamped));
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswered(false);
    setScore({ correct: 0, answered: 0 });
    setPhase("active");
  };

  const handleSelectCategory = (cat: string) => {
    setCategory(cat);
    setCategoryPickerOpen(false);
  };

  const handleQuickCount = (count: number) => {
    setSelectedCount(count);
    setCustomText("");
  };

  const handleCustomChange = (text: string) => {
    const digitsOnly = text.replace(/[^0-9]/g, "");
    setCustomText(digitsOnly);
    if (digitsOnly.length > 0) {
      setSelectedCount(parseInt(digitsOnly, 10));
    }
  };

  const handleSelectOption = (option: string) => {
    if (answered || !currentQuestion) return;
    setSelectedOption(option);
    setAnswered(true);
    setScore((prev) => ({
      correct: prev.correct + (option === currentQuestion.correctAnswer ? 1 : 0),
      answered: prev.answered + 1,
    }));
  };

  const handleNext = () => {
    Speech.stop();
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
      setSelectedOption(null);
      setAnswered(false);
    } else {
      setPhase("complete");
      const result: QuizResult = { ...score, timestamp: Date.now() };
      setLastResult(result);
      saveQuizResult(result).catch(() => {});
    }
  };

  const handleRestart = () => {
    Speech.stop();
    setPhase("setup");
    setQuestions([]);
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswered(false);
    setScore({ correct: 0, answered: 0 });
  };

  const handlePlayAgain = () => {
    startQuiz(questions.length || selectedCount);
  };

  if (phase === "setup") {
    // Same fallback (DEFAULT_COUNT, not 1) used for both the hint text and
    // the actual quiz start so what's displayed always matches what happens
    // — a customText of "0" previously showed "1 question" but started a
    // DEFAULT_COUNT-question quiz.
    const effectiveCount = Math.max(
      1,
      Math.min(selectedCount || DEFAULT_COUNT, questionPool.length),
    );
    return (
      <>
      <View style={styles.container} testID="test-setup-screen">
        <Text style={styles.setupTitle}>Test Yourself</Text>
        <Text style={styles.setupSubtitle}>
          Multiple-choice quiz — pick the correct German translation.
        </Text>

        {lastResult ? (
          <Text style={styles.lastResultText} testID="quiz-last-result">
            Last score: {lastResult.correct}/{lastResult.answered} (
            {formatQuizDate(lastResult.timestamp)})
          </Text>
        ) : null}

        <Text style={styles.setupLabel}>Category</Text>
        <Pressable
          style={styles.categoryDropdown}
          onPress={() => setCategoryPickerOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Category: ${category}. Tap to change.`}
          testID="quiz-category-dropdown"
        >
          <Text style={styles.categoryDropdownValue} numberOfLines={1}>
            {category}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textPrimary} />
        </Pressable>

        <Text style={styles.setupLabel}>How many questions?</Text>
        <View style={styles.quickCountRow}>
          {QUICK_COUNTS.map((count) => (
            <Pressable
              key={count}
              style={[
                styles.quickCountChip,
                selectedCount === count &&
                  customText === "" &&
                  styles.quickCountChipActive,
              ]}
              onPress={() => handleQuickCount(count)}
              accessibilityRole="button"
              accessibilityLabel={`${count} questions`}
              accessibilityState={{
                selected: selectedCount === count && customText === "",
              }}
              testID={`quiz-count-${count}`}
            >
              <Text
                style={[
                  styles.quickCountText,
                  selectedCount === count &&
                    customText === "" &&
                    styles.quickCountTextActive,
                ]}
              >
                {count}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.setupLabel}>Or enter a custom number</Text>
        <TextInput
          style={styles.customInput}
          value={customText}
          onChangeText={handleCustomChange}
          placeholder="e.g. 50"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          testID="quiz-custom-count-input"
        />

        <Text style={styles.setupHint}>
          {effectiveCount} question
          {effectiveCount === 1 ? "" : "s"} out of {questionPool.length} words
          available
          {category === ALL_CATEGORY ? "" : ` in ${category}`}.
        </Text>

        <Pressable
          style={[
            styles.startButton,
            questionPool.length === 0 && styles.startButtonDisabled,
          ]}
          onPress={() => startQuiz(effectiveCount)}
          disabled={questionPool.length === 0}
          testID="quiz-start-button"
        >
          <Text style={styles.startButtonText}>Start Test</Text>
        </Pressable>
      </View>

      <Modal
        visible={categoryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setCategoryPickerOpen(false)}
          testID="quiz-category-picker-backdrop"
        >
          <Pressable style={styles.pickerSheet} testID="quiz-category-picker-sheet">
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
                  testID={`quiz-category-picker-item-${item}`}
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
      </>
    );
  }

  if (phase === "complete") {
    const percent =
      score.answered === 0
        ? 0
        : Math.round((score.correct / score.answered) * 100);
    return (
      <View style={styles.container} testID="test-complete-screen">
        <View style={styles.completeCard}>
          <Ionicons name="trophy" size={40} color={colors.warning} />
          <Text style={styles.completeTitle}>Quiz Complete!</Text>
          <Text style={styles.completeScore} testID="quiz-final-score">
            {score.correct} / {score.answered} correct
          </Text>
          <Text style={styles.completePercent}>{percent}%</Text>
        </View>
        <Pressable
          style={styles.startButton}
          onPress={handlePlayAgain}
          testID="quiz-play-again-button"
        >
          <Text style={styles.startButtonText}>Play Again</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={handleRestart}
          testID="quiz-change-settings-button"
        >
          <Text style={styles.secondaryButtonText}>Change Question Count</Text>
        </Pressable>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.container} testID="test-empty-screen">
        <Text style={styles.setupSubtitle}>No words available for a quiz.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="test-active-screen">
      <View style={styles.quizHeader}>
        <Text style={styles.quizProgress} testID="quiz-progress">
          Question {currentIndex + 1} / {questions.length}
        </Text>
        <View style={styles.quizHeaderRight}>
          <Text style={styles.quizScore} testID="quiz-score">
            {score.correct}/{score.answered} correct
          </Text>
          <Pressable
            style={styles.restartIconButton}
            onPress={handleRestart}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Restart quiz"
            testID="quiz-restart-button"
          >
            <Ionicons name="refresh" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.quizBody}>
        <View style={styles.promptCard}>
          <Text style={styles.promptLabel}>Translate to German</Text>
          <Text style={styles.promptWord} testID="quiz-prompt-word">
            {currentQuestion.word.english}
          </Text>
        </View>

        <View style={styles.optionsList}>
          {currentQuestion.options.map((option) => {
            const isCorrect = option === currentQuestion.correctAnswer;
            const isSelected = option === selectedOption;
            const showCorrect = answered && isCorrect;
            const showWrong = answered && isSelected && !isCorrect;
            return (
              <Pressable
                key={option}
                style={[
                  styles.optionButton,
                  showCorrect && styles.optionCorrect,
                  showWrong && styles.optionWrong,
                ]}
                onPress={() => handleSelectOption(option)}
                disabled={answered}
                accessibilityRole="button"
                accessibilityLabel={option}
                accessibilityState={{ selected: isSelected, disabled: answered }}
                testID={`quiz-option-${option}`}
              >
                <Text
                  style={[
                    styles.optionText,
                    (showCorrect || showWrong) && styles.optionTextActive,
                  ]}
                >
                  {option}
                </Text>
                <View style={styles.optionRightIcons}>
                  <Pressable
                    style={styles.optionSpeakButton}
                    onPress={() => handleSpeakOption(option)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Pronounce ${option}`}
                    testID={`quiz-option-speak-${option}`}
                  >
                    <Ionicons
                      name="volume-high"
                      size={18}
                      color={showCorrect || showWrong ? "#fff" : colors.textMuted}
                    />
                  </Pressable>
                  {showCorrect ? (
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  ) : null}
                  {showWrong ? (
                    <Ionicons name="close-circle" size={20} color="#fff" />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {answered ? (
        <Pressable
          style={styles.startButton}
          onPress={handleNext}
          testID="quiz-next-button"
        >
          <Text style={styles.startButtonText}>
            {currentIndex + 1 < questions.length ? "Next Question" : "See Results"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 16,
    },
    setupTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: c.textPrimary,
      letterSpacing: -0.5,
      marginBottom: 6,
    },
    setupSubtitle: {
      fontSize: 14,
      color: c.textSecondary,
      marginBottom: 24,
    },
    lastResultText: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textMuted,
      marginBottom: 20,
    },
    setupLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: c.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    categoryDropdown: {
      backgroundColor: c.surface,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 24,
    },
    categoryDropdownValue: {
      fontSize: 15,
      color: c.textPrimary,
      fontWeight: "600",
      flexShrink: 1,
    },
    quickCountRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 24,
    },
    quickCountChip: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: "center",
    },
    quickCountChipActive: {
      backgroundColor: c.inverseSurface,
      borderColor: c.inverseSurface,
    },
    quickCountText: {
      fontSize: 16,
      fontWeight: "700",
      color: c.textPrimary,
    },
    quickCountTextActive: {
      color: c.inverseText,
    },
    customInput: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: c.textPrimary,
      marginBottom: 12,
    },
    setupHint: {
      fontSize: 13,
      color: c.textMuted,
      marginBottom: 28,
    },
    startButton: {
      backgroundColor: c.inverseSurface,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      marginBottom: 10,
    },
    startButtonDisabled: {
      opacity: 0.4,
    },
    startButtonText: {
      color: c.inverseText,
      fontSize: 16,
      fontWeight: "700",
    },
    secondaryButton: {
      paddingVertical: 14,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: c.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
    completeCard: {
      backgroundColor: c.surface,
      borderRadius: 24,
      paddingVertical: 40,
      alignItems: "center",
      marginBottom: 24,
      marginTop: 40,
      borderWidth: 1,
      borderColor: c.border,
    },
    completeTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: c.textPrimary,
      marginTop: 12,
    },
    completeScore: {
      fontSize: 28,
      fontWeight: "700",
      color: c.textPrimary,
      marginTop: 16,
    },
    completePercent: {
      fontSize: 15,
      color: c.textMuted,
      marginTop: 4,
      fontWeight: "600",
    },
    quizHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    quizProgress: {
      fontSize: 14,
      color: c.textSecondary,
      fontWeight: "600",
    },
    quizHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    quizScore: {
      fontSize: 14,
      color: c.textPrimary,
      fontWeight: "700",
    },
    restartIconButton: {
      padding: 4,
    },
    quizBody: {
      flexGrow: 1,
    },
    promptCard: {
      backgroundColor: c.surface,
      borderRadius: 20,
      paddingVertical: 32,
      paddingHorizontal: 20,
      alignItems: "center",
      marginBottom: 24,
      borderWidth: 1,
      borderColor: c.border,
    },
    promptLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: c.textMuted,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 12,
    },
    promptWord: {
      fontSize: 36,
      fontWeight: "700",
      color: c.textPrimary,
      textAlign: "center",
      letterSpacing: -0.5,
    },
    optionsList: {
      gap: 12,
    },
    optionButton: {
      backgroundColor: c.surface,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 18,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    optionCorrect: {
      backgroundColor: c.success,
      borderColor: c.success,
    },
    optionWrong: {
      backgroundColor: c.danger,
      borderColor: c.danger,
    },
    optionText: {
      fontSize: 16,
      fontWeight: "600",
      color: c.textPrimary,
      flexShrink: 1,
    },
    optionTextActive: {
      color: "#fff",
    },
    optionRightIcons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    optionSpeakButton: {
      padding: 4,
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
  });
