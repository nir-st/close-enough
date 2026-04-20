import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import QuestionDisplay from '../components/QuestionDisplay';
import AnswerInput from '../components/AnswerInput';
import AnswerReveal from '../components/AnswerReveal';
import Scoreboard from '../components/Scoreboard';
import './Play.css';

function Play() {
  const { roomCode } = useParams();
  const hasJoinedRef = useRef(false);
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
    markReady
  } = useGameStore();

  useEffect(() => {
    connectSocket();
  }, [connectSocket]);

  useEffect(() => {
    // Auto-join if we have a room code but haven't joined yet
    console.log('Play useEffect - roomCode:', roomCode, 'playerName:', playerName, 'playerId:', playerId, 'hasJoinedRef:', hasJoinedRef.current);

    if (roomCode && !playerName && !playerId && !hasJoinedRef.current) {
      console.log('⚠️  About to prompt for name');
      hasJoinedRef.current = true; // Set BEFORE prompt to prevent double execution

      // Check if we have a stored name for this room (reconnection)
      const storedName = localStorage.getItem(`player_name_${roomCode}`);

      if (storedName) {
        console.log('🔄 Found stored name, reconnecting as:', storedName);
        joinRoom(roomCode, storedName);
      } else {
        const name = prompt('Enter your name:');
        console.log('✅ Name entered:', name);
        if (name) {
          joinRoom(roomCode, name);
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
        </div>
      )}

      {gameState === 'answering' && currentQuestion && (
        <div className="play-answering">
          <QuestionDisplay question={currentQuestion} />
          <AnswerInput
            onSubmit={submitAnswer}
            hasAnswered={hasAnswered}
          />
        </div>
      )}

      {gameState === 'results' && roundResult && (
        <div className="play-results">
          {!roundResult.isLastQuestion ? (
            <>
              <div className="watch-host-screen">
                <div className="watch-message">
                  👀 Watch the host screen for results!
                </div>
              </div>
              <div className="ready-section">
                <button
                  className={`btn-ready ${isReady ? 'ready' : ''}`}
                  onClick={markReady}
                  disabled={isReady}
                >
                  {isReady ? '✅ Ready!' : 'Ready for Next Question'}
                </button>
                <p className="ready-status">
                  {readyCount} / {totalCount} players ready
                </p>
              </div>
            </>
          ) : (
            <div className="watch-host-screen">
              <div className="watch-message">
                👀 Watch the host screen for final results!
              </div>
            </div>
          )}
        </div>
      )}

      {gameState === 'finished' && finalResults && (
        <div className="play-finished">
          <Scoreboard finalResults={finalResults} />
          <div className="game-over-message">
            <h3>Thanks for playing!</h3>
          </div>
        </div>
      )}
    </div>
  );
}

export default Play;
