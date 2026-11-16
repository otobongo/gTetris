/**
 * What VoiceOver reads for Brick Escape, as pure functions (no React, no DOM): each brick's and door's name,
 * and the short line said after a move. Rows and columns count from 1, top left, the way a child counts them.
 */

import { type BlockDef, type Cell, type Color, type GateDef, type Level, type State, blockSize, isLocked, locksLeft } from './engine';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** 'row 2', or 'rows 2 to 3' for a span; `from` is the 0-based first line. */
function span(line: 'row' | 'column', from: number, len: number): string {
  return len === 1 ? `${line} ${from + 1}` : `${line}s ${from + 1} to ${from + len}`;
}

/** '2 long' for a brick one square thick, '3 wide, 2 tall' for one that is thicker. */
function size(h: number, w: number): string {
  if (h === 1 && w === 1) return '1 square';
  if (h === 1 || w === 1) return `${Math.max(h, w)} long`;
  return `${w} wide, ${h} tall`;
}

/** 'White brick, 2 long, row 1, columns 1 to 2': the brick's colour, size and the squares it covers. */
export function brickLabel(block: BlockDef, at: Cell): string {
  const { h, w } = blockSize(block);
  return `${cap(block.color)} brick, ${size(h, w)}, ${span('row', at[0], h)}, ${span('column', at[1], w)}`;
}

/**
 * 'White door, right side, row 2'. An iced door hides its colour, as the board does, and says what melts it:
 * 'Frozen door, top side, column 3, melts after 2 more bricks leave'.
 */
export function doorLabel(level: Level, g: GateDef, state: State): string {
  const where = `${g.side} side, ${span(g.side === 'left' || g.side === 'right' ? 'row' : 'column', g.at, g.len)}`;
  if (!isLocked(g, state, level)) return `${cap(g.color)} door, ${where}`;
  if (g.lockColor && locksLeft(g, state) === 0) return `Frozen door, ${where}, melts when every ${g.lockColor} brick is out`;
  const n = locksLeft(g, state);
  return `Frozen door, ${where}, melts after ${n} more ${n === 1 ? 'brick leaves' : 'bricks leave'}`;
}

/** 'White brick slid to column 3.': `to` is the 0-based row or column the brick's top or left edge is now on. */
export function moveLine(color: Color, axis: 'row' | 'column', to: number): string {
  return `${cap(color)} brick slid to ${axis} ${to + 1}.`;
}

/** 'White brick is out.' */
export function exitLine(color: Color): string {
  return `${cap(color)} brick is out.`;
}

/** The line after a drag from `from` to `to`: the one line that changed, or both when the brick went round a corner. */
export function slidLine(color: Color, from: Cell, to: Cell): string {
  if (from[0] !== to[0] && from[1] !== to[1]) return `${cap(color)} brick slid to row ${to[0] + 1}, column ${to[1] + 1}.`;
  return from[0] !== to[0] ? moveLine(color, 'row', to[0]) : moveLine(color, 'column', to[1]);
}

/** A tap target (decision 1): 'Slide Red brick to row 2, column 3', where the brick's top left square lands. */
export function slideTargetLabel(color: Color, at: Cell): string {
  return `Slide ${cap(color)} brick to row ${at[0] + 1}, column ${at[1] + 1}`;
}

/** The tap target on a brick's own open door: 'Take Red brick out through its door'. */
export function exitTargetLabel(color: Color): string {
  return `Take ${cap(color)} brick out through its door`;
}
