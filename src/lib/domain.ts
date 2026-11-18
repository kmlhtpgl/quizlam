export const CATEGORIES = [
  "Quran",
  "Prophets",
  "Five Pillars of Islam",
  "Ramadan",
  "Salah",
  "Islamic History",
  "Companions",
  "Islamic Manners",
  "Islamic Places",
  "General Islamic Knowledge",
] as const;

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const LANGUAGES = ["en", "tr"] as const;
export const GAME_MODES = ["individual", "team", "family", "tournament", "daily"] as const;
export const PHASES = ["lobby", "question", "buzzer_open", "answering", "round_result", "finished"] as const;
export const AVATARS = ["lion", "fox", "owl", "rocket", "star", "panda", "tiger", "koala", "dragon", "unicorn"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Difficulty = (typeof DIFFICULTIES)[number];
export type Language = (typeof LANGUAGES)[number];
export type GameMode = (typeof GAME_MODES)[number];
export type Phase = (typeof PHASES)[number];
export type Avatar = (typeof AVATARS)[number];

export interface QuestionRecord {
  id: string;
  category: Category;
  difficulty: Difficulty;
  approved: boolean;
  translations: Partial<Record<Language, QuestionTranslation>>;
}

export interface QuestionTranslation {
  prompt: string;
  answer: string;
  aliases: string[];
  explanation: string;
  source: string | null;
  language: Language;
}

export interface GameConfig {
  categories: Category[];
  difficulties: Difficulty[];
  timerSeconds: 15 | 30 | 45 | 60;
  rounds: number;
  penalty: number;
  mode: GameMode;
  language: Language;
}

export const DEFAULT_CONFIG: GameConfig = {
  categories: [...CATEGORIES],
  difficulties: [...DIFFICULTIES],
  timerSeconds: 30,
  rounds: 10,
  penalty: 50,
  mode: "individual",
  language: "en",
};

export interface TileView {
  position: number;
  char: string | null;
  revealable: boolean;
  revealed: boolean;
}

export interface QuestionView {
  id: string;
  category: Category;
  difficulty: Difficulty;
  prompt: string;
  language: Language;
  tiles: TileView[];
  answerLength: number;
  explanation: string;
  source: string | null;
}

export interface PlayerView {
  id: string;
  nickname: string;
  avatar: Avatar;
  teamId: string | null;
  score: number;
  connected: boolean;
  isLocal: boolean;
  isActive: boolean;
  isEligible: boolean;
  isWinner: boolean;
}

export interface RoundResult {
  round: number;
  playerId: string | null;
  playerName: string;
  correct: boolean;
  timedOut: boolean;
  skipped: boolean;
  answer: string;
  explanation: string;
  source: string | null;
  pointsAwarded: number;
  penalty: number;
  scoreDelta: number;
}

export interface RoomSnapshot {
  code: string;
  phase: Phase;
  paused: boolean;
  config: GameConfig;
  players: PlayerView[];
  question: QuestionView | null;
  roundIndex: number;
  totalRounds: number;
  activePlayerId: string | null;
  revealedCount: number;
  availablePoints: number;
  turnEndsAt: number | null;
  remainingMs: number | null;
  lastResult: RoundResult | null;
  history: RoundResult[];
  winners: string[];
  hostToken: string | null;
  playerToken: string | null;
}

export type EngineEventType =
  | "room:created"
  | "room:updated"
  | "room:started"
  | "room:paused"
  | "room:resumed"
  | "player:joined"
  | "player:reconnected"
  | "player:buzzed"
  | "buzz:rejected"
  | "letter:revealed"
  | "turn:timeout"
  | "answer:result"
  | "round:available"
  | "round:finished"
  | "game:finished"
  | "room:error";

export interface EngineEvent {
  type: EngineEventType;
  code: string;
  payload?: Record<string, unknown>;
}
