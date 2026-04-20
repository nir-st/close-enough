import { Player } from '../types/game';
import './PlayerList.css';

interface PlayerListProps {
  players: Player[];
  isHost?: boolean;
  onKick?: (playerId: string) => void;
  answeredPlayerIds?: string[];
}

function PlayerList({ players, isHost = false, onKick, answeredPlayerIds = [] }: PlayerListProps) {
  return (
    <div className="player-list">
      <h3>Players ({players.length})</h3>
      <div className="players">
        {players.map((player) => {
          const hasAnswered = answeredPlayerIds.includes(player.id);
          return (
            <div
              key={player.id}
              className={`player-card ${!player.connected ? 'disconnected' : ''} ${hasAnswered ? 'answered' : ''}`}
            >
              <div className="player-info">
                <span className="player-avatar">{player.avatar}</span>
                <span className="player-name">
                  {player.name} {player.isHost && '👑'}
                </span>
                {hasAnswered && <span className="status-badge answered-badge">✓ Answered</span>}
                {!player.connected && <span className="status-badge">Reconnecting...</span>}
              </div>
              <div className="player-actions">
                <div className="player-score">{player.score} pts</div>
                {isHost && onKick && (
                  <button
                    className="btn-kick"
                    onClick={() => onKick(player.id)}
                    title="Kick player"
                  >
                    ❌
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlayerList;
