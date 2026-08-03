import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { generateQuestions, QuizQuestion } from "@/src/services/quiz-service";
import { loadVocabulary } from "@/src/services/vocabulary-service";

const QUICK_COUNTS = [10, 20, 30, 100];
const DEFAULT_COUNT = 10;

type Phase = "setup" | "active" | "complete";

export function TestScreen() {
  const allWords = useMemo(() => loadVocabulary(), []);

  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedCount, setSelectedCount] = useState(DEFAULT_COUNT);
  const [customText, setCustomText] = useState("");

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState({ correct: 0, answered: 0 });

  const currentQuestion: QuizQuestion | undefined = questions[currentIndex];

  // Stop any in-progress speech when the screen unmounts.
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const handleSpeakOption = (option: string) => {
    Speech.stop();
    Speech.speak(option, { language: "de-DE", pitch: 1, rate: 0.9 });
  };

  const startQuiz = (count: number) => {
    const clamped = Math.max(1, Math.min(count, allWords.length));
    setQuestions(generateQuestions(allWords, clamped));
    setCurrentIndex(0);
    setSelectedOption(null);
    setAnswered(false);
    setScore({ correct: 0, answered: 0 });
    setPhase("active");
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
    return (
      <View style={styles.container} testID="test-setup-screen">
        <Text style={styles.setupTitle}>Test Yourself</Text>
        <Text style={styles.setupSubtitle}>
          Multiple-choice quiz — pick the correct German translation.
        </Text>

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
          placeholderTextColor="#b5b5bd"
          keyboardType="number-pad"
          testID="quiz-custom-count-input"
        />

        <Text style={styles.setupHint}>
          {Math.max(1, Math.min(selectedCount || 1, allWords.length))} question
          {Math.max(1, Math.min(selectedCount || 1, allWords.length)) === 1
            ? ""
            : "s"}{" "}
          out of {allWords.length} words available.
        </Text>

        <Pressable
          style={styles.startButton}
          onPress={() => startQuiz(selectedCount || DEFAULT_COUNT)}
          testID="quiz-start-button"
        >
          <Text style={styles.startButtonText}>Start Test</Text>
        </Pressable>
      </View>
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
          <Ionicons name="trophy" size={40} color="#c9960c" />
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
            testID="quiz-restart-button"
          >
            <Ionicons name="refresh" size={18} color="#8a8a8a" />
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
                    testID={`quiz-option-speak-${option}`}
                  >
                    <Ionicons
                      name="volume-high"
                      size={18}
                      color={showCorrect || showWrong ? "#fff" : "#8a8a8a"}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  setupTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  setupSubtitle: {
    fontSize: 14,
    color: "#5a5a5a",
    marginBottom: 24,
  },
  setupLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8a8a8a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
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
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ececef",
    alignItems: "center",
  },
  quickCountChipActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  quickCountText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  quickCountTextActive: {
    color: "#fff",
  },
  customInput: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ececef",
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111",
    marginBottom: 12,
  },
  setupHint: {
    fontSize: 13,
    color: "#8a8a8a",
    marginBottom: 28,
  },
  startButton: {
    backgroundColor: "#111",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#5a5a5a",
    fontSize: 14,
    fontWeight: "600",
  },
  completeCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 40,
    alignItems: "center",
    marginBottom: 24,
    marginTop: 40,
    borderWidth: 1,
    borderColor: "#ececef",
  },
  completeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
    marginTop: 12,
  },
  completeScore: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
    marginTop: 16,
  },
  completePercent: {
    fontSize: 15,
    color: "#8a8a8a",
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
    color: "#5a5a5a",
    fontWeight: "600",
  },
  quizHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quizScore: {
    fontSize: 14,
    color: "#111",
    fontWeight: "700",
  },
  restartIconButton: {
    padding: 4,
  },
  quizBody: {
    flexGrow: 1,
  },
  promptCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#ececef",
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8a8a8a",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  promptWord: {
    fontSize: 36,
    fontWeight: "700",
    color: "#111",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  optionsList: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ececef",
  },
  optionCorrect: {
    backgroundColor: "#1a7f37",
    borderColor: "#1a7f37",
  },
  optionWrong: {
    backgroundColor: "#b42318",
    borderColor: "#b42318",
  },
  optionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
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
});
