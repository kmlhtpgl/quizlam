import { randomBytes } from "node:crypto";
import {
  AVATARS,
  CATEGORIES,
  DIFFICULTIES,
  LANGUAGES,
  type Avatar,
  type EngineEvent,
  type PlayerView,
  type QuestionRecord,
} from "@/lib/domain";
import {
  BATTLE_DEFAULT_CONFIG,
  BATTLE_ROUND_OPTIONS,
  BATTLE_TIMER_OPTIONS,
  type BattleAnswerView,
  type BattleChoiceColor,
  type BattleConfig,
  type BattleCreateInput,
  type BattleQuestionView,
  type BattleResult,
  type BattleRoomSnapshot,
} from "@/lib/battleDomain";
import { scoreBattleAnswer } from "./battleScoring";
import { buildMcqChoices, type McqDistractorCandidate } from "./mcqDistractors";

interface InternalAnswer {
  playerId: string;
  selectedIndex: number;
  responseMs: number;
}

interface InternalPlayer {
  id: string;
  token: string;
  nickname: string;
  avatar: Avatar;
  score: number;
  streak: number;
  connected: boolean;
  socketIds: Set<string>;
  isLocal: boolean;
}

interface PreparedQuestion {
  record: QuestionRecord;
  prompt: string;
  answer: string;
  aliases: string[];
  explanation: string;
  source: string | null;
  options: string[];
  correctIndex: number;
}

interface InternalRoom {
  code: string;
  hostToken: string;
  config: BattleConfig;
  phase: BattleRoomSnapshot["phase"];
  paused: boolean;
  players: Map<string, InternalPlayer>;
  questionBank: QuestionRecord[];
  selectedQuestions: PreparedQuestion[];
  roundIndex: number;
  currentQuestion: PreparedQuestion | null;
  turnEndsAt: number | null;
  remainingMs: number | null;
  timer: unknown | null;
  answers: Map<string, InternalAnswer>;
  submissionKeys: Set<string>;
  results: BattleResult[];
  history: BattleResult[];
  createdAt: number;
}

export interface BattleEngineOptions {
  now?: () => number;
  random?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  createCode?: () => string;
  createId?: (prefix: string) => string;
}

export interface BattleEngineResult<T> {
  value: T;
  events: EngineEvent[];
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const REVEAL_MS = 5000;
const CHOICE_COLORS: BattleChoiceColor[] = ["red", "blue", "yellow", "green"];

const FALLBACK_OPTIONS: Record<"en" | "tr", string[]> = {
  en: ["None of the above", "All of the above", "Not specified", "Unknown"],
  tr: ["Hiçbiri", "Hepsi", "Belirtilmedi", "Bilinmiyor"],
};

function defaultCode(): string {
  const bytes = randomBytes(5);
  return `QB${Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("")}`;
}

function defaultId(prefix: string): string {
  return `${prefix}_${randomBytes(9).toString("base64url")}`;
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
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

function normalizeConfig(input: Partial<BattleConfig> | undefined): BattleConfig {
  const merged = { ...BATTLE_DEFAULT_CONFIG, ...(input ?? {}) };
  const categories = (merged.categories ?? []).filter((category) => CATEGORIES.includes(category));
  const difficulties = (merged.difficulties ?? []).filter((difficulty) => DIFFICULTIES.includes(difficulty));
  return {
    categories: categories.length ? categories : [...CATEGORIES],
    difficulties: difficulties.length ? difficulties : [...DIFFICULTIES],
    language: LANGUAGES.includes(merged.language) ? merged.language : "en",
    rounds: BATTLE_ROUND_OPTIONS.includes(merged.rounds as (typeof BATTLE_ROUND_OPTIONS)[number])
      ? merged.rounds
      : BATTLE_DEFAULT_CONFIG.rounds,
    timerSeconds: BATTLE_TIMER_OPTIONS.includes(merged.timerSeconds as (typeof BATTLE_TIMER_OPTIONS)[number])
      ? merged.timerSeconds
      : BATTLE_DEFAULT_CONFIG.timerSeconds,
  };
}

function cleanNickname(value: string): string {
  return value.replace(/[<>{}]/g, "").trim().slice(0, 18) || "Player";
}

export class BattleEngine {
  private rooms = new Map<string, InternalRoom>();
  private now: () => number;
  private random: () => number;
  private setTimer: (callback: () => void, ms: number) => unknown;
  private clearTimerFn: (handle: unknown) => void;
  private createCode: () => string;
  private createId: (prefix: string) => string;
  private eventSink: ((events: EngineEvent[], code: string) => void) | null = null;

  constructor(options: BattleEngineOptions = {}) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    this.clearTimerFn = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.createCode = options.createCode ?? defaultCode;
    this.createId = options.createId ?? ((prefix) => defaultId(prefix));
  }

  setEventSink(sink: ((events: EngineEvent[], code: string) => void) | null): void {
    this.eventSink = sink;
  }

  private event(type: EngineEvent["type"], code: string, payload?: Record<string, unknown>): EngineEvent {
    return { type, code, payload };
  }

  private publish(events: EngineEvent[], code: string): void {
    this.eventSink?.(events, code);
  }

  private room(code: string): InternalRoom {
    const room = this.rooms.get(code);
    if (!room) throw new Error("ROOM_NOT_FOUND");
    return room;
  }

  private verifyHost(code: string, hostToken: string): InternalRoom {
    const room = this.room(code);
    if (room.hostToken !== hostToken) throw new Error("HOST_ONLY");
    return room;
  }

  private player(room: InternalRoom, playerId: string): InternalPlayer {
    const player = room.players.get(playerId);
    if (!player) throw new Error("PLAYER_NOT_FOUND");
    return player;
  }

  private viewPlayer(room: InternalRoom, player: InternalPlayer, winners: Set<string>): PlayerView {
    return {
      id: player.id,
      nickname: player.nickname,
      avatar: player.avatar,
      teamId: null,
      score: player.score,
      connected: player.connected,
      isLocal: player.isLocal,
      isActive: false,
      isEligible: true,
      isWinner: winners.has(player.id),
    };
  }

  private winnerIds(room: InternalRoom): Set<string> {
    if (room.phase !== "finished" || room.players.size === 0) return new Set();
    const scores = [...room.players.values()].map((player) => player.score);
    const max = Math.max(...scores);
    return new Set([...room.players.values()].filter((player) => player.score === max).map((player) => player.id));
  }

  private questionView(room: InternalRoom): BattleQuestionView | null {
    const question = room.currentQuestion;
    if (!question) return null;
    const reveal = room.phase === "reveal" || room.phase === "finished";
    return {
      id: question.record.id,
      category: question.record.category,
      difficulty: question.record.difficulty,
      prompt: question.prompt,
      language: room.config.language,
      options: question.options.map((text, index) => ({ index, text, color: CHOICE_COLORS[index] ?? "red" })),
      correctIndex: reveal ? question.correctIndex : null,
      explanation: reveal ? question.explanation : null,
      source: reveal ? question.source : null,
    };
  }

  private remaining(room: InternalRoom): number | null {
    if (room.turnEndsAt !== null) return Math.max(0, room.turnEndsAt - this.now());
    return room.remainingMs;
  }

  private clearTimer(room: InternalRoom): void {
    if (room.timer !== null) this.clearTimerFn(room.timer);
    room.timer = null;
  }

  private armQuestionTimer(room: InternalRoom): void {
    this.clearTimer(room);
    if (room.phase !== "question" || room.paused) return;
    const ms = Math.max(0, room.remainingMs ?? room.config.timerSeconds * 1000);
    room.turnEndsAt = this.now() + ms;
    room.timer = this.setTimer(() => this.onQuestionTimeout(room.code, room.roundIndex), ms);
  }

  private armRevealTimer(room: InternalRoom): void {
    this.clearTimer(room);
    if (room.phase !== "reveal") return;
    room.turnEndsAt = this.now() + REVEAL_MS;
    room.remainingMs = REVEAL_MS;
    room.timer = this.setTimer(() => this.onRevealTimeout(room.code, room.roundIndex), REVEAL_MS);
  }

  private onQuestionTimeout(code: string, roundIndex: number): void {
    const room = this.rooms.get(code);
    if (!room || room.phase !== "question" || room.paused || room.roundIndex !== roundIndex) return;
    this.publish(this.revealRound(room).events, code);
  }

  private onRevealTimeout(code: string, roundIndex: number): void {
    const room = this.rooms.get(code);
    if (!room || room.phase !== "reveal" || room.roundIndex !== roundIndex) return;
    this.publish(this.advance(room).events, code);
  }

  private candidatePool(room: InternalRoom): McqDistractorCandidate[] {
    return room.questionBank
      .filter((record) => record.approved && record.translations[room.config.language])
      .map((record) => {
        const translation = record.translations[room.config.language]!;
        return {
          id: record.id,
          answer: translation.answer,
          aliases: translation.aliases,
          category: record.category,
          difficulty: record.difficulty,
          prompt: translation.prompt,
          explanation: translation.explanation,
        };
      });
  }

  private prepareQuestions(room: InternalRoom): PreparedQuestion[] {
    const random = mulberry32(hashSeed(`${room.code}:${room.config.language}:battle`));
    const candidates = this.candidatePool(room);
    const matching = candidates.filter(
      (candidate) =>
        room.config.categories.includes(candidate.category) && room.config.difficulties.includes(candidate.difficulty),
    );
    const pool = shuffle(matching, random);
    const distractorPool = shuffle(candidates, random);

    return pool.slice(0, room.config.rounds).map((candidate) => {
      const record = room.questionBank.find((item) => item.id === candidate.id)!;
      const translation = record.translations[room.config.language]!;
      const choices = buildMcqChoices(candidate, distractorPool, FALLBACK_OPTIONS[room.config.language] ?? FALLBACK_OPTIONS.en, random);
      return {
        record,
        prompt: translation.prompt,
        answer: translation.answer,
        aliases: translation.aliases,
        explanation: translation.explanation,
        source: translation.source,
        options: choices.options,
        correctIndex: choices.correctIndex,
      };
    });
  }

  private questionEvent(room: InternalRoom): EngineEvent {
    return this.event("battle:question", room.code, {
      questionId: room.currentQuestion?.record.id ?? null,
      round: room.roundIndex + 1,
      totalRounds: room.selectedQuestions.length,
    });
  }

  private startQuestion(room: InternalRoom): void {
    room.currentQuestion = room.selectedQuestions[room.roundIndex] ?? null;
    room.answers = new Map();
    room.submissionKeys = new Set();
    room.results = [];
    room.turnEndsAt = null;
    room.remainingMs = room.config.timerSeconds * 1000;
    room.phase = "question";
    room.paused = false;
    this.armQuestionTimer(room);
  }

  private revealRound(room: InternalRoom): BattleEngineResult<BattleResult[]> {
    const question = room.currentQuestion;
    if (!question) throw new Error("NO_ACTIVE_QUESTION");
    const totalMs = room.config.timerSeconds * 1000;
    const results: BattleResult[] = [];

    this.clearTimer(room);
    for (const player of room.players.values()) {
      const answer = room.answers.get(player.id);
      const selectedIndex = answer?.selectedIndex ?? null;
      const correct = selectedIndex === question.correctIndex;
      const responseMs = answer ? answer.responseMs : totalMs;
      const scoring = scoreBattleAnswer({
        correct,
        remainingMs: totalMs - responseMs,
        totalMs,
        streakBefore: player.streak,
      });
      player.score += scoring.totalPoints;
      player.streak = scoring.streakCount;
      const selectedText = selectedIndex === null ? null : question.options[selectedIndex] ?? null;
      results.push({
        round: room.roundIndex + 1,
        playerId: player.id,
        playerName: player.nickname,
        correct,
        timedOut: !answer,
        skipped: false,
        answer: selectedText ?? "",
        explanation: question.explanation,
        source: question.source,
        pointsAwarded: scoring.totalPoints,
        penalty: 0,
        scoreDelta: scoring.totalPoints,
        selectedIndex,
        selectedText,
        correctIndex: question.correctIndex,
        choices: [...question.options],
        responseMs,
        speedBonus: scoring.speedBonus,
        streakBonus: scoring.streakBonus,
        streakCount: scoring.streakCount,
        totalPoints: scoring.totalPoints,
      });
    }

    room.results = results;
    room.history.push(...results);
    room.phase = "reveal";
    this.armRevealTimer(room);
    return {
      value: results,
      events: [this.event("battle:reveal", room.code, { questionId: question.record.id, results })],
    };
  }

  private advance(room: InternalRoom): BattleEngineResult<null> {
    this.clearTimer(room);
    if (room.roundIndex >= room.selectedQuestions.length - 1) {
      room.phase = "finished";
      room.turnEndsAt = null;
      room.remainingMs = null;
      return {
        value: null,
        events: [this.event("game:finished", room.code, { gameType: "battle", winners: [...this.winnerIds(room)] })],
      };
    }
    room.roundIndex += 1;
    this.startQuestion(room);
    return { value: null, events: [this.questionEvent(room)] };
  }

  createRoom(input: BattleCreateInput): BattleEngineResult<{ code: string; hostToken: string }> {
    let code = this.createCode();
    while (this.rooms.has(code)) code = this.createCode();
    const hostToken = this.createId("host");
    const room: InternalRoom = {
      code,
      hostToken,
      config: normalizeConfig(input.config),
      phase: "lobby",
      paused: false,
      players: new Map(),
      questionBank: input.questionBank,
      selectedQuestions: [],
      roundIndex: 0,
      currentQuestion: null,
      turnEndsAt: null,
      remainingMs: null,
      timer: null,
      answers: new Map(),
      submissionKeys: new Set(),
      results: [],
      history: [],
      createdAt: this.now(),
    };
    this.rooms.set(code, room);
    for (const candidate of input.localPlayers ?? []) {
      const playerId = this.createId("player");
      room.players.set(playerId, {
        id: playerId,
        token: this.createId("token"),
        nickname: cleanNickname(candidate.nickname),
        avatar: AVATARS.includes(candidate.avatar) ? candidate.avatar : "star",
        score: 0,
        streak: 0,
        connected: true,
        socketIds: new Set(),
        isLocal: true,
      });
    }
    return {
      value: { code, hostToken },
      events: [this.event("room:created", code, { gameType: "battle" })],
    };
  }

  joinRoom(code: string, input: { nickname: string; avatar: Avatar }): BattleEngineResult<{ playerId: string; token: string }> {
    const room = this.room(code);
    if (room.phase !== "lobby" && room.phase !== "finished") throw new Error("GAME_IN_PROGRESS");
    if (room.players.size >= 12) throw new Error("ROOM_FULL");
    const playerId = this.createId("player");
    const token = this.createId("token");
    room.players.set(playerId, {
      id: playerId,
      token,
      nickname: cleanNickname(input.nickname),
      avatar: AVATARS.includes(input.avatar) ? input.avatar : "star",
      score: 0,
      streak: 0,
      connected: true,
      socketIds: new Set(),
      isLocal: false,
    });
    return {
      value: { playerId, token },
      events: [this.event("player:joined", code, { playerId, nickname: cleanNickname(input.nickname) })],
    };
  }

  attachSocket(code: string, playerId: string, socketId: string): void {
    const player = this.player(this.room(code), playerId);
    player.socketIds.add(socketId);
    player.connected = true;
  }

  detachSocket(code: string, playerId: string, socketId: string): EngineEvent[] {
    const room = this.room(code);
    const player = this.player(room, playerId);
    player.socketIds.delete(socketId);
    player.connected = player.socketIds.size > 0 || player.isLocal;
    return [this.event("room:updated", code, { playerId, connected: player.connected })];
  }

  reconnect(code: string, token: string): BattleEngineResult<{ playerId: string; token: string }> {
    const room = this.room(code);
    const player = [...room.players.values()].find((item) => item.token === token);
    if (!player) throw new Error("INVALID_TOKEN");
    player.connected = true;
    return {
      value: { playerId: player.id, token },
      events: [this.event("player:reconnected", code, { playerId: player.id })],
    };
  }

  start(code: string, hostToken: string): BattleEngineResult<null> {
    const room = this.verifyHost(code, hostToken);
    if (room.phase !== "lobby" && room.phase !== "finished") throw new Error("GAME_IN_PROGRESS");
    const selected = this.prepareQuestions(room);
    if (!selected.length) throw new Error("NO_QUESTIONS");
    room.selectedQuestions = selected;
    room.roundIndex = 0;
    room.history = [];
    room.results = [];
    room.answers = new Map();
    room.submissionKeys = new Set();
    room.paused = false;
    for (const player of room.players.values()) {
      player.score = 0;
      player.streak = 0;
    }
    this.startQuestion(room);
    return {
      value: null,
      events: [this.event("room:started", code, { gameType: "battle" }), this.questionEvent(room)],
    };
  }

  submitAnswer(
    code: string,
    playerId: string,
    selectedIndex: number,
    idempotencyKey: string,
  ): BattleEngineResult<{ accepted: boolean; answerCount: number; responseMs: number }> {
    const room = this.room(code);
    if (room.phase !== "question" || room.paused) throw new Error("NO_ACTIVE_QUESTION");
    if ((this.remaining(room) ?? 0) <= 0) throw new Error("QUESTION_EXPIRED");
    if (room.submissionKeys.has(idempotencyKey)) throw new Error("DUPLICATE_SUBMISSION");
    const player = this.player(room, playerId);
    if (room.answers.has(player.id)) throw new Error("DUPLICATE_ANSWER");
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) throw new Error("INVALID_CHOICE");
    const totalMs = room.config.timerSeconds * 1000;
    const responseMs = Math.min(totalMs, Math.max(0, Math.round(totalMs - (this.remaining(room) ?? totalMs))));
    room.submissionKeys.add(idempotencyKey);
    room.answers.set(player.id, { playerId: player.id, selectedIndex, responseMs });
    return {
      value: { accepted: true, answerCount: room.answers.size, responseMs },
      events: [this.event("room:updated", code, { playerId: player.id, answerCount: room.answers.size })],
    };
  }

  skip(code: string, hostToken: string): BattleEngineResult<BattleResult[]> {
    const room = this.verifyHost(code, hostToken);
    if (room.phase !== "question") throw new Error("NO_ACTIVE_QUESTION");
    return this.revealRound(room);
  }

  next(code: string, hostToken: string): BattleEngineResult<null> {
    const room = this.verifyHost(code, hostToken);
    if (room.phase !== "reveal") throw new Error("NO_REVEAL_TO_ADVANCE");
    return this.advance(room);
  }

  pause(code: string, hostToken: string): BattleEngineResult<null> {
    const room = this.verifyHost(code, hostToken);
    if (room.phase !== "question") throw new Error("NO_ACTIVE_QUESTION");
    if (room.paused) return { value: null, events: [] };
    room.remainingMs = this.remaining(room);
    room.turnEndsAt = null;
    room.paused = true;
    this.clearTimer(room);
    return { value: null, events: [this.event("room:paused", code)] };
  }

  resume(code: string, hostToken: string): BattleEngineResult<null> {
    const room = this.verifyHost(code, hostToken);
    if (room.phase !== "question") throw new Error("NO_ACTIVE_QUESTION");
    if (!room.paused) return { value: null, events: [] };
    room.paused = false;
    this.armQuestionTimer(room);
    return { value: null, events: [this.event("room:resumed", code)] };
  }

  end(code: string, hostToken: string): BattleEngineResult<null> {
    const room = this.verifyHost(code, hostToken);
    if (room.phase === "finished") return { value: null, events: [] };
    this.clearTimer(room);
    room.phase = "finished";
    room.turnEndsAt = null;
    room.remainingMs = null;
    room.paused = false;
    return {
      value: null,
      events: [this.event("game:finished", code, { gameType: "battle", winners: [...this.winnerIds(room)] })],
    };
  }

  getHostToken(code: string): string | null {
    return this.rooms.get(code)?.hostToken ?? null;
  }

  getPlayerIdByToken(code: string, token: string): string | null {
    const room = this.rooms.get(code);
    if (!room) return null;
    return [...room.players.values()].find((player) => player.token === token)?.id ?? null;
  }

  isLocalPlayer(code: string, playerId: string): boolean {
    return Boolean(this.rooms.get(code)?.players.get(playerId)?.isLocal);
  }

  private answerView(room: InternalRoom, playerToken?: string | null): BattleAnswerView | null {
    if (!playerToken) return null;
    const player = [...room.players.values()].find((item) => item.token === playerToken);
    if (!player) return null;
    if (room.phase === "question") {
      const answer = room.answers.get(player.id);
      return {
        answered: Boolean(answer),
        selectedIndex: answer?.selectedIndex ?? null,
        correct: null,
        points: 0,
        responseMs: answer?.responseMs ?? null,
      };
    }
    const result = room.results.find((item) => item.playerId === player.id);
    if (!result) return { answered: false, selectedIndex: null, correct: null, points: 0, responseMs: null };
    return {
      answered: result.selectedIndex !== null,
      selectedIndex: result.selectedIndex,
      correct: result.correct,
      points: result.totalPoints,
      responseMs: result.selectedIndex !== null ? result.responseMs : null,
    };
  }

  getSnapshot(code: string, options: { hostToken?: string | null; playerToken?: string | null } = {}): BattleRoomSnapshot {
    const room = this.room(code);
    const winners = this.winnerIds(room);
    const hostValid = Boolean(options.hostToken && options.hostToken === room.hostToken);
    const playerToken = options.playerToken && this.getPlayerIdByToken(code, options.playerToken) ? options.playerToken : null;
    return {
      code: room.code,
      gameType: "battle",
      phase: room.phase,
      paused: room.paused,
      config: { ...room.config, categories: [...room.config.categories], difficulties: [...room.config.difficulties] },
      roundIndex: room.roundIndex,
      totalRounds: room.selectedQuestions.length || room.config.rounds,
      question: this.questionView(room),
      turnEndsAt: room.turnEndsAt,
      remainingMs: this.remaining(room),
      answerCount: room.answers.size,
      players: [...room.players.values()].map((player) => this.viewPlayer(room, player, winners)),
      myAnswer: this.answerView(room, playerToken),
      results: room.phase === "question" ? [] : [...room.results],
      history: [...room.history],
      winners: [...winners],
      hostToken: hostValid ? room.hostToken : null,
      playerToken,
    };
  }
}
