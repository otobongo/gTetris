/**
 * Round 2 of the usability pass, the shared parts other batches build on (decisions 8, 19, 25):
 * the stuck offer's cue on IconButton, the capped-star mark beside PuzzleDots, and the new sticker on
 * LevelCard. Each new prop leaves today's markup byte for byte when it is absent: the strings below were
 * saved from the components before the change.
 *
 * The cue's effect (one chime per mount, the ring gone after 2 s) runs in a real React root on a small
 * stand-in page, since effects never run in static markup. Only the outside boundaries are stand-ins:
 * the document, the window and the clock (Vitest's fake timers).
 */
import { readFileSync } from 'node:fs';
import { StrictMode, act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STICKERS, stickerCells } from '../../screens/logic/stickers';
import { progressStore } from '../progress';
import { sfx } from '../sound';
import { CUE_MS, IconButton, type IconButtonProps } from './IconButton';
import { LevelCard, type LevelCardProps } from './LevelCard';
import { PuzzleDots, type PuzzleDotsProps } from './PuzzleDots';
import { Screen } from './Screen';

/** Markup saved from the components before round 2 (fix/usability-pass 3596724). */
const BEFORE = {
  icon: "<button type=\"button\" class=\"bw-iconbtn\" data-tone=\"green\" aria-label=\"New puzzle\" title=\"New puzzle\"><svg width=\"26\" height=\"26\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 8h12M13 5l3 3-3 3\"></path><path d=\"M20 16H8M11 13l-3 3 3 3\"></path></svg></button>",
  iconBadge: "<button type=\"button\" class=\"bw-iconbtn\" data-tone=\"purple\" aria-label=\"Hint (2)\" title=\"Hint\"><svg width=\"26\" height=\"26\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"></svg><span class=\"bw-iconbtn__badge\" aria-hidden=\"true\">2</span></button>",
  iconLink: "<a class=\"bw-iconbtn\" data-tone=\"purple\" href=\"#/\" aria-label=\"Home\" title=\"Home\"><svg width=\"26\" height=\"26\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M4 11l8-7 8 7\"></path><path d=\"M6 10v10h12V10\"></path></svg></a>",
  dots: "<div class=\"bw-dots\" role=\"img\" aria-label=\"Puzzle 3 of 4. 2 solved.\"><span class=\"bw-dot is-solved\"><span class=\"bw-dot__fill\"></span></span><span class=\"bw-dot is-solved\"><span class=\"bw-dot__fill\"></span></span><span class=\"bw-dot is-current\"><span class=\"bw-dot__fill\"></span></span><span class=\"bw-dot\"><span class=\"bw-dot__fill\"></span></span></div>",
  dotsWord: "<div class=\"bw-dots x\" role=\"img\" aria-label=\"Word 2 of 4. 1 built.\"><span class=\"bw-dot is-solved\"><span class=\"bw-dot__fill\"></span></span><span class=\"bw-dot is-current\"><span class=\"bw-dot__fill\"></span></span><span class=\"bw-dot\"><span class=\"bw-dot__fill\"></span></span><span class=\"bw-dot\"><span class=\"bw-dot__fill\"></span></span></div>",
  card: "<div class=\"bw-levelcard-scrim\"><div class=\"bw-levelcard\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"_R_0_-title\" aria-describedby=\"_R_0_-fact\"><h2 id=\"_R_0_-title\" class=\"bw-levelcard__title\">You finished Level 3</h2><div class=\"bw-levelcard__stars\" role=\"img\" aria-label=\"2 of 3 stars\"><span class=\"is-on\"><svg width=\"48\" height=\"48\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z\" fill=\"currentColor\" stroke=\"none\"></path></svg></span><span class=\"is-on\"><svg width=\"48\" height=\"48\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z\" fill=\"currentColor\" stroke=\"none\"></path></svg></span><span><svg width=\"48\" height=\"48\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z\" fill=\"currentColor\" stroke=\"none\"></path></svg></span></div><p id=\"_R_0_-fact\" class=\"bw-levelcard__fact\">4 puzzles in 31 moves.</p><p class=\"bw-levelcard__line\">3 stars: 28 moves or fewer.</p><p class=\"bw-levelcard__line\">Using a hint caps the level at 2 stars.</p><div class=\"bw-levelcard__actions\"><button data-autofocus=\"true\" type=\"button\" class=\"bw-press bw-press--lg bw-press--block\" data-tone=\"green\"><span class=\"bw-press__label\"><span class=\"bw-press__text\">Play Level 4</span></span></button><a href=\"#/\" class=\"bw-press bw-press--md bw-press--block bw-levelcard__secondary\" data-tone=\"purple\"><span class=\"bw-press__label\"><span class=\"bw-press__text\">Back to games</span></span></a></div></div></div>",
  cardTotal: "<div class=\"bw-levelcard-scrim\"><div class=\"bw-levelcard\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"_R_0_-title\" aria-describedby=\"_R_0_-fact\"><h2 id=\"_R_0_-title\" class=\"bw-levelcard__title\">You finished every level!</h2><div class=\"bw-levelcard__total\" role=\"img\" aria-label=\"78 of 93 stars\"><span class=\"bw-levelcard__total-star\"><svg width=\"48\" height=\"48\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\" focusable=\"false\"><path d=\"M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z\" fill=\"currentColor\" stroke=\"none\"></path></svg></span><span class=\"bw-levelcard__total-count\" aria-hidden=\"true\">78 of 93</span></div><p id=\"_R_0_-fact\" class=\"bw-levelcard__fact\">31 levels, 78 of 93 stars.</p><p class=\"bw-levelcard__line\">A grown-up can pick a level to play again.</p><div class=\"bw-levelcard__actions\"><a data-autofocus=\"true\" href=\"#/\" class=\"bw-press bw-press--lg bw-press--block\" data-tone=\"green\"><span class=\"bw-press__label\"><span class=\"bw-press__text\">Back to games</span></span></a></div></div></div>",
} as const;

const css = readFileSync(new URL('./ui.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the first top-level rule whose selector list is exactly `selector`. */
function rule(source: string, selector: string): string {
  const re = new RegExp(`(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
  const m = re.exec(source);
  if (!m) throw new Error(`No rule for ${selector}`);
  return m[2];
}

/** The contents of every @media (prefers-reduced-motion: reduce) block. */
function reduced(source: string): string {
  const out: string[] = [];
  const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < source.length && depth; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
    }
    out.push(source.slice(m.index + m[0].length, i - 1));
  }
  return out.join('\n');
}

const icon = (props: Partial<IconButtonProps> = {}) =>
  renderToStaticMarkup(createElement(IconButton, { icon: 'swap', label: 'New puzzle', variant: 'green', onClick: () => {}, ...props }));
const dots = (props: PuzzleDotsProps) => renderToStaticMarkup(createElement(PuzzleDots, props));
const CARD: LevelCardProps = {
  title: 'You finished Level 3',
  stars: 2,
  fact: '4 puzzles in 31 moves.',
  rule: '3 stars: 28 moves or fewer.',
  cap: 'Using a hint caps the level at 2 stars.',
  primary: { label: 'Play Level 4', onClick: () => {} },
  secondary: { label: 'Back to games', href: '#/' },
  onClose: () => {},
};
const card = (props: Partial<LevelCardProps> = {}) => renderToStaticMarkup(createElement(LevelCard, { ...CARD, ...props }));

const ICE_KEY = STICKERS.find((s) => s.id === 'e3')!;
const iceKey = { name: ICE_KEY.name, cells: stickerCells(ICE_KEY) };

/* ---------- Decision 8: the stuck offer's cue ---------- */

describe('IconButton cue (decision 8)', () => {
  it('without cue the markup is exactly what it was', () => {
    expect(icon()).toBe(BEFORE.icon);
    expect(icon({ cue: false })).toBe(BEFORE.icon);
    expect(icon({ icon: 'bulb', label: 'Hint', badge: 2, variant: undefined })).toBe(BEFORE.iconBadge);
    expect(renderToStaticMarkup(createElement(IconButton, { icon: 'home', label: 'Home', href: '#/' }))).toBe(BEFORE.iconLink);
  });

  it('with cue the button itself carries is-cue when it first draws, and nothing else changes', () => {
    const html = icon({ cue: true });
    expect(html).toMatch(/^<button type="button" class="bw-iconbtn is-cue" data-tone="green" aria-label="New puzzle" title="New puzzle">/);
    expect(html.replace(' is-cue', '')).toBe(BEFORE.icon);
    expect(html.match(/is-cue/g)).toHaveLength(1);
  });

  it('rings for 2 seconds', () => {
    expect(CUE_MS).toBe(2000);
  });

  it('the ring is a static 4px accent outline: no transition, no animation', () => {
    const body = rule(css, '.bw-iconbtn.is-cue');
    expect(body).toMatch(/outline:\s*4px solid var\(--bw-accent\)/);
    expect(body).toMatch(/outline-offset:\s*0/);
    expect(body).not.toMatch(/transition|animation/);
    expect(css).not.toMatch(/is-cue[^{]*\{[^}]*(transition|animation)/);
  });

  it('a keyboard focus ring still wins over the cue ring', () => {
    expect(css.indexOf('.bw-iconbtn.is-cue')).toBeLessThan(css.indexOf('.bw-iconbtn:focus-visible'));
  });

  it('sfx.offer is a chime that never throws, with Sounds off or on and no audio in the page', () => {
    expect(typeof sfx.offer).toBe('function');
    progressStore.setSetting('sound', false);
    expect(() => sfx.offer()).not.toThrow();
    progressStore.setSetting('sound', true);
    expect(() => sfx.offer()).not.toThrow();
  });
});

/* ---------- The cue's effect, in a real React root ---------- */

interface Node0 {
  nodeType: number;
  nodeName: string;
  tagName?: string;
  namespaceURI?: string;
  ownerDocument: unknown;
  parentNode: Node0 | null;
  childNodes: Node0[];
  attrs: Map<string, string>;
  style: Record<string, string> & { setProperty(k: string, v: string): void; removeProperty(k: string): void };
  textContent: string;
  nodeValue?: string;
}

/** A page just large enough for React to draw a button with an icon into. */
function makePage() {
  const listeners = { addEventListener() {}, removeEventListener() {} };
  const focused: Node0[] = [];
  const doc: Record<string, unknown> = { ...listeners, activeElement: null, defaultView: null, body: null, documentElement: null };
  const node = (nodeType: number, name: string, ns = 'http://www.w3.org/1999/xhtml'): Node0 => {
    const style = { setProperty(k: string, v: string) { (style as Record<string, unknown>)[k] = v; }, removeProperty(k: string) { delete (style as Record<string, unknown>)[k]; } } as Node0['style'];
    const n: Node0 & Record<string, unknown> = {
      ...listeners,
      nodeType,
      nodeName: name.toUpperCase(),
      tagName: name.toUpperCase(),
      namespaceURI: ns,
      ownerDocument: doc,
      parentNode: null,
      childNodes: [],
      attrs: new Map(),
      style,
      textContent: '',
      focus() { focused.push(n); },
      setAttribute(k: string, v: unknown) { n.attrs.set(k, String(v)); },
      removeAttribute(k: string) { n.attrs.delete(k); },
      getAttribute(k: string) { return n.attrs.get(k) ?? null; },
      hasAttribute(k: string) { return n.attrs.has(k); },
      setAttributeNS(_ns: string, k: string, v: unknown) { n.attrs.set(k, String(v)); },
      appendChild(c: Node0) { c.parentNode = n; n.childNodes.push(c); return c; },
      insertBefore(c: Node0, ref: Node0 | null) { c.parentNode = n; const i = ref ? n.childNodes.indexOf(ref) : -1; if (i < 0) n.childNodes.push(c); else n.childNodes.splice(i, 0, c); return c; },
      removeChild(c: Node0) { n.childNodes = n.childNodes.filter((x) => x !== c); c.parentNode = null; return c; },
      get firstChild() { return n.childNodes[0] ?? null; },
      get className() { return n.attrs.get('class') ?? ''; },
      set className(v: string) { n.attrs.set('class', v); },
    };
    return n;
  };
  Object.assign(doc, {
    nodeType: 9,
    createElement: (t: string) => node(1, t),
    createElementNS: (ns: string, t: string) => node(1, t, ns),
    createTextNode: (text: string) => ({ ...node(3, '#text'), nodeValue: text, textContent: text }),
  });
  const win = {
    ...listeners,
    document: doc,
    event: undefined,
    HTMLIFrameElement: class {},
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  };
  doc.defaultView = win;
  const container = node(1, 'div');
  return { doc, win, container, focused };
}

describe('the cue in a running app (decision 8)', () => {
  let page: ReturnType<typeof makePage>;
  let offers: number;
  const roots: (() => void)[] = [];

  beforeEach(() => {
    page = makePage();
    offers = 0;
    vi.stubGlobal('window', page.win);
    vi.stubGlobal('document', page.doc);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    vi.spyOn(sfx, 'offer').mockImplementation(() => void offers++);
    vi.spyOn(sfx, 'tap').mockImplementation(() => {});
  });

  afterEach(() => {
    roots.splice(0).forEach((u) => u());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function mount(el: ReactElement) {
    const root = createRoot(page.container as unknown as Element);
    act(() => root.render(el));
    let on = true;
    const unmount = () => {
      if (on) act(() => root.unmount());
      on = false;
    };
    roots.push(unmount);
    return { render: (next: ReactElement) => act(() => root.render(next)), unmount };
  }
  const button = () => page.container.childNodes[0];
  const classes = () => button()?.attrs.get('class') ?? '';
  const offer = (cue?: boolean) => createElement(IconButton, { icon: 'swap', label: 'New puzzle', variant: 'green', onClick: () => {}, cue });

  it('one chime when the offer appears, even under StrictMode, and the ring goes after 2 s', () => {
    mount(createElement(StrictMode, null, offer(true)));
    expect(offers).toBe(1);
    expect(classes()).toContain('is-cue');
    act(() => void vi.advanceTimersByTime(CUE_MS - 1));
    expect(classes()).toContain('is-cue');
    act(() => void vi.advanceTimersByTime(1));
    expect(classes()).not.toContain('is-cue');
    expect(offers).toBe(1);
  });

  it('each new appearance cues again; cue turning on later does nothing', () => {
    const first = mount(offer(true));
    expect(offers).toBe(1);
    first.unmount();
    mount(offer(true));
    expect(offers).toBe(2);
    roots.splice(0).forEach((u) => u());

    const late = mount(offer(false));
    expect(classes()).not.toContain('is-cue');
    late.render(offer(true));
    expect(offers).toBe(2);
    expect(classes()).not.toContain('is-cue');
  });

  it('never takes focus', () => {
    mount(offer(true));
    act(() => void vi.advanceTimersByTime(CUE_MS));
    expect(page.focused).toEqual([]);
  });

  it('a button that unmounts mid-ring leaves no timer behind', () => {
    const m = mount(offer(true));
    m.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Screen marks a short viewport (a phone held sideways) and only that one (decision 4)', () => {
    const mainClass = (w: number, h: number) => {
      Object.assign(page.win, { innerWidth: w, innerHeight: h });
      const m = mount(createElement(Screen, null, 'x'));
      const cls = page.container.childNodes[0]?.attrs.get('class') ?? '';
      m.unmount();
      return cls;
    };
    expect(mainClass(844, 390)).toBe('bw-screen bw-screen--phone bw-screen--short bw-screen--fit-viewport');
    expect(mainClass(667, 375)).toBe('bw-screen bw-screen--phone bw-screen--short bw-screen--fit-viewport');
    expect(mainClass(390, 844)).toBe('bw-screen bw-screen--phone bw-screen--fit-viewport');
    expect(mainClass(834, 1194)).toBe('bw-screen bw-screen--tablet bw-screen--fit-viewport');
  });
});

/* ---------- Decision 25: the capped-star mark ---------- */

describe('PuzzleDots capped (decision 25)', () => {
  const LABEL = 'Hint used. Up to 2 stars.';
  const dotsPart = (html: string) => /<div class="bw-dots[^"]*" role="img"[^>]*>.*?<\/div>/.exec(html)?.[0];

  it('without capped the markup is exactly what it was', () => {
    expect(dots({ solved: 2 })).toBe(BEFORE.dots);
    expect(dots({ solved: 2, capped: false })).toBe(BEFORE.dots);
    expect(dots({ solved: 1, puzzle: 2, noun: 'word', className: 'x' })).toBe(BEFORE.dotsWord);
  });

  it('capped adds a mark after the dots, named in words, and leaves the dots and their name as they are', () => {
    const html = dots({ solved: 2, capped: true });
    expect(dotsPart(html)).toBe(BEFORE.dots);
    expect(html).toContain(`<span class="bw-dots__cap" role="img" aria-label="${LABEL}">`);
    expect(html.indexOf('bw-dots__cap')).toBeGreaterThan(html.indexOf(BEFORE.dots));
    // One image for the dots and one for the mark; the star and its 2 are hidden inside the mark's name.
    expect(html.match(/role="img"/g)).toHaveLength(2);
    expect(dotsPart(dots({ solved: 1, puzzle: 2, noun: 'word', className: 'x', capped: true }))).toBe(BEFORE.dotsWord);
  });

  it('draws a 20px outline star with a 2 in it', () => {
    const html = dots({ solved: 0, capped: true });
    const cap = html.slice(html.indexOf('bw-dots__cap'));
    expect(cap).toMatch(/<svg[^>]*width="20" height="20"[^>]*aria-hidden="true"/);
    expect(cap).toMatch(/fill="none"/);
    expect(cap).toMatch(/>2<\/span>/);
  });

  it('the label has no dashes and is plain', () => {
    expect(LABEL).not.toMatch(/[-–—]/);
    expect(dots({ solved: 2, capped: true })).not.toMatch(/[–—]/);
  });

  it('the mark is styled from tokens: 2px stroke and the 11px numeral in --bw-text-2, and it is static', () => {
    const body = rule(css, '.bw-dots__cap');
    expect(body).toMatch(/color:\s*var\(--bw-text-2\)/);
    expect(body).not.toMatch(/transition|animation/);
    expect(rule(css, '.bw-dots__cap-n')).toMatch(/font-size:\s*11px/);
    expect(rule(css, '.bw-dots__cap-n')).toMatch(/font-weight:\s*800/);
  });
});

/* ---------- Decision 19: the new sticker on the level card ---------- */

describe('LevelCard sticker (decision 19)', () => {
  it('without a sticker the markup is exactly what it was', () => {
    expect(card()).toBe(BEFORE.card);
    expect(
      card({
        title: 'You finished every level!',
        stars: undefined,
        total: { stars: 78, max: 93 },
        fact: '31 levels, 78 of 93 stars.',
        rule: undefined,
        cap: undefined,
        note: 'A grown-up can pick a level to play again.',
        primary: { label: 'Back to games', href: '#/' },
        secondary: undefined,
      }),
    ).toBe(BEFORE.cardTotal);
  });

  it('shows the 5 x 5 mosaic, bricks for the filled cells, and names the sticker', () => {
    const html = card({ sticker: iceKey });
    const row = /<div class="bw-levelcard__sticker" id="([^"]+)-sticker">(.*?)<\/div><p id="\1-fact"/.exec(html);
    expect(row, 'the row sits right before the fact line').not.toBeNull();
    const inner = row![2];
    const cells = /<span class="bw-levelcard__mosaic" aria-hidden="true">(.*?)<\/span><p/.exec(inner)![1];
    const filled = iceKey.cells.filter(Boolean).length;
    expect(cells.match(/class="bw-brick bw-brick--studs"/g)).toHaveLength(filled);
    expect(cells.match(/<span class="bw-levelcard__cell"><\/span>/g)).toHaveLength(25 - filled);
    expect(cells.match(/data-brick="teal"/g)).toHaveLength(filled);
    expect(cells).toContain('--stud:13px');
    expect(cells).toContain('border-radius:2px');
    expect(inner).toContain('<p class="bw-levelcard__sticker-name">New sticker: Ice key.</p>');
  });

  it('the dialog is described by the fact line and the sticker, and the stars come before it', () => {
    const html = card({ sticker: iceKey });
    expect(html).toMatch(/aria-labelledby="([^"]+)-title" aria-describedby="\1-fact \1-sticker"/);
    expect(html.indexOf('bw-levelcard__stars')).toBeLessThan(html.indexOf('bw-levelcard__sticker'));
    const total = card({ sticker: iceKey, stars: undefined, total: { stars: 9, max: 93 } });
    expect(total.indexOf('bw-levelcard__total')).toBeLessThan(total.indexOf('bw-levelcard__sticker'));
  });

  it('a sticker with fewer than 25 cells still draws a 5 x 5 square', () => {
    const html = card({ sticker: { name: 'Odd', cells: ['red', null] } });
    expect(html.match(/class="bw-brick /g)).toHaveLength(1);
    expect(html.match(/<span class="bw-levelcard__cell"><\/span>/g)).toHaveLength(24);
  });

  it('the mosaic is 69px square: 13px cells and 1px gaps; the name is 18px/800 in --bw-text', () => {
    const mosaic = rule(css, '.bw-levelcard__mosaic');
    expect(mosaic).toMatch(/grid-template-columns:\s*repeat\(5,\s*13px\)/);
    expect(mosaic).toMatch(/grid-auto-rows:\s*13px/);
    expect(mosaic).toMatch(/gap:\s*1px/);
    const name = rule(css, '.bw-levelcard__sticker-name');
    expect(name).toMatch(/font-size:\s*var\(--bw-fs-panel\)/);
    expect(name).toMatch(/font-weight:\s*800/);
    expect(name).toMatch(/color:\s*var\(--bw-text\)/);
  });

  it('settles once: scale 0.92 to 1 and a fade over 320ms ease-out, and only a 150ms fade under Reduce Motion', () => {
    expect(css).toMatch(/@keyframes bw-sticker-in\s*\{\s*from\s*\{\s*opacity:\s*0;\s*transform:\s*scale\(0\.92\);?\s*\}\s*\}/);
    expect(rule(css, '.bw-levelcard__sticker')).toMatch(/animation:\s*bw-sticker-in 320ms ease-out/);
    const r = reduced(css);
    expect(r).toMatch(/\.bw-levelcard__sticker\s*\{\s*animation:\s*bw-fade-in 150ms linear;?\s*\}/);
    expect(r).toMatch(/\.bw-levelcard__sticker[^{]*\{[^}]*animation-duration:\s*150ms !important/);
  });
});
