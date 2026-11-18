import { randomBytes } from "node:crypto";
import {
  AVATARS,
  DEFAULT_CONFIG,
  type Avatar,
  type EngineEvent,
  type GameConfig,
  type PlayerView,
  type QuestionRecord,
  type QuestionView,
  type RoomSnapshot,
  type RoundResult,
  type TileView,
} from "@/lib/domain";
import {
  answersMatch,
  applyPenalty,
  availablePoints,
  buildTiles,
  calculateAward,
  pickUnrevealedIndex,
  revealableCount,
} from "@/lib/scoring";

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

interface InternalRoom {
  code: string;
  hostToken: string;
  hostId: string;
  config: GameConfig;
  phase: RoomSnapshot["phase"];
  paused: boolean;
  players: Map<string, InternalPlayer>;
  questionBank: QuestionRecord[];
  selectedQuestions: QuestionRecord[];
  roundIndex: number;
  currentQuestion: QuestionRecord | null;
  currentTiles: TileView[];
  revealed: Set<number>;
  ineligible: Set<string>;
  eligible: Set<string>;
  activePlayerId: string | null;
  turnEndsAt: number | null;
  remainingMs: number | null;
  timer: unknown | null;
  lastResult: RoundResult | null;
  history: RoundResult[];
  submissionKeys: Set<string>;
  createdAt: number;
}

export interface EngineOptions {
  now?: () => number;
  random?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  createCode?: () => string;
  createId?: (prefix: string) => string;
}

export interface EngineResult<T> {
  value: T;
  events: EngineEvent[];
}

export interface CreateRoomInput {
  questionBank: QuestionRecord[];
  config?: Partial<GameConfig>;
  localPlayers?: Array<{ nickname: string; avatar: Avatar; teamId?: string | null }>;
}

export interface JoinInput {
  nickname: string;
  avatar: Avatar;
  teamId?: string | null;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function defaultCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function defaultId(prefix: string): () => string {
  return () => `${prefix}_${randomBytes(9).toString("base64url")}`;
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

function normalizeConfig(input: Partial<GameConfig> | undefined): GameConfig {
  const merged = { ...DEFAULT_CONFIG, ...(input ?? {}) };
  const validTimers = [15, 30, 45, 60];
  return {
    ...merged,
    categories: merged.categories.length ? [...merged.categories] : [...DEFAULT_CONFIG.categories],
    difficulties: merged.difficulties.length ? [...merged.difficulties] : [...DEFAULT_CONFIG.difficulties],
    timerSeconds: validTimers.includes(merged.timerSeconds) ? merged.timerSeconds : 30,
    rounds: Math.max(1, Math.min(50, Math.floor(merged.rounds))),
    penalty: Math.max(0, Math.min(200, Math.floor(merged.penalty))),
  };
}

function cleanNickname(value: string): string {
  const cleaned = value.replace(/[<>{}]/g, "").trim().slice(0, 18);
  return cleaned || "Player";
}

export class GameEngine {
  private rooms = new Map<string, InternalRoom>();
  private now: () => number;
  private random: () => number;
  private setTimer: (callback: () => void, ms: number) => unknown;
  private clearTimerFn: (handle: unknown) => void;
  private createCode: () => string;
  private createId: (prefix: string) => string;

  constructor(options: EngineOptions = {}) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    this.clearTimerFn = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.createCode = options.createCode ?? defaultCode;
    this.createId = options.createId ?? ((prefix) => defaultId(prefix)());
  }

  private event(type: EngineEvent["type"], code: string, payload?: Record<string, unknown>): EngineEvent {
    return { type, code, payload };
  }

  private code(input: string): string {
    return input.trim().toUpperCase();
  }

  private getRoom(code: string): InternalRoom {
    const room = this.rooms.get(this.code(code));
    if (!room) throw new Error("ROOM_NOT_FOUND");
    return room;
  }

  private assertHost(room: InternalRoom, hostToken: string): void {
    if (hostToken !== room.hostToken) throw new Error("HOST_ONLY");
  }

  private findPlayer(room: InternalRoom, playerId: string): InternalPlayer {
    const player = room.players.get(playerId);
    if (!player) throw new Error("PLAYER_NOT_FOUND");
    return player;
  }

  private clearRoomTimer(room: InternalRoom): void {
    if (room.timer !== null) {
      this.clearTimerFn(room.timer);
      room.timer = null;
    }
  }

  private translation(room: InternalRoom): { prompt: string; answer: string; aliases: string[]; explanation: string; source: string | null } | null {
    const record = room.currentQuestion;
    if (!record) return null;
    const value = record.translations[room.config.language] ?? Object.values(record.translations)[0];
    if (!value) return null;
    return value;
  }

  private questionView(room: InternalRoom): QuestionView | null {
    const record = room.currentQuestion;
    const value = this.translation(room);
    if (!record || !value) return null;
    return {
      id: record.id,
      category: record.category,
      difficulty: record.difficulty,
      prompt: value.prompt,
      language: room.config.language,
      tiles: room.currentTiles.map((tile) => ({
        position: tile.position,
        char: room.revealed.has(tile.position) ? tile.char : null,
        revealable: tile.revealable,
        revealed: room.revealed.has(tile.position),
      })),
      answerLength: revealableCount(room.currentTiles),
      explanation: "",
      source: null,
    };
  }

  private playerView(room: InternalRoom, player: InternalPlayer): PlayerView {
    const winners = this.winners(room);
    return {
      id: player.id,
      nickname: player.nickname,
      avatar: player.avatar,
      teamId: player.teamId,
      score: player.score,
      connected: player.connected,
      isLocal: player.isLocal,
      isActive: room.activePlayerId === player.id,
      isEligible: room.eligible.has(player.id),
      isWinner: winners.includes(player.id),
    };
  }

  private winners(room: InternalRoom): string[] {
    if (room.phase !== "finished") return [];
    const players = [...room.players.values()];
    if (!players.length) return [];
    const top = Math.max(...players.map((player) => player.score));
    return players.filter((player) => player.score === top).map((player) => player.id);
  }

  private selectQuestions(room: InternalRoom): QuestionRecord[] {
    const pool = room.questionBank.filter((question) => {
      const hasLanguage = Boolean(question.translations[room.config.language]);
      return (
        question.approved &&
        hasLanguage &&
        room.config.categories.includes(question.category) &&
        room.config.difficulties.includes(question.difficulty)
      );
    });
    const fallback = room.questionBank.filter(
      (question) => question.approved && Boolean(question.translations[room.config.language]),
    );
    const source = pool.length >= room.config.rounds ? pool : fallback;
    if (!source.length) throw new Error("NO_QUESTIONS");
    const seedSource =
      room.config.mode === "daily"
        ? `daily-${new Date(this.now()).toISOString().slice(0, 10)}`
        : `${room.code}-${room.config.mode}`;
    const rng = mulberry32(hashSeed(seedSource));
    const shuffled = [...source];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(rng() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    return shuffled.slice(0, Math.min(room.config.rounds, shuffled.length));
  }

  private armTimer(room: InternalRoom, events: EngineEvent[]): void {
    this.clearRoomTimer(room);
    if (room.paused) return;
    const duration = room.config.timerSeconds * 1000;
    const remaining = room.remainingMs ?? duration;
    room.turnEndsAt = this.now() + remaining;
    room.timer = this.setTimer(() => {
      this.tickRoom(room.code);
    }, remaining);
    events.push(this.event("room:updated", room.code, { remainingMs: remaining }));
  }

  private startRound(room: InternalRoom, events: EngineEvent[]): void {
    const record = room.selectedQuestions[room.roundIndex];
    this.clearRoomTimer(room);
    room.currentQuestion = record ?? null;
    const value = this.translation(room);
    room.currentTiles = value ? buildTiles(value.answer) : [];
    room.revealed.clear();
    room.ineligible.clear();
    room.eligible = new Set(
      [...room.players.values()]
        .filter((player) => player.connected)
        .map((player) => player.id),
    );
    room.activePlayerId = null;
    room.turnEndsAt = null;
    room.remainingMs = null;
    room.lastResult = null;
    room.submissionKeys.clear();
    if (!record || !value || room.eligible.size === 0) {
      room.phase = "round_result";
      events.push(this.event("round:finished", room.code, { reason: "no_players" }));
      return;
    }
    room.phase = "buzzer_open";
    events.push(
      this.event("round:available", room.code, {
        round: room.roundIndex + 1,
        total: room.selectedQuestions.length,
        category: record.category,
        difficulty: record.difficulty,
      }),
    );
  }

  private finishGame(room: InternalRoom, events: EngineEvent[]): void {
    room.phase = "finished";
    this.clearRoomTimer(room);
    events.push(
      this.event("game:finished", room.code, {
        winners: this.winners(room),
        scores: [...room.players.values()].map((player) => ({
          id: player.id,
          nickname: player.nickname,
          score: player.score,
        })),
      }),
    );
  }

  private closeRound(room: InternalRoom, result: RoundResult, events: EngineEvent[]): void {
    room.lastResult = result;
    room.history.push(result);
    this.clearRoomTimer(room);
    room.activePlayerId = null;
    room.turnEndsAt = null;
    room.remainingMs = null;
    room.phase = "round_result";
    events.push(
      this.event("answer:result", room.code, {
        result: { ...result },
        questionId: room.currentQuestion?.id ?? null,
      }),
    );
    if (room.roundIndex >= room.selectedQuestions.length - 1) {
      this.finishGame(room, events);
    }
  }

  private continueQuestion(room: InternalRoom, result: RoundResult, events: EngineEvent[]): void {
    this.clearRoomTimer(room);
    room.activePlayerId = null;
    room.turnEndsAt = null;
    room.remainingMs = null;
    events.push(
      this.event("answer:result", room.code, {
        result: { ...result },
        questionId: room.currentQuestion?.id ?? null,
        continue: true,
      }),
    );
    if (room.eligible.size === 0) {
      const value = this.translation(room);
      this.closeRound(
        room,
        {
          ...result,
          skipped: true,
          pointsAwarded: 0,
          penalty: 0,
          scoreDelta: 0,
          answer: value?.answer ?? "",
        },
        events,
      );
      return;
    }
    room.lastResult = result;
    room.history.push(result);
    room.phase = "buzzer_open";
  }

  private tickRoom(code: string): EngineEvent[] {
    const events: EngineEvent[] = [];
    const normalized = this.code(code);
    const room = this.rooms.get(normalized);
    if (!room || room.phase !== "answering" || room.paused) return events;
    if (this.now() < (room.turnEndsAt ?? 0)) {
      events.push(...this.tickRoomLater(normalized));
      return events;
    }
    const key = `timeout:${room.roundIndex}:${room.activePlayerId ?? "none"}`;
    if (room.submissionKeys.has(key)) return events;
    this.applyIncorrect(room, true, key, events);
    return events;
  }

  private tickRoomLater(code: string): EngineEvent[] {
    const room = this.rooms.get(code);
    if (!room || room.phase !== "answering") return [];
    room.timer = this.setTimer(() => {
      this.tickRoom(code);
    }, Math.max(50, (room.turnEndsAt ?? this.now()) - this.now()));
    return [];
  }

  private applyIncorrect(
    room: InternalRoom,
    timedOut: boolean,
    idempotencyKey: string,
    events: EngineEvent[],
  ): void {
    if (room.phase !== "answering") return;
    const activeId = room.activePlayerId;
    if (!activeId) return;
    room.submissionKeys.add(idempotencyKey);
    const player = this.findPlayer(room, activeId);
    const value = this.translation(room);
    const penalty = room.config.penalty;
    const scoreBefore = player.score;
    player.score = applyPenalty(player.score, penalty);
    room.ineligible.add(player.id);
    room.eligible.delete(player.id);
    const result: RoundResult = {
      round: room.roundIndex + 1,
      playerId: player.id,
      playerName: player.nickname,
      correct: false,
      timedOut,
      skipped: false,
      answer: value?.answer ?? "",
      explanation: value?.explanation ?? "",
      source: value?.source ?? null,
      pointsAwarded: 0,
      penalty: scoreBefore - player.score,
      scoreDelta: player.score - scoreBefore,
    };
    events.push(this.event("turn:timeout", room.code, { playerId: player.id, timedOut }));
    this.continueQuestion(room, result, events);
  }

  public createRoom(input: CreateRoomInput): EngineResult<{ code: string; hostToken: string; hostId: string }> {
    const events: EngineEvent[] = [];
    let code = this.createCode().toUpperCase();
    while (this.rooms.has(code)) code = this.createCode().toUpperCase();
    const hostToken = randomBytes(12).toString("base64url");
    const room: InternalRoom = {
      code,
      hostToken,
      hostId: `host_${randomBytes(6).toString("base64url")}`,
      config: normalizeConfig(input.config),
      phase: "lobby",
      paused: false,
      players: new Map(),
      questionBank: input.questionBank,
      selectedQuestions: [],
      roundIndex: 0,
      currentQuestion: null,
      currentTiles: [],
      revealed: new Set(),
      ineligible: new Set(),
      eligible: new Set(),
      activePlayerId: null,
      turnEndsAt: null,
      remainingMs: null,
      timer: null,
      lastResult: null,
      history: [],
      submissionKeys: new Set(),
      createdAt: this.now(),
    };
    for (const local of input.localPlayers ?? []) {
      this.addLocalPlayerToRoom(room, local, events);
    }
    this.rooms.set(code, room);
    events.push(this.event("room:created", code, { hostToken }));
    return { value: { code, hostToken, hostId: room.hostId }, events };
  }

  private addLocalPlayerToRoom(
    room: InternalRoom,
    input: { nickname: string; avatar: Avatar; teamId?: string | null },
    events: EngineEvent[],
  ): InternalPlayer {
    if (room.players.size >= 6) throw new Error("ROOM_FULL");
    if (!AVATARS.includes(input.avatar)) throw new Error("INVALID_AVATAR");
    const id = this.createId("ply");
    const player: InternalPlayer = {
      id,
      token: randomBytes(12).toString("base64url"),
      nickname: cleanNickname(input.nickname),
      avatar: input.avatar,
      teamId: input.teamId ?? null,
      score: 0,
      connected: true,
      socketIds: new Set(),
      isLocal: true,
    };
    room.players.set(id, player);
    events.push(this.event("player:joined", room.code, { playerId: player.id, nickname: player.nickname, local: true }));
    return player;
  }

  public addLocalPlayer(code: string, input: JoinInput): EngineResult<{ playerId: string; token: string }> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    const player = this.addLocalPlayerToRoom(room, input, events);
    return { value: { playerId: player.id, token: player.token }, events };
  }

  public joinRoom(code: string, input: JoinInput): EngineResult<{ playerId: string; token: string }> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    if (room.phase !== "lobby") throw new Error("GAME_STARTED");
    const player = this.addLocalPlayerToRoom(room, input, events);
    player.isLocal = false;
    return { value: { playerId: player.id, token: player.token }, events };
  }

  public attachSocket(code: string, playerId: string, socketId: string): void {
    const room = this.getRoom(code);
    const player = this.findPlayer(room, playerId);
    player.socketIds.add(socketId);
    player.connected = true;
  }

  public detachSocket(code: string, playerId: string, socketId: string): EngineEvent[] {
    const events: EngineEvent[] = [];
    const room = this.rooms.get(this.code(code));
    if (!room) return events;
    const player = room.players.get(playerId);
    if (!player) return events;
    player.socketIds.delete(socketId);
    const remote = [...room.players.values()].some((item) => !item.isLocal && item.socketIds.size > 0);
    if (!player.isLocal && player.socketIds.size === 0) {
      player.connected = false;
      room.eligible.delete(player.id);
      events.push(this.event("room:updated", room.code, { playerId: player.id, connected: false, anyConnected: remote }));
    }
    return events;
  }

  public reconnect(code: string, token: string): EngineResult<{ playerId: string }> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    const player = [...room.players.values()].find((item) => item.token === token);
    if (!player) throw new Error("INVALID_TOKEN");
    player.connected = true;
    if (
      !room.ineligible.has(player.id) &&
      (room.phase === "buzzer_open" || room.phase === "answering")
    ) {
      room.eligible.add(player.id);
    }
    events.push(this.event("player:reconnected", room.code, { playerId: player.id, nickname: player.nickname }));
    return { value: { playerId: player.id }, events };
  }

  public startGame(code: string, hostToken: string): EngineResult<null> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    this.assertHost(room, hostToken);
    if (room.players.size < 2) throw new Error("NEED_TWO_PLAYERS");
    room.selectedQuestions = this.selectQuestions(room);
    room.roundIndex = 0;
    room.history = [];
    room.paused = false;
    for (const player of room.players.values()) {
      player.score = 0;
      player.connected = player.isLocal || player.socketIds.size > 0;
    }
    events.push(this.event("room:started", room.code, { totalRounds: room.selectedQuestions.length }));
    this.startRound(room, events);
    return { value: null, events };
  }

  public buzz(code: string, playerId: string): EngineResult<{ accepted: boolean }> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    const player = room.players.get(playerId);
    if (room.phase !== "buzzer_open") {
      events.push(this.event("buzz:rejected", room.code, { playerId, reason: "NOT_OPEN" }));
      return { value: { accepted: false }, events };
    }
    if (!player || !room.eligible.has(player.id) || !player.connected) {
      events.push(this.event("buzz:rejected", room.code, { playerId, reason: "NOT_ELIGIBLE" }));
      return { value: { accepted: false }, events };
    }
    room.activePlayerId = player.id;
    room.phase = "answering";
    room.remainingMs = room.config.timerSeconds * 1000;
    room.submissionKeys.clear();
    this.armTimer(room, events);
    events.push(this.event("player:buzzed", room.code, { playerId: player.id, nickname: player.nickname }));
    return { value: { accepted: true }, events };
  }

  public revealLetter(code: string, playerId: string): EngineResult<{ position: number | null; char: string | null }> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    if (room.phase !== "answering" || room.activePlayerId !== playerId) {
      return { value: { position: null, char: null }, events };
    }
    const position = pickUnrevealedIndex(room.currentTiles, this.random);
    if (position === null) return { value: { position: null, char: null }, events };
    room.revealed.add(position);
    const total = revealableCount(room.currentTiles);
    events.push(
      this.event("letter:revealed", room.code, {
        position,
        char: room.currentTiles[position]?.char ?? null,
        remaining: availablePoints(total, room.revealed.size),
      }),
    );
    return { value: { position, char: room.currentTiles[position]?.char ?? null }, events };
  }

  public submitAnswer(code: string, playerId: string, answer: string, idempotencyKey: string): EngineResult<{ accepted: boolean; correct: boolean }> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    if (room.phase !== "answering" || room.activePlayerId !== playerId) {
      return { value: { accepted: false, correct: false }, events };
    }
    if (room.submissionKeys.has(idempotencyKey)) {
      return { value: { accepted: false, correct: false }, events };
    }
    room.submissionKeys.add(idempotencyKey);
    const player = this.findPlayer(room, playerId);
    const value = this.translation(room);
    const correct = value ? answersMatch(answer, value.answer, value.aliases) : false;
    const total = revealableCount(room.currentTiles);
    const pointsAwarded = calculateAward(total, room.revealed.size, correct);
    if (correct) {
      player.score += pointsAwarded;
      const result: RoundResult = {
        round: room.roundIndex + 1,
        playerId: player.id,
        playerName: player.nickname,
        correct: true,
        timedOut: false,
        skipped: false,
        answer: value?.answer ?? answer,
        explanation: value?.explanation ?? "",
        source: value?.source ?? null,
        pointsAwarded,
        penalty: 0,
        scoreDelta: pointsAwarded,
      };
      this.closeRound(room, result, events);
    } else {
      this.applyIncorrect(room, false, idempotencyKey, events);
    }
    return { value: { accepted: true, correct }, events };
  }

  public tick(code: string): EngineResult<null> {
    return { value: null, events: this.tickRoom(code) };
  }

  public pause(code: string, hostToken: string): EngineResult<null> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    this.assertHost(room, hostToken);
    if (room.phase !== "answering") return { value: null, events };
    room.remainingMs = Math.max(0, (room.turnEndsAt ?? this.now()) - this.now());
    room.paused = true;
    this.clearRoomTimer(room);
    room.turnEndsAt = null;
    events.push(this.event("room:paused", room.code, { remainingMs: room.remainingMs }));
    return { value: null, events };
  }

  public resume(code: string, hostToken: string): EngineResult<null> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    this.assertHost(room, hostToken);
    if (room.phase !== "answering" || !room.paused) return { value: null, events };
    room.paused = false;
    this.armTimer(room, events);
    events.push(this.event("room:resumed", room.code));
    return { value: null, events };
  }

  public nextRound(code: string, hostToken: string): EngineResult<null> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    this.assertHost(room, hostToken);
    if (room.phase !== "round_result") return { value: null, events };
    if (room.roundIndex >= room.selectedQuestions.length - 1) {
      this.finishGame(room, events);
      return { value: null, events };
    }
    room.roundIndex += 1;
    this.startRound(room, events);
    return { value: null, events };
  }

  public skipQuestion(code: string, hostToken: string): EngineResult<null> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    this.assertHost(room, hostToken);
    if (room.phase === "finished" || room.phase === "lobby") return { value: null, events };
    const value = this.translation(room);
    const result: RoundResult = {
      round: room.roundIndex + 1,
      playerId: null,
      playerName: "",
      correct: false,
      timedOut: false,
      skipped: true,
      answer: value?.answer ?? "",
      explanation: value?.explanation ?? "",
      source: value?.source ?? null,
      pointsAwarded: 0,
      penalty: 0,
      scoreDelta: 0,
    };
    this.closeRound(room, result, events);
    return { value: null, events };
  }

  public revealAnswer(code: string, hostToken: string): EngineResult<null> {
    return this.skipQuestion(code, hostToken);
  }

  public updateConfig(code: string, hostToken: string, config: Partial<GameConfig>): EngineResult<null> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    this.assertHost(room, hostToken);
    room.config = normalizeConfig({ ...room.config, ...config });
    events.push(this.event("room:updated", room.code, { config: room.config }));
    return { value: null, events };
  }

  public dismissResult(code: string, hostToken: string): EngineResult<null> {
    const events: EngineEvent[] = [];
    const room = this.getRoom(code);
    this.assertHost(room, hostToken);
    room.lastResult = null;
    events.push(this.event("room:updated", room.code));
    return { value: null, events };
  }

  public getSnapshot(code: string, viewer?: { hostToken?: string; playerToken?: string }): RoomSnapshot {
    const room = this.getRoom(code);
    const players = [...room.players.values()].map((player) => this.playerView(room, player));
    const viewersPlayer = viewer?.playerToken
      ? [...room.players.values()].find((player) => player.token === viewer.playerToken)
      : undefined;
    const isHost = viewer?.hostToken === room.hostToken;
    return {
      code: room.code,
      phase: room.phase,
      paused: room.paused,
      config: { ...room.config },
      players,
      question: this.questionView(room),
      roundIndex: room.roundIndex,
      totalRounds: room.selectedQuestions.length || room.config.rounds,
      activePlayerId: room.activePlayerId,
      revealedCount: room.revealed.size,
      availablePoints: availablePoints(revealableCount(room.currentTiles), room.revealed.size),
      turnEndsAt: room.paused ? null : room.turnEndsAt,
      remainingMs: room.paused ? room.remainingMs : null,
      lastResult: room.lastResult ? { ...room.lastResult } : null,
      history: room.history.map((item) => ({ ...item })),
      winners: this.winners(room),
      hostToken: isHost ? room.hostToken : null,
      playerToken: viewersPlayer?.token ?? null,
    };
  }

  public getRoomStatus(code: string): { exists: boolean; phase?: RoomSnapshot["phase"]; players?: number } {
    const room = this.rooms.get(this.code(code));
    if (!room) return { exists: false };
    return { exists: true, phase: room.phase, players: room.players.size };
  }

  public getPlayerToken(code: string, playerId: string): string {
    return this.findPlayer(this.getRoom(code), playerId).token;
  }

  public getHostToken(code: string): string {
    return this.getRoom(code).hostToken;
  }

  public getPlayerIdByToken(code: string, token: string): string | null {
    const player = [...this.getRoom(code).players.values()].find((item) => item.token === token);
    return player?.id ?? null;
  }

  public isLocalPlayer(code: string, playerId: string): boolean {
    return this.findPlayer(this.getRoom(code), playerId).isLocal;
  }
}
