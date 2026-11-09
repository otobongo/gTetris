/**
 * The colour pairs a generated colour puzzle never puts together (six-games brief 9.4, user decision
 * 3 A): pairs that merge for children with a colour-vision deficiency. Shape Sorter's colour levels and
 * Pattern Train's colour-only levels read this list. Named apart from Color Mixer's content file
 * `mixer/colors.ts`. Batch 2 may add a pair here if the canvas check finds one (agent P only).
 */
import type { BrickColor } from '../../shared/ui/palette';

/** Red with green, blue with purple, red with pink, and blue with green (added in batch 2: the Pattern Train
 * canvas check found it merges under tritanopia). Order inside a pair does not matter. */
export const AVOID_PAIRS: readonly (readonly [BrickColor, BrickColor])[] = [
  ['red', 'green'],
  ['blue', 'purple'],
  ['red', 'pink'],
  ['blue', 'green'],
];

/** True when the two colours must not meet in one puzzle. */
export function clashes(a: BrickColor, b: BrickColor): boolean {
  return AVOID_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/** True when no two of the colours clash, so they may share one puzzle. Repeats of one colour are fine. */
export const colorsFit = (colors: Iterable<BrickColor>): boolean => clashingPairs(colors).length === 0;

/** The pairs in `colors` that clash, for a generator's check or a test's message. */
export function clashingPairs(colors: Iterable<BrickColor>): [BrickColor, BrickColor][] {
  const list = [...new Set(colors)];
  const out: [BrickColor, BrickColor][] = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (clashes(list[i], list[j])) out.push([list[i], list[j]]);
  return out;
}
