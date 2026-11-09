/* Color Mixer's paints, results and the six recipes (brief 4.1, 7.3). The hex values are content, read from
   design/canvas/Mixer.dc.html, and are not brick tokens: snapping red plus white to the hot --brick-pink
   would stop it reading as a lighter red (brief 3.6). Pure data, no React and no DOM. */

/** The four paints on the shelf, in board order. */
export const PAINT_IDS = ['red', 'yellow', 'blue', 'white'] as const;
export type PaintId = (typeof PAINT_IDS)[number];

/** The six colours two different paints make: three mixes, then three tints with white. */
export const RESULT_IDS = ['orange', 'green', 'purple', 'pink', 'sky', 'cream'] as const;
export type ResultId = (typeof RESULT_IDS)[number];

/** A paint or a result: the same paint twice shows that paint's own colour. */
export type ColorId = PaintId | ResultId;

export interface ColorInfo {
  id: ColorId;
  /** As printed under a swatch or at the start of a line: "Sky blue". */
  name: string;
  hex: string;
}

export const PAINTS: Record<PaintId, ColorInfo> = {
  red: { id: 'red', name: 'Red', hex: '#f03a3a' },
  yellow: { id: 'yellow', name: 'Yellow', hex: '#ffc21a' },
  blue: { id: 'blue', name: 'Blue', hex: '#2f8cff' },
  white: { id: 'white', name: 'White', hex: '#f6f3ff' },
};

export const RESULTS: Record<ResultId, ColorInfo> = {
  orange: { id: 'orange', name: 'Orange', hex: '#ff8a1f' },
  green: { id: 'green', name: 'Green', hex: '#2fb84a' },
  purple: { id: 'purple', name: 'Purple', hex: '#8f4ae0' },
  pink: { id: 'pink', name: 'Pink', hex: '#ff8fb0' },
  sky: { id: 'sky', name: 'Sky blue', hex: '#8cc8ff' },
  cream: { id: 'cream', name: 'Cream', hex: '#ffe9a6' },
};

export const isPaint = (id: ColorId): id is PaintId => id in PAINTS;

export function colorInfo(id: ColorId): ColorInfo {
  return isPaint(id) ? PAINTS[id] : RESULTS[id];
}

/** The name inside a sentence: "sky blue", "red" (brief 8, intro). */
export const colorWord = (id: ColorId): string => colorInfo(id).name.toLowerCase();

export interface Recipe {
  /** The two paints, in board order. */
  pair: readonly [PaintId, PaintId];
  result: ResultId;
  /** The result text, verbatim from brief 8.2. */
  text: string;
}

/** Every unordered pair of the four paints, each making a different colour (brief 4.1). */
export const RECIPES: readonly Recipe[] = [
  { pair: ['red', 'yellow'], result: 'orange', text: 'Red and yellow make orange, like a sunset.' },
  { pair: ['yellow', 'blue'], result: 'green', text: 'Blue and yellow make green, like grass and leaves.' },
  { pair: ['red', 'blue'], result: 'purple', text: 'Red and blue make purple, like grapes.' },
  { pair: ['red', 'white'], result: 'pink', text: 'White makes red lighter. Now it is pink.' },
  { pair: ['blue', 'white'], result: 'sky', text: 'White makes blue lighter, like the sky.' },
  { pair: ['yellow', 'white'], result: 'cream', text: 'White makes yellow soft, like butter.' },
];

/** Shown when the same paint goes in both slots. */
export const SAME_TEXT = 'Same and same stays the same. Try two different paints.';

/** A stable key for an unordered pair of paints, in board order: "red+yellow". */
export function pairKey(a: PaintId, b: PaintId): string {
  return PAINT_IDS.indexOf(a) <= PAINT_IDS.indexOf(b) ? `${a}+${b}` : `${b}+${a}`;
}

const BY_PAIR = new Map<string, Recipe>(RECIPES.map((r) => [pairKey(r.pair[0], r.pair[1]), r]));
const BY_RESULT = new Map<ResultId, Recipe>(RECIPES.map((r) => [r.result, r]));

/** The recipe for two paints in either order, or null when they are the same paint. */
export function recipeOf(a: PaintId, b: PaintId): Recipe | null {
  return a === b ? null : (BY_PAIR.get(pairKey(a, b)) ?? null);
}

/** The recipe that makes a result. */
export function recipeFor(result: ResultId): Recipe {
  return BY_RESULT.get(result) as Recipe;
}

/** What two paints make: a result, or null for the same paint twice. */
export function mixOf(a: PaintId, b: PaintId): ResultId | null {
  return recipeOf(a, b)?.result ?? null;
}

/** The three results made from red, yellow and blue, and the three tints made with white. */
export const MIXES: readonly ResultId[] = ['orange', 'green', 'purple'];
export const TINTS: readonly ResultId[] = ['pink', 'sky', 'cream'];
