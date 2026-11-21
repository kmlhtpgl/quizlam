export interface BattleScoreInput {
  correct: boolean;
  remainingMs: number;
  totalMs: number;
  streakBefore: number;
}

export interface BattleScore {
  basePoints: number;
  speedBonus: number;
  streakBonus: number;
  streakCount: number;
  totalPoints: number;
}

export function scoreBattleAnswer(input: BattleScoreInput): BattleScore {
  if (!input.correct) {
    return { basePoints: 0, speedBonus: 0, streakBonus: 0, streakCount: 0, totalPoints: 0 };
  }
  const totalMs = Math.max(0, input.totalMs);
  const remainingMs = Math.min(totalMs, Math.max(0, input.remainingMs));
  const speedBonus = totalMs > 0 ? Math.min(500, Math.max(0, Math.round((500 * remainingMs) / totalMs))) : 0;
  const streakBefore = Math.max(0, Math.floor(input.streakBefore));
  const streakBonus = Math.min(streakBefore * 100, 500);
  const basePoints = 1000;
  return {
    basePoints,
    speedBonus,
    streakBonus,
    streakCount: streakBefore + 1,
    totalPoints: basePoints + speedBonus + streakBonus,
  };
}
