/**
 * One unlock rule for every game (review): the Levels screen, Brick Escape, Brick Drop and Letter
 * Builder all open a level by games/meta.ts isLevelOpen, and the Play button of Brick Drop picks its
 * stage by currentLevel (brief 2.6). The games are server-rendered here (no browser): a level that opens draws
 * its board, a locked one draws nothing and redirects to Levels.
 */
import { createElement, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { afterAll, describe, expect, it } from 'vitest';
import { AGE_BANDS, activePlayer, emptyGame, emptyState, gameOf, progressStore, type AgeBand, type GameProgress } from '../shared/progress';
import { planLevels } from '../screens/logic/levels';
import { currentStage } from './drop/stages';
import DropApp from './drop/DropApp';
import LettersApp from './letters/LettersApp';
import SlideApp from './slide/SlideApp';
import { currentLevel, isLevelOpen, type GameMeta } from './meta';
import { getGame } from './registry';

type Setup = { stars?: Record<number, number>; unlock?: number };

const GAMES: { id: 'escape' | 'drop' | 'letters'; App: ComponentType<{ params: string[] }> }[] = [
  { id: 'escape', App: SlideApp },
  { id: 'drop', App: DropApp },
  { id: 'letters', App: LettersApp },
];

const SETUPS: Setup[] = [{}, { stars: { 0: 2 } }, { stars: { 0: 3, 1: 1, 2: 2 } }, { stars: { 5: 1 } }, { unlock: 4 }, { stars: { 0: 1 }, unlock: 7 }];

function playAs(gameId: string, band: AgeBand, setup: Setup): GameProgress {
  progressStore.replace(emptyState());
  progressStore.addPlayer({ name: 'Maya', ageBand: band, color: 'blue' });
  for (const [lv, s] of Object.entries(setup.stars ?? {})) progressStore.recordStars(gameId, Number(lv), s);
  if (setup.unlock !== undefined) progressStore.unlockLevel(gameId, setup.unlock);
  return gameOf(activePlayer(progressStore.getState()), gameId);
}

const opens = (App: ComponentType<{ params: string[] }>, n: number) => renderToString(createElement(App, { params: [String(n)] })).length > 0;

afterAll(() => progressStore.replace(emptyState()));

describe('every game opens exactly the levels the shared rule opens', () => {
  for (const { id, App } of GAMES) {
    it(`${id}: a level opens if and only if isLevelOpen says so, at every age`, () => {
      const meta = getGame(id)!.meta!;
      for (const band of AGE_BANDS) {
        for (const setup of SETUPS) {
          const game = playAs(id, band, setup);
          for (let i = -1; i <= meta.levelCount; i++) {
            const where = `${id} ${band} ${JSON.stringify(setup)} level ${i + 1}`;
            expect(opens(App, i + 1), where).toBe(isLevelOpen(meta, game, band, i));
          }
        }
      }
    });
  }
});

describe('currentLevel: where Play goes', () => {
  const META: GameMeta = {
    levelCount: 6,
    chapters: [
      { title: 'A', note: '', start: 0, count: 3 },
      { title: 'B', note: '', start: 3, count: 3 },
    ],
  };
  const game = (stars: Record<number, number>, unlocked = 0): GameProgress => ({ ...emptyGame(), stars, unlocked });

  it('is the first level with no stars', () => {
    expect(currentLevel(META, game({}))).toBe(0);
    expect(currentLevel(META, game({ 0: 2, 1: 1 }, 2))).toBe(2);
    expect(currentLevel(META, game({ 0: 1, 2: 3 }, 3))).toBe(1);
  });

  // Updated for brief 2.5 and 2.6 (decision 3): a game with every level starred is finished (null)
  // instead of replaying its last level; a game with no levels is also null.
  it('is null once every level has a star, and for a game with no levels', () => {
    expect(currentLevel(META, game({ 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, 6))).toBeNull();
    expect(currentLevel({ levelCount: 0, chapters: [] }, game({}))).toBeNull();
  });

  it('agrees with the Levels plan for every game, age and setup', () => {
    for (const { id } of GAMES) {
      const meta = getGame(id)!.meta!;
      for (const band of AGE_BANDS) {
        for (const setup of SETUPS) {
          const g = playAs(id, band, setup);
          const plan = planLevels(meta, g, band);
          expect(currentLevel(meta, g), `${id} ${band} ${JSON.stringify(setup)}`).toBe(plan.current);
        }
      }
    }
  });

  it('is what Brick Drop’s Play button opens, including stages a grown-up unlocked', () => {
    const meta = getGame('drop')!.meta!;
    for (const band of AGE_BANDS) {
      for (const setup of SETUPS) {
        const g = playAs('drop', band, setup);
        expect(currentStage(), `${band} ${JSON.stringify(setup)}`).toBe(currentLevel(meta, g));
      }
    }
  });
});
