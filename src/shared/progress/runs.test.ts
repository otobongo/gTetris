/**
 * Four-puzzle levels in the progress store (brief 6.1 to 6.3): the stored runs and current level,
 * their validation, the store actions and the v2 to v3 migration.
 */
import { describe, expect, it } from 'vitest';
import { currentLevel, type GameMeta } from '../../games/meta';
import { dropLevelStars, escapeLevelStars, lettersLevelStars, levelScore } from '../../games/run';
import { cleanResult, cleanRun, gameOf, nextCurrentLevel, runOf, sanitize, solvedCount } from './model';
import { createProgressStore, type KeyValueStorage } from './store';
import { SCHEMA_VERSION, STORAGE_KEY, type LevelRun, type PuzzleResult, type PuzzleRules } from './types';

const NOON = new Date(2026, 10, 4, 12, 0).getTime();

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  return { data, storage };
}

function setup(initial: Record<string, string> = {}) {
  const mem = memory(initial);
  let n = 0;
  let clock = NOON;
  const store = createProgressStore({ storage: mem.storage, now: () => clock, newId: () => `id-${++n}`, events: null });
  return { store, mem, tick: (ms = 1000) => (clock += ms) };
}

const withMaya = () => {
  const s = setup();
  s.store.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' });
  return s;
};

const res = (puzzle: number, over: Partial<PuzzleResult> = {}): PuzzleResult => ({ puzzle, count: 6, par: 6, usedHint: false, outOfTime: false, ...over });
const ESC = (levelCount = 31, set = 'escape:abc'): PuzzleRules => ({ set, seed: 0, levelCount, stars: escapeLevelStars });
const goodRun = (over: Partial<LevelRun> = {}): LevelRun => ({ set: 'escape:abc', seed: 0, queue: [2, 3, 4, 5], solved: [res(0), res(1)], updatedAt: 5, ...over });

const rawState = (games: Record<string, unknown>) => ({
  players: [{ id: 'a', name: 'Maya', ageBand: '7-8', color: 'blue', games }],
  activePlayerId: 'a',
});
const loadGame = (game: unknown) => gameOf(sanitize(rawState({ escape: game }), NOON).players[0], 'escape');
const loadRun = (run: unknown) => loadGame({ unlocked: 2, stars: {}, best: {}, runs: { 2: run } }).runs?.[2] ?? null;

/** Solve puzzles in order on one level. */
function solve(store: ReturnType<typeof setup>['store'], level: number, puzzles: number[], rules: PuzzleRules = ESC(), over: Partial<PuzzleResult> = {}) {
  store.startRun('escape', level, rules);
  return puzzles.map((p) => store.recordPuzzle('escape', level, res(p, over), rules));
}

/* ---------- validation ---------- */

describe('sanitize: runs and current', () => {
  it('keeps a valid run exactly', () => {
    expect(loadRun(goodRun())).toEqual(goodRun());
    expect(loadRun(goodRun({ hintsLeft: 0 }))).toEqual(goodRun({ hintsLeft: 0 }));
    expect(loadRun(goodRun({ queue: [5, 0, 1, 2, 3, 4], solved: [] }))).toEqual(goodRun({ queue: [5, 0, 1, 2, 3, 4], solved: [] }));
  });

  it('drops a run whose queue repeats a number, or holds one outside 0 to 5', () => {
    for (const queue of [[2, 2, 3, 4], [2, 3, 4, 6], [2, 3, 4, -1], [2, 3, 4, 5.5], [2, 3, 4, '5'], [2, 3, 4, null]]) {
      expect(loadRun(goodRun({ queue: queue as number[] })), JSON.stringify(queue)).toBeNull();
    }
  });

  it('drops a run where queue and solved share a puzzle, or a puzzle is missing from both', () => {
    expect(loadRun(goodRun({ queue: [1, 2, 3, 4, 5] }))).toBeNull();
    expect(loadRun(goodRun({ queue: [2, 3, 4] }))).toBeNull();
    expect(loadRun(goodRun({ queue: [] , solved: [] }))).toBeNull();
  });

  it('drops a run with more than 3 results', () => {
    expect(loadRun(goodRun({ queue: [4, 5], solved: [res(0), res(1), res(2), res(3)] }))).toBeNull();
    expect(loadRun(goodRun({ queue: [3, 4, 5], solved: [res(0), res(1), res(2)] }))).not.toBeNull();
  });

  it('drops a run with hintsLeft of 4, -1 or a fraction', () => {
    for (const hintsLeft of [4, -1, 1.5, '2', Number.NaN]) expect(loadRun(goodRun({ hintsLeft: hintsLeft as number })), String(hintsLeft)).toBeNull();
    for (const hintsLeft of [0, 1, 2, 3]) expect(loadRun(goodRun({ hintsLeft }))?.hintsLeft).toBe(hintsLeft);
  });

  it('drops a run whose results have negative, NaN or missing numbers, or flags that are not booleans', () => {
    const bad: unknown[] = [
      { ...res(0), count: -1 },
      { ...res(0), count: Number.NaN },
      { ...res(0), count: undefined },
      { ...res(0), par: -2 },
      { ...res(0), three: Number.POSITIVE_INFINITY },
      { ...res(0), score: 'lots' },
      { ...res(0), usedHint: 'yes' },
      { ...res(0), outOfTime: 1 },
      { ...res(0), usedHint: undefined },
      { ...res(0), puzzle: 7 },
      null,
      'a result',
    ];
    for (const r of bad) expect(loadRun(goodRun({ solved: [r as PuzzleResult, res(1)] })), JSON.stringify(r)).toBeNull();
  });

  it('accepts a built word of 1 to 16 letters only', () => {
    expect(cleanResult({ ...res(0), word: 'sun' })?.word).toBe('sun');
    expect(cleanResult({ ...res(0), word: 'SUN' })?.word).toBe('SUN');
    expect(cleanResult({ ...res(0), word: 'a'.repeat(16) })?.word).toHaveLength(16);
    for (const word of ['', 'a'.repeat(17), 'sun1', 'su n', 'café', 7]) expect(cleanResult({ ...res(0), word }), String(word)).toBeNull();
  });

  it('drops a run with an oversized or empty set, or a seed that is not a non-negative integer', () => {
    expect(loadRun(goodRun({ set: 'x'.repeat(65) }))).toBeNull();
    expect(loadRun(goodRun({ set: 'x'.repeat(64) }))?.set).toHaveLength(64);
    expect(loadRun(goodRun({ set: '' }))).toBeNull();
    for (const seed of [-1, 1.5, Number.NaN, '3']) expect(loadRun(goodRun({ seed: seed as number })), String(seed)).toBeNull();
    expect(loadRun(goodRun({ seed: 123456789 }))?.seed).toBe(123456789);
  });

  it('drops unknown fields from runs and results', () => {
    const run = loadRun({ ...goodRun(), extra: 1, solved: [{ ...res(0), note: 'x' }, res(1)] });
    expect(run).toEqual(goodRun());
  });

  it('never lets a stored run key reach an object prototype, and keeps the good runs beside a broken one', () => {
    const raw = JSON.parse(
      `{"unlocked":3,"stars":{},"best":{},"runs":{"__proto__":${JSON.stringify(goodRun())},"constructor":${JSON.stringify(goodRun())},"1e1":${JSON.stringify(goodRun())},"-1":${JSON.stringify(goodRun())},"1":${JSON.stringify(goodRun())},"2":{"set":"x"}}}`,
    );
    const g = loadGame(raw);
    expect(Object.keys(g.runs ?? {})).toEqual(['1']);
    expect(Object.getPrototypeOf(g.runs)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).set).toBeUndefined();
  });

  it('leaves runs absent when none survive', () => {
    expect(loadGame({ unlocked: 0, stars: {}, best: {}, runs: { 0: { broken: true } } })).not.toHaveProperty('runs');
    expect(loadGame({ unlocked: 0, stars: {}, best: {}, runs: 'no' })).not.toHaveProperty('runs');
  });

  it('keeps a current from 0 to 999 and drops anything else', () => {
    for (const current of [0, 9, 999]) expect(loadGame({ unlocked: 0, stars: {}, best: {}, current }).current).toBe(current);
    for (const current of [1000, -1, 2.5, '3', null, Number.NaN]) expect(loadGame({ unlocked: 0, stars: {}, best: {}, current }), String(current)).not.toHaveProperty('current');
  });

  it('cleanRun on its own rejects anything that is not a run', () => {
    for (const raw of [null, [], 'run', 3, { set: 'a', seed: 0, queue: 'x', solved: [] }]) expect(cleanRun(raw)).toBeNull();
  });
});

/* ---------- migration ---------- */

describe('migration from a v2 record (6.3)', () => {
  const v2 = {
    version: 2,
    players: [
      {
        id: 'a',
        name: 'Maya',
        ageBand: '7-8',
        color: 'blue',
        games: { escape: { unlocked: 5, stars: { 0: 3, 1: 2, 2: 1, 3: 3, 4: 2 }, best: {} }, drop: { unlocked: 2, stars: { 0: 2, 1: 3 }, best: { 0: 1200, 1: 900 } } },
      },
    ],
    activePlayerId: 'a',
  };

  it('keeps stars, best and unlocked, adds no runs or current, and marks the record version 3', () => {
    const { store } = setup({ [STORAGE_KEY]: JSON.stringify(v2) });
    const state = store.getState();
    expect(state.version).toBe(3);
    expect(SCHEMA_VERSION).toBe(3);
    const p = state.players[0];
    expect(p.games.escape).toEqual({ unlocked: 5, stars: { 0: 3, 1: 2, 2: 1, 3: 3, 4: 2 }, best: {} });
    expect(p.games.drop).toEqual({ unlocked: 2, stars: { 0: 2, 1: 3 }, best: { 0: 1200, 1: 900 } });
    // every unfinished level starts at puzzle 1
    expect(runOf(p, 'escape', 5)).toBeNull();
  });

  it('a v2 child who starred every level loads as finished', () => {
    const all = JSON.parse(JSON.stringify(v2));
    all.players[0].games.drop = { unlocked: 3, stars: { 0: 1, 1: 2, 2: 3 }, best: {} };
    const { store } = setup({ [STORAGE_KEY]: JSON.stringify(all) });
    const meta: GameMeta = { levelCount: 3, chapters: [] };
    expect(currentLevel(meta, gameOf(store.getState().players[0], 'drop'))).toBeNull();
  });

  it('the next write saves version 3 with the runs, and a reload reads them back', () => {
    const { store, mem } = setup({ [STORAGE_KEY]: JSON.stringify(v2) });
    store.startRun('escape', 5, ESC());
    store.recordPuzzle('escape', 5, res(0), ESC());
    const saved = JSON.parse(mem.data.get(STORAGE_KEY)!);
    expect(saved.version).toBe(3);
    expect(saved.players[0].games.escape.runs['5'].solved).toHaveLength(1);
    store.reload();
    expect(solvedCount(store.getState().players[0], 'escape', 5)).toBe(1);
  });
});

/* ---------- store actions ---------- */

describe('startRun', () => {
  it('opens a new level at puzzle 1 with every puzzle queued, and saves it with its seed', () => {
    const { store } = withMaya();
    const run = store.startRun('letters', 0, { set: 'letters:1:7-8', seed: 42, hintsLeft: 3 });
    expect(run).toEqual({ set: 'letters:1:7-8', seed: 42, queue: [0, 1, 2, 3, 4, 5], solved: [], hintsLeft: 3, updatedAt: NOON });
    expect(runOf(store.getState().players[0], 'letters', 0)).toEqual(run);
  });

  it('continues a stored run on the same set, keeping its seed, and writes nothing', () => {
    const { store, tick } = withMaya();
    store.startRun('letters', 0, { set: 'letters:1:7-8', seed: 42, hintsLeft: 3 });
    tick();
    const before = store.getState();
    const again = store.startRun('letters', 0, { set: 'letters:1:7-8', seed: 99, hintsLeft: 3 });
    expect(again.seed).toBe(42);
    expect(store.getState()).toBe(before);
  });

  it('a changed set (a Brick Escape level id) restarts that level only', () => {
    const { store } = withMaya();
    solve(store, 3, [0, 1], ESC(31, 'escape:old'));
    solve(store, 4, [0], ESC(31, 'escape:four'));
    const run = store.startRun('escape', 3, ESC(31, 'escape:new'));
    expect(run.solved).toEqual([]);
    expect(run.set).toBe('escape:new');
    expect(solvedCount(store.getState().players[0], 'escape', 4)).toBe(1);
  });

  it('Letter Builder’s band change keeps solved, the queue and the hints left, and takes the new set and seed', () => {
    const { store } = withMaya();
    const rules: PuzzleRules = { set: 'letters:1:5-6', seed: 7, hintsLeft: 3, levelCount: 24, stars: lettersLevelStars };
    store.startRun('letters', 6, rules);
    store.recordPuzzle('letters', 6, res(0, { count: 0, word: 'sun' }), rules);
    store.spendHint('letters', 6);
    const run = store.startRun('letters', 6, { set: 'letters:1:7-8', seed: 8, hintsLeft: 3, keepSolved: true });
    expect(run.set).toBe('letters:1:7-8');
    expect(run.seed).toBe(8);
    expect(run.solved.map((r) => r.word)).toEqual(['sun']);
    expect(run.queue).toEqual([1, 2, 3, 4, 5]);
    expect(run.hintsLeft).toBe(2);
  });

  it('without a player, or with a bad level or set, saves nothing and still returns a fresh run', () => {
    const { store, mem } = setup();
    expect(store.startRun('escape', 0, ESC()).queue).toEqual([0, 1, 2, 3, 4, 5]);
    expect(mem.data.has(STORAGE_KEY)).toBe(false);
    const m = withMaya();
    const before = m.store.getState();
    m.store.startRun('escape', -1, ESC());
    m.store.startRun('escape', 1.5, ESC());
    m.store.startRun('escape', 0, { set: '', seed: 0 });
    m.store.startRun('escape', 0, { set: 'x'.repeat(65), seed: 0 });
    expect(m.store.getState()).toBe(before);
  });
});

describe('recordPuzzle', () => {
  it('appends the result, takes it out of the queue and saves', () => {
    const { store } = withMaya();
    const [out] = solve(store, 0, [0]);
    expect(out.kind).toBe('saved');
    const run = runOf(store.getState().players[0], 'escape', 0)!;
    expect(run.queue).toEqual([1, 2, 3, 4, 5]);
    expect(run.solved).toEqual([res(0)]);
  });

  it('ignores a puzzle that is already solved or not a puzzle number, and a level outside the game', () => {
    const { store } = withMaya();
    solve(store, 0, [0]);
    const before = store.getState();
    expect(store.recordPuzzle('escape', 0, res(0), ESC()).kind).toBe('ignored');
    expect(store.recordPuzzle('escape', 0, res(6), ESC()).kind).toBe('ignored');
    expect(store.recordPuzzle('escape', 0, { ...res(1), count: -3 }, ESC()).kind).toBe('ignored');
    expect(store.recordPuzzle('escape', 31, res(1), ESC(31)).kind).toBe('ignored');
    expect(store.getState()).toBe(before);
  });

  it('a solve with no stored run (another tab cleared it) starts one and is kept', () => {
    const { store } = withMaya();
    expect(store.recordPuzzle('escape', 2, res(3), ESC()).kind).toBe('saved');
    expect(runOf(store.getState().players[0], 'escape', 2)!.queue).toEqual([0, 1, 2, 4, 5]);
  });

  it('the fourth solve finishes the level in one write: stars, unlock, run gone, current on the next level', () => {
    const { store } = withMaya();
    const outs = solve(store, 0, [0, 1, 2, 3], ESC(), { count: 7 }); // E = 4
    expect(outs.slice(0, 3).map((o) => o.kind)).toEqual(['saved', 'saved', 'saved']);
    expect(outs[3]).toEqual({ kind: 'finished', level: 0, stars: 3, results: [0, 1, 2, 3].map((p) => res(p, { count: 7 })), next: 1 });
    const g = gameOf(store.getState().players[0], 'escape');
    expect(g.stars[0]).toBe(3);
    expect(g.unlocked).toBe(1);
    expect(g.current).toBe(1);
    expect(g).not.toHaveProperty('runs');
  });

  it('swapped puzzles never count: only the 4 solved results reach the star rule', () => {
    const { store } = withMaya();
    const seen: PuzzleResult[][] = [];
    const rules: PuzzleRules = { ...ESC(), stars: (r) => (seen.push([...r]), escapeLevelStars(r)) };
    store.startRun('escape', 0, rules);
    store.swapPuzzle('escape', 0); // puzzle 0 swapped away, with whatever it cost
    for (const p of [1, 2, 3, 4]) store.recordPuzzle('escape', 0, res(p), rules);
    expect(seen).toHaveLength(1);
    expect(seen[0].map((r) => r.puzzle)).toEqual([1, 2, 3, 4]);
  });

  it('a replay keeps the higher stars', () => {
    const { store } = withMaya();
    solve(store, 0, [0, 1, 2, 3]); // 3 stars
    store.pickLevel('escape', 0, 31);
    const outs = solve(store, 0, [0, 1, 2, 3], ESC(), { usedHint: true });
    expect(outs[3]).toMatchObject({ kind: 'finished', stars: 2 });
    expect(gameOf(store.getState().players[0], 'escape').stars[0]).toBe(3);
  });

  it('Brick Drop: the level score is the sum of 4 and best keeps the highest', () => {
    const { store } = withMaya();
    const rules: PuzzleRules = { set: 'drop:1', seed: 0, levelCount: 12, stars: dropLevelStars, score: levelScore };
    const drop = (scores: number[]) => {
      store.startRun('drop', 3, rules);
      scores.forEach((score, p) => store.recordPuzzle('drop', 3, { puzzle: p, count: 10, three: 10, two: 14, score, usedHint: false, outOfTime: false }, rules));
    };
    drop([1200, 1200, 1200, 1220]);
    expect(gameOf(store.getState().players[0], 'drop').best[3]).toBe(4820);
    store.pickLevel('drop', 3, 12);
    drop([100, 100, 100, 100]);
    expect(gameOf(store.getState().players[0], 'drop').best[3]).toBe(4820);
  });

  it('a star rule that returns nothing usable still finishes the level with 1 star', () => {
    const { store } = withMaya();
    const outs = solve(store, 0, [0, 1, 2, 3], { ...ESC(), stars: () => Number.NaN });
    expect(outs[3]).toMatchObject({ kind: 'finished', stars: 1 });
    expect(gameOf(store.getState().players[0], 'escape').stars[0]).toBe(1);
  });
});

describe('current after a finish (6.2)', () => {
  const frontierAt = (store: ReturnType<typeof setup>['store'], n: number) => {
    for (let l = 0; l < n; l++) solve(store, l, [0, 1, 2, 3]);
  };

  it('a replay pick of Level 3 returns the child to their frontier', () => {
    const { store } = withMaya();
    frontierAt(store, 10);
    store.pickLevel('escape', 2, 31);
    expect(gameOf(store.getState().players[0], 'escape').current).toBe(2);
    solve(store, 2, [0, 1, 2, 3]);
    expect(gameOf(store.getState().players[0], 'escape').current).toBe(10);
  });

  it('a jump pick to Level 20 continues at 21', () => {
    const { store } = withMaya();
    frontierAt(store, 10);
    store.pickLevel('escape', 19, 31);
    const g = gameOf(store.getState().players[0], 'escape');
    expect(g.current).toBe(19);
    expect(g.unlocked).toBe(19);
    solve(store, 19, [0, 1, 2, 3]);
    expect(gameOf(store.getState().players[0], 'escape').current).toBe(20);
  });

  it('finishing the last level wraps round to the first level with no stars', () => {
    const { store } = withMaya();
    frontierAt(store, 3);
    store.pickLevel('escape', 5, 6);
    solve(store, 5, [0, 1, 2, 3], ESC(6));
    expect(gameOf(store.getState().players[0], 'escape').current).toBe(3);
  });

  it('finishing the last unstarred level deletes current, so currentLevel is null', () => {
    const { store } = withMaya();
    for (let l = 0; l < 3; l++) solve(store, l, [0, 1, 2, 3], ESC(3));
    const g = gameOf(store.getState().players[0], 'escape');
    expect(g).not.toHaveProperty('current');
    expect(currentLevel({ levelCount: 3, chapters: [] }, g)).toBeNull();
  });

  it('nextCurrentLevel: after it, then wrapping, then null', () => {
    expect(nextCurrentLevel({ 0: 1 }, 0, 4)).toBe(1);
    expect(nextCurrentLevel({ 0: 1, 1: 2, 3: 3 }, 3, 4)).toBe(2);
    expect(nextCurrentLevel({ 0: 1, 1: 1, 2: 1, 3: 1 }, 3, 4)).toBeNull();
    expect(nextCurrentLevel({ 2: 1 }, 2, 3)).toBe(0);
  });
});

describe('swapPuzzle', () => {
  it('moves queue[0] to the end and saves; the solved count does not change', () => {
    const { store, mem } = withMaya();
    solve(store, 0, [0]);
    const run = store.swapPuzzle('escape', 0)!;
    expect(run.queue).toEqual([2, 3, 4, 5, 1]);
    expect(run.solved).toHaveLength(1);
    expect(JSON.parse(mem.data.get(STORAGE_KEY)!).players[0].games.escape.runs['0'].queue).toEqual([2, 3, 4, 5, 1]);
  });

  it('after every spare is seen, the oldest swapped puzzle comes back', () => {
    const { store } = withMaya();
    solve(store, 0, [0, 1, 2]); // queue [3, 4, 5]
    const seen = [3, 4, 5, 3].map(() => {
      const on = runOf(store.getState().players[0], 'escape', 0)!.queue[0];
      store.swapPuzzle('escape', 0);
      return on;
    });
    expect(seen).toEqual([3, 4, 5, 3]);
  });

  it('is null when the level has no run', () => {
    const { store } = withMaya();
    expect(store.swapPuzzle('escape', 4)).toBeNull();
  });
});

describe('spendHint', () => {
  const LB: PuzzleRules = { set: 'letters:1:7-8', seed: 1, hintsLeft: 3, levelCount: 24, stars: lettersLevelStars };

  it('takes one from the level’s 3 and saves at once; at 0 it stays at 0', () => {
    const { store } = withMaya();
    store.startRun('letters', 0, LB);
    expect([store.spendHint('letters', 0), store.spendHint('letters', 0), store.spendHint('letters', 0), store.spendHint('letters', 0)]).toEqual([2, 1, 0, 0]);
    expect(runOf(store.getState().players[0], 'letters', 0)!.hintsLeft).toBe(0);
  });

  it('a hint on a puzzle later swapped away stays spent but does not cap the stars', () => {
    const { store } = withMaya();
    store.startRun('letters', 0, LB);
    store.spendHint('letters', 0); // on puzzle 0
    store.swapPuzzle('letters', 0);
    const outs = [1, 2, 3, 4].map((p) => store.recordPuzzle('letters', 0, { puzzle: p, count: 0, usedHint: false, outOfTime: false }, LB));
    expect(outs[3]).toMatchObject({ kind: 'finished', stars: 3 });
    store.pickLevel('letters', 0, 24);
    expect(store.startRun('letters', 0, LB).hintsLeft).toBe(3); // a new run of the level starts with 3 again
  });

  it('is null for a run with no hint budget, or no run', () => {
    const { store } = withMaya();
    store.startRun('escape', 0, ESC());
    expect(store.spendHint('escape', 0)).toBeNull();
    expect(store.spendHint('escape', 9)).toBeNull();
  });
});

describe('pickLevel', () => {
  it('sets current and raises unlocked, locked levels too', () => {
    const { store } = withMaya();
    store.pickLevel('escape', 13, 31);
    const g = gameOf(store.getState().players[0], 'escape');
    expect(g.current).toBe(13);
    expect(g.unlocked).toBe(13);
    expect(currentLevel({ levelCount: 31, chapters: [] }, g)).toBe(13);
  });

  it('keeps an existing run of the picked level', () => {
    const { store } = withMaya();
    solve(store, 0, [0, 1, 2, 3]);
    solve(store, 1, [0, 1]);
    store.pickLevel('escape', 0, 31);
    store.pickLevel('escape', 1, 31);
    expect(solvedCount(store.getState().players[0], 'escape', 1)).toBe(2);
  });

  it('never lowers unlocked, and ignores levels outside the game', () => {
    const { store } = withMaya();
    store.pickLevel('escape', 20, 31);
    store.pickLevel('escape', 3, 31);
    expect(gameOf(store.getState().players[0], 'escape').unlocked).toBe(20);
    const before = store.getState();
    for (const level of [31, -1, 2.5, 1000]) store.pickLevel('escape', level, 31);
    expect(store.getState()).toBe(before);
  });
});

describe('resetGame', () => {
  it('empties that game for that child and leaves the other games and the stickers alone', () => {
    const { store } = withMaya();
    solve(store, 0, [0, 1, 2, 3]);
    solve(store, 1, [0]);
    store.pickLevel('escape', 5, 31);
    store.recordStars('drop', 0, 2);
    store.awardSticker('escape-ch1');
    store.resetGame('escape');
    const p = store.getState().players[0];
    expect(gameOf(p, 'escape')).toEqual({ unlocked: 0, stars: {}, best: {} });
    expect(gameOf(p, 'drop').stars[0]).toBe(2);
    expect(Object.keys(p.stickers)).toEqual(['escape-ch1']);
    expect(currentLevel({ levelCount: 31, chapters: [] }, gameOf(p, 'escape'))).toBe(0);
  });

  it('only touches the child named', () => {
    const { store } = withMaya();
    const leo = store.addPlayer({ name: 'Leo', ageBand: '3-4', color: 'orange' });
    store.recordStars('escape', 0, 3, leo.id);
    store.recordStars('escape', 0, 1);
    store.resetGame('escape', leo.id);
    const [maya, leoNow] = store.getState().players;
    expect(gameOf(maya, 'escape').stars[0]).toBe(1);
    expect(gameOf(leoNow, 'escape').stars).toEqual({});
  });

  it('a game never played changes nothing', () => {
    const { store } = withMaya();
    const before = store.getState();
    store.resetGame('letters');
    expect(store.getState()).toBe(before);
  });
});
