/**
 * Shape Sorter content (brief 4.2): 9 levels x 6 boards = 54 puzzles on the four-puzzle level system.
 * Pure and fixed (set `sorter:1`, seed 0): `puzzle(level, n)` always gives the same board, so nothing is stored
 * and a resumed level shows the same boards. No React and no DOM.
 *
 * Levels and puzzle numbers are 0-based, as in the progress store (`LevelRun.queue`, `PuzzleResult.puzzle`).
 * Raise SORTER_SET_VERSION whenever a rule here changes, so stored runs restart at puzzle 1 (brief 6).
 */
import { PUZZLES_PER_LEVEL, type AgeBand } from '../../shared/progress';
import { rng, shuffle } from '../../shared/rng';
import {
  FAMILIES,
  SHAPE_LEVEL_COLOR,
  SORTER_COLORS,
  SQUARE_FAMILY,
  type ShapeId,
  type SorterColor,
} from './shapes';
import type { Chapter } from '../meta';
import { LEVEL_STAR_RULES, STUCK } from '../run';
import { colorsFit } from '../kit/colorPairs';

export const SORTER_TITLE = 'Shape Sorter';
export const SORTER_SET_VERSION = 1;
/** Sorter content is fixed: the run seed is always 0 (brief 6). */
export const SORTER_SEED = 0;

/* ---------- Stuck and stars (brief 3.2, 3.3) ---------- */

/** Stuck limits for Shape Sorter: the `STUCK.sorter` row of src/games/run.ts, the one table (3.3). Count is slips; seconds is time with no right placement. */
export const SORTER_STUCK = STUCK.sorter;

/** The star rule on slips (3.2): 3 stars at 1 slip or none, 2 stars at 4 or fewer. No hint, no clock. It is `LEVEL_STAR_RULES.sorter` of run.ts. */
export const SORTER_STAR_RULE = LEVEL_STAR_RULES.sorter;

/* ---------- Types ---------- */

export interface SorterPiece {
  /** `<color>-<shape>`, unique inside a puzzle. A piece and its hole share the id. */
  id: string;
  shape: ShapeId;
  color: SorterColor;
}

export interface SorterPuzzle {
  level: number;
  /** Puzzle number inside the level, 0 to 5. */
  n: number;
  /** True on the colour levels (4 to 9): a piece fits only the hole with its shape and its colour. */
  colorMatters: boolean;
  /** The tray, in order (4 to a row on a phone). */
  pieces: SorterPiece[];
  /** The holes, in reading order (3 columns). Each is the piece that fits it. */
  holes: SorterPiece[];
}

export const pieceOf = (shape: ShapeId, color: SorterColor): SorterPiece => ({ id: `${color}-${shape}`, shape, color });

/* ---------- The level table ---------- */

export type LevelKind =
  /** Every shape in every colour: shapes x colors. */
  | 'grid'
  /** 3 shapes in 2 of 3 colours each, every colour on 2 shapes (Level 5). */
  | 'cycle'
  /** 3 shapes x 3 colours with one piece left out. */
  | 'leftout'
  /** Two square-family shapes, pentagon and hexagon, in 2 colours. */
  | 'lookalike';

export interface SorterLevel {
  kind: LevelKind;
  /** Different shapes on the board. */
  shapes: number;
  /** Different colours on the board; 1 means yellow on the shape levels. */
  colors: number;
  /** Pieces, holes and tray places. 8 at most (4.2). */
  pieces: number;
  colorMatters: boolean;
}

export const LEVELS: readonly SorterLevel[] = [
  { kind: 'grid', shapes: 2, colors: 1, pieces: 2, colorMatters: false },
  { kind: 'grid', shapes: 3, colors: 1, pieces: 3, colorMatters: false },
  { kind: 'grid', shapes: 5, colors: 1, pieces: 5, colorMatters: false },
  { kind: 'grid', shapes: 2, colors: 2, pieces: 4, colorMatters: true },
  { kind: 'cycle', shapes: 3, colors: 3, pieces: 6, colorMatters: true },
  { kind: 'grid', shapes: 2, colors: 3, pieces: 6, colorMatters: true },
  { kind: 'grid', shapes: 4, colors: 2, pieces: 8, colorMatters: true },
  { kind: 'leftout', shapes: 3, colors: 3, pieces: 8, colorMatters: true },
  { kind: 'lookalike', shapes: 4, colors: 2, pieces: 8, colorMatters: true },
];

export const LEVEL_COUNT = LEVELS.length;
export const MAX_PIECES = 8;

/** Chapters match the stickers (3.4): titles and picker notes from 4.2. */
export const SORTER_CHAPTERS: readonly Chapter[] = [
  { title: 'Shapes', note: 'one color', start: 0, count: 3 },
  { title: 'Shape and color', note: 'both must match', start: 3, count: 3 },
  { title: 'Big boards', note: 'eight pieces', start: 6, count: 3 },
];

/* ---------- Candidates ---------- */

function combos<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of combos(items.slice(i + 1), k - 1)) out.push([item, ...rest]);
  });
  return out;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  items.forEach((item, i) => {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) out.push([item, ...rest]);
  });
  return out;
}

/** Every set of k shapes with at most one shape per family (Levels 1 to 8). */
function shapeSets(k: number): ShapeId[][] {
  const out: ShapeId[][] = [];
  for (const fams of combos(FAMILIES, k)) {
    let sets: ShapeId[][] = [[]];
    for (const fam of fams) sets = sets.flatMap((s) => fam.map((shape) => [...s, shape]));
    out.push(...sets);
  }
  return out;
}

/** Every set of c colours with no pair on the avoid list (9.4); one colour means yellow. */
function colorSets(c: number): SorterColor[][] {
  if (c === 1) return [[SHAPE_LEVEL_COLOR]];
  return combos(SORTER_COLORS, c).filter(colorsFit);
}

const byId = (a: SorterPiece, b: SorterPiece) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const key = (ps: readonly SorterPiece[]) => ps.map((p) => p.id).sort().join('|');

function candidates(level: number): SorterPiece[][] {
  const def = LEVELS[level];
  const out: SorterPiece[][] = [];
  switch (def.kind) {
    case 'grid':
      for (const shapes of shapeSets(def.shapes))
        for (const colors of colorSets(def.colors)) out.push(shapes.flatMap((s) => colors.map((c) => pieceOf(s, c))));
      break;
    case 'cycle':
      // Each shape misses one colour and every colour is missed once: a shape-to-colour matching of the 3 x 3 grid.
      for (const shapes of shapeSets(3))
        for (const colors of colorSets(3))
          for (const missing of permutations([0, 1, 2]))
            out.push(shapes.flatMap((s, i) => colors.filter((_, j) => j !== missing[i]).map((c) => pieceOf(s, c))));
      break;
    case 'leftout':
      for (const shapes of shapeSets(3))
        for (const colors of colorSets(3))
          for (let skip = 0; skip < 9; skip++) {
            const all = shapes.flatMap((s) => colors.map((c) => pieceOf(s, c)));
            out.push(all.filter((_, i) => i !== skip));
          }
      break;
    case 'lookalike':
      for (const pair of combos(SQUARE_FAMILY, 2))
        for (const colors of colorSets(2))
          out.push([...pair, 'pentagon' as const, 'hexagon' as const].flatMap((s) => colors.map((c) => pieceOf(s, c))));
      break;
  }
  return out.map((ps) => ps.slice().sort(byId));
}

/** Puzzle 1 of Levels 1 to 5 is the board's set (4.2); Level 5 has its green pieces made yellow (9.4). */
const BOARD_SETS: readonly (readonly SorterPiece[])[] = [
  [pieceOf('circle', 'yellow'), pieceOf('square', 'yellow')],
  [pieceOf('circle', 'yellow'), pieceOf('square', 'yellow'), pieceOf('triangle', 'yellow')],
  [
    pieceOf('circle', 'yellow'),
    pieceOf('square', 'yellow'),
    pieceOf('triangle', 'yellow'),
    pieceOf('star', 'yellow'),
    pieceOf('hexagon', 'yellow'),
  ],
  [pieceOf('circle', 'red'), pieceOf('circle', 'blue'), pieceOf('square', 'red'), pieceOf('square', 'blue')],
  [
    pieceOf('circle', 'red'),
    pieceOf('circle', 'blue'),
    pieceOf('triangle', 'yellow'),
    pieceOf('triangle', 'red'),
    pieceOf('star', 'blue'),
    pieceOf('star', 'yellow'),
  ],
];

/** The six piece sets of a level: puzzle 1 pinned where the board has one, the rest as unlike each other as the pool allows. */
function pieceSets(level: number): SorterPiece[][] {
  const pool = shuffle(candidates(level), rng(7001 + level));
  const chosen: SorterPiece[][] = [];
  const board = BOARD_SETS[level];
  if (board) {
    const pinned = board.slice().sort(byId);
    chosen.push(pinned);
    const at = pool.findIndex((c) => key(c) === key(pinned));
    if (at >= 0) pool.splice(at, 1);
  } else {
    chosen.push(pool.shift() as SorterPiece[]);
  }
  while (chosen.length < PUZZLES_PER_LEVEL) {
    // Greedy: take the candidate that shares the fewest pieces with any board already chosen (ties: earliest in the seeded order).
    let best = 0;
    let bestScore = Infinity;
    pool.forEach((cand, i) => {
      const ids = new Set(cand.map((p) => p.id));
      const score = Math.max(...chosen.map((c) => c.filter((p) => ids.has(p.id)).length));
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    chosen.push(pool.splice(best, 1)[0]);
  }
  return chosen;
}

/* ---------- Layout ---------- */

/**
 * Tray order and hole order for one board. No piece starts over its own hole: tray place i and hole i never
 * belong together. Seeded by level and puzzle number only.
 */
function layout(level: number, n: number, ps: readonly SorterPiece[]): { pieces: SorterPiece[]; holes: SorterPiece[] } {
  const rand = rng(31000 + level * 100 + n);
  const pieces = shuffle(ps.slice(), rand);
  let holes = shuffle(ps.slice(), rand);
  for (let tries = 0; tries < 64 && holes.some((h, i) => h.id === pieces[i].id); tries++) holes = shuffle(ps.slice(), rand);
  if (holes.some((h, i) => h.id === pieces[i].id)) holes = pieces.map((_, i) => pieces[(i + 1) % pieces.length]);
  return { pieces, holes };
}

const cache = new Map<number, SorterPuzzle[]>();

function levelPuzzles(level: number): SorterPuzzle[] {
  const hit = cache.get(level);
  if (hit) return hit;
  const def = LEVELS[level];
  const made = pieceSets(level).map((ps, n) => ({ level, n, colorMatters: def.colorMatters, ...layout(level, n, ps) }));
  cache.set(level, made);
  return made;
}

/**
 * Board `n` (0 to 5) of `level` (0 to 8). A pure function of the level and the puzzle number: the run seed is
 * always 0 and the age band changes only the stuck limits (4.2), so `ctx` is accepted for the kit's signature and
 * never read. Throws a RangeError for a level or puzzle number out of range. Returns a copy each time.
 */
export function puzzle(level: number, n: number, _ctx?: { seed: number; band: AgeBand }): SorterPuzzle {
  if (!Number.isInteger(level) || level < 0 || level >= LEVEL_COUNT) throw new RangeError(`Shape Sorter has no level ${level}`);
  if (!Number.isInteger(n) || n < 0 || n >= PUZZLES_PER_LEVEL) throw new RangeError(`A level has no puzzle ${n}`);
  const p = levelPuzzles(level)[n];
  return { ...p, pieces: p.pieces.map((x) => ({ ...x })), holes: p.holes.map((x) => ({ ...x })) };
}

/** The six boards of a level, in puzzle order. */
export function makePuzzles(level: number): SorterPuzzle[] {
  return Array.from({ length: PUZZLES_PER_LEVEL }, (_, n) => puzzle(level, n));
}

/* ---------- Rules ---------- */

/** What a piece dropped on a hole has in common with it. */
export type Match = 'right' | 'same-shape' | 'same-color' | 'neither';

export function compare(piece: SorterPiece, hole: SorterPiece): Match {
  const shape = piece.shape === hole.shape;
  const color = piece.color === hole.color;
  if (shape && color) return 'right';
  if (shape) return 'same-shape';
  if (color) return 'same-color';
  return 'neither';
}

/**
 * Does the piece fit the hole? On shape levels the shape alone decides (every piece is yellow); on colour levels
 * the shape and the colour must both match.
 */
export function fits(piece: SorterPiece, hole: SorterPiece, colorMatters: boolean): boolean {
  return colorMatters ? compare(piece, hole) === 'right' : piece.shape === hole.shape;
}

/** The key for `slip(key)` (3.1): the same wrong piece on the same wrong hole counts once for stars. */
export const slipKey = (pieceId: string, holeId: string): string => `${pieceId}>${holeId}`;

/** The name a child hears and a screen reader reads: "circle" on shape levels, "red circle" on colour levels. */
export const pieceName = (p: SorterPiece, colorMatters: boolean): string => (colorMatters ? `${p.color} ${p.shape}` : p.shape);

export function chapterOf(level: number): Chapter {
  const c = SORTER_CHAPTERS.find((ch) => level >= ch.start && level < ch.start + ch.count);
  if (!c) throw new RangeError(`Shape Sorter has no level ${level}`);
  return c;
}
