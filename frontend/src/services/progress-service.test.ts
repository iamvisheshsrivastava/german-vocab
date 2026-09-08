import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  loadLearnViewMode,
  loadReviewedIds,
  resetReviewed,
  saveLearnViewMode,
  saveReviewedIds,
} from "./progress-service";

describe("progress-service", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("returns an empty array when no reviewed ids are stored", async () => {
    expect(await loadReviewedIds()).toEqual([]);
  });

  it("round-trips reviewed ids through save/load", async () => {
    await saveReviewedIds([1, 2, 3]);
    expect(await loadReviewedIds()).toEqual([1, 2, 3]);
  });

  it("clears reviewed ids on reset", async () => {
    await saveReviewedIds([1, 2, 3]);
    await resetReviewed();
    expect(await loadReviewedIds()).toEqual([]);
  });

  it("defaults the view mode to toReview", async () => {
    expect(await loadLearnViewMode()).toBe("toReview");
  });

  it("round-trips the view mode through save/load", async () => {
    await saveLearnViewMode("all");
    expect(await loadLearnViewMode()).toBe("all");
    await saveLearnViewMode("reviewed");
    expect(await loadLearnViewMode()).toBe("reviewed");
    await saveLearnViewMode("toReview");
    expect(await loadLearnViewMode()).toBe("toReview");
  });

  it("falls back to toReview for an unexpected stored value", async () => {
    await AsyncStorage.setItem("gv.learn.viewmode.v1", JSON.stringify("bogus"));
    expect(await loadLearnViewMode()).toBe("toReview");
  });
});
