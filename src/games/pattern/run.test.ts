/**
 * Pattern Train against src/games/run.ts and the kit (six-games brief 3.1, 3.2, 3.3, 4.4, 10.2): its set name, its
 * stuck row, its star rule, and the game's half of KitGame played through the kit's reducer: a repeated wrong car
 * costs one slip for stars and still counts toward the offer, and a swap always brings a different train.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, type AgeBand, type PuzzleResult } from '../../shared/progress';
import { initLevelRun, levelRunReducer, offerShows, solveResult, stuckLimit, type LevelRunAction, type LevelRunState } from '../kit/levelRun';
import { getGame } from '../registry';
import { LEVEL_STAR_RULES, SLIP_GAMES, STUCK, levelStars, patternSet, slipLevelStars } from '../run';
import { carKey, type Car } from './cars';
import { TITLE } from './copy';
import { GAME } from './game';
import { PATTERN_STAR_RULE, PATTERN_STUCK } from './levels';
import { meta } from './meta';
import { OPTION_COUNT, PATTERN_SET_VERSION, puzzle, puzzleKey, type PatternPuzzle } from './puzzles';

const NOW = new Date(2026, 10, 9, 12, 0).getTime();
const SEED = 31337;

const solved = (slips: readonly number[], usedHint = false): PuzzleResult[] =>
  slips.map((count, n) => ({ puzzle: n, count, usedHint: usedHint && n === 0, outOfTime: false }));

const open = (level = 0, band: AgeBand = '5-6'): LevelRunState => initLevelRun({ game: GAME, level, band, stored: null, now: NOW, newSeed: () => SEED });
const act = (s: LevelRunState, ...actions: LevelRunAction[]): LevelRunState => actions.reduce(levelRunReducer, s);
/** The puzzle on screen, as the Play screen asks the game for it. */
const onScreen = (s: LevelRunState): PatternPuzzle => GAME.puzzle(s.cfg.level, s.puzzleNo, { seed: s.run.seed, band: s.band });
/** A wrong car tapped: the game passes the car as the slip's key (3.1). */
const tapWrong = (c: Car): LevelRunAction => ({ type: 'slip', key: carKey(c) });
const wrongCars = (p: PatternPuzzle): Car[] => p.options.filter((_, i) => i !== p.answerAt);

describe('the set name (3.2, 6)', () => {
  it('is pattern:1, the version the game stores under', () => {
    expect(PATTERN_SET_VERSION).toBe(1);
    expect(patternSet()).toBe('pattern:1');
    expect(patternSet(PATTERN_SET_VERSION)).toBe('pattern:1');
  });

  it('follows the version, so a raised version restarts stored runs', () => {
    expect(patternSet(2)).toBe('pattern:2');
  });

  it('is the same for every age band: the band changes only the stuck limits', () => {
    for (const band of AGE_BANDS) expect(GAME.set(band), band).toBe('pattern:1');
  });
});

describe('the stuck row (3.3)', () => {
  it('holds the Pattern Train row for every age band', () => {
    expect(STUCK.pattern).toEqual({
      '3-4': { count: 3, seconds: 30 },
      '5-6': { count: 3, seconds: 40 },
      '7-8': { count: 4, seconds: 50 },
      '9-10': { count: 4, seconds: 60 },
    });
    expect(Object.keys(STUCK.pattern).sort()).toEqual([...AGE_BANDS].sort());
  });

  it('equals PATTERN_STUCK of the game', () => {
    expect(PATTERN_STUCK).toEqual(STUCK.pattern);
  });

  it('copies Letter Builder’s row, as 3.3 says', () => {
    expect(STUCK.pattern).toEqual(STUCK.letters);
  });
});

describe('the star rule on slips (3.2)', () => {
  it('holds { three: 1, two: 4 } in run.ts, and the game reads the same rule', () => {
    expect(LEVEL_STAR_RULES.pattern).toEqual({ three: 1, two: 4 });
    expect(PATTERN_STAR_RULE).toEqual(LEVEL_STAR_RULES.pattern);
  });

  it('lists pattern among the six kit games', () => {
    expect(SLIP_GAMES).toContain('pattern');
  });

  it('gives 3 stars for 0 or 1 slip over the 4 puzzles, 2 for 2 to 4, 1 for 5 or more', () => {
    const stars = (slips: number[]) => levelStars('pattern', solved(slips));
    expect(stars([0, 0, 0, 0])).toBe(3);
    expect(stars([1, 0, 0, 0])).toBe(3);
    expect(stars([0, 0, 0, 1])).toBe(3);
    expect(stars([1, 1, 0, 0])).toBe(2);
    expect(stars([2, 2, 0, 0])).toBe(2);
    expect(stars([4, 0, 0, 0])).toBe(2);
    expect(stars([1, 1, 1, 1])).toBe(2);
    expect(stars([5, 0, 0, 0])).toBe(1);
    expect(stars([2, 2, 1, 0])).toBe(1);
    expect(stars([2, 2, 2, 2])).toBe(1);
  });

  it('reaches the same answer through slipLevelStars and levelStars', () => {
    for (const slips of [[0, 0, 0, 0], [1, 1, 0, 0], [2, 2, 1, 0], [7, 0, 0, 0]]) {
      expect(slipLevelStars('pattern')(solved(slips))).toBe(levelStars('pattern', solved(slips)));
    }
  });

  it('lands a child who taps at random on 2 stars and a child who reads the pattern on 3 (4.4)', () => {
    // A guesser taps different cars until the right one: every tap order of the 3 cars is as likely.
    const orders: number[][] = [];
    const perm = (left: number[], done: number[]) => (left.length === 0 ? orders.push(done) : left.forEach((x) => perm(left.filter((y) => y !== x), [...done, x])));
    perm([...Array(OPTION_COUNT).keys()], []);
    const answerAt = 0;
    const wrongTaps = orders.map((o) => o.indexOf(answerAt));
    const average = wrongTaps.reduce((a, b) => a + b, 0) / orders.length;
    expect(average).toBe(1);
    expect(levelStars('pattern', solved([average, average, average, average]))).toBe(2);
    expect(levelStars('pattern', solved([0, 0, 0, 0]))).toBe(3);
  });

  it('is not capped: Pattern Train has no hint', () => {
    expect(levelStars('pattern', solved([0, 0, 0, 0]))).toBe(3);
  });
});

describe('the game’s half of KitGame (3.1)', () => {
  it('is the pattern game, with the registry’s title and the game’s meta', () => {
    expect(GAME.id).toBe('pattern');
    expect(GAME.title).toBe(TITLE);
    expect(GAME.title).toBe('Pattern Train');
    expect(getGame('pattern')?.title).toBe(GAME.title);
    expect(GAME.meta).toBe(meta);
    expect(GAME.meta.levelCount).toBe(12);
  });

  it('draws a new seed per run, keeps no solved puzzles across bands and has no hints', () => {
    expect(GAME.seed).toBe('run');
    expect(GAME.keepSolved).toBeFalsy();
    expect(GAME.hints).toBeFalsy();
  });

  it('hands the kit the content module’s puzzle function', () => {
    expect(GAME.puzzle).toBe(puzzle);
    expect(GAME.puzzle(11, 5, { seed: 3, band: '9-10' })).toEqual(puzzle(11, 5, { seed: 3, band: '9-10' }));
  });
});

describe('a Pattern Train level in the kit’s reducer (3.1, 4.4)', () => {
  it('opens a new run at puzzle 1 with a new seed, the set pattern:1 and no hints', () => {
    const s = open();
    expect(s.puzzleNo).toBe(0);
    expect(s.run).toMatchObject({ set: 'pattern:1', seed: SEED, queue: [0, 1, 2, 3, 4, 5], solved: [] });
    expect(s.run.hintsLeft).toBeUndefined();
    expect(s.hintsLeft).toBe(0);
    expect(s.cfg.levelCount).toBe(12);
  });

  it('opens the first and the last level with a train to play', () => {
    for (const level of [0, 11]) {
      const s = open(level);
      expect(onScreen(s)).toEqual(puzzle(level, 0, { seed: SEED, band: '5-6' }));
      expect(onScreen(s).level).toBe(level);
    }
  });

  it('counts a repeated wrong car once for stars, and every tap toward the offer', () => {
    const s0 = open(0, '3-4');
    const [w] = wrongCars(onScreen(s0));
    const twice = act(s0, tapWrong(w), tapWrong(w));
    expect(twice.slips).toBe(1);
    expect(offerShows(twice)).toBe(false);
    const thrice = act(twice, tapWrong(w));
    expect(thrice.slips).toBe(1);
    expect(offerShows(thrice)).toBe(true);
    expect(solveResult(thrice).count).toBe(1);
  });

  it('counts two different wrong cars as two slips', () => {
    const s0 = open(4);
    const [a, b] = wrongCars(onScreen(s0));
    expect(carKey(a)).not.toBe(carKey(b));
    const s = act(s0, tapWrong(a), tapWrong(b), tapWrong(a));
    expect(s.slips).toBe(2);
    expect(solveResult(s).count).toBe(2);
  });

  it('brings the offer at the stuck row’s count for each band, the first and the last band included', () => {
    for (const band of AGE_BANDS) {
      const s0 = open(0, band);
      expect(stuckLimit(s0), band).toEqual(STUCK.pattern[band]);
      const limit = STUCK.pattern[band].count;
      const [w] = wrongCars(onScreen(s0));
      const taps = (n: number) => act(s0, ...Array.from({ length: n }, () => tapWrong(w)));
      expect(offerShows(taps(limit - 1)), `${band} one below`).toBe(false);
      expect(offerShows(taps(limit)), `${band} at the limit`).toBe(true);
    }
  });

  it('swaps in a different train every time, and never runs dry', () => {
    let s = open(8);
    const seen = [puzzleKey(onScreen(s))];
    for (let i = 0; i < 6; i++) {
      s = act(s, { type: 'swap', run: null });
      const key = puzzleKey(onScreen(s));
      expect(key, `swap ${i + 1}`).not.toBe(seen[seen.length - 1]);
      seen.push(key);
    }
    // six swaps walk the whole queue and come back to the first train
    expect(new Set(seen.slice(0, 6)).size).toBe(6);
    expect(seen[6]).toBe(seen[0]);
  });

  it('keeps the same trains after a band change at a puzzle boundary', () => {
    const s0 = open(3, '3-4');
    const solvedOne = act(s0, { type: 'solve', outcome: { kind: 'ignored' } });
    const next = act(solvedOne, { type: 'next', band: { band: '9-10', run: null, now: NOW } });
    expect(next.band).toBe('9-10');
    expect(next.run.set).toBe('pattern:1');
    expect(next.run.seed).toBe(SEED);
    expect(onScreen(next)).toEqual(puzzle(3, next.puzzleNo, { seed: SEED, band: '3-4' }));
    expect(stuckLimit(next)).toEqual(STUCK.pattern['9-10']);
  });
});
