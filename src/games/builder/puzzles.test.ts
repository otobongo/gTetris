/**
 * Picture Builder's 72 puzzle slots (six-games brief 4.6 "Content checks", 6, 7.8, 10.2): the 12-level table, which
 * picture each puzzle shows, the content checks per level (grid, colours, only the 6 board colours, filled squares,
 * no two pictures equal after mirroring or renaming colours, names), the board's tree, house and boat as puzzle 1
 * of Levels 3 to 5, memory levels on their copy level's pictures, fixed content for every seed and band, the look
 * times per band, and the error paths. The expected values are written out from the brief, not read from the module.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, PUZZLES_PER_LEVEL, type AgeBand } from '../../shared/progress';
import { cellsOf, type Picture } from './pictures';
import {
  BUILDER_SEED,
  BUILDER_SET_VERSION,
  BUILDER_TITLE,
  GAME_STARS,
  LEVELS,
  LEVEL_COUNT,
  LOOK_SECONDS,
  MEMORY_SHIFT,
  levelDef,
  lookSeconds,
  makePuzzles,
  pictureIndex,
  puzzle,
  type BuilderPuzzle,
} from './puzzles';

/* ---------- The brief, written out ---------- */

interface Row {
  mode: 'copy' | 'memory';
  size: number;
  colors: number;
  set: string;
  min: number;
  max: number;
}
/** The 4.6 level table: Level 1 is index 0. Memory levels take their copy level's set and range ("as Level 1"). */
const TABLE: readonly Row[] = [
  { mode: 'copy', size: 3, colors: 2, set: 'A', min: 5, max: 7 },
  { mode: 'copy', size: 3, colors: 3, set: 'B', min: 6, max: 8 },
  { mode: 'copy', size: 4, colors: 2, set: 'C', min: 9, max: 11 },
  { mode: 'copy', size: 4, colors: 3, set: 'D', min: 12, max: 15 },
  { mode: 'copy', size: 4, colors: 4, set: 'E', min: 10, max: 13 },
  { mode: 'memory', size: 3, colors: 2, set: 'A', min: 5, max: 7 },
  { mode: 'memory', size: 3, colors: 3, set: 'B', min: 6, max: 8 },
  { mode: 'memory', size: 4, colors: 3, set: 'D', min: 12, max: 15 },
  { mode: 'memory', size: 4, colors: 4, set: 'E', min: 10, max: 13 },
  { mode: 'copy', size: 5, colors: 3, set: 'F', min: 15, max: 20 },
  { mode: 'copy', size: 5, colors: 4, set: 'G', min: 15, max: 20 },
  { mode: 'memory', size: 5, colors: 4, set: 'G', min: 15, max: 20 },
];
/** Each memory level and the copy level whose pictures it reuses (0-based): 6 on 1, 7 on 2, 8 on 4, 9 on 5, 12 on 11. */
const MEMORY_OF: Readonly<Record<number, number>> = { 5: 0, 6: 1, 7: 3, 8: 4, 11: 10 };
/** The board's 6 colours. */
const BOARD_COLORS = ['red', 'yellow', 'green', 'blue', 'orange', 'white'];
/** The board's tree, house and boat (Builder.dc.html), puzzle 1 of Levels 3, 4 and 5. */
const BOARD_FIRSTS: readonly [level: number, name: string, art: string][] = [
  [2, 'tree', '.GG./GGGG/.OO./.OO.'],
  [3, 'house', '.RR./RRRR/YYBY/YYBY'],
  [4, 'boat', '.R../.WW./OOOO/BBBB'],
];
/** 4.6 look times by band: first look on memory levels, then each Peek (the board has 4 s and 2 s). */
const BRIEF_LOOK: Record<AgeBand, { first: number; peek: number }> = {
  '3-4': { first: 6, peek: 3 },
  '5-6': { first: 5, peek: 2 },
  '7-8': { first: 4, peek: 2 },
  '9-10': { first: 3, peek: 2 },
};

/* ---------- Helpers ---------- */

const LEVEL_IDS = Array.from({ length: 12 }, (_, i) => i);
const NS = Array.from({ length: PUZZLES_PER_LEVEL }, (_, i) => i);
const ALL: BuilderPuzzle[] = LEVEL_IDS.flatMap((l) => makePuzzles(l));
const at = (p: BuilderPuzzle) => `Level ${p.level + 1} puzzle ${p.n + 1} (${p.picture.name})`;
const bricksOf = (p: BuilderPuzzle) => p.target.filter((c) => c !== null).length;
const colorsIn = (p: BuilderPuzzle) => new Set(p.target.filter((c) => c !== null));

const grid = (art: string): string[][] => art.split('/').map((r) => r.split(''));
function renamed(g: string[][]): string {
  const names = new Map<string, string>();
  return g.map((r) => r.map((ch) => (ch === '.' ? '.' : (names.get(ch) ?? (names.set(ch, String.fromCharCode(97 + names.size)), names.get(ch)!)))).join('')).join('/');
}
const forms = (art: string): Set<string> => {
  const g = grid(art);
  const lr = g.map((r) => [...r].reverse());
  return new Set([g, lr, [...g].reverse(), [...lr].reverse()].map(renamed));
};
const sameDrawing = (a: string, b: string): boolean => [...forms(a)].some((f) => forms(b).has(f));
const SEEDS = [0, 1, 42, 4242, 2 ** 31 - 1];

/* ---------- The level table ---------- */

describe('Picture Builder holds 12 levels of 6 puzzles from 42 pictures (4.6, 7.9)', () => {
  it('has 12 levels and 72 puzzles, numbered from 0 like the progress store', () => {
    expect(LEVEL_COUNT).toBe(12);
    expect(LEVELS).toHaveLength(12);
    expect(ALL).toHaveLength(72);
    for (const l of LEVEL_IDS) {
      const ps = makePuzzles(l);
      expect(ps).toHaveLength(PUZZLES_PER_LEVEL);
      ps.forEach((p, n) => {
        expect(p.level).toBe(l);
        expect(p.n).toBe(n);
      });
    }
  });

  it('gives makePuzzles the same six puzzles as puzzle(level, n), in puzzle order', () => {
    for (const l of LEVEL_IDS) expect(makePuzzles(l)).toEqual(NS.map((n) => puzzle(l, n)));
  });

  it('shows the 42 pictures in the 72 slots, each one where its levels say', () => {
    expect(new Set(ALL.map((p) => p.picture.id)).size).toBe(42);
    for (const p of ALL) expect(p.picture.levels, at(p)).toContain(p.level + 1);
    const seenAt = new Map<string, number[]>();
    for (const p of ALL) seenAt.set(p.picture.id, [...(seenAt.get(p.picture.id) ?? []), p.level + 1]);
    for (const p of ALL) expect(seenAt.get(p.picture.id), at(p)).toEqual([...p.picture.levels]);
  });

  it('names the game Picture Builder, set version 1 and seed 0, with 36 stars to earn', () => {
    expect(BUILDER_TITLE).toBe('Picture Builder');
    expect(BUILDER_SET_VERSION).toBe(1);
    expect(BUILDER_SEED).toBe(0);
    expect(GAME_STARS).toBe(36);
  });

  LEVEL_IDS.forEach((l) => {
    const row = TABLE[l];
    it(`Level ${l + 1}: ${row.mode}, ${row.size}x${row.size}, ${row.colors} colours, set ${row.set}, ${row.min} to ${row.max} bricks`, () => {
      expect(levelDef(l)).toEqual({ mode: row.mode, set: row.set, size: row.size, colors: row.colors, fill: { min: row.min, max: row.max } });
      for (const p of makePuzzles(l)) {
        expect(p.mode, at(p)).toBe(row.mode);
        expect(p.size, at(p)).toBe(row.size);
        expect(p.picture.set, at(p)).toBe(row.set);
      }
    });
  });

  it('has five copy levels, four memory levels, then three 5x5 levels with memory last (4.6)', () => {
    expect(LEVELS.map((d) => d.mode)).toEqual([...Array(5).fill('copy'), ...Array(4).fill('memory'), 'copy', 'copy', 'memory']);
    expect(LEVELS.map((d) => d.size)).toEqual([3, 3, 4, 4, 4, 3, 3, 4, 4, 5, 5, 5]);
  });
});

/* ---------- Content checks over the 72 slots ---------- */

describe('content checks, every puzzle of every level (4.6)', () => {
  it('equals the level’s grid size: size x size squares', () => {
    for (const p of ALL) {
      expect(p.size, at(p)).toBe(TABLE[p.level].size);
      expect(p.target, at(p)).toHaveLength(TABLE[p.level].size ** 2);
      expect(p.picture.art.split('/'), at(p)).toHaveLength(p.size);
    }
  });

  it('uses exactly the level’s number of colours, only the 6 board colours', () => {
    for (const p of ALL) {
      expect(colorsIn(p).size, at(p)).toBe(TABLE[p.level].colors);
      for (const c of colorsIn(p)) expect(BOARD_COLORS, at(p)).toContain(c);
    }
  });

  it('fills a number of squares inside the level’s range, and counts them as the match bar’s total', () => {
    for (const p of ALL) {
      expect(bricksOf(p), at(p)).toBeGreaterThanOrEqual(TABLE[p.level].min);
      expect(bricksOf(p), at(p)).toBeLessThanOrEqual(TABLE[p.level].max);
      expect(p.bricks, at(p)).toBe(bricksOf(p));
    }
  });

  it('has no blank and no one-colour picture', () => {
    for (const p of ALL) {
      expect(bricksOf(p), at(p)).toBeGreaterThan(0);
      expect(colorsIn(p).size, at(p)).toBeGreaterThanOrEqual(2);
    }
  });

  it('builds the target from the picture string, square by square', () => {
    for (const p of ALL) expect([...p.target], at(p)).toEqual(cellsOf(p.picture.art));
  });

  it('shows six different pictures in every level', () => {
    for (const l of LEVEL_IDS) expect(new Set(makePuzzles(l).map((p) => p.picture.id)).size, `Level ${l + 1}`).toBe(6);
  });

  it('leaves no two pictures in a level equal after mirroring or renaming colours', () => {
    const clashes: string[] = [];
    for (const l of LEVEL_IDS) {
      const ps = makePuzzles(l);
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) if (sameDrawing(ps[i].picture.art, ps[j].picture.art)) clashes.push(`${at(ps[i])} = ${at(ps[j])}`);
    }
    expect(clashes).toEqual([]);
  });

  it('names each level’s pictures uniquely, letters and spaces only, 12 characters or fewer', () => {
    for (const l of LEVEL_IDS) {
      const names = makePuzzles(l).map((p) => p.picture.name);
      expect(new Set(names).size, `Level ${l + 1}`).toBe(6);
      for (const name of names) {
        expect(name, `Level ${l + 1}`).toMatch(/^[A-Za-z]+( [A-Za-z]+)*$/);
        expect(name.length, `Level ${l + 1} ${name}`).toBeLessThanOrEqual(12);
      }
    }
  });

  it('never puts a brick colour outside the board’s six or an empty square anywhere but null', () => {
    for (const p of ALL) for (const c of p.target) expect(c === null || BOARD_COLORS.includes(c), at(p)).toBe(true);
  });
});

describe('the board’s pictures and the memory levels (4.6)', () => {
  for (const [l, name, art] of BOARD_FIRSTS) {
    it(`opens Level ${l + 1} with the board’s ${name}`, () => {
      const p = puzzle(l, 0);
      expect(p.picture.name).toBe(name);
      expect(p.picture.art).toBe(art);
      expect(p.mode).toBe('copy');
    });
  }

  it('shows the board’s tree, house and boat on no level other than their copy level and its memory level', () => {
    const where = (name: string) => ALL.filter((p) => p.picture.name === name).map((p) => p.level + 1);
    expect(where('tree')).toEqual([3]);
    expect(where('house')).toEqual([4, 8]);
    expect(where('boat')).toEqual([5, 9]);
  });

  for (const [memory, copy] of Object.entries(MEMORY_OF)) {
    const m = Number(memory);
    it(`Level ${m + 1} holds Level ${copy + 1}’s six pictures, puzzle n showing its puzzle (n + 3) mod 6`, () => {
      const copies = makePuzzles(copy);
      const memories = makePuzzles(m);
      expect(new Set(memories.map((p) => p.picture.id))).toEqual(new Set(copies.map((p) => p.picture.id)));
      memories.forEach((p, n) => {
        expect(p.picture, at(p)).toEqual(copies[(n + 3) % 6].picture);
        expect(p.target, at(p)).toEqual(copies[(n + 3) % 6].target);
      });
    });
  }

  it('shows every memory puzzle in a new order: never the picture its copy level shows at the same puzzle number', () => {
    for (const [memory, copy] of Object.entries(MEMORY_OF)) for (const n of NS) expect(puzzle(Number(memory), n).picture.id).not.toBe(puzzle(copy, n).picture.id);
  });

  it('gives Level 3’s set (2-colour 4x4) no memory level, and the 5x5 memory level the 4-colour set', () => {
    const cSet = puzzle(2, 0).picture.set;
    expect(ALL.filter((p) => p.picture.set === cSet).every((p) => p.level === 2)).toBe(true);
    expect(puzzle(11, 0).picture.set).toBe(puzzle(10, 0).picture.set);
  });

  it('picks the picture index n on copy levels and (n + 3) mod 6 on memory levels', () => {
    expect(MEMORY_SHIFT).toBe(3);
    for (const l of LEVEL_IDS) for (const n of NS) expect(pictureIndex(l, n), `Level ${l + 1} puzzle ${n + 1}`).toBe(TABLE[l].mode === 'memory' ? (n + 3) % 6 : n);
    expect(NS.map((n) => pictureIndex(5, n))).toEqual([3, 4, 5, 0, 1, 2]);
  });
});

/* ---------- Fixed content (4.6, 6) ---------- */

describe('fixed content: set builder:1, seed 0, the same pictures for every band (4.6, 6)', () => {
  it('gives the same puzzle for every seed and band', () => {
    for (const l of LEVEL_IDS)
      for (const n of NS) {
        const plain = puzzle(l, n);
        for (const seed of SEEDS) for (const band of AGE_BANDS) expect(puzzle(l, n, { seed, band }), `Level ${l + 1} puzzle ${n + 1}`).toEqual(plain);
      }
  });

  it('gives the same six puzzles every time a level is made', () => {
    for (const l of LEVEL_IDS) expect(makePuzzles(l)).toEqual(makePuzzles(l));
  });

  it('keeps a later puzzle whole when the caller writes to an earlier one', () => {
    const p = puzzle(3, 0);
    const before = [...p.target];
    try {
      (p.target as (string | null)[])[0] = 'green';
    } catch {
      // a frozen target refuses the write, which is fine too
    }
    expect([...puzzle(3, 0).target]).toEqual(before);
    expect(puzzle(3, 0).picture.art).toBe('.RR./RRRR/YYBY/YYBY');
  });

  it('carries the picture itself, so the model panel and the solved line read its name and art', () => {
    const p: Picture = puzzle(3, 0).picture;
    expect(p.name).toBe('house');
    expect(p.art).toBe('.RR./RRRR/YYBY/YYBY');
  });
});

/* ---------- Look times (4.6, 7.8) ---------- */

describe('look times by age band (4.6, 7.8)', () => {
  it('holds the 4.6 table in one LOOK_SECONDS table, every band', () => {
    expect(LOOK_SECONDS).toEqual(BRIEF_LOOK);
    expect(Object.keys(LOOK_SECONDS).sort()).toEqual([...AGE_BANDS].sort());
  });

  for (const band of AGE_BANDS) {
    it(`gives ages ${band} a ${BRIEF_LOOK[band].first} s first look and ${BRIEF_LOOK[band].peek} s Peeks`, () => {
      expect(lookSeconds(band, 'first')).toBe(BRIEF_LOOK[band].first);
      expect(lookSeconds(band, 'peek')).toBe(BRIEF_LOOK[band].peek);
    });
  }

  it('keeps the board’s 4 s look and 2 s Peek at ages 7 to 8', () => {
    expect(lookSeconds('7-8', 'first')).toBe(4);
    expect(lookSeconds('7-8', 'peek')).toBe(2);
  });

  it('gives the youngest the longest look and the oldest the shortest, and a Peek never outlasts the first look', () => {
    const firsts = AGE_BANDS.map((b) => lookSeconds(b, 'first'));
    for (let i = 1; i < firsts.length; i++) expect(firsts[i]).toBeLessThanOrEqual(firsts[i - 1]);
    expect(lookSeconds('3-4', 'first')).toBe(Math.max(...firsts));
    expect(lookSeconds('9-10', 'first')).toBe(Math.min(...firsts));
    for (const b of AGE_BANDS) expect(lookSeconds(b, 'peek'), b).toBeLessThanOrEqual(lookSeconds(b, 'first'));
  });

  it('falls back to the 5 to 6 times for a band it does not know, the store’s default band', () => {
    expect(lookSeconds('11-12' as AgeBand, 'first')).toBe(5);
    expect(lookSeconds(undefined as unknown as AgeBand, 'peek')).toBe(2);
  });
});

/* ---------- Error paths (10.2) ---------- */

describe('error paths: a level or puzzle number out of range throws (10.2)', () => {
  const BAD_LEVELS = [-1, 12, 13, 100, 1.5, Number.NaN, Number.POSITIVE_INFINITY];
  const BAD_PUZZLES = [-1, 6, 7, 2.5, Number.NaN];

  it('throws a RangeError from puzzle for a level outside 0 to 11', () => {
    for (const l of BAD_LEVELS) expect(() => puzzle(l, 0), `level ${l}`).toThrow(RangeError);
  });

  it('throws a RangeError from puzzle for a puzzle number outside 0 to 5, on the first and the last level', () => {
    for (const l of [0, 11]) for (const n of BAD_PUZZLES) expect(() => puzzle(l, n), `level ${l} puzzle ${n}`).toThrow(RangeError);
  });

  it('throws from makePuzzles, levelDef and pictureIndex for a level that is not there', () => {
    for (const l of BAD_LEVELS) {
      expect(() => makePuzzles(l), `level ${l}`).toThrow(RangeError);
      expect(() => levelDef(l), `level ${l}`).toThrow(RangeError);
      expect(() => pictureIndex(l, 0), `level ${l}`).toThrow(RangeError);
    }
  });

  it('throws from pictureIndex for a puzzle number that is not there', () => {
    for (const n of BAD_PUZZLES) expect(() => pictureIndex(5, n), `puzzle ${n}`).toThrow(RangeError);
  });

  it('accepts the first and last level and the first and last puzzle', () => {
    for (const l of [0, 11]) for (const n of [0, 5]) expect(() => puzzle(l, n)).not.toThrow();
    expect(puzzle(0, 0).picture.set).toBe(puzzle(5, 3).picture.set);
    expect(puzzle(11, 5).mode).toBe('memory');
  });
});
