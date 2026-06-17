import { Room, Answer } from '../models/Game';
import { roomService } from './RoomService';
import { questionService } from './QuestionService';
import { scoreService } from './ScoreService';

class GameService {
  startGame(roomCode: string): void {
    const room = roomService.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.state !== 'waiting') throw new Error('Game already started');
    if (room.players.length < 2) throw new Error('Need at least 2 players to start');

    const questions = questionService.selectQuestions(room.settings);
    if (questions.length === 0) throw new Error('No questions available');

    room.questions = questions;
    room.currentQuestionIndex = 0;
    room.state = 'question';
    room.questionStartTime = Date.now();
    room.lastActivity = new Date();
  }

  getCurrentQuestion(room: Room) {
    const question = room.questions[room.currentQuestionIndex];
    if (!question) return null;
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

  submitAnswer(roomCode: string, playerId: string, answerValue: number): void {
    const room = roomService.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.state !== 'answering') throw new Error('Not accepting answers right now');

    if (room.answers.has(playerId)) return; // already submitted — ignore silently

    const timeTaken = room.questionStartTime ? (Date.now() - room.questionStartTime) / 1000 : 0;
    const answer: Answer = { playerId, value: answerValue, submittedAt: new Date(), timeTaken };
    room.answers.set(playerId, answer);
    room.lastActivity = new Date();
  }

  haveAllPlayersAnswered(room: Room): boolean {
    const connected = room.players.filter(p => p.connected);
    return room.answers.size >= connected.length;
  }

  endQuestion(roomCode: string) {
    const room = roomService.getRoom(roomCode);
    if (!room) throw new Error('Room not found');

    const question = room.questions[room.currentQuestionIndex];
    const answers = Array.from(room.answers.values());
    const roundResult = scoreService.calculateRoundScores(question, answers, room.players);

    room.state = 'results';
    const isLastQuestion = room.currentQuestionIndex >= room.questions.length - 1;
    const fullResult = {
      ...roundResult,
      questionNumber: room.currentQuestionIndex + 1,
      totalQuestions: room.questions.length,
      isLastQuestion
    };

    room.lastRoundResult = fullResult;
    room.lastActivity = new Date();
    return fullResult;
  }

  nextQuestion(roomCode: string): void {
    const room = roomService.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.state !== 'results') throw new Error('Cannot proceed: not in results state');

    room.answers.clear();

    if (room.currentQuestionIndex < room.questions.length - 1) {
      room.currentQuestionIndex++;
      room.state = 'question';
      room.questionStartTime = Date.now();
    } else {
      room.state = 'finished';
    }
    room.lastActivity = new Date();
  }

  startAnswering(roomCode: string): void {
    const room = roomService.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    if (room.state !== 'question') throw new Error('Cannot start answering: not in question state');

    room.state = 'answering';
    room.questionStartTime = Date.now();
    room.lastActivity = new Date();
  }

  getFinalResults(roomCode: string) {
    const room = roomService.getRoom(roomCode);
    if (!room) throw new Error('Room not found');

    return {
      leaderboard: scoreService.getFinalLeaderboard(room.players),
      winners: scoreService.getGameWinner(room.players)
    };
  }

  restartGame(roomCode: string): void {
    const room = roomService.getRoom(roomCode);
    if (!room) throw new Error('Room not found');
    roomService.restartGame(roomCode);
  }
}

export const gameService = new GameService();
