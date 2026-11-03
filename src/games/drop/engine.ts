/** Brick Drop game logic. Every function is pure: it takes a state and returns a new one
 * (or the same object when nothing happened), so the UI can drive it from any loop. */
import { rng, shuffle } from '../../shared/rng';
import { PIECES, boundsOf, shapeOf, type BrickColor, type Cell, type PieceId } from './pieces';

export type Board = (BrickColor | null)[][];

export interface Rules {
  cols: number;
  rows: number;
  pieces: PieceId[];
  goalRows: number;
  gravityMs: number;
  lockDelayMs: number;
}

export interface Active {
  id: PieceId;
  rot: number;
  x: number;
  y: number;
}

export type Status = 'playing' | 'clearing' | 'won' | 'over';
export type GameEvent = 'move' | 'rotate' | 'bump' | 'land' | 'lock' | 'drop' | 'hold' | 'clear' | 'win' | 'over';

export interface GameState {
  rules: Rules;
  board: Board;
  active: Active | null;
  /** Upcoming bricks, front first. Always holds at least PREVIEW + 1. */
  queue: PieceId[];
  bagSeed: number;
  hold: PieceId | null;
  /** Hold can be used once per brick. */
  holdUsed: boolean;
  status: Status;
  fallMs: number;
  lockMs: number;
  lockResets: number;
  /** Rows currently flashing before they are removed. */
  clearing: number[];
  clearMs: number;
  lines: number;
  /** Bricks locked so far. */
  placed: number;
  score: number;
  /** What happened in the call that produced this state (for sounds). */
  events: GameEvent[];
}

export const PREVIEW = 3;
export const CLEAR_MS = 340;
export const MAX_LOCK_RESETS = 15;
const LINE_POINTS = [0, 100, 300, 500, 800, 1200];

/** Simple wall kicks: try in place, then sideways, then up a little. */
export const KICKS: readonly Cell[] = [
  [0, 0], [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1], [-2, 0], [2, 0], [0, -2],
];

const NO_EVENTS: GameEvent[] = [];

export function emptyBoard(cols: number, rows: number): Board {
  return Array.from({ length: rows }, () => Array<BrickColor | null>(cols).fill(null));
}

/** True when the cells at offset (x, y) hit a wall, the floor or a settled brick. Space above the top is open. */
export function collides(board: Board, cells: readonly Cell[], x: number, y: number): boolean {
  const rows = board.length;
  const cols = board[0].length;
  for (const [cx, cy] of cells) {
    const bx = x + cx;
    const by = y + cy;
    if (bx < 0 || bx >= cols || by >= rows) return true;
    if (by >= 0 && board[by][bx] !== null) return true;
  }
  return false;
}

export function activeCells(a: Active): readonly Cell[] {
  return shapeOf(a.id, a.rot);
}

function hits(board: Board, a: Active): boolean {
  return collides(board, activeCells(a), a.x, a.y);
}

export function fullRows(board: Board): number[] {
  const out: number[] = [];
  board.forEach((row, y) => {
    if (row.every((c) => c !== null)) out.push(y);
  });
  return out;
}

/** Remove the given rows and let everything above fall down. */
export function removeRows(board: Board, rows: number[]): Board {
  if (rows.length === 0) return board;
  const drop = new Set(rows);
  const kept = board.filter((_, y) => !drop.has(y));
  const cols = board[0].length;
  return [...emptyBoard(cols, rows.length), ...kept];
}

/** Row the active brick would land on if dropped now. */
export function ghostY(board: Board, a: Active): number {
  let y = a.y;
  while (!collides(board, activeCells(a), a.x, y + 1)) y++;
  return y;
}

/** 7-bag style randomizer: every kind appears equally often in each bag; tiny sets repeat so a bag has >= 6. */
function refill(queue: PieceId[], seed: number, kinds: PieceId[]): { queue: PieceId[]; seed: number } {
  let q = queue;
  let s = seed;
  const reps = Math.max(1, Math.ceil(6 / kinds.length));
  const bag = Array.from({ length: reps }, () => kinds).flat();
  while (q.length < PREVIEW + 2) {
    const rand = rng(s);
    q = [...q, ...shuffle(bag, rand)];
    s = Math.floor(rand() * 4294967296) >>> 0;
  }
  return { queue: q, seed: s };
}

export function spawnPosition(id: PieceId, cols: number): Active {
  const b = boundsOf(shapeOf(id, 0));
  return { id, rot: 0, x: Math.floor((cols - b.w) / 2) - b.minX, y: -b.minY };
}

/** Put `id` in play. If it does not fit the stack has reached the top. */
function spawn(s: GameState, id: PieceId, events: GameEvent[]): GameState {
  const active = spawnPosition(id, s.rules.cols);
  const blocked = hits(s.board, active);
  return {
    ...s,
    active,
    status: blocked ? 'over' : 'playing',
    fallMs: 0,
    lockMs: 0,
    lockResets: 0,
    events: blocked ? [...events, 'over'] : events,
  };
}

function spawnNext(s: GameState, events: GameEvent[]): GameState {
  const [id, ...rest] = s.queue;
  const r = refill(rest, s.bagSeed, s.rules.pieces);
  return spawn({ ...s, queue: r.queue, bagSeed: r.seed }, id, events);
}

export function newGame(rules: Rules, seed: number): GameState {
  const r = refill([], seed >>> 0, rules.pieces);
  const base: GameState = {
    rules,
    board: emptyBoard(rules.cols, rules.rows),
    active: null,
    queue: r.queue,
    bagSeed: r.seed,
    hold: null,
    holdUsed: false,
    status: 'playing',
    fallMs: 0,
    lockMs: 0,
    lockResets: 0,
    clearing: [],
    clearMs: 0,
    lines: 0,
    placed: 0,
    score: 0,
    events: NO_EVENTS,
  };
  return spawnNext(base, NO_EVENTS);
}

/** Build a game from a hand-made board (used by tests and handy for tutorials). */
export function withBoard(s: GameState, board: Board, active?: Active): GameState {
  return { ...s, board, active: active ?? s.active, events: NO_EVENTS };
}

function isResting(s: GameState, a: Active): boolean {
  return collides(s.board, activeCells(a), a.x, a.y + 1);
}

/** After a successful sideways move or turn on the ground, give the kid a fresh lock timer (a limited number of times). */
function afterShift(s: GameState, a: Active, event: GameEvent): GameState {
  let { lockMs, lockResets } = s;
  if (lockMs > 0 && lockResets < MAX_LOCK_RESETS) {
    lockMs = 0;
    lockResets++;
  }
  return { ...s, active: a, lockMs, lockResets, events: [event] };
}

export function move(s: GameState, dx: number): GameState {
  if (s.status !== 'playing' || !s.active) return s;
  const a = { ...s.active, x: s.active.x + dx };
  if (hits(s.board, a)) return { ...s, events: ['bump'] };
  return afterShift(s, a, 'move');
}

export function rotate(s: GameState, dir: 1 | -1 = 1): GameState {
  if (s.status !== 'playing' || !s.active) return s;
  const rot = (s.active.rot + dir + 4) % 4;
  for (const [kx, ky] of KICKS) {
    const a = { ...s.active, rot, x: s.active.x + kx, y: s.active.y + ky };
    if (!hits(s.board, a)) return afterShift(s, a, 'rotate');
  }
  return { ...s, events: ['bump'] };
}

/** One row down, a point per row. On the ground it does nothing (lock delay still applies). */
export function softDrop(s: GameState): GameState {
  if (s.status !== 'playing' || !s.active) return s;
  const a = { ...s.active, y: s.active.y + 1 };
  if (hits(s.board, a)) return s;
  return { ...s, active: a, fallMs: 0, lockMs: 0, score: s.score + 1, events: isResting(s, a) ? ['land'] : NO_EVENTS };
}

export function hardDrop(s: GameState): GameState {
  if (s.status !== 'playing' || !s.active) return s;
  const y = ghostY(s.board, s.active);
  const dropped = { ...s, active: { ...s.active, y }, score: s.score + 2 * (y - s.active.y) };
  return lock(dropped, ['drop']);
}

export function hold(s: GameState): GameState {
  if (s.status !== 'playing' || !s.active || s.holdUsed) return s;
  const current = s.active.id;
  if (s.hold === null) return spawnNext({ ...s, hold: current, holdUsed: true }, ['hold']);
  return spawn({ ...s, hold: current, holdUsed: true }, s.hold, ['hold']);
}

/** Settle the active brick into the board, then clear rows or bring in the next one. */
export function lock(s: GameState, events: GameEvent[] = []): GameState {
  if (!s.active) return s;
  const { id } = s.active;
  const color = PIECES[id].color;
  const board = s.board.map((row) => row.slice());
  let toppedOut = false;
  for (const [cx, cy] of activeCells(s.active)) {
    const bx = s.active.x + cx;
    const by = s.active.y + cy;
    if (by < 0) toppedOut = true;
    else board[by][bx] = color;
  }
  const placed: GameState = { ...s, board, placed: s.placed + 1, holdUsed: false, fallMs: 0, lockMs: 0 };
  if (toppedOut) return { ...placed, status: 'over', events: [...events, 'lock', 'over'] };

  const rows = fullRows(board);
  if (rows.length > 0) {
    return {
      ...placed,
      active: null,
      status: 'clearing',
      clearing: rows,
      clearMs: CLEAR_MS,
      lines: s.lines + rows.length,
      score: s.score + LINE_POINTS[Math.min(rows.length, LINE_POINTS.length - 1)],
      events: [...events, 'lock', 'clear'],
    };
  }
  return spawnNext({ ...placed, active: null }, [...events, 'lock']);
}

/** Advance time: gravity, lock delay and the line-clear flash. */
export function step(s: GameState, dt: number): GameState {
  if (s.status === 'clearing') {
    const clearMs = s.clearMs - dt;
    if (clearMs > 0) return { ...s, clearMs, events: NO_EVENTS };
    const cleared: GameState = { ...s, board: removeRows(s.board, s.clearing), clearing: [], clearMs: 0 };
    if (cleared.lines >= s.rules.goalRows) return { ...cleared, status: 'won', events: ['win'] };
    return spawnNext(cleared, NO_EVENTS);
  }
  if (s.status !== 'playing' || !s.active) return s;

  const { gravityMs, lockDelayMs } = s.rules;
  let a = s.active;
  let fallMs = s.fallMs + dt;
  let { lockMs, lockResets } = s;
  let resting = isResting(s, a);
  let landed = false;
  while (!resting && fallMs >= gravityMs) {
    a = { ...a, y: a.y + 1 };
    fallMs -= gravityMs;
    lockMs = 0;
    lockResets = 0;
    resting = isResting(s, a);
    landed = resting;
  }
  if (!resting) return { ...s, active: a, fallMs, lockMs: 0, lockResets, events: NO_EVENTS };

  lockMs += dt;
  const next: GameState = { ...s, active: a, fallMs: 0, lockMs, lockResets, events: landed ? ['land'] : NO_EVENTS };
  return lockMs >= lockDelayMs ? lock(next) : next;
}
