/**
 * Brick Calculator runs in the progress store (six-games brief 6, 10.2 error paths): a stored run under the game id
 * `math` with set `math:1:<band>` and its own seed resumes on the same sum, a corrupt one is dropped by sanitize so
 * the level restarts at puzzle 1, a band change keeps the solved sums (keepSolved), and a run from another set
 * version restarts.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, PUZZLES_PER_LEVEL, freshRun, gameOf, resolveRun, runOf, sanitize, type AgeBand, type LevelRun, type PuzzleResult, type RunInit } from '../../shared/progress';
import { mathSet } from '../run';
import { MATH } from './game';
import { LEVELS, puzzle } from './puzzles';

const NOON = new Date(2026, 10, 9, 12, 0).getTime();
const BAND: AgeBand = '7-8';
const SET = mathSet(BAND);
/** What the kit passes for a math run: the band's set, the run's seed, keepSolved, no hint budget. */
const init = (band: AgeBand = BAND, seed = 9): RunInit => ({ set: mathSet(band), seed, keepSolved: true });

/** What a solved sum stores: slips in `count`, no hint, never out of time (brief 6). */
const res = (n: number, slips = 0): PuzzleResult => ({ puzzle: n, count: slips, usedHint: false, outOfTime: false });
const goodRun = (over: Partial<LevelRun> = {}): LevelRun => ({ set: SET, seed: 31337, queue: [2, 3, 4, 5], solved: [res(0), res(1, 2)], updatedAt: 5, ...over });

const rawState = (runs: Record<string, unknown>) => ({
  players: [{ id: 'a', name: 'Maya', ageBand: BAND, color: 'blue', games: { math: { unlocked: 11, stars: {}, best: {}, runs } } }],
  activePlayerId: 'a',
});
const load = (runs: Record<string, unknown>) => sanitize(rawState(runs), NOON).players[0];
const loadRun = (run: unknown, level = 6) => runOf(load({ [level]: run }), 'math', level);
/** The sum a level opens on: queue[0] of its run, or puzzle 1 when there is none, with the run's seed. */
function opensOn(run: LevelRun | null, level: number, band: AgeBand = BAND) {
  const r = resolveRun(run, init(band), NOON);
  return puzzle(level, r.queue[0], { seed: r.seed, band });
}

describe('a stored Brick Calculator run', () => {
  it('uses set math:1:<band> under the game id math', () => {
    expect(SET).toBe('math:1:7-8');
    expect(MATH.id).toBe('math');
    expect(MATH.set(BAND)).toBe(SET);
  });

  it('survives sanitize exactly and resumes on the same sum, from its own seed', () => {
    for (let level = 0; level < LEVELS.length; level++) {
      const run = loadRun(goodRun(), level);
      expect(run, `Level ${level + 1}`).toEqual(goodRun());
      expect(opensOn(run, level), `Level ${level + 1}`).toEqual(puzzle(level, 2, { seed: 31337, band: BAND }));
    }
  });

  it('resumes after a swap on the sum that moved to the front', () => {
    const run = loadRun(goodRun({ queue: [5, 2, 3, 4] }), 9);
    expect(opensOn(run, 9)).toEqual(puzzle(9, 5, { seed: 31337, band: BAND }));
  });

  it('starts a level with no run at puzzle 1 with a new seed and no hint budget', () => {
    expect(loadRun(undefined)).toBeNull();
    const run = resolveRun(null, init(BAND, 9), NOON);
    expect(run).toEqual(freshRun(init(BAND, 9), NOON));
    expect(run).toMatchObject({ set: SET, seed: 9, queue: [0, 1, 2, 3, 4, 5], solved: [] });
    expect(run.hintsLeft).toBeUndefined();
    expect(opensOn(null, 0)).toEqual(puzzle(0, 0, { seed: 9, band: BAND }));
  });

  it('gives a sum for every puzzle number a stored run can hold, at every band', () => {
    for (const band of AGE_BANDS)
      for (let level = 0; level < LEVELS.length; level++)
        for (let n = 0; n < PUZZLES_PER_LEVEL; n++) expect(() => puzzle(level, n, { seed: 31337, band })).not.toThrow();
  });
});

describe('a corrupt stored run is dropped and the level restarts at puzzle 1 (10.2)', () => {
  const corrupt: [string, unknown][] = [
    ['a puzzle number past 5', goodRun({ queue: [2, 3, 4, 6] })],
    ['a negative puzzle number', goodRun({ queue: [-1, 3, 4, 5] })],
    ['a repeated puzzle number', goodRun({ queue: [2, 2, 4, 5] })],
    ['a missing puzzle number', goodRun({ queue: [2, 3, 4] })],
    ['four solved sums (the fourth finishes the level)', goodRun({ queue: [4, 5], solved: [res(0), res(1), res(2), res(3)] })],
    ['negative slips', goodRun({ solved: [res(0), res(1, -1)] })],
    ['slips that are not a number', goodRun({ solved: [res(0), { ...res(1), count: 'two' }] as unknown as PuzzleResult[] })],
    ['an empty set id', goodRun({ set: '' })],
    ['a negative seed', goodRun({ seed: -1 })],
    ['a seed that is not a whole number', goodRun({ seed: 1.5 })],
    ['a queue that is not a list', { ...goodRun(), queue: '2345' }],
    ['not an object', 'math:1:7-8'],
  ];

  for (const [what, run] of corrupt) {
    it(`drops a run with ${what}`, () => {
      const loaded = loadRun(run);
      expect(loaded).toBeNull();
      const fresh = resolveRun(loaded, init(), NOON);
      expect(fresh).toMatchObject({ set: SET, seed: 9, queue: [0, 1, 2, 3, 4, 5], solved: [] });
      expect(opensOn(loaded, 6)).toEqual(puzzle(6, 0, { seed: 9, band: BAND }));
    });
  }

  it('keeps the child’s other Brick Calculator progress when one run is dropped', () => {
    const player = load({ 2: goodRun({ queue: [9, 3, 4, 5] }), 5: goodRun() });
    expect(runOf(player, 'math', 2)).toBeNull();
    expect(runOf(player, 'math', 5)).toEqual(goodRun());
    expect(gameOf(player, 'math').unlocked).toBe(11);
  });
});

describe('a band change and a set version (6, keepSolved)', () => {
  it('keeps the solved sums, the queue and the order a swap left on a band change, with the new band’s set', () => {
    const stored = loadRun(goodRun({ queue: [5, 2, 3, 4] }), 8);
    const run = resolveRun(stored, init('9-10', 9), NOON);
    expect(run).toEqual({ ...goodRun({ queue: [5, 2, 3, 4] }), set: 'math:1:9-10', seed: 9, updatedAt: NOON });
  });

  it('restarts a run stored under an older or newer set version, or another game’s set', () => {
    for (const set of ['math:0:7-8', 'math:2:7-8', 'math:2:9-10', 'numbers:1:7-8', 'math:1']) {
      const stored = loadRun(goodRun({ set }));
      expect(stored?.set).toBe(set);
      const run = resolveRun(stored, init(), NOON);
      expect(run.queue, set).toEqual([0, 1, 2, 3, 4, 5]);
      expect(run.solved, set).toEqual([]);
      expect(run.set).toBe(SET);
    }
  });

  it('keeps a run stored under the same set as it is', () => {
    const stored = loadRun(goodRun());
    expect(resolveRun(stored, init(), NOON)).toBe(stored);
  });
});
