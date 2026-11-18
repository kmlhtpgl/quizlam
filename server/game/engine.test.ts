import { describe, expect, it } from "vitest";
import type { QuestionRecord } from "@/lib/domain";
import { GameEngine } from "./engine";

const BANK: QuestionRecord[] = [
  {
    id: "q1",
    category: "Quran",
    difficulty: "easy",
    approved: true,
    translations: {
      en: {
        language: "en",
        prompt: "The five daily prayers",
        answer: "SALAH",
        aliases: ["PRAYER"],
        explanation: "Salah is the second pillar of Islam.",
        source: null,
      },
    },
  },
  {
    id: "q2",
    category: "Quran",
    difficulty: "easy",
    approved: true,
    translations: {
      en: {
        language: "en",
        prompt: "The holy book of Islam",
        answer: "QURAN",
        aliases: ["KORAN"],
        explanation: "The Quran is the final revelation.",
        source: null,
      },
    },
  },
];

function fixture(rounds = 1, penalty = 50) {
  let now = 1_000_000;
  let idCounter = 0;
  let timerCounter = 0;
  const timers = new Map<number, () => void>();

  const engine = new GameEngine({
    now: () => now,
    random: () => 0,
    setTimer: (callback) => {
      timerCounter += 1;
      timers.set(timerCounter, callback as () => void);
      return timerCounter;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
    createCode: () => "TESTAA",
    createId: (prefix) => `${prefix}_${++idCounter}`,
  });

  const created = engine.createRoom({
    questionBank: BANK,
    config: {
      categories: ["Quran"],
      difficulties: ["easy"],
      language: "en",
      mode: "individual",
      rounds,
      penalty,
      timerSeconds: 30,
    },
  });
  const code = created.value.code;
  const hostToken = created.value.hostToken;
  const first = engine.joinRoom(code, { nickname: "Aisha", avatar: "lion" });
  const second = engine.joinRoom(code, { nickname: "Omar", avatar: "fox" });
  engine.attachSocket(code, first.value.playerId, "socket-1");
  engine.attachSocket(code, second.value.playerId, "socket-2");
  engine.startGame(code, hostToken);

  return {
    engine,
    code,
    hostToken,
    firstId: first.value.playerId,
    secondId: second.value.playerId,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
    fireTimers: () => {
      const pending = [...timers.values()];
      timers.clear();
      for (const callback of pending) callback();
    },
    snapshot: () => engine.getSnapshot(code, { hostToken }),
  };
}

describe("GameEngine", () => {
  it("starts with hidden tiles and a buzzer-open round", () => {
    const room = fixture();
    const snapshot = room.snapshot();

    expect(snapshot.phase).toBe("buzzer_open");
    expect(snapshot.question?.tiles.every((tile) => !tile.revealed || !tile.revealable)).toBe(true);
    expect(snapshot.availablePoints).toBe(500);
  });

  it("locks out later buzzes", () => {
    const room = fixture();
    const first = room.engine.buzz(room.code, room.firstId);
    const second = room.engine.buzz(room.code, room.secondId);

    expect(first.value.accepted).toBe(true);
    expect(second.value.accepted).toBe(false);
    expect(room.snapshot().activePlayerId).toBe(room.firstId);
    expect(room.snapshot().phase).toBe("answering");
  });

  it("charges revealed letters and awards the remaining points for a correct alias", () => {
    const room = fixture();
    room.engine.buzz(room.code, room.firstId);
    const reveal = room.engine.revealLetter(room.code, room.firstId);
    expect(reveal.value.position).not.toBeNull();
    expect(room.snapshot().availablePoints).toBe(400);

    const submitted = room.engine.submitAnswer(room.code, room.firstId, "prayer", "submit-1");
    const snapshot = room.snapshot();

    expect(submitted.value.correct).toBe(true);
    expect(snapshot.phase).toBe("finished");
    expect(snapshot.players.find((player) => player.id === room.firstId)?.score).toBe(400);
    expect(snapshot.history[0]?.answer).toBe("SALAH");
    expect(snapshot.history[0]?.pointsAwarded).toBe(400);
  });

  it("allows another player after a wrong answer and ignores duplicate submissions", () => {
    const room = fixture(2);
    room.engine.buzz(room.code, room.firstId);

    const wrong = room.engine.submitAnswer(room.code, room.firstId, "WRONG", "submit-1");
    const duplicate = room.engine.submitAnswer(room.code, room.firstId, "WRONG", "submit-1");

    expect(wrong.value.accepted).toBe(true);
    expect(wrong.value.correct).toBe(false);
    expect(duplicate.value.accepted).toBe(false);
    expect(room.snapshot().phase).toBe("buzzer_open");
    expect(room.snapshot().players.find((player) => player.id === room.firstId)?.isEligible).toBe(false);

    const next = room.engine.buzz(room.code, room.secondId);
    expect(next.value.accepted).toBe(true);
    expect(room.snapshot().activePlayerId).toBe(room.secondId);
  });

  it("applies a timeout and locks the player out when the deadline passes", () => {
    const room = fixture(2, 25);
    room.engine.buzz(room.code, room.firstId);
    room.advance(31_000);
    room.fireTimers();

    const snapshot = room.snapshot();
    const result = snapshot.history[0];

    expect(result?.timedOut).toBe(true);
    expect(result?.penalty).toBe(0);
    expect(snapshot.phase).toBe("buzzer_open");
    expect(snapshot.players.find((player) => player.id === room.firstId)?.score).toBe(0);
    expect(snapshot.players.find((player) => player.id === room.firstId)?.isEligible).toBe(false);
  });

  it("requires host authorization for host actions", () => {
    const room = fixture();
    expect(() => room.engine.pause(room.code, "wrong-token")).toThrow("HOST_ONLY");
    expect(() => room.engine.nextRound(room.code, "wrong-token")).toThrow("HOST_ONLY");
  });
});
