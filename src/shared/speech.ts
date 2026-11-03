import { getProgress } from './storage';

// Chrome loads voices asynchronously; ask early so the first say() gets a proper English voice.
try {
  window.speechSynthesis?.getVoices();
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => window.speechSynthesis.getVoices());
} catch {
  /* no speech support */
}

/** Read letters and words aloud with the browser's built-in voice (Web Speech API). Silently no-ops where unsupported. */
export function say(text: string, rate = 0.85) {
  if (!getProgress().settings.voice) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.pitch = 1.1;
    const voices = synth.getVoices();
    const en = voices.find((v) => /en[-_](US|GB)/i.test(v.lang)) ?? voices.find((v) => v.lang.startsWith('en'));
    if (en) u.voice = en;
    synth.speak(u);
  } catch {
    /* no speech support */
  }
}

/** Spoken name for a letter, so "A" is read as the letter, not the article. */
export function letterName(ch: string): string {
  const names: Record<string, string> = { A: 'ay', Z: 'zee' };
  return names[ch.toUpperCase()] ?? ch.toUpperCase();
}
