/* Shape Sorter shapes and colours (brief 4.2, 7.4, 8.3, 9.4). Plain data, so it runs in node.
   The board's five shapes plus rectangle, diamond and pentagon, each with a name, a fact and a badge. */
import type { BrickColor } from '../../shared/ui/palette';

export const SHAPES = ['circle', 'square', 'triangle', 'star', 'hexagon', 'rectangle', 'diamond', 'pentagon'] as const;
export type ShapeId = (typeof SHAPES)[number];

/**
 * Shapes that look alike share a family (4.2). Levels 1 to 8 take at most one shape per family; Level 9
 * takes two from the square family plus pentagon and hexagon.
 */
export const FAMILIES: readonly (readonly ShapeId[])[] = [
  ['square', 'rectangle', 'diamond'],
  ['pentagon', 'hexagon'],
  ['circle'],
  ['triangle'],
  ['star'],
];

export const SQUARE_FAMILY: readonly ShapeId[] = FAMILIES[0];

export function familyOf(shape: ShapeId): number {
  return FAMILIES.findIndex((f) => f.includes(shape));
}

/** How each shape is cut out, as 7.4 and the board write it. A shape sets either a radius or a clip-path. */
export const SHAPE_STYLE: Readonly<Record<ShapeId, { borderRadius?: string; clipPath?: string }>> = {
  circle: { borderRadius: '50%' },
  square: { borderRadius: '6px' },
  triangle: { clipPath: 'polygon(50% 4%, 98% 94%, 2% 94%)' },
  star: { clipPath: 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' },
  hexagon: { clipPath: 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%)' },
  rectangle: { clipPath: 'inset(22% 0 round 6px)' },
  diamond: { clipPath: 'polygon(50% 0, 90% 50%, 50% 100%, 10% 50%)' },
  pentagon: { clipPath: 'polygon(50% 2%, 98% 38%, 80% 96%, 20% 96%, 2% 38%)' },
};

/** A shape's name as it is said and written inside a sentence (lower case). */
export const SHAPE_NAME: Readonly<Record<ShapeId, string>> = {
  circle: 'circle',
  square: 'square',
  triangle: 'triangle',
  star: 'star',
  hexagon: 'hexagon',
  rectangle: 'rectangle',
  diamond: 'diamond',
  pentagon: 'pentagon',
};

/** The fact bar line once a shape of this kind has been placed (8.3). */
export const SHAPE_FACT: Readonly<Record<ShapeId, string>> = {
  circle: 'A circle is round. It has no corners.',
  square: 'A square has 4 sides, all the same length.',
  triangle: 'A triangle has 3 sides and 3 corners.',
  star: 'A star has 5 points.',
  hexagon: 'A hexagon has 6 sides, like a honeycomb cell.',
  rectangle: 'A rectangle has 4 sides. Two are long, two are short.',
  diamond: 'A diamond has 4 sides of the same length.',
  pentagon: 'A pentagon has 5 sides and 5 corners.',
};

/**
 * The fact bar badge: `text` is what the badge shows (the star's 5 counts points), `name` is its
 * accessible name (8.3, 9.2). Before the first placement the badge shows "?", hidden from assistive tech.
 */
export const SHAPE_BADGE: Readonly<Record<ShapeId, { text: string; name: string }>> = {
  circle: { text: '0', name: 'no corners' },
  square: { text: '4', name: '4 sides' },
  triangle: { text: '3', name: '3 sides' },
  star: { text: '5', name: '5 points' },
  hexagon: { text: '6', name: '6 sides' },
  rectangle: { text: '4', name: '4 sides' },
  diamond: { text: '4', name: '4 sides' },
  pentagon: { text: '5', name: '5 sides' },
};

/** The board's six colours, through the `--brick-*` tokens (7.4). Shape levels use yellow only. */
export const SORTER_COLORS = ['yellow', 'red', 'blue', 'green', 'pink', 'purple'] as const satisfies readonly BrickColor[];
export type SorterColor = (typeof SORTER_COLORS)[number];

/** The only colour on the shape levels (1 to 3). */
export const SHAPE_LEVEL_COLOR: SorterColor = 'yellow';

/* The colours that must not meet in one puzzle (9.4) are the kit's list, src/games/kit/colorPairs.ts. */
