/** Color Mixer's level table, chapters and meta (brief 3.4, 4.1, 7.9): 9 levels in 3 chapters of 3. */
import { describe, expect, it } from 'vitest';
import { STICKERS } from '../../screens/logic/stickers';
import { MIXES, PAINT_IDS, RESULT_IDS, TINTS, recipeFor } from './colors';
import { CHAPTERS, FORMS, GAME_STARS, GUESS_CHOICES, LEVELS, LEVEL_COUNT, levelDef } from './levels';
import { meta } from './meta';

const DASH = /[–—]/;
// Pictographic emoji and the variation selector that turns a symbol into one.
const EMOJI = /[\p{Extended_Pictographic}️]/u;

describe('level table (4.1)', () => {
  it('holds 9 levels', () => {
    expect(LEVELS).toHaveLength(9);
    expect(LEVEL_COUNT).toBe(9);
    expect(meta.levelCount).toBe(9);
  });

  it('runs finish, guess, make in every chapter', () => {
    expect(FORMS).toEqual(['finish', 'guess', 'make']);
    expect(LEVELS.map((d) => d.form)).toEqual(['finish', 'guess', 'make', 'finish', 'guess', 'make', 'finish', 'guess', 'make']);
  });

  it('puts red, yellow and blue on the shelf in chapter 1, and all four paints after that', () => {
    for (const level of [0, 1, 2]) expect([...LEVELS[level].paints]).toEqual(['red', 'yellow', 'blue']);
    for (const level of [3, 4, 5, 6, 7, 8]) expect([...LEVELS[level].paints]).toEqual([...PAINT_IDS]);
  });

  it('asks about the 3 mixes, then the 3 tints, then all 6 results', () => {
    for (const level of [0, 1, 2]) expect([...LEVELS[level].pool]).toEqual([...MIXES]);
    for (const level of [3, 4, 5]) expect([...LEVELS[level].pool]).toEqual([...TINTS]);
    for (const level of [6, 7, 8]) expect([...LEVELS[level].pool].sort()).toEqual([...RESULT_IDS].sort());
  });

  it('holds each result twice on Levels 1 to 6 and once on Levels 7 to 9', () => {
    expect(LEVELS.map((d) => d.twice)).toEqual([true, true, true, true, true, true, false, false, false]);
    for (const d of LEVELS) expect(d.pool.length * (d.twice ? 2 : 1)).toBe(6);
  });

  it('draws Guess swatches from the 3 mixes on Level 2 and from the 6 results on Levels 5 and 8', () => {
    expect(GUESS_CHOICES).toBe(3);
    expect([...(LEVELS[1].choicePool ?? [])]).toEqual([...MIXES]);
    expect([...(LEVELS[4].choicePool ?? [])].sort()).toEqual([...RESULT_IDS].sort());
    expect([...(LEVELS[7].choicePool ?? [])].sort()).toEqual([...RESULT_IDS].sort());
  });

  it('makes every pool result from two paints of the level', () => {
    for (const d of LEVELS) {
      for (const r of d.pool) for (const p of recipeFor(r).pair) expect(d.paints).toContain(p);
      for (const r of d.choicePool ?? []) expect(RESULT_IDS).toContain(r);
    }
  });

  it('gives Guess swatches only to Guess levels, and always holds the pool among them', () => {
    for (const d of LEVELS) {
      if (d.form !== 'guess') expect(d.choicePool).toBeUndefined();
      else for (const r of d.pool) expect(d.choicePool).toContain(r);
    }
  });

  it('gives the definition of the first and the last level', () => {
    expect(levelDef(0)).toBe(LEVELS[0]);
    expect(levelDef(8)).toBe(LEVELS[8]);
    for (let i = 0; i < 9; i++) expect(levelDef(i)).toBe(LEVELS[i]);
  });

  it('throws a RangeError for a level outside the game', () => {
    for (const bad of [-1, 9, 10, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => levelDef(bad)).toThrow(RangeError);
  });
});

describe('chapters match the stickers and the picker (3.4, 7.9)', () => {
  it('names 3 chapters of 3 levels, with their picker notes', () => {
    expect(CHAPTERS.map((c) => [c.title, c.note, c.start, c.count])).toEqual([
      ['Mix two paints', 'red, yellow and blue', 0, 3],
      ['Make it lighter', 'add white', 3, 3],
      ['All six colors', 'every mix', 6, 3],
    ]);
  });

  it('publishes the same chapters in meta, none open-ended', () => {
    expect(meta.chapters).toEqual(CHAPTERS.map((c) => ({ title: c.title, note: c.note, start: c.start, count: c.count })));
    for (const c of meta.chapters) expect(c.more).toBeUndefined();
  });

  it('covers every level once, with no gaps and no overlap', () => {
    let next = 0;
    for (const c of meta.chapters) {
      expect(c.start).toBe(next);
      expect(c.count).toBeGreaterThan(0);
      next += c.count;
    }
    expect(next).toBe(meta.levelCount);
  });

  it('keeps one pool per chapter: the mixes, then the tints, then every mix', () => {
    const pools = meta.chapters.map((c) => new Set(LEVELS.slice(c.start, c.start + c.count).map((d) => [...d.pool].sort().join())));
    for (const p of pools) expect(p.size).toBe(1);
    expect([...pools[0]][0]).toBe([...MIXES].sort().join());
    expect([...pools[1]][0]).toBe([...TINTS].sort().join());
    expect([...pools[2]][0]).toBe([...RESULT_IDS].sort().join());
  });

  it('writes titles and notes with no emoji, no dash and no exclamation mark', () => {
    for (const c of meta.chapters) {
      for (const text of [c.title, c.note]) {
        expect(text).not.toMatch(EMOJI);
        expect(text).not.toMatch(DASH);
        expect(text).not.toContain('!');
        expect(text.trim()).toBe(text);
        expect(text.length).toBeGreaterThan(0);
      }
    }
  });

  it('gives each Color Mixer sticker its own chapter, one sticker per chapter', () => {
    const chapters = STICKERS.filter((s) => s.game === 'mixer').map((s) => s.chapter);
    expect(chapters).toHaveLength(meta.chapters.length);
    expect([...chapters].sort()).toEqual(meta.chapters.map((_, i) => i));
  });

  it('holds 27 stars, 3 per level', () => {
    expect(GAME_STARS).toBe(27);
    expect(GAME_STARS).toBe(meta.levelCount * 3);
  });
});
