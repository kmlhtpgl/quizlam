import { describe, expect, it } from "vitest";
import type { QuestionRecord } from "@/lib/domain";
import { MCQ_LADDER } from "@/lib/mcqDomain";
import { McqEngine } from "./mcqEngine";

const BANK: QuestionRecord[] = Array.from({ length: 6 }, (_, index) => ({
  id: `q${index + 1}`,
  category: "Quran",
  difficulty: "easy",
  approved: true,
  translations: {
    en: {
      language: "en",
      prompt: `Prompt ${index + 1}`,
      answer: `ANSWER${index + 1}`,
      aliases: [],
      explanation: `Explanation ${index + 1}`,
      source: null,
    },
  },
}));

function fixture() {
  const now = 1_000_000;
  let idCounter = 0;
  let timerCounter = 0;
  const timers = new Map<number, () => void>();

  const engine = new McqEngine({
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
    createCode: () => "MQTEST",
    createId: (prefix) => `${prefix}_${++idCounter}`,
  });

  const created = engine.createRoom({
    questionBank: BANK,
    config: {
      categories: ["Quran"],
      difficulties: ["easy"],
      language: "en",
      timerSeconds: 30,
    },
    localPlayers: [
      { nickname: "Aisha", avatar: "lion" },
      { nickname: "Omar", avatar: "fox" },
    ],
  });
  const code = created.value.code;
  const hostToken = created.value.hostToken;
  const initial = engine.getSnapshot(code, { hostToken });
  const firstId = initial.players[0]!.id;
  const secondId = initial.players[1]!.id;

  engine.selectContestant(code, hostToken, firstId);
  engine.startRun(code, hostToken);

  return {
    engine,
    code,
    hostToken,
    firstId,
    secondId,
    host: () => engine.getSnapshot(code, { hostToken }),
    player: () => engine.getSnapshot(code),
    fireTimers: () => {
      const pending = [...timers.values()];
      timers.clear();
      for (const callback of pending) callback();
    },
  };
}

function wrongIndex(correctIndex: number): number {
  return [0, 1, 2, 3].find((index) => index !== correctIndex)!;
}

describe("McqEngine", () => {
  it("starts a 15-step run with hidden choices for players", () => {
    const room = fixture();
    const host = room.host();
    const player = room.player();

    expect(host.phase).toBe("question");
    expect(host.totalRounds).toBe(BANK.length);
    expect(host.question?.options).toHaveLength(4);
    expect(host.question?.correctIndex).not.toBeNull();
    expect(player.question?.correctIndex).toBeNull();
    expect(host.currentValue).toBe(MCQ_LADDER[0]);
  });

  it("awards the question value for a correct answer", () => {
    const room = fixture();
    const correctIndex = room.host().question!.correctIndex!;
    const result = room.engine.answer(room.code, room.firstId, correctIndex, "answer-1");

    expect(result.value.correct).toBe(true);
    expect(result.value.pointsAwarded).toBe(MCQ_LADDER[0]);
    expect(room.host().phase).toBe("answer_result");
    expect(room.host().bankedPoints).toBe(MCQ_LADDER[0]);
    expect(room.host().players.find((player) => player.id === room.firstId)?.score).toBe(MCQ_LADDER[0]);
  });

  it("allows only the selected contestant to answer", () => {
    const room = fixture();
    expect(() => room.engine.answer(room.code, room.secondId, 0, "not-contestant")).toThrow("NOT_CONTESTANT");
  });

  it("eliminates two wrong choices once per run with 50:50", () => {
    const room = fixture();
    const correctIndex = room.host().question!.correctIndex!;
    room.engine.useFiftyFifty(room.code, room.firstId);
    const eliminated = room.host().eliminated;

    expect(eliminated).toHaveLength(2);
    expect(eliminated.every((index) => index !== correctIndex)).toBe(true);
    expect(() => room.engine.useFiftyFifty(room.code, room.firstId)).toThrow("LIFELINE_USED");
  });

  it("ends the run on a wrong answer", () => {
    const room = fixture();
    const correctIndex = room.host().question!.correctIndex!;
    const result = room.engine.answer(room.code, room.firstId, wrongIndex(correctIndex), "wrong-1");

    expect(result.value.correct).toBe(false);
    expect(room.host().phase).toBe("finished");
    expect(room.host().bankedPoints).toBe(0);
  });

  it("banks the last milestone after a wrong answer at question five", () => {
    const room = fixture();
    for (let round = 0; round < 4; round += 1) {
      const current = room.host().question!.correctIndex!;
      room.engine.answer(room.code, room.firstId, current, `correct-${round}`);
      room.engine.nextQuestion(room.code, room.hostToken);
    }

    const correctIndex = room.host().question!.correctIndex!;
    expect(room.host().roundIndex).toBe(4);
    expect(room.host().currentValue).toBe(MCQ_LADDER[4]);
    room.engine.answer(room.code, room.firstId, wrongIndex(correctIndex), "wrong-milestone");

    expect(room.host().phase).toBe("finished");
    expect(room.host().bankedPoints).toBe(MCQ_LADDER[4]);
    expect(room.host().players.find((player) => player.id === room.firstId)?.score).toBe(MCQ_LADDER[4]);
  });

  it("ends the run when the timer expires", () => {
    const room = fixture();
    room.fireTimers();
    const snapshot = room.host();

    expect(snapshot.phase).toBe("finished");
    expect(snapshot.lastResult?.timedOut).toBe(true);
    expect(snapshot.bankedPoints).toBe(0);
  });

  it("pauses and resumes the question timer", () => {
    const room = fixture();
    room.engine.pause(room.code, room.hostToken);
    expect(room.host().paused).toBe(true);
    expect(room.host().turnEndsAt).toBeNull();
    room.engine.resume(room.code, room.hostToken);
    expect(room.host().paused).toBe(false);
    expect(room.host().turnEndsAt).not.toBeNull();
  });

  it("resets a finished run so the host can pick another contestant", () => {
    const room = fixture();
    const correctIndex = room.host().question!.correctIndex!;
    room.engine.answer(room.code, room.firstId, wrongIndex(correctIndex), "wrong-reset");
    expect(room.host().phase).toBe("finished");

    room.engine.resetRun(room.code, room.hostToken);
    expect(room.host().phase).toBe("contestant");
    expect(room.host().activePlayerId).toBeNull();
    expect(room.host().bankedPoints).toBe(0);
  });
});
