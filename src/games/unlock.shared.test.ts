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

/**
 * Games on four-puzzle levels play only the child's current level (brief 2.6, 7.4); any other level number
 * redirects. Updated for Brick Escape and Brick Drop: they used to open every level isLevelOpen opened.
 */
const CURRENT_ONLY = new Set<string>(['escape', 'drop']);

describe('every game opens exactly the levels the shared rule opens', () => {
  for (const { id, App } of GAMES) {
    const rule = CURRENT_ONLY.has(id) ? 'it is the current level' : 'isLevelOpen says so';
    it(`${id}: a level opens if and only if ${rule}, at every age`, () => {
      const meta = getGame(id)!.meta!;
      for (const band of AGE_BANDS) {
        for (const setup of SETUPS) {
          const game = playAs(id, band, setup);
          for (let i = -1; i <= meta.levelCount; i++) {
            const where = `${id} ${band} ${JSON.stringify(setup)} level ${i + 1}`;
            const want = CURRENT_ONLY.has(id) ? i === currentLevel(meta, game) : isLevelOpen(meta, game, band, i);
            expect(opens(App, i + 1), where).toBe(want);
          }
        }
      }
    });
  }

  // Four-puzzle levels (brief 2.6, 7.4): Letter Builder's `#/game/letters/<n>` plays only the child's
  // current level; every other n, open or not, goes back to `#/game/letters`.
  it('letters: a level opens if and only if it is the current level, at every age', () => {
    const meta = getGame('letters')!.meta!;
    for (const band of AGE_BANDS) {
      for (const setup of [...SETUPS, { stars: Object.fromEntries(Array.from({ length: meta.levelCount }, (_, i) => [i, 2])) }]) {
        const game = playAs('letters', band, setup);
        const current = currentLevel(meta, game);
        for (let i = -1; i <= meta.levelCount; i++) {
          const where = `letters ${band} ${JSON.stringify(setup)} level ${i + 1}`;
          expect(opens(LettersApp, i + 1), where).toBe(i >= 0 && i === current);
        }
      }
      // A grown-up's pick, locked or not, is the one level that opens.
      for (const pick of [9, 20]) {
        playAs('letters', band, { stars: { 0: 3 } });
        progressStore.pickLevel('letters', pick, meta.levelCount);
        for (let i = 0; i < meta.levelCount; i++) expect(opens(LettersApp, i + 1), `letters ${band} pick ${pick} level ${i + 1}`).toBe(i === pick);
      }
    }
  });
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
