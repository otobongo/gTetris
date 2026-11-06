/**
 * A raised set version restarts stored runs at puzzle 1 (six-games brief 6), keepSolved games included:
 * keepSolved keeps the solved puzzles only when the set id differs in its age band part alone.
 * First the model (isBandMove, resolveRun), then the store with in-memory storage.
 */
import { describe, expect, it } from 'vitest';
import { lettersSet, levelStars, mathSet, mixerSet, numbersSet } from '../../games/run';
import { isBandMove, resolveRun, runOf } from './model';
import { createProgressStore, type KeyValueStorage } from './store';
import { STORAGE_KEY, type LevelRun, type PuzzleResult, type PuzzleRules, type RunInit } from './types';

const NOON = new Date(2026, 10, 6, 12, 0).getTime();

const result = (puzzle: number): PuzzleResult => ({ puzzle, count: 0, usedHint: false, outOfTime: false });

/** A stored run with puzzles 0 and 1 solved and one hint left, on `set`. */
const stored = (set: string, over: Partial<LevelRun> = {}): LevelRun => ({
  set,
  seed: 77,
  queue: [2, 3, 4, 5],
  solved: [result(0), result(1)],
  hintsLeft: 1,
  updatedAt: NOON - 1000,
  ...over,
});

const keep = (set: string, seed = 9): RunInit => ({ set, seed, hintsLeft: 3, keepSolved: true });

describe('isBandMove: two set ids that differ in the age band part alone', () => {
  it('is true for the same game and version on two bands', () => {
    expect(isBandMove('numbers:1:5-6', 'numbers:1:7-8')).toBe(true);
    expect(isBandMove('math:2:3-4', 'math:2:9-10')).toBe(true);
    expect(isBandMove(lettersSet('5-6'), lettersSet('9-10'))).toBe(true);
  });

  it('is false for a raised version, on the same band or another one', () => {
    expect(isBandMove('numbers:1:5-6', 'numbers:2:5-6')).toBe(false);
    expect(isBandMove('numbers:1:3-4', 'numbers:2:7-8')).toBe(false);
    expect(isBandMove(lettersSet('5-6', 1), lettersSet('5-6', 2))).toBe(false);
  });

  it('is false for the same set, another game, or sets with no band part', () => {
    expect(isBandMove('numbers:1:5-6', 'numbers:1:5-6')).toBe(false);
    expect(isBandMove('numbers:1:5-6', 'math:1:7-8')).toBe(false);
    expect(isBandMove(mixerSet(1), mixerSet(2))).toBe(false);
    expect(isBandMove('escape:old', 'escape:new')).toBe(false);
  });

  it('is false when either end is not an age band, or a part is missing', () => {
    expect(isBandMove('numbers:1:5-6', 'numbers:1:11-12')).toBe(false);
    expect(isBandMove('numbers:1:x', 'numbers:1:5-6')).toBe(false);
    expect(isBandMove('5-6', '7-8')).toBe(false);
    expect(isBandMove(':5-6', ':7-8')).toBe(false);
    expect(isBandMove('', '')).toBe(false);
  });
});

describe('resolveRun with keepSolved', () => {
  it('a band change alone keeps the solved puzzles, the queue and the hints left, and takes the new set and seed', () => {
    const run = resolveRun(stored('numbers:1:5-6'), keep('numbers:1:7-8'), NOON);
    expect(run).toEqual({ ...stored('numbers:1:5-6'), set: 'numbers:1:7-8', seed: 9, updatedAt: NOON });
  });

  it('a raised version on the same band restarts at puzzle 1 with the new seed and a full hint budget', () => {
    const run = resolveRun(stored('numbers:1:5-6'), keep('numbers:2:5-6'), NOON);
    expect(run).toEqual({ set: 'numbers:2:5-6', seed: 9, queue: [0, 1, 2, 3, 4, 5], solved: [], hintsLeft: 3, updatedAt: NOON });
  });

  it('a raised version with a band change restarts too', () => {
    const run = resolveRun(stored(mathSet('3-4', 1)), keep(mathSet('9-10', 2)), NOON);
    expect(run).toMatchObject({ set: 'math:2:9-10', seed: 9, queue: [0, 1, 2, 3, 4, 5], solved: [] });
  });

  it('Letter Builder’s band change keeps its solved puzzles as before, and its raised version restarts', () => {
    expect(resolveRun(stored(lettersSet('5-6')), keep(lettersSet('7-8')), NOON).solved).toHaveLength(2);
    expect(resolveRun(stored(lettersSet('5-6')), keep(lettersSet('5-6', 2)), NOON).solved).toEqual([]);
  });

  it('the same set returns the stored run itself, keepSolved or not', () => {
    const s = stored('numbers:2:5-6');
    expect(resolveRun(s, keep('numbers:2:5-6'), NOON)).toBe(s);
  });

  it('without keepSolved a band change restarts, as before', () => {
    const run = resolveRun(stored('numbers:1:5-6'), { set: 'numbers:1:7-8', seed: 9 }, NOON);
    expect(run.solved).toEqual([]);
    expect(run.queue).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('keepSolved on sets with no band part restarts on any change', () => {
    const run = resolveRun(stored(mixerSet(1)), keep(mixerSet(2)), NOON);
    expect(run).toMatchObject({ set: 'mixer:2', solved: [], queue: [0, 1, 2, 3, 4, 5] });
  });
});

describe('the store: a stored keepSolved run under an older version', () => {
  function setup() {
    const data = new Map<string, string>();
    const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
    let n = 0;
    const store = createProgressStore({ storage, now: () => NOON, newId: () => `id-${++n}`, events: null });
    store.addPlayer({ name: 'Maya', ageBand: '5-6', color: 'blue' });
    return { store, data };
  }

  const rules = (set: string, seed: number): PuzzleRules => ({
    set,
    seed,
    hintsLeft: 3,
    keepSolved: true,
    levelCount: 12,
    stars: (r) => levelStars('numbers', r),
  });

  /** Number Line-up Level 9 under `set` with puzzles 0 and 1 solved and one hint spent. */
  function playTwo(store: ReturnType<typeof setup>['store'], set: string) {
    const r = rules(set, 77);
    store.startRun('numbers', 8, r);
    store.recordPuzzle('numbers', 8, result(0), r);
    store.recordPuzzle('numbers', 8, result(1), r);
    store.spendHint('numbers', 8);
  }

  const saved = (data: Map<string, string>): LevelRun | null => {
    const raw = JSON.parse(data.get(STORAGE_KEY) ?? '{}');
    return raw.players?.[0]?.games?.numbers?.runs?.[8] ?? null;
  };

  it('restarts at puzzle 1 when the set version was raised, and saves the fresh run', () => {
    const { store, data } = setup();
    playTwo(store, numbersSet('5-6', 1));
    const run = store.startRun('numbers', 8, rules(numbersSet('5-6', 2), 5));
    expect(run).toMatchObject({ set: 'numbers:2:5-6', seed: 5, queue: [0, 1, 2, 3, 4, 5], solved: [], hintsLeft: 3 });
    expect(runOf(store.getState().players[0], 'numbers', 8)).toEqual(run);
    expect(saved(data)).toMatchObject({ set: 'numbers:2:5-6', solved: [], hintsLeft: 3 });
  });

  it('keeps the solved puzzles and the hints left on the same version with a band change', () => {
    const { store, data } = setup();
    playTwo(store, numbersSet('5-6', 1));
    const run = store.startRun('numbers', 8, rules(numbersSet('7-8', 1), 5));
    expect(run).toMatchObject({ set: 'numbers:1:7-8', seed: 5, queue: [2, 3, 4, 5], hintsLeft: 2 });
    expect(run.solved.map((r) => r.puzzle)).toEqual([0, 1]);
    expect(saved(data)).toMatchObject({ set: 'numbers:1:7-8', queue: [2, 3, 4, 5], hintsLeft: 2 });
  });

  it('a stored run reloaded from storage under the old version restarts the same way', () => {
    const first = setup();
    playTwo(first.store, numbersSet('5-6', 1));
    const storage: KeyValueStorage = { getItem: (k) => first.data.get(k) ?? null, setItem: (k, v) => void first.data.set(k, v) };
    const reloaded = createProgressStore({ storage, now: () => NOON, newId: () => 'x', events: null });
    expect(runOf(reloaded.getState().players[0], 'numbers', 8)?.solved).toHaveLength(2);
    const run = reloaded.startRun('numbers', 8, rules(numbersSet('5-6', 2), 5));
    expect(run.solved).toEqual([]);
    expect(run.queue).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
