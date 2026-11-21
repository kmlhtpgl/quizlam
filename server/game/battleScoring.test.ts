import { describe, expect, it } from "vitest";
import { scoreBattleAnswer } from "./battleScoring";

describe("scoreBattleAnswer", () => {
  it("awards base points and a full speed bonus with no streak bonus on a first correct answer", () => {
    expect(scoreBattleAnswer({ correct: true, remainingMs: 20_000, totalMs: 20_000, streakBefore: 0 })).toEqual({
      basePoints: 1000,
      speedBonus: 500,
      streakBonus: 0,
      streakCount: 1,
      totalPoints: 1500,
    });
  });

  it("scales the speed bonus by remaining time and caps the streak bonus", () => {
    expect(scoreBattleAnswer({ correct: true, remainingMs: 10_000, totalMs: 20_000, streakBefore: 3 })).toEqual({
      basePoints: 1000,
      speedBonus: 250,
      streakBonus: 300,
      streakCount: 4,
      totalPoints: 1550,
    });
    expect(scoreBattleAnswer({ correct: true, remainingMs: 20_000, totalMs: 20_000, streakBefore: 9 }).streakBonus).toBe(500);
  });

  it("clamps the speed bonus to 0..500", () => {
    expect(scoreBattleAnswer({ correct: true, remainingMs: -100, totalMs: 20_000, streakBefore: 0 }).speedBonus).toBe(0);
    expect(scoreBattleAnswer({ correct: true, remainingMs: 99_000, totalMs: 20_000, streakBefore: 0 }).speedBonus).toBe(500);
    expect(scoreBattleAnswer({ correct: true, remainingMs: 5, totalMs: 0, streakBefore: 0 }).speedBonus).toBe(0);
  });

  it("gives no points and resets the streak for wrong and timed out answers", () => {
    expect(scoreBattleAnswer({ correct: false, remainingMs: 5_000, totalMs: 20_000, streakBefore: 4 })).toEqual({
      basePoints: 0,
      speedBonus: 0,
      streakBonus: 0,
      streakCount: 0,
      totalPoints: 0,
    });
  });
});
