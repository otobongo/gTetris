/**
 * Shape Sorter meta and level rules (six-games brief 3.2, 3.3, 3.4, 4.2, 7.9): chapters that match the sticker
 * book, the level count Home and Settings read, the shared unlock and current-level rules on this game's chapters,
 * and the stuck and star rows the game copies from Letter Builder.
 */
import { describe, expect, it } from 'vitest';
import { STICKERS } from '../../screens/logic/stickers';
import { AGE_BANDS, type GameProgress } from '../../shared/progress';
import { currentLevel, isLevelOpen } from '../meta';
import { LEVEL_STAR_RULES, STUCK } from '../run';
import { meta } from './meta';
import { LEVEL_COUNT, SORTER_CHAPTERS, SORTER_STAR_RULE, SORTER_STUCK, SORTER_TITLE, chapterOf, makePuzzles } from './puzzles';

const fresh = (): GameProgress => ({ unlocked: 0, stars: {}, best: {} });
const starred = (levels: number[]): GameProgress => ({ unlocked: 0, stars: Object.fromEntries(levels.map((l) => [l, 2])), best: {} });

describe('Shape Sorter meta (3.4, 4.2, 7.9)', () => {
  it('publishes 9 levels', () => {
    expect(meta.levelCount).toBe(9);
    expect(meta.levelCount).toBe(LEVEL_COUNT);
  });

  it('has three chapters of three, with the brief’s titles and picker notes', () => {
    expect(meta.chapters).toEqual([
      { title: 'Shapes', note: 'one color', start: 0, count: 3 },
      { title: 'Shape and color', note: 'both must match', start: 3, count: 3 },
      { title: 'Big boards', note: 'eight pieces', start: 6, count: 3 },
    ]);
  });

  it('covers every level in order with no gaps, no open-ended chapter and no emoji', () => {
    let next = 0;
    for (const c of meta.chapters) {
      expect(c.start).toBe(next);
      expect(c.count).toBeGreaterThan(0);
      expect(c.more).toBeUndefined();
      expect(/\p{Extended_Pictographic}/u.test(c.title + c.note), c.title).toBe(false);
      expect(/[–—]/.test(c.title + c.note), c.title).toBe(false);
      next += c.count;
    }
    expect(next).toBe(meta.levelCount);
  });

  it('gives the game 27 stars, 3 per level', () => {
    expect(meta.levelCount * 3).toBe(27);
  });

  it('names the game Shape Sorter', () => {
    expect(SORTER_TITLE).toBe('Shape Sorter');
  });

  it('keeps one chapter per sticker, so the sticker book does not change (3.4)', () => {
    const mine = STICKERS.filter((s) => s.game === 'sorter');
    expect(mine).toHaveLength(meta.chapters.length);
    expect(mine.map((s) => s.chapter).sort()).toEqual(meta.chapters.map((_, i) => i));
  });

  it('matches its chapters to what the boards hold: one colour, then colour that matters, then eight pieces', () => {
    for (let l = 0; l < LEVEL_COUNT; l++)
      for (const p of makePuzzles(l)) {
        const title = chapterOf(l).title;
        if (title === 'Shapes') {
          expect(p.colorMatters).toBe(false);
          expect(new Set(p.pieces.map((x) => x.color)).size).toBe(1);
        } else expect(p.colorMatters).toBe(true);
        if (title === 'Big boards') expect(p.pieces).toHaveLength(8);
        else expect(p.pieces.length).toBeLessThan(8);
      }
  });
});

describe('chapterOf', () => {
  it('names the chapter of every level, first and last included', () => {
    const want = ['Shapes', 'Shapes', 'Shapes', 'Shape and color', 'Shape and color', 'Shape and color', 'Big boards', 'Big boards', 'Big boards'];
    expect(Array.from({ length: LEVEL_COUNT }, (_, l) => chapterOf(l).title)).toEqual(want);
    expect(chapterOf(0)).toEqual(SORTER_CHAPTERS[0]);
    expect(chapterOf(8)).toEqual(SORTER_CHAPTERS[2]);
  });

  it('throws a RangeError for a level outside 0 to 8', () => {
    for (const l of [-1, 9, 100, Number.NaN]) expect(() => chapterOf(l), `level ${l}`).toThrow(RangeError);
  });
});

describe('the shared level rules on Shape Sorter’s chapters', () => {
  it('opens only Level 1 for a new child at ages 3 to 8', () => {
    for (const band of ['3-4', '5-6', '7-8'] as const)
      for (let l = 0; l < LEVEL_COUNT; l++) expect(isLevelOpen(meta, fresh(), band, l), `${band} level ${l + 1}`).toBe(l === 0);
  });

  it('opens the first level of every chapter for a new child at ages 9 to 10', () => {
    for (let l = 0; l < LEVEL_COUNT; l++) expect(isLevelOpen(meta, fresh(), '9-10', l), `level ${l + 1}`).toBe([0, 3, 6].includes(l));
  });

  it('opens nothing outside the game’s levels', () => {
    for (const band of AGE_BANDS) {
      expect(isLevelOpen(meta, fresh(), band, -1)).toBe(false);
      expect(isLevelOpen(meta, fresh(), band, 9)).toBe(false);
    }
  });

  it('starts a new child at Level 1, moves on past starred levels, and finishes after Level 9', () => {
    expect(currentLevel(meta, fresh())).toBe(0);
    expect(currentLevel(meta, starred([0, 1, 2]))).toBe(3);
    expect(currentLevel(meta, starred([0, 1, 2, 3, 4, 5, 6, 7]))).toBe(8);
    expect(currentLevel(meta, starred([0, 1, 2, 3, 4, 5, 6, 7, 8]))).toBeNull();
  });

  it('keeps a stored current level only when it is one of the 9', () => {
    expect(currentLevel(meta, { ...fresh(), current: 8 })).toBe(8);
    expect(currentLevel(meta, { ...fresh(), current: 9 })).toBe(0);
    expect(currentLevel(meta, { ...fresh(), current: -1 })).toBe(0);
  });
});

describe('stuck limits and the star rule (3.2, 3.3)', () => {
  it('holds the 3.3 Shape Sorter row for every age band', () => {
    expect(SORTER_STUCK).toEqual({
      '3-4': { count: 3, seconds: 30 },
      '5-6': { count: 3, seconds: 40 },
      '7-8': { count: 4, seconds: 50 },
      '9-10': { count: 4, seconds: 60 },
    });
    expect(Object.keys(SORTER_STUCK).sort()).toEqual([...AGE_BANDS].sort());
  });

  it('copies Letter Builder’s live stuck row, as 3.3 says', () => {
    expect(SORTER_STUCK).toEqual(STUCK.letters);
  });

  it('uses Letter Builder’s star rule on slips: 3 stars at 1 slip or none, 2 stars at 4 or fewer', () => {
    expect(SORTER_STAR_RULE).toEqual({ three: 1, two: 4 });
    expect(SORTER_STAR_RULE).toEqual(LEVEL_STAR_RULES.letters);
  });
});
