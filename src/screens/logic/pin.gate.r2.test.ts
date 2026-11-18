/**
 * Decision 14, the grown-up check side: with no PIN set the check is exactly today's sum (markup pinned
 * below); with a PIN set it asks for the PIN in one secure numeric field, shows the lock as a status line
 * with Check off, and offers "Forgot the PIN?". The interaction (wrong tries, the lock clock, the hold)
 * runs in a real browser in e2e/family-pin.spec.ts.
 */
import { webcrypto } from 'node:crypto';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { GrownUpCheck } from '../parts/Controls';
import { createFamilyPin, type PinStorage } from './familyPin';
import { PIN_HOLD_MS, holdProgress, pinClearedLine, pinLockLine } from './gate';

const subtle = webcrypto.subtle as unknown as SubtleCrypto;
// PBKDF2 at 150000 rounds runs before several renders; a loaded machine needs more than the default 5 s.
vi.setConfig({ testTimeout: 30_000 });
const R23 = 12 / 39 + 0.001;
const R19 = 8 / 39 + 0.001;
function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

function memoryStorage(): PinStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

function pinWith(now: () => number) {
  return createFamilyPin({ storage: memoryStorage(), now, subtle });
}

const decode = (html: string) => html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'");

/** Today's markup for the sum 23 + 19 (captured before decision 14 was built). */
const TODAY_WITH_CANCEL =
  '<section class="sc-panel sc-gate" aria-labelledby="_R_0_-h"><h2 id="_R_0_-h" class="sc-panel__title">Grown-up check</h2><p class="sc-body sc-gate__sum" aria-hidden="true">What is 23 + 19?</p><form class="sc-gate__form"><div class="sc-field sc-field--narrow"><label for="_R_0_-num" class="sc-label">Answer</label><div class="sc-field__box sc-field__box--well"><input id="_R_0_-num" class="sc-field__input" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength="3" aria-label="Answer for 23 plus 19" name="gate-answer" value=""/></div></div><p id="_R_0_-hint" role="status" class="sc-visually-hidden"></p><div class="sc-row"><button type="button" class="sc-btn sc-btn--flat sc-grow-1">Cancel</button><button type="submit" class="sc-btn sc-btn--go sc-grow-2">Check</button></div></form></section>';
const TODAY_NO_CANCEL =
  '<section class="sc-panel sc-gate" aria-labelledby="_R_0_-h"><h2 id="_R_0_-h" class="sc-panel__title">Grown-up check</h2><p class="sc-body sc-gate__sum" aria-hidden="true">What is 23 + 19?</p><form class="sc-gate__form"><div class="sc-field sc-field--narrow"><label for="_R_0_-num" class="sc-label">Answer</label><div class="sc-field__box sc-field__box--well"><input id="_R_0_-num" class="sc-field__input" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength="3" aria-label="Answer for 23 plus 19" name="gate-answer" value=""/></div></div><p id="_R_0_-hint" role="status" class="sc-visually-hidden"></p><div class="sc-row"><button type="submit" class="sc-btn sc-btn--go sc-grow-2">Check</button></div></form></section>';

describe('grown-up check with no PIN set: exactly today', () => {
  it('renders the same markup as before, with and without Cancel', () => {
    const pin = pinWith(() => 0);
    expect(renderToString(createElement(GrownUpCheck, { onPass: () => {}, onCancel: () => {}, random: seq(R23, R19), pin }))).toBe(TODAY_WITH_CANCEL);
    expect(renderToString(createElement(GrownUpCheck, { onPass: () => {}, random: seq(R23, R19), pin }))).toBe(TODAY_NO_CANCEL);
  });

  it('renders the same markup with the app-wide PIN store, which has nothing saved here', () => {
    expect(renderToString(createElement(GrownUpCheck, { onPass: () => {}, onCancel: () => {}, random: seq(R23, R19) }))).toBe(TODAY_WITH_CANCEL);
  });

  it('after Forgot the PIN cleared it, the check is the sum again', async () => {
    const pin = pinWith(() => 0);
    await pin.setPin('2580');
    pin.clearPin('forgot');
    expect(renderToString(createElement(GrownUpCheck, { onPass: () => {}, onCancel: () => {}, random: seq(R23, R19), pin }))).toBe(TODAY_WITH_CANCEL);
  });
});

describe('grown-up check with a PIN set', () => {
  async function render(now = () => 0, prep?: (pin: ReturnType<typeof pinWith>) => Promise<void>) {
    const pin = pinWith(now);
    await pin.setPin('2580');
    if (prep) await prep(pin);
    return decode(renderToString(createElement(GrownUpCheck, { onPass: () => {}, onCancel: () => {}, random: seq(R23, R19), pin })));
  }

  it('asks for the PIN, not a sum, under the same heading', async () => {
    const html = await render();
    expect(html).toContain('>Grown-up check</h2>');
    expect(html).toContain('Enter the family PIN.');
    expect(html).not.toContain('What is');
    expect(html).not.toContain('sc-gate__sum');
  });

  it('has one labelled secure numeric field of four digits, with no saved value and no autofill', async () => {
    const html = await render();
    const inputs = html.match(/<input[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(1);
    const input = inputs[0] ?? '';
    for (const attr of ['type="password"', 'inputMode="numeric"', 'autoComplete="off"', 'maxLength="4"', 'pattern="[0-9]{4}"']) expect(input, attr).toContain(attr);
    expect(input).not.toMatch(/value="[^"]+"/);
    const id = /id="([^"]+)"/.exec(input)![1];
    expect(html).toContain(`<label for="${id}" class="sc-label">Family PIN</label>`);
  });

  it('keeps Check and Cancel, adds a Forgot the PIN? button, and shows no error before the first try', async () => {
    const html = await render();
    expect(html).toContain('<button type="submit" class="sc-btn sc-btn--go sc-grow-2">Check</button>');
    expect(html).toContain('>Cancel</button>');
    expect(html).toMatch(/<button type="button" class="sc-textlink[^"]*">Forgot the PIN\?<\/button>/);
    expect(html).not.toContain('role="alert"');
    // The hint and lock line share one live region that is on the page, empty, from the start.
    expect(html).toMatch(/<p[^>]*role="status"[^>]*><\/p>/);
  });

  it('opened during a lock, says how long is left in a status line and turns Check off', async () => {
    let t = 1_000_000;
    const html = await render(
      () => t,
      async (pin) => {
        for (let i = 0; i < 3; i++) await pin.checkPin('1111');
        t += 12_000;
      },
    );
    expect(html).toMatch(/<p[^>]*role="status"[^>]*>Too many tries. Try again in 18 seconds.<\/p>/);
    expect(html).toMatch(/<button type="submit" class="sc-btn sc-btn--go sc-grow-2" disabled="">Check<\/button>/);
    expect(html).not.toContain('role="alert"');
  });
});

describe('grown-up check copy and timing helpers', () => {
  it('writes the lock line in whole seconds, rounding up, with one second singular', () => {
    expect(pinLockLine(30_000)).toBe('Too many tries. Try again in 30 seconds.');
    expect(pinLockLine(29_001)).toBe('Too many tries. Try again in 30 seconds.');
    expect(pinLockLine(1_000)).toBe('Too many tries. Try again in 1 second.');
    expect(pinLockLine(1)).toBe('Too many tries. Try again in 1 second.');
    expect(pinLockLine(300_000)).toBe('Too many tries. Try again in 300 seconds.');
  });

  it('dates the cleared line as day and month', () => {
    expect(pinClearedLine(Date.UTC(2026, 10, 16, 12))).toBe('The PIN was cleared with Forgot the PIN on 16 November.');
    expect(pinClearedLine(Date.UTC(2026, 0, 3, 12))).toBe('The PIN was cleared with Forgot the PIN on 3 January.');
  });

  it('needs a 10 second hold, counting the seconds left down from 10', () => {
    expect(PIN_HOLD_MS).toBe(10_000);
    expect(holdProgress(0, false)).toEqual({ left: 10, fraction: 0, done: false });
    expect(holdProgress(500, false)).toEqual({ left: 10, fraction: 0.05, done: false });
    expect(holdProgress(1000, false)).toEqual({ left: 9, fraction: 0.1, done: false });
    expect(holdProgress(9000, false)).toEqual({ left: 1, fraction: 0.9, done: false });
    expect(holdProgress(9999, false).done).toBe(false);
    expect(holdProgress(10_000, false)).toEqual({ left: 0, fraction: 1, done: true });
    expect(holdProgress(25_000, false)).toEqual({ left: 0, fraction: 1, done: true });
    expect(holdProgress(-5, false)).toEqual({ left: 10, fraction: 0, done: false });
  });

  it('under Reduce Motion the bar moves only once a second', () => {
    expect(holdProgress(500, true).fraction).toBe(0);
    expect(holdProgress(999, true).fraction).toBe(0);
    expect(holdProgress(1000, true).fraction).toBe(0.1);
    expect(holdProgress(1999, true).fraction).toBe(0.1);
    expect(holdProgress(9500, true)).toEqual({ left: 1, fraction: 0.9, done: false });
  });

  it('uses no dashes in any of the new lines', () => {
    for (const line of [pinLockLine(30_000), pinClearedLine(0)]) expect(line).not.toMatch(/[\u2013\u2014]/);
  });
});
