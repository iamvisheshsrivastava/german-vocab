import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useSpeak } from "@/src/hooks/use-speak";
import { saveQuizResult } from "@/src/services/quiz-history-service";
import { recordMissedWords, recordTestCompleted } from "@/src/services/stats-service";
import { generateQuestions, QuizQuestion } from "@/src/services/quiz-service";
import { loadVocabulary } from "@/src/services/vocabulary-service";
import { ThemeColors, useThemeColors } from "@/src/theme/colors";

// Once fewer than this many unanswered questions remain in the queue, a
// fresh shuffled batch is appended — so the test can run for as long as the
// user wants without ever "running out" of questions.
const REFILL_THRESHOLD = 5;

type Phase = "active" | "complete";

type WrongAnswer = {
  question: QuizQuestion;
  yourAnswer: string;
};

export function TestScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const allWords = useMemo(() => loadVocabulary(), []);
  const { speak, unavailable: speechUnavailable } = useSpeak();

  const [phase, setPhase] = useState<Phase>("active");
  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    generateQuestions(allWords, allWords.length),
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState({ correct: 0, answered: 0 });
  const wrongAnswersRef = useRef<WrongAnswer[]>([]);
  const [completedSummary, setCompletedSummary] = useState<{
    correct: number;
    answered: number;
    wrong: WrongAnswer[];
  } | null>(null);

  const currentQuestion: QuizQuestion | undefined = questions[currentIndex];

  // Stop any in-progress speech when the screen unmounts.
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  // Keep the question queue topped up so answering never hits a dead end —
  // the user decides when they're done via "End Test", not the pool size.
  useEffect(() => {
    if (allWords.length === 0) return;
    if (questions.length - currentIndex <= REFILL_THRESHOLD) {
      setQuestions((prev) => [...prev, ...generateQuestions(allWords, allWords.length)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, allWords.length]);

  const handleSpeakOption = (option: string) => {
    speak(option);
  };

  const startNewTest = () => {
    Speech.stop();
    setQuestions(generateQuestions(allWords, allWords.length));
    wrongAnswersRef.current = [];
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswered(false);
    setScore({ correct: 0, answered: 0 });
    setCompletedSummary(null);
    setPhase("active");
  };

  const handleSelectOption = (option: string) => {
    if (answered || !currentQuestion) return;
    const isCorrect = option === currentQuestion.correctAnswer;
    setSelectedOption(option);
    setAnswered(true);
    setScore((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      answered: prev.answered + 1,
    }));
    if (!isCorrect) {
      wrongAnswersRef.current = [
        ...wrongAnswersRef.current,
        { question: currentQuestion, yourAnswer: option },
      ];
    }
  };

  const handleNext = () => {
    Speech.stop();
    setCurrentIndex((i) => i + 1);
    setSelectedOption(null);
    setAnswered(false);
  };

  const finishTest = () => {
    Speech.stop();
    const wrong = wrongAnswersRef.current;
    const summary = { correct: score.correct, answered: score.answered, wrong };
    setCompletedSummary(summary);
    setPhase("complete");
    recordTestCompleted(summary.correct, summary.answered).catch(() => {});
    recordMissedWords(wrong.map((w) => w.question.word.id)).catch(() => {});
    if (summary.answered > 0) {
      saveQuizResult({
        correct: summary.correct,
        answered: summary.answered,
        timestamp: Date.now(),
      }).catch(() => {});
    }
  };

  if (phase === "complete" && completedSummary) {
    const percent =
      completedSummary.answered === 0
        ? 0
        : Math.round((completedSummary.correct / completedSummary.answered) * 100);
    return (
      <View style={styles.container} testID="test-complete-screen">
        <ScrollView contentContainerStyle={styles.completeScroll}>
          <View style={styles.completeCard}>
            <Ionicons name="trophy" size={40} color={colors.warning} />
            <Text style={styles.completeTitle}>Test Complete</Text>
            <Text style={styles.completeScore} testID="quiz-final-score">
              {completedSummary.correct} / {completedSummary.answered} correct
            </Text>
            <Text style={styles.completePercent}>{percent}%</Text>
          </View>

          {completedSummary.wrong.length > 0 ? (
            <View style={styles.reviewSection}>
              <Text style={styles.reviewTitle}>
                Words to review ({completedSummary.wrong.length})
              </Text>
              {completedSummary.wrong.map((w, i) => (
                <View
                  key={`${w.question.word.id}-${i}`}
                  style={styles.reviewRow}
                  testID={`wrong-answer-${w.question.word.id}`}
                >
                  <View style={styles.reviewWordCol}>
                    <Text style={styles.reviewEnglish} selectable>{w.question.word.english}</Text>
                    <Text style={styles.reviewGerman} selectable>{w.question.word.german}</Text>
                  </View>
                  <View style={styles.reviewYourAnswerCol}>
                    <Text style={styles.reviewYourAnswerLabel}>You answered</Text>
                    <Text style={styles.reviewYourAnswer} numberOfLines={1} selectable>
                      {w.yourAnswer}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : completedSummary.answered > 0 ? (
            <View style={styles.perfectBox}>
              <Ionicons name="sparkles" size={18} color={colors.success} />
              <Text style={styles.perfectText}>Everything correct — great run.</Text>
            </View>
          ) : null}
        </ScrollView>

        <Pressable
          style={styles.startButton}
          onPress={startNewTest}
          testID="quiz-play-again-button"
        >
          <Text style={styles.startButtonText}>Start New Test</Text>
        </Pressable>
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.container} testID="test-empty-screen">
        <Text style={styles.setupSubtitle}>No words available for a test.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="test-active-screen">
      <View style={styles.quizHeader}>
        <Text style={styles.quizProgress} testID="quiz-progress">
          Question {currentIndex + 1}
        </Text>
        <Text style={styles.quizScore} testID="quiz-score">
          {score.correct}/{score.answered} correct
        </Text>
      </View>

      {speechUnavailable ? (
        <View style={styles.speechWarning} testID="speech-unavailable-banner">
          <Ionicons name="alert-circle" size={13} color={colors.warning} />
          <Text style={styles.speechWarningText}>
            No German voice installed — pronunciation may be off
          </Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.quizBody}>
        <View style={styles.promptCard}>
          <Text style={styles.promptLabel}>Translate to German</Text>
          <Text style={styles.promptWord} testID="quiz-prompt-word" selectable>
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

      <View style={styles.footerButtons}>
        {answered ? (
          <Pressable
            style={styles.startButton}
            onPress={handleNext}
            testID="quiz-next-button"
          >
            <Text style={styles.startButtonText}>Next Question</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.endTestButton}
          onPress={finishTest}
          testID="quiz-end-button"
        >
          <Ionicons name="flag" size={16} color={colors.danger} />
          <Text style={styles.endTestButtonText}>End Test</Text>
        </Pressable>
      </View>
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
    setupSubtitle: {
      fontSize: 14,
      color: c.textSecondary,
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
    quizScore: {
      fontSize: 14,
      color: c.textPrimary,
      fontWeight: "700",
    },
    quizBody: {
      flexGrow: 1,
    },
    speechWarning: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.surfaceAlt,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      marginBottom: 12,
    },
    speechWarningText: {
      flexShrink: 1,
      fontSize: 11,
      color: c.textMuted,
      fontWeight: "500",
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
    footerButtons: {
      paddingTop: 10,
      paddingBottom: 4,
      gap: 8,
    },
    startButton: {
      backgroundColor: c.inverseSurface,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
    },
    startButtonText: {
      color: c.inverseText,
      fontSize: 16,
      fontWeight: "700",
    },
    endTestButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
    },
    endTestButtonText: {
      color: c.danger,
      fontSize: 14,
      fontWeight: "600",
    },
    completeScroll: {
      flexGrow: 1,
      paddingBottom: 12,
    },
    completeCard: {
      backgroundColor: c.surface,
      borderRadius: 24,
      paddingVertical: 40,
      alignItems: "center",
      marginBottom: 24,
      marginTop: 16,
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
    reviewSection: {
      marginBottom: 16,
    },
    reviewTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: c.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    reviewRow: {
      backgroundColor: c.surface,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 8,
      gap: 12,
    },
    reviewWordCol: {
      flexShrink: 1,
    },
    reviewEnglish: {
      fontSize: 13,
      color: c.textMuted,
    },
    reviewGerman: {
      fontSize: 16,
      fontWeight: "700",
      color: c.accent,
      marginTop: 2,
    },
    reviewYourAnswerCol: {
      alignItems: "flex-end",
      flexShrink: 1,
    },
    reviewYourAnswerLabel: {
      fontSize: 10,
      color: c.textFaint,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    reviewYourAnswer: {
      fontSize: 14,
      fontWeight: "600",
      color: c.danger,
      marginTop: 2,
    },
    perfectBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.successSurface,
      borderRadius: 14,
      paddingVertical: 16,
      marginBottom: 16,
    },
    perfectText: {
      color: c.success,
      fontSize: 14,
      fontWeight: "600",
    },
  });
