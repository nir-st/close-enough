export interface Question {
  id: string;
  categories: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  text: string;
  unit?: string;
  questionNumber?: number;
  totalQuestions?: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  connected: boolean;
  avatar: string;
}

export interface GameSettings {
  questionCount: 5 | 10;
  difficulty: 'mixed' | 'easy' | 'medium' | 'hard';
  categoryFilter: 'mixed' | string;
  timePerQuestion: 15 | 30 | 45 | 60;
}

export type GameState = 'waiting' | 'question' | 'answering' | 'results' | 'finished';

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
  questionNumber: number;
  totalQuestions: number;
}

export interface FinalResults {
  leaderboard: Player[];
  winners: Player[];
}
