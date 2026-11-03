import { describe, expect, it } from 'vitest';
import { computeLayout } from './layout';

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
