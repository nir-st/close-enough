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
  // Start at -1 so nothing is "played" until the first timeout fires
  const [currentStep, setCurrentStep] = useState(-1);
  const [animationSteps, setAnimationSteps] = useState<AnimationStep[]>([]);
  const [currentZoom, setCurrentZoom] = useState<ZoomRange | null>(null);

  const sortedResults = [...results].sort((a, b) => a.answer - b.answer);
  const allValues = [...sortedResults.map(r => r.answer), correctAnswer];
  const globalMin = Math.min(...allValues);
  const globalMax = Math.max(...allValues);
  const globalRange = globalMax - globalMin;

  // Build animation steps once when results arrive
  useEffect(() => {
    if (results.length === 0) return;
    const steps: AnimationStep[] = [];

    if (globalRange === 0) {
      // All values identical — just reveal everyone then the answer
      const padding = Math.max(Math.abs(correctAnswer) * 0.5, 10);
      steps.push({ type: 'zoom', zoomRange: { min: correctAnswer - padding, max: correctAnswer + padding } });
      sortedResults.forEach((_, i) => steps.push({ type: 'guess', guessIndex: i }));
      steps.push({ type: 'answer' });
      steps.push({ type: 'highlight' });
    } else {
      // --- Step 1: cluster guesses by proximity ---
      const clusters: number[][] = [];
      let cur: number[] = [sortedResults[0].answer];
      for (let i = 1; i < sortedResults.length; i++) {
        const gap = (sortedResults[i].answer - sortedResults[i - 1].answer) / globalRange;
        if (gap > 0.3) { clusters.push([...cur]); cur = [sortedResults[i].answer]; }
        else cur.push(sortedResults[i].answer);
      }
      clusters.push(cur);

      // Helper: map a cluster (ordered by original answer) to sortedResults indices
      const usedIndices = new Set<number>();
      const clusterIndices = (clusterVals: number[]): number[] => {
        return clusterVals.map(val => {
          for (let j = 0; j < sortedResults.length; j++) {
            if (sortedResults[j].answer === val && !usedIndices.has(j)) {
              usedIndices.add(j);
              return j;
            }
          }
          return -1; // shouldn't happen
        }).filter(i => i !== -1);
      };

      // --- Step 2: initial tight zoom around first cluster ---
      const c0Min = Math.min(...clusters[0]);
      const c0Max = Math.max(...clusters[0]);
      const initPad = Math.max((c0Max - c0Min) * 0.4, globalRange * 0.1);
      let zMin = c0Min - initPad;
      let zMax = c0Max + initPad;
      steps.push({ type: 'zoom', zoomRange: { min: zMin, max: zMax } });

      // Reveal first cluster
      for (const idx of clusterIndices(clusters[0])) {
        steps.push({ type: 'guess', guessIndex: idx });
      }

      // --- Step 3: for each subsequent cluster, EXPAND outward (never re-center) ---
      for (let ci = 1; ci < clusters.length; ci++) {
        const cMin = Math.min(...clusters[ci]);
        const cMax = Math.max(...clusters[ci]);
        // Expand zoom only in the direction needed, with generous padding
        // so the new guess doesn't land right at the edge
        const expandPad = Math.max((cMax - cMin) * 0.3, globalRange * 0.14);
        zMin = Math.min(zMin, cMin - expandPad);
        zMax = Math.max(zMax, cMax + expandPad);
        steps.push({ type: 'zoom', zoomRange: { min: zMin, max: zMax } });

        for (const idx of clusterIndices(clusters[ci])) {
          steps.push({ type: 'guess', guessIndex: idx });
        }
      }

      // --- Step 4: include correct answer if outside current view ---
      const ansPad = (zMax - zMin) * 0.12;
      if (correctAnswer < zMin || correctAnswer > zMax) {
        zMin = Math.min(zMin, correctAnswer - ansPad);
        zMax = Math.max(zMax, correctAnswer + ansPad);
        steps.push({ type: 'zoom', zoomRange: { min: zMin, max: zMax } });
      }

      steps.push({ type: 'answer' });
      steps.push({ type: 'highlight' });
    }

    setAnimationSteps(steps);
    setCurrentStep(-1);
  }, [results, correctAnswer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Execute each step with delays
  useEffect(() => {
    if (animationSteps.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let delay = 600;

    animationSteps.forEach((step, index) => {
      timers.push(setTimeout(() => {
        setCurrentStep(index);
        if (step.zoomRange) setCurrentZoom(step.zoomRange);
        if (index === animationSteps.length - 1 && onComplete) {
          setTimeout(onComplete, 3500);
        }
      }, delay));

      if (step.type === 'zoom')      delay += 1200;
      else if (step.type === 'guess')   delay += 900;
      else if (step.type === 'answer')  delay += 1800;
      else if (step.type === 'highlight') delay += 2000;
    });

    return () => timers.forEach(clearTimeout);
  }, [animationSteps, onComplete]);

  // Derive visible state from steps played so far
  const stepsPlayed = animationSteps.slice(0, currentStep + 1);
  const revealedIndices = stepsPlayed.filter(s => s.type === 'guess').map(s => s.guessIndex!);
  const showAnswer   = stepsPlayed.some(s => s.type === 'answer');
  const showHighlight = stepsPlayed.some(s => s.type === 'highlight');

  // Position helpers
  const zoom = currentZoom ?? { min: globalMin - globalRange * 0.1, max: globalMax + globalRange * 0.1 };
  const getPos = (v: number): number => {
    const span = zoom.max - zoom.min;
    if (span === 0) return 50;
    return ((v - zoom.min) / span) * 100;
  };

  const formatNum = (n: number) => Math.round(n).toLocaleString('en-US');

  const numTicks = 5;
  const ticks = Array.from({ length: numTicks }, (_, i) => {
    const v = zoom.min + ((zoom.max - zoom.min) / (numTicks - 1)) * i;
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
    return formatNum(v);
  });

  // Vertical stagger for overlapping answers (based on value proximity, not zoom %)
  const getStagger = (index: number): number => {
    if (!revealedIndices.includes(index)) return 0;
    const val = sortedResults[index].answer;
    const threshold = globalRange > 0 ? globalRange * 0.03 : Math.abs(val) * 0.03 || 1;
    let closeCount = 0;
    for (let i = 0; i < index; i++) {
      if (!revealedIndices.includes(i)) continue;
      if (Math.abs(sortedResults[i].answer - val) <= threshold) closeCount++;
    }
    if (closeCount === 0) return 0;
    const sign = closeCount % 2 === 1 ? -1 : 1;
    return sign * Math.ceil(closeCount / 2) * 65;
  };

  const winners = results.filter(r => r.pointsEarned > 0);
  const exactWinner = winners.find(w => w.distance === 0);

  return (
    <div className="answer-reveal">
      <h3 className="reveal-title">📊 Results</h3>

      <div className="number-line-container">
        <div className="number-line">
          {/* Player markers */}
          {sortedResults.map((result, index) => {
            const isRevealed = revealedIndices.includes(index);
            const pos = getPos(result.answer);
            const stagger = getStagger(index);
            const isWinner = showHighlight && result.pointsEarned > 0;

            return (
              <div
                key={`guess-${result.playerId}`}
                className={`marker guess-marker ${isRevealed ? 'visible' : ''} ${isWinner ? 'winner' : ''}`}
                style={{ left: `${pos}%`, top: `calc(50% + ${stagger}px)` }}
              >
                <div className="marker-content">
                  <div className="marker-name">{result.playerName}</div>
                  <div className="marker-avatar">{result.playerAvatar}</div>
                  <div className="marker-label">{formatNum(result.answer)}</div>
                </div>
              </div>
            );
          })}

          {/* Correct answer marker */}
          {showAnswer && (
            <div
              className="marker answer-marker visible"
              style={{ left: `${getPos(correctAnswer)}%` }}
            >
              <div className="marker-content">
                <div className="marker-name answer-name">✅ Correct</div>
                <div className="marker-star">⭐</div>
                <div className="marker-label answer-label">{formatNum(correctAnswer)}</div>
              </div>
            </div>
          )}

          <div className="line" />

          <div className="ticks">
            {ticks.map((tick, i) => (
              <div key={i} className="tick" style={{ left: `${(i / (numTicks - 1)) * 100}%` }}>
                <div className="tick-mark" />
                <div className="tick-label">{tick}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showHighlight && winners.length > 0 && (
        <div className="winner-announcement">
          {exactWinner
            ? `🎯 ${exactWinner.playerAvatar} ${exactWinner.playerName} got it exactly right!`
            : `🎉 ${winners.map(w => `${w.playerAvatar} ${w.playerName}`).join(' & ')} closest!`
          }
        </div>
      )}
    </div>
  );
}

export default AnswerReveal;
