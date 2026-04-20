import { Room, Answer } from '../models/Game';
import { roomService } from './RoomService';
import { questionService } from './QuestionService';
import { scoreService } from './ScoreService';

class GameService {
  // Start the game
  startGame(roomId: string): void {
    const room = roomService.getRoom();
    if (!room || room.id !== roomId) {
      throw new Error('Room not found');
    }

    if (room.state !== 'waiting') {
      throw new Error('Game already started');
    }

    if (room.players.length < 2) {
      throw new Error('Need at least 2 players to start');
    }

    // Select questions based on settings
    const questions = questionService.selectQuestions(room.settings);
    if (questions.length === 0) {
      throw new Error('No questions available');
    }

    room.questions = questions;
    room.currentQuestionIndex = 0;
    room.state = 'question';
    room.questionStartTime = Date.now();
  }

  // Get current question for display (without correct answer)
  getCurrentQuestion(room: Room) {
    const question = room.questions[room.currentQuestionIndex];
    if (!question) return null;

    // Return question without correct answer
    return {
      id: question.id,
      categories: question.categories,
      difficulty: question.difficulty,
      text: question.text,
      unit: question.unit,
      questionNumber: room.currentQuestionIndex + 1,
      totalQuestions: room.questions.length
    };
  }

  // Submit an answer
  submitAnswer(roomId: string, playerId: string, answerValue: number): void {
    const room = roomService.getRoom();
    if (!room || room.id !== roomId) {
      throw new Error('Room not found');
    }

    if (room.state !== 'answering') {
      throw new Error('Not accepting answers right now');
    }

    // Check if player already answered
    const answerKey = `${playerId}`;
    if (room.answers.has(answerKey)) {
      // Already submitted - silently ignore for reconnection case
      return;
    }

    // Calculate time taken
    const timeTaken = room.questionStartTime
      ? (Date.now() - room.questionStartTime) / 1000
      : 0;

    const answer: Answer = {
      playerId,
      value: answerValue,
      submittedAt: new Date(),
      timeTaken
    };

    room.answers.set(answerKey, answer);
  }

  // Check if all players have answered
  haveAllPlayersAnswered(room: Room): boolean {
    const connectedPlayers = room.players.filter(p => p.connected);
    return room.answers.size >= connectedPlayers.length;
  }

  // End the current question and calculate scores
  endQuestion(roomId: string) {
    const room = roomService.getRoom();
    if (!room || room.id !== roomId) {
      throw new Error('Room not found');
    }

    const question = room.questions[room.currentQuestionIndex];
    const answers = Array.from(room.answers.values());

    // Calculate scores
    const roundResult = scoreService.calculateRoundScores(
      question,
      answers,
      room.players
    );

    room.state = 'results';

    const isLastQuestion = room.currentQuestionIndex >= room.questions.length - 1;

    return {
      ...roundResult,
      questionNumber: room.currentQuestionIndex + 1,
      totalQuestions: room.questions.length,
      isLastQuestion
    };
  }

  // Move to next question or end game
  nextQuestion(roomId: string): void {
    const room = roomService.getRoom();
    if (!room || room.id !== roomId) {
      throw new Error('Room not found');
    }

    if (room.state !== 'results') {
      throw new Error('Cannot proceed: not in results state');
    }

    // Clear answers for next question
    room.answers.clear();

    // Check if there are more questions
    if (room.currentQuestionIndex < room.questions.length - 1) {
      // Move to next question
      room.currentQuestionIndex++;
      room.state = 'question';
      room.questionStartTime = Date.now();
    } else {
      // Game finished
      room.state = 'finished';
    }
  }

  // Start answering phase (after question is displayed)
  startAnswering(roomId: string): void {
    const room = roomService.getRoom();
    if (!room || room.id !== roomId) {
      throw new Error('Room not found');
    }

    if (room.state !== 'question') {
      throw new Error('Cannot start answering: not in question state');
    }

    room.state = 'answering';
    room.questionStartTime = Date.now();
  }

  // Get final game results
  getFinalResults(roomId: string) {
    const room = roomService.getRoom();
    if (!room || room.id !== roomId) {
      throw new Error('Room not found');
    }

    const leaderboard = scoreService.getFinalLeaderboard(room.players);
    const winners = scoreService.getGameWinner(room.players);

    return {
      leaderboard,
      winners
    };
  }

  // End game and clear room
  endGame(roomId: string): void {
    const room = roomService.getRoom();
    if (!room || room.id !== roomId) {
      throw new Error('Room not found');
    }

    roomService.clearRoom();
  }
}

export const gameService = new GameService();
