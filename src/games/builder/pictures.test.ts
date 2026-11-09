/**
 * Picture Builder's 42 pictures (six-games brief 4.6 "Content checks", 7.8, 8): the board's string format, the 6
 * board colours, each set's grid, colour count and filled-square range, no blank or one-colour picture, no two
 * pictures of a set equal after mirroring or renaming colours, the names, and the board's tree, house and boat.
 * The expected values are written out here from the brief and the board (design/canvas/Builder.dc.html), not read
 * from the module, so a picture or a rule that drifts from the brief fails here.
 *
 * Only a person can say a picture looks like a fish: that is the BuilderPictures contact sheet's job (5.3).
 */
import { describe, expect, it } from 'vitest';
import {
  BUILDER_COLORS,
  COLOR_LETTERS,
  EMPTY_LETTER,
  NAME_MAX_CHARS,
  PICTURES,
  PICTURES_PER_SET,
  PICTURE_SETS,
  SET_RULES,
  brickCount,
  cellsOf,
  colorsOf,
  pictureById,
  picturesOf,
  rowsOf,
  sizeOf,
  type Picture,
  type PictureSet,
} from './pictures';

/* ---------- The brief, written out ---------- */

/** 4.6: the board's 6 colours (7.8 palette order: red, yellow, green, blue / orange, white). */
const BRIEF_COLORS = ['red', 'yellow', 'green', 'blue', 'orange', 'white'];
/** The board's letters for them (Builder.dc.html), and '.' for a square that stays empty. */
const BRIEF_LETTERS: Record<string, string> = { R: 'red', Y: 'yellow', G: 'green', B: 'blue', O: 'orange', W: 'white' };

/** The 4.6 level table seen from the pictures' side: each set's grid, colours, filled squares and levels (Level 1 is 1). */
const BRIEF_SETS: Record<string, { size: number; colors: number; min: number; max: number; levels: number[] }> = {
  A: { size: 3, colors: 2, min: 5, max: 7, levels: [1, 6] },
  B: { size: 3, colors: 3, min: 6, max: 8, levels: [2, 7] },
  C: { size: 4, colors: 2, min: 9, max: 11, levels: [3] },
  D: { size: 4, colors: 3, min: 12, max: 15, levels: [4, 8] },
  E: { size: 4, colors: 4, min: 10, max: 13, levels: [5, 9] },
  F: { size: 5, colors: 3, min: 15, max: 20, levels: [10] },
  G: { size: 5, colors: 4, min: 15, max: 20, levels: [11, 12] },
};

/** The board's three pictures, square by square as Builder.dc.html draws them (`_` is an empty square). */
const _ = null;
const R = 'red', Y = 'yellow', G = 'green', B = 'blue', O = 'orange', W = 'white';
const BOARD_PICTURES = {
  tree: { set: 'C', cells: [_, G, G, _, G, G, G, G, _, O, O, _, _, O, O, _] },
  house: { set: 'D', cells: [_, R, R, _, R, R, R, R, Y, Y, B, Y, Y, Y, B, Y] },
  boat: { set: 'E', cells: [_, R, _, _, _, W, W, _, O, O, O, O, B, B, B, B] },
} as const;

/* ---------- Helpers ---------- */

const label = (p: Picture) => `${p.set} ${p.name} (${p.art})`;
const grid = (art: string): string[][] => art.split('/').map((r) => r.split(''));
const mirrorLR = (g: string[][]) => g.map((r) => [...r].reverse());
const mirrorTB = (g: string[][]) => [...g].reverse();
/** The picture with its colours renamed a, b, c, d in order of first appearance: the same drawing in other colours gives the same string. */
function renamed(g: string[][]): string {
  const names = new Map<string, string>();
  return g
    .map((r) =>
      r
        .map((ch) => {
          if (ch === '.') return '.';
          if (!names.has(ch)) names.set(ch, String.fromCharCode(97 + names.size));
          return names.get(ch)!;
        })
        .join(''),
    )
    .join('/');
}
/** Every way a picture reads after a left-right mirror, a top-bottom mirror, both, or neither, with its colours renamed. */
const forms = (art: string): Set<string> => {
  const g = grid(art);
  return new Set([g, mirrorLR(g), mirrorTB(g), mirrorLR(mirrorTB(g))].map(renamed));
};
const sameDrawing = (a: string, b: string): boolean => [...forms(a)].some((f) => forms(b).has(f));
const filled = (art: string) => [...art].filter((ch) => ch !== '/' && ch !== '.').length;
const lettersUsed = (art: string) => new Set([...art].filter((ch) => ch !== '/' && ch !== '.'));

/* ---------- The set table ---------- */

describe('Picture Builder draws 42 pictures in 7 sets of 6 (4.6, user decision 5 A)', () => {
  it('has 42 pictures, 6 in each of the sets A to G', () => {
    expect(PICTURES).toHaveLength(42);
    expect([...PICTURE_SETS]).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    expect(PICTURES_PER_SET).toBe(6);
    for (const set of PICTURE_SETS) expect(picturesOf(set), set).toHaveLength(6);
  });

  it('holds the 4.6 table in SET_RULES: grid, colours, filled squares and levels for every set', () => {
    for (const set of PICTURE_SETS) {
      const want = BRIEF_SETS[set];
      expect(SET_RULES[set], set).toEqual({ size: want.size, colors: want.colors, fill: { min: want.min, max: want.max }, levels: want.levels });
    }
    expect(Object.keys(SET_RULES).sort()).toEqual(Object.keys(BRIEF_SETS));
  });

  it('lists each picture in its set’s levels, so 3 board pictures plus 39 new ones fill 72 slots', () => {
    for (const p of PICTURES) expect([...p.levels], label(p)).toEqual(BRIEF_SETS[p.set].levels);
    const slots = PICTURES.reduce((n, p) => n + p.levels.length, 0);
    expect(slots).toBe(72);
  });

  it('keeps the set lists in order: picturesOf gives the set’s pictures as PICTURES lists them', () => {
    expect(PICTURE_SETS.flatMap((s) => picturesOf(s).map((p) => p.id))).toEqual(PICTURES.map((p) => p.id));
    for (const set of PICTURE_SETS) for (const p of picturesOf(set)) expect(p.set).toBe(set);
  });
});

/* ---------- Content checks, every picture ---------- */

describe('the board’s format: rows joined by "/", one letter per square (4.6)', () => {
  it('uses the board’s six colour letters and "." for an empty square, nothing else', () => {
    expect([...BUILDER_COLORS]).toEqual(BRIEF_COLORS);
    expect({ ...COLOR_LETTERS }).toEqual(BRIEF_LETTERS);
    expect(EMPTY_LETTER).toBe('.');
    for (const p of PICTURES) expect(p.art, label(p)).toMatch(/^[RYGBOW.]+(\/[RYGBOW.]+)*$/);
  });

  it('draws every picture as a square grid of its set’s size', () => {
    for (const p of PICTURES) {
      const size = BRIEF_SETS[p.set].size;
      const rows = p.art.split('/');
      expect(rows, label(p)).toHaveLength(size);
      for (const r of rows) expect(r, label(p)).toHaveLength(size);
    }
  });

  it('uses exactly its set’s number of colours, only the 6 board colours', () => {
    for (const p of PICTURES) {
      const used = lettersUsed(p.art);
      expect(used.size, label(p)).toBe(BRIEF_SETS[p.set].colors);
      for (const ch of used) expect(Object.keys(BRIEF_LETTERS), label(p)).toContain(ch);
    }
  });

  it('fills a number of squares inside its set’s range', () => {
    for (const p of PICTURES) {
      const { min, max } = BRIEF_SETS[p.set];
      const n = filled(p.art);
      expect(n, label(p)).toBeGreaterThanOrEqual(min);
      expect(n, label(p)).toBeLessThanOrEqual(max);
    }
  });

  it('has no blank and no one-colour picture, and none that fills every square', () => {
    for (const p of PICTURES) {
      expect(filled(p.art), label(p)).toBeGreaterThan(0);
      expect(lettersUsed(p.art).size, label(p)).toBeGreaterThanOrEqual(2);
      expect(p.art, label(p)).toContain('.');
    }
  });

  it('leaves no two pictures of a set the same drawing after mirroring or renaming colours', () => {
    const clashes: string[] = [];
    for (const set of PICTURE_SETS) {
      const ps = picturesOf(set);
      for (let i = 0; i < ps.length; i++)
        for (let j = i + 1; j < ps.length; j++) if (sameDrawing(ps[i].art, ps[j].art)) clashes.push(`${label(ps[i])} = ${label(ps[j])}`);
    }
    expect(clashes).toEqual([]);
  });

  it('draws 42 different pictures in all', () => {
    expect(new Set(PICTURES.map((p) => p.art)).size).toBe(42);
  });
});

describe('the mirror and colour check itself (a check that passes everything checks nothing)', () => {
  it('finds a picture equal to its left-right mirror, its top-bottom mirror and both', () => {
    expect(sameDrawing('RY./RRR/.W.', '.YR/RRR/.W.')).toBe(true);
    expect(sameDrawing('RY./RRR/.W.', '.W./RRR/RY.')).toBe(true);
    expect(sameDrawing('RY./RRR/.W.', '.W./RRR/.YR')).toBe(true);
  });

  it('finds a picture equal to itself in other colours, mirrored or not', () => {
    expect(sameDrawing('.R./RYR/.R.', '.B./BOB/.B.')).toBe(true);
    expect(sameDrawing('RY./RRR/.W.', '.GB/BBB/.O.')).toBe(true);
  });

  it('tells apart two drawings with the same colours in different places', () => {
    expect(sameDrawing('.R./RYR/.R.', 'R.R/.Y./R.R')).toBe(false);
    expect(sameDrawing('RRR/WWW/.O.', 'RRR/.O./WWW')).toBe(false);
  });

  it('counts swapping two colours as renaming: the same drawing', () => {
    expect(sameDrawing('RRR/WWW/.O.', 'RRR/OOO/.W.')).toBe(true);
  });
});

describe('picture names (4.6, 8)', () => {
  it('keeps every name to letters and spaces, 12 characters or fewer, with no stray spaces', () => {
    expect(NAME_MAX_CHARS).toBe(12);
    for (const p of PICTURES) {
      expect(p.name.length, label(p)).toBeGreaterThan(0);
      expect(p.name.length, label(p)).toBeLessThanOrEqual(12);
      expect(p.name, label(p)).toMatch(/^[A-Za-z]+( [A-Za-z]+)*$/);
    }
  });

  it('writes names in lower case, since a name always sits inside a sentence ("You built the house.")', () => {
    for (const p of PICTURES) expect(p.name, label(p)).toBe(p.name.toLowerCase());
  });

  it('gives each picture of a set its own name, so the 6 names of a level differ', () => {
    for (const set of PICTURE_SETS) {
      const names = picturesOf(set).map((p) => p.name);
      expect(new Set(names).size, set).toBe(names.length);
    }
  });

  it('gives every picture its own id, and pictureById finds it', () => {
    const ids = PICTURES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PICTURES) expect(pictureById(p.id)).toBe(p);
  });

  it('finds nothing for an id no picture has', () => {
    expect(pictureById('')).toBeUndefined();
    expect(pictureById('z-dragon')).toBeUndefined();
    expect(pictureById('tree')).toBeUndefined();
  });
});

describe('the board’s tree, house and boat open sets C, D and E (4.6)', () => {
  for (const [name, { set, cells }] of Object.entries(BOARD_PICTURES)) {
    it(`draws the ${name} square for square as the board does, as puzzle 1 of set ${set}`, () => {
      const first = picturesOf(set as PictureSet)[0];
      expect(first.name).toBe(name);
      expect(cellsOf(first.art)).toEqual([...cells]);
    });
  }

  it('writes the house as the brief quotes it', () => {
    expect(picturesOf('D')[0].art).toBe('.RR./RRRR/YYBY/YYBY');
  });

  it('sets C to E’s filled ranges bracket the board’s tree (10), house (14) and boat (11)', () => {
    const count = (cells: readonly (string | null)[]) => cells.filter((c) => c !== null).length;
    for (const { set, cells } of Object.values(BOARD_PICTURES)) {
      const { min, max } = BRIEF_SETS[set];
      expect(count(cells)).toBeGreaterThanOrEqual(min);
      expect(count(cells)).toBeLessThanOrEqual(max);
    }
    expect([count(BOARD_PICTURES.tree.cells), count(BOARD_PICTURES.house.cells), count(BOARD_PICTURES.boat.cells)]).toEqual([10, 14, 11]);
  });
});

/* ---------- Reading a picture string ---------- */

describe('reading a picture string', () => {
  const HOUSE = '.RR./RRRR/YYBY/YYBY';

  it('splits it into rows, top to bottom, and counts them as the grid size', () => {
    expect(rowsOf(HOUSE)).toEqual(['.RR.', 'RRRR', 'YYBY', 'YYBY']);
    expect(sizeOf(HOUSE)).toBe(4);
    expect(sizeOf('RWR/RRR/.W.')).toBe(3);
    expect(sizeOf('OO.OO/OYBYO/..B../OYBYO/OO.OO')).toBe(5);
  });

  it('reads the squares row by row, left to right, with null for an empty square', () => {
    expect(cellsOf('R.G/.Y./BOW')).toEqual(['red', null, 'green', null, 'yellow', null, 'blue', 'orange', 'white']);
    expect(cellsOf(HOUSE)).toEqual([...BOARD_PICTURES.house.cells]);
  });

  it('gives one square per letter: size x size squares for every picture', () => {
    for (const p of PICTURES) expect(cellsOf(p.art), label(p)).toHaveLength(BRIEF_SETS[p.set].size ** 2);
  });

  it('counts the bricks, never the empty squares', () => {
    expect(brickCount(HOUSE)).toBe(14);
    expect(brickCount('.../.R./...')).toBe(1);
    expect(brickCount('.../.../...')).toBe(0);
    for (const p of PICTURES) expect(brickCount(p.art), label(p)).toBe(filled(p.art));
  });

  it('lists the colours a picture uses once each, in palette order', () => {
    expect(colorsOf(HOUSE)).toEqual(['red', 'yellow', 'blue']);
    expect(colorsOf('W.R/.../ORW')).toEqual(['red', 'orange', 'white']);
    expect(colorsOf('.../.../...')).toEqual([]);
    for (const p of PICTURES) expect(colorsOf(p.art), label(p)).toHaveLength(BRIEF_SETS[p.set].colors);
  });
});
