import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * say() and automation: a browser driven by Playwright (navigator.webdriver) must not talk through the machine's
 * speakers with the real voice, but journeys that replace speechSynthesis with a plain recording object still hear
 * every line. The node test environment has no Web Speech, so these tests stand in the few globals say() reads.
 */

let voiceOn = true;
vi.mock('./storage', () => ({ getProgress: () => ({ settings: { voice: voiceOn } }) }));

class FakeSpeechSynthesis {
  speak = vi.fn();
  cancel = vi.fn();
  getVoices = () => [];
  addEventListener = () => {};
}
class FakeUtterance {
  rate = 1;
  pitch = 1;
  voice: unknown = null;
  constructor(public text: string) {}
}

async function load(opts: { webdriver: boolean; synth: { speak: (u: { text: string }) => void } }) {
  vi.resetModules();
  vi.stubGlobal('SpeechSynthesis', FakeSpeechSynthesis);
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  vi.stubGlobal('navigator', { webdriver: opts.webdriver });
  vi.stubGlobal('window', { speechSynthesis: opts.synth });
  return import('./speech');
}

afterEach(() => {
  vi.unstubAllGlobals();
  voiceOn = true;
});

describe('say() under automation', () => {
  it('stays silent when automation drives the browser and the real voice is in place', async () => {
    const synth = new FakeSpeechSynthesis();
    const { say } = await load({ webdriver: true, synth });
    say('Choo choo!');
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('still speaks to a recording object that a journey put in place of the voice', async () => {
    const spoken: string[] = [];
    const synth = { speak: (u: { text: string }) => spoken.push(u.text), cancel: () => {}, getVoices: () => [], addEventListener: () => {} };
    const { say } = await load({ webdriver: true, synth });
    say('capital D');
    expect(spoken).toEqual(['capital D']);
  });

  it('speaks with the real voice when no automation drives the browser', async () => {
    const synth = new FakeSpeechSynthesis();
    const { say } = await load({ webdriver: false, synth });
    say('Blue circle');
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect((synth.speak.mock.calls[0][0] as FakeUtterance).text).toBe('Blue circle');
  });

  it('says nothing when Voice is off, automation or not', async () => {
    voiceOn = false;
    const synth = new FakeSpeechSynthesis();
    const { say } = await load({ webdriver: false, synth });
    say('Blue circle');
    expect(synth.speak).not.toHaveBeenCalled();
  });
});
