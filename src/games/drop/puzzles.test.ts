import { describe, expect, it } from 'vitest';
import { dropLevelStars, dropTargets, levelScore } from '../run';
import { applyAction } from './controls';
import {
  GAME_DONE_NOTE,
  HALF_GOAL_FROM,
  RUN_INIT,
  gameDoneCard,
  introLines,
  newBrickLine,
  newRound,
  overLine,
  pressRound,
  puzzleGame,
  puzzleGoalRows,
  puzzleResult,
  puzzleRules,
  puzzleTargets,
  readyLines,
  retryRound,
  runRules,
  solvedLine,
  stageCard,
  tickRound,
} from './puzzles';
import { STAGES, averageCells, starRule } from './stages';
import { starterFor } from './starters';
import { timerPlan } from './timer';

describe('per-puzzle goal rows (decision 9)', () => {
  it('keeps the stage goal on Stages 1 to 5 and halves it, rounded up, from Stage 6', () => {
    expect(STAGES.map((_, i) => puzzleGoalRows(i))).toEqual([3, 4, 5, 6, 6, 4, 4, 5, 5, 5, 6, 8]);
    expect(HALF_GOAL_FROM).toBe(5);
  });

  it('puts the per-puzzle goal into the engine rules and keeps the stage’s board, bricks and speed', () => {
    STAGES.forEach((stage, i) => {
      const r = puzzleRules(i);
      expect(r).toEqual({ cols: stage.cols, rows: stage.rows, pieces: stage.pieces, gravityMs: stage.gravityMs, lockDelayMs: stage.lockDelayMs, goalRows: puzzleGoalRows(i) });
    });
  });

  it('gives each puzzle a clock of its goal rows x 15 s x the age factor, so Stage 12 allows 4 min at ages 5 to 6 and 3 min at 7 to 8', () => {
    const goal = { goalRows: puzzleGoalRows(11) };
    expect(timerPlan(goal, 'auto', '5-6')).toEqual({ kind: 'countdown', seconds: 240 });
    expect(timerPlan(goal, 'auto', '7-8')).toEqual({ kind: 'countdown', seconds: 180 });
    expect(timerPlan(goal, 'auto', '3-4')).toEqual({ kind: 'relaxed', seconds: 240 });
    // four puzzles stay inside the 20-minute default limit on every stage
    for (let i = 0; i < STAGES.length; i++) expect(4 * (timerPlan({ goalRows: puzzleGoalRows(i) }, 'auto', '5-6') as { seconds: number }).seconds).toBeLessThanOrEqual(16 * 60);
  });
});

describe('brick targets T3 and T2 (section 5)', () => {
  it('equals today’s starRule with no stack and the stage’s full goal rows', () => {
    for (const stage of STAGES) expect(dropTargets({ goalRows: stage.goalRows, cols: stage.cols, avgCells: averageCells(stage) })).toEqual(starRule(stage));
  });

  it('takes the starter stack’s filled cells K off the ideal: ideal = (G x C - K) / A', () => {
    STAGES.forEach((stage, i) => {
      for (let p = 0; p < 6; p++) {
        const G = puzzleGoalRows(i);
        const C = stage.cols;
        const A = averageCells(stage);
        const K = starterFor(i, p).filled;
        const ideal = (G * C - K) / A;
        const t = puzzleTargets(i, p);
        expect(t.three, `stage ${i + 1}`).toBe(Math.ceil(ideal + (2.5 * C) / A));
        expect(t.two, `stage ${i + 1}`).toBe(Math.ceil(ideal + (6 * C) / A));
        expect(t.three).toBeLessThan(t.two);
      }
    });
  });

  it('is the same for all 6 puzzles of a stage, because their stacks cut the same cells', () => {
    STAGES.forEach((_, i) => {
      const all = Array.from({ length: 6 }, (_, p) => puzzleTargets(i, p));
      expect(new Set(all.map((t) => `${t.three}/${t.two}`)).size, `stage ${i + 1}`).toBe(1);
    });
  });

  it('asks for fewer bricks on a stack than on an empty board with the same goal', () => {
    STAGES.forEach((stage, i) => {
      const empty = dropTargets({ goalRows: puzzleGoalRows(i), cols: stage.cols, avgCells: averageCells(stage) });
      expect(puzzleTargets(i, 0).three).toBeLessThan(empty.three);
    });
  });
});

describe('the first brick waits (brief 4.2)', () => {
  it('starts with the stack drawn and the first brick at the top, nothing falling and the clock at 0', () => {
    const r = newRound(6, 2);
    expect(r.phase).toBe('ready');
    expect(r.elapsedMs).toBe(0);
    expect(r.game.board).toEqual(starterFor(6, 2).board);
    expect(r.game.active).not.toBeNull();
    expect(r.game.active!.y).toBeLessThanOrEqual(1);
  });

  it('keeps the brick still and the clock at 0 however long the child waits', () => {
    const r = newRound(3, 0);
    let t = r;
    for (let i = 0; i < 600; i++) t = tickRound(t, 100); // a minute of frames
    expect(t).toBe(r);
    expect(t.game.active).toEqual(r.game.active);
    expect(t.elapsedMs).toBe(0);
  });

  it('starts on the first press of any of the four controls, and that press does its own action', () => {
    for (const a of ['left', 'right', 'down', 'rotate'] as const) {
      const r = newRound(4, 1);
      const started = pressRound(r, a);
      expect(started.phase, a).toBe('playing');
      expect(started.game, a).toEqual(applyAction(r.game, a));
      expect(started.elapsedMs, a).toBe(0);
    }
  });

  it('counts time and lets bricks fall only once the round is playing', () => {
    const r = pressRound(newRound(0, 0), 'left');
    const later = tickRound(r, 2500);
    expect(later.elapsedMs).toBe(2500);
    expect(later.game.active!.y).toBeGreaterThan(r.game.active!.y);
  });

  it('starts the same way from the intro sheet’s Start, Next puzzle, Try again and New puzzle: always waiting', () => {
    expect(newRound(0, 0, 'intro').phase).toBe('intro');
    expect(tickRound(newRound(0, 0, 'intro'), 1000).elapsedMs).toBe(0);
    // a press under the intro sheet does nothing
    const intro = newRound(0, 0, 'intro');
    expect(pressRound(intro, 'left')).toBe(intro);
  });

  it('stops the clock while paused, solved or out of room, and ignores presses then', () => {
    const playing = tickRound(pressRound(newRound(2, 0), 'down'), 400);
    for (const phase of ['paused', 'solved', 'over'] as const) {
      const r = { ...playing, phase };
      expect(tickRound(r, 1000), phase).toBe(r);
      expect(pressRound(r, 'left'), phase).toBe(r);
    }
  });

  it('ignores a zero or negative frame', () => {
    const r = pressRound(newRound(1, 0), 'left');
    expect(tickRound(r, 0)).toBe(r);
    expect(tickRound(r, -5)).toBe(r);
    expect(tickRound(r, Number.NaN)).toBe(r);
  });

  it('replays the same stack and bricks on Try again', () => {
    const a = newRound(5, 4).game;
    const b = puzzleGame(5, 4);
    expect(b.board).toEqual(a.board);
    expect([b.active!.id, ...b.queue]).toEqual([a.active!.id, ...a.queue]);
  });
});

describe('results and the store rules', () => {
  it('stores bricks used, the targets, the score and a run-out clock per puzzle', () => {
    const t = puzzleTargets(3, 2);
    expect(puzzleResult(3, 2, { placed: 14, score: 820 }, true)).toEqual({ puzzle: 2, count: 14, three: t.three, two: t.two, score: 820, usedHint: false, outOfTime: true });
  });

  it('works the stage’s stars out over its 4 puzzles and sums their scores', () => {
    const rules = runRules();
    expect(rules.set).toBe('drop:1');
    expect(rules.seed).toBe(0);
    expect(rules.levelCount).toBe(12);
    expect(rules.stars).toBe(dropLevelStars);
    expect(rules.score).toBe(levelScore);
    expect(RUN_INIT).toEqual({ set: 'drop:1', seed: 0 });
  });

  it('gives 3 stars at the sum of T3, 2 just over it, and caps a run-out clock at 2', () => {
    const t = puzzleTargets(3, 0);
    const four = (count: number, outOfTime = false) => [0, 1, 2, 3].map((p) => ({ ...puzzleResult(3, p, { placed: count, score: 100 }, outOfTime) }));
    expect(dropLevelStars(four(t.three))).toBe(3);
    expect(dropLevelStars([...four(t.three).slice(0, 3), puzzleResult(3, 3, { placed: t.three + 1, score: 0 }, false)])).toBe(2);
    expect(dropLevelStars(four(t.two))).toBe(2);
    expect(dropLevelStars(four(t.two + 1))).toBe(1);
    expect(dropLevelStars(four(t.three, true))).toBe(2);
    expect(levelScore(four(t.three))).toBe(400);
  });
});

describe('Brick Drop lines (brief 9.1)', () => {
  it('names the new brick while the first one waits, and says the swap line once after a swap', () => {
    expect(readyLines(6, false)).toEqual(['Press any button to start.', 'New bricks: Zig and Zag.']);
    expect(readyLines(4, true)).toEqual(['Here is a different puzzle.', 'Press any button to start.', 'New brick: Tee.']);
    expect(readyLines(7, false)).toEqual(['Press any button to start.']);
    expect(newBrickLine(8)).toBe('');
    expect(newBrickLine(9)).toBe('New brick: Flag.');
  });

  it('says the solved and out-of-room lines', () => {
    expect(solvedLine(14)).toBe('Cleared with 14 bricks.');
    expect(overLine(2, 6)).toBe('The bricks reached the top. You cleared 2 of 6 rows.');
  });

  it('writes the intro with the per-puzzle goal and the 3-star rule over 4 puzzles', () => {
    const three = 4 * puzzleTargets(3, 0).three;
    expect(introLines(3, false)).toEqual(['Clear 6 rows in each puzzle. Solve 4 to finish the stage.', `3 stars: ${three} bricks or fewer over the 4 puzzles.`]);
    expect(introLines(11, true)[0]).toBe('Clear 8 rows in each puzzle. Solve 4 to finish the stage.');
    expect(introLines(11, true)[2]).toBe('Running out of time caps the stage at 2 stars.');
  });

  it('writes the level card from the 4 results, with the cap line only when it applied', () => {
    const t = puzzleTargets(3, 0);
    const results = [0, 1, 2, 3].map((p) => puzzleResult(3, p, { placed: 14 + p, score: 1000 + p }, false));
    expect(stageCard(3, results)).toEqual({
      title: 'You finished Stage 4',
      fact: '4 puzzles with 62 bricks. Score 4006.',
      rule: `3 stars: ${4 * t.three} bricks or fewer. 2 stars: ${4 * t.two} or fewer.`,
      cap: undefined,
    });
    const late = [...results.slice(0, 3), puzzleResult(3, 3, { placed: 17, score: 1003 }, true)];
    expect(stageCard(3, late).cap).toBe('Running out of time caps the stage at 2 stars.');
  });

  it('writes the game-done card and its grown-up note', () => {
    expect(gameDoneCard(30)).toEqual({ title: 'You finished every stage!', fact: '12 stages, 30 of 36 stars.' });
    expect(GAME_DONE_NOTE).toBe('A grown-up can pick a stage to play again.');
  });

  it('uses no em or en dashes', () => {
    const lines = [...readyLines(6, true), ...introLines(11, true), solvedLine(3), overLine(1, 4), gameDoneCard(1).title, gameDoneCard(1).fact, GAME_DONE_NOTE];
    for (const l of lines) expect(l).not.toMatch(/[–—]/);
  });
});

describe('Try again only puts the bricks back (user decision D1)', () => {
  /** A round played on for `ms`, with one press to start it. */
  const played = (ms: number) => tickRound(pressRound(newRound(0, 2), 'left'), ms);

  it('starts the same puzzle again from its first stack, its first brick waiting', () => {
    const before = played(5_000);
    const again = retryRound({ ...before, phase: 'over' });
    const fresh = newRound(0, 2);
    expect(again.index).toBe(0);
    expect(again.puzzle).toBe(2);
    expect(again.phase).toBe('ready');
    expect(again.game).toEqual(fresh.game);
  });

  it('keeps the time already on the clock, so a run-out clock still caps the level', () => {
    const plan = timerPlan({ goalRows: puzzleGoalRows(0) }, 'auto', '7-8');
    expect(plan.kind).toBe('countdown');
    const seconds = plan.kind === 'countdown' ? plan.seconds : 0;
    const before = played(seconds * 1000 + 1_000);
    const again = retryRound({ ...before, phase: 'over' });
    expect(again.elapsedMs).toBe(before.elapsedMs);
    // The waiting brick does not move the clock, and play goes on from where it was.
    expect(tickRound(again, 10_000).elapsedMs).toBe(before.elapsedMs);
    expect(tickRound(pressRound(again, 'left'), 500).elapsedMs).toBe(before.elapsedMs + 500);
  });

  it('a round with no time played comes back at 0', () => {
    expect(retryRound(newRound(3, 1)).elapsedMs).toBe(0);
  });
});
