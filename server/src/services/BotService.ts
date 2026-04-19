import { Room, Question } from '../models/Game';

class BotService {
  // Generate a random answer for a bot based on the question
  generateBotAnswer(question: Question): number {
    const correctAnswer = question.correctAnswer;

    // Bots will guess within a range around the correct answer
    // Difficulty affects how accurate bots are
    let accuracyRange: number;

    switch (question.difficulty) {
      case 'easy':
        // Bots guess within +/- 50% of correct answer
        accuracyRange = 0.5;
        break;
      case 'medium':
        // Bots guess within +/- 100% of correct answer
        accuracyRange = 1.0;
        break;
      case 'hard':
        // Bots guess within +/- 200% of correct answer
        accuracyRange = 2.0;
        break;
      default:
        accuracyRange = 1.0;
    }

    // Random factor between -accuracyRange and +accuracyRange
    const randomFactor = (Math.random() * 2 - 1) * accuracyRange;
    let guess = correctAnswer * (1 + randomFactor);

    // Ensure guess is positive
    guess = Math.max(1, guess);

    // Round to reasonable precision
    if (guess > 1000) {
      guess = Math.round(guess / 10) * 10; // Round to nearest 10
    } else if (guess > 100) {
      guess = Math.round(guess); // Round to nearest 1
    } else {
      guess = Math.round(guess * 10) / 10; // Round to 1 decimal place
    }

    return guess;
  }

  // Submit answers for all bots in the room
  async submitBotAnswers(room: Room, currentQuestion: Question, submitCallback: (playerId: string, answer: number) => void): Promise<void> {
    const bots = room.players.filter(p => p.isBot);

    for (const bot of bots) {
      // Random delay between 1-5 seconds to simulate thinking time
      const delay = 1000 + Math.random() * 4000;

      setTimeout(() => {
        const answer = this.generateBotAnswer(currentQuestion);
        submitCallback(bot.id, answer);
      }, delay);
    }
  }

  // Mark all bots as ready
  markBotsReady(room: Room, markReadyCallback: (playerId: string) => void): void {
    const bots = room.players.filter(p => p.isBot);

    bots.forEach(bot => {
      // Random delay between 0.5-2 seconds
      const delay = 500 + Math.random() * 1500;

      setTimeout(() => {
        markReadyCallback(bot.id);
      }, delay);
    });
  }
}

export const botService = new BotService();
