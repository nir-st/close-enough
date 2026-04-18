import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import QRCodeDisplay from '../components/QRCodeDisplay';
import PlayerList from '../components/PlayerList';
import GameSettings from '../components/GameSettings';
import QuestionDisplay from '../components/QuestionDisplay';
import Timer from '../components/Timer';
import AnswerReveal from '../components/AnswerReveal';
import Scoreboard from '../components/Scoreboard';
import './Host.css';

function Host() {
  const { roomCode } = useParams();
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
    updateSettings,
    startGame,
    nextQuestion,
    endGame,
    kickPlayer,
    setTimeRemaining
  } = useGameStore();

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

  return (
    <div className="host-container">
      <div className="host-header">
        <h1>🎮 Close Enough</h1>
        <div className="room-code-badge">Room: {roomCode}</div>
      </div>

      {gameState === 'waiting' && (
        <div className="waiting-view">
          <div className="host-sidebar">
            <QRCodeDisplay joinUrl={joinUrl || ''} roomCode={roomCode || ''} />
            <PlayerList players={players} isHost={true} onKick={kickPlayer} />
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
          <div className="info-section">
            <PlayerList players={players} />
            <p className="game-instruction">Get ready! Question appearing in 3 seconds...</p>
          </div>
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
          <div className="info-section">
            <PlayerList players={players} />
            <p className="game-instruction">Players are answering...</p>
          </div>
        </div>
      )}

      {gameState === 'results' && roundResult && (
        <div className="results-view">
          {!showDetailedResults ? (
            <AnswerReveal
              correctAnswer={roundResult.correctAnswer}
              results={roundResult.results}
              onComplete={() => setShowDetailedResults(true)}
            />
          ) : (
            <>
              <Scoreboard roundResult={roundResult} />
              <button className="btn-primary next-btn" onClick={() => {
                setShowDetailedResults(false);
                nextQuestion();
              }}>
                {roundResult.questionNumber < roundResult.totalQuestions
                  ? 'Next Question'
                  : 'See Final Results'}
              </button>
            </>
          )}
          <PlayerList players={players} />
        </div>
      )}

      {gameState === 'finished' && finalResults && (
        <div className="results-view">
          <Scoreboard finalResults={finalResults} />
          <button className="btn-danger" onClick={endGame}>
            End Game
          </button>
        </div>
      )}
    </div>
  );
}

export default Host;
