/**
 * Brick Calculator against src/games/run.ts and the kit's level reducer (six-games brief 3.1 to 3.3, 4.5 "Stuck, hint,
 * timer, stars", 6, 10.2): its set name, its stuck row and its star rule, then a level played with the real game and
 * the keypad rules: a slip is a new wrong answer sent with =, any key press resets the time signal, no hint, stars by
 * slips, and a band change keeps solved puzzles while the next sums take the new band's numbers.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, type AgeBand, type LevelRun, type PuzzleOutcome, type PuzzleResult } from '../../shared/progress';
import { initLevelRun, levelRunReducer, offerShows, solveResult, type LevelRunAction, type LevelRunState } from '../kit/levelRun';
import { LEVEL_STAR_RULES, SLIP_GAMES, STUCK, levelStars, mathSet, slipLevelStars } from '../run';
import { pressKey, START_STATE, isKeyPress, type KeyId, type KeypadState } from './entry';
import { MATH } from './game';
import type { MathPuzzle } from './puzzles';

const NOW = new Date(2026, 10, 9, 12, 0).getTime();
const SEED = 4242;

const solved = (slips: readonly number[]): PuzzleResult[] => slips.map((count, puzzle) => ({ puzzle, count, usedHint: false, outOfTime: false }));

const open = (band: AgeBand = '5-6', level = 0, stored: LevelRun | null = null): LevelRunState =>
  initLevelRun({ game: MATH, level, band, stored, now: NOW, newSeed: () => SEED });
const act = (s: LevelRunState, ...actions: LevelRunAction[]) => actions.reduce(levelRunReducer, s);
const onScreen = (s: LevelRunState): MathPuzzle => MATH.puzzle(s.cfg.level, s.puzzleNo, { seed: s.run.seed, band: s.band });
const IGNORED: PuzzleOutcome = { kind: 'ignored' };

/**
 * A child's key presses on the puzzle on screen, as the Play screen feeds them to the kit: every press that reached
 * the keypad is progress (it resets the time signal), and a wrong = is then a slip keyed by the number sent.
 * A right = solves.
 */
function keys(s: LevelRunState, presses: readonly KeyId[], pad: KeypadState = START_STATE): { s: LevelRunState; pad: KeypadState } {
  let state = s;
  let now = pad;
  for (const k of presses) {
    const r = pressKey(now, k, onScreen(state).answer, state.phase !== 'play');
    now = r.state;
    if (isKeyPress(r.event)) state = act(state, { type: 'progress' });
    if (r.event === 'wrong') state = act(state, { type: 'slip', key: String(r.sent) });
    if (r.event === 'right') state = act(state, { type: 'solve', outcome: IGNORED });
  }
  return { s: state, pad: now };
}
/** The digits of a number as key presses, then =. */
const send = (n: number): KeyId[] => [...([...String(n)].map(Number) as KeyId[]), 'equals'];
/** A wrong answer for the puzzle on screen that is still 0 to 20. */
const wrongFor = (s: LevelRunState, nth = 1): number => (onScreen(s).answer + nth) % 21;

describe('the set name (3.2, 6)', () => {
  it('is math:1:<band> for every age band', () => {
    for (const band of AGE_BANDS) expect(mathSet(band), band).toBe(`math:1:${band}`);
  });

  it('differs from band to band, so a band change is a different set (keepSolved decides what is kept)', () => {
    expect(new Set(AGE_BANDS.map((b) => mathSet(b))).size).toBe(AGE_BANDS.length);
  });

  it('follows the version, so a raised version restarts stored runs', () => {
    expect(mathSet('5-6', 2)).toBe('math:2:5-6');
    expect(mathSet('5-6', 2)).not.toBe(mathSet('5-6'));
  });
});

describe('the stuck row (3.3)', () => {
  it('holds the Brick Calculator row for every age band: 2 and 45 s, then 3 and 60 s', () => {
    expect(STUCK.math).toEqual({
      '3-4': { count: 2, seconds: 45 },
      '5-6': { count: 2, seconds: 45 },
      '7-8': { count: 3, seconds: 60 },
      '9-10': { count: 3, seconds: 60 },
    });
    expect(Object.keys(STUCK.math).sort()).toEqual([...AGE_BANDS].sort());
  });

  it('counts fewer slips than Letter Builder at every band, and waits at least as long', () => {
    for (const band of AGE_BANDS) {
      expect(STUCK.math[band].count, band).toBeLessThan(STUCK.letters[band].count);
      expect(STUCK.math[band].seconds as number, band).toBeGreaterThanOrEqual(STUCK.letters[band].seconds as number);
    }
  });
});

describe('the star rule on slips (3.2)', () => {
  it('holds { three: 1, two: 4 } in run.ts', () => {
    expect(LEVEL_STAR_RULES.math).toEqual({ three: 1, two: 4 });
  });

  it('lists math among the six kit games', () => {
    expect(SLIP_GAMES).toContain('math');
  });

  it('gives 3 stars for 0 or 1 slip over the 4 puzzles, 2 for 2 to 4, 1 for 5 or more', () => {
    const stars = (slips: number[]) => levelStars('math', solved(slips));
    expect(stars([0, 0, 0, 0])).toBe(3);
    expect(stars([0, 1, 0, 0])).toBe(3);
    expect(stars([1, 1, 0, 0])).toBe(2);
    expect(stars([4, 0, 0, 0])).toBe(2);
    expect(stars([1, 1, 1, 1])).toBe(2);
    expect(stars([5, 0, 0, 0])).toBe(1);
    expect(stars([2, 3, 0, 0])).toBe(1);
  });

  it('reaches the same answer through slipLevelStars and levelStars', () => {
    for (const slips of [[0, 0, 0, 0], [1, 1, 0, 0], [3, 3, 0, 0], [7, 0, 0, 0]]) {
      expect(slipLevelStars('math')(solved(slips))).toBe(levelStars('math', solved(slips)));
    }
  });
});

describe('a Brick Calculator level in the kit (4.5, 3.1)', () => {
  it('opens Level 1 on set math:1:<band> with a new seed, puzzle 1 first, and no hint budget', () => {
    for (const band of AGE_BANDS) {
      const s = open(band);
      expect(s.run, band).toMatchObject({ set: `math:1:${band}`, seed: SEED, queue: [0, 1, 2, 3, 4, 5], solved: [] });
      expect(s.run.hintsLeft).toBeUndefined();
      expect(s.hintsLeft).toBe(0);
      expect(onScreen(s)).toEqual(MATH.puzzle(0, 0, { seed: SEED, band }));
    }
  });

  it('spends no hint: the bricks are the help', () => {
    const s = open();
    expect(act(s, { type: 'hint', left: null })).toBe(s);
  });

  it('solves on the right answer with no slip', () => {
    const { s } = keys(open(), send(onScreen(open()).answer));
    expect(s.phase).toBe('solved');
    expect(solveResult(s)).toEqual({ puzzle: 0, count: 0, usedHint: false, outOfTime: false });
  });

  it('counts a new wrong answer as a slip, and the same wrong answer again for the offer only', () => {
    const start = open('9-10', 4);
    const wrong = wrongFor(start);
    const { s } = keys(start, [...send(wrong), ...send(wrong)]);
    expect(s.slips).toBe(1);
    expect(s.stuck.count).toBe(2);
    expect(s.phase).toBe('play');
    const after = keys(s, send(wrongFor(start, 2))).s;
    expect(after.slips).toBe(2);
  });

  it('counts "07" and "7" as the same wrong answer', () => {
    const start = open('9-10', 8);
    const wrong = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((n) => n !== onScreen(start).answer)!;
    const { s } = keys(start, [0, wrong as KeyId, 'equals', wrong as KeyId, 'equals']);
    expect(s.slips).toBe(1);
    expect(s.stuck.count).toBe(2);
  });

  it('is no slip to press = with nothing typed, clear, or type a third digit', () => {
    const { s } = keys(open('3-4'), ['equals', 1, 1, 1, 'clear', 'equals', 'clear']);
    expect(s.slips).toBe(0);
    expect(s.stuck.count).toBe(0);
  });

  for (const band of AGE_BANDS) {
    const limit = STUCK.math[band].count;
    it(`brings the offer at ${limit} wrong answers for ages ${band}, not at ${limit - 1}`, () => {
      const start = open(band, 6);
      let s = start;
      for (let i = 1; i < limit; i++) s = keys(s, send(wrongFor(start, i))).s;
      expect(offerShows(s)).toBe(false);
      s = keys(s, send(wrongFor(start, limit))).s;
      expect(offerShows(s)).toBe(true);
      expect(s.slips).toBe(limit);
    });
  }

  for (const band of AGE_BANDS) {
    const seconds = STUCK.math[band].seconds as number;
    it(`brings the offer after ${seconds} s with no key press for ages ${band}, and a key press resets the time`, () => {
      const s = act(open(band), { type: 'tick', seconds: seconds - 1 });
      expect(offerShows(s)).toBe(false);
      const pressed = keys(s, [3]).s;
      expect(pressed.stuck.seconds).toBe(0);
      expect(offerShows(act(pressed, { type: 'tick', seconds: seconds - 1 }))).toBe(false);
      const long = act(s, { type: 'tick', seconds: 1 });
      expect(offerShows(long)).toBe(true);
      // the next key press is progress: the offer hides and the time starts again
      const typed = keys(long, [3]).s;
      expect(offerShows(typed)).toBe(false);
      expect(typed.stuck.seconds).toBe(0);
    });
  }

  it('ignores the keys once solved: a second = records nothing more', () => {
    const start = open();
    const answer = onScreen(start).answer;
    const first = keys(start, send(answer));
    const again = keys(first.s, ['equals', 1, 'equals'], first.pad);
    expect(again.s).toBe(first.s);
    expect(again.pad).toBe(first.pad);
  });

  it('finishes the level at the fourth solved sum and scores it by its slips: 2 new wrong answers, 2 stars', () => {
    let s = open('7-8', 9);
    const wrongs = [[1], [], [1, 1], []];
    for (const [i, plan] of wrongs.entries()) {
      // each puzzle starts from a fresh keypad; a repeated wrong answer is no new star slip
      const presses = plan.flatMap((nth) => send(wrongFor(s, nth)));
      s = keys(s, [...presses, ...send(onScreen(s).answer)]).s;
      if (i < wrongs.length - 1) {
        expect(s.phase).toBe('solved');
        s = act(s, { type: 'next' });
      }
    }
    expect(s.phase).toBe('done');
    expect(s.finish?.results.map((r) => r.count)).toEqual([1, 0, 1, 0]);
    expect(s.finish?.stars).toBe(2);
    expect(s.finish?.next).toBe(10);
  });

  it('finishes the last level with no next level', () => {
    let s = open('3-4', 11);
    for (let i = 0; i < 4; i++) {
      s = keys(s, send(onScreen(s).answer)).s;
      if (i < 3) s = act(s, { type: 'next' });
    }
    expect(s.finish).toMatchObject({ stars: 3, next: null });
  });
});

describe('a band change keeps solved puzzles (keepSolved, 4.5, 6)', () => {
  const stored = (set: string, solvedCount: number): LevelRun => ({
    set,
    seed: 77,
    queue: [0, 1, 2, 3, 4, 5].slice(solvedCount),
    solved: solved(Array(solvedCount).fill(0)),
    updatedAt: NOW - 1000,
  });

  it('resumes at the next unsolved puzzle on the new band’s set, with the same seed and solved puzzles', () => {
    const s = open('9-10', 8, stored(mathSet('3-4'), 2));
    expect(s.run).toMatchObject({ set: 'math:1:9-10', seed: 77, queue: [2, 3, 4, 5] });
    expect(s.run.solved).toHaveLength(2);
    expect(s.puzzleNo).toBe(2);
  });

  it('deals the unsolved sums from the new band’s numbers with that seed', () => {
    const s = open('9-10', 8, stored(mathSet('3-4'), 2));
    expect(onScreen(s)).toEqual(MATH.puzzle(8, 2, { seed: 77, band: '9-10' }));
    // one sum can come out the same by chance (1 + 1 fits both bands); the four unsolved ones as a set do not
    const unsolved = (band: AgeBand) => s.run.queue.map((n) => MATH.puzzle(8, n, { seed: 77, band }));
    expect(unsolved('9-10')).not.toEqual(unsolved('3-4'));
  });

  it('restarts at puzzle 1 when the set version was raised, band change or not', () => {
    for (const set of [mathSet('3-4', 2), mathSet('9-10', 2), 'math:0:9-10']) {
      const s = open('9-10', 8, stored(set, 2));
      expect(s.run, set).toMatchObject({ set: 'math:1:9-10', seed: SEED, queue: [0, 1, 2, 3, 4, 5], solved: [] });
    }
  });

  it('keeps a run stored on the same set as it is', () => {
    const run = stored(mathSet('7-8'), 3);
    expect(open('7-8', 11, run).run).toBe(run);
  });
});
