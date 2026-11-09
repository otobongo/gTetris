/**
 * Pattern Train runs in the progress store (six-games brief 6, 10.2 error paths): a stored run under the game id
 * `pattern` with set `pattern:1` and its run seed resumes on the same trains, a corrupt one is dropped by sanitize so
 * the level restarts at puzzle 1, and a run from another set version restarts with a new seed.
 */
import { describe, expect, it } from 'vitest';
import { PUZZLES_PER_LEVEL, gameOf, runOf, sanitize, type LevelRun, type PuzzleResult } from '../../shared/progress';
import { initLevelRun } from '../kit/levelRun';
import { patternSet } from '../run';
import { GAME } from './game';
import { LEVEL_COUNT } from './levels';
import { PATTERN_SET_VERSION, puzzle, type PatternPuzzle } from './puzzles';

const NOON = new Date(2026, 10, 9, 12, 0).getTime();
const SET = patternSet(PATTERN_SET_VERSION);
const STORED_SEED = 918273;
const NEW_SEED = 4455;

/** What a solved Pattern Train puzzle stores: slips in `count`, no hint, never out of time (brief 6). */
const res = (n: number, slips = 0): PuzzleResult => ({ puzzle: n, count: slips, usedHint: false, outOfTime: false });
const goodRun = (over: Partial<LevelRun> = {}): LevelRun => ({ set: SET, seed: STORED_SEED, queue: [2, 3, 4, 5], solved: [res(0), res(1, 2)], updatedAt: 5, ...over });

const rawState = (runs: Record<string, unknown>) => ({
  players: [{ id: 'a', name: 'Maya', ageBand: '5-6', color: 'blue', games: { pattern: { unlocked: 11, stars: {}, best: {}, runs } } }],
  activePlayerId: 'a',
});
const load = (runs: Record<string, unknown>) => sanitize(rawState(runs), NOON).players[0];
const loadRun = (run: unknown, level = 6) => runOf(load({ [level]: run }), 'pattern', level);

/** The level as the kit opens it from what the store holds, and the train it shows first. */
function opens(stored: LevelRun | null, level: number, band: '3-4' | '5-6' | '9-10' = '5-6') {
  const s = initLevelRun({ game: GAME, level, band, stored, now: NOON, newSeed: () => NEW_SEED });
  const shown: PatternPuzzle = GAME.puzzle(level, s.puzzleNo, { seed: s.run.seed, band });
  return { s, shown };
}

describe('a stored Pattern Train run', () => {
  it('uses set pattern:1', () => {
    expect(SET).toBe('pattern:1');
  });

  it('survives sanitize exactly and resumes on the same train, first and last level included', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) {
      const run = loadRun(goodRun(), level);
      expect(run, `level ${level + 1}`).toEqual(goodRun());
      const { s, shown } = opens(run, level);
      expect(s.puzzleNo, `level ${level + 1}`).toBe(2);
      expect(s.run.seed, `level ${level + 1}`).toBe(STORED_SEED);
      expect(shown, `level ${level + 1}`).toEqual(puzzle(level, 2, { seed: STORED_SEED, band: '5-6' }));
    }
  });

  it('resumes on the same train whatever the child’s band is now', () => {
    const run = loadRun(goodRun());
    const trains = (['3-4', '5-6', '9-10'] as const).map((band) => opens(run, 6, band).shown);
    expect(trains[1]).toEqual(trains[0]);
    expect(trains[2]).toEqual(trains[0]);
  });

  it('resumes after a swap on the train that moved to the front', () => {
    const { s, shown } = opens(loadRun(goodRun({ queue: [5, 2, 3, 4] }), 7), 7);
    expect(s.puzzleNo).toBe(5);
    expect(shown).toEqual(puzzle(7, 5, { seed: STORED_SEED, band: '5-6' }));
  });

  it('starts a level with no run at puzzle 1 with a new seed', () => {
    expect(loadRun(undefined)).toBeNull();
    const { s, shown } = opens(null, 0);
    expect(s.run).toMatchObject({ set: SET, seed: NEW_SEED, queue: [0, 1, 2, 3, 4, 5], solved: [] });
    expect(s.run.hintsLeft).toBeUndefined();
    expect(shown).toEqual(puzzle(0, 0, { seed: NEW_SEED, band: '5-6' }));
  });

  it('gives a train for every puzzle number a stored run can hold, at the largest seed the store accepts', () => {
    for (let level = 0; level < LEVEL_COUNT; level++) {
      for (let n = 0; n < PUZZLES_PER_LEVEL; n++) expect(() => puzzle(level, n, { seed: Number.MAX_SAFE_INTEGER, band: '9-10' })).not.toThrow();
    }
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
    ['a seed that is not a whole number', goodRun({ seed: 1.5 })],
    ['a seed past the safe integers', goodRun({ seed: 2 ** 53 })],
    ['a queue that is not a list', { ...goodRun(), queue: '2345' }],
    ['not an object', 'pattern:1'],
  ];

  for (const [what, run] of corrupt) {
    it(`drops a run with ${what}`, () => {
      const loaded = loadRun(run);
      expect(loaded).toBeNull();
      const { s, shown } = opens(loaded, 6);
      expect(s.puzzleNo).toBe(0);
      expect(s.run.solved).toEqual([]);
      expect(shown).toEqual(puzzle(6, 0, { seed: NEW_SEED, band: '5-6' }));
    });
  }

  it('keeps the child’s other Pattern Train progress when one run is dropped', () => {
    const player = load({ 2: goodRun({ queue: [9, 3, 4, 5] }), 5: goodRun() });
    expect(runOf(player, 'pattern', 2)).toBeNull();
    expect(runOf(player, 'pattern', 5)).toEqual(goodRun());
    expect(gameOf(player, 'pattern').unlocked).toBe(11);
  });
});

describe('a run from another set restarts at puzzle 1 with a new seed (6, four-puzzle 6.2)', () => {
  it('restarts a run stored under an older or another set version', () => {
    for (const set of ['pattern:0', 'pattern:2', 'mixer:1']) {
      const stored = loadRun(goodRun({ set }));
      expect(stored?.set).toBe(set);
      const { s, shown } = opens(stored, 6);
      expect(s.run.queue, set).toEqual([0, 1, 2, 3, 4, 5]);
      expect(s.run.solved, set).toEqual([]);
      expect(s.run.set, set).toBe(SET);
      expect(s.run.seed, set).toBe(NEW_SEED);
      expect(shown, set).toEqual(puzzle(6, 0, { seed: NEW_SEED, band: '5-6' }));
    }
  });

  it('keeps a run stored under the same set', () => {
    const stored = loadRun(goodRun());
    expect(opens(stored, 6).s.run).toBe(stored);
  });
});
