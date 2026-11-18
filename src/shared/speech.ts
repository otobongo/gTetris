import { getProgress } from './storage';

// Chrome loads voices asynchronously; ask early so the first say() gets a proper English voice.
try {
  window.speechSynthesis?.getVoices();
  window.speechSynthesis?.addEventListener?.('voiceschanged', () => window.speechSynthesis.getVoices());
} catch {
  /* no speech support */
}

/**
 * Read letters and words aloud with the browser's built-in voice (Web Speech API). Silently no-ops where unsupported.
 * A new line stops the one speaking, unless `queue` is set: then it plays after it (Letter Builder's practice
 * tap says the letter, then the drag note).
 */
export function say(text: string, rate = 0.85, opts: { queue?: boolean } = {}) {
  if (!getProgress().settings.voice) return;
  if (automatedRealVoice()) return;
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (!opts.queue) synth.cancel();
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

/**
 * True when automation drives the browser (Playwright sets navigator.webdriver) and the real voice is still in place.
 * macOS speaks Web Speech lines through its own speech service, which the browser's --mute-audio does not reach, so
 * test and check runs would talk through the machine's speakers. Journeys that swap speechSynthesis for a plain
 * recording object still get every line.
 */
function automatedRealVoice(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      navigator.webdriver === true &&
      typeof SpeechSynthesis !== 'undefined' &&
      window.speechSynthesis instanceof SpeechSynthesis
    );
  } catch {
    return false;
  }
}
