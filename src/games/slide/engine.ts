/**
 * Brick Escape engine. Pure functions only: no React, no DOM.
 *
 * Board: rows x cols grid. Some cells may be void (not part of the tray), which lets levels have L shapes etc.
 * Blocks: polyomino bricks with a color and a top-left anchor (r, c). They slide one cell at a time and never overlap.
 * Gates: colored doors on the outer edge of the tray. A brick leaves through a gate of its own color when it
 *   touches the gate, its whole width fits inside the door, and nothing is in the way of sliding out.
 * Locks: an ice lock on a gate (or an ice-frozen brick) melts after N bricks have left the board.
 */

export type Color = 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'orange' | 'pink' | 'teal' | 'white' | 'black';
export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Cell = readonly [number, number]; // [row, col]

export interface BlockDef {
  id: number;
  color: Color;
  /** cells relative to anchor, normalized so min row and min col are 0 */
  cells: Cell[];
  r: number;
  c: number;
  /** brick is frozen in ice until this many bricks have exited */
  frozen?: number;
}

export interface GateDef {
  side: Side;
  /** first row (left/right gates) or first column (top/bottom gates) covered by the door */
  at: number;
  len: number;
  color: Color;
  /** door is iced shut until this many bricks have exited */
  lock?: number;
}

export interface Level {
  id: number;
  name?: string;
  rows: number;
  cols: number;
  /** void[r][c] === true means the cell is not part of the tray */
  void: boolean[][];
  blocks: BlockDef[];
  gates: GateDef[];
  /** fewest moves to solve, computed by the solver */
  par: number;
  /** optional teaching tip shown at the start */
  tip?: string;
}

/** Live game state. Block positions are stored separately so states are cheap to copy and hash. */
export interface State {
  /** anchor per block id; null once the block has exited */
  pos: (Cell | null)[];
  exited: number;
}

export const DIRS: Record<Side, Cell> = { top: [-1, 0], bottom: [1, 0], left: [0, -1], right: [0, 1] };
const DIR_LIST: Cell[] = Object.values(DIRS);

export function initialState(level: Level): State {
  return { pos: level.blocks.map((b) => [b.r, b.c] as Cell), exited: 0 };
}

export function isPlayable(level: Level, r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < level.rows && c < level.cols && !level.void[r][c];
}

/** Occupancy grid: -1 void, 0 empty, id+1 for a block. */
export function occupancy(level: Level, state: State): Int16Array {
  const g = new Int16Array(level.rows * level.cols);
  for (let r = 0; r < level.rows; r++) for (let c = 0; c < level.cols; c++) if (level.void[r][c]) g[r * level.cols + c] = -1;
  level.blocks.forEach((b, i) => {
    const p = state.pos[i];
    if (!p) return;
    for (const [dr, dc] of b.cells) g[(p[0] + dr) * level.cols + p[1] + dc] = i + 1;
  });
  return g;
}

export function canPlace(level: Level, occ: Int16Array, blockIdx: number, r: number, c: number): boolean {
  const b = level.blocks[blockIdx];
  for (const [dr, dc] of b.cells) {
    const rr = r + dr;
    const cc = c + dc;
    if (!isPlayable(level, rr, cc)) return false;
    const v = occ[rr * level.cols + cc];
    if (v !== 0 && v !== blockIdx + 1) return false;
  }
  return true;
}

export function isFrozen(level: Level, state: State, blockIdx: number): boolean {
  return (level.blocks[blockIdx].frozen ?? 0) > state.exited;
}

export function isLocked(gate: GateDef, state: State): boolean {
  return (gate.lock ?? 0) > state.exited;
}

/** The row/col of the tray edge a gate sits on (the outermost playable line on that side). Cached per level. */
const depthCache = new WeakMap<Level, WeakMap<GateDef, number>>();
export function gateDepth(level: Level, g: GateDef): number {
  let perLevel = depthCache.get(level);
  if (!perLevel) depthCache.set(level, (perLevel = new WeakMap()));
  const hit = perLevel.get(g);
  if (hit !== undefined) return hit;
  let d: number;
  if (g.side === 'left' || g.side === 'right') {
    const cols = [...Array(level.cols).keys()].filter((c) => isPlayable(level, g.at, c));
    d = g.side === 'left' ? Math.min(...cols) : Math.max(...cols);
  } else {
    const rows = [...Array(level.rows).keys()].filter((r) => isPlayable(level, r, g.at));
    d = g.side === 'top' ? Math.min(...rows) : Math.max(...rows);
  }
  perLevel.set(g, d);
  return d;
}

/** Cells of the tray the gate is attached to, [row, col]. */
export function gateCells(level: Level, g: GateDef): Cell[] {
  const d = gateDepth(level, g);
  return Array.from({ length: g.len }, (_, i) =>
    g.side === 'left' || g.side === 'right' ? ([g.at + i, d] as Cell) : ([d, g.at + i] as Cell),
  );
}

/**
 * Which gate (index) the block can leave through from anchor (r, c), or -1.
 * Rules: same color, gate not iced, every block cell lies within the door span, at least one cell touches the
 * door, and each cell has a clear straight path to the door line (only empty cells or its own cells).
 */
export function exitGate(level: Level, occ: Int16Array, state: State, blockIdx: number, r: number, c: number): number {
  const b = level.blocks[blockIdx];
  for (let gi = 0; gi < level.gates.length; gi++) {
    const g = level.gates[gi];
    if (g.color !== b.color || isLocked(g, state)) continue;
    const horizontal = g.side === 'left' || g.side === 'right';
    const depth = gateDepth(level, g);
    const [dr, dc] = DIRS[g.side];
    let touches = false;
    let ok = true;
    for (const [cr, cc] of b.cells) {
      const rr = r + cr;
      const col = c + cc;
      const across = horizontal ? rr : col;
      if (across < g.at || across >= g.at + g.len) {
        ok = false;
        break;
      }
      const along = horizontal ? col : rr;
      if (along === depth) touches = true;
      // walk toward the door line
      let wr = rr;
      let wc = col;
      while ((horizontal ? wc : wr) !== depth) {
        wr += dr;
        wc += dc;
        if (!isPlayable(level, wr, wc)) {
          ok = false;
          break;
        }
        const v = occ[wr * level.cols + wc];
        if (v !== 0 && v !== blockIdx + 1) {
          ok = false;
          break;
        }
      }
      if (!ok) break;
    }
    if (ok && touches) return gi;
  }
  return -1;
}

export interface Reach {
  /** reachable anchors (excluding start), keyed `${r},${c}` */
  spots: Map<string, Cell>;
  /** first exit found: anchor and gate index */
  exit: { at: Cell; gate: number } | null;
}

/**
 * Every anchor the block can slide to in one drag, holding other bricks still.
 * Positions where it could exit are terminal (in play it would leave the board there).
 */
export function reachable(level: Level, state: State, blockIdx: number, occ = occupancy(level, state)): Reach {
  const start = state.pos[blockIdx];
  const spots = new Map<string, Cell>();
  if (!start || isFrozen(level, state, blockIdx)) return { spots, exit: null };
  const W = level.cols + 2; // anchors can be at most one step outside; offset by 1 for numeric keys
  const seen = new Set<number>([(start[0] + 1) * W + start[1] + 1]);
  const queue: Cell[] = [start];
  let qi = 0;
  const startExit = exitGate(level, occ, state, blockIdx, start[0], start[1]);
  if (startExit >= 0) return { spots, exit: { at: start, gate: startExit } };
  while (qi < queue.length) {
    const [r, c] = queue[qi++];
    for (const [dr, dc] of DIR_LIST) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= level.rows || nc >= level.cols) continue;
      const k = (nr + 1) * W + nc + 1;
      if (seen.has(k)) continue;
      seen.add(k);
      if (!canPlace(level, occ, blockIdx, nr, nc)) continue;
      const gi = exitGate(level, occ, state, blockIdx, nr, nc);
      if (gi >= 0) return { spots, exit: { at: [nr, nc], gate: gi } };
      spots.set(`${nr},${nc}`, [nr, nc]);
      queue.push([nr, nc]);
    }
  }
  return { spots, exit: null };
}

export function withMove(state: State, blockIdx: number, to: Cell | null): State {
  const pos = state.pos.slice();
  pos[blockIdx] = to;
  return { pos, exited: to === null ? state.exited + 1 : state.exited };
}

export function isSolved(state: State): boolean {
  return state.pos.every((p) => p === null);
}

export function blockSize(b: BlockDef): { h: number; w: number } {
  return {
    h: Math.max(...b.cells.map((x) => x[0])) + 1,
    w: Math.max(...b.cells.map((x) => x[1])) + 1,
  };
}

/** Star rating: 3 at par, 2 within a small margin, else 1. Using a hint caps at 2. */
export function starsFor(moves: number, par: number, usedHint: boolean): number {
  const s = moves <= par ? 3 : moves <= par + Math.max(2, Math.ceil(par * 0.4)) ? 2 : 1;
  return usedHint ? Math.min(2, s) : s;
}

/* ---------- Authoring helpers ---------- */

export interface LevelSpec {
  name?: string;
  tip?: string;
  /** '#' = void, '.' = empty, any letter = a brick cell (same letter = same brick) */
  map: string[];
  colors: Record<string, Color>;
  gates: GateDef[];
  frozen?: Record<string, number>;
}

export function fromSpec(spec: LevelSpec, id: number, par = 0): Level {
  const rows = spec.map.length;
  const cols = Math.max(...spec.map.map((l) => l.length));
  const voidGrid = spec.map.map((line) => Array.from({ length: cols }, (_, c) => (line[c] ?? '#') === '#'));
  const cellsBy = new Map<string, Cell[]>();
  spec.map.forEach((line, r) =>
    [...line].forEach((ch, c) => {
      if (/[A-Za-z]/.test(ch)) cellsBy.set(ch, [...(cellsBy.get(ch) ?? []), [r, c]]);
    }),
  );
  const blocks: BlockDef[] = [...cellsBy.entries()].map(([ch, cells], i) => {
    const r0 = Math.min(...cells.map((x) => x[0]));
    const c0 = Math.min(...cells.map((x) => x[1]));
    const color = spec.colors[ch];
    if (!color) throw new Error(`No color for brick ${ch}`);
    return {
      id: i,
      color,
      r: r0,
      c: c0,
      cells: cells.map(([r, c]) => [r - r0, c - c0] as Cell),
      ...(spec.frozen?.[ch] ? { frozen: spec.frozen[ch] } : {}),
    };
  });
  return { id, name: spec.name, tip: spec.tip, rows, cols, void: voidGrid, blocks, gates: spec.gates, par };
}

/** Structural checks used by tests and the generator. Returns a list of problems (empty = valid). */
export function validate(level: Level): string[] {
  const errs: string[] = [];
  const s = initialState(level);
  const occ = new Int16Array(level.rows * level.cols);
  level.blocks.forEach((b, i) => {
    for (const [dr, dc] of b.cells) {
      const r = b.r + dr;
      const c = b.c + dc;
      if (!isPlayable(level, r, c)) errs.push(`brick ${i} off tray`);
      else if (occ[r * level.cols + c]) errs.push(`brick ${i} overlaps`);
      else occ[r * level.cols + c] = i + 1;
    }
  });
  level.gates.forEach((g, gi) => {
    const horizontal = g.side === 'left' || g.side === 'right';
    const span = horizontal ? level.rows : level.cols;
    if (g.at < 0 || g.at + g.len > span) {
      errs.push(`gate ${gi} out of range`);
      return;
    }
    const depths = Array.from({ length: g.len }, (_, i) => gateDepth(level, { ...g, at: g.at + i, len: 1 }));
    if (new Set(depths).size !== 1) errs.push(`gate ${gi} spans an uneven edge`);
  });
  // no two gates may share an edge cell on the same side
  const used = new Set<string>();
  level.gates.forEach((g, gi) =>
    gateCells(level, g).forEach(([r, c]) => {
      const k = `${g.side}:${r},${c}`;
      if (used.has(k)) errs.push(`gate ${gi} overlaps another gate`);
      used.add(k);
    }),
  );
  level.blocks.forEach((b, i) => {
    if (!level.gates.some((g) => g.color === b.color)) errs.push(`brick ${i} has no ${b.color} gate`);
  });
  if (errs.length === 0) {
    const full = occupancy(level, s);
    level.blocks.forEach((b, i) => {
      if (exitGate(level, full, s, i, b.r, b.c) >= 0) errs.push(`brick ${i} can exit without moving`);
    });
  }
  return errs;
}
