import { getProgress } from './storage';

/** All sounds are synthesized with WebAudio, so the app ships no audio files. */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!getProgress().settings.sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur = 0.12, type: OscillatorType = 'sine', gain = 0.15, delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  tap: () => tone(520, 0.06, 'triangle', 0.1),
  move: () => tone(300, 0.05, 'triangle', 0.08),
  bump: () => tone(140, 0.09, 'square', 0.05),
  exit: () => { tone(660, 0.1, 'triangle'); tone(990, 0.14, 'triangle', 0.12, 0.07); },
  good: () => { tone(740, 0.1, 'sine'); tone(1110, 0.16, 'sine', 0.12, 0.08); },
  wrong: () => { tone(330, 0.12, 'sine', 0.1); tone(262, 0.16, 'sine', 0.1, 0.09); },
  line: (n = 1) => { for (let i = 0; i < n + 1; i++) tone(520 + i * 160, 0.12, 'triangle', 0.12, i * 0.06); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.11)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'sine', 0.12, i * 0.14)),
};
