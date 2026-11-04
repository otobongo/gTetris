/**
 * Brick Drop's routes and screens, server-rendered (no browser): `#/game/drop` shows the finished
 * state once every stage has stars (brief 2.5), and a stage opens on its intro sheet with the four
 * dots and the starter stack (brief 2.2, 4.2, 7.1).
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { emptyState, progressStore } from '../../shared/progress';
import DropApp from './DropApp';
import { STAGES, currentStage } from './stages';

const render = (params: string[]) => renderToString(createElement(DropApp, { params }));

beforeEach(() => {
  progressStore.replace(emptyState());
  progressStore.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' });
});
afterAll(() => progressStore.replace(emptyState()));

describe('#/game/drop', () => {
  it('redirects to the current stage (renders nothing itself) while a stage has no stars', () => {
    expect(render([])).toBe('');
    expect(currentStage()).toBe(0);
  });

  it('shows the finished state once every stage has stars: no dots, the finished card and the grown-up note', () => {
    STAGES.forEach((_, i) => progressStore.recordStars('drop', i, 2));
    expect(currentStage()).toBeNull();
    const html = render([]);
    expect(html).toContain('Brick Drop');
    expect(html).toContain('You finished every stage!');
    expect(html).toContain('12 stages, 24 of 36 stars.');
    expect(html).toContain('A grown-up can pick a stage to play again.');
    expect(html).toContain('Back to games');
    expect(html).toContain('role="dialog"');
    expect(html).not.toContain('bw-dots');
    expect(html).not.toContain('Move left');
  });

  it('opens a stage a grown-up picked after the game was finished', () => {
    STAGES.forEach((_, i) => progressStore.recordStars('drop', i, 3));
    progressStore.pickLevel('drop', 4, STAGES.length);
    expect(currentStage()).toBe(4);
    expect(render([])).toBe('');
  });
});

describe('#/game/drop/<n>', () => {
  it('opens on the intro sheet with the per-puzzle goal, four dots and the stage title', () => {
    const html = render(['1']);
    expect(html).toContain('Stage 1');
    expect(html).toContain('Puzzle 1 of 4. 0 solved.');
    expect(html).toContain('Clear 3 rows in each puzzle. Solve 4 to finish the stage.');
    expect(html).toContain('Start');
    expect(html).toContain('Back to home');
    expect(html).not.toContain('Play again');
    expect(html).not.toContain('Stage clear!');
  });

  it('shows the dots from the stored run when a child comes back mid-stage', () => {
    progressStore.startRun('drop', 0, { set: 'drop:1', seed: 0 });
    progressStore.recordPuzzle('drop', 0, { puzzle: 0, count: 9, three: 19, two: 36, score: 300, usedHint: false, outOfTime: false }, {
      set: 'drop:1',
      seed: 0,
      levelCount: STAGES.length,
      stars: () => 3,
    });
    expect(render(['1'])).toContain('Puzzle 2 of 4. 1 solved.');
  });

  it('draws nothing for a locked or unknown stage, which goes back to #/game/drop', () => {
    expect(render(['3'])).toBe('');
    expect(render(['13'])).toBe('');
    expect(render(['x'])).toBe('');
  });

  it('draws nothing for an open stage that is not the current one (brief 2.6, 7.4)', () => {
    progressStore.recordStars('drop', 0, 3);
    progressStore.recordStars('drop', 1, 2);
    expect(currentStage()).toBe(2);
    expect(render(['1'])).toBe('');
    expect(render(['2'])).toBe('');
    expect(render(['3'])).toContain('Stage 3');
  });
});
