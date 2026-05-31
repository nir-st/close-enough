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
      const padding = Math.max(correctAnswer * 0.5, 10);
      steps.push({ type: 'zoom', zoomRange: { min: correctAnswer - padding, max: correctAnswer + padding } });
      sortedResults.forEach((_, i) => steps.push({ type: 'guess', guessIndex: i }));
      steps.push({ type: 'answer' });
      steps.push({ type: 'highlight' });
    } else {
      // Cluster guesses and reveal cluster-by-cluster
      const clusters: number[][] = [];
      let cur: number[] = [sortedResults[0].answer];
      for (let i = 1; i < sortedResults.length; i++) {
        const gap = (sortedResults[i].answer - sortedResults[i - 1].answer) / globalRange;
        if (gap > 0.3) { clusters.push([...cur]); cur = [sortedResults[i].answer]; }
        else cur.push(sortedResults[i].answer);
      }
      clusters.push(cur);

      let revealed = 0;
      for (let ci = 0; ci < clusters.length; ci++) {
        const cluster = clusters[ci];
        const cMin = Math.min(...cluster);
        const cMax = Math.max(...cluster);
        const pad = Math.max((cMax - cMin) * 0.3, globalRange * 0.06);

        steps.push({ type: 'zoom', zoomRange: { min: cMin - pad, max: cMax + pad } });

        for (let i = 0; i < cluster.length; i++) {
          // Find the correct index in sortedResults for this cluster value
          const val = cluster[i];
          let found = -1;
          let seen = 0;
          for (let j = 0; j < sortedResults.length; j++) {
            if (sortedResults[j].answer === val) {
              if (seen === cluster.slice(0, i).filter(v => v === val).length) { found = j; break; }
              seen++;
            }
          }
          if (found === -1) found = revealed; // fallback
          steps.push({ type: 'guess', guessIndex: found });
          revealed++;
        }

        // Between clusters: zoom out to show the gap
        if (ci < clusters.length - 1) {
          const nextMin = Math.min(...clusters[ci + 1]);
          steps.push({ type: 'zoom', zoomRange: { min: cMin - pad, max: nextMin + pad } });
        }
      }

      // Final zoom: show everything including the correct answer
      const finalPad = globalRange * 0.12;
      steps.push({ type: 'zoom', zoomRange: { min: globalMin - finalPad, max: globalMax + finalPad } });
      steps.push({ type: 'answer' });
      steps.push({ type: 'highlight' });
    }

    setAnimationSteps(steps);
    setCurrentStep(-1); // reset each time results change
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
