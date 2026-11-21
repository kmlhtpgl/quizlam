import { describe, expect, it } from "vitest";
import { normalizeAnswer } from "@/lib/scoring";
import { QUESTION_SEED } from "./questionSeed";

const NEW_CATEGORIES = [
  "Y2 Words",
  "Y5 Words",
  "Y8 Words",
  "Turkish Vocabulary Easy",
  "Turkish Vocabulary Medium",
  "Turkish Vocabulary Hard",
] as const;

const YEAR_CATEGORIES = NEW_CATEGORIES.slice(0, 3);
const TURKISH_TIERS = {
  "Turkish Vocabulary Easy": "easy",
  "Turkish Vocabulary Medium": "medium",
  "Turkish Vocabulary Hard": "hard",
} as const;

describe("question seed", () => {
  it("keeps the original questions and adds 600 more", () => {
    expect(QUESTION_SEED).toHaveLength(750);
    expect(new Set(QUESTION_SEED.map((question) => question.id)).size).toBe(750);
  });

  it.each(NEW_CATEGORIES)("has 100 questions in %s", (category) => {
    expect(QUESTION_SEED.filter((question) => question.category === category)).toHaveLength(100);
  });

  it("has complete English and Turkish translations", () => {
    for (const question of QUESTION_SEED) {
      for (const language of ["en", "tr"] as const) {
        const translation = question.translations[language];
        expect(translation, `${question.id} ${language}`).toBeDefined();
        expect(translation!.prompt.length).toBeGreaterThan(0);
        expect(translation!.answer.length).toBeGreaterThan(0);
        expect(translation!.explanation.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses normalized non-empty answers without non-Latin scripts", () => {
    for (const question of QUESTION_SEED) {
      for (const language of ["en", "tr"] as const) {
        const answer = question.translations[language]!.answer;
        expect(normalizeAnswer(answer), `${question.id} ${language}`).not.toBe("");
      }
    }
  });

  it("mixes all three difficulties in the year categories", () => {
    for (const category of YEAR_CATEGORIES) {
      const difficulties = new Set(
        QUESTION_SEED.filter((question) => question.category === category).map((question) => question.difficulty),
      );
      expect(difficulties, category).toEqual(new Set(["easy", "medium", "hard"]));
    }
  });

  it("uses one difficulty per Turkish tier", () => {
    for (const [category, difficulty] of Object.entries(TURKISH_TIERS)) {
      const questions = QUESTION_SEED.filter((question) => question.category === category);
      expect(questions, category).toHaveLength(100);
      expect(questions.every((question) => question.difficulty === difficulty), category).toBe(true);
    }
  });

  it("does not repeat answers inside a new category", () => {
    for (const category of NEW_CATEGORIES) {
      const answers = QUESTION_SEED.filter((question) => question.category === category).map(
        (question) => question.translations.en!.answer,
      );
      expect(new Set(answers).size, category).toBe(answers.length);
    }
  });
});
