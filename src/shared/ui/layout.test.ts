import { describe, expect, it } from 'vitest';
import { SHORT_MAX_HEIGHT, computeLayout } from './layout';

describe('screen layout', () => {
  it('uses the phone layout below 744px wide', () => {
    expect(computeLayout(390, 844)).toMatchObject({ mode: 'phone', zoom: 1 });
    expect(computeLayout(743, 1000)).toMatchObject({ mode: 'phone', zoom: 1 });
  });

  it('scales the 596 x 853 tablet area like the boards (834 x 1194 is 1.4)', () => {
    expect(computeLayout(834, 1194)).toMatchObject({ mode: 'tablet', zoom: 1.4 });
    expect(computeLayout(1024, 1366).zoom).toBe(1.6);
  });

  it('never shrinks below 1 or grows past 2', () => {
    expect(computeLayout(1194, 700).zoom).toBe(1);
    expect(computeLayout(3000, 3000).zoom).toBe(2);
  });
});

describe('short screens: a phone held sideways (decision 4)', () => {
  it('a viewport under 500px tall is a short phone at zoom 1, whatever its width', () => {
    expect(SHORT_MAX_HEIGHT).toBe(500);
    expect(computeLayout(844, 390)).toEqual({ mode: 'phone', zoom: 1, short: true, width: 844, height: 390 });
    expect(computeLayout(667, 375)).toEqual({ mode: 'phone', zoom: 1, short: true, width: 667, height: 375 });
    expect(computeLayout(568, 320)).toEqual({ mode: 'phone', zoom: 1, short: true, width: 568, height: 320 });
    expect(computeLayout(1366, 450)).toMatchObject({ mode: 'phone', zoom: 1, short: true });
  });

  it('499 is short and 500 is not', () => {
    expect(computeLayout(844, 499)).toMatchObject({ mode: 'phone', zoom: 1, short: true });
    expect(computeLayout(844, 500)).toEqual({ mode: 'tablet', zoom: 1, short: false, width: 844, height: 500 });
    expect(computeLayout(390, 500).short).toBe(false);
  });

  it('every taller screen keeps exactly today’s result, with short false', () => {
    expect(computeLayout(1194, 834)).toEqual({ mode: 'tablet', zoom: 1, short: false, width: 1194, height: 834 });
    expect(computeLayout(1133, 744)).toEqual({ mode: 'tablet', zoom: 1, short: false, width: 1133, height: 744 });
    expect(computeLayout(834, 1194)).toEqual({ mode: 'tablet', zoom: 1.4, short: false, width: 834, height: 1194 });
    for (const [w, h] of [
      [390, 844],
      [375, 667],
      [390, 664],
      [375, 548],
    ]) {
      expect(computeLayout(w, h), `${w}x${h}`).toEqual({ mode: 'phone', zoom: 1, short: false, width: w, height: h });
    }
  });
});
