/** Pattern Train's level table, chapters and meta (brief 3.4, 4.4, 7.9): 12 levels in 3 chapters of 3, 6 and 3. */
import { describe, expect, it } from 'vitest';
import { STICKERS } from '../../screens/logic/stickers';
import {
  CHAPTERS,
  GAME_STARS,
  LEVELS,
  LEVEL_COUNT,
  MAX_SHOWN,
  PATTERN_IDS,
  PATTERN_UNIT,
  chapterOf,
  distinctCars,
  levelDef,
} from './levels';
import { meta } from './meta';

const DASH = /[–—]/;
// Pictographic emoji and the variation selector that turns a symbol into one.
const EMOJI = /[\p{Extended_Pictographic}️]/u;

/** The table in 4.4, row by row: pattern(s), what changes, cars shown. */
const BRIEF_TABLE: [string[], 'both' | 'color' | 'shape', number][] = [
  [['AB'], 'both', 4],
  [['AB'], 'color', 4],
  [['AB'], 'shape', 4],
  [['ABC'], 'both', 5],
  [['ABC'], 'color', 5],
  [['ABC'], 'shape', 5],
  [['AAB'], 'both', 5],
  [['ABB'], 'both', 5],
  [['AAB', 'ABB'], 'color', 5],
  [['ABCD'], 'both', 5],
  [['AABB'], 'both', 5],
  [['ABCD', 'AABB'], 'both', 5],
];

describe('the six patterns', () => {
  it('names the six patterns of 4.4', () => {
    expect([...PATTERN_IDS]).toEqual(['AB', 'ABC', 'AAB', 'ABB', 'ABCD', 'AABB']);
  });

  it('spells each pattern’s repeating unit by its letters: A is the first car, B the second', () => {
    for (const id of PATTERN_IDS) {
      expect([...PATTERN_UNIT[id]], id).toEqual([...id].map((letter) => letter.charCodeAt(0) - 'A'.charCodeAt(0)));
    }
    expect([...PATTERN_UNIT.AAB]).toEqual([0, 0, 1]);
    expect([...PATTERN_UNIT.ABCD]).toEqual([0, 1, 2, 3]);
  });

  it('counts the different cars each pattern uses: 2, 3 or 4', () => {
    expect(PATTERN_IDS.map(distinctCars)).toEqual([2, 3, 2, 2, 4, 2]);
    for (const id of PATTERN_IDS) expect(distinctCars(id), id).toBe(new Set(id).size);
  });

  it('gives every pattern a repeat of 2, 3 or 4 cars', () => {
    expect(PATTERN_IDS.map((id) => PATTERN_UNIT[id].length)).toEqual([2, 3, 3, 3, 4, 4]);
  });
});

describe('level table (4.4)', () => {
  it('holds 12 levels', () => {
    expect(LEVELS).toHaveLength(12);
    expect(LEVEL_COUNT).toBe(12);
    expect(meta.levelCount).toBe(12);
  });

  it('matches the table of 4.4 row by row', () => {
    expect(LEVELS.map((d) => [[...d.patterns], d.change, d.shown])).toEqual(BRIEF_TABLE);
  });

  it('shows 4 cars on Levels 1 to 3 and 5 on the rest, never more than 5 (a sixth does not fit 358 px)', () => {
    expect(MAX_SHOWN).toBe(5);
    expect(LEVELS.map((d) => d.shown)).toEqual([4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
    for (const d of LEVELS) expect(d.shown).toBeLessThanOrEqual(MAX_SHOWN);
  });

  it('shows every pattern at least once in full plus one car, so the repeat can be seen', () => {
    for (const d of LEVELS) for (const p of d.patterns) expect(d.shown, p).toBeGreaterThan(PATTERN_UNIT[p].length);
  });

  it('mixes only patterns of one length in a level, so each level stays at one difficulty', () => {
    for (const d of LEVELS) expect(new Set(d.patterns.map((p) => PATTERN_UNIT[p].length)).size).toBe(1);
  });

  it('mixes AAB and ABB on Level 9, and only the two four-car patterns on Level 12', () => {
    expect([...LEVELS[8].patterns].sort()).toEqual(['AAB', 'ABB']);
    expect([...LEVELS[11].patterns].sort()).toEqual(['AABB', 'ABCD']);
    for (const p of LEVELS[11].patterns) expect(PATTERN_UNIT[p]).toHaveLength(4);
  });

  it('holds one or two patterns per level, two only on Levels 9 and 12', () => {
    expect(LEVELS.map((d) => d.patterns.length)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 2]);
  });

  it('keeps colour-only puzzles to Levels 2, 5 and 9, and shape-only to Levels 3 and 6 (9.4)', () => {
    expect(LEVELS.flatMap((d, i) => (d.change === 'color' ? [i + 1] : []))).toEqual([2, 5, 9]);
    expect(LEVELS.flatMap((d, i) => (d.change === 'shape' ? [i + 1] : []))).toEqual([3, 6]);
  });

  it('gives the definition of the first and the last level', () => {
    expect(levelDef(0)).toBe(LEVELS[0]);
    expect(levelDef(11)).toBe(LEVELS[11]);
    for (let i = 0; i < 12; i++) expect(levelDef(i)).toBe(LEVELS[i]);
  });

  it('throws a RangeError for a level outside the game', () => {
    for (const bad of [-1, 12, 13, 100, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => levelDef(bad), String(bad)).toThrow(RangeError);
    }
  });
});

describe('chapters match the stickers and the picker (3.4, 4.4, 7.9)', () => {
  it('names 3 chapters of 3, 6 and 3 levels, with their picker notes', () => {
    expect(CHAPTERS.map((c) => [c.title, c.note, c.start, c.count])).toEqual([
      ['Two-car patterns', 'AB', 0, 3],
      ['Three-car patterns', 'ABC, AAB, ABB', 3, 6],
      ['Longer patterns', 'four cars', 9, 3],
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

  it('keeps one pattern length per chapter: two cars, then three, then four', () => {
    const lengths = CHAPTERS.map((c) => new Set(LEVELS.slice(c.start, c.start + c.count).flatMap((d) => d.patterns.map((p) => PATTERN_UNIT[p].length))));
    expect(lengths.map((s) => [...s])).toEqual([[2], [3], [4]]);
  });

  it('puts each level in its chapter, with the boundaries between Levels 3 and 4 and between 9 and 10', () => {
    expect(LEVELS.map((_, level) => chapterOf(level).title)).toEqual([
      ...Array(3).fill('Two-car patterns'),
      ...Array(6).fill('Three-car patterns'),
      ...Array(3).fill('Longer patterns'),
    ]);
    expect(chapterOf(0).title).toBe('Two-car patterns');
    expect(chapterOf(2).title).toBe('Two-car patterns');
    expect(chapterOf(3).title).toBe('Three-car patterns');
    expect(chapterOf(8).title).toBe('Three-car patterns');
    expect(chapterOf(9).title).toBe('Longer patterns');
    expect(chapterOf(11).title).toBe('Longer patterns');
  });

  it('throws a RangeError for the chapter of a level outside the game', () => {
    for (const bad of [-1, 12, 99, Number.NaN]) expect(() => chapterOf(bad), String(bad)).toThrow(RangeError);
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

  it('gives each Pattern Train sticker its own chapter, one sticker per chapter', () => {
    const chapters = STICKERS.filter((s) => s.game === 'pattern').map((s) => s.chapter);
    expect(chapters).toHaveLength(meta.chapters.length);
    expect([...chapters].sort()).toEqual(meta.chapters.map((_, i) => i));
  });

  it('holds 36 stars, 3 per level (7.9)', () => {
    expect(GAME_STARS).toBe(36);
    expect(GAME_STARS).toBe(meta.levelCount * 3);
  });
});
