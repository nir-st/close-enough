export interface Question {
  id: string;
  categories: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  text: string;
  correctAnswer: number;
  unit?: string;
}

export interface Player {
  id: string;
  name: string;
  socketId: string;
  score: number;
  isHost: boolean;
  connected: boolean;
  avatar: string; // Emoji avatar
  lastSeen: Date; // For cleanup of long-disconnected players
  isBot: boolean; // Whether this is a bot player
}

export interface Answer {
  playerId: string;
  value: number;
  submittedAt: Date;
  timeTaken: number; // seconds
}

export interface GameSettings {
  questionCount: 5 | 10;
  difficulty: 'mixed' | 'easy' | 'medium' | 'hard';
  categoryFilter: 'mixed' | string;
  timePerQuestion: 15 | 30 | 45 | 60;
}

export type GameState = 'waiting' | 'question' | 'answering' | 'results' | 'finished';

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  state: GameState;
  settings: GameSettings;
  currentQuestionIndex: number;
  questions: Question[];
  answers: Map<string, Answer>;
  questionStartTime?: number;
  readyPlayers: Set<string>; // Track which players are ready for next question
  isProcessingReady: boolean; // Flag to prevent duplicate processing when all ready
  createdAt: Date;
}

export interface ScoreResult {
  playerId: string;
  playerName: string;
  playerAvatar: string;
  answer: number;
  distance: number;
  pointsEarned: number;
  totalScore: number;
}

export interface RoundResult {
  correctAnswer: number;
  results: ScoreResult[];
  winner: ScoreResult | null;
}

// Score configuration
export const SCORE_CONFIG = {
  easy: { closest: 3, exact: 6 },
  medium: { closest: 5, exact: 10 },
  hard: { closest: 10, exact: 20 }
};
