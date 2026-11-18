/* Decision 23 (sorter-numbers-6): at ages 3 to 4, Level 1's first puzzle of a visit shows the first swap
   as a still picture (a double arrow and two rings) until the child picks, drags, asks for a hint or swaps. */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS } from '../../shared/progress';
import { hintStep, swapAt, swapCueSpots } from './order';
import { makePuzzles, showsSwapCue, type SwapCueState } from './puzzles';

const ON: SwapCueState = { band: '3-4', level: 0, solved: 0, firstOfVisit: true, acted: false };

describe('showsSwapCue', () => {
  it('shows at ages 3 to 4 on Level 1, before any solve, on the visit’s first puzzle, before the child acts', () => {
    expect(showsSwapCue(ON)).toBe(true);
  });

  it('never shows at the other ages', () => {
    for (const band of AGE_BANDS.filter((b) => b !== '3-4')) expect(showsSwapCue({ ...ON, band }), band).toBe(false);
  });

  it('never shows past Level 1', () => {
    for (const level of [1, 2, 7, 8, 11]) expect(showsSwapCue({ ...ON, level }), String(level)).toBe(false);
  });

  it('never shows once a puzzle of the level is solved (puzzle 2 on, a reload included)', () => {
    for (const solved of [1, 2, 3]) expect(showsSwapCue({ ...ON, solved }), String(solved)).toBe(false);
  });

  it('never shows on a puzzle that came later in the visit (a different puzzle from the offer)', () => {
    expect(showsSwapCue({ ...ON, firstOfVisit: false })).toBe(false);
  });

  it('goes for good once the child has picked, dragged, asked for a hint or swapped', () => {
    expect(showsSwapCue({ ...ON, acted: true })).toBe(false);
  });

  it('is off for a level or solve count that is not a whole number', () => {
    expect(showsSwapCue({ ...ON, level: -1 })).toBe(false);
    expect(showsSwapCue({ ...ON, level: Number.NaN })).toBe(false);
    expect(showsSwapCue({ ...ON, solved: -1 })).toBe(false);
  });
});

describe('swapCueSpots', () => {
  it('names the two towers the hint would, left one first', () => {
    const row = [3, 1, 2, 4, 6, 5];
    const step = hintStep(row, 'up')!;
    expect(swapCueSpots(row, 'up')).toEqual([Math.min(step.from, step.to), Math.max(step.from, step.to)]);
    expect(swapCueSpots(row, 'up')).toEqual([0, 1]);
  });

  it('works both ways round and for towers far apart', () => {
    expect(swapCueSpots([6, 2, 3, 4, 5, 1], 'up')).toEqual([0, 5]);
    expect(swapCueSpots([1, 5, 4, 3, 2, 6], 'down')).toEqual([0, 5]);
  });

  it('is null for a row already in order, and for no row at all', () => {
    expect(swapCueSpots([1, 2, 3, 4, 5, 6], 'up')).toBeNull();
    expect(swapCueSpots([6, 5, 4, 3, 2, 1], 'down')).toBeNull();
    expect(swapCueSpots([], 'up')).toBeNull();
  });

  it('is a forward swap on every Level 1 start, for any seed: following it lowers the distance to the goal', () => {
    for (const seed of [1, 2, 99, 12345, 0xdeadbeef]) {
      for (const p of makePuzzles(0, seed, '3-4')) {
        const spots = swapCueSpots(p.start, p.dir)!;
        expect(spots, `${seed} ${p.n}`).not.toBeNull();
        expect(spots[0]).toBeLessThan(spots[1]);
        const after = swapAt(p.start, spots[0], spots[1]);
        // the tower that belongs in the first wrong spot is now there
        const to = p.start.findIndex((v, i) => v !== p.goal[i]);
        expect(after[to], `${seed} ${p.n}`).toBe(p.goal[to]);
      }
    }
  });
});
