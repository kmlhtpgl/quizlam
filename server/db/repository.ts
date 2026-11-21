import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, initializeDatabase } from "./client";
import { QUESTION_SEED } from "./questionSeed";
import { players, questionTranslations, questions, rooms, rounds, settings } from "./schema";
import type { GameConfig, GameType, Language, QuestionRecord, RoomSnapshot, RoundResult } from "@/lib/domain";
import { MCQ_LADDER, type McqConfig, type McqResult, type McqRoomSnapshot } from "@/lib/mcqDomain";

export interface AdminQuestion extends QuestionRecord {
  createdAt: string;
  updatedAt: string;
}

export function ensureSeeded(): void {
  initializeDatabase();
  const existingIds = new Set(db.select({ id: questions.id }).from(questions).all().map((row) => row.id));
  const now = new Date().toISOString();
  for (const question of QUESTION_SEED) {
    if (!existingIds.has(question.id)) {
      db.insert(questions)
        .values({
          id: question.id,
          category: question.category,
          difficulty: question.difficulty,
          approved: question.approved,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .run();
    }
    for (const [language, translation] of Object.entries(question.translations)) {
      if (!translation) continue;
      db.insert(questionTranslations)
        .values({
          id: `${question.id}_${language}`,
          questionId: question.id,
          language,
          prompt: translation.prompt,
          answer: translation.answer,
          aliases: translation.aliases,
          explanation: translation.explanation,
          source: translation.source,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .run();
    }
  }
}

export function getQuestionBank(): QuestionRecord[] {
  ensureSeeded();
  const questionRows = db.select().from(questions).all();
  if (!questionRows.length) return QUESTION_SEED;
  const translationRows = db.select().from(questionTranslations).all();
  return questionRows.map((row) => {
    const translations: Partial<Record<Language, QuestionRecord["translations"][Language]>> = {};
    for (const item of translationRows.filter((translation) => translation.questionId === row.id)) {
      translations[item.language as Language] = {
        prompt: item.prompt,
        answer: item.answer,
        aliases: item.aliases ?? [],
        explanation: item.explanation,
        source: item.source,
        language: item.language as Language,
      };
    }
    return {
      id: row.id,
      category: row.category as QuestionRecord["category"],
      difficulty: row.difficulty as QuestionRecord["difficulty"],
      approved: row.approved,
      translations,
    };
  });
}

export function listAdminQuestions(): AdminQuestion[] {
  return getQuestionBank().map((question) => ({
    ...question,
    createdAt: "",
    updatedAt: "",
  }));
}

export interface SaveQuestionInput {
  id?: string;
  category: QuestionRecord["category"];
  difficulty: QuestionRecord["difficulty"];
  approved: boolean;
  translations: Record<Language, { prompt: string; answer: string; aliases: string[]; explanation: string; source: string | null }>;
}

export function saveQuestion(input: SaveQuestionInput): QuestionRecord {
  initializeDatabase();
  const id = input.id ?? `parent_${randomUUID()}`;
  const now = new Date().toISOString();
  db.insert(questions)
    .values({
      id,
      category: input.category,
      difficulty: input.difficulty,
      approved: input.approved,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: questions.id,
      set: {
        category: input.category,
        difficulty: input.difficulty,
        approved: input.approved,
        updatedAt: now,
      },
    })
    .run();
  for (const language of ["en", "tr"] as const) {
    const translation = input.translations[language];
    if (!translation) continue;
    db.insert(questionTranslations)
      .values({
        id: `${id}_${language}`,
        questionId: id,
        language,
        prompt: translation.prompt,
        answer: translation.answer,
        aliases: translation.aliases,
        explanation: translation.explanation,
        source: translation.source,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: questionTranslations.id,
        set: {
          prompt: translation.prompt,
          answer: translation.answer,
          aliases: translation.aliases,
          explanation: translation.explanation,
          source: translation.source,
          updatedAt: now,
        },
      })
      .run();
  }
  return {
    id,
    category: input.category,
    difficulty: input.difficulty,
    approved: input.approved,
    translations: {
      en: { ...input.translations.en, language: "en" },
      tr: { ...input.translations.tr, language: "tr" },
    },
  };
}

export function deleteQuestion(id: string): void {
  initializeDatabase();
  db.delete(questions).where(eq(questions.id, id)).run();
}

function persistRoomSnapshot(input: {
  code: string;
  hostToken: string | null;
  gameType: GameType;
  phase: string;
  config: GameConfig;
  totalRounds: number;
  players: McqRoomSnapshot["players"];
}): void {
  initializeDatabase();
  const now = new Date().toISOString();
  db.insert(rooms)
    .values({
      code: input.code,
      hostToken: input.hostToken ?? "",
      gameType: input.gameType,
      phase: input.phase,
      config: input.config,
      totalRounds: input.totalRounds,
      createdAt: now,
      finishedAt: input.phase === "finished" ? now : null,
    })
    .onConflictDoUpdate({
      target: rooms.code,
      set: {
        gameType: input.gameType,
        phase: input.phase,
        config: input.config,
        totalRounds: input.totalRounds,
        finishedAt: input.phase === "finished" ? now : null,
      },
    })
    .run();
  for (const player of input.players) {
    db.insert(players)
      .values({
        id: player.id,
        roomCode: input.code,
        token: null,
        nickname: player.nickname,
        avatar: player.avatar,
        teamId: player.teamId,
        score: player.score,
        connected: player.connected,
        isLocal: player.isLocal,
      })
      .onConflictDoUpdate({
        target: players.id,
        set: {
          nickname: player.nickname,
          avatar: player.avatar,
          teamId: player.teamId,
          score: player.score,
          connected: player.connected,
        },
      })
      .run();
  }
}

export function saveRoomSnapshot(snapshot: RoomSnapshot): void {
  persistRoomSnapshot({
    code: snapshot.code,
    hostToken: snapshot.hostToken,
    gameType: "word",
    phase: snapshot.phase,
    config: snapshot.config,
    totalRounds: snapshot.totalRounds,
    players: snapshot.players,
  });
}

function mcqConfigToGameConfig(config: McqConfig): GameConfig {
  return {
    categories: [...config.categories],
    difficulties: [...config.difficulties],
    timerSeconds: config.timerSeconds,
    rounds: MCQ_LADDER.length,
    penalty: 0,
    mode: "individual",
    language: config.language,
  };
}

export function saveMcqRoomSnapshot(snapshot: McqRoomSnapshot): void {
  persistRoomSnapshot({
    code: snapshot.code,
    hostToken: snapshot.hostToken,
    gameType: "millionaire",
    phase: snapshot.phase,
    config: mcqConfigToGameConfig(snapshot.config),
    totalRounds: snapshot.totalRounds,
    players: snapshot.players,
  });
}

export interface HistoryRound extends RoundResult {
  choices: string[];
  selectedIndex: number | null;
  correctIndex: number | null;
  bankedPoints: number;
}

export interface HistoryGame {
  code: string;
  gameType: GameType;
  phase: string;
  config: GameConfig;
  createdAt: string;
  finishedAt: string | null;
  scores: Array<{ nickname: string; score: number; avatar: string }>;
  rounds: HistoryRound[];
}

export function getGameHistory(limit = 25): HistoryGame[] {
  initializeDatabase();
  const roomRows = db.select().from(rooms).orderBy(desc(rooms.createdAt)).limit(limit).all();
  if (!roomRows.length) return [];
  const allPlayers = db
    .select()
    .from(players)
    .where(
      inArray(
        players.roomCode,
        roomRows.map((room) => room.code),
      ),
    )
    .all();
  const allRounds = db
    .select()
    .from(rounds)
    .where(
      inArray(
        rounds.roomCode,
        roomRows.map((room) => room.code),
      ),
    )
    .all();
  return roomRows.map((room) => ({
    code: room.code,
    gameType: room.gameType,
    phase: room.phase,
    config: room.config,
    createdAt: room.createdAt,
    finishedAt: room.finishedAt,
    scores: allPlayers
      .filter((player) => player.roomCode === room.code)
      .map((player) => ({ nickname: player.nickname, score: player.score, avatar: player.avatar }))
      .sort((a, b) => b.score - a.score),
    rounds: allRounds
      .filter((round) => round.roomCode === room.code)
      .sort((a, b) => a.round - b.round)
      .map((round) => ({
        round: round.round,
        playerId: round.playerId,
        playerName: round.playerName,
        correct: round.correct,
        timedOut: round.timedOut,
        skipped: round.skipped,
        answer: round.answer,
        explanation: round.explanation,
        source: round.source,
        pointsAwarded: round.pointsAwarded,
        penalty: round.penalty,
        scoreDelta: round.scoreDelta,
        choices: round.choices ?? [],
        selectedIndex: round.selectedIndex ?? null,
        correctIndex: round.correctIndex ?? null,
        bankedPoints: round.bankedPoints ?? 0,
      })),
  }));
}

export function saveRoundRecord(code: string, questionId: string, result: RoundResult): void {
  initializeDatabase();
  db.insert(rounds)
    .values({
      id: randomUUID(),
      roomCode: code,
      questionId,
      round: result.round,
      playerId: result.playerId,
      playerName: result.playerName,
      correct: result.correct,
      timedOut: result.timedOut,
      skipped: result.skipped,
      answer: result.answer,
      explanation: result.explanation,
      source: result.source,
      pointsAwarded: result.pointsAwarded,
      penalty: result.penalty,
      scoreDelta: result.scoreDelta,
    })
    .run();
}

export function saveMcqRoundRecord(code: string, questionId: string, result: McqResult): void {
  initializeDatabase();
  db.insert(rounds)
    .values({
      id: randomUUID(),
      roomCode: code,
      questionId,
      round: result.round,
      playerId: result.playerId,
      playerName: result.playerName,
      correct: result.correct,
      timedOut: result.timedOut,
      skipped: result.skipped,
      answer: result.answer,
      explanation: result.explanation,
      source: result.source,
      pointsAwarded: result.pointsAwarded,
      penalty: result.penalty,
      scoreDelta: result.scoreDelta,
      choices: result.choices,
      selectedIndex: result.selectedIndex,
      correctIndex: result.correctIndex,
      bankedPoints: result.bankedPoints,
    })
    .run();
}

export function getSetting(key: string, fallback: string): string {
  initializeDatabase();
  const row = db.select().from(settings).where(eq(settings.key, key)).limit(1).all()[0];
  return row?.value ?? fallback;
}

export function setSetting(key: string, value: string): void {
  initializeDatabase();
  const now = new Date().toISOString();
  db.insert(settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
    .run();
}

export function getRoomHostToken(code: string): string | null {
  initializeDatabase();
  const row = db.select().from(rooms).where(eq(rooms.code, code)).limit(1).all()[0];
  return row?.hostToken ?? null;
}

export function getPlayerByToken(code: string, token: string): string | null {
  initializeDatabase();
  const row = db
    .select()
    .from(players)
    .where(and(eq(players.roomCode, code), eq(players.token, token)))
    .limit(1)
    .all()[0];
  return row?.id ?? null;
}
