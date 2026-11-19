import { describe, expect, it } from "vitest";
import type { EngineEvent, RoundResult } from "./domain";
import { soundForEvent } from "./sound";

const result = (overrides: Partial<RoundResult> = {}): RoundResult => ({
  round: 1,
  playerId: "ply_1",
  playerName: "Zeynep",
  correct: false,
  timedOut: false,
  skipped: false,
  answer: "Kıble",
  explanation: "",
  source: null,
  pointsAwarded: 0,
  penalty: 0,
  scoreDelta: 0,
  ...overrides,
});

const event = (type: EngineEvent["type"], payload?: Record<string, unknown>): EngineEvent => ({
  type,
  code: "ABC123",
  payload,
});

describe("game event sounds", () => {
  it("maps joining and starting cues", () => {
    expect(soundForEvent(event("player:joined"))).toBe("join");
    expect(soundForEvent(event("room:started"))).toBe("start");
  });

  it("maps correct, wrong, and timeout answers", () => {
    expect(soundForEvent(event("answer:result", { result: result({ correct: true }) }))).toBe("correct");
    expect(soundForEvent(event("answer:result", { result: result() }))).toBe("wrong");
    expect(soundForEvent(event("answer:result", { result: result({ timedOut: true }) }))).toBe("timeout");
  });

  it("does not replay duplicate or skipped result cues", () => {
    expect(soundForEvent(event("turn:timeout"))).toBeNull();
    expect(soundForEvent(event("answer:result", { result: result({ skipped: true }) }))).toBeNull();
  });

  it("maps buzzer, reveal, and win cues", () => {
    expect(soundForEvent(event("player:buzzed"))).toBe("buzz");
    expect(soundForEvent(event("letter:revealed"))).toBe("reveal");
    expect(soundForEvent(event("game:finished"))).toBe("win");
  });

  it("ignores unrelated events and malformed results", () => {
    expect(soundForEvent(event("room:updated"))).toBeNull();
    expect(soundForEvent(event("answer:result"))).toBeNull();
    expect(soundForEvent(event("answer:result", { result: { correct: true } }))).toBeNull();
  });
});
