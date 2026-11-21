import type { Avatar, Category, Difficulty, EngineEvent, Language, PlayerView, QuestionRecord, RoundResult } from "./domain";

export const BATTLE_PHASES = ["lobby", "question", "reveal", "finished"] as const;
export const BATTLE_ROUND_OPTIONS = [5, 10, 15, 20] as const;
export const BATTLE_TIMER_OPTIONS = [10, 15, 20, 30, 45, 60] as const;

export type BattlePhase = (typeof BATTLE_PHASES)[number];

export interface BattleConfig {
  categories: Category[];
  difficulties: Difficulty[];
  language: Language;
  rounds: number;
  timerSeconds: number;
}

export const BATTLE_DEFAULT_CONFIG: BattleConfig = {
  categories: [],
  difficulties: ["easy", "medium", "hard"],
  language: "en",
  rounds: 10,
  timerSeconds: 20,
};

export type BattleChoiceColor = "red" | "blue" | "yellow" | "green";

export interface BattleChoiceView {
  index: number;
  text: string;
  color: BattleChoiceColor;
}

export interface BattleQuestionView {
  id: string;
  category: Category;
  difficulty: Difficulty;
  prompt: string;
  language: Language;
  options: BattleChoiceView[];
  correctIndex: number | null;
  explanation: string | null;
  source: string | null;
}

export interface BattleResult extends RoundResult {
  selectedIndex: number | null;
  selectedText: string | null;
  correctIndex: number;
  choices: string[];
  responseMs: number;
  speedBonus: number;
  streakBonus: number;
  streakCount: number;
  totalPoints: number;
}

export interface BattleAnswerView {
  answered: boolean;
  selectedIndex: number | null;
  correct: boolean | null;
  points: number;
  responseMs: number | null;
}

export interface BattleRoomSnapshot {
  code: string;
  gameType: "battle";
  phase: BattlePhase;
  paused: boolean;
  config: BattleConfig;
  roundIndex: number;
  totalRounds: number;
  question: BattleQuestionView | null;
  turnEndsAt: number | null;
  remainingMs: number | null;
  answerCount: number;
  players: PlayerView[];
  myAnswer: BattleAnswerView | null;
  results: BattleResult[];
  history: BattleResult[];
  winners: string[];
  hostToken: string | null;
  playerToken: string | null;
}

export interface BattleCreateInput {
  questionBank: QuestionRecord[];
  config?: Partial<BattleConfig>;
  localPlayers?: Array<{ nickname: string; avatar: Avatar }>;
}

export type BattleEngineEvent = EngineEvent;
