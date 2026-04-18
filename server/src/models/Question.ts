export interface Question {
  id: string;
  categories: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  text: string;
  correctAnswer: number;
  unit?: string;
}

export interface QuestionBank {
  questions: Question[];
}
