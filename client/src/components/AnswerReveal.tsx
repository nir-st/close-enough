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

  // Sort guesses from lowest to highest
  const sortedResults = [...results].sort((a, b) => a.answer - b.answer);
  const allValues = [...sortedResults.map(r => r.answer), correctAnswer];

  // Calculate smart zoom ranges
  useEffect(() => {
    const steps: AnimationStep[] = [];

    // Group values by proximity (values within 30% of range are considered "close")
    const globalMin = Math.min(...allValues);
    const globalMax = Math.max(...allValues);
    const globalRange = globalMax - globalMin;

    if (globalRange === 0) {
      // All values are the same - just show them all at once
      sortedResults.forEach((_, i) => {
        steps.push({ type: 'guess', guessIndex: i });
      });
      steps.push({ type: 'answer' });
      steps.push({ type: 'highlight' });
    } else {
      // Find clusters of close values
      const clusters: number[][] = [];
      let currentCluster: number[] = [sortedResults[0].answer];

      for (let i = 1; i < sortedResults.length; i++) {
        const prevValue = sortedResults[i - 1].answer;
        const currValue = sortedResults[i].answer;
        const gap = currValue - prevValue;
        const gapRatio = gap / globalRange;

        // If gap is more than 30% of global range, start new cluster
        if (gapRatio > 0.3) {
          clusters.push([...currentCluster]);
          currentCluster = [currValue];
        } else {
          currentCluster.push(currValue);
        }
      }
      clusters.push(currentCluster);

      // Process each cluster
      let revealedCount = 0;
      for (let clusterIdx = 0; clusterIdx < clusters.length; clusterIdx++) {
        const cluster = clusters[clusterIdx];
        const clusterMin = Math.min(...cluster);
        const clusterMax = Math.max(...cluster);
        const padding = Math.max((clusterMax - clusterMin) * 0.2, globalRange * 0.05);

        // Zoom to this cluster
        steps.push({
          type: 'zoom',
          zoomRange: {
            min: clusterMin - padding,
            max: clusterMax + padding
          }
        });

        // Reveal guesses in this cluster one by one
        for (let i = 0; i < cluster.length; i++) {
          const guessIndex = sortedResults.findIndex(r => r.answer === cluster[i] &&
            sortedResults.slice(0, revealedCount).filter(sr => sr.answer === cluster[i]).length <=
            cluster.slice(0, i).filter(c => c === cluster[i]).length
          );
          steps.push({ type: 'guess', guessIndex });
          revealedCount++;
        }

        // If this is not the last cluster and there's a significant gap, zoom out slightly
        if (clusterIdx < clusters.length - 1) {
          const nextCluster = clusters[clusterIdx + 1];
          const nextMin = Math.min(...nextCluster);
          const gapSize = nextMin - clusterMax;

          // Show the gap by zooming out a bit
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

      // Final zoom to show everything including correct answer
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

  // Execute animation steps
  useEffect(() => {
    if (animationSteps.length === 0) return;

    const timers: NodeJS.Timeout[] = [];
    let delay = 500; // Initial delay

    animationSteps.forEach((step, index) => {
      timers.push(setTimeout(() => {
        setCurrentStep(index);

        if (step.zoomRange) {
          setCurrentZoom(step.zoomRange);
        }

        // Call onComplete after the last step
        if (index === animationSteps.length - 1 && onComplete) {
          setTimeout(onComplete, 4000);
        }
      }, delay));

      // Variable delay based on step type
      if (step.type === 'zoom') {
        delay += 1500; // Zoom animation (was 800ms)
      } else if (step.type === 'guess') {
        delay += 1000; // Guess reveal (was 600ms)
      } else if (step.type === 'answer') {
        delay += 2000; // Answer reveal (was 1000ms)
      } else if (step.type === 'highlight') {
        delay += 2500; // Highlight (was 1500ms)
      }
    });

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [animationSteps, onComplete]);

  // Calculate visible guesses up to current step
  const visibleGuessIndices = animationSteps
    .slice(0, currentStep + 1)
    .filter(s => s.type === 'guess')
    .map(s => s.guessIndex!);

  const showAnswer = animationSteps.slice(0, currentStep + 1).some(s => s.type === 'answer');
  const showHighlight = animationSteps.slice(0, currentStep + 1).some(s => s.type === 'highlight');

  // Calculate position based on current zoom
  const getPosition = (value: number): number => {
    const zoomRange = currentZoom.max - currentZoom.min;
    if (zoomRange === 0) return 50;
    return ((value - currentZoom.min) / zoomRange) * 100;
  };

  // Format number with commas
  const formatNumber = (num: number): string => {
    return Math.round(num).toLocaleString('en-US');
  };

  // Generate tick marks for current zoom
  const numTicks = 5;
  const ticks = Array.from({ length: numTicks }, (_, i) => {
    const value = currentZoom.min + ((currentZoom.max - currentZoom.min) / (numTicks - 1)) * i;
    // Format large numbers more nicely
    if (Math.abs(value) >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return formatNumber(value);
  });

  const winners = results.filter(r => r.pointsEarned > 0);

  return (
    <div className="answer-reveal">
      <h3 className="reveal-title">📊 Results</h3>

      <div className="number-line-container">
        <div className="number-line visible">
          {/* Player guess markers */}
          {sortedResults.map((result, index) => {
            const isVisible = visibleGuessIndices.includes(index);
            const position = getPosition(result.answer);
            const isWinner = showHighlight && result.pointsEarned > 0;

            // Only show if in current zoom range and revealed
            const inRange = position >= -5 && position <= 105;

            return (
              <div
                key={`guess-${result.playerId}`}
                className={`marker guess-marker ${isVisible ? 'visible' : ''} ${
                  isWinner ? 'winner' : ''
                } ${!inRange ? 'out-of-range' : ''}`}
                style={{ left: `${Math.max(0, Math.min(100, position))}%` }}
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
          {showAnswer && (
            <div
              className="marker answer-marker visible"
              style={{ left: `${Math.max(0, Math.min(100, getPosition(correctAnswer)))}%` }}
            >
              <div className="marker-content">
                <div className="marker-name answer-name">Correct Answer</div>
                <div className="marker-star">⭐</div>
                <div className="marker-label answer-label">{formatNumber(correctAnswer)}</div>
              </div>
            </div>
          )}

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
      {showHighlight && winners.length > 0 && (
        <div className="winner-announcement">
          🎉 {winners.map(w => `${w.playerAvatar} ${w.playerName}`).join(' & ')} closest!
        </div>
      )}
    </div>
  );
}

export default AnswerReveal;
