/**
 * Review cases for the kit's level reducer (six-games brief 3.1, 3.3, 10.1), added by the test review
 * next to levelRun.test.ts: the band frozen per puzzle across a band change mid-puzzle, keepSolved on a
 * band move against a version bump, keyed and unkeyed slips for stars and for the stuck count, the time
 * signal held, hidden and behind the card, 'ignored' solves mixed with saved ones, and the last puzzle
 * and the last level.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, type LevelRun, type PuzzleOutcome, type PuzzleResult } from '../../shared/progress';
import type { GameMeta } from '../meta';
import { SLIP_GAMES, STUCK, mathSet, mixerSet, numbersSet, sorterSet, type SlipGame } from '../run';
import {
  bandInit,
  configFor,
  dotsOf,
  initLevelRun,
  isTicking,
  levelRunReducer,
  offerShows,
  openingSeed,
  slotOf,
  solveResult,
  stuckLimit,
  type BandChange,
  type KitGame,
  type LevelRunAction,
  type LevelRunState,
  type OpenLevel,
} from './levelRun';

const NOW = new Date(2026, 10, 7, 9, 30).getTime();
const SEED = 5151;

const meta = (levelCount: number): GameMeta => ({ levelCount, chapters: [{ title: 'All levels', note: '', start: 0, count: levelCount }] });

function kitGame(over: Partial<KitGame<number>> = {}): KitGame<number> {
  return { id: 'mixer', meta: meta(9), title: 'Color Mixer', set: () => mixerSet(), seed: 'run', puzzle: (_level, n) => n, ...over };
}

const MIXER = kitGame();
const SORTER = kitGame({ id: 'sorter', title: 'Shape Sorter', set: () => sorterSet(), seed: 'fixed' });
const NUMBERS = kitGame({ id: 'numbers', meta: meta(12), title: 'Number Line-up', set: (b) => numbersSet(b), keepSolved: true, hints: true });
const MATH = kitGame({ id: 'math', meta: meta(12), title: 'Brick Calculator', set: (b) => mathSet(b), keepSolved: true });

const GAME_FOR: Record<SlipGame, KitGame<number>> = {
  mixer: MIXER,
  sorter: SORTER,
  numbers: NUMBERS,
  pattern: kitGame({ id: 'pattern', meta: meta(12), set: () => 'pattern:1' }),
  math: MATH,
  builder: kitGame({ id: 'builder', meta: meta(12), set: () => 'builder:1', seed: 'fixed' }),
};

function open(game: KitGame<number> = MIXER, o: Partial<OpenLevel> = {}): LevelRunState {
  return initLevelRun({ game, level: 0, band: '5-6', stored: null, now: NOW, newSeed: () => SEED, ...o });
}

const act = (s: LevelRunState, ...actions: LevelRunAction[]): LevelRunState => actions.reduce(levelRunReducer, s);

const slip = (key?: string): LevelRunAction => (key === undefined ? { type: 'slip' } : { type: 'slip', key });
const slips = (n: number, key?: string): LevelRunAction[] => Array.from({ length: n }, () => slip(key));
const tick = (seconds: number): LevelRunAction => ({ type: 'tick', seconds });
const hold = (on: boolean): LevelRunAction => ({ type: 'hold', on });
const visible = (on: boolean): LevelRunAction => ({ type: 'visible', on });
const PROGRESS: LevelRunAction = { type: 'progress' };
const IGNORED: PuzzleOutcome = { kind: 'ignored' };
const SOLVE_IN_MEMORY: LevelRunAction = { type: 'solve', outcome: IGNORED };
const NEXT: LevelRunAction = { type: 'next' };
const SWAP_IN_MEMORY: LevelRunAction = { type: 'swap', run: null };
const HINT_IN_MEMORY: LevelRunAction = { type: 'hint', left: null };
const OPEN_CARD: LevelRunAction = { type: 'card', to: 'open' };
const CLOSE_CARD: LevelRunAction = { type: 'card', to: 'closed' };
const moveTo = (band: BandChange['band']): BandChange => ({ band, run: null, now: NOW });

/** What the store answers for a solve that does not finish the level. */
function saved(s: LevelRunState): LevelRunAction {
  const r = solveResult(s);
  const run: LevelRun = { ...s.run, queue: s.run.queue.filter((n) => n !== r.puzzle), solved: [...s.run.solved, r], updatedAt: NOW };
  return { type: 'solve', outcome: { kind: 'saved', run } };
}

/** What the store answers for the solve that finishes the level. */
function finished(s: LevelRunState, stars: number, next: number | null): LevelRunAction {
  return { type: 'solve', outcome: { kind: 'finished', level: s.cfg.level, stars, results: [...s.run.solved, solveResult(s)], next } };
}

function storedRun(set: string, seed: number, solvedCount: number, extra: Partial<LevelRun> = {}): LevelRun {
  const solved: PuzzleResult[] = Array.from({ length: solvedCount }, (_, i) => ({ puzzle: i, count: 0, usedHint: false, outOfTime: false }));
  return { set, seed, queue: [0, 1, 2, 3, 4, 5].slice(solvedCount), solved, updatedAt: NOW - 1000, ...extra };
}

/** Plays one puzzle per entry, in memory: the slips given, then a solve, then Next (but not after the last). */
function playLevel(s: LevelRunState, perPuzzle: LevelRunAction[][]): LevelRunState {
  let out = s;
  perPuzzle.forEach((actions, i) => {
    out = act(out, ...actions, SOLVE_IN_MEMORY);
    if (i < perPuzzle.length - 1) out = act(out, NEXT);
  });
  return out;
}

const CLEAN: LevelRunAction[][] = [[], [], [], []];

describe('review: the band frozen per puzzle across a band change mid-puzzle', () => {
  it('keeps the time limit the puzzle started with until Next, then counts to the new band’s', () => {
    // Mixer ages 3 to 4 offers at 30 s; a grown-up has moved the child to 9 to 10 (60 s)
    const s = open(MIXER, { band: '3-4' });
    expect(bandInit(s, '9-10')).not.toBeNull();
    expect(offerShows(act(s, tick(29)))).toBe(false);
    expect(offerShows(act(s, tick(30)))).toBe(true);
    const next = act(s, SOLVE_IN_MEMORY, { type: 'next', band: moveTo('9-10') });
    expect(offerShows(act(next, tick(59)))).toBe(false);
    expect(offerShows(act(next, tick(60)))).toBe(true);
  });

  it('keeps the band through everything that happens on the puzzle, a stored run that moved on included', () => {
    const s0 = open(NUMBERS, { band: '3-4' });
    const s = act(s0, slip('a'), PROGRESS, HINT_IN_MEMORY, hold(true), hold(false), visible(false), visible(true), tick(5), {
      type: 'stored',
      run: storedRun(numbersSet('3-4'), SEED, 1, { hintsLeft: 2 }),
    });
    expect(s.band).toBe('3-4');
    expect(stuckLimit(s)).toEqual(STUCK.numbers['3-4']);
  });

  it('a band changed and changed back before Next moves nothing', () => {
    const solved = act(open(NUMBERS, { band: '7-8' }), SOLVE_IN_MEMORY);
    // the live band is the one on screen again, so the hook passes no band change
    expect(bandInit(solved, '7-8')).toBeNull();
    const s = act(solved, NEXT);
    expect(s.band).toBe('7-8');
    expect(s.run).toBe(solved.run);
    expect(s.run.set).toBe('numbers:1:7-8');
  });

  it('a keepSolved band move at Next keeps the queue order a swap left, the solved puzzle, its hint mark and the budget', () => {
    let s = act(open(NUMBERS), ...slips(3), SWAP_IN_MEMORY, HINT_IN_MEMORY, SOLVE_IN_MEMORY);
    expect(s.run.queue).toEqual([2, 3, 4, 5, 0]);
    s = act(s, { type: 'next', band: moveTo('9-10') });
    expect(s.band).toBe('9-10');
    expect(s.run.set).toBe('numbers:1:9-10');
    expect(s.run.seed).toBe(SEED);
    expect(s.run.queue).toEqual([2, 3, 4, 5, 0]);
    expect(s.puzzleNo).toBe(2);
    expect(s.run.solved).toEqual([{ puzzle: 1, count: 0, usedHint: true, outOfTime: false }]);
    expect(s.hintsLeft).toBe(2);
    expect(dotsOf(s)).toEqual({ solved: 1, at: 2 });
  });

  it('two band moves in a row keep every solved puzzle and the seed', () => {
    let s = open(MATH, { band: '3-4' });
    s = act(s, SOLVE_IN_MEMORY, { type: 'next', band: moveTo('5-6') });
    s = act(s, SOLVE_IN_MEMORY, { type: 'next', band: moveTo('9-10') });
    expect(s.run).toMatchObject({ set: 'math:1:9-10', seed: SEED, queue: [2, 3, 4, 5] });
    expect(s.run.solved.map((r) => r.puzzle)).toEqual([0, 1]);
    expect(stuckLimit(s)).toEqual(STUCK.math['9-10']);
  });

  it('a band move on a swap resets both signals and counts to the new band’s limits', () => {
    // Number Line-up ages 5 to 6: 3 slips; ages 9 to 10: 4 slips and 90 s
    const s = act(open(NUMBERS), ...slips(3), tick(50), { type: 'swap', run: null, band: moveTo('9-10') });
    expect(s.stuck.count).toBe(0);
    expect(s.stuck.seconds).toBe(0);
    expect(offerShows(act(s, ...slips(3)))).toBe(false);
    expect(offerShows(act(s, ...slips(4)))).toBe(true);
    expect(offerShows(act(s, tick(89)))).toBe(false);
    expect(offerShows(act(s, tick(90)))).toBe(true);
  });
});

describe('review: keepSolved on a band move against a version bump', () => {
  it('a band-dependent set without keepSolved gets a new seed on another band, and keeps it on the same band', () => {
    const banded = configFor(kitGame({ id: 'pattern', set: (b) => `pattern:1:${b}` }), 0);
    expect(openingSeed(banded, '7-8', storedRun('pattern:1:5-6', 77, 2), () => 9)).toBe(9);
    expect(openingSeed(banded, '5-6', storedRun('pattern:1:5-6', 77, 2), () => 9)).toBe(77);
  });

  it('a band-dependent set without keepSolved opens on another band at puzzle 1, its solved puzzles gone', () => {
    const banded = kitGame({ id: 'pattern', set: (b) => `pattern:1:${b}` });
    const s = open(banded, { band: '7-8', stored: storedRun('pattern:1:5-6', 77, 2) });
    expect(s.run).toMatchObject({ set: 'pattern:1:7-8', seed: SEED, queue: [0, 1, 2, 3, 4, 5], solved: [] });
    expect(s.puzzleNo).toBe(0);
  });

  it('a fixed-seed keepSolved game keeps its solved puzzles on a band move and restarts on a version bump, seed 0 both ways', () => {
    const fixed = kitGame({ id: 'math', meta: meta(12), set: (b) => mathSet(b), keepSolved: true, seed: 'fixed' });
    const fixedV2 = kitGame({ id: 'math', meta: meta(12), set: (b) => mathSet(b, 2), keepSolved: true, seed: 'fixed' });
    const stored = storedRun('math:1:3-4', 0, 2);
    const newSeed = () => {
      throw new Error('a fixed game never asks for a seed');
    };
    const moved = open(fixed, { band: '9-10', stored, newSeed });
    expect(moved.run).toMatchObject({ set: 'math:1:9-10', seed: 0, queue: [2, 3, 4, 5] });
    expect(moved.run.solved).toHaveLength(2);
    const bumped = open(fixedV2, { band: '9-10', stored, newSeed });
    expect(bumped.run).toMatchObject({ set: 'math:2:9-10', seed: 0, queue: [0, 1, 2, 3, 4, 5], solved: [] });
  });

  it('a keepSolved game whose set has no band part restarts on a version bump: it is never read as a band move', () => {
    const v2 = kitGame({ id: 'math', set: () => 'math:2', keepSolved: true });
    const s = open(v2, { stored: storedRun('math:1', 77, 3) });
    expect(s.run).toMatchObject({ set: 'math:2', seed: SEED, queue: [0, 1, 2, 3, 4, 5], solved: [] });
    expect(openingSeed(configFor(v2, 0), '5-6', storedRun('math:1', 77, 3), () => 9)).toBe(9);
  });

  it('a keepSolved band move with the store’s answer takes the store’s run, solved puzzles and all', () => {
    const solved = act(open(NUMBERS), HINT_IN_MEMORY, SOLVE_IN_MEMORY);
    const fromStore: LevelRun = { ...solved.run, set: numbersSet('3-4'), hintsLeft: 2, updatedAt: NOW + 9 };
    const s = act(solved, { type: 'next', band: { band: '3-4', run: fromStore, now: NOW } });
    expect(s.run).toBe(fromStore);
    expect(s.band).toBe('3-4');
    expect(s.hintsLeft).toBe(2);
  });
});

describe('review: keyed and unkeyed slips, for stars and for the stuck count', () => {
  it('for every kit game and band, one key repeated up to the stuck limit is one star slip and shows the offer', () => {
    for (const id of SLIP_GAMES) {
      for (const band of AGE_BANDS) {
        const limit = STUCK[id][band].count;
        const s = act(open(GAME_FOR[id], { band }), ...slips(limit, 'same'));
        expect(s.stuck.count, `${id} ${band}`).toBe(limit);
        expect(offerShows(s), `${id} ${band}`).toBe(true);
        expect(solveResult(s).count, `${id} ${band}`).toBe(1);
      }
    }
  });

  it('for every kit game and band, unkeyed slips count the same for stars as for the stuck signal', () => {
    for (const id of SLIP_GAMES) {
      for (const band of AGE_BANDS) {
        const limit = STUCK[id][band].count;
        const below = act(open(GAME_FOR[id], { band }), ...slips(limit - 1));
        expect(offerShows(below), `${id} ${band}`).toBe(false);
        expect(solveResult(below).count, `${id} ${band}`).toBe(limit - 1);
        const at = act(below, slip());
        expect(offerShows(at), `${id} ${band}`).toBe(true);
        expect(solveResult(at).count, `${id} ${band}`).toBe(limit);
      }
    }
  });

  it('slips past the offer keep counting for stars', () => {
    expect(solveResult(act(open(), ...slips(6))).count).toBe(6);
    expect(solveResult(act(open(), slip('a'), slip('b'), slip('a'), slip('c'), slip('d'))).count).toBe(4);
  });

  it('a key counts once per puzzle: the same key on every puzzle is one slip on each', () => {
    const s = playLevel(open(), [[slip('a'), slip('a'), slip('a')], [slip('a')], [slip('a'), slip('a')], [slip('a')]]);
    expect(s.finish!.results.map((r) => r.count)).toEqual([1, 1, 1, 1]);
    // 4 slips: 2 stars
    expect(s.finish!.stars).toBe(2);
  });

  it('the stars follow star slips, not stuck counts: repeated keys keep a level at 3 stars where unkeyed taps drop it to 1', () => {
    const keyed = playLevel(open(), [[...slips(5, 'k')], [], [], []]);
    expect(keyed.finish).toMatchObject({ stars: 3 });
    const unkeyed = playLevel(open(), [[...slips(5)], [], [], []]);
    expect(unkeyed.finish).toMatchObject({ stars: 1 });
  });

  it('Number Line-up’s unkeyed backward swaps: 1 over the level is 3 stars, 2 is 2 stars, 5 is 1 star', () => {
    const stars = (perPuzzle: number[]) => playLevel(open(NUMBERS), perPuzzle.map((n) => slips(n))).finish!.stars;
    expect(stars([1, 0, 0, 0])).toBe(3);
    expect(stars([0, 1, 0, 1])).toBe(2);
    expect(stars([1, 1, 1, 1])).toBe(2);
    expect(stars([2, 1, 1, 1])).toBe(1);
  });
});

describe('review: the time signal, held, hidden and behind the card', () => {
  it('a page hidden while held needs both to clear before time counts again, and keeps the seconds already counted', () => {
    const s = act(open(), tick(10), hold(true), visible(false));
    expect(isTicking(s)).toBe(false);
    expect(isTicking(act(s, visible(true)))).toBe(false);
    expect(isTicking(act(s, hold(false)))).toBe(false);
    const back = act(s, visible(true), hold(false));
    expect(isTicking(back)).toBe(true);
    expect(back.stuck.seconds).toBe(10);
    expect(offerShows(act(back, tick(29)))).toBe(false);
    expect(offerShows(act(back, tick(30)))).toBe(true);
  });

  it('a hold lasts until the game lets it go, across Next and a swap too', () => {
    const afterNext = act(open(), hold(true), SOLVE_IN_MEMORY, NEXT);
    expect(isTicking(afterNext)).toBe(false);
    expect(levelRunReducer(afterNext, tick(100))).toBe(afterNext);
    expect(isTicking(act(afterNext, hold(false)))).toBe(true);
    const afterSwap = act(open(), ...slips(3), hold(true), SWAP_IN_MEMORY);
    expect(isTicking(afterSwap)).toBe(false);
    expect(offerShows(act(afterSwap, tick(100)))).toBe(false);
  });

  it('a page hidden across Next keeps the new puzzle’s clock at 0 until it shows', () => {
    const s = act(open(), tick(30), SOLVE_IN_MEMORY, visible(false), NEXT);
    expect(s.stuck.seconds).toBe(0);
    expect(isTicking(s)).toBe(false);
    expect(levelRunReducer(s, tick(100))).toBe(s);
    const shown = act(s, visible(true));
    expect(offerShows(act(shown, tick(39)))).toBe(false);
    expect(offerShows(act(shown, tick(40)))).toBe(true);
  });

  it('the hold and the page can change behind the level card, and time still never counts', () => {
    const done = act(playLevel(open(), CLEAN), OPEN_CARD);
    const shuffled = act(done, visible(false), visible(true), hold(true), hold(false));
    expect(isTicking(shuffled)).toBe(false);
    expect(levelRunReducer(shuffled, tick(100))).toBe(shuffled);
    const closed = act(shuffled, CLOSE_CARD);
    expect(isTicking(closed)).toBe(false);
    expect(levelRunReducer(closed, tick(100))).toBe(closed);
  });

  it('a slip resets no clock: the time signal reaches its limit through slips below the count limit', () => {
    // Mixer ages 5 to 6: 3 slips or 40 s
    const s = act(open(), tick(20), slip(), tick(19), slip());
    expect(offerShows(s)).toBe(false);
    expect(offerShows(act(s, tick(1)))).toBe(true);
  });

  it('an offer the time signal raised stays up through slips and more seconds until progress', () => {
    const up = act(open(), tick(40));
    expect(offerShows(up)).toBe(true);
    expect(offerShows(act(up, slip(), tick(100)))).toBe(true);
    expect(offerShows(act(up, slip(), tick(100), PROGRESS))).toBe(false);
  });
});

describe('review: ignored solves (no player to save to)', () => {
  it('a player removed mid-level: saved solves then ignored ones still finish the level, with all four results', () => {
    let s = open();
    s = act(s, slip());
    s = act(s, saved(s), NEXT);
    s = act(s, saved(s), NEXT);
    // the store stops answering: the rest goes on in memory
    s = act(s, slip('a'), slip('a'), SOLVE_IN_MEMORY, NEXT, SOLVE_IN_MEMORY);
    expect(s.phase).toBe('done');
    expect(s.finish!.results.map((r) => [r.puzzle, r.count])).toEqual([
      [0, 1],
      [1, 0],
      [2, 1],
      [3, 0],
    ]);
    // 2 slips: 2 stars
    expect(s.finish).toMatchObject({ stars: 2, next: 1 });
    expect(s.card).toBe('waiting');
  });

  it('an ignored solve keeps the star slips and the hint mark in the result it remembers', () => {
    const s = act(open(NUMBERS), slip('a'), slip('a'), slip(), HINT_IN_MEMORY, SOLVE_IN_MEMORY);
    expect(s.run.solved).toEqual([{ puzzle: 0, count: 2, usedHint: true, outOfTime: false }]);
    expect(s.hintsLeft).toBe(2);
  });

  it('after an ignored solve, a swap rotates the remembered queue without the solved puzzle', () => {
    const s = act(open(), SOLVE_IN_MEMORY, NEXT, SWAP_IN_MEMORY);
    expect(s.run.queue).toEqual([2, 3, 4, 5, 1]);
    expect(s.puzzleNo).toBe(2);
    expect(dotsOf(s)).toEqual({ solved: 1, at: 2 });
  });

  it('a one-level game finished in memory has no next level', () => {
    const s = playLevel(open(kitGame({ meta: meta(1) })), CLEAN);
    expect(s.finish).toMatchObject({ next: null, stars: 3 });
    expect(slotOf(act(s, OPEN_CARD, CLOSE_CARD))).toBe('home');
  });
});

describe('review: the last puzzle and the last level', () => {
  it('on the last dot, swaps go round the three unsolved puzzles, the dots stay on 4, and a solve ends the level', () => {
    let s = act(playLevel(open(), [[], [], []]), NEXT);
    expect(s.run.queue).toEqual([3, 4, 5]);
    const seen = [s.puzzleNo];
    for (let i = 0; i < 3; i++) {
      s = act(s, ...slips(3), SWAP_IN_MEMORY);
      seen.push(s.puzzleNo);
      expect(dotsOf(s)).toEqual({ solved: 3, at: 4 });
    }
    expect(seen).toEqual([3, 4, 5, 3]);
    s = act(s, SWAP_IN_MEMORY, SOLVE_IN_MEMORY);
    expect(s.phase).toBe('done');
    expect(s.finish!.results.map((r) => r.puzzle)).toEqual([0, 1, 2, 4]);
    expect(dotsOf(s)).toEqual({ solved: 4, at: 4 });
  });

  it('the store’s word on the next level is final: none left on a middle level leaves Back to games', () => {
    let s = act(playLevel(open(MIXER, { level: 4 }), [[], [], []]), NEXT);
    s = act(s, finished(s, 3, null));
    expect(s.finish).toMatchObject({ next: null, stars: 3 });
    expect(slotOf(act(s, OPEN_CARD, CLOSE_CARD))).toBe('home');
  });

  it('the store’s word on the next level is final: the last level can send the child back to an earlier one with no stars', () => {
    let s = act(playLevel(open(MIXER, { level: 8 }), [[], [], []]), NEXT);
    s = act(s, finished(s, 2, 3));
    expect(s.finish).toMatchObject({ next: 3, stars: 2 });
    expect(slotOf(act(s, OPEN_CARD, CLOSE_CARD))).toBe('play');
  });

  it('a finish the store reports before the fourth solve here (another tab solved one) ends the level', () => {
    let s = open();
    s = act(s, saved(s), NEXT);
    s = act(s, saved(s), NEXT);
    const results: PuzzleResult[] = [...s.run.solved, { puzzle: 5, count: 0, usedHint: false, outOfTime: false }, solveResult(s)];
    s = act(s, { type: 'solve', outcome: { kind: 'finished', level: 0, stars: 3, results, next: 1 } });
    expect(s.phase).toBe('done');
    expect(s.finish).toEqual({ stars: 3, next: 1, results });
    expect(dotsOf(s)).toEqual({ solved: 4, at: 4 });
    expect(s.card).toBe('waiting');
  });

  it('after the fourth solve no shared line shows, even with the offer up when the puzzle was solved', () => {
    let s = act(playLevel(open(), [[], [], []]), NEXT, ...slips(3));
    expect(offerShows(s)).toBe(true);
    s = act(s, SOLVE_IN_MEMORY);
    expect(offerShows(s)).toBe(false);
    expect(slotOf(s)).toBe('empty');
  });
});
