/**
 * Decision D2: using a hint, or running out of a counted clock, caps a level at 2 stars. It only ever
 * costs the third star, and Brick Escape, Brick Drop and Letter Builder all use the same helper.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAGES, stageStars, starRule, starsEarned } from './drop/stages';
import { ranOut, timerPlan } from './drop/timer';
import { STAR_RULE, lettersStars, starsForSlips } from './letters/logic';
import { starsFor } from './slide/engine';
import { CAPPED_STARS, MAX_STARS, capRule, capStars } from './stars';

const CAPS = [
  { usedHint: false, outOfTime: false },
  { usedHint: true, outOfTime: false },
  { usedHint: false, outOfTime: true },
  { usedHint: true, outOfTime: true },
];

describe('the shared star cap', () => {
  it('leaves the stars alone when there was no hint and the clock did not run out', () => {
    for (const s of [0, 1, 2, 3]) {
      expect(capStars(s)).toBe(s);
      expect(capStars(s, { usedHint: false, outOfTime: false })).toBe(s);
    }
  });

  it('takes 3 stars down to 2 after a hint or a run-out clock, and keeps 2 or fewer as they are', () => {
    for (const caps of CAPS.slice(1)) {
      expect(capStars(3, caps)).toBe(CAPPED_STARS);
      expect(capStars(2, caps)).toBe(2);
      expect(capStars(1, caps)).toBe(1);
      expect(capStars(0, caps)).toBe(0);
    }
  });

  it('costs one star at most, even with a hint and the clock run out together', () => {
    for (const s of [0, 1, 2, 3]) for (const caps of CAPS) expect(s - capStars(s, caps), JSON.stringify({ s, caps })).toBeLessThanOrEqual(1);
    expect(capStars(3, { usedHint: true, outOfTime: true })).toBe(2);
  });

  it('pulls values outside 0 to 3 back in and rounds fractions', () => {
    expect(capStars(5)).toBe(MAX_STARS);
    expect(capStars(5, { usedHint: true })).toBe(CAPPED_STARS);
    expect(capStars(-2)).toBe(0);
    expect(capStars(2.6)).toBe(3);
    expect(capStars(Number.NaN)).toBe(0);
    expect(capStars(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('names only the caps a game has, and has no dashes', () => {
    expect(capRule({ hint: true })).toBe('Using a hint caps the level at 2 stars.');
    expect(capRule({ clock: true }, 'stage')).toBe('Running out of time caps the stage at 2 stars.');
    expect(capRule({ hint: true, clock: true })).toBe('Using a hint, or running out of time, caps the level at 2 stars.');
    expect(capRule({})).toBe('');
    for (const line of [capRule({ hint: true }), capRule({ clock: true }), capRule({ hint: true, clock: true })]) expect(line).not.toMatch(/[–—]/);
  });
});

describe('every game follows the shared cap', () => {
  it('Brick Escape: the move rule, then the cap', () => {
    // par 10: 10 moves is 3 stars, 13 is 2, 14 is 1
    for (const [moves, base] of [[10, 3], [13, 2], [14, 1]] as const) {
      for (const caps of CAPS) expect(starsFor(moves, 10, caps.usedHint, caps.outOfTime), `${moves} ${JSON.stringify(caps)}`).toBe(capStars(base, caps));
    }
  });

  it('Brick Drop: the brick rule, then the cap for a run-out clock', () => {
    const stage = STAGES[3];
    const { three, two } = starRule(stage);
    for (const bricks of [three, two, two + 1]) {
      expect(stageStars(stage, bricks, false)).toBe(starsEarned(stage, bricks));
      expect(stageStars(stage, bricks, true)).toBe(capStars(starsEarned(stage, bricks), { outOfTime: true }));
    }
    expect(stageStars(stage, three, true)).toBe(2);
    expect(stageStars(stage, two + 1, true)).toBe(1);
  });

  it('Letter Builder: a hint caps at 2 and is no longer counted as a slip', () => {
    expect(lettersStars(0, false)).toBe(3);
    expect(lettersStars(0, true)).toBe(2);
    expect(lettersStars(1, true)).toBe(2);
    expect(lettersStars(4, true)).toBe(2);
    expect(lettersStars(5, true)).toBe(1);
    // a hint only ever costs the third star
    for (let slips = 0; slips <= 12; slips++) {
      expect(lettersStars(slips, false)).toBe(starsForSlips(slips));
      expect(lettersStars(slips, false) - lettersStars(slips, true), `slips ${slips}`).toBeLessThanOrEqual(1);
    }
  });

  it('Letter Builder states the hint cap on its win card instead of calling a hint a slip', () => {
    expect(STAR_RULE).toContain('Using a hint caps the level at 2 stars.');
    expect(STAR_RULE).not.toMatch(/hint counts as a slip/i);
    expect(STAR_RULE).not.toMatch(/[–—]/);
  });
});

describe('Brick Drop: when the clock has run out', () => {
  const stage = STAGES[3];

  it('runs out only on a countdown, once the time is used up', () => {
    const plan = timerPlan(stage, 'auto', '9-10');
    if (plan.kind !== 'countdown') throw new Error('expected a countdown');
    expect(ranOut(plan, 0)).toBe(false);
    expect(ranOut(plan, plan.seconds - 0.5)).toBe(false);
    expect(ranOut(plan, plan.seconds)).toBe(true);
    expect(ranOut(plan, plan.seconds + 600)).toBe(true);
  });

  it('never runs out on the relaxed sand timer or with the timer off', () => {
    expect(ranOut(timerPlan(stage, 'relaxed', '9-10'), 10_000)).toBe(false);
    expect(ranOut(timerPlan(stage, 'auto', '3-4'), 10_000)).toBe(false);
    expect(ranOut(timerPlan(stage, 'off', '9-10'), 10_000)).toBe(false);
  });
});

describe('every play screen records the capped stars', () => {
  const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

  // Updated for brief section 5: Brick Escape records stars once per level, over its 4 solved puzzles, through
  // the store's recordPuzzle with escapeLevelStars; each puzzle result carries its hint and run-out clock.
  it('Brick Escape records the level stars from escapeLevelStars, with each puzzle’s hint and run-out clock passed in', () => {
    const escape = source('./slide/SlideGame.tsx');
    const rules = source('./slide/puzzles.ts');
    expect(rules).toMatch(/stars: escapeLevelStars/);
    expect(escape).toMatch(/usedHint: hintRef\.current,\s*outOfTime: counted && tLeftRef\.current <= 0,/);
    expect(escape).toMatch(/progressStore\.recordPuzzle\(GAME, index, result, escapeRules\(index\)\)/);
    expect(escape).not.toMatch(/recordStars\(/);
  });

  // Updated for brief section 5: Brick Drop now records its stars once per stage, over the 4 solved
  // puzzles, through the store's recordPuzzle with dropLevelStars (which applies the shared cap). Each
  // puzzle passes ranOut into its result, so a run-out clock still caps the stage.
  it('Brick Drop records the stage stars over 4 puzzles from dropLevelStars, with ranOut in each result', () => {
    const drop = source('./drop/Play.tsx');
    expect(drop).toMatch(/const outOfTime = ranOut\(planRef\.current, /);
    expect(drop).toMatch(/progressStore\.recordPuzzle\(GAME, index, result, runRules\(\)/);
    expect(source('./drop/puzzles.ts')).toMatch(/stars: dropLevelStars/);
    expect(drop).not.toMatch(/starsEarned\(/);
  });

  it('Letter Builder records the stars from lettersStars, never the slip rule alone', () => {
    const letters = source('./letters/LettersApp.tsx');
    expect(letters).toMatch(/const stars = lettersStars\(slipsRef\.current, usedHintRef\.current\);\s*recordStars\(GAME, level, stars\)/);
    expect(letters).not.toMatch(/starsForSlips\(/);
  });

  it('no game file caps stars on its own: only games/stars.ts uses the number 2 as a cap', () => {
    for (const path of ['./slide/engine.ts', './drop/stages.ts', './letters/logic.ts']) {
      expect(source(path), path).toContain("from '../stars'");
      expect(source(path), path).not.toMatch(/Math\.min\(\s*2\b|Math\.min\([^)]*,\s*2\s*\)/);
    }
  });
});
