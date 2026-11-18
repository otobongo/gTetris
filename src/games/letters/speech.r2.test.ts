/**
 * Decision 5: on the practice level a tap says the letter, then the drag note after it. say() with
 * { queue: true } leaves the line already speaking alone, so the note plays after it; every other call
 * still stops what was speaking first. The browser's voice is a stand-in (the one true outside boundary).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setSetting } from '../../shared/storage';
import { say } from '../../shared/speech';

interface FakeVoice {
  log: string[];
}

const g = globalThis as unknown as { window?: unknown; SpeechSynthesisUtterance?: unknown };
let saved: { window: unknown; utterance: unknown };

function installVoice(): FakeVoice {
  const log: string[] = [];
  g.window = {
    speechSynthesis: {
      speak: (u: { text: string }) => void log.push(`speak:${u.text}`),
      cancel: () => void log.push('cancel'),
      getVoices: () => [],
      addEventListener: () => {},
    },
  };
  g.SpeechSynthesisUtterance = class {
    text: string;
    rate = 1;
    pitch = 1;
    voice: unknown = null;
    constructor(text: string) {
      this.text = text;
    }
  };
  return { log };
}

describe('say with { queue } (decision 5)', () => {
  beforeEach(() => {
    saved = { window: g.window, utterance: g.SpeechSynthesisUtterance };
    setSetting('voice', true);
  });
  afterEach(() => {
    g.window = saved.window;
    g.SpeechSynthesisUtterance = saved.utterance;
  });

  it('stops what is speaking first, as before, when not queued', () => {
    const v = installVoice();
    say('ay');
    expect(v.log).toEqual(['cancel', 'speak:ay']);
  });

  it('queues a line after the one speaking: no cancel', () => {
    const v = installVoice();
    say('ay');
    say('Hold the letter and drag it up.', undefined, { queue: true });
    expect(v.log).toEqual(['cancel', 'speak:ay', 'speak:Hold the letter and drag it up.']);
  });

  it('keeps the rate when queued', () => {
    const spoken: { text: string; rate: number }[] = [];
    installVoice();
    (g.window as { speechSynthesis: { speak: (u: { text: string; rate: number }) => void } }).speechSynthesis.speak = (u) => void spoken.push({ text: u.text, rate: u.rate });
    say('slow', 0.7, { queue: true });
    say('default', undefined, { queue: true });
    expect(spoken).toEqual([
      { text: 'slow', rate: 0.7 },
      { text: 'default', rate: 0.85 },
    ]);
  });

  it('says nothing, queued or not, when Voice is off', () => {
    const v = installVoice();
    setSetting('voice', false);
    say('ay');
    say('Hold the letter and drag it up.', undefined, { queue: true });
    expect(v.log).toEqual([]);
    setSetting('voice', true);
  });
});
