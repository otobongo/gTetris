/**
 * One plain geometric mark per brick colour (decision 2), so a child who confuses red and green, or blue and
 * purple, can still match a brick to its door by shape. Pure data: no React, no DOM.
 *
 * Each mark is drawn in a 24 x 24 box as polygons filled even-odd (the ring is two circles). The play screen
 * turns them into one SVG path; the tests read the polygons to check the shapes at 14 px. Rules:
 * - plain shapes, not pictures, so the board still looks grown-up at 9 to 10;
 * - the pairs children mix up (red and green, red and pink, blue and purple, blue and green, green and orange)
 *   differ in outline, never only by a turn of the same shape;
 * - the ink reaches 3:1 against the brick's face at the mark's centre, and against its door.
 */
import type { Color } from './engine';

export type Pt = readonly [number, number];

export interface Mark {
  /** what the shape is, for the tests and the design notes */
  shape: string;
  /** closed polygons in a 24 x 24 box, filled even-odd */
  rings: Pt[][];
}

const C = 12;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** A regular polygon (or a circle, with many sides) around (cx, cy); `turn` in degrees, 0 puts a point straight up. */
function regular(sides: number, radius: number, turn = 0, cx = C, cy = C): Pt[] {
  return Array.from({ length: sides }, (_, i) => {
    const a = ((turn + (360 * i) / sides - 90) * Math.PI) / 180;
    return [r2(cx + radius * Math.cos(a)), r2(cy + radius * Math.sin(a))] as Pt;
  });
}

const circle = (radius: number) => regular(48, radius);

/** A rectangle with rounded corners, `r` the corner radius. */
function roundRect(x0: number, y0: number, x1: number, y1: number, r: number): Pt[] {
  const out: Pt[] = [];
  const corner = (cx: number, cy: number, from: number) => {
    for (let i = 0; i <= 6; i++) {
      const a = ((from + i * 15) * Math.PI) / 180;
      out.push([r2(cx + r * Math.cos(a)), r2(cy + r * Math.sin(a))]);
    }
  };
  corner(x1 - r, y0 + r, -90);
  corner(x1 - r, y1 - r, 0);
  corner(x0 + r, y1 - r, 90);
  corner(x0 + r, y0 + r, 180);
  return out;
}

/** A five-point star, point up. */
function star(outer: number, inner: number, cy: number): Pt[] {
  return Array.from({ length: 10 }, (_, i) => {
    const a = ((i * 36 - 90) * Math.PI) / 180;
    const rad = i % 2 ? inner : outer;
    return [r2(C + rad * Math.cos(a)), r2(cy + rad * Math.sin(a))] as Pt;
  });
}

/** A plus with arms `w` wide reaching `len / 2` from the centre, turned by `turn` degrees (45 makes an X). */
function plus(len: number, w: number, turn = 0): Pt[] {
  const h = len / 2;
  const t = w / 2;
  const pts: Pt[] = [
    [-t, -h], [t, -h], [t, -t], [h, -t], [h, t], [t, t],
    [t, h], [-t, h], [-t, t], [-h, t], [-h, -t], [-t, -t],
  ];
  const a = (turn * Math.PI) / 180;
  return pts.map(([x, y]) => [r2(C + x * Math.cos(a) - y * Math.sin(a)), r2(C + x * Math.sin(a) + y * Math.cos(a))] as Pt);
}

/**
 * Circles are drawn about 12% wider than the square and the triangle a little taller, so the ten read as one
 * size (optical, not equal, sizes).
 */
export const MARKS: Record<Color, Mark> = {
  red: { shape: 'circle', rings: [circle(8)] },
  green: { shape: 'square', rings: [roundRect(4, 4, 20, 20, 1)] },
  pink: { shape: 'triangle', rings: [[[12, 3], [21.5, 19.75], [2.5, 19.75]]] },
  blue: { shape: 'star', rings: [star(11, 5, 12.9)] },
  purple: { shape: 'plus', rings: [plus(18, 7)] },
  orange: { shape: 'bar', rings: [roundRect(2, 8.5, 22, 15.5, 3.5)] },
  yellow: { shape: 'diamond', rings: [[[12, 2.5], [21.5, 12], [12, 21.5], [2.5, 12]]] },
  teal: { shape: 'ring', rings: [circle(8.6), circle(4.4)] },
  white: { shape: 'cross', rings: [plus(19, 5.5, 45)] },
  // a wide hexagon: a regular one reads as a circle at 14 px (marks.r2.test.ts), so its corners are pulled out
  black: { shape: 'hexagon', rings: [[[1, 12], [6.5, 5.5], [17.5, 5.5], [23, 12], [17.5, 18.5], [6.5, 18.5]]] },
};

/** SVG path data for a colour's mark (24 x 24 box, fill-rule evenodd). */
export function markPath(color: Color): string {
  return MARKS[color].rings.map((ring) => `M${ring.map(([x, y]) => `${x} ${y}`).join('L')}Z`).join('');
}

/**
 * The mark's ink: a see-through shade over the brick face, so it reads as pressed into the plastic. Dark on
 * every colour except black, which takes a light one. Each alpha is the lowest step of 0.05 that reaches 3:1
 * against the face's light, base and slightly darker tones (marks.r2.test.ts works it out from tokens.css).
 */
export const MARK_INK: Record<Color, { ink: 'dark' | 'light'; alpha: number }> = {
  red: { ink: 'dark', alpha: 0.6 },
  yellow: { ink: 'dark', alpha: 0.5 },
  green: { ink: 'dark', alpha: 0.55 },
  blue: { ink: 'dark', alpha: 0.6 },
  purple: { ink: 'dark', alpha: 0.65 },
  orange: { ink: 'dark', alpha: 0.55 },
  pink: { ink: 'dark', alpha: 0.55 },
  teal: { ink: 'dark', alpha: 0.5 },
  white: { ink: 'dark', alpha: 0.45 },
  black: { ink: 'light', alpha: 0.7 },
};

/** The fill for a colour's mark, as a CSS colour. */
export function markFill(color: Color): string {
  const { ink, alpha } = MARK_INK[color];
  return ink === 'dark' ? `rgb(0 0 0 / ${alpha})` : `rgb(255 255 255 / ${alpha})`;
}

/** The mark's size on a brick: one stud, half a square, never under 14 px. */
export const MARK_MIN = 14;
export const markSize = (cell: number) => Math.max(MARK_MIN, Math.round(cell / 2));
