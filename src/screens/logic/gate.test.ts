/**
 * Decision D1: the grown-up check asks a new two-digit addition each time it opens ("What is 23 + 19?"),
 * each number 11 to 49, and a new sum after each wrong answer. These tests replace the ones for the
 * old fixed list of numbers in words, which D1 removed.
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rng } from '../../shared/rng';
import { GrownUpCheck } from '../parts/Controls';
import { GATE_MAX, GATE_MIN, gateAnswer, gateMatches, gateQuestion, gateSpoken, makeGateSum, nextGateSum, type GateSum } from './gate';

/** A random function that returns the given values in turn, then starts over. */
function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

/** Random values that give the addends 23 and 19. */
const R23 = 12 / 39 + 0.001;
const R19 = 8 / 39 + 0.001;

afterEach(() => vi.restoreAllMocks());

describe('grown-up check: the sum it asks', () => {
  it('turns the random numbers into two addends from 11 to 49', () => {
    expect(makeGateSum(seq(R23, R19))).toEqual({ a: 23, b: 19 });
    expect(makeGateSum(seq(0))).toEqual({ a: 11, b: 11 });
    expect(makeGateSum(seq(0.999999))).toEqual({ a: 49, b: 49 });
  });

  it('keeps every addend in 11 to 49 and every answer in 22 to 98 over many draws, reaching both ends', () => {
    const random = rng(2026);
    const seen = new Set<number>();
    let low = 99;
    let high = 0;
    for (let i = 0; i < 5000; i++) {
      const s = makeGateSum(random);
      for (const n of [s.a, s.b]) {
        expect(Number.isInteger(n)).toBe(true);
        expect(n).toBeGreaterThanOrEqual(GATE_MIN);
        expect(n).toBeLessThanOrEqual(GATE_MAX);
        seen.add(n);
      }
      low = Math.min(low, gateAnswer(s));
      high = Math.max(high, gateAnswer(s));
    }
    expect(seen.size).toBe(GATE_MAX - GATE_MIN + 1);
    expect(low).toBeGreaterThanOrEqual(22);
    expect(high).toBeLessThanOrEqual(98);
  });

  it('stays in range when the random function misbehaves (1, below 0, NaN, Infinity)', () => {
    for (const r of [1, 1.5, -0.2, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const s = makeGateSum(seq(r));
      expect(s.a, String(r)).toBeGreaterThanOrEqual(GATE_MIN);
      expect(s.a, String(r)).toBeLessThanOrEqual(GATE_MAX);
      expect(s.b, String(r)).toBeGreaterThanOrEqual(GATE_MIN);
      expect(s.b, String(r)).toBeLessThanOrEqual(GATE_MAX);
    }
  });

  it('uses Math.random when no random function is given', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValueOnce(R23).mockReturnValueOnce(R19);
    expect(makeGateSum()).toEqual({ a: 23, b: 19 });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('writes the question with digits and a plus sign, and no dashes', () => {
    expect(gateQuestion({ a: 23, b: 19 })).toBe('What is 23 + 19?');
    expect(gateQuestion({ a: 11, b: 49 })).not.toMatch(/[–—]/);
  });

  it('gives screen readers the sum in words, with "plus" instead of the sign', () => {
    expect(gateSpoken({ a: 23, b: 19 })).toBe('Answer for 23 plus 19');
    expect(gateSpoken({ a: 23, b: 19 })).not.toContain('+');
  });
});

describe('grown-up check: a new sum after a wrong answer', () => {
  it('draws a fresh sum from the random function', () => {
    expect(nextGateSum({ a: 30, b: 30 }, seq(R23, R19))).toEqual({ a: 23, b: 19 });
  });

  it('never repeats the last answer, so the number just typed cannot pass', () => {
    const random = rng(7);
    let sum: GateSum = makeGateSum(random);
    for (let i = 0; i < 500; i++) {
      const next = nextGateSum(sum, random);
      expect(gateAnswer(next), `after ${sum.a} + ${sum.b}`).not.toBe(gateAnswer(sum));
      sum = next;
    }
  });

  it('skips a draw with the same answer and takes the next one', () => {
    // 23 + 19 = 42; 19 + 23 is also 42, so it moves on to 11 + 11
    expect(nextGateSum({ a: 23, b: 19 }, seq(R19, R23, 0, 0))).toEqual({ a: 11, b: 11 });
  });

  it('still changes the answer, inside 11 to 49, when the random function never changes', () => {
    const stuck = nextGateSum({ a: 11, b: 11 }, seq(0));
    expect(gateAnswer(stuck)).not.toBe(22);
    expect(stuck.b).toBeLessThanOrEqual(GATE_MAX);
    const top = nextGateSum({ a: 49, b: 49 }, seq(0.999999));
    expect(gateAnswer(top)).not.toBe(98);
    expect(top.b).toBeGreaterThanOrEqual(GATE_MIN);
    expect(top.b).toBeLessThanOrEqual(GATE_MAX);
  });
});

describe('grown-up check: the typed answer', () => {
  const sum = { a: 23, b: 19 };

  it('accepts the answer to the sum', () => {
    expect(gateMatches('42', sum)).toBe(true);
    expect(gateMatches('22', { a: 11, b: 11 })).toBe(true);
    expect(gateMatches('98', { a: 49, b: 49 })).toBe(true);
  });

  it('allows spaces, tabs or a line break around the digits, and a leading zero', () => {
    expect(gateMatches('\t42\n', sum)).toBe(true);
    expect(gateMatches('   42', sum)).toBe(true);
    expect(gateMatches('042', sum)).toBe(true);
  });

  it('refuses a near miss and the numbers in the question', () => {
    for (const typed of ['41', '43', '23', '19', '2319', '4']) expect(gateMatches(typed, sum), typed).toBe(false);
  });

  it('refuses anything that is not plain digits, even when it adds up to the answer', () => {
    for (const typed of ['4 2', '+42', '-42', '42a', 'a42', '42.0', '0x2A', '4.2e1', '23+19', '٤٢', '４２', 'forty-two', '42,', '0042', ' ', '']) {
      expect(gateMatches(typed, sum), JSON.stringify(typed)).toBe(false);
    }
  });
});

describe('grown-up check: what it shows', () => {
  const render = (random: () => number) => renderToString(createElement(GrownUpCheck, { onPass: () => {}, onCancel: () => {}, random }));

  it('asks the sum from the random function, with a numeric answer field labelled with the sum', () => {
    const html = render(seq(R23, R19));
    expect(html).toContain('What is 23 + 19?');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('aria-label="Answer for 23 plus 19"');
    expect(html).not.toMatch(/forty|sixty|thirty|eighty|twenty|seventy/);
  });

  it('asks a new sum each time it opens', () => {
    const random = rng(99);
    const first = render(random).match(/What is (\d+) \+ (\d+)\?/)!;
    const second = render(random).match(/What is (\d+) \+ (\d+)\?/)!;
    expect(first.slice(1)).not.toEqual(second.slice(1));
  });

  it('shows no error before the first answer', () => {
    expect(render(seq(R23, R19))).not.toContain('role="alert"');
  });
});
