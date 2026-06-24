import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import QRCodeDisplay from '../components/QRCodeDisplay';
import PlayerList from '../components/PlayerList';
import QuestionDisplay from '../components/QuestionDisplay';
import Timer from '../components/Timer';
import AnswerReveal from '../components/AnswerReveal';
import Scoreboard from '../components/Scoreboard';
import * as sound from '../services/sound';
import './CastHost.css';

function CastHost({ roomCode }: { roomCode: string }) {
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
    answerRevealed,
    setTimeRemaining
  } = useGameStore();

  const disconnectedPlayerIds = players.filter(p => !p.connected).map(p => p.id);
  const connectedCount = players.filter(p => p.connected).length;

  useEffect(() => {
    if (gameState === 'answering' && timeRemaining > 0) {
      const interval = setInterval(() => {
        setTimeRemaining(Math.max(0, timeRemaining - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState, timeRemaining, setTimeRemaining]);

  useEffect(() => {
    if (gameState === 'results') setShowDetailedResults(false);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'answering' && timeRemaining === 0) {
      useGameStore.getState().socket?.emit('timer-expired');
    }
  }, [gameState, timeRemaining]);

  // Sound effects
  useEffect(() => {
    if (gameState === 'question') sound.playQuestionAppear();
  }, [gameState, currentQuestion?.id]);

  useEffect(() => {
    if (gameState !== 'answering') return;
    if (timeRemaining > 0 && timeRemaining <= 5) sound.playTick();
    else if (timeRemaining === 0) sound.playTimeUp();
  }, [gameState, timeRemaining]);

  useEffect(() => {
    if (gameState === 'finished') sound.playGameOver();
  }, [gameState]);

  // Try to unlock audio when the game starts (no gesture needed on Cast receivers)
  useEffect(() => {
    sound.unlockAudio();
  }, []);

  const difficultyLabel = settings.difficulty === 'mixed' ? 'Mixed difficulty' : settings.difficulty.charAt(0).toUpperCase() + settings.difficulty.slice(1);
  const categoryLabel = settings.categoryFilter === 'mixed' ? 'All categories' : settings.categoryFilter;

  return (
    <div className="cast-container">
      <div className="cast-header">
        <h1>Close Enough</h1>
        <div className="cast-room-badge">Room: {roomCode}</div>
      </div>

      {gameState === 'waiting' && (
        <div className="cast-lobby">
          <div className="cast-lobby-left">
            <QRCodeDisplay joinUrl={joinUrl || ''} roomCode={roomCode} size={220} />
            <p className="cast-join-hint">Scan to join</p>
            <div className="cast-settings-display">
              <h3>Settings</h3>
              <p>{settings.questionCount} questions · {difficultyLabel}</p>
              <p>{categoryLabel} · {settings.timePerQuestion}s</p>
            </div>
            {players.length < 2 ? (
              <p className="cast-status-text">Waiting for players…</p>
            ) : (
              <p className="cast-status-text">Waiting for admin to start</p>
            )}
          </div>
          <div className="cast-lobby-right">
            <PlayerList players={players} />
          </div>
        </div>
      )}

      {gameState === 'question' && currentQuestion && (
        <div className="cast-game-view">
          <QuestionDisplay question={currentQuestion} large />
          <p className="cast-instruction">Get ready!</p>
        </div>
      )}

      {gameState === 'answering' && currentQuestion && (
        <div className="cast-game-view">
          <QuestionDisplay question={currentQuestion} large />
          <Timer
            timeRemaining={timeRemaining}
            totalTime={settings.timePerQuestion}
            onExpire={() => {}}
          />
          <div className="cast-answered-status">
            {answeredPlayerIds.length} / {connectedCount} answered
          </div>
        </div>
      )}

      {gameState === 'results' && roundResult && (
        <div className="cast-results-view">
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
              <div className="cast-ready-status">
                {!answerRevealed ? (
                  <p>Revealing answer to players…</p>
                ) : connectedCount < 2 ? (
                  <p>Waiting for players to reconnect… ({connectedCount} connected)</p>
                ) : roundResult.isLastQuestion ? (
                  <p>Moving to final results…</p>
                ) : (
                  <p>Waiting for players: {readyPlayerIds.length} / {totalCount} ready</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {gameState === 'finished' && finalResults && (
        <div className="cast-results-view">
          <Scoreboard finalResults={finalResults} />
          <p className="cast-status-text">Game over! Admin can start a new round from their phone.</p>
        </div>
      )}
    </div>
  );
}

export default CastHost;
