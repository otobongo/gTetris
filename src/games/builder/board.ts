/**
 * Picture Builder's board rules as pure functions (six-games brief 4.6): painting a square, the slip rule, the
 * match count and the solve. The Play screen only draws this state and passes what comes back to the kit:
 * `progress()` on a new right brick, `slip(key)` when a stroke ends with a slip, `solve()` on the last right
 * brick. No React and no DOM, so a simulated child can play a whole puzzle in Vitest.
 *
 * A stroke is pointer down to pointer up, or one key press (`paintOnce`). The rules:
 * - A brick that does not match its square is wrong, a colour on a square that must stay empty included.
 * - A stroke slips at most once, however many wrong bricks it lays. Erasing never slips.
 * - The same wrong colour on the same square again is no new slip. A stroke with a wrong brick this puzzle has
 *   not seen passes that brick's key, a new one for the kit. A stroke whose wrong bricks were all laid before
 *   passes a key the kit already has, so it still counts toward the stuck offer but adds no star slip (kit
 *   rule: a key seen before on this puzzle adds no star slip). Bricks are remembered even when a stroke with
 *   two new wrong bricks passes only the first, so repeating the second later is free too.
 * - Painting a square with the colour it already holds is skipped; the eraser on an empty square does nothing.
 * - The board is locked during a memory look and each Peek: nothing paints.
 * - The puzzle is solved the moment every square matches, so the last right brick solves at once.
 */
import type { Point } from '../kit/dragToTarget';
import type { BuilderColor } from './pictures';

/** What the child paints with: one of the 6 colours, or the eraser. */
export type Paint = BuilderColor | 'eraser';
export type Cell = BuilderColor | null;

/** The stroke in progress: its paint and the wrong bricks it has laid so far. */
export interface Stroke {
  paint: Paint;
  /** The first wrong brick of this stroke that the puzzle had not seen, as a slip key. */
  fresh: string | null;
  /** The first wrong brick of this stroke that the puzzle had already seen. */
  repeat: string | null;
}

export interface Board {
  /** The picture: the colour each square must hold, or null for one that stays empty. Row by row. */
  target: readonly Cell[];
  /** What the child has built, row by row. */
  cells: readonly Cell[];
  /** Wrong bricks already laid on this puzzle, as slip keys ("5:red"). */
  seen: readonly string[];
  /** The keys passed to the kit's `slip(key)` on this puzzle, in order. */
  given: readonly string[];
  stroke: Stroke | null;
  /** True during a memory look or a Peek. */
  locked: boolean;
  solved: boolean;
}

/** What one paint did to one square. */
export type PaintResult =
  /** Nothing changed: locked, solved, no stroke, out of range, the same colour again, or the eraser on an empty square. */
  | 'none'
  /** A brick was taken away. */
  | 'erased'
  /** A brick that matches its square, where the square did not match before: the kit's progress. */
  | 'right'
  /** A brick that does not match its square. */
  | 'wrong'
  /** Every square matches now: the last right brick, or the eraser taking away the last wrong one. */
  | 'solved';

export interface PaintStep {
  board: Board;
  result: PaintResult;
}

export interface StrokeEnd {
  board: Board;
  /** The key to pass to the kit's `slip(key)`, or null when the stroke laid no wrong brick. */
  slip: string | null;
}

/** The slip key of a wrong brick: the square's index and the colour laid there. */
export const slipKey = (index: number, color: BuilderColor): string => `${index}:${color}`;

/** A new, empty board for a picture. Pass `locked` for a memory puzzle, which starts with its first look. */
export function newBoard(target: readonly Cell[], locked = false): Board {
  return { target, cells: target.map(() => null), seen: [], given: [], stroke: null, locked, solved: false };
}

/** Lock or unlock the board (a memory look or a Peek starts or ends). Locking ends any stroke without a slip check. */
export function setLocked(board: Board, locked: boolean): Board {
  if (board.locked === locked) return board;
  return { ...board, locked, stroke: locked ? null : board.stroke };
}

/** True when the square holds what the picture asks for, an empty square that must stay empty included. */
export const squareMatches = (board: Board, index: number): boolean => board.cells[index] === board.target[index];

/** True when every square matches. */
export const isSolved = (board: Board): boolean => board.target.every((_, i) => squareMatches(board, i));

/** The match bar (copy levels): the picture's bricks that are in place, out of all its bricks. Empty squares never count. */
export function matchCount(board: Board): { right: number; total: number } {
  let right = 0;
  let total = 0;
  board.target.forEach((t, i) => {
    if (t === null) return;
    total++;
    if (board.cells[i] === t) right++;
  });
  return { right, total };
}

/** Bricks on the board that do not match their square: the copy levels' wrong line. */
export const wrongCount = (board: Board): number =>
  board.cells.reduce((n, c, i) => (c !== null && c !== board.target[i] ? n + 1 : n), 0);

/** Pointer down (or a key press starting): a stroke with this paint begins. Ignored while locked or solved. */
export function startStroke(board: Board, paint: Paint): Board {
  if (board.locked || board.solved) return board;
  return { ...board, stroke: { paint, fresh: null, repeat: null } };
}

/** Paint the square at `index` with the stroke's paint. */
export function paintSquare(board: Board, index: number): PaintStep {
  const stroke = board.stroke;
  const none: PaintStep = { board, result: 'none' };
  if (!stroke || board.locked || board.solved) return none;
  if (!Number.isInteger(index) || index < 0 || index >= board.target.length) return none;
  const next: Cell = stroke.paint === 'eraser' ? null : stroke.paint;
  if (board.cells[index] === next) return none;
  const wasRight = squareMatches(board, index);
  const cells = board.cells.slice();
  cells[index] = next;
  if (next === null) {
    // Taking away a wrong brick from a square that must stay empty can be the move that finishes the picture.
    const erased: Board = { ...board, cells };
    return isSolved(erased) ? { board: { ...erased, solved: true, stroke: null }, result: 'solved' } : { board: erased, result: 'erased' };
  }

  if (next !== board.target[index]) {
    const key = slipKey(index, next);
    const old = board.seen.includes(key);
    const marked: Stroke = old
      ? { ...stroke, repeat: stroke.repeat ?? key }
      : { ...stroke, fresh: stroke.fresh ?? key };
    return { board: { ...board, cells, stroke: marked, seen: old ? board.seen : [...board.seen, key] }, result: 'wrong' };
  }

  const painted: Board = { ...board, cells };
  if (isSolved(painted)) return { board: { ...painted, solved: true, stroke: null }, result: 'solved' };
  return { board: painted, result: wasRight ? 'none' : 'right' };
}

/** Pointer up, a lost pointer, or the end of a key press: the stroke ends with at most one slip. */
export function endStroke(board: Board): StrokeEnd {
  const stroke = board.stroke;
  if (!stroke) return { board, slip: null };
  const ended: Board = { ...board, stroke: null };
  if (stroke.fresh) return { board: { ...ended, given: [...board.given, stroke.fresh] }, slip: stroke.fresh };
  if (!stroke.repeat) return { board: ended, slip: null };
  // Only repeats: a key the kit already counted. One always exists, since the stroke that first laid a repeated
  // brick passed a new key of its own.
  const slip = board.given.includes(stroke.repeat) ? stroke.repeat : (board.given[0] ?? stroke.repeat);
  return { board: ended, slip };
}

/**
 * A lost pointer (pointercancel, or the capture lost before pointer up): the stroke ends and never counts, so no
 * slip goes to the kit. The bricks it laid stay on the board, as they are drawn there.
 */
export function cancelStroke(board: Board): Board {
  return board.stroke ? { ...board, stroke: null } : board;
}

/** One key press (Enter or Space on a square): a whole stroke on one square. */
export function paintOnce(board: Board, paint: Paint, index: number): PaintStep & { slip: string | null } {
  const step = paintSquare(startStroke(board, paint), index);
  const end = endStroke(step.board);
  return { board: end.board, result: step.result, slip: end.slip };
}

/** The square at row and column (both 0-based) on a board `size` squares wide. */
export const indexOf = (size: number, row: number, col: number): number => row * size + col;

/** Row and column (both 0-based) of a square. */
export const rowColOf = (size: number, index: number): { row: number; col: number } => ({
  row: Math.floor(index / size),
  col: index % size,
});

/**
 * Arrow-key movement on the board's one tab stop (9.2): the square an arrow moves to, staying put at an edge.
 * Home and End go to the row's first and last square.
 */
export function moveFocus(size: number, index: number, key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End'): number {
  const { row, col } = rowColOf(size, index);
  switch (key) {
    case 'ArrowUp':
      return indexOf(size, Math.max(0, row - 1), col);
    case 'ArrowDown':
      return indexOf(size, Math.min(size - 1, row + 1), col);
    case 'ArrowLeft':
      return indexOf(size, row, Math.max(0, col - 1));
    case 'ArrowRight':
      return indexOf(size, row, Math.min(size - 1, col + 1));
    case 'Home':
      return indexOf(size, row, 0);
    case 'End':
      return indexOf(size, row, size - 1);
  }
}

/* ---------- Where a pointer is on the board (7.8) ---------- */

/** The board's grid is 334 px wide at every grid size, with 6 px between squares. */
export const BOARD_PX = 334;
export const BOARD_GAP_PX = 6;

/** Row or column under one coordinate, or null in a gap or outside. */
function lineAt(v: number, size: number, width: number): number | null {
  const gap = (width * BOARD_GAP_PX) / BOARD_PX;
  const cell = (width - gap * (size - 1)) / size;
  if (!(v >= 0) || v >= width) return null;
  const k = Math.min(size - 1, Math.floor(v / (cell + gap)));
  return v - k * (cell + gap) < cell ? k : null;
}

/**
 * The square under a point in the board's grid, measured from the grid's top-left corner, or null when the point
 * sits in a gap or outside. `width` is the grid's width in the same units as the point (the kit's localPoint gives
 * both with the tablet zoom taken out), so the answer holds at any zoom. The grid is as tall as it is wide.
 */
export function squareAt(point: Point, size: number, width: number = BOARD_PX): number | null {
  if (!Number.isInteger(size) || size < 1 || !(width > 0)) return null;
  const col = lineAt(point.x, size, width);
  const row = lineAt(point.y, size, width);
  return col === null || row === null ? null : indexOf(size, row, col);
}

/**
 * The squares a pointer passes over moving from `from` to `to`, in order, leaving out the square under `from` (it
 * was painted when the pointer got there). A quick drag sends few move events, so the line between them is sampled
 * every quarter square and no square on the way is skipped.
 */
export function squaresAlong(from: Point, to: Point, size: number, width: number = BOARD_PX): number[] {
  if (!Number.isInteger(size) || size < 1 || !(width > 0)) return [];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const step = width / size / 4;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
  const start = squareAt(from, size, width);
  const out: number[] = [];
  for (let k = 1; k <= steps; k++) {
    const i = squareAt({ x: from.x + (dx * k) / steps, y: from.y + (dy * k) / steps }, size, width);
    if (i === null || i === (out.length ? out[out.length - 1] : start)) continue;
    out.push(i);
  }
  return out;
}
