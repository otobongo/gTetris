/**
 * Picture Builder runs in the progress store (six-games brief 6, 10.2 error paths): a stored run under the game id
 * `builder` with set `builder:1` and seed 0 resumes on the same picture, a corrupt one is dropped by sanitize so the
 * level restarts at puzzle 1, and a run from another set version restarts too. Peeks are never stored.
 */
import { describe, expect, it } from 'vitest';
import { PUZZLES_PER_LEVEL, freshRun, gameOf, resolveRun, runOf, sanitize, type LevelRun, type PuzzleResult } from '../../shared/progress';
import { initLevelRun } from '../kit/levelRun';
import { builderSet } from '../run';
import { GAME } from './game';
import { BUILDER_SEED, BUILDER_SET_VERSION, LEVEL_COUNT, puzzle } from './puzzles';

const NOON = new Date(2026, 10, 9, 12, 0).getTime();
const SET = builderSet(BUILDER_SET_VERSION);
const INIT = { set: SET, seed: BUILDER_SEED };

/** What a solved Builder puzzle stores: slips in `count`, no hint, never out of time (brief 6). */
const res = (n: number, slips = 0): PuzzleResult => ({ puzzle: n, count: slips, usedHint: false, outOfTime: false });
const goodRun = (over: Partial<LevelRun> = {}): LevelRun => ({ set: SET, seed: 0, queue: [2, 3, 4, 5], solved: [res(0), res(1, 2)], updatedAt: 5, ...over });

const rawState = (runs: Record<string, unknown>) => ({
  players: [{ id: 'a', name: 'Maya', ageBand: '5-6', color: 'blue', games: { builder: { unlocked: 11, stars: {}, best: {}, runs } } }],
  activePlayerId: 'a',
});
const load = (runs: Record<string, unknown>) => sanitize(rawState(runs), NOON).players[0];
const loadRun = (run: unknown, level = 7) => runOf(load({ [level]: run }), 'builder', level);
/** The puzzle a level opens on: queue[0] of its run, or puzzle 1 when there is none. */
const opensOn = (run: LevelRun | null, level: number) => puzzle(level, resolveRun(run, INIT, NOON).queue[0]);

describe('a stored Picture Builder run', () => {
  it('uses set builder:1 and seed 0', () => {
    expect(SET).toBe('builder:1');
    expect(BUILDER_SEED).toBe(0);
  });

  it('survives sanitize exactly and resumes on the same picture, on every level', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) {
      const run = loadRun(goodRun(), level);
      expect(run, `level ${level + 1}`).toEqual(goodRun());
      expect(opensOn(run, level), `level ${level + 1}`).toEqual(puzzle(level, 2));
    }
  });

  it('resumes after a swap on the picture that moved to the front', () => {
    const run = loadRun(goodRun({ queue: [5, 2, 3, 4] }), 11);
    expect(opensOn(run, 11)).toEqual(puzzle(11, 5));
  });

  it('opens a stored run in the kit at its next unsolved puzzle', () => {
    const stored = loadRun(goodRun({ queue: [4, 5, 2, 3] }), 8);
    const s = initLevelRun({ game: GAME, level: 8, band: '7-8', stored, now: NOON });
    expect(s.puzzleNo).toBe(4);
    expect(s.run.solved).toHaveLength(2);
  });

  it('starts a level with no run at puzzle 1, the set’s first picture', () => {
    expect(loadRun(undefined)).toBeNull();
    const run = resolveRun(null, INIT, NOON);
    expect(run).toEqual(freshRun(INIT, NOON));
    expect(run.queue).toEqual([0, 1, 2, 3, 4, 5]);
    expect(run.hintsLeft).toBeUndefined();
    expect(opensOn(null, 2).picture.name).toBe('tree');
  });

  it('gives a picture for every puzzle number a stored run can hold', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) for (let n = 0; n < PUZZLES_PER_LEVEL; n++) expect(() => puzzle(level, n)).not.toThrow();
  });

  it('stores nothing about Peeks: a run holds only the shared fields', () => {
    const s = initLevelRun({ game: GAME, level: 5, band: '5-6', stored: null, now: NOON });
    expect(Object.keys(s.run).sort()).toEqual(['queue', 'seed', 'set', 'solved', 'updatedAt']);
  });
});

describe('a corrupt stored run is dropped and the level restarts at puzzle 1 (10.2)', () => {
  const corrupt: [string, unknown][] = [
    ['a puzzle number past 5', goodRun({ queue: [2, 3, 4, 6] })],
    ['a negative puzzle number', goodRun({ queue: [-1, 3, 4, 5] })],
    ['a repeated puzzle number', goodRun({ queue: [2, 2, 4, 5] })],
    ['a missing puzzle number', goodRun({ queue: [2, 3, 4] })],
    ['four solved puzzles (the fourth finishes the level)', goodRun({ queue: [4, 5], solved: [res(0), res(1), res(2), res(3)] })],
    ['negative slips', goodRun({ solved: [res(0), res(1, -1)] })],
    ['slips that are not a number', goodRun({ solved: [res(0), { ...res(1), count: 'two' }] as unknown as PuzzleResult[] })],
    ['an empty set id', goodRun({ set: '' })],
    ['a negative seed', goodRun({ seed: -1 })],
    ['a queue that is not a list', { ...goodRun(), queue: '2345' }],
    ['not an object', 'builder:1'],
  ];

  for (const [what, run] of corrupt) {
    it(`drops a run with ${what}`, () => {
      const loaded = loadRun(run);
      expect(loaded).toBeNull();
      expect(opensOn(loaded, 7)).toEqual(puzzle(7, 0));
    });
  }

  it('keeps the child’s other Builder progress when one run is dropped', () => {
    const player = load({ 2: goodRun({ queue: [9, 3, 4, 5] }), 9: goodRun() });
    expect(runOf(player, 'builder', 2)).toBeNull();
    expect(runOf(player, 'builder', 9)).toEqual(goodRun());
    expect(gameOf(player, 'builder').unlocked).toBe(11);
  });
});

describe('a run from another set restarts at puzzle 1 (6, four-puzzle 6.2)', () => {
  it('restarts a run stored under an older or another set version', () => {
    for (const set of ['builder:0', 'builder:2', 'sorter:1']) {
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

  it('keeps a run when the child’s band changes: every band stores under builder:1', () => {
    const stored = loadRun(goodRun(), 6);
    for (const band of ['3-4', '9-10'] as const) {
      const s = initLevelRun({ game: GAME, level: 6, band, stored, now: NOON });
      expect(s.run, band).toBe(stored);
      expect(s.puzzleNo, band).toBe(2);
    }
  });
});
