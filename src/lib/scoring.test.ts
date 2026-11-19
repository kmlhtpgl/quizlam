import { describe, expect, it } from "vitest";
import { buildTiles, isRevealable, normalizeAnswer, revealableCount } from "./scoring";

describe("answer tiles", () => {
  it("counts Turkish letters as revealable", () => {
    const tiles = buildTiles("Kıble");

    expect(tiles.map((tile) => tile.char)).toEqual(["K", "ı", "b", "l", "e"]);
    expect(tiles.every((tile) => tile.revealable)).toBe(true);
    expect(revealableCount(tiles)).toBe(5);
  });

  it("keeps spaces and punctuation as separators", () => {
    const words = buildTiles("Ali İmran");
    const apostrophe = buildTiles("Rak'ah");

    expect(revealableCount(words)).toBe(8);
    expect(words.find((tile) => tile.char === " ")?.revealable).toBe(false);
    expect(revealableCount(apostrophe)).toBe(5);
    expect(apostrophe.find((tile) => tile.char === "'")?.revealable).toBe(false);
  });

  it("supports ASCII answers and digits", () => {
    expect(revealableCount(buildTiles("Qibla"))).toBe(5);
    expect(revealableCount(buildTiles("114"))).toBe(3);
  });

  it("normalizes Turkish letters for matching without changing tile display", () => {
    expect(normalizeAnswer("Kıble")).toBe("KIBLE");
    expect(isRevealable("ı")).toBe(true);
    expect(isRevealable("İ")).toBe(true);
    expect(isRevealable("ş")).toBe(true);
    expect(isRevealable(" ")).toBe(false);
  });
});
