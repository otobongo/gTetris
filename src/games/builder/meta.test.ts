/**
 * Picture Builder meta (six-games brief 3.1, 3.4, 4.6, 7.9): 12 levels in the three chapters that match its three
 * stickers, with the 4.6 titles and picker notes; the chapter each level sits in; the shared unlock and current-level
 * rules on these chapters; and the game's half of the kit's KitGame.
 */
import { describe, expect, it } from 'vitest';
import { STICKERS } from '../../screens/logic/stickers';
import { AGE_BANDS, type GameProgress } from '../../shared/progress';
import { currentLevel, isLevelOpen } from '../meta';
import { getGame } from '../registry';
import { builderSet } from '../run';
import { GAME } from './game';
import { meta } from './meta';
import { CHAPTERS, LEVEL_COUNT, chapterOf, makePuzzles, puzzle } from './puzzles';

const fresh = (over: Partial<GameProgress> = {}): GameProgress => ({ unlocked: 0, stars: {}, best: {}, ...over });
const starred = (levels: number[]): GameProgress => fresh({ stars: Object.fromEntries(levels.map((l) => [l, 2])) });
const LEVEL_IDS = Array.from({ length: 12 }, (_, l) => l);

describe('levels and chapters (3.4, 4.6, 7.9)', () => {
  it('publishes 12 levels, the length of the level table', () => {
    expect(meta.levelCount).toBe(12);
    expect(meta.levelCount).toBe(LEVEL_COUNT);
  });

  it('holds the three chapters of 4.6, 5, 4 and 3 levels, with their titles and picker notes', () => {
    expect(meta.chapters).toEqual([
      { title: 'Copy it', note: 'the picture stays', start: 0, count: 5 },
      { title: 'From memory', note: 'look, then build', start: 5, count: 4 },
      { title: 'Big pictures', note: '5 by 5', start: 9, count: 3 },
    ]);
  });

  it('names the same chapters in the picker and in the game', () => {
    expect(meta.chapters).toEqual(CHAPTERS.map((c) => ({ title: c.title, note: c.note, start: c.start, count: c.count })));
  });

  it('covers every level once, in order, with no open-ended chapter, no emoji and no dash', () => {
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

  it('has 36 stars to earn, 3 per level', () => {
    expect(meta.levelCount * 3).toBe(36);
  });

  it('has as many chapters as stickers, so each Picture Builder sticker maps to a chapter (3.4)', () => {
    const stickers = STICKERS.filter((s) => s.game === 'builder');
    expect(stickers.map((s) => s.chapter)).toEqual([0, 1, 2]);
    expect(meta.chapters).toHaveLength(stickers.length);
    for (const s of stickers) expect(meta.chapters[s.chapter!]).toBeDefined();
  });

  it('matches each chapter to what its levels hold: copy levels, then memory levels, then 5x5 pictures', () => {
    for (const l of LEVEL_IDS)
      for (const p of makePuzzles(l)) {
        const title = chapterOf(l).title;
        if (title === 'Copy it') {
          expect(p.mode).toBe('copy');
          expect(p.size).toBeLessThan(5);
        }
        if (title === 'From memory') {
          expect(p.mode).toBe('memory');
          expect(p.size).toBeLessThan(5);
        }
        if (title === 'Big pictures') expect(p.size).toBe(5);
      }
  });
});

describe('chapterOf', () => {
  it('names the chapter of every level, with the boundaries between Levels 5 and 6 and Levels 9 and 10', () => {
    expect(LEVEL_IDS.map((l) => chapterOf(l).title)).toEqual([
      ...Array(5).fill('Copy it'),
      ...Array(4).fill('From memory'),
      ...Array(3).fill('Big pictures'),
    ]);
    expect(chapterOf(0)).toEqual(CHAPTERS[0]);
    expect(chapterOf(4).title).toBe('Copy it');
    expect(chapterOf(5).title).toBe('From memory');
    expect(chapterOf(8).title).toBe('From memory');
    expect(chapterOf(9).title).toBe('Big pictures');
    expect(chapterOf(11)).toEqual(CHAPTERS[2]);
  });

  it('throws a RangeError for a level outside 0 to 11', () => {
    for (const l of [-1, 12, 100, 0.5, Number.NaN]) expect(() => chapterOf(l), `level ${l}`).toThrow(RangeError);
  });
});

describe('the shared level rules on Picture Builder’s chapters', () => {
  it('opens only Level 1 for a new child at ages 3 to 8', () => {
    for (const band of ['3-4', '5-6', '7-8'] as const)
      for (const l of LEVEL_IDS) expect(isLevelOpen(meta, fresh(), band, l), `${band} level ${l + 1}`).toBe(l === 0);
  });

  it('opens the first level of every chapter for a new child at ages 9 to 10: Levels 1, 6 and 10', () => {
    for (const l of LEVEL_IDS) expect(isLevelOpen(meta, fresh(), '9-10', l), `level ${l + 1}`).toBe([0, 5, 9].includes(l));
  });

  it('opens nothing outside the game’s levels', () => {
    for (const band of AGE_BANDS) {
      expect(isLevelOpen(meta, fresh(), band, -1)).toBe(false);
      expect(isLevelOpen(meta, fresh(), band, 12)).toBe(false);
    }
  });

  it('opens the next level once the one before has a star', () => {
    expect(isLevelOpen(meta, starred([4]), '3-4', 5)).toBe(true);
    expect(isLevelOpen(meta, starred([10]), '5-6', 11)).toBe(true);
    expect(isLevelOpen(meta, starred([10]), '5-6', 10)).toBe(false);
  });

  it('starts a new child at Level 1, moves on past starred levels, and finishes after Level 12', () => {
    expect(currentLevel(meta, fresh())).toBe(0);
    expect(currentLevel(meta, starred([0, 1, 2, 3, 4]))).toBe(5);
    expect(currentLevel(meta, starred(LEVEL_IDS.slice(0, 11)))).toBe(11);
    expect(currentLevel(meta, starred(LEVEL_IDS))).toBeNull();
  });

  it('keeps a stored current level only when it is one of the 12', () => {
    expect(currentLevel(meta, fresh({ current: 11 }))).toBe(11);
    expect(currentLevel(meta, fresh({ current: 12 }))).toBe(0);
    expect(currentLevel(meta, fresh({ current: -1 }))).toBe(0);
  });
});

describe('the game’s half of KitGame (3.1, 6)', () => {
  it('is the builder game, with this meta and the registry’s title', () => {
    expect(GAME.id).toBe('builder');
    expect(GAME.meta).toEqual(meta);
    expect(GAME.title).toBe('Picture Builder');
    expect(getGame('builder')?.title).toBe(GAME.title);
  });

  it('stores every band’s run under builder:1, the same set for every band', () => {
    for (const band of AGE_BANDS) expect(GAME.set(band), band).toBe('builder:1');
    expect(GAME.set('3-4')).toBe(builderSet());
  });

  it('uses the fixed seed 0, no hints, and does not keep solved puzzles across a band change (6)', () => {
    expect(GAME.seed).toBe('fixed');
    expect(GAME.hints).toBeFalsy();
    expect(GAME.keepSolved).toBeFalsy();
  });

  it('hands the kit the content module’s puzzle, whatever seed and band it passes', () => {
    for (const band of AGE_BANDS) for (const seed of [0, 7, 2 ** 31 - 1]) expect(GAME.puzzle(8, 4, { seed, band })).toEqual(puzzle(8, 4));
    expect(GAME.puzzle(0, 0, { seed: 0, band: '5-6' }).picture.name).toBe(puzzle(0, 0).picture.name);
  });

  it('throws through the kit’s puzzle for a level or puzzle number out of range (10.2)', () => {
    const ctx = { seed: 0, band: '5-6' as const };
    expect(() => GAME.puzzle(12, 0, ctx)).toThrow(RangeError);
    expect(() => GAME.puzzle(-1, 0, ctx)).toThrow(RangeError);
    expect(() => GAME.puzzle(0, 6, ctx)).toThrow(RangeError);
    expect(() => GAME.puzzle(11, -1, ctx)).toThrow(RangeError);
  });
});
