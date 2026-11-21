import type { Avatar, Category, Difficulty, EngineEvent, Language, PlayerView, QuestionRecord, RoundResult } from "./domain";

export const MCQ_PHASES = ["lobby", "contestant", "question", "answer_result", "finished"] as const;
export const MCQ_LADDER = [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000] as const;
export const MCQ_MILESTONES = [4, 9] as const;

export type McqPhase = (typeof MCQ_PHASES)[number];

export interface McqConfig {
  categories: Category[];
  difficulties: Difficulty[];
  timerSeconds: 15 | 30 | 45 | 60;
  language: Language;
}

export const MCQ_DEFAULT_CONFIG: McqConfig = {
  categories: [...([] as Category[])],
  difficulties: ["easy", "medium", "hard"],
  timerSeconds: 30,
  language: "en",
};

export interface McqChoiceView {
  index: number;
  text: string;
  eliminated: boolean;
}

export interface McqQuestionView {
  id: string;
  category: Category;
  difficulty: Difficulty;
  prompt: string;
  language: Language;
  options: McqChoiceView[];
  correctIndex: number | null;
  explanation: string | null;
  source: string | null;
}

export interface McqResult extends RoundResult {
  selectedIndex: number | null;
  selectedText: string | null;
  correctIndex: number;
  bankedPoints: number;
  choices: string[];
}

export interface McqRoomSnapshot {
  code: string;
  gameType: "millionaire";
  phase: McqPhase;
  paused: boolean;
  config: McqConfig;
  players: PlayerView[];
  question: McqQuestionView | null;
  roundIndex: number;
  totalRounds: number;
  activePlayerId: string | null;
  currentValue: number;
  bankedPoints: number;
  safeValue: number;
  eliminated: number[];
  fiftyFiftyUsed: boolean;
  turnEndsAt: number | null;
  remainingMs: number | null;
  lastResult: McqResult | null;
  history: McqResult[];
  winners: string[];
  hostToken: string | null;
  playerToken: string | null;
}

export interface McqCreateInput {
  questionBank: QuestionRecord[];
  config?: Partial<McqConfig>;
  localPlayers?: Array<{ nickname: string; avatar: Avatar; teamId?: string | null }>;
}

export type McqEngineEvent = EngineEvent;
