/**
 * Brick Drop starter stacks (brief 4.2, decision 1): every puzzle starts on a few pre-built rows with
 * brick-shaped holes. Pure and seeded (1000 x stage number + puzzle), so a puzzle always shows the
 * same stack and the same brick order, and nothing needs storing.
 *
 * Stack coordinates: x is the column, y is the stack row counted from the top of the stack (0), so
 * the bottom stack row is `rows - 1`. y = -1 is the board row just above the stack.
 */
import { rng } from '../../shared/rng';
import { emptyBoard, newGame, type Board } from './engine';
import { shapeOf, type BrickColor, type Cell, type PieceId } from './pieces';
import { STAGES, newPieces } from './stages';

/** Pre-built rows: 2 on Stages 1 to 3, 3 from Stage 4. */
export function starterRows(index: number): number {
  return index < 3 ? 2 : 3;
}

/** Holes cut into those rows: 2 on Stages 1 to 3, 3 from Stage 4. */
export function starterHoles(index: number): number {
  return index < 3 ? 2 : 3;
}

/**
 * Cells cut from every stack of a stage. It is the same for all six puzzles of a stage (brief 4.2),
 * so their 3-star and 2-star brick counts are equal. Each value is one the stage's bricks can make
 * under the hole rules below; the starters test checks all 72 stacks.
 */
export const STARTER_CUT: readonly number[] = [4, 5, 6, 10, 11, 12, 11, 11, 11, 13, 13, 13];

/** Stack cells take the brick palette by column (brief 4.2). */
export const STACK_COLORS: readonly BrickColor[] = ['teal', 'blue', 'orange', 'yellow', 'pink', 'green', 'purple', 'red'];

/** One brick-shaped hole: the brick, its turn, and the cells it fills once it drops in (stack coordinates). */
export interface Hole {
  piece: PieceId;
  rot: number;
  cells: Cell[];
}

export interface Starter {
  /** 0-based stage index and puzzle number (0 to 5). */
  stage: number;
  puzzle: number;
  seed: number;
  /** Stack rows at the bottom of the board. */
  rows: number;
  holes: Hole[];
  /** Cells cut (holes inside the stack). */
  cut: number;
  /** Cells of the stack that start filled (K in the star rule). */
  filled: number;
  /** The whole starting board: empty rows above, the stack at the bottom. */
  board: Board;
  /** Seed of this puzzle's fixed brick order (the engine's 7-bag randomizer). */
  bagSeed: number;
}

/** The bricks a stage's holes must include: the ones it adds, or (Stages 8 and 9, which add none) the last ones added. */
export function holeBricks(index: number): PieceId[] {
  for (let i = index; i >= 0; i--) {
    const added = newPieces(i);
    if (added.length) return added;
  }
  return STAGES[index]?.pieces.slice() ?? [];
}

/** The seed of a puzzle (brief 4.2): 1000 x stage number + puzzle number. */
export const starterSeed = (index: number, puzzle: number) => 1000 * (index + 1) + puzzle;

interface Shape {
  piece: PieceId;
  rot: number;
  /** Cells relative to the shape's left edge and the stack top. */
  cells: Cell[];
  w: number;
  /** Cells inside the stack. */
  cut: number;
  /** Lowest stack row it reaches. */
  bottom: number;
}

const key = (cells: readonly Cell[]) =>
  cells
    .map(([x, y]) => `${x},${y}`)
    .sort()
    .join(' ');

/**
 * A brick can drop straight in when, in every column it uses, its cells inside the stack run without a
 * gap from the stack top down. That is the brief's rule: each stack cell above a hole cell belongs to
 * the same hole.
 */
function dropsStraightIn(cells: readonly Cell[]): boolean {
  const byCol = new Map<number, number[]>();
  for (const [x, y] of cells) byCol.set(x, [...(byCol.get(x) ?? []), y]);
  for (const ys of byCol.values()) {
    const inside = ys.filter((y) => y >= 0).sort((a, b) => a - b);
    const air = ys.filter((y) => y < 0).sort((a, b) => a - b);
    if (inside.some((y, i) => y !== i)) return false;
    // cells above the stack sit straight on top of the column's hole cells (or on the stack)
    if (air.some((y, i) => y !== -air.length + i)) return false;
  }
  return true;
}

/**
 * Every shape a stage's holes can take. A brick fits flat when one of its turns drops straight into the
 * stack. Zig and Zag have no such turn (every turn has an overhang), so they take a step instead: the
 * brick standing upright, one row higher, so it fills a two-deep step and sticks out one cell above the
 * stack, the way they "sit on bumpy steps".
 */
function shapesFor(index: number): Shape[] {
  const rows = starterRows(index);
  const out: Shape[] = [];
  for (const piece of STAGES[index].pieces) {
    const flat: Shape[] = [];
    const step: Shape[] = [];
    const seen = new Set<string>();
    for (let rot = 0; rot < 4; rot++) {
      const raw = shapeOf(piece, rot);
      const minX = Math.min(...raw.map((c) => c[0]));
      const minY = Math.min(...raw.map((c) => c[1]));
      const cells: Cell[] = raw.map(([x, y]) => [x - minX, y - minY] as const);
      const k = key(cells);
      if (seen.has(k)) continue;
      seen.add(k);
      const w = Math.max(...cells.map((c) => c[0])) + 1;
      const h = Math.max(...cells.map((c) => c[1])) + 1;
      if (h <= rows && dropsStraightIn(cells)) flat.push({ piece, rot, cells, w, cut: cells.length, bottom: h - 1 });
      const lifted: Cell[] = cells.map(([x, y]) => [x, y - 1] as const);
      const air = lifted.filter(([, y]) => y < 0).length;
      if (air === 1 && h - 1 <= rows && dropsStraightIn(lifted)) step.push({ piece, rot, cells: lifted, w, cut: cells.length - 1, bottom: h - 2 });
    }
    out.push(...(flat.length ? flat : step));
  }
  return out;
}

const sideTouch = (a: readonly Cell[], b: readonly Cell[]) =>
  a.some(([ax, ay]) => b.some(([bx, by]) => Math.abs(ax - bx) + Math.abs(ay - by) <= 1));

/** Every multiset of `n` shapes whose cut cells add up to `cut`, with at least one required brick. */
function combos(shapes: readonly Shape[], n: number, cut: number, required: readonly PieceId[]): Shape[][] {
  const out: Shape[][] = [];
  const walk = (from: number, picked: Shape[], sum: number) => {
    if (picked.length === n) {
      if (sum === cut && picked.some((s) => required.includes(s.piece))) out.push(picked);
      return;
    }
    for (let i = from; i < shapes.length; i++) if (sum + shapes[i].cut <= cut) walk(i, [...picked, shapes[i]], sum + shapes[i].cut);
  };
  walk(0, [], 0);
  return out;
}

const plans = new Map<number, Starter[]>();

function build(index: number): Starter[] {
  const stage = STAGES[index];
  const rows = starterRows(index);
  const n = starterHoles(index);
  const cut = STARTER_CUT[index];
  const required = holeBricks(index);
  // only combinations that reach the bottom stack row can leave every row open
  const all = combos(shapesFor(index), n, cut, required).filter((c) => c.some((s) => s.bottom === rows - 1));
  const made: Starter[] = [];
  const used = new Set<string>();
  const orders = new Set<string>();
  // the bricks a puzzle opens with (the one in play and the Next queue), so each puzzle's order differs
  const opening = (bagSeed: number) => {
    const g = newGame(stage, bagSeed);
    return [g.active?.id, ...g.queue].join(' ');
  };

  for (let puzzle = 0; puzzle < 6; puzzle++) {
    const seed = starterSeed(index, puzzle);
    const rand = rng(seed);
    let holes: Hole[] | null = null;
    for (let attempt = 0; attempt < 4000 && !holes && all.length; attempt++) {
      const combo = all[Math.floor(rand() * all.length)];
      // the stage's own brick first, then the rest, each at a random column
      const order = [...combo].sort((a, b) => Number(required.includes(b.piece)) - Number(required.includes(a.piece)));
      const placed: Hole[] = [];
      for (const s of order) {
        const x0 = Math.floor(rand() * (stage.cols - s.w + 1));
        const cells: Cell[] = s.cells.map(([x, y]) => [x + x0, y] as const);
        if (placed.some((h) => sideTouch(h.cells, cells))) break;
        placed.push({ piece: s.piece, rot: s.rot, cells });
      }
      if (placed.length !== n) continue;
      const hit = new Set(placed.flatMap((h) => h.cells.filter(([, y]) => y >= 0).map(([, y]) => y)));
      if (hit.size !== rows) continue; // a row with no hole would start complete
      const k = key(placed.flatMap((h) => h.cells));
      if (used.has(k)) continue; // the six stacks of a stage differ
      used.add(k);
      holes = placed;
    }
    if (!holes) throw new Error(`Brick Drop: no starter stack for stage ${index + 1}, puzzle ${puzzle + 1}`);

    const board = emptyBoard(stage.cols, stage.rows);
    const top = stage.rows - rows;
    const open = new Set(holes.flatMap((h) => h.cells.map(([x, y]) => `${x},${y}`)));
    let filled = 0;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < stage.cols; x++)
        if (!open.has(`${x},${y}`)) {
          board[top + y][x] = STACK_COLORS[x % STACK_COLORS.length];
          filled++;
        }
    let bagSeed = Math.floor(rand() * 4294967296) >>> 0;
    for (let tries = 0; orders.has(opening(bagSeed)) && tries < 100; tries++) bagSeed = Math.floor(rand() * 4294967296) >>> 0;
    orders.add(opening(bagSeed));
    made.push({
      stage: index,
      puzzle,
      seed,
      rows,
      holes,
      cut: rows * stage.cols - filled,
      filled,
      board,
      bagSeed,
    });
  }
  return made;
}

/** The starter stack of one puzzle (stage index 0 to 11, puzzle 0 to 5). Built once per stage. */
export function starterFor(index: number, puzzle: number): Starter {
  if (!Number.isInteger(index) || index < 0 || index >= STAGES.length) throw new RangeError(`Brick Drop has no stage ${index + 1}`);
  let list = plans.get(index);
  if (!list) {
    list = build(index);
    plans.set(index, list);
  }
  const p = Number.isInteger(puzzle) ? Math.min(5, Math.max(0, puzzle)) : 0;
  return list[p];
}

/** A fresh copy of a starter's board, so the engine never shares rows with the cached plan. */
export function starterBoard(s: Starter): Board {
  return s.board.map((row) => row.slice());
}
