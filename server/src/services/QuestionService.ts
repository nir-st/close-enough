import { Question, QuestionBank } from '../models/Question';
import { GameSettings } from '../models/Game';
import fs from 'fs';
import path from 'path';

class QuestionService {
  private questionBank: Question[] = [];

  constructor() {
    this.loadQuestions();
  }

  // Load questions from JSON file
  private loadQuestions(): void {
    try {
      const filePath = path.join(__dirname, '../data/questions.json');
      const data = fs.readFileSync(filePath, 'utf-8');
      const questionBank: QuestionBank = JSON.parse(data);
      this.questionBank = questionBank.questions;
      console.log(`✅ Loaded ${this.questionBank.length} questions`);
    } catch (error) {
      console.error('❌ Failed to load questions:', error);
      this.questionBank = [];
    }
  }

  // Select questions based on game settings
  selectQuestions(settings: GameSettings): Question[] {
    // Filter by category
    let filtered = settings.categoryFilter === 'mixed'
      ? [...this.questionBank]
      : this.questionBank.filter(q =>
          q.categories.includes(settings.categoryFilter)
        );

    if (filtered.length === 0) {
      throw new Error('No questions available for selected criteria');
    }

    let selected: Question[] = [];

    // Select based on difficulty and question count
    if (settings.difficulty === 'mixed') {
      if (settings.questionCount === 10) {
        // 10 questions: 5 easy, 3 medium, 2 hard (in order)
        selected = [
          ...this.randomSelect(filtered, 'easy', 5),
          ...this.randomSelect(filtered, 'medium', 3),
          ...this.randomSelect(filtered, 'hard', 2)
        ];
      } else {
        // 5 questions: 2 easy, 2 medium, 1 hard (in order)
        selected = [
          ...this.randomSelect(filtered, 'easy', 2),
          ...this.randomSelect(filtered, 'medium', 2),
          ...this.randomSelect(filtered, 'hard', 1)
        ];
      }
      // Don't shuffle for mixed difficulty - keep the easy → medium → hard order
      return selected;
    } else {
      // All same difficulty - shuffle these
      selected = this.randomSelect(filtered, settings.difficulty, settings.questionCount);
      return this.shuffle(selected);
    }
  }

  // Randomly select N questions of a specific difficulty
  private randomSelect(
    questions: Question[],
    difficulty: string,
    count: number
  ): Question[] {
    const filtered = questions.filter(q => q.difficulty === difficulty);

    if (filtered.length < count) {
      console.warn(
        `⚠️  Not enough ${difficulty} questions (need ${count}, have ${filtered.length})`
      );
      // Return what we have
      return this.shuffle(filtered);
    }

    return this.shuffle(filtered).slice(0, count);
  }

  // Shuffle array using Fisher-Yates algorithm
  private shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // Get all available categories
  getCategories(): string[] {
    const categoriesSet = new Set<string>();
    this.questionBank.forEach(q => {
      q.categories.forEach(cat => categoriesSet.add(cat));
    });
    return Array.from(categoriesSet).sort();
  }

  // Get question count by difficulty
  getQuestionStats(): { easy: number; medium: number; hard: number; total: number } {
    const stats = {
      easy: this.questionBank.filter(q => q.difficulty === 'easy').length,
      medium: this.questionBank.filter(q => q.difficulty === 'medium').length,
      hard: this.questionBank.filter(q => q.difficulty === 'hard').length,
      total: this.questionBank.length
    };
    return stats;
  }
}

export const questionService = new QuestionService();
