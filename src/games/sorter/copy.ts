/* Shape Sorter's child-facing lines, exactly as brief 8.3 and 9.2 word them. The shared lines (Next puzzle, the
   offer, the level card) live in the kit's copy.ts. Help lines are prompt style: 44 characters at most. */
import { pieceName, type Match, type SorterPiece, type SorterPuzzle } from './puzzles';
import { SHAPE_BADGE, SHAPE_FACT, SHAPE_NAME } from './shapes';

/** Prompt-style help lines stay within 2 lines at 390 px (7.2). */
export const HELP_MAX_CHARS = 44;

/** Speaker name on the top bar. */
export const SPEAKER_NAME = 'Hear the help line';

/** Help line when a board starts. */
export const helpStart = (colorMatters: boolean): string =>
  colorMatters ? 'Match the shape and the color.' : 'Drag each shape into its hole.';

/** Help line when a piece is picked: "Now tap the red circle hole." */
export const helpPicked = (name: string): string => `Now tap the ${name} hole.`;

/** Help line while a piece is dragged: "Drop the red circle in its hole." */
export const helpDragging = (name: string): string => `Drop the ${name} in its hole.`;

/** Help line when every hole is filled. */
export const HELP_SOLVED = 'Every shape is home.';

/**
 * Help line after a wrong placement. Shape levels name the shape the hole is for; colour levels say what matched
 * (same shape, same color, or neither and then name the hole). `match` is `compare(piece, hole)`.
 */
export function helpWrong(hole: SorterPiece, match: Match, colorMatters: boolean): string {
  if (!colorMatters) return `That hole is for the ${SHAPE_NAME[hole.shape]}.`;
  if (match === 'same-shape') return `Same shape, but this hole is ${hole.color}.`;
  if (match === 'same-color') return `Same color, but this hole is a ${SHAPE_NAME[hole.shape]}.`;
  return `That hole is for the ${pieceName(hole, true)}.`;
}

/** The fact bar before the first placement. */
export const factStart = (colorMatters: boolean): string =>
  colorMatters ? 'Look closely: each hole has a color too.' : 'Every shape has a home. Look at the corners.';

/** The fact bar after a placement: the placed shape's fact and its badge. */
export const factFor = (p: SorterPiece): { text: string; badge: string; badgeName: string } => ({
  text: SHAPE_FACT[p.shape],
  badge: SHAPE_BADGE[p.shape].text,
  badgeName: SHAPE_BADGE[p.shape].name,
});

/** What the game says on a right placement: "circle" or "red circle". It follows the child's own move. */
export const spokenOnPlace = (p: SorterPiece, colorMatters: boolean): string => pieceName(p, colorMatters);

/* Accessible names (9.2) */
export const TRAY_LABEL = 'Shapes to place';
export const HOLES_LABEL = 'Holes';
export const pieceLabel = (p: SorterPiece, colorMatters: boolean): string => pieceName(p, colorMatters);
export const holeLabel = (p: SorterPiece, colorMatters: boolean): string => `${pieceName(p, colorMatters)} hole`;
export const filledHoleLabel = (p: SorterPiece, colorMatters: boolean): string => `Filled ${pieceName(p, colorMatters)} hole`;

/**
 * Every help-row line a board can show, for the automatic length check: start, picked and dragging for each
 * piece, wrong for each piece on each other hole, and solved.
 */
export function helpLines(puzzle: SorterPuzzle): string[] {
  const cm = puzzle.colorMatters;
  const lines = [helpStart(cm), HELP_SOLVED];
  for (const piece of puzzle.pieces) {
    const name = pieceName(piece, cm);
    lines.push(helpPicked(name), helpDragging(name));
    for (const hole of puzzle.holes) {
      if (hole.id === piece.id) continue;
      const match: Match = piece.shape === hole.shape ? 'same-shape' : piece.color === hole.color ? 'same-color' : 'neither';
      lines.push(helpWrong(hole, match, cm));
    }
  }
  return lines;
}
