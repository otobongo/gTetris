/**
 * Guards for the shared frame CSS that a browser test cannot see. Chromium reports env(safe-area-inset-*)
 * as 0, so the safe-area padding is checked in the source; the same goes for the reduced-motion fades,
 * which must carry !important to get past the blanket 0.01ms rule in global.css.
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Screen } from './Screen';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const UI = read('./ui.css');
const SCREENS = read('../../screens/screens.css');
const KIT = read('../../games/kit/kit.css');
const GLOBAL = read('../../styles/global.css');

/** The text between the brace that opens at `open` and its matching close. */
function block(css: string, open: number): string {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error('Unclosed block');
}

/** Top-level rules as [selector, body], skipping at-rules. */
function rules(css: string): [string, string][] {
  const out: [string, string][] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const selector = css.slice(i, open).trim();
    const body = block(css, open);
    if (!selector.startsWith('@')) out.push([selector, body]);
    i = open + body.length + 2;
  }
  return out;
}

/** The declarations of every rule whose selector list includes `selector` exactly, in source order. */
function ruleBody(css: string, selector: string): string {
  const found = rules(css).filter(([s]) => s.split(',').map((x) => x.trim().replace(/\s+/g, ' ')).includes(selector));
  if (!found.length) throw new Error(`No rule for ${selector}`);
  return found.map(([, body]) => body).join(';');
}

/** A shorthand's values, split on whitespace outside brackets. */
function sides(value: string): string[] {
  const out = [''];
  let depth = 0;
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (out[out.length - 1]) out.push('');
    } else out[out.length - 1] += ch;
  }
  return out.filter(Boolean);
}

function declaration(body: string, prop: string): string {
  const m = new RegExp(`(?:^|[;\\s])${prop}\\s*:([^;]+)`).exec(body);
  if (!m) throw new Error(`No ${prop} in ${body}`);
  return m[1].trim();
}

/** Every @media (prefers-reduced-motion: reduce) block's contents. */
function reduceBlocks(css: string): string[] {
  const out: string[] = [];
  const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
  for (let m = re.exec(css); m; m = re.exec(css)) out.push(block(css, m.index + m[0].length - 1));
  return out;
}

/**
 * Each 150ms fade inside the reduce blocks, as [selector, property, declaration]: the property is the
 * duration it sets (a shorthand counts as its -duration), one entry per selector in the rule's list.
 */
function fades(css: string): [string, string, string][] {
  return reduceBlocks(css).flatMap((b) =>
    rules(b).flatMap(([selectors, body]) =>
      body
        .split(';')
        .map((d) => d.trim())
        .filter((d) => /\b150ms\b/.test(d))
        .flatMap((d) => {
          const prop = /^(animation|transition)(?:-duration)?\s*:/.exec(d)?.[1];
          if (!prop) throw new Error(`A 150ms declaration that sets no duration: ${d}`);
          return selectors.split(',').map((sel): [string, string, string] => [sel.trim().replace(/\s+/g, ' '), `${prop}-duration`, d]);
        }),
    ),
  );
}

describe('tablet frame padding keeps clear of the safe areas', () => {
  const zoomed = (side: string) => new RegExp(`env\\(safe-area-inset-${side}\\)\\s*/\\s*var\\(--bw-zoom`);

  it.each([
    ['standard', ['20px', '16px', '18px', '16px']],
    ['roomy', ['24px', '20px', '22px', '20px']],
  ])('the %s frame takes the larger of its own padding and each inset, scaled back by the zoom', (name, mins) => {
    const padding = declaration(ruleBody(UI, `.bw-screen--tablet .bw-screen__frame--${name}`), 'padding');
    const each = sides(padding);
    expect(each).toHaveLength(4);
    ['top', 'right', 'bottom', 'left'].forEach((side, i) => {
      expect(each[i], side).toMatch(zoomed(side));
      expect(each[i], side).toMatch(new RegExp(`^max\\(${mins[i]},`));
    });
  });

  it('the home frame does the same on the top and sides and keeps the bottom at 0 for the list to scroll into', () => {
    const padding = declaration(ruleBody(UI, '.bw-screen--tablet .bw-screen__frame--home'), 'padding');
    const each = sides(padding);
    expect(each).toHaveLength(4);
    expect(each[0]).toMatch(zoomed('top'));
    expect(each[1]).toMatch(zoomed('right'));
    expect(each[2]).toBe('0');
    expect(each[3]).toMatch(zoomed('left'));
  });

  it("Home's list ends clear of the home indicator", () => {
    const padding = declaration(ruleBody(SCREENS, '.sc-home__scroll'), 'padding');
    expect(padding).toMatch(/env\(safe-area-inset-bottom/);
    expect(padding).toMatch(/var\(--bw-zoom/);
  });

  it('Screen hands its zoom to the CSS, 1 on a phone', () => {
    const html = renderToStaticMarkup(createElement(Screen, null, 'x'));
    expect(html).toMatch(/--bw-zoom:\s*1[;"]/);
  });
});

describe('a double tap anywhere is a tap, not a zoom', () => {
  it('the whole page uses touch-action: manipulation', () => {
    expect(declaration(ruleBody(GLOBAL, 'html'), 'touch-action')).toBe('manipulation');
  });

  it('pinch zoom is not switched off in the viewport meta', () => {
    const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
    expect(html).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(?![.\d])/);
  });
});

describe('under Reduce Motion the designed 150ms fades get past the blanket 0.01ms rule', () => {
  it('global.css keeps its safety net', () => {
    const [net] = reduceBlocks(GLOBAL);
    expect(net).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(net).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it.each([
    ['ui.css', UI, ['.bw-dot__fill', '.bw-levelcard', '.bw-appear']],
    ['screens.css', SCREENS, ['.sc-settle', '.sc-drop', '.sc-overlay__card']],
    ['kit.css', KIT, ['.bw-choice', ".bw-drag:not([style*='--drag-x'])"]],
  ])('every 150ms fade in %s has its duration marked !important', (_, css, selectors) => {
    const found = fades(css);
    const forced = new Set(found.filter(([, , d]) => /!important$/.test(d)).map(([sel, prop]) => `${sel} ${prop}`));
    // Each designed fade, and each one the brief names, reaches the screen at 150ms.
    for (const [sel, prop] of found) expect(forced, `${sel} ${prop}`).toContain(`${sel} ${prop}`);
    for (const sel of selectors) expect([...forced].some((f) => f.startsWith(`${sel} `)), sel).toBe(true);
  });
});
