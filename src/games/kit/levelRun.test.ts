/**
 * The kit's level reducer (six-games brief 3.1, 10.1): one level of a kit game from its start to the
 * level card. Opening and resuming, the band frozen per puzzle (D2), slips and their keys, the stuck
 * signals through STUCK, the time signal and what stops it, the shared help line, swap, solve, next,
 * the hint budget, the level's end and its card, and the 'ignored' path with no player.
 *
 * The reducer is pure; time comes in only as tick actions and `now` values. The last block plays
 * levels against the real progress store (in-memory storage, a fixed clock) the way useLevelRun calls it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AGE_BANDS,
  createProgressStore,
  gameOf,
  runOf,
  type AgeBand,
  type KeyValueStorage,
  type LevelRun,
  type PuzzleOutcome,
  type PuzzleResult,
  type PuzzleRules,
} from '../../shared/progress';
import type { GameMeta } from '../meta';
import { SLIP_GAMES, STUCK, STUCK_START, levelStars, mathSet, mixerSet, numbersSet, sorterSet, type SlipGame } from '../run';
import {
  bandInit,
  configFor,
  dotsOf,
  initLevelRun,
  isTicking,
  levelRunReducer,
  offerShows,
  openingSeed,
  randomSeed,
  runInit,
  sharedLine,
  slotOf,
  solveResult,
  stuckLimit,
  type KitGame,
  type LevelRunAction,
  type LevelRunState,
  type OpenLevel,
} from './levelRun';

const NOW = new Date(2026, 10, 6, 12, 0).getTime();
const SEED = 4242;

const meta = (levelCount: number): GameMeta => ({ levelCount, chapters: [{ title: 'All levels', note: '', start: 0, count: levelCount }] });

/** A stand-in kit game: its puzzle is just the puzzle number, so tests can see which one is on screen. */
function kitGame(over: Partial<KitGame<number>> = {}): KitGame<number> {
  return { id: 'mixer', meta: meta(9), title: 'Color Mixer', set: () => mixerSet(), seed: 'run', puzzle: (_level, n) => n, ...over };
}

const MIXER = kitGame();
const SORTER = kitGame({ id: 'sorter', title: 'Shape Sorter', set: () => sorterSet(), seed: 'fixed' });
const NUMBERS = kitGame({ id: 'numbers', meta: meta(12), title: 'Number Line-up', set: (b) => numbersSet(b), keepSolved: true, hints: true });
const MATH = kitGame({ id: 'math', meta: meta(12), title: 'Brick Calculator', set: (b) => mathSet(b), keepSolved: true });

/** The kit game for each of the six ids, with the band-dependent sets where the brief has them. */
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

const IGNORED: PuzzleOutcome = { kind: 'ignored' };
const slip = (key?: string): LevelRunAction => (key === undefined ? { type: 'slip' } : { type: 'slip', key });
const tick = (seconds: number): LevelRunAction => ({ type: 'tick', seconds });
const PROGRESS: LevelRunAction = { type: 'progress' };
const SOLVE_IN_MEMORY: LevelRunAction = { type: 'solve', outcome: IGNORED };
const NEXT: LevelRunAction = { type: 'next' };
const SWAP_IN_MEMORY: LevelRunAction = { type: 'swap', run: null };
const HINT_IN_MEMORY: LevelRunAction = { type: 'hint', left: null };
const slips = (n: number, key?: string): LevelRunAction[] => Array.from({ length: n }, () => slip(key));

/** What the store saves for a solve that does not finish the level: the puzzle leaves the queue and joins `solved`. */
function savedOutcome(s: LevelRunState): PuzzleOutcome {
  const r = solveResult(s);
  return { kind: 'saved', run: { ...s.run, queue: s.run.queue.filter((n) => n !== r.puzzle), solved: [...s.run.solved, r], updatedAt: NOW } };
}

/** Solve the puzzle on screen and go on to the next one, in memory. */
const solveAndNext = (s: LevelRunState) => act(s, SOLVE_IN_MEMORY, NEXT);

/** Plays `n` puzzles in memory, each solved cleanly. */
function solveClean(s: LevelRunState, n: number): LevelRunState {
  let out = s;
  for (let i = 0; i < n; i++) out = i < n - 1 ? solveAndNext(out) : act(out, SOLVE_IN_MEMORY);
  return out;
}

/** A stored run for level tests: the first `solvedCount` puzzles solved, the rest in order. */
function storedRun(set: string, seed: number, solvedCount: number, extra: Partial<LevelRun> = {}): LevelRun {
  const solved: PuzzleResult[] = Array.from({ length: solvedCount }, (_, i) => ({ puzzle: i, count: 0, usedHint: false, outOfTime: false }));
  return { set, seed, queue: [0, 1, 2, 3, 4, 5].slice(solvedCount), solved, updatedAt: NOW - 1000, ...extra };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a level opens', () => {
  it('a new run starts at puzzle 1 with nothing solved, Level 1 of the game', () => {
    const s = open();
    expect(s.phase).toBe('play');
    expect(s.puzzleNo).toBe(0);
    expect(s.run).toMatchObject({ set: 'mixer:1', seed: SEED, queue: [0, 1, 2, 3, 4, 5], solved: [] });
    expect(dotsOf(s)).toEqual({ solved: 0, at: 1 });
    expect(s.round).toBe(0);
    expect(s.slips).toBe(0);
    expect(offerShows(s)).toBe(false);
    expect(sharedLine(s)).toBeNull();
    expect(slotOf(s)).toBe('controls');
    expect(s.finish).toBeNull();
    expect(s.card).toBeNull();
    expect(isTicking(s)).toBe(true);
  });

  it('a stored run resumes at its next unsolved puzzle, with its seed and solved puzzles', () => {
    const stored = { ...storedRun('mixer:1', 77, 2), queue: [4, 5, 2, 3] };
    const s = open(MIXER, { stored });
    expect(s.puzzleNo).toBe(4);
    expect(s.run.seed).toBe(77);
    expect(s.run.solved).toHaveLength(2);
    expect(dotsOf(s)).toEqual({ solved: 2, at: 3 });
  });

  it('a stored run with three solved puzzles opens on the last dot', () => {
    const s = open(MIXER, { stored: storedRun('mixer:1', 77, 3) });
    expect(s.puzzleNo).toBe(3);
    expect(dotsOf(s)).toEqual({ solved: 3, at: 4 });
  });

  it('a fixed game always plays seed 0 and never asks for a new seed', () => {
    const newSeed = vi.fn(() => SEED);
    expect(open(SORTER, { newSeed }).run.seed).toBe(0);
    expect(open(SORTER, { newSeed, stored: storedRun('sorter:1', 0, 1) }).run.seed).toBe(0);
    expect(newSeed).not.toHaveBeenCalled();
  });

  it('a stored run on another set (a raised version) starts the level again with a new seed', () => {
    const s = open(MIXER, { stored: storedRun('mixer:0', 77, 2) });
    expect(s.run).toMatchObject({ set: 'mixer:1', seed: SEED, queue: [0, 1, 2, 3, 4, 5], solved: [] });
    expect(s.puzzleNo).toBe(0);
  });

  it('keepSolved: a stored run on another band keeps its solved puzzles, queue, seed and hints', () => {
    const stored = storedRun('numbers:1:3-4', 77, 2, { hintsLeft: 1 });
    const s = open(NUMBERS, { band: '7-8', stored });
    expect(s.run).toMatchObject({ set: 'numbers:1:7-8', seed: 77, queue: [2, 3, 4, 5] });
    expect(s.run.solved).toHaveLength(2);
    expect(s.hintsLeft).toBe(1);
    expect(s.band).toBe('7-8');
  });

  it('gives a hint game 3 hints for a new level, and a game without hints none', () => {
    const numbers = open(NUMBERS);
    expect(numbers.hintsLeft).toBe(3);
    expect(numbers.run.hintsLeft).toBe(3);
    const mixer = open(MIXER);
    expect(mixer.hintsLeft).toBe(0);
    expect(mixer.run.hintsLeft).toBeUndefined();
  });

  it('opens with the page hidden: no time counts until it shows', () => {
    const s = open(MIXER, { visible: false });
    expect(isTicking(s)).toBe(false);
    expect(levelRunReducer(s, tick(5))).toBe(s);
    expect(isTicking(act(s, { type: 'visible', on: true }))).toBe(true);
  });

  it('reads the level count and the flags from the game', () => {
    expect(configFor(NUMBERS, 8)).toMatchObject({ game: 'numbers', level: 8, levelCount: 12, seed: 'run', keepSolved: true, hints: true });
    expect(configFor(SORTER, 0)).toMatchObject({ game: 'sorter', level: 0, levelCount: 9, seed: 'fixed', keepSolved: false, hints: false });
  });

  it('passes the store the set, the seed, the hint budget and keepSolved only when the game has them', () => {
    expect(runInit(configFor(NUMBERS, 0), '9-10', 9)).toEqual({ set: 'numbers:1:9-10', seed: 9, hintsLeft: 3, keepSolved: true });
    expect(runInit(configFor(MIXER, 0), '9-10', 9)).toEqual({ set: 'mixer:1', seed: 9 });
    expect(runInit(configFor(SORTER, 0), '3-4', 9)).toEqual({ set: 'sorter:1', seed: 0 });
  });
});

describe('the opening seed', () => {
  const mixer = configFor(MIXER, 0);
  const numbers = configFor(NUMBERS, 0);
  const sorter = configFor(SORTER, 0);

  it('is 0 for a fixed game', () => {
    expect(openingSeed(sorter, '5-6', null, () => 9)).toBe(0);
  });

  it('is a new seed for a run game with no stored run, or a stored run that restarts', () => {
    expect(openingSeed(mixer, '5-6', null, () => 9)).toBe(9);
    expect(openingSeed(mixer, '5-6', storedRun('mixer:0', 77, 1), () => 9)).toBe(9);
  });

  it('keeps the stored seed when the run continues, on the same set or a keepSolved band move', () => {
    expect(openingSeed(mixer, '5-6', storedRun('mixer:1', 77, 1), () => 9)).toBe(77);
    expect(openingSeed(numbers, '9-10', storedRun('numbers:1:3-4', 77, 1), () => 9)).toBe(77);
  });

  it('makes seeds the store accepts: whole numbers from 0 up to 2^31', () => {
    for (const r of [0, 0.5, 0.999999999]) {
      vi.spyOn(Math, 'random').mockReturnValue(r);
      const seed = randomSeed();
      expect(Number.isInteger(seed), `${r}`).toBe(true);
      expect(seed, `${r}`).toBeGreaterThanOrEqual(0);
      expect(seed, `${r}`).toBeLessThan(2 ** 31);
    }
  });
});

describe('the band, frozen for the puzzle on screen (D2)', () => {
  it('keeps the band the puzzle started with, and its STUCK row, whatever the child’s band is now', () => {
    const s = open(MIXER, { band: '3-4' });
    expect(bandInit(s, '9-10')).not.toBeNull();
    // ages 3 to 4 offer at 3 slips; ages 9 to 10 would wait for 4
    expect(stuckLimit(s)).toEqual(STUCK.mixer['3-4']);
    expect(offerShows(act(s, ...slips(3)))).toBe(true);
    expect(act(s, ...slips(3)).band).toBe('3-4');
  });

  it('asks for nothing when the band is unchanged or unknown', () => {
    const s = open(NUMBERS);
    expect(bandInit(s, '5-6')).toBeNull();
    expect(bandInit(s, null)).toBeNull();
    expect(bandInit(s, undefined)).toBeNull();
  });

  it('names the new band’s set and keeps the run’s seed for the next puzzle', () => {
    const s = open(NUMBERS);
    expect(bandInit(s, '7-8')).toEqual({ set: 'numbers:1:7-8', seed: SEED, hintsLeft: 3, keepSolved: true });
  });

  it('applies a new band from the next puzzle: keepSolved keeps the solved puzzles and the seed', () => {
    const solved = act(open(NUMBERS), SOLVE_IN_MEMORY);
    const s = act(solved, { type: 'next', band: { band: '7-8', run: null, now: NOW } });
    expect(s.band).toBe('7-8');
    expect(s.run).toMatchObject({ set: 'numbers:1:7-8', seed: SEED, queue: [1, 2, 3, 4, 5] });
    expect(s.run.solved).toHaveLength(1);
    expect(s.puzzleNo).toBe(1);
    expect(dotsOf(s)).toEqual({ solved: 1, at: 2 });
    expect(stuckLimit(s)).toEqual(STUCK.numbers['7-8']);
  });

  it('takes the run the store saved for the new band when there is one', () => {
    const solved = act(open(MATH), SOLVE_IN_MEMORY);
    const fromStore = { ...solved.run, set: 'math:1:9-10', updatedAt: NOW + 5 };
    const s = act(solved, { type: 'next', band: { band: '9-10', run: fromStore, now: NOW } });
    expect(s.run).toBe(fromStore);
    expect(s.band).toBe('9-10');
  });

  it('moves the band for a game whose puzzles do not depend on it: same run, the new STUCK row', () => {
    const solved = act(open(MIXER, { band: '3-4' }), SOLVE_IN_MEMORY);
    const s = act(solved, { type: 'next', band: { band: '9-10', run: null, now: NOW } });
    expect(s.band).toBe('9-10');
    expect(s.run.set).toBe('mixer:1');
    expect(s.run.solved).toHaveLength(1);
    expect(stuckLimit(s)).toEqual({ count: 4, seconds: 60 });
    expect(offerShows(act(s, ...slips(3)))).toBe(false);
    expect(offerShows(act(s, ...slips(4)))).toBe(true);
  });

  it('a swap is a puzzle boundary too: the swapped-in puzzle gets the new band', () => {
    const s = act(open(NUMBERS), ...slips(3), { type: 'swap', run: null, band: { band: '9-10', run: null, now: NOW } });
    expect(s.band).toBe('9-10');
    expect(s.run.set).toBe('numbers:1:9-10');
    expect(s.puzzleNo).toBe(1);
  });

  it('a band given with Next that matches the one on screen changes nothing but the puzzle', () => {
    const solved = act(open(NUMBERS), SOLVE_IN_MEMORY);
    const s = act(solved, { type: 'next', band: { band: '5-6', run: null, now: NOW } });
    expect(s.run).toBe(solved.run);
    expect(s.band).toBe('5-6');
  });

  it('a game whose set depends on the band without keepSolved starts the level again on a band change', () => {
    const banded = kitGame({ id: 'pattern', set: (b) => `pattern:1:${b}` });
    const solved = act(open(banded), SOLVE_IN_MEMORY);
    const s = act(solved, { type: 'next', band: { band: '7-8', run: null, now: NOW } });
    expect(s.run).toMatchObject({ set: 'pattern:1:7-8', queue: [0, 1, 2, 3, 4, 5], solved: [] });
    expect(dotsOf(s)).toEqual({ solved: 0, at: 1 });
  });
});

describe('slips', () => {
  it('a slip with no key counts every time, for stars and for the stuck count', () => {
    const s = act(open(), slip(), slip());
    expect(s.slips).toBe(2);
    expect(s.stuck.count).toBe(2);
  });

  it('a key given again on the same puzzle adds no star slip, but still feeds the stuck count', () => {
    const s = act(open(), slip('red+blue'), slip('red+blue'), slip('red+blue'));
    expect(s.slips).toBe(1);
    expect(s.stuck.count).toBe(3);
    expect(offerShows(s)).toBe(true);
  });

  it('different keys each count once', () => {
    const s = act(open(), slip('a'), slip('b'), slip('a'), slip('b'), slip('c'));
    expect(s.slips).toBe(3);
    expect(s.stuck.count).toBe(5);
  });

  it('keyed and unkeyed slips mix: only a repeated key is free', () => {
    expect(act(open(), slip('a'), slip(), slip('a'), slip()).slips).toBe(3);
  });

  it('an empty key is still a key', () => {
    expect(act(open(), slip(''), slip('')).slips).toBe(1);
  });

  it('a new puzzle starts with no slips and forgets the keys, after Next and after a swap', () => {
    const afterNext = act(open(), slip('a'), SOLVE_IN_MEMORY, NEXT);
    expect(afterNext.slips).toBe(0);
    expect(act(afterNext, slip('a')).slips).toBe(1);
    const afterSwap = act(open(), slip('a'), SWAP_IN_MEMORY);
    expect(afterSwap.slips).toBe(0);
    expect(act(afterSwap, slip('a')).slips).toBe(1);
  });

  it('the solve records the star slips in count, never out of time', () => {
    const s = act(open(), slip('a'), slip('a'), slip('b'));
    expect(solveResult(s)).toEqual({ puzzle: 0, count: 2, usedHint: false, outOfTime: false });
  });
});

describe('the stuck signals through STUCK (3.3)', () => {
  it('for every kit game and band, the count signal offers at the limit and not one below', () => {
    for (const id of SLIP_GAMES) {
      for (const band of AGE_BANDS) {
        const limit = STUCK[id][band];
        const below = act(open(GAME_FOR[id], { band }), ...slips(limit.count - 1, 'same'));
        expect(offerShows(below), `${id} ${band} one below`).toBe(false);
        const at = act(below, slip('same'));
        expect(offerShows(at), `${id} ${band} at the limit`).toBe(true);
        expect(sharedLine(at), `${id} ${band}`).toBe('offer');
      }
    }
  });

  it('for every kit game and band, the time signal offers at the limit and not one second below', () => {
    for (const id of SLIP_GAMES) {
      for (const band of AGE_BANDS) {
        const seconds = STUCK[id][band].seconds!;
        const below = act(open(GAME_FOR[id], { band }), tick(seconds - 1));
        expect(offerShows(below), `${id} ${band} one second below`).toBe(false);
        expect(offerShows(act(below, tick(1))), `${id} ${band} at the limit`).toBe(true);
      }
    }
  });

  it('adds up 1 s ticks to the limit', () => {
    const one = Array.from({ length: 39 }, () => tick(1));
    const below = act(open(), ...one);
    expect(offerShows(below)).toBe(false);
    expect(offerShows(act(below, tick(1)))).toBe(true);
  });

  it('progress resets the time signal but never the count', () => {
    // Mixer, ages 5 to 6: 3 slips or 40 s
    const s = act(open(), slip(), slip(), tick(39), PROGRESS, tick(39));
    expect(offerShows(s)).toBe(false);
    expect(s.stuck.count).toBe(2);
    expect(offerShows(act(s, slip()))).toBe(true);
  });

  it('the offer hides on progress and shows again only on a fresh event', () => {
    const up = act(open(), ...slips(3));
    expect(offerShows(up)).toBe(true);
    const hidden = act(up, PROGRESS);
    expect(offerShows(hidden)).toBe(false);
    expect(offerShows(act(hidden, tick(39)))).toBe(false);
    // another slip with the count already at its limit
    expect(offerShows(act(hidden, slip()))).toBe(true);
    // or the time signal reaching its limit again from 0
    expect(offerShows(act(hidden, tick(40)))).toBe(true);
  });

  it('a repeated key still brings the offer back once it was hidden', () => {
    const hidden = act(open(), ...slips(3, 'k'), PROGRESS);
    expect(offerShows(act(hidden, slip('k')))).toBe(true);
  });

  it('a swap resets both signals', () => {
    const s = act(open(), slip(), slip(), tick(39), SWAP_IN_MEMORY);
    expect(s.stuck).toEqual(STUCK_START);
    expect(offerShows(act(s, tick(39), slip(), slip()))).toBe(false);
  });

  it('a new puzzle resets both signals', () => {
    const s = act(open(), slip(), slip(), tick(39), SOLVE_IN_MEMORY, NEXT);
    expect(s.stuck).toEqual(STUCK_START);
    expect(offerShows(act(s, tick(39), slip(), slip()))).toBe(false);
  });

  it('progress with nothing to reset returns the same state', () => {
    const s = open();
    expect(levelRunReducer(s, PROGRESS)).toBe(s);
  });

  it('a tick that is not a positive number of seconds changes nothing', () => {
    const s = open();
    for (const seconds of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) expect(levelRunReducer(s, tick(seconds)), `${seconds}`).toBe(s);
  });
});

describe('when time counts', () => {
  it('counts while the puzzle is in play, the page is visible, no card is open and nothing holds it', () => {
    expect(isTicking(open())).toBe(true);
  });

  it('stops while the page is hidden and runs on from where it was when the page shows again', () => {
    const hidden = act(open(), tick(20), { type: 'visible', on: false });
    expect(isTicking(hidden)).toBe(false);
    expect(levelRunReducer(hidden, tick(100))).toBe(hidden);
    const back = act(hidden, { type: 'visible', on: true }, tick(19));
    expect(offerShows(back)).toBe(false);
    expect(offerShows(act(back, tick(1)))).toBe(true);
  });

  it('hold(true) stops it and hold(false) lets it run on, keeping the seconds already counted', () => {
    const held = act(open(), tick(20), { type: 'hold', on: true });
    expect(isTicking(held)).toBe(false);
    expect(levelRunReducer(held, tick(100))).toBe(held);
    const released = act(held, { type: 'hold', on: false });
    expect(isTicking(released)).toBe(true);
    expect(released.stuck.seconds).toBe(20);
    expect(offerShows(act(released, tick(19)))).toBe(false);
    expect(offerShows(act(released, tick(20)))).toBe(true);
  });

  it('a hold or visibility that is already set returns the same state', () => {
    const s = open();
    expect(levelRunReducer(s, { type: 'hold', on: false })).toBe(s);
    expect(levelRunReducer(s, { type: 'visible', on: true })).toBe(s);
    const held = act(s, { type: 'hold', on: true });
    expect(levelRunReducer(held, { type: 'hold', on: true })).toBe(held);
  });

  it('a hold does not stop the count signal: a slip during a hold still counts', () => {
    const s = act(open(), { type: 'hold', on: true }, ...slips(3));
    expect(offerShows(s)).toBe(true);
  });

  it('stops once the puzzle is solved', () => {
    const solved = act(open(), SOLVE_IN_MEMORY);
    expect(isTicking(solved)).toBe(false);
    expect(levelRunReducer(solved, tick(100))).toBe(solved);
  });

  it('stops while the level card waits, while it is open and after it is closed', () => {
    const done = solveClean(open(), 4);
    expect(isTicking(done)).toBe(false);
    expect(isTicking(act(done, { type: 'card', to: 'open' }))).toBe(false);
    expect(isTicking(act(done, { type: 'card', to: 'open' }, { type: 'card', to: 'closed' }))).toBe(false);
  });

  it('stops once the level is on its way out', () => {
    const leaving = act(open(), { type: 'leave' });
    expect(isTicking(leaving)).toBe(false);
    expect(levelRunReducer(leaving, tick(100))).toBe(leaving);
  });
});

describe('the shared line on the help row', () => {
  it('reads "swapped" after a swap until the next slip, progress, hint or solve', () => {
    const swapped = act(open(NUMBERS), SWAP_IN_MEMORY);
    expect(sharedLine(swapped)).toBe('swapped');
    expect(sharedLine(act(swapped, tick(5)))).toBe('swapped');
    expect(sharedLine(act(swapped, slip()))).toBeNull();
    expect(sharedLine(act(swapped, PROGRESS))).toBeNull();
    expect(sharedLine(act(swapped, HINT_IN_MEMORY))).toBeNull();
    expect(sharedLine(act(swapped, SOLVE_IN_MEMORY))).toBeNull();
  });

  it('gives the offer priority over the swapped line', () => {
    const s = act(open(), SWAP_IN_MEMORY, tick(40));
    expect(s.swapped).toBe(true);
    expect(sharedLine(s)).toBe('offer');
  });

  it('shows no shared line once the puzzle is solved, and none after Next', () => {
    const up = act(open(), ...slips(3));
    const solved = act(up, SOLVE_IN_MEMORY);
    expect(offerShows(solved)).toBe(false);
    expect(sharedLine(solved)).toBeNull();
    const next = act(solved, NEXT);
    expect(sharedLine(next)).toBeNull();
    expect(offerShows(next)).toBe(false);
  });
});

describe('swap', () => {
  it('moves the puzzle on screen to the end of the queue and leaves the dots alone', () => {
    const s0 = solveAndNext(open());
    expect(s0.run.queue).toEqual([1, 2, 3, 4, 5]);
    const s = act(s0, ...slips(3), SWAP_IN_MEMORY);
    expect(s.run.queue).toEqual([2, 3, 4, 5, 1]);
    expect(s.puzzleNo).toBe(2);
    expect(dotsOf(s)).toEqual(dotsOf(s0));
    expect(s.round).toBe(s0.round + 1);
    expect(s.phase).toBe('play');
  });

  it('uses the run the store saved', () => {
    const s0 = open();
    const saved: LevelRun = { ...s0.run, queue: [1, 2, 3, 4, 5, 0], updatedAt: NOW + 1 };
    const s = act(s0, { type: 'swap', run: saved });
    expect(s.run).toBe(saved);
    expect(s.puzzleNo).toBe(1);
  });

  it('after all six are seen, the one swapped away longest ago comes back', () => {
    let s = open();
    const seen: number[] = [s.puzzleNo];
    for (let i = 0; i < 6; i++) {
      s = act(s, SWAP_IN_MEMORY);
      seen.push(s.puzzleNo);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 0]);
  });

  it('a swapped puzzle’s slips and hint never count, and the hint stays spent', () => {
    const s = act(open(NUMBERS), slip(), slip(), HINT_IN_MEMORY, SWAP_IN_MEMORY);
    expect(s.hintsLeft).toBe(2);
    expect(solveResult(s)).toEqual({ puzzle: 1, count: 0, usedHint: false, outOfTime: false });
  });

  it('is ignored outside play: after a solve, after the level is done, and once leaving', () => {
    const solved = act(open(), SOLVE_IN_MEMORY);
    expect(levelRunReducer(solved, SWAP_IN_MEMORY)).toBe(solved);
    const done = solveClean(open(), 4);
    expect(levelRunReducer(done, SWAP_IN_MEMORY)).toBe(done);
    const leaving = act(open(), { type: 'leave' });
    expect(levelRunReducer(leaving, SWAP_IN_MEMORY)).toBe(leaving);
  });
});

describe('solve and Next', () => {
  it('a solve leaves the solved puzzle on screen and puts Next puzzle in the controls slot', () => {
    const s0 = act(open(), slip());
    const outcome = savedOutcome(s0);
    const s = act(s0, { type: 'solve', outcome });
    expect(s.phase).toBe('solved');
    expect(s.puzzleNo).toBe(0);
    expect(s.run).toBe((outcome as { run: LevelRun }).run);
    expect(dotsOf(s)).toEqual({ solved: 1, at: 1 });
    expect(slotOf(s)).toBe('next');
  });

  it('a second solve on the same puzzle is ignored, so a double tap records one result', () => {
    const solved = act(open(), SOLVE_IN_MEMORY);
    expect(levelRunReducer(solved, SOLVE_IN_MEMORY)).toBe(solved);
    expect(levelRunReducer(solved, { type: 'solve', outcome: savedOutcome(solved) })).toBe(solved);
  });

  it('Next starts the run’s next puzzle, with no slips and fresh signals', () => {
    const solved = act(open(), slip('a'), tick(30), SOLVE_IN_MEMORY);
    const s = act(solved, NEXT);
    expect(s.phase).toBe('play');
    expect(s.puzzleNo).toBe(1);
    expect(s.slips).toBe(0);
    expect(s.stuck).toEqual(STUCK_START);
    expect(dotsOf(s)).toEqual({ solved: 1, at: 2 });
    expect(slotOf(s)).toBe('controls');
    expect(s.round).toBe(solved.round + 1);
  });

  it('a second Next is ignored, so a double tap moves on one puzzle', () => {
    const next = act(open(), SOLVE_IN_MEMORY, NEXT);
    expect(levelRunReducer(next, NEXT)).toBe(next);
  });

  it('Next before a solve is ignored', () => {
    const s = open();
    expect(levelRunReducer(s, NEXT)).toBe(s);
  });

  it('a solve once the level is leaving is ignored', () => {
    const leaving = act(open(), { type: 'leave' });
    expect(levelRunReducer(leaving, SOLVE_IN_MEMORY)).toBe(leaving);
  });

  it('with no player (ignored), the level goes on in memory', () => {
    const s = act(open(), slip(), SOLVE_IN_MEMORY);
    expect(s.phase).toBe('solved');
    expect(s.run.queue).toEqual([1, 2, 3, 4, 5]);
    expect(s.run.solved).toEqual([{ puzzle: 0, count: 1, usedHint: false, outOfTime: false }]);
    expect(act(s, NEXT).puzzleNo).toBe(1);
  });

  it('plays the queue in order across solves, skipping the solved ones', () => {
    let s = open();
    const onScreen: number[] = [];
    for (let i = 0; i < 3; i++) {
      onScreen.push(s.puzzleNo);
      s = solveAndNext(s);
    }
    onScreen.push(s.puzzleNo);
    expect(onScreen).toEqual([0, 1, 2, 3]);
    expect(dotsOf(s)).toEqual({ solved: 3, at: 4 });
  });
});

describe('the level’s end', () => {
  it('the fourth solve finishes the level with the store’s stars and next level, and the card waits', () => {
    const three = act(solveClean(open(), 3), NEXT);
    const results = [...three.run.solved, solveResult(three)];
    const s = act(three, { type: 'solve', outcome: { kind: 'finished', level: 0, stars: 3, results, next: 1 } });
    expect(s.phase).toBe('done');
    expect(s.finish).toEqual({ stars: 3, next: 1, results });
    expect(s.card).toBe('waiting');
    expect(slotOf(s)).toBe('empty');
    expect(dotsOf(s)).toEqual({ solved: 4, at: 4 });
  });

  it('with no player, the fourth solve works the stars out with the slip rule', () => {
    const play = (perPuzzle: number[]) => {
      let s = open();
      perPuzzle.forEach((n, i) => {
        s = act(s, ...slips(n), SOLVE_IN_MEMORY);
        if (i < perPuzzle.length - 1) s = act(s, NEXT);
      });
      return s;
    };
    expect(play([0, 1, 0, 0]).finish).toMatchObject({ stars: 3, next: 1 });
    expect(play([1, 0, 1, 0]).finish).toMatchObject({ stars: 2 });
    expect(play([1, 1, 1, 1]).finish).toMatchObject({ stars: 2 });
    expect(play([2, 1, 1, 1]).finish).toMatchObject({ stars: 1 });
    expect(play([0, 0, 0, 0]).finish!.results).toHaveLength(4);
  });

  it('with no player on the last level, there is no next level', () => {
    const s = solveClean(open(MIXER, { level: 8 }), 4);
    expect(s.finish).toMatchObject({ next: null });
  });

  it('with no player on the level before the last, Play Level opens the last one', () => {
    expect(solveClean(open(MIXER, { level: 7 }), 4).finish).toMatchObject({ next: 8 });
  });

  it('the card waits, then opens; closed with Escape or the scrim it leaves Play Level N in the controls slot', () => {
    const done = solveClean(open(), 4);
    expect(levelRunReducer(done, { type: 'card', to: 'closed' })).toBe(done);
    const opened = act(done, { type: 'card', to: 'open' });
    expect(opened.card).toBe('open');
    expect(slotOf(opened)).toBe('empty');
    expect(levelRunReducer(opened, { type: 'card', to: 'open' })).toBe(opened);
    const closed = act(opened, { type: 'card', to: 'closed' });
    expect(closed.card).toBe('closed');
    expect(slotOf(closed)).toBe('play');
  });

  it('after the last level, the closed card leaves Back to games in the controls slot', () => {
    const closed = act(solveClean(open(MIXER, { level: 8 }), 4), { type: 'card', to: 'open' }, { type: 'card', to: 'closed' });
    expect(slotOf(closed)).toBe('home');
  });

  it('once the level is done, no slip, progress, tick, hint, swap, solve or Next acts', () => {
    const done = act(solveClean(open(NUMBERS), 4), { type: 'card', to: 'open' });
    const actions: LevelRunAction[] = [slip(), slip('k'), PROGRESS, tick(100), HINT_IN_MEMORY, SWAP_IN_MEMORY, SOLVE_IN_MEMORY, NEXT];
    for (const a of actions) expect(levelRunReducer(done, a), a.type).toBe(done);
  });

  it('card actions before the level is done are ignored', () => {
    const s = open();
    expect(levelRunReducer(s, { type: 'card', to: 'open' })).toBe(s);
    const solved = act(s, SOLVE_IN_MEMORY);
    expect(levelRunReducer(solved, { type: 'card', to: 'closed' })).toBe(solved);
  });

  it('once leaving (Play Level or Back to games tapped), the level takes no more actions', () => {
    const leaving = act(solveClean(open(), 4), { type: 'card', to: 'open' }, { type: 'leave' });
    expect(leaving.leaving).toBe(true);
    expect(levelRunReducer(leaving, { type: 'leave' })).toBe(leaving);
    const midLevel = act(open(), ...slips(3), { type: 'leave' });
    expect(offerShows(midLevel)).toBe(false);
    expect(sharedLine(midLevel)).toBeNull();
    for (const a of [slip(), PROGRESS, SOLVE_IN_MEMORY, SWAP_IN_MEMORY, HINT_IN_MEMORY]) expect(levelRunReducer(midLevel, a), a.type).toBe(midLevel);
    const solvedLeaving = act(open(), SOLVE_IN_MEMORY, { type: 'leave' });
    expect(levelRunReducer(solvedLeaving, NEXT)).toBe(solvedLeaving);
  });
});

describe('the hint budget (Number Line-up)', () => {
  it('counts down from 3 and marks the puzzle on screen', () => {
    const s = act(open(NUMBERS), HINT_IN_MEMORY);
    expect(s.hintsLeft).toBe(2);
    expect(s.usedHint).toBe(true);
    expect(solveResult(s).usedHint).toBe(true);
  });

  it('takes the hints left that the store answered', () => {
    expect(act(open(NUMBERS), { type: 'hint', left: 2 }).hintsLeft).toBe(2);
    expect(act(open(NUMBERS), { type: 'hint', left: 1 }).hintsLeft).toBe(1);
    expect(act(open(NUMBERS), { type: 'hint', left: 0 }).hintsLeft).toBe(0);
  });

  it('never counts up, and never goes below 0, whatever the store answers', () => {
    expect(act(open(NUMBERS), { type: 'hint', left: 5 }).hintsLeft).toBe(2);
    expect(act(open(NUMBERS), { type: 'hint', left: -3 }).hintsLeft).toBe(0);
  });

  it('stops at 0: a fourth hint is ignored', () => {
    const spent = act(open(NUMBERS), HINT_IN_MEMORY, HINT_IN_MEMORY, HINT_IN_MEMORY);
    expect(spent.hintsLeft).toBe(0);
    expect(levelRunReducer(spent, HINT_IN_MEMORY)).toBe(spent);
  });

  it('keeps the budget across puzzles but not the mark', () => {
    const s = act(open(NUMBERS), HINT_IN_MEMORY, SOLVE_IN_MEMORY, NEXT);
    expect(s.hintsLeft).toBe(2);
    expect(s.usedHint).toBe(false);
  });

  it('stays spent after a swap and caps only a solved puzzle', () => {
    const swapped = act(open(NUMBERS), HINT_IN_MEMORY, SWAP_IN_MEMORY);
    expect(swapped.hintsLeft).toBe(2);
    expect(solveResult(swapped).usedHint).toBe(false);
    const level = solveClean(swapped, 4);
    expect(level.finish).toMatchObject({ stars: 3 });
  });

  it('a hint on any one solved puzzle caps the level at 2 stars', () => {
    for (let i = 0; i < 4; i++) {
      let s = open(NUMBERS);
      for (let n = 0; n < 4; n++) {
        if (n === i) s = act(s, HINT_IN_MEMORY);
        s = act(s, SOLVE_IN_MEMORY);
        if (n < 3) s = act(s, NEXT);
      }
      expect(s.finish, `hint on puzzle ${i}`).toMatchObject({ stars: 2 });
    }
  });

  it('a game without hints ignores a hint', () => {
    const s = open(MIXER);
    expect(levelRunReducer(s, HINT_IN_MEMORY)).toBe(s);
    expect(levelRunReducer(s, { type: 'hint', left: 2 })).toBe(s);
  });

  it('a hint outside play is ignored', () => {
    const solved = act(open(NUMBERS), SOLVE_IN_MEMORY);
    expect(levelRunReducer(solved, HINT_IN_MEMORY)).toBe(solved);
  });
});

describe('the stored run when the level opens', () => {
  it('the same run changes nothing', () => {
    const s = open();
    expect(levelRunReducer(s, { type: 'stored', run: s.run })).toBe(s);
  });

  it('an equal run saved by the store is taken without a new puzzle', () => {
    const s = open();
    const copy = { ...s.run, updatedAt: NOW + 1 };
    const after = act(s, { type: 'stored', run: copy });
    expect(after.run).toBe(copy);
    expect(after.round).toBe(s.round);
    expect(after.puzzleNo).toBe(s.puzzleNo);
  });

  it('a stored run that moved on (another tab solved one) starts its own next puzzle', () => {
    const s = open();
    const moved = storedRun('mixer:1', SEED, 1);
    const after = act(s, { type: 'stored', run: moved });
    expect(after.puzzleNo).toBe(1);
    expect(after.round).toBe(s.round + 1);
    expect(dotsOf(after)).toEqual({ solved: 1, at: 2 });
  });

  it('takes the hints left from a stored run that moved on', () => {
    const s = open(NUMBERS);
    const spentElsewhere = { ...storedRun(numbersSet('5-6'), SEED, 1), hintsLeft: 1 };
    expect(act(s, { type: 'stored', run: spentElsewhere }).hintsLeft).toBe(1);
  });

  it('is ignored outside play', () => {
    const solved = act(open(), SOLVE_IN_MEMORY);
    expect(levelRunReducer(solved, { type: 'stored', run: storedRun('mixer:1', SEED, 2) })).toBe(solved);
  });
});

describe('with the progress store', () => {
  function setup(band: AgeBand = '5-6') {
    const data = new Map<string, string>();
    const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
    let n = 0;
    const store = createProgressStore({ storage, now: () => NOW, newId: () => `id-${++n}`, events: null });
    const id = store.addPlayer({ name: 'Maya', ageBand: band, color: 'blue' }).id;
    store.setActivePlayer(id);
    return { store, id };
  }
  type Store = ReturnType<typeof setup>['store'];

  /** As useLevelRun opens a level: build from the stored run, then take what startRun saved. */
  function openIn(store: Store, game: KitGame<number>, level = 0): LevelRunState {
    const player = store.getState().players.find((p) => p.id === store.getState().activePlayerId) ?? null;
    const s = initLevelRun({ game, level, band: player?.ageBand ?? '5-6', stored: runOf(player, game.id, level), now: store.now(), newSeed: () => SEED });
    return act(s, { type: 'stored', run: store.startRun(game.id, level, runInit(s.cfg, s.band, s.run.seed)) });
  }

  /** As useLevelRun solves: recordPuzzle with the run's rules, then the outcome into the reducer. */
  function solveIn(store: Store, s: LevelRunState, playerId?: string): LevelRunState {
    const rules: PuzzleRules = { ...runInit(s.cfg, s.band, s.run.seed), levelCount: s.cfg.levelCount, stars: (r) => levelStars(s.cfg.game, r) };
    return act(s, { type: 'solve', outcome: store.recordPuzzle(s.cfg.game, s.cfg.level, solveResult(s), rules, playerId) });
  }

  function playLevel(store: Store, game: KitGame<number>, level: number, slipsPer: number[]): LevelRunState {
    let s = openIn(store, game, level);
    slipsPer.forEach((n, i) => {
      s = solveIn(store, act(s, ...slips(n)));
      if (i < slipsPer.length - 1) s = act(s, NEXT);
    });
    return s;
  }

  it('a child plays Level 1 through: 3 stars saved, Level 2 opens, the run is gone', () => {
    const { store } = setup();
    let s = openIn(store, MIXER);
    s = act(s, slip('a'), slip('a'));
    s = solveIn(store, s);
    expect(s.phase).toBe('solved');
    expect(runOf(store.getState().players[0], 'mixer', 0)?.solved).toEqual([{ puzzle: 0, count: 1, usedHint: false, outOfTime: false }]);
    for (let i = 0; i < 3; i++) s = solveIn(store, act(s, NEXT));
    expect(s.phase).toBe('done');
    expect(s.finish).toMatchObject({ stars: 3, next: 1 });
    const game = gameOf(store.getState().players[0], 'mixer');
    expect(game.stars[0]).toBe(3);
    expect(game.current).toBe(1);
    expect(runOf(store.getState().players[0], 'mixer', 0)).toBeNull();
  });

  it('a child who leaves mid-level comes back to the next unsolved puzzle with the same seed', () => {
    const { store } = setup();
    let s = openIn(store, MIXER);
    s = solveIn(store, s);
    s = solveIn(store, act(s, NEXT));
    const back = openIn(store, MIXER);
    expect(back.puzzleNo).toBe(2);
    expect(back.run.seed).toBe(SEED);
    expect(dotsOf(back)).toEqual({ solved: 2, at: 3 });
  });

  it('a swap saved by the store is the puzzle the reducer shows, and the one a reopened level shows', () => {
    const { store } = setup();
    const s = act(openIn(store, MIXER), ...slips(3), { type: 'swap', run: store.swapPuzzle('mixer', 0) });
    expect(s.puzzleNo).toBe(1);
    expect(openIn(store, MIXER).puzzleNo).toBe(1);
  });

  it('a replay keeps the higher stars', () => {
    const { store } = setup();
    expect(playLevel(store, MIXER, 0, [0, 0, 1, 0]).finish).toMatchObject({ stars: 3 });
    expect(playLevel(store, MIXER, 0, [2, 2, 1, 0]).finish).toMatchObject({ stars: 1 });
    expect(gameOf(store.getState().players[0], 'mixer').stars[0]).toBe(3);
    expect(playLevel(store, MIXER, 1, [2, 2, 0, 0]).finish).toMatchObject({ stars: 2 });
    expect(playLevel(store, MIXER, 1, [0, 0, 0, 0]).finish).toMatchObject({ stars: 3 });
    expect(gameOf(store.getState().players[0], 'mixer').stars[1]).toBe(3);
  });

  it('with no player to save to, the level goes on in memory and nothing is saved', () => {
    const { store } = setup();
    store.setActivePlayer(null);
    const before = store.getState();
    let s = open(MIXER);
    for (let i = 0; i < 4; i++) {
      s = solveIn(store, act(s, slip()), 'nobody');
      if (i < 3) s = act(s, NEXT);
    }
    expect(s.phase).toBe('done');
    expect(s.finish).toMatchObject({ stars: 2, next: 1 });
    expect(store.getState()).toEqual(before);
  });

  it('a hint spent through the store stays spent after a swap and when the level opens again', () => {
    const { store } = setup();
    let s = openIn(store, NUMBERS);
    s = act(s, { type: 'hint', left: store.spendHint('numbers', 0) });
    expect(s.hintsLeft).toBe(2);
    s = act(s, ...slips(3), { type: 'swap', run: store.swapPuzzle('numbers', 0) });
    expect(s.hintsLeft).toBe(2);
    expect(openIn(store, NUMBERS).hintsLeft).toBe(2);
  });

  it('an age change on Number Line-up Level 9 keeps the solved puzzles from the next puzzle on', () => {
    const { store, id } = setup('5-6');
    let s = openIn(store, NUMBERS, 8);
    s = solveIn(store, s);
    s = solveIn(store, act(s, NEXT));
    store.updatePlayer(id, { ageBand: '7-8' });
    // the puzzle on screen keeps its band until Next
    expect(s.band).toBe('5-6');
    const init = bandInit(s, '7-8')!;
    s = act(s, { type: 'next', band: { band: '7-8', run: store.startRun('numbers', 8, init), now: NOW } });
    expect(s.band).toBe('7-8');
    expect(s.run.set).toBe('numbers:1:7-8');
    expect(s.run.solved).toHaveLength(2);
    expect(dotsOf(s)).toEqual({ solved: 2, at: 3 });
    expect(runOf(store.getState().players[0], 'numbers', 8)).toMatchObject({ set: 'numbers:1:7-8', seed: SEED });
    s = solveIn(store, s);
    expect(s.phase).toBe('solved');
    expect(s.run.solved).toHaveLength(3);
  });
});
