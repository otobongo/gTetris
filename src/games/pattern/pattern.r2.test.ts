/* Pattern Train, usability round 2 (decisions 3 and 16), in node: the shapes' dark edge and its contrast from the
   tokens, the shape drawn as SVG, and the train's zoom from the car count and the screen. */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../shared/ui/layout';
import { ALL_CARS, CAR_COLORS, SHAPES, type Car } from './cars';
import { LEVELS, MAX_SHOWN } from './levels';
import { TRAIN_ZOOM, trainZoom } from './play';
import { Shape } from './Train';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const tokens = read('../../styles/tokens.css');
const css = read('./pattern.css');

/** A token's hex value from tokens.css. */
function token(name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(tokens);
  if (!m) throw new Error(`No token --${name}`);
  return m[1];
}

/** WCAG 2.x relative luminance and contrast ratio. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('decision 3: the shape edge reaches 3:1', () => {
  const edge = token('bw-purple-edge');

  it('reads the tokens the brief names', () => {
    expect(edge).toBe('#241a63');
    expect(token('brick-white')).toBe('#f1eef7');
  });

  it('the --bw-purple-edge outline stands 3:1 or more against the white car body', () => {
    expect(contrast(edge, token('brick-white'))).toBeGreaterThanOrEqual(3);
  });

  it.each(CAR_COLORS)('the %s fill stands 3:1 or more against the edge, so it reads on the purple tile too', (color) => {
    expect(contrast(token(`brick-${color}`), edge)).toBeGreaterThanOrEqual(3);
  });

  it('without the edge some fills fall under 3:1 on the white body (the reason for the change)', () => {
    const under = CAR_COLORS.filter((c) => contrast(token(`brick-${c}`), token('brick-white')) < 3);
    expect(under).toEqual(['blue', 'yellow', 'green', 'pink']);
  });

  it('pattern.css strokes the shape with the token, 2.5 units wide, round joins, the stroke under the fill', () => {
    const rule = /\.pat-shape\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toMatch(/stroke:\s*var\(--bw-purple-edge\)/);
    expect(rule).toMatch(/stroke-width:\s*2\.5\b/);
    expect(rule).toMatch(/stroke-linejoin:\s*round/);
    expect(rule).toMatch(/paint-order:\s*stroke/);
    expect(rule).toMatch(/fill:\s*var\(--pat-c\)/);
  });

  it('no clip-path is left on the shapes', () => {
    expect(css).not.toMatch(/\.pat-shape[^{]*\{[^}]*clip-path/);
  });
});

describe('decision 3: a shape is an SVG in a 30 unit box', () => {
  const svg = (car: Car) => renderToStaticMarkup(createElement(Shape, { car }));

  it.each(ALL_CARS.map((c) => [`${c.color} ${c.shape}`, c] as const))('%s keeps its class, data attributes and hidden state', (_, car) => {
    const html = svg(car);
    expect(html).toMatch(/^<svg /);
    expect(html).toContain('class="pat-shape"');
    expect(html).toContain(`data-shape="${car.shape}"`);
    expect(html).toContain(`data-color="${car.color}"`);
    expect(html).toContain('viewBox="0 0 30 30"');
    expect(html).toContain('aria-hidden="true"');
    // The colour and the edge come from pattern.css, so nothing is painted inline.
    expect(html).not.toMatch(/fill="|stroke="|style="/);
  });

  it('draws one element per shape, matching the old clip-paths', () => {
    const at = (shape: Car['shape']) => svg({ shape, color: 'red' });
    expect(at('circle')).toContain('<circle cx="15" cy="15" r="15"');
    expect(at('square')).toContain('<rect width="30" height="30" rx="6"');
    // polygon(50% 4%, 98% 94%, 2% 94%) in 30 units.
    expect(at('triangle')).toContain('<polygon points="15,1.2 29.4,28.2 0.6,28.2"');
    // polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%) in 30 units.
    expect(at('star')).toContain('<polygon points="15,0 18.3,10.5 29.4,10.5 20.4,17.1 23.7,27.3 15,21 6.3,27.3 9.6,17.1 0.6,10.5 11.7,10.5"');
    for (const shape of SHAPES) expect(at(shape).match(/<(circle|rect|polygon) /g)).toHaveLength(1);
  });
});

describe('decision 16: the train zoom follows the car count', () => {
  const phone = { mode: 'phone' as const, width: 390 };
  const tablet = { mode: 'tablet' as const, width: 834 };

  it('names the brief values', () => {
    expect(TRAIN_ZOOM).toEqual({ four: 0.95, five: 0.82, tablet: 1 });
  });

  it('is 0.95 on a 390 phone with 4 cars before the empty one, 0.82 with 5', () => {
    expect(trainZoom(phone, 4)).toBe(0.95);
    expect(trainZoom(phone, 5)).toBe(0.82);
  });

  it('is 1 on tablet whatever the count', () => {
    expect(trainZoom(tablet, 4)).toBe(1);
    expect(trainZoom(tablet, 5)).toBe(1);
    expect(trainZoom({ mode: 'tablet', width: 1194 }, 5)).toBe(1);
  });

  it('follows every level: Levels 1 to 3 show 4 cars, the rest 5', () => {
    expect(LEVELS.map((l) => trainZoom(phone, l.shown))).toEqual([0.95, 0.95, 0.95, ...Array(9).fill(0.82)]);
  });

  it('never draws the train wider than a narrow phone column (375: 343 px of content)', () => {
    // Locomotive 70 px, each car 56 px and a 4 px gap, then the empty car.
    const width = (shown: number) => 70 + (shown + 1) * 60;
    for (const shown of [4, 5]) {
      const z = trainZoom({ mode: 'phone', width: 375 }, shown);
      expect(width(shown) * z).toBeLessThanOrEqual(343);
      expect(z).toBeLessThanOrEqual(shown === 4 ? 0.95 : 0.82);
    }
    // A 4-car train still gets a shape of 33 px there: 36 px at the zoom.
    expect(36 * trainZoom({ mode: 'phone', width: 375 }, 4)).toBeGreaterThanOrEqual(33);
  });

  it('keeps the brief value on phones wider than the 430 px frame', () => {
    expect(trainZoom({ mode: 'phone', width: 700 }, 4)).toBe(0.95);
    expect(trainZoom({ mode: 'phone', width: 700 }, 5)).toBe(0.82);
  });

  it('pattern.css draws the car shape at 36 px and takes the zoom from --pat-train-zoom', () => {
    expect(css).toMatch(/\.pat-car__body\s*\{[^}]*--pat-shape:\s*36px/);
    expect(css).toMatch(/\.pat-train\s*\{[^}]*zoom:\s*var\(--pat-train-zoom,\s*0\.78\)/);
  });
});

describe('decision 16: the fit on narrow phones, at its edges', () => {
  /** The train's width at zoom 1, read from pattern.css and tokens.css: the locomotive, then each car after a gap. */
  const px = (rule: RegExp) => Number(rule.exec(css)?.[1]);
  const loco = px(/\.pat-loco\s*\{[^}]*?width:\s*(\d+)px/);
  const car = px(/\.pat-car\s*\{[^}]*?width:\s*(\d+)px/);
  const gap = Number(/--bw-sp-1:\s*(\d+)px/.exec(tokens)?.[1]);
  const width = (shown: number) => loco + (shown + 1) * (car + gap);
  const column = (w: number) => Math.min(w, 430) - 32;

  it('rests on the sizes the CSS really draws', () => {
    expect({ loco, car, gap }).toEqual({ loco: 70, car: 56, gap: 4 });
    expect(tokens).toMatch(/--bw-phone-max:\s*430px/);
    expect(read('../../shared/ui/ui.css')).toMatch(/\.bw-screen__frame--standard\s*\{\s*padding:\s*20px 16px 18px/);
  });

  it.each([4, 5])('with %i cars the train fits the column at every phone width, and never grows as the phone narrows', (shown) => {
    let last = 0;
    for (let w = 320; w < 744; w++) {
      const z = trainZoom(computeLayout(w, 800), shown);
      expect(width(shown) * z, `${w} px wide`).toBeLessThanOrEqual(column(w));
      expect(z, `${w} px wide`).toBeGreaterThanOrEqual(last);
      expect(z).toBeLessThanOrEqual(shown === 4 ? TRAIN_ZOOM.four : TRAIN_ZOOM.five);
      last = z;
    }
  });

  it('holds the brief value from the first width where it fits, and only lowers it under that', () => {
    expect(trainZoom({ mode: 'phone', width: 384 }, 4)).toBe(0.95);
    expect(trainZoom({ mode: 'phone', width: 383 }, 4)).toBe(0.94);
    expect(trainZoom({ mode: 'phone', width: 385 }, 5)).toBe(0.82);
    expect(trainZoom({ mode: 'phone', width: 384 }, 5)).toBe(0.81);
  });

  it('turns to the tablet value at the tablet width, not before', () => {
    expect(trainZoom(computeLayout(743, 1133), 5)).toBe(TRAIN_ZOOM.five);
    expect(trainZoom(computeLayout(744, 1133), 5)).toBe(TRAIN_ZOOM.tablet);
  });

  it('every level names a car count the zoom knows', () => {
    expect(new Set(LEVELS.map((l) => l.shown))).toEqual(new Set([4, MAX_SHOWN]));
  });
});
