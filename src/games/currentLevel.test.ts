/** Brief 2.6: one rule for the current level, used by every screen. */
import { describe, expect, it } from 'vitest';
import { emptyGame, type GameProgress } from '../shared/progress';
import { currentLevel, isLevelOpen, type GameMeta } from './meta';

const meta = (levelCount: number): GameMeta => ({ levelCount, chapters: [{ title: 'All', note: '', start: 0, count: levelCount }] });
const game = (over: Partial<GameProgress> = {}): GameProgress => ({ ...emptyGame(), ...over });
const starred = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, 2]));

describe('currentLevel', () => {
  it('a new child starts at Level 1', () => {
    expect(currentLevel(meta(31), game())).toBe(0);
  });

  it('a frontier child is on the first level with no stars, which is always open', () => {
    const g = game({ stars: starred(9), unlocked: 9 });
    expect(currentLevel(meta(31), g)).toBe(9);
    expect(isLevelOpen(meta(31), g, '5-6', 9)).toBe(true);
  });

  it('skips over a gap only to the first level with no stars', () => {
    expect(currentLevel(meta(10), game({ stars: { 0: 3, 1: 2, 3: 1 }, unlocked: 4 }))).toBe(2);
  });

  it('a stored pick wins: a finished level (replay), an open one and a locked one', () => {
    const frontier = { stars: starred(9), unlocked: 9 };
    expect(currentLevel(meta(31), game({ ...frontier, current: 2 }))).toBe(2);
    expect(currentLevel(meta(31), game({ ...frontier, current: 9 }))).toBe(9);
    expect(currentLevel(meta(31), game({ ...frontier, current: 19 }))).toBe(19);
  });

  it('ignores a stored current outside the game, and falls back to the first level with no stars', () => {
    for (const current of [31, 99, -1, 2.5, Number.NaN]) {
      expect(currentLevel(meta(31), game({ stars: starred(4), current })), String(current)).toBe(4);
    }
  });

  it('is null when every level is starred', () => {
    expect(currentLevel(meta(12), game({ stars: starred(12), unlocked: 12 }))).toBeNull();
  });

  it('a finished game that gains a level reopens on the new one by itself', () => {
    const g = game({ stars: starred(12), unlocked: 12 });
    expect(currentLevel(meta(12), g)).toBeNull();
    expect(currentLevel(meta(13), g)).toBe(12);
  });

  it('is null for a game with no levels, even with a stored current', () => {
    expect(currentLevel(meta(0), game({ current: 0 }))).toBeNull();
  });
});
