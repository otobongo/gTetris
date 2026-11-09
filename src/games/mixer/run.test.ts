/**
 * Color Mixer against src/games/run.ts (six-games brief 3.2, 3.3, 10.2): its set name, its stuck row and its star rule.
 * These checks waited for run.ts to hold the six games; now they pin the shared table to the brief.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, type PuzzleResult } from '../../shared/progress';
import { LEVEL_STAR_RULES, SLIP_GAMES, STUCK, levelStars, slipLevelStars, mixerSet } from '../run';

const solved = (slips: readonly number[], usedHint = false): PuzzleResult[] =>
  slips.map((count, puzzle) => ({ puzzle, count, usedHint: usedHint && puzzle === 0, outOfTime: false }));

describe('the set name (3.2, 6)', () => {
  it('is mixer:1', () => {
    expect(mixerSet()).toBe('mixer:1');
    expect(mixerSet(1)).toBe('mixer:1');
  });

  it('follows the version, so a raised version restarts stored runs', () => {
    expect(mixerSet(2)).toBe('mixer:2');
    expect(mixerSet(2)).not.toBe(mixerSet());
  });
});

describe('the stuck row (3.3)', () => {
  it('holds the Color Mixer row for every age band', () => {
    expect(STUCK.mixer).toEqual({
      '3-4': { count: 3, seconds: 30 },
      '5-6': { count: 3, seconds: 40 },
      '7-8': { count: 4, seconds: 50 },
      '9-10': { count: 4, seconds: 60 },
    });
    expect(Object.keys(STUCK.mixer).sort()).toEqual([...AGE_BANDS].sort());
  });

  it('copies Letter Builder’s row, as 3.3 says', () => {
    expect(STUCK.mixer).toEqual(STUCK.letters);
  });
});

describe('the star rule on slips (3.2)', () => {
  it('holds { three: 1, two: 4 } in run.ts', () => {
    expect(LEVEL_STAR_RULES.mixer).toEqual({ three: 1, two: 4 });
  });

  it('lists mixer among the six kit games', () => {
    expect(SLIP_GAMES).toContain('mixer');
  });

  it('gives 3 stars for 0 or 1 slip over the 4 puzzles, 2 for 2 to 4, 1 for 5 or more', () => {
    const stars = (slips: number[]) => levelStars('mixer', solved(slips));
    expect(stars([0, 0, 0, 0])).toBe(3);
    expect(stars([1, 0, 0, 0])).toBe(3);
    expect(stars([0, 0, 1, 0])).toBe(3);
    expect(stars([1, 1, 0, 0])).toBe(2);
    expect(stars([2, 2, 0, 0])).toBe(2);
    expect(stars([4, 0, 0, 0])).toBe(2);
    expect(stars([1, 1, 1, 1])).toBe(2);
    expect(stars([5, 0, 0, 0])).toBe(1);
    expect(stars([3, 2, 0, 0])).toBe(1);
    expect(stars([9, 9, 9, 9])).toBe(1);
  });

  it('reaches the same answer through slipLevelStars and levelStars', () => {
    for (const slips of [[0, 0, 0, 0], [1, 1, 0, 0], [3, 3, 0, 0], [7, 0, 0, 0]]) {
      expect(slipLevelStars('mixer')(solved(slips))).toBe(levelStars('mixer', solved(slips)));
    }
  });

  it('is not capped: Color Mixer has no hint', () => {
    expect(levelStars('mixer', solved([0, 0, 0, 0]))).toBe(3);
  });
});

