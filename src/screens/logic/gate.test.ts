import { describe, expect, it } from 'vitest';
import { GATE_ASKS, gateAsk, gateMatches } from './gate';

/** Spells 20 to 99 the way the check writes them ("forty-seven"), to check the asks against. */
function spell(n: number): string {
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'][Math.floor(n / 10)];
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n % 10];
  return ones ? `${tens}-${ones}` : tens;
}

describe('grown-up check: the numbers it asks for', () => {
  it('spells every number correctly, so the right answer is the number written in words', () => {
    for (const [value, words] of GATE_ASKS) expect(words, String(value)).toBe(spell(value));
  });

  it('asks only two-digit numbers that are not easy to guess (no tens, no repeated digits)', () => {
    for (const [value] of GATE_ASKS) {
      expect(value).toBeGreaterThanOrEqual(20);
      expect(value).toBeLessThanOrEqual(99);
      expect(value % 10, String(value)).not.toBe(0);
      expect(value % 11, String(value)).not.toBe(0);
    }
    expect(new Set(GATE_ASKS.map(([v]) => v)).size).toBe(GATE_ASKS.length);
  });

  it('always asks a different number after a wrong try, also when the list starts over', () => {
    for (let attempt = 0; attempt < GATE_ASKS.length * 3; attempt++) {
      expect(gateAsk(attempt + 1).value, `after try ${attempt}`).not.toBe(gateAsk(attempt).value);
    }
  });

  it('cycles through the list for any whole attempt count, including large and negative ones', () => {
    const n = GATE_ASKS.length;
    expect(gateAsk(n * 1000 + 2)).toEqual(gateAsk(2));
    expect(gateAsk(-1)).toEqual(gateAsk(n - 1));
    expect(gateAsk(-n)).toEqual(gateAsk(0));
  });

  it('uses a plain hyphen in the words, never an en or em dash', () => {
    for (const [, words] of GATE_ASKS) expect(words).not.toMatch(/[–—]/);
  });
});

describe('grown-up check: the typed answer', () => {
  it('accepts the asked number for every try', () => {
    for (let attempt = 0; attempt < GATE_ASKS.length; attempt++) expect(gateMatches(String(gateAsk(attempt).value), attempt)).toBe(true);
  });

  it('allows spaces, tabs or a line break around the digits', () => {
    expect(gateMatches('\t47\n', 0)).toBe(true);
    expect(gateMatches('   62', 1)).toBe(true);
  });

  it('accepts a leading zero, since the digits still equal the number', () => {
    expect(gateMatches('047', 0)).toBe(true);
  });

  it('refuses the number from the try before, once it has moved on', () => {
    expect(gateMatches('47', 1)).toBe(false);
  });

  it('refuses anything that is not plain digits, even when it adds up to the number', () => {
    for (const typed of ['4 7', '+47', '-47', '47a', 'a47', '47.0', '0x2F', '4.7e1', '٤٧', '４７', 'forty seven', '47,', '0047', ' ', '']) {
      expect(gateMatches(typed, 0), JSON.stringify(typed)).toBe(false);
    }
  });

  it('refuses a near miss', () => {
    expect(gateMatches('46', 0)).toBe(false);
    expect(gateMatches('48', 0)).toBe(false);
    expect(gateMatches('74', 0)).toBe(false);
  });
});
