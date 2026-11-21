import { describe, expect, it } from "vitest";
import type { BattleConfig, BattleRoomSnapshot } from "@/lib/battleDomain";
import type { Category, EngineEvent, Language, QuestionRecord } from "@/lib/domain";
import { BattleEngine } from "./battleEngine";

const BANK: QuestionRecord[] = Array.from({ length: 20 }, (_, index) => ({
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

function correctIndexFor(snapshot: BattleRoomSnapshot): number {
  const question = snapshot.question!;
  const record = BANK.find((item) => item.id === question.id)!;
  return question.options.findIndex((option) => option.text === record.translations.en!.answer);
}

function fixture(config: Partial<BattleConfig> = {}) {
  let now = 1_000_000;
  let idCounter = 0;
  let timerCounter = 0;
  const timers = new Map<number, () => void>();
  const published: EngineEvent[] = [];
  const engine = new BattleEngine({
    now: () => now,
    random: () => 0,
    setTimer: (callback) => {
      timerCounter += 1;
      timers.set(timerCounter, callback);
      return timerCounter;
    },
    clearTimer: (handle) => {
      timers.delete(handle as number);
    },
    createCode: () => "QBTEST",
    createId: (prefix) => `${prefix}_${++idCounter}`,
  });
  engine.setEventSink((events) => {
    published.push(...events);
  });
  const created = engine.createRoom({
    questionBank: BANK,
    config: { rounds: 5, timerSeconds: 20, ...config },
  });
  const code = created.value.code;
  const hostToken = created.value.hostToken;
  const firstPlayer = engine.joinRoom(code, { nickname: "Aisha", avatar: "lion" }).value;
  const secondPlayer = engine.joinRoom(code, { nickname: "Omar", avatar: "fox" }).value;
  const started = engine.start(code, hostToken);

  return {
    engine,
    code,
    hostToken,
    firstId: firstPlayer.playerId,
    secondId: secondPlayer.playerId,
    startEvents: started.events,
    published,
    host: () => engine.getSnapshot(code, { hostToken }),
    first: () => engine.getSnapshot(code, { playerToken: firstPlayer.token }),
    second: () => engine.getSnapshot(code, { playerToken: secondPlayer.token }),
    stranger: () => engine.getSnapshot(code),
    advanceTime: (ms: number) => {
      now += ms;
    },
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

describe("BattleEngine", () => {
  it("normalizes invalid configuration values and prepares that many rounds", () => {
    const room = fixture({
      rounds: 99,
      timerSeconds: 7,
      language: "xx" as Language,
      categories: ["Nope" as Category],
    });
    const snapshot = room.host();

    expect(snapshot.config.rounds).toBe(10);
    expect(snapshot.config.timerSeconds).toBe(20);
    expect(snapshot.config.language).toBe("en");
    expect(snapshot.config.difficulties).toEqual(["easy", "medium", "hard"]);
    expect(snapshot.config.categories).toContain("Quran");
    expect(snapshot.totalRounds).toBe(10);
    expect(snapshot.gameType).toBe("battle");
  });

  it("emits room:started and battle:question on start", () => {
    const room = fixture();
    expect(room.startEvents.map((event) => event.type)).toEqual(["room:started", "battle:question"]);
    expect(room.startEvents[1]?.payload?.questionId).toBe(room.host().question?.id);
    expect(room.host().phase).toBe("question");
  });

  it("scores correct answers with speed and streak bonuses across rounds", () => {
    const room = fixture();
    const firstIndex = correctIndexFor(room.host());
    room.advanceTime(5_000);
    room.engine.submitAnswer(room.code, room.firstId, firstIndex, "answer-1");
    const firstReveal = room.engine.skip(room.code, room.hostToken);
    const firstResult = firstReveal.value.find((result) => result.playerId === room.firstId)!;

    expect(firstResult.correct).toBe(true);
    expect(firstResult.responseMs).toBe(5_000);
    expect(firstResult.speedBonus).toBe(375);
    expect(firstResult.streakBonus).toBe(0);
    expect(firstResult.streakCount).toBe(1);
    expect(firstResult.totalPoints).toBe(1375);
    expect(firstResult.pointsAwarded).toBe(firstResult.totalPoints);
    expect(firstResult.scoreDelta).toBe(firstResult.totalPoints);
    expect(firstResult.correctIndex).toBe(firstIndex);
    expect(firstResult.choices).toHaveLength(4);

    room.engine.next(room.code, room.hostToken);
    const secondIndex = correctIndexFor(room.host());
    room.engine.submitAnswer(room.code, room.firstId, secondIndex, "answer-2");
    const secondResult = room.engine.skip(room.code, room.hostToken).value.find((result) => result.playerId === room.firstId)!;

    expect(secondResult.speedBonus).toBe(500);
    expect(secondResult.streakBonus).toBe(100);
    expect(secondResult.streakCount).toBe(2);
    expect(secondResult.totalPoints).toBe(1600);
  });

  it("resets streaks for wrong and timed out answers", () => {
    const room = fixture();
    const firstIndex = correctIndexFor(room.host());
    room.engine.submitAnswer(room.code, room.firstId, wrongIndex(firstIndex), "wrong-1");
    let result = room.engine.skip(room.code, room.hostToken).value.find((item) => item.playerId === room.firstId)!;
    expect(result.correct).toBe(false);
    expect(result.totalPoints).toBe(0);
    expect(result.streakCount).toBe(0);

    room.engine.next(room.code, room.hostToken);
    const secondIndex = correctIndexFor(room.host());
    room.engine.submitAnswer(room.code, room.firstId, secondIndex, "correct-1");
    result = room.engine.skip(room.code, room.hostToken).value.find((item) => item.playerId === room.firstId)!;
    expect(result.streakBonus).toBe(0);
    expect(result.streakCount).toBe(1);

    room.engine.next(room.code, room.hostToken);
    room.fireTimers();
    const timeoutResult = room.host().results.find((item) => item.playerId === room.firstId)!;
    expect(timeoutResult.timedOut).toBe(true);
    expect(timeoutResult.responseMs).toBe(20_000);
    expect(timeoutResult.totalPoints).toBe(0);
    expect(timeoutResult.streakCount).toBe(0);
  });

  it("rejects duplicate, invalid, and late answers without ending the question early", () => {
    const room = fixture();
    const index = correctIndexFor(room.host());
    const accepted = room.engine.submitAnswer(room.code, room.firstId, index, "answer-1");

    expect(accepted.value.accepted).toBe(true);
    expect(accepted.value.answerCount).toBe(1);
    expect(room.host().phase).toBe("question");
    expect(room.host().answerCount).toBe(1);
    expect(() => room.engine.submitAnswer(room.code, room.firstId, index, "answer-2")).toThrow("DUPLICATE_ANSWER");
    expect(() => room.engine.submitAnswer(room.code, room.firstId, index, "answer-1")).toThrow("DUPLICATE_SUBMISSION");
    expect(() => room.engine.submitAnswer(room.code, room.secondId, 4, "bad-choice")).toThrow("INVALID_CHOICE");
    room.advanceTime(20_000);
    expect(() => room.engine.submitAnswer(room.code, room.secondId, 0, "late")).toThrow("QUESTION_EXPIRED");

    room.engine.skip(room.code, room.hostToken);
    expect(() => room.engine.submitAnswer(room.code, room.secondId, 0, "too-late")).toThrow("NO_ACTIVE_QUESTION");
  });

  it("hides answers during questions and reveals them on timeout", () => {
    const room = fixture();
    const index = correctIndexFor(room.host());
    room.engine.submitAnswer(room.code, room.firstId, index, "answer-1");

    const hostQuestion = room.host();
    const playerQuestion = room.first();
    expect(hostQuestion.question?.correctIndex).toBeNull();
    expect(hostQuestion.question?.explanation).toBeNull();
    expect(hostQuestion.results).toEqual([]);
    expect(playerQuestion.question?.correctIndex).toBeNull();
    expect(playerQuestion.myAnswer).toEqual({
      answered: true,
      selectedIndex: index,
      correct: null,
      points: 0,
      responseMs: 0,
    });
    expect(room.stranger().myAnswer).toBeNull();

    room.fireTimers();
    const revealed = room.host();
    expect(revealed.phase).toBe("reveal");
    expect(revealed.question?.correctIndex).toBe(index);
    expect(revealed.question?.explanation).toBe(BANK.find((item) => item.id === revealed.question!.id)!.translations.en!.explanation);
    expect(revealed.results).toHaveLength(2);
    expect(revealed.results.find((result) => result.playerId === room.firstId)?.correct).toBe(true);
    expect(revealed.results.find((result) => result.playerId === room.secondId)?.timedOut).toBe(true);
    expect(room.first().myAnswer?.correct).toBe(true);
    expect(room.first().myAnswer?.points).toBe(1500);
    expect(room.second().myAnswer?.answered).toBe(false);
    expect(room.published.filter((event) => event.type === "battle:reveal")).toHaveLength(1);
  });

  it("lets the host skip to reveal and advance manually", () => {
    const room = fixture();
    const questionId = room.host().question!.id;
    const skipped = room.engine.skip(room.code, room.hostToken);

    expect(skipped.events).toHaveLength(1);
    expect(skipped.events[0]?.type).toBe("battle:reveal");
    expect(skipped.events[0]?.payload?.questionId).toBe(questionId);
    expect(skipped.events[0]?.payload?.results).toHaveLength(2);
    expect(room.host().question?.correctIndex).not.toBeNull();

    const nexted = room.engine.next(room.code, room.hostToken);
    expect(nexted.events[0]?.type).toBe("battle:question");
    expect(room.host().roundIndex).toBe(1);
    expect(room.host().phase).toBe("question");
  });

  it("auto-advances from question timeout through reveal to the next question", () => {
    const room = fixture();
    room.fireTimers();
    expect(room.host().phase).toBe("reveal");

    room.fireTimers();
    expect(room.host().phase).toBe("question");
    expect(room.host().roundIndex).toBe(1);
    expect(room.published.filter((event) => event.type === "battle:question")).toHaveLength(1);
  });

  it("finishes after the last reveal and picks the top scorers", () => {
    const room = fixture({ rounds: 5 });
    for (let round = 0; round < 5; round += 1) {
      const index = correctIndexFor(room.host());
      room.engine.submitAnswer(room.code, room.firstId, index, `answer-${round}`);
      room.engine.skip(room.code, room.hostToken);
      if (round < 4) room.engine.next(room.code, room.hostToken);
    }

    const finished = room.engine.next(room.code, room.hostToken);
    const snapshot = room.host();
    expect(finished.events[0]?.type).toBe("game:finished");
    expect(snapshot.phase).toBe("finished");
    expect(snapshot.winners).toEqual([room.firstId]);
    expect(snapshot.players.find((player) => player.id === room.firstId)?.score).toBe(8500);
    expect(snapshot.players.find((player) => player.id === room.firstId)?.isWinner).toBe(true);
    expect(snapshot.players.every((player) => !player.isActive && player.isEligible)).toBe(true);
    expect(snapshot.history).toHaveLength(10);
    expect(snapshot.question?.correctIndex).not.toBeNull();
  });

  it("ends a room early from the host action", () => {
    const room = fixture();
    const ended = room.engine.end(room.code, room.hostToken);

    expect(ended.events[0]?.type).toBe("game:finished");
    expect(room.host().phase).toBe("finished");
    expect(() => room.engine.skip(room.code, room.hostToken)).toThrow("NO_ACTIVE_QUESTION");
  });
});
