/**
 * Shape Sorter runs in the progress store (six-games brief 6, 10.2 error paths): a stored run under the game id
 * `sorter` with set `sorter:1` and seed 0 resumes on the same boards, a corrupt one is dropped by sanitize so the
 * level restarts at puzzle 1, and a run from another set version restarts too.
 */
import { describe, expect, it } from 'vitest';
import { PUZZLES_PER_LEVEL, freshRun, gameOf, resolveRun, runOf, sanitize, type LevelRun, type PuzzleResult } from '../../shared/progress';
import { LEVEL_COUNT, SORTER_SEED, SORTER_SET_VERSION, puzzle } from './puzzles';

const NOON = new Date(2026, 10, 6, 12, 0).getTime();
const SET = `sorter:${SORTER_SET_VERSION}`;
const INIT = { set: SET, seed: SORTER_SEED };

/** What a solved Sorter board stores: slips in `count`, no hint, never out of time (brief 6). */
const res = (n: number, slips = 0): PuzzleResult => ({ puzzle: n, count: slips, usedHint: false, outOfTime: false });
const goodRun = (over: Partial<LevelRun> = {}): LevelRun => ({ set: SET, seed: 0, queue: [2, 3, 4, 5], solved: [res(0), res(1, 2)], updatedAt: 5, ...over });

const rawState = (runs: Record<string, unknown>) => ({
  players: [{ id: 'a', name: 'Maya', ageBand: '5-6', color: 'blue', games: { sorter: { unlocked: 8, stars: {}, best: {}, runs } } }],
  activePlayerId: 'a',
});
const load = (runs: Record<string, unknown>) => sanitize(rawState(runs), NOON).players[0];
const loadRun = (run: unknown, level = 4) => runOf(load({ [level]: run }), 'sorter', level);
/** The board a level opens on: queue[0] of its run, or puzzle 1 when there is none. */
const opensOn = (run: LevelRun | null, level: number) => puzzle(level, resolveRun(run, INIT, NOON).queue[0]);

describe('a stored Shape Sorter run', () => {
  it('uses set sorter:1 and seed 0', () => {
    expect(SET).toBe('sorter:1');
    expect(SORTER_SEED).toBe(0);
  });

  it('survives sanitize exactly and resumes on the same board', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) {
      const run = loadRun(goodRun(), level);
      expect(run, `level ${level + 1}`).toEqual(goodRun());
      expect(opensOn(run, level), `level ${level + 1}`).toEqual(puzzle(level, 2));
    }
  });

  it('resumes after a swap on the board that moved to the front', () => {
    const run = loadRun(goodRun({ queue: [5, 2, 3, 4] }), 7);
    expect(opensOn(run, 7)).toEqual(puzzle(7, 5));
  });

  it('starts a level with no run at puzzle 1, the first board', () => {
    expect(loadRun(undefined)).toBeNull();
    const run = resolveRun(null, INIT, NOON);
    expect(run).toEqual(freshRun(INIT, NOON));
    expect(run.queue).toEqual([0, 1, 2, 3, 4, 5]);
    expect(run.hintsLeft).toBeUndefined();
    expect(opensOn(null, 0)).toEqual(puzzle(0, 0));
  });

  it('gives a board for every puzzle number a stored run can hold', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) for (let n = 0; n < PUZZLES_PER_LEVEL; n++) expect(() => puzzle(level, n)).not.toThrow();
  });
});

describe('a corrupt stored run is dropped and the level restarts at puzzle 1 (10.2)', () => {
  const corrupt: [string, unknown][] = [
    ['a puzzle number past 5', goodRun({ queue: [2, 3, 4, 6] })],
    ['a negative puzzle number', goodRun({ queue: [-1, 3, 4, 5] })],
    ['a repeated puzzle number', goodRun({ queue: [2, 2, 4, 5] })],
    ['a missing puzzle number', goodRun({ queue: [2, 3, 4] })],
    ['four solved boards (the fourth finishes the level)', goodRun({ queue: [4, 5], solved: [res(0), res(1), res(2), res(3)] })],
    ['negative slips', goodRun({ solved: [res(0), res(1, -1)] })],
    ['slips that are not a number', goodRun({ solved: [res(0), { ...res(1), count: 'two' }] as unknown as PuzzleResult[] })],
    ['an empty set id', goodRun({ set: '' })],
    ['a negative seed', goodRun({ seed: -1 })],
    ['a queue that is not a list', { ...goodRun(), queue: '2345' }],
    ['not an object', 'sorter:1'],
  ];

  for (const [what, run] of corrupt) {
    it(`drops a run with ${what}`, () => {
      const loaded = loadRun(run);
      expect(loaded).toBeNull();
      expect(opensOn(loaded, 4)).toEqual(puzzle(4, 0));
    });
  }

  it('keeps the child’s other Sorter progress when one run is dropped', () => {
    const player = load({ 2: goodRun({ queue: [9, 3, 4, 5] }), 5: goodRun() });
    expect(runOf(player, 'sorter', 2)).toBeNull();
    expect(runOf(player, 'sorter', 5)).toEqual(goodRun());
    expect(gameOf(player, 'sorter').unlocked).toBe(8);
  });
});

describe('a run from another set restarts at puzzle 1 (6, four-puzzle 6.2)', () => {
  it('restarts a run stored under an older or another set version', () => {
    for (const set of ['sorter:0', 'sorter:2', 'mixer:1']) {
      const stored = loadRun(goodRun({ set }));
      expect(stored?.set).toBe(set);
      const run = resolveRun(stored, INIT, NOON);
      expect(run.queue, set).toEqual([0, 1, 2, 3, 4, 5]);
      expect(run.solved, set).toEqual([]);
      expect(run.set).toBe(SET);
    }
  });

  it('keeps a run stored under the same set', () => {
    const stored = loadRun(goodRun());
    expect(resolveRun(stored, INIT, NOON)).toBe(stored);
  });
});
