/**
 * Shape Sorter content checks (six-games brief 4.2, 9.4, 6): all 9 levels x 6 boards, against the level table,
 * the family rule, the colour rules, the board's sets and the "same input, same board" rule. The expected values
 * are written out here from the brief and the board (design/canvas/Sorter.dc.html), not read from the module, so
 * a change to the generator that breaks a rule fails here.
 */
import { describe, expect, it, vi } from 'vitest';
import { AGE_BANDS, PUZZLES_PER_LEVEL, type AgeBand } from '../../shared/progress';
import { rng, shuffle } from '../../shared/rng';
import {
  LEVEL_COUNT,
  MAX_PIECES,
  SORTER_SEED,
  SORTER_SET_VERSION,
  fits,
  makePuzzles,
  puzzle,
  slipKey,
  type SorterPiece,
  type SorterPuzzle,
} from './puzzles';

/* ---------- The brief, written out ---------- */

/** 4.2 shapes: the board's five plus rectangle, diamond and pentagon. */
const BRIEF_SHAPES = ['circle', 'square', 'triangle', 'star', 'hexagon', 'rectangle', 'diamond', 'pentagon'];
/** 4.2 families: square, rectangle and diamond; pentagon and hexagon; circle, triangle and star alone. */
const BRIEF_FAMILIES = [['square', 'rectangle', 'diamond'], ['pentagon', 'hexagon'], ['circle'], ['triangle'], ['star']];
const familyIndex = (shape: string) => BRIEF_FAMILIES.findIndex((f) => f.includes(shape));
/** 4.2 colours: the board's six. */
const BRIEF_COLORS = ['yellow', 'red', 'blue', 'green', 'pink', 'purple'];
/** 9.4: never red with green, blue with purple, or red with pink in one puzzle. */
const BRIEF_AVOID: readonly [string, string][] = [
  ['red', 'green'],
  ['blue', 'purple'],
  ['red', 'pink'],
];

type Form = 'grid' | 'two-of-three' | 'one-left-out';
interface Row {
  pieces: number;
  shapes: number;
  colors: number;
  colorMatters: boolean;
  form: Form;
}
/** The 4.2 level table: Level 1 is index 0. */
const TABLE: readonly Row[] = [
  { pieces: 2, shapes: 2, colors: 1, colorMatters: false, form: 'grid' },
  { pieces: 3, shapes: 3, colors: 1, colorMatters: false, form: 'grid' },
  { pieces: 5, shapes: 5, colors: 1, colorMatters: false, form: 'grid' },
  { pieces: 4, shapes: 2, colors: 2, colorMatters: true, form: 'grid' },
  { pieces: 6, shapes: 3, colors: 3, colorMatters: true, form: 'two-of-three' },
  { pieces: 6, shapes: 2, colors: 3, colorMatters: true, form: 'grid' },
  { pieces: 8, shapes: 4, colors: 2, colorMatters: true, form: 'grid' },
  { pieces: 8, shapes: 3, colors: 3, colorMatters: true, form: 'one-left-out' },
  { pieces: 8, shapes: 4, colors: 2, colorMatters: true, form: 'grid' },
];

/**
 * Puzzle 1 of Levels 1 to 5 is the board's set (Sorter.dc.html levels()), as `<color>-<shape>` ids.
 * Level 5 has the board's green pieces made yellow (9.4): green triangle and green star become yellow ones.
 */
const BOARD_SETS: readonly string[][] = [
  ['yellow-circle', 'yellow-square'],
  ['yellow-circle', 'yellow-square', 'yellow-triangle'],
  ['yellow-circle', 'yellow-square', 'yellow-triangle', 'yellow-star', 'yellow-hexagon'],
  ['red-circle', 'blue-circle', 'red-square', 'blue-square'],
  ['red-circle', 'blue-circle', 'yellow-triangle', 'red-triangle', 'blue-star', 'yellow-star'],
];

/* ---------- Helpers ---------- */

const LEVELS = Array.from({ length: LEVEL_COUNT }, (_, i) => i);
const ALL: SorterPuzzle[] = LEVELS.flatMap((l) => makePuzzles(l));
const name = (p: SorterPuzzle) => `level ${p.level + 1} puzzle ${p.n + 1}`;
const uniq = <T,>(xs: readonly T[]) => [...new Set(xs)];
const shapesOf = (p: SorterPuzzle) => uniq(p.pieces.map((x) => x.shape)).sort();
const colorsOf = (p: SorterPuzzle) => uniq(p.pieces.map((x) => x.color)).sort();
const setKey = (ps: readonly SorterPiece[]) => ps.map((x) => x.id).sort().join('|');
const orderKey = (ps: readonly SorterPiece[]) => ps.map((x) => x.id).join('|');
const SEEDS = [0, 1, 2, 7, 42, 999, 2 ** 31 - 1, 4294967295, -1, ...Array.from({ length: 191 }, (_, i) => i * 7919 + 11)];

/** Dump of one board, for the pin and the fresh-import check. */
const dump = (p: SorterPuzzle) => `${p.level}.${p.n} ${p.colorMatters ? 1 : 0} ${orderKey(p.pieces)} / ${orderKey(p.holes)}`;
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/* ---------- Counts and the level table ---------- */

describe('Shape Sorter holds 9 levels of 6 boards (4.2, 7.9)', () => {
  it('has 9 levels and 54 boards, numbered from 0 like the progress store', () => {
    expect(LEVEL_COUNT).toBe(9);
    expect(ALL).toHaveLength(54);
    for (const l of LEVELS) {
      const ps = makePuzzles(l);
      expect(ps).toHaveLength(PUZZLES_PER_LEVEL);
      ps.forEach((p, n) => {
        expect(p.level).toBe(l);
        expect(p.n).toBe(n);
      });
    }
  });

  it('gives makePuzzles the same six boards as puzzle(level, n), in puzzle order', () => {
    for (const l of LEVELS) expect(makePuzzles(l)).toEqual(Array.from({ length: PUZZLES_PER_LEVEL }, (_, n) => puzzle(l, n)));
  });

  it('keeps every board to 8 pieces at most (2 tray rows, 3 hole rows), and the big boards at exactly 8', () => {
    expect(MAX_PIECES).toBe(8);
    for (const p of ALL) expect(p.pieces.length, name(p)).toBeLessThanOrEqual(8);
    for (const l of [6, 7, 8]) for (const p of makePuzzles(l)) expect(p.pieces, name(p)).toHaveLength(8);
  });

  LEVELS.forEach((l) => {
    const row = TABLE[l];
    it(`level ${l + 1}: ${row.pieces} pieces, ${row.shapes} shapes, ${row.colors} colour${row.colors > 1 ? 's' : ''}${row.colorMatters ? ', colour matters' : ''}`, () => {
      for (const p of makePuzzles(l)) {
        expect(p.colorMatters, name(p)).toBe(row.colorMatters);
        expect(p.pieces, name(p)).toHaveLength(row.pieces);
        expect(p.holes, name(p)).toHaveLength(row.pieces);
        expect(shapesOf(p), name(p)).toHaveLength(row.shapes);
        expect(colorsOf(p), name(p)).toHaveLength(row.colors);
      }
    });
  });

  it('gives the six boards of a level the same piece, shape and colour counts', () => {
    for (const l of LEVELS) {
      const counts = makePuzzles(l).map((p) => [p.pieces.length, shapesOf(p).length, colorsOf(p).length].join('/'));
      expect(uniq(counts), `level ${l + 1}`).toHaveLength(1);
    }
  });

  it('builds the grid levels (1 to 4, 6, 7, 9) from every shape in every colour', () => {
    for (const p of ALL.filter((x) => TABLE[x.level].form === 'grid')) {
      const want = shapesOf(p).flatMap((s) => colorsOf(p).map((c) => `${c}-${s}`));
      expect(setKey(p.pieces), name(p)).toBe(want.sort().join('|'));
    }
  });

  it('puts each of Level 5’s 3 shapes in 2 of its 3 colours', () => {
    for (const p of makePuzzles(4)) {
      for (const s of shapesOf(p)) expect(p.pieces.filter((x) => x.shape === s), `${name(p)} ${s}`).toHaveLength(2);
    }
  });

  it('leaves exactly one piece of Level 8’s 3 x 3 grid out', () => {
    for (const p of makePuzzles(7)) {
      const grid = shapesOf(p).flatMap((s) => colorsOf(p).map((c) => `${c}-${s}`));
      const ids = p.pieces.map((x) => x.id);
      expect(grid, name(p)).toHaveLength(9);
      expect(grid.filter((id) => !ids.includes(id)), name(p)).toHaveLength(1);
      for (const id of ids) expect(grid, name(p)).toContain(id);
    }
  });

  it('lets the chapters grow: piece counts never drop inside a chapter', () => {
    for (const start of [0, 3, 6]) {
      const counts = [start, start + 1, start + 2].map((l) => puzzle(l, 0).pieces.length);
      expect(counts, `chapter from level ${start + 1}`).toEqual([...counts].sort((a, b) => a - b));
    }
  });
});

/* ---------- Pieces and holes ---------- */

describe('every board has unique pieces and one hole for each (4.2)', () => {
  it('gives each piece a unique `<color>-<shape>` id from the brief’s shapes and colours', () => {
    for (const p of ALL) {
      const ids = p.pieces.map((x) => x.id);
      expect(uniq(ids), name(p)).toHaveLength(ids.length);
      for (const x of p.pieces) {
        expect(BRIEF_SHAPES, name(p)).toContain(x.shape);
        expect(BRIEF_COLORS, name(p)).toContain(x.color);
        expect(x.id, name(p)).toBe(`${x.color}-${x.shape}`);
      }
    }
  });

  it('has exactly one hole per piece: the holes are the pieces in another order', () => {
    for (const p of ALL) {
      expect(setKey(p.holes), name(p)).toBe(setKey(p.pieces));
      expect(uniq(p.holes.map((h) => h.id)), name(p)).toHaveLength(p.holes.length);
      for (const h of p.holes) expect(p.pieces.find((x) => x.id === h.id), name(p)).toEqual(h);
    }
  });

  it('starts no piece over its own hole: tray place i and hole i never hold the same piece', () => {
    for (const p of ALL) p.pieces.forEach((x, i) => expect(p.holes[i].id, `${name(p)} place ${i + 1}`).not.toBe(x.id));
  });
});

/* ---------- Shapes: the family rule ---------- */

describe('the family rule (4.2)', () => {
  it('takes at most one shape per family on Levels 1 to 8', () => {
    for (const p of ALL.filter((x) => x.level < 8)) {
      const fams = shapesOf(p).map(familyIndex);
      expect(fams, name(p)).not.toContain(-1);
      expect(uniq(fams), name(p)).toHaveLength(fams.length);
    }
  });

  it('takes one shape from each of the five families on Level 3, and uses all six such sets', () => {
    const possible = BRIEF_FAMILIES[0].flatMap((sq) => BRIEF_FAMILIES[1].map((ph) => [sq, ph, 'circle', 'triangle', 'star'].sort().join('|')));
    expect(possible).toHaveLength(6);
    const used = makePuzzles(2).map((p) => shapesOf(p).join('|'));
    expect(used.slice().sort()).toEqual(possible.slice().sort());
  });

  it('takes two square-family shapes plus pentagon and hexagon on Level 9 (the look-alike pairs)', () => {
    for (const p of makePuzzles(8)) {
      const s = shapesOf(p);
      expect(s.filter((x) => BRIEF_FAMILIES[0].includes(x)), name(p)).toHaveLength(2);
      expect(s, name(p)).toContain('pentagon');
      expect(s, name(p)).toContain('hexagon');
      expect(s, name(p)).toHaveLength(4);
    }
  });

  it('keeps look-alike pairs to Level 9 alone', () => {
    const withPairs = ALL.filter((p) => {
      const fams = shapesOf(p).map(familyIndex);
      return uniq(fams).length < fams.length;
    });
    expect(uniq(withPairs.map((p) => p.level))).toEqual([8]);
  });

  it('uses all eight shapes across the game, the three new ones included', () => {
    expect(uniq(ALL.flatMap((p) => p.pieces.map((x) => x.shape))).sort()).toEqual(BRIEF_SHAPES.slice().sort());
  });
});

/* ---------- Colours ---------- */

describe('colours on the boards (4.2, 9.4)', () => {
  it('uses yellow only on the shape levels (1 to 3)', () => {
    for (const p of ALL.filter((x) => x.level < 3)) expect(colorsOf(p), name(p)).toEqual(['yellow']);
  });

  it('never puts an avoid pair on one board: red and green, blue and purple, red and pink', () => {
    for (const p of ALL) {
      const cs: string[] = colorsOf(p);
      for (const [a, b] of BRIEF_AVOID) expect(cs.includes(a) && cs.includes(b), `${name(p)}: ${a} with ${b}`).toBe(false);
    }
  });

  it('gives every piece on a colour level a shape-mate and a colour-mate, so neither alone solves it', () => {
    for (const p of ALL.filter((x) => x.colorMatters)) {
      for (const x of p.pieces) {
        const others = p.pieces.filter((y) => y.id !== x.id);
        expect(others.some((y) => y.shape === x.shape), `${name(p)} ${x.id} shape-mate`).toBe(true);
        expect(others.some((y) => y.color === x.color), `${name(p)} ${x.id} colour-mate`).toBe(true);
      }
    }
  });

  it('draws the colour levels from more than one set of colours across the game', () => {
    const sets = uniq(ALL.filter((p) => p.colorMatters).map((p) => colorsOf(p).join('|')));
    expect(sets.length).toBeGreaterThan(1);
    expect(uniq(ALL.flatMap((p) => colorsOf(p))).sort()).toEqual(BRIEF_COLORS.slice().sort());
  });
});

/* ---------- Six different boards ---------- */

describe('six different boards per level, so a swap always brings a new one (4.2, four-puzzle 3)', () => {
  it('never repeats a piece set inside a level', () => {
    for (const l of LEVELS) expect(uniq(makePuzzles(l).map((p) => setKey(p.pieces))), `level ${l + 1}`).toHaveLength(6);
  });

  it('never repeats a hole order inside a level', () => {
    for (const l of LEVELS) expect(uniq(makePuzzles(l).map((p) => orderKey(p.holes))), `level ${l + 1}`).toHaveLength(6);
  });

  it('never repeats a tray order inside a level', () => {
    for (const l of LEVELS) expect(uniq(makePuzzles(l).map((p) => orderKey(p.pieces))), `level ${l + 1}`).toHaveLength(6);
  });
});

/* ---------- The board's sets ---------- */

describe('puzzle 1 of Levels 1 to 5 is the board’s set (4.2)', () => {
  BOARD_SETS.forEach((ids, l) => {
    it(`level ${l + 1} puzzle 1 holds ${ids.join(', ')}`, () => {
      const p = puzzle(l, 0);
      expect(p.pieces.map((x) => x.id).sort()).toEqual(ids.slice().sort());
    });
  });

  it('keeps no green on Level 5’s first board, where the board had green', () => {
    expect(puzzle(4, 0).pieces.some((x) => x.color === 'green')).toBe(false);
  });

  it('keeps the board’s sets to puzzle 1: puzzles 2 to 6 of Levels 1 to 5 are other sets', () => {
    BOARD_SETS.forEach((ids, l) => {
      for (let n = 1; n < PUZZLES_PER_LEVEL; n++) expect(setKey(puzzle(l, n).pieces), `level ${l + 1} puzzle ${n + 1}`).not.toBe(ids.slice().sort().join('|'));
    });
  });
});

/* ---------- Solvable by the rules ---------- */

describe('every board can be solved by the brief’s rules (4.2)', () => {
  it('fits each piece into its own hole and no other one', () => {
    for (const p of ALL) {
      for (const x of p.pieces)
        for (const h of p.holes) expect(fits(x, h, p.colorMatters), `${name(p)}: ${x.id} on ${h.id}`).toBe(x.id === h.id);
    }
  });

  /**
   * Plays a board in the given order, trying each piece first on every empty hole that is not its own:
   * each wrong try feeds the stuck count and adds its slip key, and must leave the holes as they were.
   */
  function play(p: SorterPuzzle, order: readonly SorterPiece[]) {
    const filled = new Set<string>();
    const keys = new Set<string>();
    let tries = 0;
    for (const x of order) {
      for (const h of p.holes) {
        if (filled.has(h.id) || h.id === x.id) continue;
        const before = [...filled].join('|');
        expect(fits(x, h, p.colorMatters), `${name(p)}: ${x.id} on ${h.id}`).toBe(false);
        tries++;
        keys.add(slipKey(x.id, h.id));
        expect([...filled].join('|'), `${name(p)}: a wrong hole fills nothing`).toBe(before);
      }
      const home = p.holes.filter((h) => !filled.has(h.id) && fits(x, h, p.colorMatters));
      expect(home.map((h) => h.id), `${name(p)}: ${x.id} has one empty home`).toEqual([x.id]);
      filled.add(home[0].id);
    }
    return { filled, tries, keys };
  }

  it('finishes in any order, and a wrong hole changes only the slip count', () => {
    const permutations = <T,>(xs: readonly T[]): T[][] =>
      xs.length <= 1 ? [xs.slice()] : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r]));
    for (const p of ALL) {
      const orders = p.pieces.length <= 5 ? permutations(p.pieces) : Array.from({ length: 40 }, (_, k) => shuffle(p.pieces, rng(p.level * 1000 + p.n * 50 + k)));
      for (const order of orders) {
        const { filled, tries, keys } = play(p, order);
        expect(filled.size, name(p)).toBe(p.holes.length);
        // Every wrong pair is tried once here, so each try has its own slip key.
        expect(keys.size, name(p)).toBe(tries);
      }
    }
  });

  it('counts a repeated wrong pair under one slip key and every other wrong pair under its own', () => {
    for (const p of ALL) {
      const keys = p.pieces.flatMap((x) => p.holes.filter((h) => h.id !== x.id).map((h) => slipKey(x.id, h.id)));
      expect(uniq(keys), name(p)).toHaveLength(p.pieces.length * (p.pieces.length - 1));
      const [x] = p.pieces;
      const h = p.holes.find((y) => y.id !== x.id)!;
      expect(slipKey(x.id, h.id)).toBe(slipKey(x.id, h.id));
    }
  });
});

/* ---------- Same input, same board ---------- */

describe('same input, same board: set sorter:1, seed 0 (4.2, 6)', () => {
  it('keeps the run seed at 0 and the set version at 1', () => {
    expect(SORTER_SEED).toBe(0);
    expect(SORTER_SET_VERSION).toBe(1);
  });

  it('returns the same board for the same level and puzzle number', () => {
    for (const l of LEVELS) for (let n = 0; n < PUZZLES_PER_LEVEL; n++) expect(puzzle(l, n)).toEqual(puzzle(l, n));
  });

  it('gives the same board for every run seed and every age band (the band changes only the stuck limits)', () => {
    for (const l of LEVELS)
      for (let n = 0; n < PUZZLES_PER_LEVEL; n++) {
        const want = dump(puzzle(l, n));
        for (const band of AGE_BANDS) for (const seed of SEEDS) expect(dump(puzzle(l, n, { seed, band })), `level ${l + 1} puzzle ${n + 1} ${band} seed ${seed}`).toBe(want);
      }
  });

  it('gives the youngest and oldest bands the same first and last boards', () => {
    const edges: AgeBand[] = ['3-4', '9-10'];
    for (const [l, n] of [
      [0, 0],
      [0, 5],
      [8, 0],
      [8, 5],
    ])
      expect(puzzle(l, n, { seed: 0, band: edges[0] })).toEqual(puzzle(l, n, { seed: 123456, band: edges[1] }));
  });

  it('hands out a fresh copy: changing one board leaves the next call alone', () => {
    const a = puzzle(6, 2);
    const want = dump(a);
    a.pieces.reverse();
    a.holes[0].color = 'green';
    a.holes.pop();
    a.pieces[0].shape = 'star';
    expect(dump(puzzle(6, 2))).toBe(want);
    const all = makePuzzles(6);
    all[2].pieces.length = 0;
    expect(dump(makePuzzles(6)[2])).toBe(want);
  });

  it('builds the same boards after a fresh load of the module', async () => {
    const before = ALL.map(dump);
    vi.resetModules();
    const fresh = await import('./puzzles');
    const again = LEVELS.flatMap((l) => fresh.makePuzzles(l)).map(dump);
    expect(again).toEqual(before);
    // Ask in another order on the fresh module: the cache must not change what comes back.
    const reversed = LEVELS.slice()
      .reverse()
      .flatMap((l) => [5, 4, 3, 2, 1, 0].map((n) => dump(fresh.puzzle(l, n))));
    expect(reversed.slice().sort()).toEqual(before.slice().sort());
  });

  /**
   * Stored runs keep only puzzle numbers, so a resumed level rebuilds its boards from code. If the boards change,
   * raise SORTER_SET_VERSION (brief 6, so stored runs restart at puzzle 1) and pin the new fingerprints under it.
   */
  it('keeps the boards pinned to set version 1', () => {
    const PINS: Record<number, string[]> = {
      1: ['a0abeadc', 'df13917e', '138fcebc', '704b08ba', '62c7fd46', '3b3e80fc', '33e49d3a', '02a8d948', '02741932'],
    };
    const got = LEVELS.map((l) => fnv(makePuzzles(l).map(dump).join('\n')));
    expect(PINS[SORTER_SET_VERSION], `no pin for set version ${SORTER_SET_VERSION}`).toBeDefined();
    expect(got, 'the boards changed: raise SORTER_SET_VERSION and pin the new boards').toEqual(PINS[SORTER_SET_VERSION]);
  });
});

/* ---------- Error paths ---------- */

describe('bad level or puzzle numbers throw (10.2)', () => {
  const badLevels = [-1, 9, 10, 100, 0.5, 8.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
  const badPuzzles = [-1, 6, 7, 2.5, Number.NaN, Number.POSITIVE_INFINITY];

  it('throws a RangeError for a level outside 0 to 8', () => {
    for (const l of badLevels) expect(() => puzzle(l, 0), `level ${l}`).toThrow(RangeError);
  });

  it('throws a RangeError for a puzzle number outside 0 to 5', () => {
    for (const n of badPuzzles) expect(() => puzzle(0, n), `puzzle ${n}`).toThrow(RangeError);
    for (const n of badPuzzles) expect(() => puzzle(8, n), `last level, puzzle ${n}`).toThrow(RangeError);
  });

  it('throws for values that are not numbers at all', () => {
    expect(() => puzzle('1' as unknown as number, 0)).toThrow(RangeError);
    expect(() => puzzle(0, null as unknown as number)).toThrow(RangeError);
    expect(() => puzzle(undefined as unknown as number, 0)).toThrow(RangeError);
  });

  it('throws from makePuzzles for a level outside 0 to 8', () => {
    for (const l of badLevels) expect(() => makePuzzles(l), `level ${l}`).toThrow(RangeError);
  });

  it('accepts the first and last level and puzzle numbers', () => {
    for (const [l, n] of [
      [0, 0],
      [0, 5],
      [8, 0],
      [8, 5],
    ])
      expect(puzzle(l, n)).toMatchObject({ level: l, n });
  });

  it('still answers after a bad call', () => {
    const want = dump(puzzle(3, 3));
    expect(() => puzzle(3, 6)).toThrow(RangeError);
    expect(dump(puzzle(3, 3))).toBe(want);
  });
});
