/**
 * Picture Builder against src/games/run.ts and the kit's level reducer (six-games brief 3.2, 3.3, 4.6, 10.2): its set
 * name, its stuck row at every band at the limit and one below, no time toward the offer during a look or a Peek,
 * the star rule on slips, and a level played through to its card on the first and the last level.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, type AgeBand, type PuzzleResult } from '../../shared/progress';
import { initLevelRun, isTicking, levelRunReducer, type LevelRunAction, type LevelRunState } from '../kit/levelRun';
import { LEVEL_STAR_RULES, SLIP_GAMES, STUCK, builderSet, levelStars, slipLevelStars } from '../run';
import { GAME } from './game';
import { BUILDER_SET_VERSION, BUILDER_STAR_RULE, BUILDER_STUCK, lookSeconds } from './puzzles';

const NOW = new Date(2026, 10, 9, 12, 0).getTime();
/** The 3.3 Picture Builder row: count limit, then seconds with no new right brick. */
const BRIEF_STUCK: Record<AgeBand, { count: number; seconds: number }> = {
  '3-4': { count: 3, seconds: 30 },
  '5-6': { count: 3, seconds: 40 },
  '7-8': { count: 4, seconds: 50 },
  '9-10': { count: 4, seconds: 60 },
};

const solved = (slips: readonly number[]): PuzzleResult[] => slips.map((count, puzzle) => ({ puzzle, count, usedHint: false, outOfTime: false }));
const open = (level = 0, band: AgeBand = '5-6'): LevelRunState => initLevelRun({ game: GAME, level, band, stored: null, now: NOW });
const act = (s: LevelRunState, ...actions: LevelRunAction[]): LevelRunState => actions.reduce(levelRunReducer, s);
const slip = (key: string): LevelRunAction => ({ type: 'slip', key });
const tick = (seconds: number): LevelRunAction => ({ type: 'tick', seconds });
const hold = (on: boolean): LevelRunAction => ({ type: 'hold', on });
const PROGRESS: LevelRunAction = { type: 'progress' };
const SOLVE: LevelRunAction = { type: 'solve', outcome: { kind: 'ignored' } };
const NEXT: LevelRunAction = { type: 'next' };

describe('the set name (3.2, 6)', () => {
  it('is builder:1, the version the game stores under', () => {
    expect(builderSet()).toBe('builder:1');
    expect(builderSet(BUILDER_SET_VERSION)).toBe('builder:1');
  });

  it('follows the version, so a raised version restarts stored runs', () => {
    expect(builderSet(2)).toBe('builder:2');
    expect(builderSet(2)).not.toBe(builderSet());
  });
});

describe('the stuck row (3.3)', () => {
  it('holds the Picture Builder row for every age band', () => {
    expect(STUCK.builder).toEqual(BRIEF_STUCK);
    expect(BUILDER_STUCK).toEqual(BRIEF_STUCK);
    expect(Object.keys(STUCK.builder).sort()).toEqual([...AGE_BANDS].sort());
  });

  it('copies Letter Builder’s row, as 3.3 says', () => {
    expect(STUCK.builder).toEqual(STUCK.letters);
  });

  for (const band of AGE_BANDS) {
    const { count, seconds } = BRIEF_STUCK[band];
    it(`ages ${band}: the offer comes at ${count} wrong strokes and not at ${count - 1}`, () => {
      const keys = Array.from({ length: count }, (_, i) => `${i}:red`);
      expect(act(open(0, band), ...keys.slice(0, -1).map(slip)).stuck.offer).toBe(false);
      expect(act(open(0, band), ...keys.map(slip)).stuck.offer).toBe(true);
    });

    it(`ages ${band}: the offer comes after ${seconds} s with no new right brick and not at ${seconds - 1} s`, () => {
      expect(act(open(0, band), tick(seconds - 1)).stuck.offer).toBe(false);
      expect(act(open(0, band), tick(seconds - 1), tick(1)).stuck.offer).toBe(true);
    });
  }

  it('lets a new right brick reset the time signal and hide the offer', () => {
    const s = act(open(0, '5-6'), tick(39), PROGRESS, tick(39));
    expect(s.stuck.offer).toBe(false);
    expect(s.stuck.seconds).toBe(39);
    const shown = act(open(0, '5-6'), tick(40));
    expect(shown.stuck.offer).toBe(true);
    expect(act(shown, PROGRESS).stuck.offer).toBe(false);
  });

  it('counts a repeated wrong brick toward the offer, while it adds no star slip', () => {
    const s = act(open(0, '5-6'), slip('4:red'), slip('4:red'), slip('4:red'));
    expect(s.stuck.offer).toBe(true);
    expect(s.slips).toBe(1);
  });
});

describe('no time counts toward the offer during a look (4.6, 10.2)', () => {
  for (const band of AGE_BANDS) {
    it(`ages ${band}: the first look holds the clock, however long it runs, and Peeks do too`, () => {
      const limit = BRIEF_STUCK[band].seconds;
      // Level 6 is the first memory level.
      let s = act(open(5, band), hold(true));
      expect(isTicking(s)).toBe(false);
      s = act(s, tick(lookSeconds(band, 'first')), tick(limit * 3));
      expect(s.stuck.seconds).toBe(0);
      expect(s.stuck.offer).toBe(false);
      s = act(s, hold(false), tick(limit - 5), hold(true), tick(lookSeconds(band, 'peek')), tick(limit));
      expect(s.stuck.seconds).toBe(limit - 5);
      expect(s.stuck.offer).toBe(false);
      s = act(s, hold(false), tick(5));
      expect(s.stuck.offer).toBe(true);
    });
  }

  it('still counts a wrong stroke made while the clock is held toward the offer, as the kit does for every game', () => {
    const s = act(open(5, '3-4'), hold(true), slip('0:red'), slip('1:red'), slip('2:red'));
    expect(s.stuck.offer).toBe(true);
  });
});

describe('the star rule on slips (3.2)', () => {
  it('holds { three: 1, two: 4 } in run.ts', () => {
    expect(LEVEL_STAR_RULES.builder).toEqual({ three: 1, two: 4 });
    expect(BUILDER_STAR_RULE).toEqual({ three: 1, two: 4 });
  });

  it('lists builder among the six kit games', () => {
    expect(SLIP_GAMES).toContain('builder');
  });

  it('gives 3 stars for 0 or 1 slip over the 4 puzzles, 2 for 2 to 4, 1 for 5 or more', () => {
    const stars = (slips: number[]) => levelStars('builder', solved(slips));
    expect(stars([0, 0, 0, 0])).toBe(3);
    expect(stars([1, 0, 0, 0])).toBe(3);
    expect(stars([0, 0, 0, 1])).toBe(3);
    expect(stars([1, 1, 0, 0])).toBe(2);
    expect(stars([4, 0, 0, 0])).toBe(2);
    expect(stars([1, 1, 1, 1])).toBe(2);
    expect(stars([5, 0, 0, 0])).toBe(1);
    expect(stars([2, 3, 0, 0])).toBe(1);
    expect(stars([9, 9, 9, 9])).toBe(1);
  });

  it('reaches the same answer through slipLevelStars and levelStars', () => {
    for (const slips of [[0, 0, 0, 0], [1, 1, 0, 0], [3, 3, 0, 0], [7, 0, 0, 0]]) {
      expect(slipLevelStars('builder')(solved(slips))).toBe(levelStars('builder', solved(slips)));
    }
  });

  it('is not capped: Picture Builder has no hint', () => {
    expect(levelStars('builder', solved([0, 0, 0, 0]))).toBe(3);
    expect(open().hintsLeft).toBe(0);
  });
});

describe('a level played through to its card, first and last level', () => {
  /** Solves the puzzle on screen with `slips` new wrong strokes first, then Next. */
  const solveWith = (s: LevelRunState, slips: number): LevelRunState => act(s, ...Array.from({ length: slips }, (_, i) => slip(`${i}:white`)), SOLVE);

  it('finishes Level 1 after 4 solved puzzles, opens Level 2 and gives the stars of its slips', () => {
    let s = open(0);
    for (const n of [1, 0, 0]) s = act(solveWith(s, n), NEXT);
    s = solveWith(s, 1);
    expect(s.phase).toBe('done');
    expect(s.finish?.next).toBe(1);
    expect(s.finish?.stars).toBe(2);
    expect(s.finish?.results.map((r) => r.count)).toEqual([1, 0, 0, 1]);
  });

  it('finishes the game after Level 12, with no level to open next', () => {
    let s = open(11, '9-10');
    for (let i = 0; i < 3; i++) s = act(solveWith(s, 0), NEXT);
    s = solveWith(s, 0);
    expect(s.phase).toBe('done');
    expect(s.finish?.next).toBeNull();
    expect(s.finish?.stars).toBe(3);
  });

  it('starts every level at puzzle 1 with fixed seed 0', () => {
    for (const level of [0, 5, 11]) {
      const s = open(level);
      expect(s.puzzleNo).toBe(0);
      expect(s.run.seed).toBe(0);
      expect(s.run.set).toBe('builder:1');
    }
  });
});
