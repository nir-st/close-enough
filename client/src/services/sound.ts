// Synthesized sound effects via the Web Audio API — no asset files.
// Used on the host / Cast-receiver screen only (the shared TV speaker);
// players' phones stay silent to avoid a cacophony.

let ctx: AudioContext | null = null;
let muted = (typeof localStorage !== 'undefined' && localStorage.getItem('ce_muted') === '1');
let drum: { src: AudioBufferSourceNode; gain: GainNode; lfo: OscillatorNode } | null = null;

function getCtx(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Resume/create the audio context from a user gesture so later sounds can play.
export function unlockAudio(): void {
  if (muted) return;
  getCtx();
}

export function isMuted(): boolean { return muted; }

export function setMuted(m: boolean): void {
  muted = m;
  try { localStorage.setItem('ce_muted', m ? '1' : '0'); } catch { /* ignore */ }
  if (m) stopDrumroll();
}

// Single decaying tone, optionally sweeping to freqEnd.
function tone(
  freq: number, startAt: number, dur: number,
  type: OscillatorType = 'sine', vol = 0.2, freqEnd?: number
): void {
  const c = getCtx(); if (!c) return;
  const t0 = c.currentTime + startAt;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

// ── Core effects ─────────────────────────────────────────────────────────────

// Question appears — quick upward whoosh.
export function playQuestionAppear(): void {
  tone(300, 0, 0.28, 'triangle', 0.16, 720);
}

// Final-seconds timer tick.
export function playTick(): void {
  tone(900, 0, 0.06, 'square', 0.12);
}

// Time's up — buzzer.
export function playTimeUp(): void {
  tone(220, 0, 0.25, 'sawtooth', 0.2);
  tone(175, 0.22, 0.3, 'sawtooth', 0.2);
}

// Drumroll under the reveal animation — looping filtered noise with a tremolo
// that swells in intensity. Call stopDrumroll() when the answer lands.
export function startDrumroll(): void {
  const c = getCtx(); if (!c) return;
  stopDrumroll();

  const buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;

  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1800;
  band.Q.value = 0.7;

  const gain = c.createGain();
  const t = c.currentTime;
  gain.gain.setValueAtTime(0.05, t);
  gain.gain.linearRampToValueAtTime(0.16, t + 1.4); // swell

  // tremolo: square LFO modulating the gain for a buzzing roll
  const lfo = c.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 24;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.1;
  lfo.connect(lfoGain).connect(gain.gain);

  src.connect(band).connect(gain).connect(c.destination);
  src.start();
  lfo.start();
  drum = { src, gain, lfo };
}

export function stopDrumroll(): void {
  if (!drum || !ctx) return;
  const { src, gain, lfo } = drum;
  const t = ctx.currentTime;
  try {
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    src.stop(t + 0.2);
    lfo.stop(t + 0.2);
  } catch { /* already stopped */ }
  drum = null;
}

// Correct answer revealed — clean bell "ding".
export function playAnswerReveal(): void {
  stopDrumroll();
  tone(880, 0, 0.45, 'sine', 0.22);
  tone(1320, 0, 0.45, 'sine', 0.1);
}

// Winner highlighted — celebratory ascending arpeggio.
export function playWinner(): void {
  tone(659.25, 0, 0.2, 'triangle', 0.18);
  tone(880, 0.12, 0.2, 'triangle', 0.18);
  tone(1318.5, 0.24, 0.6, 'triangle', 0.2);
}

// Game over — short fanfare resolving to a chord.
export function playGameOver(): void {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone(f, i * 0.15, 0.5, 'triangle', 0.2)
  );
  tone(1046.5, 0.6, 0.9, 'sine', 0.12);
  tone(659.25, 0.6, 0.9, 'sine', 0.1);
}
