import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameStore } from '../stores/gameStore';
import QuestionDisplay from '../components/QuestionDisplay';
import AnswerInput from '../components/AnswerInput';
import Scoreboard from '../components/Scoreboard';
import GameSettings from '../components/GameSettings';
import NameModal from '../components/NameModal';
import './Play.css';

function Play() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const hasJoinedRef = useRef(false);
  const [reported, setReported] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
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
    answerRevealed,
    markReady,
    reportQuestion,
    startGame,
    settings,
    updateSettings,
    adminId,
    isCastRoom,
    restartGame,
    changeName
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
        setShowJoinModal(true);
      }
    }
  }, [roomCode, playerName, playerId, joinRoom]);

  const myPlayer = players.find(p => p.id === playerId);
  const isAdmin = isCastRoom && playerId === adminId;
  const adminPlayer = players.find(p => p.id === adminId);
  const isReady = readyPlayerIds.includes(playerId || '');

  return (
    <div className="play-container">
      {showJoinModal && (
        <NameModal
          title="What's your name?"
          placeholder="Enter your name"
          onSubmit={(name) => {
            setShowJoinModal(false);
            if (roomCode) joinRoom(roomCode, name);
          }}
        />
      )}

      {showChangeModal && myPlayer && (
        <NameModal
          title="Change your name"
          defaultValue={myPlayer.name}
          onSubmit={(name) => {
            setShowChangeModal(false);
            if (name !== myPlayer.name) changeName(name);
          }}
          onCancel={() => setShowChangeModal(false)}
        />
      )}

      {!connected && (
        <div className="connection-lost-banner">
          🔄 Reconnecting...
        </div>
      )}

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
            <h3>Joined!</h3>
            {myPlayer && (
              <button
                className="btn-change-name"
                onClick={() => setShowChangeModal(true)}
              >
                {myPlayer.avatar} {myPlayer.name} (tap to change)
              </button>
            )}
            <div className="player-count">{players.length} players connected</div>
            {isAdmin ? (
              <>
                <GameSettings settings={settings} onUpdate={updateSettings} disabled={false} />
                {players.length >= 2 ? (
                  <button className="btn-primary start-game-btn" onClick={startGame}>
                    Start Game ({players.length} players)
                  </button>
                ) : (
                  <p>Waiting for more players… (need at least 2)</p>
                )}
              </>
            ) : (
              <p className="waiting-for-admin">
                {isCastRoom
                  ? `Waiting for ${adminPlayer?.name || 'the first player'} to start the game…`
                  : 'Waiting for the host to start the game…'}
              </p>
            )}
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

          {!roundResult.isLastQuestion && (
            <div className="ready-section">
              {!answerRevealed ? (
                <p className="ready-status">⏳ Waiting for answer reveal...</p>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}
        </div>
      )}

      {gameState === 'finished' && finalResults && (
        <div className="play-finished">
          <Scoreboard finalResults={finalResults} />
          <div className="game-over-message">
            <h3>Thanks for playing!</h3>
            {isAdmin && (
              <button className="btn-primary" onClick={restartGame} style={{ marginBottom: 12 }}>
                Play Again
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => navigate('/')}
            >
              Go Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Play;
