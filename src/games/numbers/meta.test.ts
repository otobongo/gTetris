/** Number Line-up meta (brief 3.1, 3.4, 4.3, 7.9): 12 levels in the two chapters that match its two stickers,
    and the game's half of the kit's KitGame. */
import { describe, expect, it } from 'vitest';
import type { GameProgress } from '../../shared/progress';
import { STICKERS } from '../../screens/logic/stickers';
import { isLevelOpen } from '../meta';
import { getGame } from '../registry';
import { NUMBERS_GAME, meta } from './meta';
import { CHAPTERS, LEVELS, chapterOf, puzzle } from './puzzles';

const fresh = (over: Partial<GameProgress> = {}): GameProgress => ({ unlocked: 0, stars: {}, best: {}, ...over });

describe('levels and chapters (4.3, 7.9, 3.4)', () => {
  it('publishes 12 levels, the length of the level table', () => {
    expect(meta.levelCount).toBe(12);
    expect(meta.levelCount).toBe(LEVELS.length);
  });

  it('holds the two chapters of the brief: Stairs for Levels 1 to 8, Bigger numbers for 9 to 12', () => {
    expect(meta.chapters).toEqual([
      { title: 'Stairs', note: '1 to 6, up and down', start: 0, count: 8 },
      { title: 'Bigger numbers', note: 'read the numbers', start: 8, count: 4 },
    ]);
  });

  it('covers every level once, in order, with no open-ended chapter', () => {
    let next = 0;
    for (const c of meta.chapters) {
      expect(c.start).toBe(next);
      expect(c.count).toBeGreaterThan(0);
      expect(c.more).toBeUndefined();
      next += c.count;
    }
    expect(next).toBe(meta.levelCount);
  });

  it('has 36 stars to earn, 3 per level', () => {
    expect(meta.levelCount * 3).toBe(36);
  });

  it('names the same chapters in the picker and in the game', () => {
    expect(meta.chapters).toEqual(CHAPTERS.map((c) => ({ title: c.title, note: c.note, start: c.start, count: c.count })));
  });

  it('puts each level in its chapter, with the boundary between Level 8 and Level 9', () => {
    expect(LEVELS.map((_, level) => chapterOf(level).title)).toEqual([...Array(8).fill('Stairs'), ...Array(4).fill('Bigger numbers')]);
    expect(chapterOf(0).title).toBe('Stairs');
    expect(chapterOf(7).title).toBe('Stairs');
    expect(chapterOf(8).title).toBe('Bigger numbers');
    expect(chapterOf(11).title).toBe('Bigger numbers');
  });

  it('has as many chapters as stickers, so each Number Line-up sticker maps to a chapter (3.4)', () => {
    const stickers = STICKERS.filter((s) => s.game === 'numbers');
    expect(stickers.map((s) => s.chapter)).toEqual([0, 1]);
    expect(meta.chapters).toHaveLength(stickers.length);
    for (const s of stickers) expect(meta.chapters[s.chapter!]).toBeDefined();
  });

  it('opens the Bigger numbers chapter’s first level for ages 9 to 10 only, by the shared unlock rule', () => {
    expect(isLevelOpen(meta, fresh(), '9-10', 8)).toBe(true);
    expect(isLevelOpen(meta, fresh(), '7-8', 8)).toBe(false);
    expect(isLevelOpen(meta, fresh(), '9-10', 9)).toBe(false);
    expect(isLevelOpen(meta, fresh({ stars: { 7: 2 } }), '3-4', 8)).toBe(true);
  });
});

describe('the game’s half of KitGame (3.1)', () => {
  it('uses a new seed per run, keeps solved puzzles on a band change and has hints', () => {
    expect(NUMBERS_GAME).toMatchObject({ seed: 'run', keepSolved: true, hints: true });
  });

  it('carries the registry’s title, Number Line-up', () => {
    expect(NUMBERS_GAME.title).toBe('Number Line-up');
    expect(getGame('numbers')?.title).toBe(NUMBERS_GAME.title);
  });

  it('hands the kit the content module’s puzzle function', () => {
    expect(NUMBERS_GAME.puzzle).toBe(puzzle);
    expect(NUMBERS_GAME.puzzle(0, 0, { seed: 3, band: '5-6' })).toEqual(puzzle(0, 0, { seed: 3, band: '5-6' }));
  });
});
