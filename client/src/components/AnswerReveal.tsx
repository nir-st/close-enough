import { useEffect, useState } from 'react';
import { ScoreResult } from '../types/game';
import './AnswerReveal.css';

interface AnswerRevealProps {
  correctAnswer: number;
  results: ScoreResult[];
  onComplete?: () => void;
}

interface MarkerPosition {
  value: number;
  percentage: number;
  isOutlier: boolean;
}

function AnswerReveal({ correctAnswer, results, onComplete }: AnswerRevealProps) {
  const [phase, setPhase] = useState<'line' | 'guesses' | 'answer' | 'highlight'>('line');
  const [visibleGuesses, setVisibleGuesses] = useState<number>(0);

  // Calculate range and positions
  const allValues = [...results.map(r => r.answer), correctAnswer];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  // Add 10% padding to range
  const padding = (max - min) * 0.1 || 10; // fallback padding if all same
  const rangeMin = Math.floor(min - padding);
  const rangeMax = Math.ceil(max + padding);
  const range = rangeMax - rangeMin;

  // Detect outliers (more than 3x median distance from median)
  const sortedValues = [...results.map(r => r.answer)].sort((a, b) => a - b);
  const median = sortedValues[Math.floor(sortedValues.length / 2)];
  const distances = results.map(r => Math.abs(r.answer - median));
  const medianDistance = distances.sort((a, b) => a - b)[Math.floor(distances.length / 2)];
  const outlierThreshold = medianDistance * 3;

  // Calculate positions for all markers
  const guessPositions: (MarkerPosition & { result: ScoreResult })[] = results.map(result => {
    const isOutlier = Math.abs(result.answer - median) > outlierThreshold && results.length > 2;
    return {
      value: result.answer,
      percentage: ((result.answer - rangeMin) / range) * 100,
      isOutlier,
      result
    };
  });

  const answerPosition: MarkerPosition = {
    value: correctAnswer,
    percentage: ((correctAnswer - rangeMin) / range) * 100,
    isOutlier: false
  };

  // Animation sequence
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    // Phase 1: Show line (500ms)
    timers.push(setTimeout(() => setPhase('guesses'), 500));

    // Phase 2: Drop in guesses one by one (300ms each)
    guessPositions.forEach((_, index) => {
      timers.push(setTimeout(() => {
        setVisibleGuesses(index + 1);
      }, 800 + index * 300));
    });

    // Phase 3: Reveal answer (after all guesses + 500ms)
    const answerDelay = 800 + guessPositions.length * 300 + 500;
    timers.push(setTimeout(() => setPhase('answer'), answerDelay));

    // Phase 4: Highlight winner (after answer + 1000ms)
    timers.push(setTimeout(() => {
      setPhase('highlight');
      if (onComplete) {
        setTimeout(onComplete, 1500);
      }
    }, answerDelay + 1000));

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [guessPositions.length, onComplete]);

  // Generate tick marks
  const numTicks = 5;
  const ticks = Array.from({ length: numTicks }, (_, i) => {
    const value = rangeMin + (range / (numTicks - 1)) * i;
    return Math.round(value);
  });

  const winners = results.filter(r => r.pointsEarned > 0);

  return (
    <div className="answer-reveal">
      <h3 className="reveal-title">📊 Results</h3>

      {/* Number line */}
      <div className="number-line-container">
        {/* Outlier labels above */}
        {phase !== 'line' && (
          <div className="outliers-container">
            {guessPositions
              .filter(gp => gp.isOutlier && visibleGuesses > guessPositions.indexOf(gp))
              .map((gp, index) => (
                <div key={`outlier-${index}`} className="outlier-label">
                  {gp.result.playerAvatar} {gp.result.playerName}: {gp.value} ↓
                </div>
              ))}
          </div>
        )}

        {/* Main number line */}
        <div className={`number-line ${phase !== 'line' ? 'visible' : ''}`}>
          {/* Player guess markers */}
          {guessPositions
            .filter(gp => !gp.isOutlier)
            .map((gp, index) => (
              <div
                key={`guess-${gp.result.playerId}`}
                className={`marker guess-marker ${
                  index < visibleGuesses ? 'visible' : ''
                } ${phase === 'highlight' && gp.result.pointsEarned > 0 ? 'winner' : ''}`}
                style={{ left: `${gp.percentage}%` }}
              >
                <div className="marker-avatar">{gp.result.playerAvatar}</div>
                <div className="marker-label">{gp.value}</div>
              </div>
            ))}

          {/* Correct answer marker */}
          {phase === 'answer' || phase === 'highlight' ? (
            <div
              className={`marker answer-marker ${phase === 'answer' || phase === 'highlight' ? 'visible' : ''}`}
              style={{ left: `${answerPosition.percentage}%` }}
            >
              <div className="marker-star">⭐</div>
              <div className="marker-label answer-label">{correctAnswer}</div>
            </div>
          ) : null}

          {/* Line itself */}
          <div className="line" />

          {/* Tick marks */}
          <div className="ticks">
            {ticks.map((tick, i) => (
              <div
                key={i}
                className="tick"
                style={{ left: `${(i / (numTicks - 1)) * 100}%` }}
              >
                <div className="tick-mark" />
                <div className="tick-label">{tick}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Winner announcement */}
      {phase === 'highlight' && winners.length > 0 && (
        <div className="winner-announcement">
          🎉 {winners.map(w => `${w.playerAvatar} ${w.playerName}`).join(' & ')} closest!
        </div>
      )}
    </div>
  );
}

export default AnswerReveal;
