import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { GameConfig } from "@/lib/domain";

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  difficulty: text("difficulty").notNull(),
  approved: integer("approved", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});

export const questionTranslations = sqliteTable(
  "question_translations",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    language: text("language").notNull(),
    prompt: text("prompt").notNull(),
    answer: text("answer").notNull(),
    aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default([]),
    explanation: text("explanation").notNull(),
    source: text("source"),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    uniqueIndex("question_translation_unique").on(table.questionId, table.language),
    index("question_translation_question_idx").on(table.questionId),
  ],
);

export const rooms = sqliteTable("rooms", {
  code: text("code").primaryKey(),
  hostToken: text("host_token").notNull(),
  phase: text("phase").notNull().default("lobby"),
  config: text("config", { mode: "json" }).$type<GameConfig>().notNull(),
  totalRounds: integer("total_rounds").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  finishedAt: text("finished_at"),
});

export const players = sqliteTable(
  "players",
  {
    id: text("id").primaryKey(),
    roomCode: text("room_code")
      .notNull()
      .references(() => rooms.code, { onDelete: "cascade" }),
    token: text("token"),
    nickname: text("nickname").notNull(),
    avatar: text("avatar").notNull(),
    teamId: text("team_id"),
    score: integer("score").notNull().default(0),
    connected: integer("connected", { mode: "boolean" }).notNull().default(true),
    isLocal: integer("is_local", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [uniqueIndex("player_token_unique").on(table.token), index("player_room_idx").on(table.roomCode)],
);

export const rounds = sqliteTable(
  "rounds",
  {
    id: text("id").primaryKey(),
    roomCode: text("room_code")
      .notNull()
      .references(() => rooms.code, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    round: integer("round").notNull(),
    playerId: text("player_id"),
    playerName: text("player_name").notNull().default(""),
    correct: integer("correct", { mode: "boolean" }).notNull().default(false),
    timedOut: integer("timed_out", { mode: "boolean" }).notNull().default(false),
    skipped: integer("skipped", { mode: "boolean" }).notNull().default(false),
    answer: text("answer").notNull(),
    explanation: text("explanation").notNull().default(""),
    source: text("source"),
    pointsAwarded: integer("points_awarded").notNull().default(0),
    penalty: integer("penalty").notNull().default(0),
    scoreDelta: integer("score_delta").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("round_room_idx").on(table.roomCode)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`(CURRENT_TIMESTAMP)`),
});
