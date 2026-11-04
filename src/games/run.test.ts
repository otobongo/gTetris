/**
 * Four-puzzle levels, the shared rules (brief sections 3 and 5): queue order and swaps, the STUCK
 * table, the stuck signals and the offer, and the level's stars over its 4 solved puzzles.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, type PuzzleResult } from '../shared/progress';
import { STAGES, averageCells, starRule } from './drop/stages';
import {
  LEVEL_STAR_RULES,
  STUCK,
  STUCK_START,
  TRY_OVER_FACTOR,
  dotPosition,
  dropLevelStars,
  dropSet,
  dropTargets,
  escapeLevelStars,
  escapeSet,
  firstQueue,
  levelScore,
  levelStars,
  levelTotals,
  lettersLevelStars,
  lettersSet,
  puzzleOnScreen,
  rotateQueue,
  stuckStep,
  type StuckEvent,
  type StuckLimit,
  type StuckState,
} from './run';

const result = (over: Partial<PuzzleResult> = {}): PuzzleResult => ({ puzzle: 0, count: 0, usedHint: false, outOfTime: false, ...over });
const four = (each: Partial<PuzzleResult>, last: Partial<PuzzleResult> = {}): PuzzleResult[] =>
  [0, 1, 2, 3].map((i) => result({ puzzle: i, ...each, ...(i === 3 ? last : {}) }));

describe('puzzle sets', () => {
  it('names each game’s set as the brief stores it', () => {
    expect(escapeSet('a1b2')).toBe('escape:a1b2');
    expect(dropSet()).toBe('drop:1');
    expect(dropSet(2)).toBe('drop:2');
    expect(lettersSet('5-6')).toBe('letters:1:5-6');
    expect(lettersSet('9-10', 3)).toBe('letters:3:9-10');
  });
});

describe('queue and swaps', () => {
  it('starts with every puzzle in order, the original board first', () => {
    expect(firstQueue()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(puzzleOnScreen({ queue: firstQueue() })).toBe(0);
  });

  it('a swap moves the puzzle on screen to the end', () => {
    expect(rotateQueue([0, 1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5, 0]);
    expect(rotateQueue([3, 4, 5])).toEqual([4, 5, 3]);
  });

  it('after all six are seen, the one swapped away longest ago comes back', () => {
    let q = firstQueue();
    const seen: number[] = [];
    for (let i = 0; i < 7; i++) {
      seen.push(puzzleOnScreen({ queue: q }));
      q = rotateQueue(q);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 0]);
  });

  it('never runs out: with 3 solved there are still 2 others to swap to', () => {
    expect(rotateQueue([3, 4, 5])).toHaveLength(3);
    expect(rotateQueue([5])).toEqual([5]);
    expect(rotateQueue([])).toEqual([]);
    expect(puzzleOnScreen({ queue: [] })).toBe(0);
  });

  it('the dots follow solves only, never swaps', () => {
    expect(dotPosition({ solved: [] })).toBe(1);
    expect(dotPosition({ solved: [result(), result()] })).toBe(3);
    expect(dotPosition({ solved: four({}) })).toBe(4);
  });
});

describe('the STUCK table (3.1)', () => {
  const table = {
    escape: [[2, 60], [2, 90], [3, 120], [3, 150]],
    drop: [[2, null], [2, null], [3, null], [3, null]],
    letters: [[3, 30], [3, 40], [4, 50], [4, 60]],
  } as const;

  it('holds the brief’s limits for every game and age band', () => {
    for (const game of ['escape', 'drop', 'letters'] as const) {
      AGE_BANDS.forEach((band, i) => {
        const [count, seconds] = table[game][i];
        expect(STUCK[game][band], `${game} ${band}`).toEqual({ count, seconds });
      });
    }
  });

  it('fires the count signal at the limit and not one below, for every game and band', () => {
    for (const game of ['escape', 'drop', 'letters'] as const) {
      for (const band of AGE_BANDS) {
        const limit = STUCK[game][band];
        let s = STUCK_START;
        for (let i = 1; i < limit.count; i++) s = stuckStep(s, { type: 'fail' }, limit);
        expect(s.offer, `${game} ${band} one below`).toBe(false);
        s = stuckStep(s, { type: 'fail' }, limit);
        expect(s.offer, `${game} ${band} at the limit`).toBe(true);
      }
    }
  });

  it('fires the time signal at the limit and not one second below; Brick Drop has none', () => {
    for (const game of ['escape', 'letters'] as const) {
      for (const band of AGE_BANDS) {
        const limit = STUCK[game][band];
        const below = stuckStep(STUCK_START, { type: 'tick', seconds: limit.seconds! - 1 }, limit);
        expect(below.offer, `${game} ${band}`).toBe(false);
        expect(stuckStep(below, { type: 'tick', seconds: 1 }, limit).offer, `${game} ${band}`).toBe(true);
      }
    }
    for (const band of AGE_BANDS) expect(stuckStep(STUCK_START, { type: 'tick', seconds: 100_000 }, STUCK.drop[band]).offer).toBe(false);
  });
});

describe('stuck signals and the offer (3.1, 3.2)', () => {
  const limit: StuckLimit = { count: 2, seconds: 60 };
  const run = (events: StuckEvent[], from: StuckState = STUCK_START) => events.reduce((s, e) => stuckStep(s, e, limit), from);

  it('count signals reset only when a puzzle starts and after a swap, never on progress', () => {
    const s = run([{ type: 'fail' }, { type: 'progress' }]);
    expect(s.count).toBe(1);
    expect(run([{ type: 'fail' }, { type: 'start' }]).count).toBe(0);
    expect(run([{ type: 'fail' }, { type: 'swap' }]).count).toBe(0);
  });

  it('time signals also reset on progress', () => {
    expect(run([{ type: 'tick', seconds: 30 }]).seconds).toBe(30);
    expect(run([{ type: 'tick', seconds: 30 }, { type: 'progress' }]).seconds).toBe(0);
    expect(run([{ type: 'tick', seconds: 30 }, { type: 'swap' }]).seconds).toBe(0);
    expect(run([{ type: 'tick', seconds: 30 }, { type: 'start' }]).seconds).toBe(0);
  });

  it('ignores ticks that are not a positive number of seconds', () => {
    for (const seconds of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) expect(run([{ type: 'tick', seconds }])).toEqual(STUCK_START);
  });

  it('the offer hides on progress and stays up until then', () => {
    const up = run([{ type: 'fail' }, { type: 'fail' }]);
    expect(up.offer).toBe(true);
    expect(run([{ type: 'tick', seconds: 5 }], up).offer).toBe(true);
    expect(run([{ type: 'progress' }], up).offer).toBe(false);
  });

  it('shows again on the next increase of a count already at its limit, not on time passing', () => {
    const hidden = run([{ type: 'fail' }, { type: 'fail' }, { type: 'progress' }]);
    expect(hidden.offer).toBe(false);
    expect(run([{ type: 'tick', seconds: 30 }], hidden).offer).toBe(false);
    expect(run([{ type: 'fail' }], hidden).offer).toBe(true);
  });

  it('the time signal shows it again only after reaching its limit again from 0', () => {
    const timedOut = run([{ type: 'tick', seconds: 60 }]);
    expect(timedOut.offer).toBe(true);
    const hidden = run([{ type: 'progress' }], timedOut);
    expect(run([{ type: 'tick', seconds: 59 }], hidden).offer).toBe(false);
    expect(run([{ type: 'tick', seconds: 60 }], hidden).offer).toBe(true);
    // already past the limit: more time is not a fresh event
    const past = { ...STUCK_START, seconds: 90 };
    expect(run([{ type: 'tick', seconds: 10 }], past).offer).toBe(false);
  });

  it('a swap clears the offer and every signal', () => {
    expect(run([{ type: 'fail' }, { type: 'fail' }, { type: 'tick', seconds: 70 }, { type: 'swap' }])).toEqual(STUCK_START);
  });

  it('progress with nothing to reset returns the same state', () => {
    const s = run([{ type: 'fail' }]);
    expect(stuckStep(s, { type: 'progress' }, limit)).toBe(s);
  });
});

describe('Brick Escape failed tries', () => {
  const limit = STUCK.escape['7-8']; // 3 tries
  const best = 6;
  const step = (s: StuckState, e: StuckEvent) => stuckStep(s, e, limit);

  it('each Restart is a failed try', () => {
    let s = STUCK_START;
    s = step(s, { type: 'restart' });
    s = step(s, { type: 'restart' });
    expect(s.count).toBe(2);
    expect(s.offer).toBe(false);
    expect(step(s, { type: 'restart' }).offer).toBe(true);
  });

  it(`counts once per try when the moves reach ${TRY_OVER_FACTOR} times Best`, () => {
    let s = STUCK_START;
    s = step(s, { type: 'moves', moves: 17, best });
    expect(s.count).toBe(0);
    s = step(s, { type: 'moves', moves: 18, best });
    expect(s.count).toBe(1);
    s = step(s, { type: 'moves', moves: 19, best });
    expect(s.count).toBe(1);
  });

  it('an Undo takes a move back, so dropping under and reaching it again in the same try does not count twice', () => {
    let s = STUCK_START;
    s = step(s, { type: 'moves', moves: 18, best });
    s = step(s, { type: 'moves', moves: 17, best });
    s = step(s, { type: 'moves', moves: 18, best });
    expect(s.count).toBe(1);
  });

  it('an undone move never counts: 17 moves after an Undo is still under', () => {
    let s = STUCK_START;
    s = step(s, { type: 'moves', moves: 17, best });
    s = step(s, { type: 'moves', moves: 16, best });
    s = step(s, { type: 'moves', moves: 17, best });
    expect(s.count).toBe(0);
  });

  it('a Restart starts a new try that can count its own 3 times Best', () => {
    let s = STUCK_START;
    s = step(s, { type: 'moves', moves: 18, best }); // 1
    s = step(s, { type: 'restart' }); // 2
    s = step(s, { type: 'moves', moves: 18, best }); // 3: the limit
    expect(s.count).toBe(3);
    expect(s.offer).toBe(true);
  });

  it('a board with no Best never counts moves', () => {
    expect(step(STUCK_START, { type: 'moves', moves: 99, best: 0 })).toBe(STUCK_START);
    expect(step(STUCK_START, { type: 'moves', moves: 99, best: Number.NaN })).toBe(STUCK_START);
  });
});

describe('level stars over 4 puzzles (section 5)', () => {
  it('Brick Escape: extra moves E = 4, 5, 12, 13 give 3, 2, 2, 1', () => {
    const at = (extra: number) => escapeLevelStars(four({ count: 10, par: 10 }, { count: 10 + extra }));
    expect(at(0)).toBe(3);
    expect(at(4)).toBe(3);
    expect(at(5)).toBe(2);
    expect(at(12)).toBe(2);
    expect(at(13)).toBe(1);
    expect(LEVEL_STAR_RULES.escape).toEqual({ three: 4, two: 12 });
  });

  it('Brick Escape: a hint or a counted clock in any one of the 4 caps at 2', () => {
    for (let i = 0; i < 4; i++) {
      const hint = four({ count: 8, par: 8 });
      hint[i] = { ...hint[i], usedHint: true };
      expect(escapeLevelStars(hint), `hint on ${i}`).toBe(2);
      const clock = four({ count: 8, par: 8 });
      clock[i] = { ...clock[i], outOfTime: true };
      expect(escapeLevelStars(clock), `clock on ${i}`).toBe(2);
    }
    expect(escapeLevelStars(four({ count: 30, par: 8, usedHint: true }))).toBe(1);
  });

  it('Brick Drop: B at the sum of T3 and one over, at the sum of T2 and one over', () => {
    const at = (bricks: number) => dropLevelStars(four({ count: 10, three: 10, two: 14 }, { count: bricks }));
    // sums: T3 = 40, T2 = 56; the first three puzzles used 30 bricks
    expect(at(10)).toBe(3); // B = 40
    expect(at(11)).toBe(2); // 41
    expect(at(26)).toBe(2); // 56
    expect(at(27)).toBe(1); // 57
  });

  it('Brick Drop: a run-out clock caps at 2', () => {
    expect(dropLevelStars(four({ count: 10, three: 10, two: 14 }, { outOfTime: true }))).toBe(2);
  });

  it('Letter Builder: slips S = 1, 2, 4, 5 give 3, 2, 2, 1', () => {
    const at = (slips: number) => lettersLevelStars(four({ count: 0 }, { count: slips }));
    expect(at(0)).toBe(3);
    expect(at(1)).toBe(3);
    expect(at(2)).toBe(2);
    expect(at(4)).toBe(2);
    expect(at(5)).toBe(1);
  });

  it('Letter Builder: a hint caps at 2, and the slips still count', () => {
    expect(lettersLevelStars(four({}, { usedHint: true }))).toBe(2);
    expect(lettersLevelStars(four({}, { count: 5, usedHint: true }))).toBe(1);
  });

  it('only the results passed in count: a swapped puzzle is never one of them, so its hint never caps', () => {
    // the game passes the 4 solved results; a hint on a puzzle swapped away is not among them
    expect(escapeLevelStars(four({ count: 6, par: 6 }))).toBe(3);
    expect(lettersLevelStars(four({ count: 0 }))).toBe(3);
  });

  it('levelStars picks each game’s rule', () => {
    const r = four({ count: 9, par: 6, three: 9, two: 12 });
    expect(levelStars('escape', r)).toBe(escapeLevelStars(r));
    expect(levelStars('drop', r)).toBe(dropLevelStars(r));
    expect(levelStars('letters', r)).toBe(lettersLevelStars(r));
  });

  it('totals add the 4 results, skipping fields a game does not store', () => {
    const r = [result({ count: 7, par: 6, score: 100 }), result({ count: 8, par: 6 }), result({ count: 6, usedHint: true }), result({ count: 9, par: 7, score: 50 })];
    expect(levelTotals(r)).toEqual({ count: 30, par: 19, three: 0, two: 0, score: 150, usedHint: true, outOfTime: false });
    expect(levelTotals([])).toEqual({ count: 0, par: 0, three: 0, two: 0, score: 0, usedHint: false, outOfTime: false });
  });

  it('Brick Drop’s level score is the sum of the 4 puzzle scores', () => {
    expect(levelScore(four({ score: 1200 }, { score: 1220 }))).toBe(4820);
    expect(levelScore(four({}))).toBe(0);
  });
});

describe('Brick Drop brick targets', () => {
  it('with no stack and the stage’s full goal rows, it is today’s starRule exactly', () => {
    for (const stage of STAGES) {
      expect(dropTargets({ goalRows: stage.goalRows, cols: stage.cols, avgCells: averageCells(stage) }), stage.name).toEqual(starRule(stage));
    }
  });

  it('a starter stack takes its filled cells off the ideal', () => {
    // G 4, C 8, K 12, A 4: ideal (32 - 12) / 4 = 5; T3 = ceil(5 + 5) = 10; T2 = ceil(5 + 12) = 17
    expect(dropTargets({ goalRows: 4, cols: 8, filled: 12, avgCells: 4 })).toEqual({ three: 10, two: 17 });
    expect(dropTargets({ goalRows: 4, cols: 8, avgCells: 4 })).toEqual({ three: 13, two: 20 });
  });
});
