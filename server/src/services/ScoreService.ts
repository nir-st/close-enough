import { Question, Answer, ScoreResult, RoundResult, SCORE_CONFIG } from '../models/Game';
import { Player } from '../models/Game';

class ScoreService {
  // Calculate scores for a round
  calculateRoundScores(
    question: Question,
    answers: Answer[],
    players: Player[]
  ): RoundResult {
    const correctAnswer = question.correctAnswer;
    const difficulty = question.difficulty;
    const points = SCORE_CONFIG[difficulty];

    // Calculate distance from correct answer for each submission
    const results: ScoreResult[] = answers.map(answer => {
      const player = players.find(p => p.id === answer.playerId);
      const distance = Math.abs(answer.value - correctAnswer);

      return {
        playerId: answer.playerId,
        playerName: player?.name || 'Unknown',
        playerAvatar: player?.avatar || '❓',
        answer: answer.value,
        distance,
        pointsEarned: 0, // Will be calculated below
        totalScore: player?.score || 0
      };
    });

    // Sort by distance (closest first)
    results.sort((a, b) => a.distance - b.distance);

    // Assign points
    results.forEach((result, index) => {
      if (result.distance === 0) {
        // Exact match - double points
        result.pointsEarned = points.exact;
      } else if (index === 0) {
        // Closest answer (if not exact)
        result.pointsEarned = points.closest;
      } else {
        // Other answers get 0 points
        result.pointsEarned = 0;
      }

      // Update player's total score
      const player = players.find(p => p.id === result.playerId);
      if (player) {
        player.score += result.pointsEarned;
        result.totalScore = player.score;
      }
    });

    // Determine winner (highest points earned this round)
    const winner = results.find(r => r.pointsEarned > 0) || null;

    return {
      correctAnswer,
      results,
      winner
    };
  }

  // Get final leaderboard (sorted by total score)
  getFinalLeaderboard(players: Player[]): Player[] {
    return [...players].sort((a, b) => b.score - a.score);
  }

  // Get winner(s) of the game
  getGameWinner(players: Player[]): Player[] {
    const leaderboard = this.getFinalLeaderboard(players);
    if (leaderboard.length === 0) return [];

    const highestScore = leaderboard[0].score;
    return leaderboard.filter(p => p.score === highestScore);
  }
}

export const scoreService = new ScoreService();
