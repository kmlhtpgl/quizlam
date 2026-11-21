import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/quizlam.db");

mkdirSync(dirname(databasePath), { recursive: true });

export const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

let initialized = false;

export function initializeDatabase(): void {
  if (initialized) return;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY NOT NULL,
      category TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      approved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS question_translations (
      id TEXT PRIMARY KEY NOT NULL,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      language TEXT NOT NULL,
      prompt TEXT NOT NULL,
      answer TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      explanation TEXT NOT NULL,
      source TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS question_translation_unique
      ON question_translations (question_id, language);
    CREATE INDEX IF NOT EXISTS question_translation_question_idx
      ON question_translations (question_id);

    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY NOT NULL,
      host_token TEXT NOT NULL,
      game_type TEXT NOT NULL DEFAULT 'word',
      phase TEXT NOT NULL DEFAULT 'lobby',
      config TEXT NOT NULL,
      total_rounds INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY NOT NULL,
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      token TEXT,
      nickname TEXT NOT NULL,
      avatar TEXT NOT NULL,
      team_id TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      connected INTEGER NOT NULL DEFAULT 1,
      is_local INTEGER NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS player_token_unique ON players (token);
    CREATE INDEX IF NOT EXISTS player_room_idx ON players (room_code);

    CREATE TABLE IF NOT EXISTS rounds (
      id TEXT PRIMARY KEY NOT NULL,
      room_code TEXT NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      round INTEGER NOT NULL,
      player_id TEXT,
      player_name TEXT NOT NULL DEFAULT '',
      correct INTEGER NOT NULL DEFAULT 0,
      timed_out INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      answer TEXT NOT NULL,
      explanation TEXT NOT NULL DEFAULT '',
      source TEXT,
      points_awarded INTEGER NOT NULL DEFAULT 0,
      penalty INTEGER NOT NULL DEFAULT 0,
      score_delta INTEGER NOT NULL DEFAULT 0,
      choices TEXT NOT NULL DEFAULT '[]',
      selected_index INTEGER,
      correct_index INTEGER,
      banked_points INTEGER NOT NULL DEFAULT 0,
      response_ms INTEGER,
      speed_bonus INTEGER NOT NULL DEFAULT 0,
      streak_bonus INTEGER NOT NULL DEFAULT 0,
      streak_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS round_room_idx ON rounds (room_code);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  addColumn("rooms", "game_type", "TEXT NOT NULL DEFAULT 'word'");
  addColumn("rounds", "choices", "TEXT NOT NULL DEFAULT '[]'");
  addColumn("rounds", "selected_index", "INTEGER");
  addColumn("rounds", "correct_index", "INTEGER");
  addColumn("rounds", "banked_points", "INTEGER NOT NULL DEFAULT 0");
  addColumn("rounds", "response_ms", "INTEGER");
  addColumn("rounds", "speed_bonus", "INTEGER NOT NULL DEFAULT 0");
  addColumn("rounds", "streak_bonus", "INTEGER NOT NULL DEFAULT 0");
  addColumn("rounds", "streak_count", "INTEGER NOT NULL DEFAULT 0");
  initialized = true;
}

function addColumn(table: string, column: string, definition: string): void {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((item) => item.name === column)) return;
  sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
