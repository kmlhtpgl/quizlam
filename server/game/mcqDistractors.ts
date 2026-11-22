import type { Category, Difficulty } from "@/lib/domain";
import { normalizeAnswer } from "@/lib/scoring";
import { detectDistractorTheme } from "./distractorThemes";

export interface McqDistractorCandidate {
  id: string;
  answer: string;
  aliases: string[];
  category: Category;
  difficulty: Difficulty;
  prompt?: string;
  explanation?: string;
}

export interface McqChoices {
  options: string[];
  correctIndex: number;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    const current = result[index]!;
    result[index] = result[target]!;
    result[target] = current;
  }
  return result;
}

function candidateScore(correct: McqDistractorCandidate, candidate: McqDistractorCandidate): number {
  const correctTheme = detectDistractorTheme(correct);
  const candidateTheme = detectDistractorTheme(candidate);
  const lengthGap = Math.abs(normalizeAnswer(candidate.answer).length - normalizeAnswer(correct.answer).length);
  let score = Math.max(0, 10 - lengthGap);
  if (candidate.category === correct.category) score += 200;
  if (candidate.difficulty === correct.difficulty) score += 100;
  if (correctTheme !== "unknown" && candidateTheme === correctTheme) score += 1000;
  return score;
}

export function buildMcqChoices(
  correct: McqDistractorCandidate,
  pool: McqDistractorCandidate[],
  fallbacks: string[],
  random: () => number,
): McqChoices {
  const used = new Set([normalizeAnswer(correct.answer), ...correct.aliases.map(normalizeAnswer)].filter(Boolean));
  const ranked = shuffle(pool.filter((candidate) => candidate.id !== correct.id), random)
    .map((candidate) => ({ candidate, score: candidateScore(correct, candidate) }))
    .sort((left, right) => right.score - left.score);
  const chosen: string[] = [];

  for (const { candidate } of ranked) {
    const key = normalizeAnswer(candidate.answer);
    if (!key || used.has(key)) continue;
    used.add(key);
    chosen.push(candidate.answer);
    if (chosen.length >= 3) break;
  }

  for (const fallback of fallbacks) {
    if (chosen.length >= 3) break;
    const key = normalizeAnswer(fallback);
    if (!key || used.has(key)) continue;
    used.add(key);
    chosen.push(fallback);
    if (chosen.length >= 3) break;
  }

  while (chosen.length < 3) {
    let index = chosen.length + 1;
    while (used.has(`OPTION${index}`)) index += 1;
    used.add(`OPTION${index}`);
    chosen.push(`Option ${index}`);
  }

  const options = shuffle([correct.answer, ...chosen], random);
  const correctIndex = options.findIndex((option) => normalizeAnswer(option) === normalizeAnswer(correct.answer));
  return { options, correctIndex: Math.max(0, correctIndex) };
}
