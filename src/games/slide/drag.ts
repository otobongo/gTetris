/**
 * How a drag or a key press moves a Brick Escape brick, as pure functions (no React, no DOM).
 *
 * A brick leaves the board only on purpose: the child has to drag it on out through its own open door, past
 * the board edge. Sliding up to the door, touching it, or letting go beside it keeps the brick on the board.
 * The door rules themselves (color, ice, exact fit, clear path) are fitsGate in engine.ts, the same rules the
 * solver and the hint use, so a solver move is still exactly one drag.
 */

import { type Cell, type Level, type Side, type State, DIRS, canPlace, fitsGate, isFrozen, occupancy } from './engine';

/**
 * How far past the board edge, in squares, a drag must carry the brick through its door before it leaves.
 * Half a square: the board rounds the pointer to the nearest square, so anything less still means "this
 * square, at the edge". At half a square the brick's leading edge is past the door strip (the door is about a
 * quarter of a square thick), so the child has visibly pushed it out, and a small slip at the edge never counts.
 */
export const EXIT_PAST = 0.5;

/** A brick being pulled into an open door it fits. */
export interface DoorPull {
  gate: number;
  side: Side;
  /** squares past the board edge the drag asks for, in the door's direction (> 0) */
  depth: number;
}

export interface DragStep {
  /** the brick's legal spot on the board after this pointer move (unchanged when it can not go further) */
  at: Cell;
  /** gate index once the drag has carried the brick EXIT_PAST squares out through its door, else -1 */
  exit: number;
  /** how far the brick is pulled into its door, so the board can show it sliding out; null when it is not */
  pull: DoorPull | null;
}

/**
 * Slide one brick toward `target` one square at a time, through legal spots only, trying the longer way
 * first. Never leaves the board: a target past the edge just stops the brick at the edge.
 */
export function slideToward(level: Level, state: State, block: number, target: Cell): Cell | null {
  let p = state.pos[block];
  if (!p || isFrozen(level, state, block)) return p;
  const occ = occupancy(level, state);
  for (let guard = 0; guard < 24; guard++) {
    const ry = target[0] - p[0];
    const rx = target[1] - p[1];
    if (!ry && !rx) break;
    const tries: Cell[] = Math.abs(ry) >= Math.abs(rx) ? [[Math.sign(ry), 0], [0, Math.sign(rx)]] : [[0, Math.sign(rx)], [Math.sign(ry), 0]];
    const next = tries.find(([dr, dc]) => (dr || dc) && canPlace(level, occ, block, p![0] + dr, p![1] + dc));
    if (!next) break;
    p = [p[0] + next[0], p[1] + next[1]];
  }
  return p;
}

/**
 * Is the brick, at its spot `at`, being pulled out through an open door it fits? `want` is where the drag
 * would put the brick's anchor if nothing stopped it (fractional squares). The pull is how far `want` lies
 * beyond `at` in the door's direction; with two such doors, the one pulled hardest wins.
 */
export function doorPull(level: Level, state: State, block: number, at: Cell, want: readonly [number, number]): DoorPull | null {
  if (!state.pos[block] || isFrozen(level, state, block)) return null;
  const here: State = { ...state, pos: state.pos.map((p, i) => (i === block ? at : p)) };
  const occ = occupancy(level, here);
  let best: DoorPull | null = null;
  for (let gi = 0; gi < level.gates.length; gi++) {
    if (!fitsGate(level, occ, here, block, at[0], at[1], gi)) continue;
    const { side } = level.gates[gi];
    const [dr, dc] = DIRS[side];
    const depth = (want[0] - at[0]) * dr + (want[1] - at[1]) * dc;
    if (depth > 0 && (!best || depth > best.depth)) best = { gate: gi, side, depth };
  }
  return best;
}

/**
 * One pointer move (or the release) of a drag. `start` is where the brick was when the drag began, `offset`
 * the pointer's travel since then, in squares [rows, cols]. The brick follows to the nearest legal spot, and
 * leaves only if the drag carries it at least EXIT_PAST squares out through its door from there.
 */
export function dragStep(level: Level, state: State, block: number, start: Cell, offset: readonly [number, number]): DragStep {
  const want: [number, number] = [start[0] + offset[0], start[1] + offset[1]];
  const at = slideToward(level, state, block, [Math.round(want[0]), Math.round(want[1])]);
  if (!at) return { at: start, exit: -1, pull: null };
  const pull = doorPull(level, state, block, at, want);
  return { at, exit: pull && pull.depth >= EXIT_PAST ? pull.gate : -1, pull };
}

export type KeyStep = { kind: 'moved'; at: Cell } | { kind: 'exit'; gate: number } | { kind: 'blocked' };

/**
 * One arrow-key press on a focused brick. A brick beside its open door leaves when the press points out
 * through that door; a press that only brings it next to the door slides it there and it stays.
 */
export function keyStep(level: Level, state: State, block: number, dir: Cell): KeyStep {
  const p = state.pos[block];
  if (!p || isFrozen(level, state, block)) return { kind: 'blocked' };
  const occ = occupancy(level, state);
  const out = level.gates.findIndex((g, gi) => DIRS[g.side][0] === dir[0] && DIRS[g.side][1] === dir[1] && fitsGate(level, occ, state, block, p[0], p[1], gi));
  if (out >= 0) return { kind: 'exit', gate: out };
  const at: Cell = [p[0] + dir[0], p[1] + dir[1]];
  return canPlace(level, occ, block, at[0], at[1]) ? { kind: 'moved', at } : { kind: 'blocked' };
}
