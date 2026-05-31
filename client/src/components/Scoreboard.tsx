import { RoundResult, FinalResults } from '../types/game';
import './Scoreboard.css';

interface ScoreboardProps {
  roundResult?: RoundResult;
  finalResults?: FinalResults;
  readyPlayerIds?: string[];
  disconnectedPlayerIds?: string[];
}

const formatNumber = (num: number): string => Math.round(num).toLocaleString('en-US');

function Scoreboard({ roundResult, finalResults, readyPlayerIds = [], disconnectedPlayerIds = [] }: ScoreboardProps) {
  if (finalResults) {
    const topWinner = finalResults.winners[0];
    return (
      <div className="scoreboard final">
        {topWinner && (
          <div className="final-winner-banner">
            🏆 {topWinner.avatar} {topWinner.name} wins!
          </div>
        )}
        <h2>Final Scores</h2>
        <div className="leaderboard">
          {finalResults.leaderboard.map((player, index) => {
            const isWinner = finalResults.winners.some(w => w.id === player.id);
            return (
              <div key={player.id} className={`score-entry ${isWinner ? 'winner' : ''}`}>
                <div className="rank">#{index + 1}</div>
                <div className="player-info-score">
                  <span className="player-avatar-score">{player.avatar}</span>
                  <div className="player-name-score">{player.name}</div>
                  {isWinner && <div className="winner-badge">🥇 Winner!</div>}
                </div>
                <div className="score">{player.score} pts</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (roundResult) {
    // Sort by totalScore descending (#1)
    const sortedResults = [...roundResult.results].sort((a, b) => b.totalScore - a.totalScore);

    return (
      <div className="scoreboard round">
        <h2>
          Round {roundResult.questionNumber} / {roundResult.totalQuestions}
        </h2>
        <div className="correct-answer">
          Correct Answer: <strong>{formatNumber(roundResult.correctAnswer)}</strong>
        </div>
        {roundResult.winner && (
          <div className="round-winner">
            {roundResult.winner.distance === 0
              ? `🎯 ${roundResult.winner.playerAvatar} ${roundResult.winner.playerName} got it exactly right!`
              : `🎉 ${roundResult.winner.playerAvatar} ${roundResult.winner.playerName} was closest!`}
          </div>
        )}
        <div className="results-table">
          {sortedResults.map((result) => {
            const isDisconnected = disconnectedPlayerIds.includes(result.playerId);
            const isReady = readyPlayerIds.includes(result.playerId);
            return (
              <div
                key={result.playerId}
                className={`result-entry ${result.pointsEarned > 0 ? 'winner' : ''} ${isDisconnected ? 'disconnected' : ''}`}
              >
                <div className="player-name-result">
                  <span className="player-avatar-result">{result.playerAvatar}</span>
                  {result.playerName}
                  {isDisconnected && <span className="disconnect-icon" title="Disconnected">📴</span>}
                </div>
                <div className="result-right">
                  {isReady && <span className="ready-check">✓</span>}
                  <div className="points">{result.totalScore} pts</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

export default Scoreboard;
