/**
 * Shape Sorter against src/games/run.ts (six-games brief 3.2, 3.3, 10.2): its set name, its stuck row and its star rule.
 * These checks waited for run.ts to hold the six games; now they pin the shared table to the brief.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, type PuzzleResult } from '../../shared/progress';
import { LEVEL_STAR_RULES, SLIP_GAMES, STUCK, levelStars, slipLevelStars, sorterSet } from '../run';
import { SORTER_SET_VERSION, SORTER_STAR_RULE, SORTER_STUCK } from './puzzles';

const solved = (slips: readonly number[], usedHint = false): PuzzleResult[] =>
  slips.map((count, puzzle) => ({ puzzle, count, usedHint: usedHint && puzzle === 0, outOfTime: false }));

describe('the set name (3.2, 6)', () => {
  it('is sorter:1, the version the game stores under', () => {
    expect(sorterSet()).toBe('sorter:1');
    expect(sorterSet(SORTER_SET_VERSION)).toBe(sorterSet());
  });

  it('follows the version', () => {
    expect(sorterSet(2)).toBe('sorter:2');
  });
});

describe('the stuck row (3.3)', () => {
  it('holds the Shape Sorter row for every age band', () => {
    expect(STUCK.sorter).toEqual({
      '3-4': { count: 3, seconds: 30 },
      '5-6': { count: 3, seconds: 40 },
      '7-8': { count: 4, seconds: 50 },
      '9-10': { count: 4, seconds: 60 },
    });
    expect(Object.keys(STUCK.sorter).sort()).toEqual([...AGE_BANDS].sort());
  });

  it('equals SORTER_STUCK of the game', () => {
    expect(STUCK.sorter).toEqual(SORTER_STUCK);
  });

  it('copies Letter Builder’s row, as 3.3 says', () => {
    expect(STUCK.sorter).toEqual(STUCK.letters);
  });
});

describe('the star rule on slips (3.2)', () => {
  it('holds { three: 1, two: 4 } in run.ts', () => {
    expect(LEVEL_STAR_RULES.sorter).toEqual({ three: 1, two: 4 });
  });

  it('lists sorter among the six kit games', () => {
    expect(SLIP_GAMES).toContain('sorter');
  });

  it('gives 3 stars for 0 or 1 slip over the 4 puzzles, 2 for 2 to 4, 1 for 5 or more', () => {
    const stars = (slips: number[]) => levelStars('sorter', solved(slips));
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
      expect(slipLevelStars('sorter')(solved(slips))).toBe(levelStars('sorter', solved(slips)));
    }
  });

  it('equals SORTER_STAR_RULE of the game', () => {
    expect(LEVEL_STAR_RULES.sorter).toEqual(SORTER_STAR_RULE);
  });

  it('is not capped: Shape Sorter has no hint', () => {
    expect(levelStars('sorter', solved([0, 0, 0, 0]))).toBe(3);
  });
});

