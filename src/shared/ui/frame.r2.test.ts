/**
 * Round 2, decision 4: a viewport under 500px tall (an iPhone held sideways) uses the phone frame laid out
 * at a 667px floor, and the page scrolls instead of clipping the board. Guards for the frame CSS; the
 * browser journeys are in e2e/frame-short.spec.ts.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const UI = read('./ui.css');

/** Top-level rules as [selector, body], skipping at-rules (their contents are not top level). */
function rules(css: string): [string, string][] {
  const out: [string, string][] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    let depth = 0;
    let end = open;
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++;
      else if (css[end] === '}' && --depth === 0) break;
    }
    const selector = css.slice(i, open).trim();
    if (!selector.startsWith('@')) out.push([selector, css.slice(open + 1, end)]);
    i = end + 1;
  }
  return out;
}

const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

/** Every declaration for `selector` (exactly one of a rule's selectors), joined in source order. */
function body(selector: string): string {
  const found = rules(UI).filter(([s]) => s.split(',').map(norm).includes(selector));
  if (!found.length) throw new Error(`No rule for ${selector}`);
  return found.map(([, b]) => b).join(';');
}

/** The last value `prop` gets in `selector`'s rules. */
function value(selector: string, prop: string): string {
  const all = [...body(selector).matchAll(new RegExp(`(?:^|[;\\s])${prop}\\s*:([^;]+)`, 'g'))];
  if (!all.length) throw new Error(`No ${prop} for ${selector}`);
  return norm(all[all.length - 1][1]);
}

describe('short screens get the phone frame at a 667px floor (decision 4)', () => {
  const MAIN = '.bw-screen--short.bw-screen--fit-viewport';
  const FRAME = `${MAIN} .bw-screen__frame`;

  it('the floor is the shortest phone every game is measured at', () => {
    expect(value('.bw-screen--short', '--bw-short-floor')).toBe('667px');
  });

  it('a fit-viewport frame grows to its content from that floor, so nothing in it clips', () => {
    // Not auto: the screen's row would stretch an auto frame to exactly the floor, and a taller board (Brick
    // Calculator, an 8-piece Shape Sorter) would run on past the frame's bottom padding.
    expect(value(FRAME, 'height')).toBe('max-content');
    expect(value(FRAME, 'min-height')).toBe('max(100dvh, var(--bw-short-floor))');
    // align-items: flex-start would grow it too, but a board sized by a container query (Picture Builder) collapses.
    expect(body(MAIN)).not.toMatch(/align-items/);
    expect(body(FRAME)).not.toMatch(/overflow\s*:\s*hidden/);
  });

  it('Picture Builder keeps a frame of a set height, since its board sizes itself from the height it is given', () => {
    expect(value(`${FRAME}.pb-screen`, 'height')).toBe('var(--bw-short-floor)');
  });

  it('the frame is never a scroller of its own there, so a finger off a board scrolls the screen', () => {
    // Picture Builder's short-phone rule makes its frame a scroller with overscroll contained, which would
    // swallow every page scroll; this selector outranks a game's one-class rule.
    expect(value(FRAME, 'overflow')).toBe('visible');
  });

  it('the screen itself is the vertical scroller and never scrolls sideways', () => {
    expect(value(MAIN, 'overflow-y')).toBe('auto');
    expect(value(MAIN, 'overflow-x')).toBe('hidden');
  });

  it('the screen holds what is drawn in it, so a read-aloud line never stretches the page behind it', () => {
    // A visually hidden line is placed from the nearest positioned box; without one it counts on the page.
    expect(value(MAIN, 'position')).toBe('relative');
  });

  it('a list hands a swipe on to the screen when it reaches its end, so a finger on it gets to the bottom', () => {
    expect(value('.bw-screen--short .sc-scroll', 'overscroll-behavior')).toBe('auto');
  });

  it('a play area never shrinks under its content: the frame grows and the screen scrolls', () => {
    expect(value('.bw-screen--short .bw-play__body', 'flex-shrink')).toBe('0');
  });

  it('Home keeps the viewport height, so its own list still scrolls', () => {
    expect(value(`${MAIN} .bw-screen__frame--home`, 'height')).toBe('100dvh');
    expect(value(`${MAIN} .bw-screen__frame--home`, 'min-height')).toBe('0');
  });

  it.each(['standard', 'roomy', 'home'])('the %s frame adds a side inset only where its centred margin does not already clear it', (name) => {
    for (const side of ['left', 'right']) {
      const v = value(`.bw-screen--short .bw-screen__frame--${name}`, `padding-${side}`);
      expect(v, side).toContain(`env(safe-area-inset-${side})`);
      expect(v, side).toContain('min(100%, var(--bw-phone-max))');
    }
  });

  it('no short rule touches touch-action (boards keep none, so a stroke never scrolls) and none uses a dash in its comments', () => {
    for (const [s, b] of rules(UI)) if (s.includes('bw-screen--short')) expect(b, s).not.toMatch(/touch-action/);
    expect(readFileSync(new URL('./ui.css', import.meta.url), 'utf8')).not.toMatch(/[\u2013\u2014]/);
  });
});
