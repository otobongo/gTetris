/**
 * Brick Escape on four-puzzle levels (brief 2, 4.1, 5, 7.1, 9): which route plays what, the level card's
 * lines, the run through the progress store, and the play screen as it first draws (server-rendered here).
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { activePlayer, emptyState, gameOf, progressStore, runOf, type PuzzleResult } from '../../shared/progress';
import { currentLevel } from '../meta';
import { escapeSet } from '../run';
import { meta } from './meta';
import {
  GAME,
  HELP_LINE,
  PUZZLE_LEVELS,
  clockCaption,
  escapeRules,
  finishedCard,
  levelCard,
  routeFor,
  solvedLine,
} from './puzzles';
import SlideApp from './SlideApp';

const result = (puzzle: number, count: number, par: number, over: Partial<PuzzleResult> = {}): PuzzleResult => ({
  puzzle,
  count,
  par,
  usedHint: false,
  outOfTime: false,
  ...over,
});

describe('routes: #/game/escape plays only the current level', () => {
  it('opens the current level, or the finished state when there is none', () => {
    expect(routeFor([], 0)).toEqual({ kind: 'redirect', to: '/game/escape/1' });
    expect(routeFor([], 19)).toEqual({ kind: 'redirect', to: '/game/escape/20' });
    expect(routeFor([], null)).toEqual({ kind: 'finished' });
  });

  it('plays <n> only when it is the current level; every other level goes back to #/game/escape', () => {
    expect(routeFor(['9'], 8)).toEqual({ kind: 'play', index: 8 });
    expect(routeFor(['31'], 30)).toEqual({ kind: 'play', index: 30 });
    for (const bad of [['8'], ['10'], ['0'], ['32'], ['-1'], ['9.0'], ['1e1'], ['nine'], [''], ['9', 'x']])
      expect(routeFor(bad, 8), JSON.stringify(bad)).toEqual({ kind: 'redirect', to: '/game/escape' });
    expect(routeFor(['9'], null)).toEqual({ kind: 'redirect', to: '/game/escape' });
  });
});

describe('copy (brief 9.1)', () => {
  it('the solved line counts the moves', () => {
    expect(solvedLine(6)).toBe('Solved in 6 moves.');
    expect(solvedLine(1)).toBe('Solved in 1 move.');
  });

  it('the clock caption names each puzzle’s clock', () => {
    expect(clockCaption('Maya', 45, 1.5, '1:08')).toBe('Maya: each puzzle gets 45s x 1.5 = 1:08');
    expect(clockCaption(null, 45, 2, '1:30')).toBe('Each puzzle gets 45s x 2 = 1:30');
  });

  it('the help line is the decided door rule', () => {
    expect(HELP_LINE).toBe('Drag each brick out through the door of its color.');
  });

  it('the level card states the moves, the rule over the four Bests, and the cap only when it applied', () => {
    const plain = [result(0, 11, 10), result(1, 10, 10), result(2, 10, 9), result(3, 12, 11)];
    expect(levelCard(9, plain, 9, 20)).toEqual({
      title: 'You finished Level 9',
      fact: '4 puzzles in 43 moves.',
      rule: '3 stars: 44 moves or fewer. 2 stars: 52 or fewer.',
      cap: undefined,
      primary: 'Play Level 10',
      home: false,
    });
    const hinted = [...plain.slice(0, 3), result(3, 12, 11, { usedHint: true })];
    expect(levelCard(9, hinted, 9, 20).cap).toBe('Using a hint caps the level at 2 stars.');
    const both = [result(0, 11, 10, { outOfTime: true }), ...hinted.slice(1)];
    expect(levelCard(9, both, 9, 20).cap).toBe('Using a hint, or running out of time, caps the level at 2 stars.');
  });

  it('names the level the finish moved on to, even when it wraps round', () => {
    expect(levelCard(31, [result(0, 14, 14)], 4, 80).primary).toBe('Play Level 5');
  });

  it('with no next level the card is the finished card with one button home', () => {
    const card = levelCard(31, [result(0, 14, 14)], null, 78);
    expect(card).toEqual(finishedCard(78));
    expect(card).toEqual({ title: 'You finished every level!', fact: '31 levels, 78 of 93 stars.', primary: 'Back to games', home: true });
  });

  it('has no em or en dashes and no old praise lines', () => {
    const lines = [HELP_LINE, solvedLine(6), JSON.stringify(levelCard(9, [result(0, 1, 1)], 9, 3)), JSON.stringify(finishedCard(3))];
    for (const line of lines) {
      expect(line).not.toMatch(/[–—]/);
      expect(line).not.toMatch(/Brilliant|Great job/);
    }
  });
});

describe('the level run through the progress store', () => {
  beforeEach(() => {
    progressStore.replace(emptyState());
    progressStore.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' });
  });
  afterAll(() => progressStore.replace(emptyState()));

  const player = () => activePlayer(progressStore.getState());

  it('each level’s set is named by its id, so new boards restart only that level', () => {
    for (const [i, l] of PUZZLE_LEVELS.entries()) expect(escapeRules(i).set).toBe(escapeSet(l.id));
    expect(escapeRules(0).levelCount).toBe(31);
  });

  it('starts at puzzle 1, the original board, and four solves finish the level and move current on', () => {
    const run = progressStore.startRun(GAME, 0, escapeRules(0));
    expect(run.queue[0]).toBe(0);
    const pars = PUZZLE_LEVELS[0].puzzles.map((p) => p.par);
    for (const p of [0, 1, 2]) {
      const out = progressStore.recordPuzzle(GAME, 0, result(p, pars[p], pars[p]), escapeRules(0));
      expect(out.kind).toBe('saved');
    }
    expect(runOf(player(), GAME, 0)?.solved).toHaveLength(3);
    const out = progressStore.recordPuzzle(GAME, 0, result(3, pars[3] + 5, pars[3]), escapeRules(0));
    expect(out).toMatchObject({ kind: 'finished', level: 0, stars: 2, next: 1 });
    const game = gameOf(player(), GAME);
    expect(game.stars[0]).toBe(2);
    expect(runOf(player(), GAME, 0)).toBeNull();
    expect(currentLevel(meta, game)).toBe(1);
  });

  it('a swap moves the board on screen to the end of the queue and keeps the solved ones', () => {
    progressStore.startRun(GAME, 4, escapeRules(4));
    progressStore.recordPuzzle(GAME, 4, result(0, 10, 10), escapeRules(4));
    const swapped = progressStore.swapPuzzle(GAME, 4);
    expect(swapped?.queue).toEqual([2, 3, 4, 5, 1]);
    expect(swapped?.solved).toHaveLength(1);
  });

  it('a hint or a run-out clock on any of the four caps the level at 2 stars', () => {
    progressStore.startRun(GAME, 2, escapeRules(2));
    const pars = PUZZLE_LEVELS[2].puzzles.map((p) => p.par);
    for (const p of [0, 1, 2]) progressStore.recordPuzzle(GAME, 2, result(p, pars[p], pars[p]), escapeRules(2));
    const out = progressStore.recordPuzzle(GAME, 2, result(3, pars[3], pars[3], { outOfTime: true }), escapeRules(2));
    expect(out).toMatchObject({ kind: 'finished', stars: 2 });
  });
});

describe('the play screen as it first draws', () => {
  beforeEach(() => {
    progressStore.replace(emptyState());
    progressStore.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' });
  });
  afterAll(() => progressStore.replace(emptyState()));

  const html = (params: string[]) => renderToString(createElement(SlideApp, { params }));

  it('shows Level 1 with four dots, Restart puzzle, Back to home and the door rule, and no level grid', () => {
    const out = html(['1']);
    expect(out).toContain('<h1>Level 1</h1>');
    expect(out).toContain('aria-label="Puzzle 1 of 4. 0 solved."');
    expect(out).toContain('aria-label="Restart puzzle"');
    expect(out).toContain('aria-label="Back to home"');
    expect(out).toContain('Maya: each puzzle gets 30s x 1.5 = 0:45');
    expect(out).not.toContain('Back to levels');
    expect(out).not.toContain('New puzzle');
    expect(out).not.toContain('role="dialog"');
  });

  it('resumes a level at its next unsolved puzzle', () => {
    progressStore.startRun(GAME, 0, escapeRules(0));
    progressStore.recordPuzzle(GAME, 0, result(0, 4, 4), escapeRules(0));
    progressStore.recordPuzzle(GAME, 0, result(1, 4, 4), escapeRules(0));
    expect(html(['1'])).toContain('aria-label="Puzzle 3 of 4. 2 solved."');
  });

  it('draws nothing for a level that is not the current one (it redirects)', () => {
    expect(html(['2'])).toBe('');
    expect(html([])).toBe('');
  });

  it('shows the finished state once every level has stars', () => {
    for (let i = 0; i < 31; i++) progressStore.recordStars(GAME, i, i === 30 ? 2 : 3);
    const out = html([]);
    expect(out).toContain('<h1>Brick Escape</h1>');
    expect(out).toContain('You finished every level!');
    expect(out).toContain('31 levels, 92 of 93 stars.');
    expect(out).toContain('A grown-up can pick a level to play again.');
    expect(out).toContain('aria-label="2 of 3 stars"');
    expect(out).toContain('Back to games');
    expect(out).not.toContain('Puzzle 1 of 4');
  });
});
