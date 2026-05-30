import { useEffect, useState } from 'react';
import { ScoreResult } from '../types/game';
import './AnswerReveal.css';

interface AnswerRevealProps {
  correctAnswer: number;
  results: ScoreResult[];
  onComplete?: () => void;
}

interface ZoomRange {
  min: number;
  max: number;
}

interface AnimationStep {
  type: 'zoom' | 'guess' | 'answer' | 'highlight';
  zoomRange?: ZoomRange;
  guessIndex?: number;
}

function AnswerReveal({ correctAnswer, results, onComplete }: AnswerRevealProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [animationSteps, setAnimationSteps] = useState<AnimationStep[]>([]);
  const [currentZoom, setCurrentZoom] = useState<ZoomRange>({ min: 0, max: 100 });

  const sortedResults = [...results].sort((a, b) => a.answer - b.answer);
  const allValues = [...sortedResults.map(r => r.answer), correctAnswer];

  useEffect(() => {
    const steps: AnimationStep[] = [];

    const globalMin = Math.min(...allValues);
    const globalMax = Math.max(...allValues);
    const globalRange = globalMax - globalMin;

    if (globalRange === 0) {
      sortedResults.forEach((_, i) => {
        steps.push({ type: 'guess', guessIndex: i });
      });
      steps.push({ type: 'answer' });
      steps.push({ type: 'highlight' });
    } else {
      const clusters: number[][] = [];
      let currentCluster: number[] = [sortedResults[0].answer];

      for (let i = 1; i < sortedResults.length; i++) {
        const prevValue = sortedResults[i - 1].answer;
        const currValue = sortedResults[i].answer;
        const gap = currValue - prevValue;
        const gapRatio = gap / globalRange;

        if (gapRatio > 0.3) {
          clusters.push([...currentCluster]);
          currentCluster = [currValue];
        } else {
          currentCluster.push(currValue);
        }
      }
      clusters.push(currentCluster);

      let revealedCount = 0;
      for (let clusterIdx = 0; clusterIdx < clusters.length; clusterIdx++) {
        const cluster = clusters[clusterIdx];
        const clusterMin = Math.min(...cluster);
        const clusterMax = Math.max(...cluster);
        const padding = Math.max((clusterMax - clusterMin) * 0.2, globalRange * 0.05);

        steps.push({
          type: 'zoom',
          zoomRange: {
            min: clusterMin - padding,
            max: clusterMax + padding
          }
        });

        for (let i = 0; i < cluster.length; i++) {
          const guessIndex = sortedResults.findIndex(r => r.answer === cluster[i] &&
            sortedResults.slice(0, revealedCount).filter(sr => sr.answer === cluster[i]).length <=
            cluster.slice(0, i).filter(c => c === cluster[i]).length
          );
          steps.push({ type: 'guess', guessIndex });
          revealedCount++;
        }

        if (clusterIdx < clusters.length - 1) {
          const nextCluster = clusters[clusterIdx + 1];
          const nextMin = Math.min(...nextCluster);
          const gapSize = nextMin - clusterMax;

          if (gapSize > globalRange * 0.3) {
            steps.push({
              type: 'zoom',
              zoomRange: {
                min: clusterMin - padding,
                max: nextMin + padding
              }
            });
          }
        }
      }

      const finalPadding = globalRange * 0.1 || 10;
      steps.push({
        type: 'zoom',
        zoomRange: {
          min: globalMin - finalPadding,
          max: globalMax + finalPadding
        }
      });

      steps.push({ type: 'answer' });
      steps.push({ type: 'highlight' });
    }

    setAnimationSteps(steps);
  }, [results, correctAnswer]);

  useEffect(() => {
    if (animationSteps.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let delay = 500;

    animationSteps.forEach((step, index) => {
      timers.push(setTimeout(() => {
        setCurrentStep(index);

        if (step.zoomRange) {
          setCurrentZoom(step.zoomRange);
        }

        if (index === animationSteps.length - 1 && onComplete) {
          setTimeout(onComplete, 4000);
        }
      }, delay));

      if (step.type === 'zoom') {
        delay += 1500;
      } else if (step.type === 'guess') {
        delay += 1000;
      } else if (step.type === 'answer') {
        delay += 2000;
      } else if (step.type === 'highlight') {
        delay += 2500;
      }
    });

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [animationSteps, onComplete]);

  const visibleGuessIndices = animationSteps
    .slice(0, currentStep + 1)
    .filter(s => s.type === 'guess')
    .map(s => s.guessIndex!);

  const showAnswer = animationSteps.slice(0, currentStep + 1).some(s => s.type === 'answer');
  const showHighlight = animationSteps.slice(0, currentStep + 1).some(s => s.type === 'highlight');

  const getPosition = (value: number): number => {
    const zoomRange = currentZoom.max - currentZoom.min;
    if (zoomRange === 0) return 50;
    return ((value - currentZoom.min) / zoomRange) * 100;
  };

  const formatNumber = (num: number): string => {
    return Math.round(num).toLocaleString('en-US');
  };

  const numTicks = 5;
  const ticks = Array.from({ length: numTicks }, (_, i) => {
    const value = currentZoom.min + ((currentZoom.max - currentZoom.min) / (numTicks - 1)) * i;
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return formatNumber(value);
  });

  const winners = results.filter(r => r.pointsEarned > 0);

  // Calculate vertical offsets for overlapping markers (#7)
  // Group visible markers that are within 5% of each other and stagger them
  const getVerticalOffset = (index: number): number => {
    if (!visibleGuessIndices.includes(index)) return 0;
    const pos = getPosition(sortedResults[index].answer);
    if (pos < 0 || pos > 100) return 0;

    // Count how many visible markers are "close" (within 5%) and come before this one
    let closeCount = 0;
    for (let i = 0; i < index; i++) {
      if (!visibleGuessIndices.includes(i)) continue;
      const otherPos = getPosition(sortedResults[i].answer);
      if (Math.abs(otherPos - pos) < 5) {
        closeCount++;
      }
    }
    // Alternate up/down: 0 → 0, 1 → -1, 2 → +1, 3 → -2, ...
    if (closeCount === 0) return 0;
    const direction = closeCount % 2 === 1 ? -1 : 1;
    const magnitude = Math.ceil(closeCount / 2);
    return direction * magnitude * 60; // 60px per level
  };

  return (
    <div className="answer-reveal">
      <h3 className="reveal-title">📊 Results</h3>

      <div className="number-line-container">
        <div className="number-line visible">
          {/* Player guess markers */}
          {sortedResults.map((result, index) => {
            const pos = getPosition(result.answer);
            // Only show if in current zoom range (#8 — no clamping to edge)
            const inRange = pos >= 0 && pos <= 100;
            const isVisible = visibleGuessIndices.includes(index) && inRange;
            const isWinner = showHighlight && result.pointsEarned > 0;
            const verticalOffset = getVerticalOffset(index);

            return (
              <div
                key={`guess-${result.playerId}`}
                className={`marker guess-marker ${isVisible ? 'visible' : ''} ${isWinner ? 'winner' : ''}`}
                style={{
                  left: `${pos}%`,
                  top: `calc(50% + ${verticalOffset}px)`
                }}
              >
                <div className="marker-content">
                  <div className="marker-name">{result.playerName}</div>
                  <div className="marker-avatar">{result.playerAvatar}</div>
                  <div className="marker-label">{formatNumber(result.answer)}</div>
                </div>
              </div>
            );
          })}

          {/* Correct answer marker */}
          {showAnswer && (() => {
            const pos = getPosition(correctAnswer);
            const inRange = pos >= 0 && pos <= 100;
            return inRange ? (
              <div
                className="marker answer-marker visible"
                style={{ left: `${pos}%` }}
              >
                <div className="marker-content">
                  <div className="marker-name answer-name">Correct Answer</div>
                  <div className="marker-star">⭐</div>
                  <div className="marker-label answer-label">{formatNumber(correctAnswer)}</div>
                </div>
              </div>
            ) : null;
          })()}

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

      {showHighlight && winners.length > 0 && (
        <div className="winner-announcement">
          🎉 {winners.map(w => `${w.playerAvatar} ${w.playerName}`).join(' & ')} closest!
        </div>
      )}
    </div>
  );
}

export default AnswerReveal;
