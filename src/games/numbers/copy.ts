/* Number Line-up's child-facing lines, word for word from brief section 8.4 (tower names from 9.2).
   The shared lines (offer, swap, level card, the hint cap, game finished) are the kit's (8.1).
   Help lines use the prompt style: 44 characters at most, the longest numbers filled in (7.2). */
import type { NumbersPuzzle } from './puzzles';

/** Spot names for the hint line, first to sixth. */
export const SPOTS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'] as const;

/** The goal strip's text. */
export function goalLine(p: Pick<NumbersPuzzle, 'kind' | 'dir'>): string {
  if (p.kind === 'big') return p.dir === 'up' ? 'Line up the numbers, smallest first.' : 'Line up the numbers, biggest first.';
  return p.dir === 'up'
    ? 'Line up 1 to 6, smallest first, so the towers make stairs going up.'
    : 'Line up 6 to 1, biggest first, so the stairs go down.';
}

/** Help line while no tower is picked. */
export const START_LINE = 'Drag or tap two towers to swap them.';

/** Help line while a tower is picked (lifted). */
export const PICKED_LINE = 'Now tap where it should go.';

/** Hint line: `value` is the tower that belongs in spot `to` (0-based). It stays until the next swap. */
export function hintLine(value: number, to: number): string {
  return `${value} belongs in the ${SPOTS[to] ?? SPOTS[0]} spot. Swap them.`;
}

/** Help line once solved, with the numbers in order. */
export function solvedLine(p: Pick<NumbersPuzzle, 'kind' | 'dir' | 'goal'>): string {
  if (p.kind === 'big') return `In order: ${p.goal.join(', ')}.`;
  return p.dir === 'up' ? 'Stairs going up: 1, 2, 3, 4, 5, 6.' : 'Stairs going down: 6, 5, 4, 3, 2, 1.';
}

/** The legend under the marks, in the footer slot during play. */
export const LEGEND = 'A filled green line means that tower is in the right spot.';

/** The Hint button's accessible name. */
export const hintName = (left: number): string => `Hint, ${left} left`;

/** The speaker button's accessible name (the kit's offer name replaces it while the offer shows). */
export const SPEAKER_NAME = 'Hear the help line';

/** What the speaker reads: the goal and the help line, and once solved the solved line with its numbers. */
export function spokenText(p: Pick<NumbersPuzzle, 'kind' | 'dir' | 'goal'>, helpLine: string, solved: boolean): string {
  return solved ? solvedLine(p) : `${goalLine(p)} ${helpLine}`;
}

/** A tower's accessible name (9.2): "Tower of 4, spot 2 of 6, in the right spot". `spot` is 0-based. */
export function towerName(value: number, spot: number, right: boolean, towers = SPOTS.length): string {
  return `Tower of ${value}, spot ${spot + 1} of ${towers}, ${right ? 'in the right spot' : 'not in the right spot'}`;
}
