/** Brick Drop piece catalogue. Shapes are listed in their spawn orientation inside a square
 * rotation box of side `box`; rotation turns the whole box, so pieces spin in place. */

export type BrickColor =
  | 'red'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'orange'
  | 'pink'
  | 'teal'
  | 'white'
  | 'black';

export type PieceId =
  | 'dot'
  | 'pair'
  | 'stick3'
  | 'corner'
  | 'long'
  | 'square'
  | 'tee'
  | 'zig'
  | 'zag'
  | 'hook'
  | 'boot'
  | 'flag'
  | 'cup'
  | 'bigboot';

export type Cell = readonly [x: number, y: number];

export interface PieceDef {
  id: PieceId;
  /** Kid-facing name shown when a brick is introduced. */
  name: string;
  color: BrickColor;
  box: number;
  cells: readonly Cell[];
}

export const PIECES: Record<PieceId, PieceDef> = {
  // 1-3 cells: the starter set
  dot: { id: 'dot', name: 'Dot', color: 'pink', box: 1, cells: [[0, 0]] },
  pair: { id: 'pair', name: 'Pair', color: 'teal', box: 2, cells: [[0, 0], [1, 0]] },
  stick3: { id: 'stick3', name: 'Short Stick', color: 'orange', box: 3, cells: [[0, 1], [1, 1], [2, 1]] },
  corner: { id: 'corner', name: 'Corner', color: 'green', box: 2, cells: [[0, 0], [0, 1], [1, 1]] },
  // 4 cells
  long: { id: 'long', name: 'Long Stick', color: 'red', box: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  square: { id: 'square', name: 'Square', color: 'blue', box: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  tee: { id: 'tee', name: 'Tee', color: 'yellow', box: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  zig: { id: 'zig', name: 'Zig', color: 'purple', box: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  zag: { id: 'zag', name: 'Zag', color: 'teal', box: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  hook: { id: 'hook', name: 'Hook', color: 'pink', box: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  boot: { id: 'boot', name: 'Boot', color: 'green', box: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  // 5 cells: only the friendly, compact ones
  flag: { id: 'flag', name: 'Flag', color: 'orange', box: 3, cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]] },
  cup: { id: 'cup', name: 'Cup', color: 'white', box: 3, cells: [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]] },
  bigboot: { id: 'bigboot', name: 'Big Boot', color: 'black', box: 4, cells: [[3, 0], [0, 1], [1, 1], [2, 1], [3, 1]] },
};

export const PIECE_IDS = Object.keys(PIECES) as PieceId[];

const rotCache = new Map<string, readonly Cell[]>();

/** Cells of a piece at rotation `rot` (0-3, clockwise), relative to its rotation box. */
export function shapeOf(id: PieceId, rot: number): readonly Cell[] {
  const r = ((rot % 4) + 4) % 4;
  const key = `${id}:${r}`;
  const hit = rotCache.get(key);
  if (hit) return hit;
  const { box, cells } = PIECES[id];
  let out: Cell[] = cells.map(([x, y]) => [x, y] as const);
  for (let i = 0; i < r; i++) out = out.map(([x, y]) => [box - 1 - y, x] as const);
  rotCache.set(key, out);
  return out;
}

/** Bounds of a shape, used for spawning and previews. */
export function boundsOf(cells: readonly Cell[]) {
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, w: Math.max(...xs) - minX + 1, h: Math.max(...ys) - minY + 1 };
}
