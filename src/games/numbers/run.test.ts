/**
 * Number Line-up against src/games/run.ts (six-games brief 3.2, 3.3, 10.2): its set name, its stuck row and its star rule.
 * These checks waited for run.ts to hold the six games; now they pin the shared table to the brief.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, type PuzzleResult } from '../../shared/progress';
import { LEVEL_STAR_RULES, SLIP_GAMES, STUCK, levelStars, slipLevelStars, numbersSet } from '../run';
import { NUMBERS_GAME } from './meta';

const solved = (slips: readonly number[], usedHint = false): PuzzleResult[] =>
  slips.map((count, puzzle) => ({ puzzle, count, usedHint: usedHint && puzzle === 0, outOfTime: false }));

describe('the set name (3.2, 6)', () => {
  it('is numbers:1:<band> for every age band', () => {
    for (const band of AGE_BANDS) expect(numbersSet(band), band).toBe(`numbers:1:${band}`);
    expect(numbersSet('3-4')).toBe('numbers:1:3-4');
    expect(numbersSet('9-10')).toBe('numbers:1:9-10');
  });

  it('differs from band to band, so a band change is a different set (keepSolved decides what is kept)', () => {
    expect(new Set(AGE_BANDS.map((b) => numbersSet(b))).size).toBe(AGE_BANDS.length);
  });

  it('follows the version', () => {
    expect(numbersSet('5-6', 2)).toBe('numbers:2:5-6');
  });

  it('goes with a game that keeps solved puzzles, has hints and draws a new seed per run', () => {
    expect(NUMBERS_GAME.keepSolved).toBe(true);
    expect(NUMBERS_GAME.hints).toBe(true);
    expect(NUMBERS_GAME.seed).toBe('run');
  });
});

describe('the stuck row (3.3)', () => {
  it('holds the Number Line-up row for every age band', () => {
    expect(STUCK.numbers).toEqual({
      '3-4': { count: 3, seconds: 45 },
      '5-6': { count: 3, seconds: 60 },
      '7-8': { count: 4, seconds: 75 },
      '9-10': { count: 4, seconds: 90 },
    });
    expect(Object.keys(STUCK.numbers).sort()).toEqual([...AGE_BANDS].sort());
  });

  it('keeps Letter Builder’s counts and is longer in seconds at every band', () => {
    for (const band of AGE_BANDS) {
      expect(STUCK.numbers[band].count, band).toBe(STUCK.letters[band].count);
      expect(STUCK.numbers[band].seconds as number, band).toBeGreaterThan(STUCK.letters[band].seconds as number);
    }
  });
});

describe('the star rule on slips (3.2)', () => {
  it('holds { three: 1, two: 4 } in run.ts', () => {
    expect(LEVEL_STAR_RULES.numbers).toEqual({ three: 1, two: 4 });
  });

  it('lists numbers among the six kit games', () => {
    expect(SLIP_GAMES).toContain('numbers');
  });

  it('gives 3 stars for 0 or 1 slip over the 4 puzzles, 2 for 2 to 4, 1 for 5 or more', () => {
    const stars = (slips: number[]) => levelStars('numbers', solved(slips));
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
      expect(slipLevelStars('numbers')(solved(slips))).toBe(levelStars('numbers', solved(slips)));
    }
  });

  it('caps at 2 stars when a hint was used on a solved puzzle, even with no slip', () => {
    expect(levelStars('numbers', solved([0, 0, 0, 0], true))).toBe(2);
    expect(levelStars('numbers', solved([1, 0, 0, 0], true))).toBe(2);
  });

  it('keeps 2 or 1 star as the slips give them when a hint was used: the cap only costs the third star', () => {
    expect(levelStars('numbers', solved([2, 1, 0, 0], true))).toBe(2);
    expect(levelStars('numbers', solved([4, 4, 0, 0], true))).toBe(1);
  });

  it('does not cap when no solved puzzle used a hint (a hint on a swapped-away puzzle is never passed in)', () => {
    expect(levelStars('numbers', solved([0, 0, 0, 0], false))).toBe(3);
  });

  it('caps from the last solved puzzle too, not only the first', () => {
    const results = solved([0, 0, 0, 0]);
    results[3] = { ...results[3], usedHint: true };
    expect(levelStars('numbers', results)).toBe(2);
  });
});

