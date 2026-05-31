import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import QuestionDisplay from '../components/QuestionDisplay';
import AnswerInput from '../components/AnswerInput';
import Scoreboard from '../components/Scoreboard';
import './Play.css';

function Play() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const hasJoinedRef = useRef(false);
  const [reported, setReported] = useState(false);
  const {
    connectSocket,
    joinRoom,
    gameState,
    playerName,
    currentQuestion,
    hasAnswered,
    submitAnswer,
    roundResult,
    finalResults,
    players,
    playerId,
    connected,
    readyPlayerIds,
    readyCount,
    totalCount,
    notification,
    markReady,
    reportQuestion
  } = useGameStore();

  // Reset "reported" flag when a new question starts
  useEffect(() => {
    setReported(false);
  }, [currentQuestion?.id]);

  useEffect(() => {
    connectSocket();
  }, [connectSocket]);

  useEffect(() => {
    if (roomCode && !playerName && !playerId && !hasJoinedRef.current) {
      hasJoinedRef.current = true;

      const storedName = localStorage.getItem(`player_name_${roomCode}`);

      if (storedName) {
        joinRoom(roomCode, storedName);
      } else {
        // Keep prompting until a non-empty name is entered or the user cancels
        let name: string | null = null;
        while (!name || !name.trim()) {
          name = prompt('Enter your name:');
          if (name === null) break; // User cancelled
        }
        if (name && name.trim()) {
          joinRoom(roomCode, name.trim());
        }
      }
    }
  }, [roomCode, playerName, playerId, joinRoom]);

  const myPlayer = players.find(p => p.id === playerId);
  const isReady = readyPlayerIds.includes(playerId || '');

  return (
    <div className="play-container">
      {!connected && (
        <div className="connection-lost-banner">
          🔄 Reconnecting...
        </div>
      )}

      {/* In-game notification (#9) */}
      {notification && (
        <div className="play-notification">{notification}</div>
      )}

      <div className="play-header">
        <h2>🎮 Close Enough</h2>
        {myPlayer && (
          <div className="player-badge">
            <span className="player-badge-avatar">{myPlayer.avatar}</span>
            {myPlayer.name} - {myPlayer.score} pts
          </div>
        )}
      </div>

      {gameState === 'waiting' && (
        <div className="play-waiting">
          <div className="card">
            <h3>✅ Joined!</h3>
            <p>Waiting for host to start the game...</p>
            <div className="player-count">{players.length} players connected</div>
          </div>
        </div>
      )}

      {gameState === 'question' && currentQuestion && (
        <div className="play-question">
          <QuestionDisplay question={currentQuestion} />
          <div className="waiting-message">
            <p>Get ready to answer!</p>
          </div>
          <div className="report-row">
            <button
              className={`btn-report ${reported ? 'reported' : ''}`}
              onClick={() => { reportQuestion(currentQuestion.id, currentQuestion.text); setReported(true); }}
              disabled={reported}
            >
              {reported ? '✅ Reported' : '🚩 Report question'}
            </button>
          </div>
        </div>
      )}

      {gameState === 'answering' && currentQuestion && (
        <div className="play-answering">
          <QuestionDisplay question={currentQuestion} />
          <AnswerInput
            onSubmit={submitAnswer}
            hasAnswered={hasAnswered}
          />
          <div className="report-row">
            <button
              className={`btn-report ${reported ? 'reported' : ''}`}
              onClick={() => { reportQuestion(currentQuestion.id, currentQuestion.text); setReported(true); }}
              disabled={reported}
            >
              {reported ? '✅ Reported' : '🚩 Report question'}
            </button>
          </div>
        </div>
      )}

      {gameState === 'results' && roundResult && (
        <div className="play-results">
          <div className="watch-host-screen">
            <div className="watch-message">
              {roundResult.isLastQuestion
                ? '👀 Watch the host screen for final results!'
                : '👀 Watch the host screen for results!'}
            </div>
          </div>
          <div className="ready-section">
            <button
              className={`btn-ready ${isReady ? 'ready' : ''}`}
              onClick={markReady}
              disabled={isReady}
            >
              {isReady
                ? '✅ Ready!'
                : roundResult.isLastQuestion
                  ? 'See Final Results'
                  : 'Ready for Next Question'}
            </button>
            <p className="ready-status">
              {readyCount} / {totalCount} players ready
            </p>
          </div>
        </div>
      )}

      {gameState === 'finished' && finalResults && (
        <div className="play-finished">
          <Scoreboard finalResults={finalResults} />
          <div className="game-over-message">
            <h3>Thanks for playing!</h3>
            <button
              className="btn-primary"
              onClick={() => navigate('/')}
            >
              🏠 Go Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Play;
