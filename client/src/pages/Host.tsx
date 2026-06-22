import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import QRCodeDisplay from '../components/QRCodeDisplay';
import PlayerList from '../components/PlayerList';
import GameSettings from '../components/GameSettings';
import QuestionDisplay from '../components/QuestionDisplay';
import Timer from '../components/Timer';
import AnswerReveal from '../components/AnswerReveal';
import Scoreboard from '../components/Scoreboard';
import './Host.css';

// roomCode can come from the route (/host/:roomCode) or be passed directly by
// the Cast receiver, which creates the room itself and reuses this screen.
function Host({ roomCode: roomCodeProp }: { roomCode?: string } = {}) {
  const params = useParams();
  const roomCode = roomCodeProp ?? params.roomCode;
  const navigate = useNavigate();
  const [showDetailedResults, setShowDetailedResults] = useState(false);
  const {
    gameState,
    players,
    settings,
    currentQuestion,
    timeRemaining,
    joinUrl,
    roundResult,
    finalResults,
    readyPlayerIds,
    totalCount,
    answeredPlayerIds,
    notification,
    answerRevealed,
    updateSettings,
    startGame,
    endGame,
    restartGame,
    kickPlayer,
    setTimeRemaining,
    addBots,
    removeBots
  } = useGameStore();

  const disconnectedPlayerIds = players.filter(p => !p.connected).map(p => p.id);
  const connectedCount = players.filter(p => p.connected).length;

  // Timer countdown
  useEffect(() => {
    if (gameState === 'answering' && timeRemaining > 0) {
      const interval = setInterval(() => {
        setTimeRemaining(Math.max(0, timeRemaining - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState, timeRemaining, setTimeRemaining]);

  // Reset detailed results view when entering results state
  useEffect(() => {
    if (gameState === 'results') {
      setShowDetailedResults(false);
    }
  }, [gameState]);

  // Emit timer expired event
  useEffect(() => {
    if (gameState === 'answering' && timeRemaining === 0) {
      const socket = useGameStore.getState().socket;
      socket?.emit('timer-expired');
    }
  }, [gameState, timeRemaining]);

  const handleStartGame = () => {
    if (players.length < 2) {
      alert('Need at least 2 players to start the game');
      return;
    }
    startGame();
  };

  const handleEndGame = () => {
    endGame();
    navigate('/');
  };

  return (
    <div className="host-container">
      <div className="host-header">
        <h1>🎮 Close Enough</h1>
        <div className="room-code-badge">Room: {roomCode}</div>
      </div>

      {/* In-game notification toast (#9) */}
      {notification && (
        <div className="game-notification">{notification}</div>
      )}

      {gameState === 'waiting' && (
        <div className="waiting-view">
          <div className="host-sidebar">
            <QRCodeDisplay joinUrl={joinUrl || ''} roomCode={roomCode || ''} />
            <PlayerList players={players} isHost={true} onKick={kickPlayer} />
            <div className="bot-controls card">
              <h3>🤖 Bot Players</h3>
              <p className="bot-info">Add bots for testing (1-5)</p>
              <div className="bot-buttons">
                {[1, 2, 3, 4, 5].map(count => (
                  <button
                    key={count}
                    className="btn-bot"
                    onClick={() => addBots(count)}
                    disabled={players.length + count > 10}
                  >
                    +{count}
                  </button>
                ))}
              </div>
              {players.some(p => p.isBot) && (
                <button className="btn-remove-bots" onClick={removeBots}>
                  Remove All Bots
                </button>
              )}
            </div>
          </div>
          <div className="host-main">
            <GameSettings
              settings={settings}
              onUpdate={updateSettings}
              disabled={false}
            />
            <button
              className="btn-primary start-game-btn"
              onClick={handleStartGame}
              disabled={players.length < 2}
            >
              Start Game ({players.length} players)
            </button>
          </div>
        </div>
      )}

      {gameState === 'question' && currentQuestion && (
        <div className="game-view">
          <QuestionDisplay question={currentQuestion} large />
          <p className="game-instruction">Get ready! Question appearing shortly...</p>
        </div>
      )}

      {gameState === 'answering' && currentQuestion && (
        <div className="game-view">
          <QuestionDisplay question={currentQuestion} large />
          <Timer
            timeRemaining={timeRemaining}
            totalTime={settings.timePerQuestion}
            onExpire={() => {}}
          />
          <div className="answered-status">
            {answeredPlayerIds.length} / {players.filter(p => p.connected).length} answered
          </div>
        </div>
      )}

      {gameState === 'results' && roundResult && (
        <div className={showDetailedResults ? "results-view" : "reveal-view"}>
          {!showDetailedResults ? (
            <AnswerReveal
              correctAnswer={roundResult.correctAnswer}
              results={roundResult.results}
              onComplete={() => {
                setShowDetailedResults(true);
                useGameStore.getState().socket?.emit('reveal-done');
              }}
            />
          ) : (
            <>
              <Scoreboard
                roundResult={roundResult}
                readyPlayerIds={readyPlayerIds}
                disconnectedPlayerIds={disconnectedPlayerIds}
              />
              <div className="ready-status-display">
                {!answerRevealed ? (
                  <p className="ready-text">⏳ Revealing answer to players...</p>
                ) : connectedCount < 2 ? (
                  <p className="waiting-reconnect-text">
                    ⏳ Waiting for players to reconnect... ({connectedCount} connected)
                  </p>
                ) : roundResult.isLastQuestion ? (
                  <p className="ready-text">🏆 Moving to final results in a moment...</p>
                ) : (
                  <p className="ready-text">
                    Waiting for players: {readyPlayerIds.length} / {totalCount} ready
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {gameState === 'finished' && finalResults && (
        <div className="results-view">
          <Scoreboard finalResults={finalResults} />
          <div className="finished-actions">
            <button className="btn-primary" onClick={restartGame}>
              🔄 Play Again
            </button>
            <button className="btn-danger" onClick={handleEndGame}>
              End Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Host;
