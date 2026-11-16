/**
 * Tap to move a Brick Escape brick (decision 1), as pure functions (no React, no DOM): tap a brick to pick it,
 * then tap a ringed square in its row or column, or its own open door, and it slides there as one move.
 *
 * This is the way in for a finger that cannot drag and for VoiceOver and Switch Control, which send a click.
 * Every target is found with the arrow keys' own keyStep, one square at a time, so a tap can only make a slide
 * a key press could make, and a brick still leaves only through its own open door (brief 11.1 #13).
 */
import { type Cell, type Level, type State, DIRS, withMove } from './engine';
import { keyStep } from './drag';

/** A spot the picked brick can slide to in a straight line. */
export interface SlideTarget {
  kind: 'slide';
  /** one square in the direction of the slide */
  dir: Cell;
  /** squares from where the brick is now */
  steps: number;
  /** the brick's anchor (top left square) once it is there */
  at: Cell;
  /** the first of `cells` */
  cell: Cell;
  /** the free squares at the brick's leading edge once it is there: the target's button and ring */
  cells: Cell[];
}

/** The brick's own open door, at the end of a straight slide toward it. */
export interface ExitTarget {
  kind: 'exit';
  dir: Cell;
  /** the squares slid to reach the door, plus the step out */
  steps: number;
  gate: number;
  /** where the brick leaves from: its anchor beside the door */
  from: Cell;
  /** free squares next to the door the door's button reaches into (the leading edge of the last slide);
   * empty when the brick already touches the door */
  reach: Cell[];
}

export type TapTarget = SlideTarget | ExitTarget;

/** The help line while a brick is picked. */
export const SELECT_LINE = 'Now tap where it should slide.';
export const NO_MOVE_LINE = 'This brick cannot move yet.';

const ORDER: Cell[] = [DIRS.top, DIRS.bottom, DIRS.left, DIRS.right];
const key = (c: Cell) => `${c[0]},${c[1]}`;

/** The squares `block` covers at anchor `at`. */
function covered(level: Level, block: number, at: Cell): Cell[] {
  return level.blocks[block].cells.map(([r, c]) => [at[0] + r, at[1] + c] as Cell);
}

/**
 * Every place the brick can reach in a straight line along its row or column, nearest first in each direction
 * (up, down, left, right), and an exit target where a slide toward its own open door ends with the brick out.
 * Iced doors and doors of another colour never give an exit: keyStep treats them as the tray edge.
 */
export function tapTargets(level: Level, state: State, block: number): TapTarget[] {
  const out: TapTarget[] = [];
  if (!state.pos[block]) return out;
  for (const dir of ORDER) {
    let s = state;
    let prevAt = state.pos[block]!;
    let lead: Cell[] = [];
    for (let steps = 1; steps <= Math.max(level.rows, level.cols) + 1; steps++) {
      const step = keyStep(level, s, block, dir);
      if (step.kind === 'blocked') break;
      if (step.kind === 'exit') {
        out.push({ kind: 'exit', dir, steps, gate: step.gate, from: prevAt, reach: lead });
        break;
      }
      const before = new Set(covered(level, block, prevAt).map(key));
      lead = covered(level, block, step.at).filter((c) => !before.has(key(c)));
      out.push({ kind: 'slide', dir, steps, at: step.at, cell: lead[0], cells: lead });
      s = withMove(s, block, step.at);
      prevAt = step.at;
    }
  }
  return out;
}

/**
 * The targets the board draws as buttons. A door's button reaches into the free squares beside the door, so
 * the spot there is left out: tapping it takes the brick out, which is never worse than stopping beside its
 * own open door. No two buttons share a square, and none covers a brick.
 */
export function tapButtons(level: Level, state: State, block: number): TapTarget[] {
  const all = tapTargets(level, state, block);
  const reached = new Set(all.flatMap((t) => (t.kind === 'exit' ? t.reach.map(key) : [])));
  return all.filter((t) => t.kind === 'exit' || !t.cells.some((c) => reached.has(key(c))));
}

export type TapResult =
  /** the brick slid to `at`; `state` is the board after it */
  | { kind: 'moved'; at: Cell; state: State }
  /** the brick slid to `from`, beside door `gate`, and goes out through it; `state` still has it on the board */
  | { kind: 'exit'; gate: number; from: Cell; state: State };

/** Carry out a tap on `target`: the same keyStep calls, one after another. Null when the board no longer allows it. */
export function tapMove(level: Level, state: State, block: number, target: TapTarget): TapResult | null {
  let s = state;
  for (let i = 0; i < target.steps; i++) {
    const step = keyStep(level, s, block, target.dir);
    if (step.kind === 'blocked') return null;
    if (step.kind === 'exit') {
      if (target.kind !== 'exit' || i !== target.steps - 1 || step.gate !== target.gate) return null;
      return { kind: 'exit', gate: step.gate, from: s.pos[block]!, state: s };
    }
    s = withMove(s, block, step.at);
  }
  if (target.kind !== 'slide') return null;
  const at = s.pos[block]!;
  return at[0] === target.at[0] && at[1] === target.at[1] ? { kind: 'moved', at, state: s } : null;
}
