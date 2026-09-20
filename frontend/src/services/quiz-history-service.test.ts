import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadQuizHistory, saveQuizResult } from "./quiz-history-service";

describe("quiz-history-service", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("round-trips a saved result", async () => {
    await saveQuizResult({ correct: 3, answered: 5, timestamp: 100 });
    expect(await loadQuizHistory()).toEqual([{ correct: 3, answered: 5, timestamp: 100 }]);
  });

  it("drops corrupted entries", async () => {
    await AsyncStorage.setItem("gv.quiz.history.correct.v1", JSON.stringify([1, "x", 9]));
    await AsyncStorage.setItem("gv.quiz.history.answered.v1", JSON.stringify([2, 2, 3]));
    await AsyncStorage.setItem("gv.quiz.history.timestamp.v1", JSON.stringify([1, 2, 3]));
    expect(await loadQuizHistory()).toEqual([{ correct: 1, answered: 2, timestamp: 1 }]);
  });
});
