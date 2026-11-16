/**
 * Decision 2 (escape-drop-3): one geometric mark per brick colour. The marks are checked the way a child sees
 * them, at 14 px (the smallest a mark is drawn): every colour has one, the ten are different, the five pairs
 * colour-blind children mix up differ in outline (not just by a turn), and each ink reaches 3:1 against its
 * colour's face, worked out from the token values in tokens.css.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Color } from './engine';
import { MARK_INK, MARK_MIN, MARKS, type Pt, markFill, markPath, markSize } from './marks';

const COLORS: Color[] = ['red', 'yellow', 'green', 'blue', 'purple', 'orange', 'pink', 'teal', 'white', 'black'];
const CONFUSED: [Color, Color][] = [
  ['red', 'green'],
  ['red', 'pink'],
  ['blue', 'purple'],
  ['blue', 'green'],
  ['green', 'orange'],
];

/* ---------- drawing a mark at 14 px ---------- */

const PX = 14;
const SUB = 4; // samples per pixel side

/**
 * Where a row of samples at height `y` crosses the mark's outline: a sample at x is inside (even-odd) when an
 * odd number of these lie to its right. The same test as a point-in-polygon check, done once per row.
 */
function crossings(rings: Pt[][], y: number): number[] {
  const xs: number[] = [];
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
  return xs;
}

const turn = (rings: Pt[][], deg: number): Pt[][] => {
  const a = (deg * Math.PI) / 180;
  return rings.map((ring) => ring.map(([x, y]) => [12 + (x - 12) * Math.cos(a) - (y - 12) * Math.sin(a), 12 + (x - 12) * Math.sin(a) + (y - 12) * Math.cos(a)] as Pt));
};

/** How much of each of the 14 x 14 pixels the mark covers, 0 to 1 (SUB x SUB samples a pixel). */
function raster(rings: Pt[][]): number[] {
  const n = new Array<number>(PX * PX).fill(0);
  for (let py = 0; py < PX; py++)
    for (let sy = 0; sy < SUB; sy++) {
      const xs = crossings(rings, ((py + (sy + 0.5) / SUB) * 24) / PX);
      for (let px = 0; px < PX; px++)
        for (let sx = 0; sx < SUB; sx++) {
          const x = ((px + (sx + 0.5) / SUB) * 24) / PX;
          let right = 0;
          for (const cx of xs) if (x < cx) right++;
          if (right % 2) n[py * PX + px]++;
        }
    }
  return n.map((v) => v / (SUB * SUB));
}

/** Overlap of two drawn marks: 1 is the same picture, 0 shares nothing. */
function overlap(a: number[], b: number[]): number {
  let both = 0;
  let either = 0;
  a.forEach((v, i) => {
    both += Math.min(v, b[i]);
    either += Math.max(v, b[i]);
  });
  return both / either;
}

/** The closest two marks get when one is turned to any angle (5 degree steps) or flipped. */
function closestAnyTurn(a: Color, b: Color): number {
  const ra = raster(MARKS[a].rings);
  let best = 0;
  for (const flip of [false, true])
    for (let deg = 0; deg < 360; deg += 5) {
      const rings = turn(MARKS[b].rings, deg).map((ring) => (flip ? ring.map(([x, y]) => [24 - x, y] as Pt) : ring));
      best = Math.max(best, overlap(ra, raster(rings)));
    }
  return best;
}

/** Area over perimeter squared, scaled so a circle is 1: it does not change when a shape is turned. */
function roundness(rings: Pt[][]): number {
  let area = 0;
  let edge = 0;
  rings.forEach((ring, k) => {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      edge += Math.hypot(ring[i][0] - ring[j][0], ring[i][1] - ring[j][1]);
    }
    area += (k === 0 ? 1 : -1) * Math.abs(a / 2);
  });
  return (4 * Math.PI * area) / (edge * edge);
}

/* ---------- contrast from the tokens ---------- */

const tokens = readFileSync(new URL('../../styles/tokens.css', import.meta.url), 'utf8');
function token(name: string): [number, number, number] {
  const m = new RegExp(`--${name}:\\s*#([0-9a-f]{6})`, 'i').exec(tokens);
  if (!m) throw new Error(`No token --${name}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) as [number, number, number];
}
const lin = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

/** The face tones under a mark: the stud's light spot (odd-length bricks), the base, and the base a shade darker (doors, long bricks). */
function faceTones(color: Color): number[][] {
  const base = token(`brick-${color}`);
  return [token(`brick-${color}-light`), base, mix(base, token(`brick-${color}-dark`), 0.1)];
}

/** markFill as RGB laid over `under`, the way the browser blends it. */
function inkOver(color: Color, under: number[]): number[] {
  const m = /^rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/.exec(markFill(color));
  if (!m) throw new Error(`Unexpected fill ${markFill(color)}`);
  const ink = [Number(m[1]), Number(m[2]), Number(m[3])];
  const a = Number(m[4]);
  return under.map((v, i) => ink[i] * a + v * (1 - a));
}

describe('decision 2: a geometric mark for each brick colour', () => {
  it('gives every colour a mark with path data in a 24 x 24 box', () => {
    for (const c of COLORS) {
      expect(MARKS[c], c).toBeDefined();
      expect(markPath(c)).toMatch(/^M[\d. L]+Z/);
      for (const ring of MARKS[c].rings) for (const [x, y] of ring) expect(x >= 0 && x <= 24 && y >= 0 && y <= 24, `${c} ${x},${y}`).toBe(true);
    }
  });

  it('uses the shapes the brief names', () => {
    expect(Object.fromEntries(COLORS.map((c) => [c, MARKS[c].shape]))).toEqual({
      red: 'circle',
      yellow: 'diamond',
      green: 'square',
      blue: 'star',
      purple: 'plus',
      orange: 'bar',
      pink: 'triangle',
      teal: 'ring',
      white: 'cross',
      black: 'hexagon',
    });
  });

  it('draws ten different marks at 14 px', () => {
    expect(new Set(COLORS.map(markPath)).size).toBe(10);
    const drawn = COLORS.map((c) => raster(MARKS[c].rings));
    for (let i = 0; i < COLORS.length; i++)
      for (let j = i + 1; j < COLORS.length; j++) expect(overlap(drawn[i], drawn[j]), `${COLORS[i]} and ${COLORS[j]}`).toBeLessThan(0.9);
  });

  it('keeps every mark clear of the box edge and big enough to see at 14 px', () => {
    for (const c of COLORS) {
      const covered = raster(MARKS[c].rings).reduce((s, v) => s + v, 0);
      // at least a fifth of the 14 x 14 box is ink, so a mark never shrinks to a dot or a hairline
      expect(covered, c).toBeGreaterThan(PX * PX * 0.2);
    }
  });

  for (const [a, b] of CONFUSED) {
    it(`tells ${a} from ${b} by outline, at any turn`, () => {
      // the same shape turned would overlap almost fully; these stay clearly apart at every angle and flip
      expect(closestAnyTurn(a, b)).toBeLessThan(0.86);
      // and their outlines are of a different kind: one is much rounder, or much spikier, than the other
      expect(Math.abs(roundness(MARKS[a].rings) - roundness(MARKS[b].rings))).toBeGreaterThan(0.1);
    });
  }

  it('reaches 3:1 against each colour face it sits on, from the token values', () => {
    const table: string[] = [];
    for (const c of COLORS) {
      const ratios = faceTones(c).map((under) => ratio(inkOver(c, under), under));
      table.push(`${c}: ${MARK_INK[c].ink} ${MARK_INK[c].alpha} -> ${ratios.map((r) => r.toFixed(2)).join(', ')}`);
      for (const r of ratios) expect(r, `${c} ${ratios.join(' ')}`).toBeGreaterThanOrEqual(3);
    }
    expect(table).toHaveLength(10);
  });

  it('sizes a mark like one stud, half a square, and never under 14 px', () => {
    expect(MARK_MIN).toBe(14);
    expect(markSize(38)).toBe(19);
    expect(markSize(30)).toBe(15);
    expect(markSize(27)).toBe(14);
    expect(markSize(24)).toBe(14);
  });
});
