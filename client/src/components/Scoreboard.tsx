import { RoundResult, FinalResults } from '../types/game';
import './Scoreboard.css';

interface ScoreboardProps {
  roundResult?: RoundResult;
  finalResults?: FinalResults;
}

function Scoreboard({ roundResult, finalResults }: ScoreboardProps) {
  if (finalResults) {
    return (
      <div className="scoreboard final">
        <h2>🏆 Final Results</h2>
        <div className="leaderboard">
          {finalResults.leaderboard.map((player, index) => {
            const isWinner = finalResults.winners.some(w => w.id === player.id);
            return (
              <div key={player.id} className={`score-entry ${isWinner ? 'winner' : ''}`}>
                <div className="rank">#{index + 1}</div>
                <div className="player-info-score">
                  <span className="player-avatar-score">{player.avatar}</span>
                  <div className="player-name-score">{player.name}</div>
                  {isWinner && <div className="winner-badge">Winner!</div>}
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
    return (
      <div className="scoreboard round">
        <h2>📊 Round Results</h2>
        <div className="correct-answer">
          Correct Answer: <strong>{roundResult.correctAnswer}</strong>
        </div>
        {roundResult.winner && (
          <div className="round-winner">
            🎉 {roundResult.winner.playerAvatar} {roundResult.winner.playerName} wins this round!
          </div>
        )}
        <div className="results-table">
          {roundResult.results.map((result) => (
            <div
              key={result.playerId}
              className={`result-entry ${result.pointsEarned > 0 ? 'winner' : ''}`}
            >
              <div className="player-name-result">
                <span className="player-avatar-result">{result.playerAvatar}</span>
                {result.playerName}
              </div>
              <div className="answer-info">
                <span className="answer-value">{result.answer}</span>
              </div>
              <div className="points">
                {result.totalScore} pts
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default Scoreboard;
