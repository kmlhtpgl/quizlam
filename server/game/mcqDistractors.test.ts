import { describe, expect, it } from "vitest";
import type { Category, Difficulty } from "@/lib/domain";
import { normalizeAnswer } from "@/lib/scoring";
import { buildMcqChoices, type McqDistractorCandidate } from "./mcqDistractors";

const category: Category = "Quran";
const difficulty: Difficulty = "easy";

function candidate(id: string, answer: string): McqDistractorCandidate {
  return { id, answer, aliases: [], category, difficulty };
}

describe("buildMcqChoices", () => {
  it("builds four unique options including the correct answer", () => {
    const correct = candidate("q1", "SALAH");
    const pool = [
      correct,
      candidate("q2", "QURAN"),
      candidate("q3", "HAJJ"),
      candidate("q4", "ZAKAT"),
      candidate("q5", "SAWM"),
    ];

    const result = buildMcqChoices(correct, pool, ["None", "All", "Unknown", "Other"], () => 0.42);

    expect(result.options).toHaveLength(4);
    expect(result.options).toContain("SALAH");
    expect(result.correctIndex).toBeGreaterThanOrEqual(0);
    expect(result.correctIndex).toBeLessThan(4);
    expect(result.options[result.correctIndex]).toBe("SALAH");
    expect(new Set(result.options.map(normalizeAnswer)).size).toBe(4);
  });

  it("skips aliases and duplicate correct answers", () => {
    const correct: McqDistractorCandidate = { ...candidate("q1", "SALAH"), aliases: ["PRAYER"] };
    const pool = [
      correct,
      candidate("q2", "PRAYER"),
      candidate("q3", "QURAN"),
      candidate("q4", "HAJJ"),
      candidate("q5", "ZAKAT"),
    ];

    const result = buildMcqChoices(correct, pool, ["None", "All", "Unknown", "Other"], () => 0);

    expect(result.options.filter((option) => ["SALAH", "PRAYER"].includes(normalizeAnswer(option)))).toHaveLength(1);
    expect(new Set(result.options.map(normalizeAnswer)).size).toBe(4);
  });

  it("uses fallbacks when the pool is too small", () => {
    const correct = candidate("q1", "SALAH");
    const result = buildMcqChoices(correct, [correct], ["None", "All", "Unknown", "Other"], () => 0);

    expect(result.options).toHaveLength(4);
    expect(result.options).toContain("SALAH");
    expect(result.options).toContain("None");
  });
});
