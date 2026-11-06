/**
 * Brick Drop controls: the keys, the on-screen row and the board gestures, and what each one
 * does to the game. Pure, so the mapping can be tested without a browser. Play.tsx wires it up.
 */
import type { IconName } from '../../shared/ui';
import { hardDrop, move, rotate, softDrop, type GameState } from './engine';

export type Action = 'left' | 'right' | 'down' | 'rotate' | 'rotateBack' | 'drop';

/** Hold-to-repeat timings (ms). Gentle on purpose so small fingers don't overshoot. */
export const REPEAT: Partial<Record<Action, { delay: number; every: number }>> = {
  left: { delay: 200, every: 75 },
  right: { delay: 200, every: 75 },
  down: { delay: 120, every: 45 },
};

/** Keyboard controls. The on-screen row has Left, Turn, Down and Right; Space is keyboard only. There is no hold. */
export const KEYS: Readonly<Record<string, Action>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowUp: 'rotate',
  x: 'rotate',
  X: 'rotate',
  z: 'rotateBack',
  Z: 'rotateBack',
  ' ': 'drop',
};

/** Keys that pause and resume. */
export const PAUSE_KEYS: readonly string[] = ['p', 'P', 'Escape'];

/** The control row, in this order: Left, Turn, Down, Right. */
export const PAD: readonly { act: Action; icon: IconName; label: string; tone: 'purple' | 'green' }[] = [
  { act: 'left', icon: 'left', label: 'Left', tone: 'purple' },
  { act: 'rotate', icon: 'rotate', label: 'Turn', tone: 'green' },
  { act: 'down', icon: 'down', label: 'Down', tone: 'purple' },
  { act: 'right', icon: 'right', label: 'Right', tone: 'purple' },
];

/** The action a key stands for, or null. */
export function keyAction(key: string): Action | null {
  return Object.prototype.hasOwnProperty.call(KEYS, key) ? KEYS[key] : null;
}

export interface KeyLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/** What a key press does: an action, 'pause', or nothing (other keys, and shortcuts with Ctrl, Cmd or Alt). */
export function keyCommand(e: KeyLike): Action | 'pause' | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (PAUSE_KEYS.includes(e.key)) return 'pause';
  return keyAction(e.key);
}

/** One action applied to the game. */
export function applyAction(s: GameState, a: Action): GameState {
  switch (a) {
    case 'left':
      return move(s, -1);
    case 'right':
      return move(s, 1);
    case 'down':
      return softDrop(s);
    case 'rotate':
      return rotate(s, 1);
    case 'rotateBack':
      return rotate(s, -1);
    case 'drop':
      return hardDrop(s);
  }
}

/* ---------- Board gestures: drag sideways to move, swipe down to drop, tap to turn ---------- */

/** A finger has to travel this far before a drag counts as sideways or downwards. */
export const AXIS_PX = 12;
/** A touch shorter than this that never picked a direction is a tap. */
export const TAP_MS = 350;
/** Sideways steps are a cell wide, and never under this, so tiny cells don't race. */
export const MIN_STEP_PX = 18;

export type Axis = '' | 'h' | 'v';

/** The direction a drag has taken so far ('' until it travels AXIS_PX). */
export function gestureAxis(dx: number, dy: number): Axis {
  if (Math.hypot(dx, dy) <= AXIS_PX) return '';
  return Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
}

/** Pixels of sideways drag per one-cell move. */
export function dragStep(cell: number): number {
  return Math.max(cell, MIN_STEP_PX);
}

/**
 * Sideways moves for a finger now at `x`, counted from `sx` (where the last move happened).
 * Positive is right. Returns the new `sx`, so leftover pixels count toward the next move.
 */
export function dragMoves(x: number, sx: number, step: number): { moves: number; sx: number } {
  let moves = 0;
  while (x - sx >= step) {
    moves++;
    sx += step;
  }
  while (x - sx <= -step) {
    moves--;
    sx -= step;
  }
  return { moves, sx };
}

/** What lifting the finger does: a quick tap turns, a long enough swipe down drops, anything else nothing. */
export function releaseAction(axis: Axis, dx: number, dy: number, ms: number, cell: number): Action | null {
  if (axis === 'v' && dy > Math.max(40, cell * 2) && dy > Math.abs(dx) * 1.5) return 'drop';
  if (!axis && ms < TAP_MS) return 'rotate';
  return null;
}
