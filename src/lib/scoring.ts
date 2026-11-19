import type { TileView } from "./domain";

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ıİ]/g, "I")
    .replace(/[şŞ]/g, "S")
    .replace(/[ğĞ]/g, "G")
    .replace(/[çÇ]/g, "C")
    .replace(/[öÖ]/g, "O")
    .replace(/[üÜ]/g, "U")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function isRevealable(char: string): boolean {
  return /^[\p{L}\p{N}]$/u.test(char);
}

export function buildTiles(answer: string): TileView[] {
  return Array.from(answer).map((char, position) => ({
    position,
    char,
    revealable: isRevealable(char),
    revealed: false,
  }));
}

export function revealableCount(tiles: TileView[]): number {
  return tiles.filter((tile) => tile.revealable).length;
}

export function availablePoints(totalRevealable: number, revealedCount: number): number {
  return Math.max(0, (totalRevealable - revealedCount) * 100);
}

export function calculateAward(totalRevealable: number, revealedCount: number, correct: boolean): number {
  return correct ? availablePoints(totalRevealable, revealedCount) : 0;
}

export function applyPenalty(score: number, penalty: number): number {
  return Math.max(0, score - Math.max(0, penalty));
}

export function answersMatch(submitted: string, answer: string, aliases: string[] = []): boolean {
  const normalizedSubmitted = normalizeAnswer(submitted);
  if (!normalizedSubmitted) return false;
  const accepted = [answer, ...aliases].map(normalizeAnswer).filter(Boolean);
  return accepted.includes(normalizedSubmitted);
}

export function pickUnrevealedIndex(tiles: TileView[], random: () => number): number | null {
  const candidates = tiles.filter((tile) => tile.revealable && !tile.revealed).map((tile) => tile.position);
  if (candidates.length <= 1) return null;
  const index = Math.floor(random() * candidates.length);
  return candidates[Math.min(index, candidates.length - 1)] ?? null;
}
