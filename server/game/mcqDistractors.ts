import type { Category, Difficulty } from "@/lib/domain";
import { normalizeAnswer } from "@/lib/scoring";

export interface McqDistractorCandidate {
  id: string;
  answer: string;
  aliases: string[];
  category: Category;
  difficulty: Difficulty;
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

export function buildMcqChoices(
  correct: McqDistractorCandidate,
  pool: McqDistractorCandidate[],
  fallbacks: string[],
  random: () => number,
): McqChoices {
  const used = new Set([normalizeAnswer(correct.answer), ...correct.aliases.map(normalizeAnswer)].filter(Boolean));
  const others = pool.filter((candidate) => candidate.id !== correct.id);
  const tiers = [
    others.filter((candidate) => candidate.category === correct.category && candidate.difficulty === correct.difficulty),
    others.filter((candidate) => candidate.category === correct.category),
    others.filter((candidate) => candidate.difficulty === correct.difficulty),
    others,
  ];
  const chosen: string[] = [];

  for (const tier of tiers) {
    for (const candidate of shuffle(tier, random)) {
      const key = normalizeAnswer(candidate.answer);
      if (!key || used.has(key)) continue;
      used.add(key);
      chosen.push(candidate.answer);
      if (chosen.length >= 3) break;
    }
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
