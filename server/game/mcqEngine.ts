import { randomBytes } from "node:crypto";
import {
  AVATARS,
  CATEGORIES,
  DIFFICULTIES,
  type Avatar,
  type EngineEvent,
  type PlayerView,
  type QuestionRecord,
} from "@/lib/domain";
import {
  MCQ_DEFAULT_CONFIG,
  MCQ_LADDER,
  MCQ_MILESTONES,
  type McqConfig,
  type McqCreateInput,
  type McqQuestionView,
  type McqResult,
  type McqRoomSnapshot,
} from "@/lib/mcqDomain";
import { buildMcqChoices, type McqDistractorCandidate } from "./mcqDistractors";

interface InternalPlayer {
  id: string;
  token: string;
  nickname: string;
  avatar: Avatar;
  teamId: string | null;
  score: number;
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
  hostId: string;
  config: McqConfig;
  phase: McqRoomSnapshot["phase"];
  paused: boolean;
  players: Map<string, InternalPlayer>;
  questionBank: QuestionRecord[];
  selectedQuestions: PreparedQuestion[];
  roundIndex: number;
  currentQuestion: PreparedQuestion | null;
  eliminated: Set<number>;
  activePlayerId: string | null;
  turnEndsAt: number | null;
  remainingMs: number | null;
  timer: unknown | null;
  fiftyFiftyUsed: boolean;
  bankedPoints: number;
  lastResult: McqResult | null;
  history: McqResult[];
  submissionKeys: Set<string>;
  createdAt: number;
}

export interface McqEngineOptions {
  now?: () => number;
  random?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  createCode?: () => string;
  createId?: (prefix: string) => string;
}

export interface McqEngineResult<T> {
  value: T;
  events: EngineEvent[];
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const FALLBACK_OPTIONS: Record<McqConfig["language"], string[]> = {
  en: ["None of the above", "All of the above", "Not specified", "Unknown"],
  tr: ["Hiçbiri", "Hepsi", "Belirtilmedi", "Bilinmiyor"],
};

function defaultCode(): string {
  const bytes = randomBytes(5);
  return `MQ${Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("")}`;
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

function normalizeConfig(input: Partial<McqConfig> | undefined): McqConfig {
  const merged = { ...MCQ_DEFAULT_CONFIG, ...(input ?? {}) };
  const validTimers = [15, 30, 45, 60];
  return {
    categories: merged.categories.length ? [...merged.categories] : [...CATEGORIES],
    difficulties: merged.difficulties.length ? [...merged.difficulties] : [...DIFFICULTIES],
    timerSeconds: validTimers.includes(merged.timerSeconds) ? merged.timerSeconds : 30,
    language: merged.language === "tr" ? "tr" : "en",
  };
}

function cleanNickname(value: string): string {
  return value.replace(/[<>{}]/g, "").trim().slice(0, 18) || "Player";
}

function milestoneFor(roundIndex: number): number {
  const reached = MCQ_MILESTONES.filter((index) => roundIndex >= index);
  return reached.length ? MCQ_LADDER[reached[reached.length - 1]!]! : 0;
}

export class McqEngine {
  private rooms = new Map<string, InternalRoom>();
  private now: () => number;
  private random: () => number;
  private setTimer: (callback: () => void, ms: number) => unknown;
  private clearTimerFn: (handle: unknown) => void;
  private createCode: () => string;
  private createId: (prefix: string) => string;

  constructor(options: McqEngineOptions = {}) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    this.clearTimerFn = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.createCode = options.createCode ?? defaultCode;
    this.createId = options.createId ?? ((prefix) => defaultId(prefix));
  }

  private event(type: EngineEvent["type"], code: string, payload?: Record<string, unknown>): EngineEvent {
    return { type, code, payload };
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
      teamId: player.teamId,
      score: player.score,
      connected: player.connected,
      isLocal: player.isLocal,
      isActive: room.activePlayerId === player.id,
      isEligible: room.activePlayerId === player.id,
      isWinner: winners.has(player.id),
    };
  }

  private winnerIds(room: InternalRoom): Set<string> {
    if (room.phase !== "finished" || room.players.size === 0) return new Set();
    const scores = [...room.players.values()].map((player) => player.score);
    const max = Math.max(...scores);
    return new Set([...room.players.values()].filter((player) => player.score === max).map((player) => player.id));
  }

  private questionView(room: InternalRoom, includeAnswer = false): McqQuestionView | null {
    const question = room.currentQuestion;
    if (!question) return null;
    const reveal = includeAnswer || room.phase === "answer_result" || room.phase === "finished";
    return {
      id: question.record.id,
      category: question.record.category,
      difficulty: question.record.difficulty,
      prompt: question.prompt,
      language: room.config.language,
      options: question.options.map((text, index) => ({
        index,
        text,
        eliminated: room.eliminated.has(index),
      })),
      correctIndex: reveal ? question.correctIndex : null,
      explanation: reveal ? question.explanation : null,
      source: reveal ? question.source : null,
    };
  }

  private remaining(room: InternalRoom): number | null {
    if (!room.turnEndsAt) return room.remainingMs;
    return Math.max(0, room.turnEndsAt - this.now());
  }

  private clearTimer(room: InternalRoom): void {
    if (room.timer !== null) this.clearTimerFn(room.timer);
    room.timer = null;
  }

  private armTimer(room: InternalRoom): void {
    this.clearTimer(room);
    if (room.phase !== "question" || room.paused) return;
    const ms = Math.max(0, room.remainingMs ?? room.config.timerSeconds * 1000);
    room.turnEndsAt = this.now() + ms;
    room.timer = this.setTimer(() => this.onTimeout(room.code), ms);
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
    const random = mulberry32(hashSeed(`${room.code}:${room.config.language}:mcq`));
    const candidates = this.candidatePool(room);
    const matching = candidates.filter(
      (candidate) =>
        room.config.categories.includes(candidate.category) && room.config.difficulties.includes(candidate.difficulty),
    );
    const pool = [...shuffle(matching, random), ...shuffle(candidates.filter((item) => !matching.includes(item)), random)];
    const distractorPool = shuffle(candidates, random);

    return pool.slice(0, MCQ_LADDER.length).map((candidate) => {
      const record = room.questionBank.find((item) => item.id === candidate.id)!;
      const translation = record.translations[room.config.language]!;
      const choices = buildMcqChoices(candidate, distractorPool, FALLBACK_OPTIONS[room.config.language], random);
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

  private startQuestion(room: InternalRoom): void {
    room.currentQuestion = room.selectedQuestions[room.roundIndex] ?? null;
    room.eliminated = new Set();
    room.turnEndsAt = null;
    room.remainingMs = room.config.timerSeconds * 1000;
    room.phase = "question";
    this.armTimer(room);
  }

  private onTimeout(code: string): void {
    const room = this.rooms.get(code);
    if (!room || room.phase !== "question" || room.paused || !room.activePlayerId) return;
    this.resolve(code, room.activePlayerId, null, true, `timeout:${room.roundIndex}`);
  }

  private resolve(code: string, playerId: string, choice: number | null, timedOut: boolean, key: string): McqEngineResult<McqResult> {
    const room = this.room(code);
    if (room.phase !== "question") throw new Error("NO_ACTIVE_QUESTION");
    if (room.activePlayerId !== playerId) throw new Error("NOT_CONTESTANT");
    if (room.submissionKeys.has(key)) throw new Error("DUPLICATE_SUBMISSION");
    if (choice !== null && (choice < 0 || choice > 3 || room.eliminated.has(choice))) throw new Error("INVALID_CHOICE");
    const question = room.currentQuestion;
    if (!question) throw new Error("NO_ACTIVE_QUESTION");

    room.submissionKeys.add(key);
    this.clearTimer(room);
    room.turnEndsAt = null;
    room.remainingMs = null;

    const player = this.player(room, playerId);
    const correct = choice === question.correctIndex;
    const previousScore = player.score;
    const currentValue = MCQ_LADDER[room.roundIndex]!;

    if (correct) {
      room.bankedPoints = currentValue;
      player.score = currentValue;
    } else {
      room.bankedPoints = Math.max(room.bankedPoints, milestoneFor(room.roundIndex));
      player.score = room.bankedPoints;
    }

    const result: McqResult = {
      round: room.roundIndex + 1,
      playerId: player.id,
      playerName: player.nickname,
      correct,
      timedOut,
      skipped: false,
      answer: question.answer,
      explanation: question.explanation,
      source: question.source,
      pointsAwarded: correct ? currentValue : 0,
      penalty: 0,
      scoreDelta: player.score - previousScore,
      selectedIndex: choice,
      selectedText: choice === null ? null : question.options[choice] ?? null,
      correctIndex: question.correctIndex,
      bankedPoints: room.bankedPoints,
      choices: [...question.options],
    };
    room.lastResult = result;
    room.history.push(result);

    const events = [this.event("answer:result", code, { result, questionId: question.record.id, gameType: "millionaire" })];
    const isLastQuestion = room.roundIndex >= room.selectedQuestions.length - 1;
    if (correct && !isLastQuestion) {
      room.phase = "answer_result";
    } else {
      room.phase = "finished";
      events.push(this.event("game:finished", code, { gameType: "millionaire", winnerId: player.id }));
    }
    return { value: result, events };
  }

  createRoom(input: McqCreateInput): McqEngineResult<{ code: string; hostToken: string }> {
    let code = this.createCode();
    while (this.rooms.has(code)) code = this.createCode();
    const hostToken = this.createId("host");
    const hostId = this.createId("host-player");
    const room: InternalRoom = {
      code,
      hostToken,
      hostId,
      config: normalizeConfig(input.config),
      phase: "lobby",
      paused: false,
      players: new Map(),
      questionBank: input.questionBank,
      selectedQuestions: [],
      roundIndex: 0,
      currentQuestion: null,
      eliminated: new Set(),
      activePlayerId: null,
      turnEndsAt: null,
      remainingMs: null,
      timer: null,
      fiftyFiftyUsed: false,
      bankedPoints: 0,
      lastResult: null,
      history: [],
      submissionKeys: new Set(),
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
        teamId: candidate.teamId ?? null,
        score: 0,
        connected: true,
        socketIds: new Set(),
        isLocal: true,
      });
    }
    return {
      value: { code, hostToken },
      events: [this.event("room:created", code, { gameType: "millionaire" })],
    };
  }

  joinRoom(code: string, input: { nickname: string; avatar: Avatar; teamId?: string | null }): McqEngineResult<{ playerId: string; token: string }> {
    const room = this.room(code);
    if (room.phase !== "lobby" && room.phase !== "contestant" && room.phase !== "finished") throw new Error("GAME_IN_PROGRESS");
    if (room.players.size >= 12) throw new Error("ROOM_FULL");
    const playerId = this.createId("player");
    const token = this.createId("token");
    room.players.set(playerId, {
      id: playerId,
      token,
      nickname: cleanNickname(input.nickname),
      avatar: AVATARS.includes(input.avatar) ? input.avatar : "star",
      teamId: input.teamId ?? null,
      score: 0,
      connected: true,
      socketIds: new Set(),
      isLocal: false,
    });
    return {
      value: { playerId, token },
      events: [this.event("player:joined", code, { playerId, nickname: cleanNickname(input.nickname) })],
    };
  }

  addLocalPlayer(code: string, input: { nickname: string; avatar: Avatar; teamId?: string | null }): McqEngineResult<{ playerId: string }> {
    const room = this.room(code);
    if (room.phase !== "lobby" && room.phase !== "contestant" && room.phase !== "finished") throw new Error("GAME_IN_PROGRESS");
    if (room.players.size >= 12) throw new Error("ROOM_FULL");
    const playerId = this.createId("player");
    room.players.set(playerId, {
      id: playerId,
      token: this.createId("token"),
      nickname: cleanNickname(input.nickname),
      avatar: AVATARS.includes(input.avatar) ? input.avatar : "star",
      teamId: input.teamId ?? null,
      score: 0,
      connected: true,
      socketIds: new Set(),
      isLocal: true,
    });
    return {
      value: { playerId },
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

  reconnect(code: string, token: string): McqEngineResult<{ playerId: string; token: string }> {
    const room = this.room(code);
    const player = [...room.players.values()].find((item) => item.token === token);
    if (!player) throw new Error("INVALID_TOKEN");
    player.connected = true;
    return {
      value: { playerId: player.id, token },
      events: [this.event("player:reconnected", code, { playerId: player.id })],
    };
  }

  selectContestant(code: string, hostToken: string, playerId: string): McqEngineResult<null> {
    const room = this.verifyHost(code, hostToken);
    if (room.phase === "question" || room.phase === "answer_result") throw new Error("RUN_IN_PROGRESS");
    this.player(room, playerId);
    room.activePlayerId = playerId;
    room.phase = "contestant";
    room.currentQuestion = null;
    room.lastResult = null;
    room.roundIndex = 0;
    room.bankedPoints = 0;
    room.fiftyFiftyUsed = false;
    room.eliminated = new Set();
    room.selectedQuestions = [];
    return { value: null, events: [this.event("room:updated", code, { activePlayerId: playerId })] };
  }

  startRun(code: string, hostToken: string): McqEngineResult<null> {
    const room = this.verifyHost(code, hostToken);
    if (room.phase !== "contestant" || !room.activePlayerId) throw new Error("SELECT_CONTESTANT_FIRST");
    const selected = this.prepareQuestions(room);
    if (!selected.length) throw new Error("NO_QUESTIONS");
    room.selectedQuestions = selected;
    room.roundIndex = 0;
    room.bankedPoints = 0;
    room.fiftyFiftyUsed = false;
    room.submissionKeys = new Set();
    room.history = [];
    room.lastResult = null;
    room.paused = false;
    this.startQuestion(room);
    return {
      value: null,
      events: [
        this.event("room:started", code, { gameType: "millionaire", activePlayerId: room.activePlayerId }),
        this.event("round:available", code, { round: 1, totalRounds: room.selectedQuestions.length }),
      ],
    };
  }

  useFiftyFifty(code: string, playerId: string): McqEngineResult<null> {
    const room = this.room(code);
    if (room.phase !== "question") throw new Error("NO_ACTIVE_QUESTION");
    if (room.activePlayerId !== playerId) throw new Error("NOT_CONTESTANT");
    if (room.fiftyFiftyUsed) throw new Error("LIFELINE_USED");
    const question = room.currentQuestion;
    if (!question) throw new Error("NO_ACTIVE_QUESTION");
    const wrong = [0, 1, 2, 3].filter((index) => index !== question.correctIndex);
    const random = mulberry32(hashSeed(`${room.code}:${room.roundIndex}:${playerId}:fifty-fifty`));
    room.eliminated = new Set(shuffle(wrong, random).slice(0, 2));
    room.fiftyFiftyUsed = true;
    return {
      value: null,
      events: [this.event("letter:revealed", code, { lifeline: "fifty-fifty", eliminated: [...room.eliminated] })],
    };
  }

  answer(code: string, playerId: string, choice: number, idempotencyKey: string): McqEngineResult<McqResult> {
    return this.resolve(code, playerId, choice, false, idempotencyKey);
  }

  reveal(code: string, hostToken: string): McqEngineResult<McqResult> {
    const room = this.verifyHost(code, hostToken);
    if (!room.activePlayerId) throw new Error("NO_CONTESTANT");
    return this.resolve(code, room.activePlayerId, null, true, `reveal:${room.roundIndex}`);
  }

  nextQuestion(code: string, hostToken: string): McqEngineResult<null> {
    const room = this.verifyHost(code, hostToken);
    if (room.phase !== "answer_result") throw new Error("NO_RESULT_TO_ADVANCE");
    if (room.roundIndex >= room.selectedQuestions.length - 1) throw new Error("LAST_QUESTION");
    room.roundIndex += 1;
    this.startQuestion(room);
    return {
      value: null,
      events: [this.event("round:available", code, { round: room.roundIndex + 1, totalRounds: room.selectedQuestions.length })],
    };
  }

  resetRun(code: string, hostToken: string): McqEngineResult<null> {
    const room = this.verifyHost(code, hostToken);
    if (room.phase !== "finished") throw new Error("RUN_NOT_FINISHED");
    this.clearTimer(room);
    room.phase = "contestant";
    room.activePlayerId = null;
    room.currentQuestion = null;
    room.selectedQuestions = [];
    room.roundIndex = 0;
    room.bankedPoints = 0;
    room.fiftyFiftyUsed = false;
    room.eliminated = new Set();
    room.lastResult = null;
    room.turnEndsAt = null;
    room.remainingMs = null;
    room.submissionKeys = new Set();
    return { value: null, events: [this.event("room:updated", code, { resetRun: true })] };
  }

  pause(code: string, hostToken: string): McqEngineResult<null> {
    const room = this.verifyHost(code, hostToken);
    if (room.phase !== "question") throw new Error("NO_ACTIVE_QUESTION");
    if (room.paused) return { value: null, events: [] };
    room.remainingMs = this.remaining(room);
    room.turnEndsAt = null;
    room.paused = true;
    this.clearTimer(room);
    return { value: null, events: [this.event("room:paused", code)] };
  }

  resume(code: string, hostToken: string): McqEngineResult<null> {
    const room = this.verifyHost(code, hostToken);
    if (room.phase !== "question") throw new Error("NO_ACTIVE_QUESTION");
    if (!room.paused) return { value: null, events: [] };
    room.paused = false;
    this.armTimer(room);
    return { value: null, events: [this.event("room:resumed", code)] };
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

  getSnapshot(code: string, options: { hostToken?: string | null; playerToken?: string | null } = {}): McqRoomSnapshot {
    const room = this.room(code);
    const winners = this.winnerIds(room);
    const currentValue = MCQ_LADDER[Math.min(room.roundIndex, MCQ_LADDER.length - 1)]!;
    return {
      code: room.code,
      gameType: "millionaire",
      phase: room.phase,
      paused: room.paused,
      config: { ...room.config, categories: [...room.config.categories], difficulties: [...room.config.difficulties] },
      players: [...room.players.values()].map((player) => this.viewPlayer(room, player, winners)),
      question: this.questionView(room, Boolean(options.hostToken && options.hostToken === room.hostToken)),
      roundIndex: room.roundIndex,
      totalRounds: room.selectedQuestions.length || MCQ_LADDER.length,
      activePlayerId: room.activePlayerId,
      currentValue,
      bankedPoints: room.bankedPoints,
      safeValue: Math.max(room.bankedPoints, milestoneFor(room.roundIndex)),
      eliminated: [...room.eliminated],
      fiftyFiftyUsed: room.fiftyFiftyUsed,
      turnEndsAt: room.turnEndsAt,
      remainingMs: this.remaining(room),
      lastResult: room.lastResult,
      history: [...room.history],
      winners: [...winners],
      hostToken: options.hostToken && options.hostToken === room.hostToken ? room.hostToken : null,
      playerToken:
        options.playerToken && [...room.players.values()].some((player) => player.token === options.playerToken)
          ? options.playerToken
          : null,
    };
  }
}
