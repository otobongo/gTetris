import { describe, expect, it } from 'vitest';
import { isLevelOpen, type GameMeta } from './meta';
import type { GameProgress } from '../shared/progress';

const meta: GameMeta = {
  levelCount: 6,
  chapters: [
    { title: 'A', note: '', start: 0, count: 3 },
    { title: 'B', note: '', start: 3, count: 3 },
    { title: 'More', note: '', start: 6, count: 0, more: true },
  ],
};
const fresh = (over: Partial<GameProgress> = {}): GameProgress => ({ unlocked: 0, stars: {}, best: {}, ...over });

describe('isLevelOpen', () => {
  it('opens only the first level for a new player', () => {
    expect([0, 1, 2, 3, 4, 5].map((i) => isLevelOpen(meta, fresh(), '7-8', i))).toEqual([true, false, false, false, false, false]);
  });

  it('opens the next level once the one before has a star', () => {
    const g = fresh({ stars: { 0: 1 } });
    expect(isLevelOpen(meta, g, '5-6', 1)).toBe(true);
    expect(isLevelOpen(meta, g, '5-6', 2)).toBe(false);
  });

  it('honours levels the store already marks open', () => {
    expect(isLevelOpen(meta, fresh({ unlocked: 4 }), '3-4', 4)).toBe(true);
    expect(isLevelOpen(meta, fresh({ unlocked: 4 }), '3-4', 5)).toBe(false);
  });

  it('opens the first level of every chapter for ages 9 to 10 only', () => {
    expect(isLevelOpen(meta, fresh(), '9-10', 3)).toBe(true);
    expect(isLevelOpen(meta, fresh(), '9-10', 4)).toBe(false);
    expect(isLevelOpen(meta, fresh(), '7-8', 3)).toBe(false);
    expect(isLevelOpen(meta, fresh(), null, 3)).toBe(false);
  });

  it('rejects levels outside the game, including an empty chapter start', () => {
    for (const i of [-1, 6, 1.5, Number.NaN]) expect(isLevelOpen(meta, fresh({ unlocked: 99 }), '9-10', i)).toBe(false);
  });
});

describe('isLevelOpen: review additions', () => {
  it('treats a game with no active player (no age band) like ages 3 to 8: chapter starts stay locked', () => {
    expect(isLevelOpen(meta, fresh(), undefined, 0)).toBe(true);
    expect(isLevelOpen(meta, fresh(), undefined, 3)).toBe(false);
  });

  it('opens only the level right after a starred one, not the one after that', () => {
    const g = fresh({ stars: { 2: 1 } });
    expect([0, 1, 2, 3, 4, 5].map((i) => isLevelOpen(meta, g, '5-6', i))).toEqual([true, false, false, true, false, false]);
  });

  it('opens nothing for a game that has no levels yet', () => {
    const none: GameMeta = { levelCount: 0, chapters: [{ title: 'Soon', note: '', start: 0, count: 0, more: true }] };
    for (const band of ['3-4', '9-10'] as const) expect(isLevelOpen(none, fresh({ unlocked: 5 }), band, 0)).toBe(false);
  });
});
