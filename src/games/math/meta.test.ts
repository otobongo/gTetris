/** Brick Calculator meta (brief 3.1, 3.4, 4.5, 6, 7.9): 12 levels in the two chapters that match its two stickers,
    and the game as the kit's KitGame: set 'math:1:<band>', a new seed per run, solved puzzles kept on a band change,
    no hints. */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, type GameProgress } from '../../shared/progress';
import { STICKERS } from '../../screens/logic/stickers';
import { isLevelOpen } from '../meta';
import { getGame } from '../registry';
import { mathSet } from '../run';
import { MATH } from './game';
import { MATH_GAME, meta } from './meta';
import { CHAPTERS, LEVELS, chapterOf, puzzle } from './puzzles';

const fresh = (over: Partial<GameProgress> = {}): GameProgress => ({ unlocked: 0, stars: {}, best: {}, ...over });

describe('levels and chapters (4.5, 7.9, 3.4)', () => {
  it('publishes 12 levels, the length of the level table', () => {
    expect(meta.levelCount).toBe(12);
    expect(meta.levelCount).toBe(LEVELS.length);
  });

  it('holds the two chapters of the brief: Adding for Levels 1 to 4, Taking away for 5 to 12', () => {
    expect(meta.chapters).toEqual([
      { title: 'Adding', note: 'plus', start: 0, count: 4 },
      { title: 'Taking away', note: 'then plus and minus', start: 4, count: 8 },
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

  it('puts each level in its chapter, with the boundary between Level 4 and Level 5', () => {
    expect(LEVELS.map((_, level) => chapterOf(level).title)).toEqual([...Array(4).fill('Adding'), ...Array(8).fill('Taking away')]);
    expect(chapterOf(0).title).toBe('Adding');
    expect(chapterOf(3).title).toBe('Adding');
    expect(chapterOf(4).title).toBe('Taking away');
    expect(chapterOf(11).title).toBe('Taking away');
  });

  it('has as many chapters as stickers, so each Brick Calculator sticker maps to a chapter (3.4)', () => {
    const stickers = STICKERS.filter((s) => s.game === 'math');
    expect(stickers.map((s) => s.chapter)).toEqual([0, 1]);
    expect(meta.chapters).toHaveLength(stickers.length);
    for (const s of stickers) expect(meta.chapters[s.chapter!]).toBeDefined();
  });

  it('holds chapter names and notes with no dash and no emoji', () => {
    for (const c of meta.chapters) expect(`${c.title} ${c.note}`).toMatch(/^[A-Za-z ]+$/);
  });

  it('opens the Taking away chapter’s first level for ages 9 to 10 only, by the shared unlock rule', () => {
    expect(isLevelOpen(meta, fresh(), '9-10', 4)).toBe(true);
    expect(isLevelOpen(meta, fresh(), '7-8', 4)).toBe(false);
    expect(isLevelOpen(meta, fresh(), '9-10', 5)).toBe(false);
    expect(isLevelOpen(meta, fresh({ stars: { 3: 2 } }), '3-4', 4)).toBe(true);
    expect(isLevelOpen(meta, fresh(), '3-4', 0)).toBe(true);
    expect(isLevelOpen(meta, fresh(), '9-10', 12)).toBe(false);
  });
});

describe('the game’s half of KitGame (3.1, 6)', () => {
  it('uses a new seed per run and keeps solved puzzles on a band change', () => {
    expect(MATH_GAME).toMatchObject({ seed: 'run', keepSolved: true });
  });

  it('carries the registry’s title, Brick Calculator', () => {
    expect(MATH_GAME.title).toBe('Brick Calculator');
    expect(getGame('math')?.title).toBe(MATH_GAME.title);
  });

  it('hands the kit the content module’s puzzle function', () => {
    expect(MATH_GAME.puzzle).toBe(puzzle);
    expect(MATH_GAME.puzzle(0, 0, { seed: 3, band: '5-6' })).toEqual(puzzle(0, 0, { seed: 3, band: '5-6' }));
  });
});

describe('MATH, the kit game (3.1, 3.2, 6)', () => {
  it('is the math game with its meta and title', () => {
    expect(MATH.id).toBe('math');
    expect(MATH.meta).toBe(meta);
    expect(MATH.title).toBe('Brick Calculator');
  });

  it('plays set math:1:<band>, one per band, as run.ts names it', () => {
    for (const band of AGE_BANDS) expect(MATH.set(band), band).toBe(`math:1:${band}`);
    for (const band of AGE_BANDS) expect(MATH.set(band)).toBe(mathSet(band));
    expect(new Set(AGE_BANDS.map((b) => MATH.set(b))).size).toBe(AGE_BANDS.length);
  });

  it('draws a new seed per run, keeps solved puzzles on a band change and has no hints (the bricks are the help)', () => {
    expect(MATH.seed).toBe('run');
    expect(MATH.keepSolved).toBe(true);
    expect(MATH.hints).toBeFalsy();
  });

  it('deals the content module’s puzzles', () => {
    expect(MATH.puzzle).toBe(puzzle);
    expect(MATH.puzzle(11, 5, { seed: 8, band: '9-10' })).toEqual(puzzle(11, 5, { seed: 8, band: '9-10' }));
  });

  it('throws for a level or puzzle out of range, as the kit expects', () => {
    expect(() => MATH.puzzle(12, 0, { seed: 1, band: '5-6' })).toThrow(RangeError);
    expect(() => MATH.puzzle(0, 6, { seed: 1, band: '5-6' })).toThrow(RangeError);
  });
});
