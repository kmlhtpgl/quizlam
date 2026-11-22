import { describe, expect, it } from "vitest";
import type { Category, Difficulty } from "@/lib/domain";
import { normalizeAnswer } from "@/lib/scoring";
import { buildMcqChoices, type McqDistractorCandidate } from "./mcqDistractors";
import { detectDistractorTheme } from "./distractorThemes";

const category: Category = "Quran";
const difficulty: Difficulty = "easy";

function candidate(id: string, answer: string, prompt = "", explanation = ""): McqDistractorCandidate {
  return { id, answer, aliases: [], category, difficulty, prompt, explanation };
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

  it("prefers animal distractors for tavuk", () => {
    const correct = candidate(
      "tavuk",
      "tavuk",
      'Which Turkish word means "a farm bird that lays eggs"?',
      '"tavuk" is Turkish for a farm bird that lays eggs.',
    );
    const pool = [
      correct,
      candidate("inek", "inek", "a large farm animal that gives milk", '"inek" is Turkish for a farm animal.'),
      candidate("ördek", "ördek", "a water bird with a flat beak", '"ördek" is Turkish for a water bird.'),
      candidate("koyun", "koyun", "a farm animal with wool", '"koyun" is Turkish for a farm animal.'),
      candidate("deniz", "deniz", "a large body of salt water", '"deniz" is Turkish for the sea.'),
      candidate("araba", "araba", "a small vehicle with four wheels", '"araba" is Turkish for a car.'),
      candidate("sarı", "sarı", "the colour of the sun and a lemon", '"sarı" is Turkish for yellow.'),
    ];

    const result = buildMcqChoices(correct, pool, ["None", "All", "Unknown", "Other"], () => 0.42);
    const distractors = result.options.filter((option) => option !== correct.answer);

    expect(distractors).toHaveLength(3);
    expect(distractors.every((option) => ["inek", "ördek", "koyun"].includes(option))).toBe(true);
    expect(distractors).not.toContain("deniz");
    expect(distractors).not.toContain("araba");
    expect(distractors).not.toContain("sarı");
  });

  it("prefers vehicle and color distractors for araba and sarı", () => {
    const araba = candidate("araba", "araba", "a small vehicle with four wheels", '"araba" is Turkish for a car.');
    const vehiclePool = [
      araba,
      candidate("otobüs", "otobüs", "a large vehicle that carries many passengers", '"otobüs" is Turkish for a bus.'),
      candidate("tren", "tren", "a vehicle that runs on rails", '"tren" is Turkish for a train.'),
      candidate("bisiklet", "bisiklet", "a vehicle with two wheels that you pedal", '"bisiklet" is Turkish for a bicycle.'),
      candidate("tavuk", "tavuk", "a farm bird that lays eggs", '"tavuk" is Turkish for a chicken.'),
      candidate("sarı", "sarı", "the colour of the sun and a lemon", '"sarı" is Turkish for yellow.'),
    ];
    const vehicleResult = buildMcqChoices(araba, vehiclePool, ["None", "All", "Unknown", "Other"], () => 0.42);
    const vehicleDistractors = vehicleResult.options.filter((option) => option !== araba.answer);

    expect(vehicleDistractors.every((option) => ["otobüs", "tren", "bisiklet"].includes(option))).toBe(true);

    const sari = candidate("sarı", "sarı", "the colour of the sun and a lemon", '"sarı" is Turkish for yellow.');
    const colorPool = [
      sari,
      candidate("mavi", "mavi", "the colour of the clear sky and sea", '"mavi" is Turkish for blue.'),
      candidate("yeşil", "yeşil", "the colour of grass and leaves", '"yeşil" is Turkish for green.'),
      candidate("kırmızı", "kırmızı", "the colour of blood", '"kırmızı" is Turkish for red.'),
      candidate("araba", "araba", "a small vehicle with four wheels", '"araba" is Turkish for a car.'),
    ];
    const colorResult = buildMcqChoices(sari, colorPool, ["None", "All", "Unknown", "Other"], () => 0.42);
    const colorDistractors = colorResult.options.filter((option) => option !== sari.answer);

    expect(colorDistractors.every((option) => ["mavi", "yeşil", "kırmızı"].includes(option))).toBe(true);
  });

  it("uses semantic themes for English vocabulary questions", () => {
    const correct = candidate("hen", "hen", "a farm bird that lays eggs", '"hen" means a farm bird.');
    const pool = [
      correct,
      candidate("cow", "cow", "a large farm animal that gives milk", '"cow" means a farm animal.'),
      candidate("duck", "duck", "a water bird with a flat beak", '"duck" means a water bird.'),
      candidate("sheep", "sheep", "a farm animal with wool", '"sheep" means a farm animal.'),
      candidate("sea", "sea", "a large body of salt water", '"sea" means salt water.'),
      candidate("car", "car", "a small vehicle with four wheels", '"car" means a vehicle.'),
      candidate("yellow", "yellow", "the colour of the sun", '"yellow" means a colour.'),
    ];

    const result = buildMcqChoices(correct, pool, ["None", "All", "Unknown", "Other"], () => 0.42);
    const distractors = result.options.filter((option) => option !== correct.answer);

    expect(distractors.every((option) => ["cow", "duck", "sheep"].includes(option))).toBe(true);
  });

  it("does not classify a general tool as a vehicle", () => {
    const theme = detectDistractorTheme({
      answer: "kalem",
      prompt: "Hangisi mürekkeple yazmak için kullanılan araç anlamına gelen Türkçe kelimedir?",
      explanation: '"kalem" yazmak için kullanılan bir araçtır.',
    });

    expect(theme).not.toBe("vehicle");
  });

  it("falls back to the closest related options when a theme is sparse", () => {
    const correct = candidate("tavuk", "tavuk", "a farm bird that lays eggs", '"tavuk" is Turkish for a farm bird.');
    const pool = [
      correct,
      candidate("inek", "inek", "a large farm animal that gives milk", '"inek" is Turkish for a farm animal.'),
      candidate("deniz", "deniz", "a large body of salt water", '"deniz" is Turkish for the sea.'),
      candidate("araba", "araba", "a small vehicle with four wheels", '"araba" is Turkish for a car.'),
      candidate("sarı", "sarı", "the colour of the sun and a lemon", '"sarı" is Turkish for yellow.'),
    ];

    const result = buildMcqChoices(correct, pool, ["None", "All", "Unknown", "Other"], () => 0.42);
    const distractors = result.options.filter((option) => option !== correct.answer);

    expect(distractors).toHaveLength(3);
    expect(distractors).toContain("inek");
    expect(new Set(result.options.map(normalizeAnswer)).size).toBe(4);
  });
});
