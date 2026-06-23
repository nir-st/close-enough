import { useEffect, useState } from 'react';
import { ScoreResult } from '../types/game';
import * as sound from '../services/sound';
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

      // --- Step 2: initial zoom around first cluster ---
      const c0Min = Math.min(...clusters[0]);
      const c0Max = Math.max(...clusters[0]);
      const initPad = Math.max((c0Max - c0Min) * 0.4, globalRange * 0.12);
      let zMin = c0Min - initPad;
      let zMax = c0Max + initPad;

      // Ensure the span is wide enough for 5 tick marks to show distinct values
      const minSpan = Math.max(globalRange * 0.15, 5);
      if (zMax - zMin < minSpan) {
        const center = (zMin + zMax) / 2;
        zMin = center - minSpan / 2;
        zMax = center + minSpan / 2;
      }

      steps.push({ type: 'zoom', zoomRange: { min: zMin, max: zMax } });

      // Reveal first cluster
      for (const idx of clusterIndices(clusters[0])) {
        steps.push({ type: 'guess', guessIndex: idx });
      }

      // --- Step 3: for each subsequent cluster, EXPAND outward (never re-center) ---
      for (let ci = 1; ci < clusters.length; ci++) {
        const cMin = Math.min(...clusters[ci]);
        const cMax = Math.max(...clusters[ci]);
        const expandPad = Math.max((cMax - cMin) * 0.3, globalRange * 0.13);

        const prevZMin = zMin;
        const prevZMax = zMax;
        zMin = Math.min(zMin, cMin - expandPad);
        zMax = Math.max(zMax, cMax + expandPad);

        // Only emit a zoom step if the visible range actually changed meaningfully
        // (skip if the next cluster was already visible in the current zoom)
        const change = (zMax - prevZMax) + (prevZMin - zMin);
        if (change > (zMax - zMin) * 0.04) {
          steps.push({ type: 'zoom', zoomRange: { min: zMin, max: zMax } });
        }

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

  // Sound: roll into the reveal, ding when the answer lands, sting on the winner.
  useEffect(() => {
    if (currentStep < 0 || animationSteps.length === 0) return;
    const step = animationSteps[currentStep];
    const next = animationSteps[currentStep + 1];
    if (next?.type === 'answer') sound.startDrumroll();
    if (step?.type === 'answer') sound.playAnswerReveal(); // also stops the drumroll
    if (step?.type === 'highlight') sound.playWinner();
  }, [currentStep, animationSteps]);

  // Safety: stop any drumroll if we unmount mid-roll.
  useEffect(() => () => sound.stopDrumroll(), []);

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

  // Format a tick value compactly with round K/M suffixes (e.g. 1.5M, 21K, 500).
  const formatTick = (v: number): string => {
    const trim = (x: number) => Number(x.toFixed(1)).toString(); // 1.0 -> "1", 1.5 -> "1.5"
    if (Math.abs(v) >= 1_000_000) return `${trim(v / 1_000_000)}M`;
    if (Math.abs(v) >= 1_000)     return `${trim(v / 1_000)}K`;
    return formatNum(v);
  };

  // Pick "nice" round tick values (multiples of 1/2/5 × 10^k) inside the visible
  // range, so the axis reads 0, 5, 10, 15 … instead of interpolated 3.2, 6.7, 10.1 …
  // Each tick is then positioned at its real coordinate via getPos().
  const niceTickValues = (min: number, max: number, target: number): number[] => {
    const range = max - min;
    if (!isFinite(range) || range <= 0) return [min];
    const rawStep = range / (target - 1);
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag; // 1..10
    const niceStep = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    const start = Math.ceil(min / niceStep) * niceStep;
    const out: number[] = [];
    for (let v = start; v <= max + niceStep * 1e-9; v += niceStep) {
      const snapped = Math.round(v / niceStep) * niceStep; // snap off floating-point drift
      out.push(snapped === 0 ? 0 : snapped); // normalize -0 to 0
    }
    return out;
  };

  const numTicks = 5;
  const tickValues = niceTickValues(zoom.min, zoom.max, numTicks);

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
            {tickValues.map((v, i) => (
              <div key={i} className="tick" style={{ left: `${getPos(v)}%` }}>
                <div className="tick-mark" />
                <div className="tick-label">{formatTick(v)}</div>
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
