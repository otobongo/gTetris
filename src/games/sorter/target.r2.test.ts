/**
 * Shape Sorter, sorter-numbers-7: at ages 3 to 6, after a second slip with the same piece, that piece's own
 * hole rings while the piece is picked or dragged. Slips are counted per piece, on any hole.
 */
import { describe, expect, it } from 'vitest';
import type { AgeBand } from '../../shared/progress';
import { TARGET_AFTER_SLIPS, countSlip, targetHole } from './puzzles';

const YOUNG: AgeBand[] = ['3-4', '5-6'];
const OLDER: AgeBand[] = ['7-8', '9-10'];

describe('slips per piece (sorter-numbers-7)', () => {
  it('counts by piece, on any hole, and leaves the counts it was given alone', () => {
    const none = {};
    const one = countSlip(none, 'a');
    const two = countSlip(one, 'a');
    expect(none).toEqual({});
    expect(one).toEqual({ a: 1 });
    expect(two).toEqual({ a: 2 });
    expect(countSlip(two, 'b')).toEqual({ a: 2, b: 1 });
  });

  it('rings after the second slip, not the first', () => {
    expect(TARGET_AFTER_SLIPS).toBe(2);
  });
});

describe('the ringed hole (sorter-numbers-7)', () => {
  for (const band of YOUNG) {
    it(`ages ${band}: the active piece's own hole after two slips with it, else none`, () => {
      expect(targetHole({}, 'a', band)).toBeNull();
      expect(targetHole({ a: 1 }, 'a', band)).toBeNull();
      expect(targetHole({ a: 2 }, 'a', band)).toBe('a');
      expect(targetHole({ a: 5 }, 'a', band)).toBe('a');
      // Another piece's slips never ring this one's hole.
      expect(targetHole({ b: 2 }, 'a', band)).toBeNull();
      expect(targetHole({ a: 1, b: 1 }, 'a', band)).toBeNull();
      // Nothing picked or dragged: nothing rings.
      expect(targetHole({ a: 2 }, null, band)).toBeNull();
    });
  }

  for (const band of OLDER) {
    it(`ages ${band}: never`, () => {
      expect(targetHole({ a: 2 }, 'a', band)).toBeNull();
      expect(targetHole({ a: 9 }, 'a', band)).toBeNull();
    });
  }
});
