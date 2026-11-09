/**
 * The kit games' Play screens on a page (six-games brief 3.1, 4.1 to 4.3, 7.2, 8, 9, 10.1, 10.2): every
 * state the Mixer, Sorter and Numbers boards draw, reached the way a child reaches it (taps, keys and
 * pointer drags on the real components, through React's own event system), with the slips that count
 * for stars and for the stuck offer, the offer and the swap, the sounds, speech only after a tap, the
 * accessible names from brief 9, and the kit's focus rules.
 *
 * There is no browser here, so the page is a small stand-in DOM written below: elements, text, focus,
 * inert, a selector engine for the selectors the app uses, and event dispatch with capture and bubble.
 * Only true outside boundaries are stand-ins: the page, the browser's voice (speechSynthesis), the sound
 * output (the sfx calls) and the clock (Vitest's fake timers). The app's own progress store, kit hook
 * and games run as they are.
 *
 * The stand-in lives in this file because the batch's rule lets the test agent touch only test files;
 * it is the one place every interactive Play-screen suite shares.
 */
import { act, createElement, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { activePlayer, emptyState, progressStore, runOf, type AgeBand, type LevelRun } from '../shared/progress';
import { sfx } from '../shared/sound';
import { LEVEL_CARD_DELAY_MS, type LevelCardProps } from '../shared/ui/LevelCard';
import { OFFER_LINE, READ_HELP_ALOUD, SWAPPED_LINE } from './kit/copy';
import { CHOICE_WRONG_MS, ChoiceRow } from './kit/ChoiceRow';
import type { LevelRunApi } from './kit/levelRun';
import { FIRST_CONTROL, PlayScreen } from './kit/PlayScreen';
import { TICK_MS } from './kit/useLevelRun';
import MixerApp from './mixer/MixerApp';
import { RECIPES, RESULTS, SAME_TEXT, colorWord, mixOf, type PaintId, type ResultId } from './mixer/colors';
import { puzzle as mixerPuzzle } from './mixer/puzzles';
import NumbersApp from './numbers/NumbersApp';
import { inversions, swapKind } from './numbers/order';
import { puzzle as numbersPuzzle } from './numbers/puzzles';
import SorterApp from './sorter/SorterApp';
import { puzzle as sorterPuzzle, type SorterPiece } from './sorter/puzzles';
import { SHAPE_BADGE, SHAPE_FACT } from './sorter/shapes';

/* =====================================================================================================
 * A stand-in page
 * ===================================================================================================== */

const HTML_NS = 'http://www.w3.org/1999/xhtml';
const ELEMENT = 1;
const TEXT = 3;
const DOCUMENT = 9;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Listener {
  fn: (e: FakeEvent) => void;
  capture: boolean;
}

/** An event as the browser hands it to a listener; React reads the fields it needs from it. */
interface FakeEvent {
  type: string;
  target: FakeNode;
  currentTarget: FakeNode | null;
  bubbles: boolean;
  cancelable: boolean;
  defaultPrevented: boolean;
  eventPhase: number;
  timeStamp: number;
  isTrusted: boolean;
  stopped: boolean;
  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
  [field: string]: unknown;
}

class FakeNode {
  parentNode: FakeNode | null = null;
  readonly childNodes: FakeNode[] = [];
  readonly listeners = new Map<string, Listener[]>();

  constructor(
    public ownerDocument: FakeDocument | null,
    public readonly nodeType: number,
    public readonly nodeName: string,
  ) {}

  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }
  get lastChild(): FakeNode | null {
    return this.childNodes[this.childNodes.length - 1] ?? null;
  }
  get nextSibling(): FakeNode | null {
    const p = this.parentNode;
    return p ? (p.childNodes[p.childNodes.indexOf(this) + 1] ?? null) : null;
  }
  get previousSibling(): FakeNode | null {
    const p = this.parentNode;
    return p ? (p.childNodes[p.childNodes.indexOf(this) - 1] ?? null) : null;
  }
  get parentElement(): FakeElement | null {
    return this.parentNode instanceof FakeElement ? this.parentNode : null;
  }

  appendChild<T extends FakeNode>(child: T): T {
    child.parentNode?.removeChild(child);
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }
  insertBefore<T extends FakeNode>(child: T, before: FakeNode | null): T {
    if (!before) return this.appendChild(child);
    child.parentNode?.removeChild(child);
    const at = this.childNodes.indexOf(before);
    if (at < 0) throw new Error('insertBefore: not a child');
    this.childNodes.splice(at, 0, child);
    child.parentNode = this;
    return child;
  }
  removeChild<T extends FakeNode>(child: T): T {
    const at = this.childNodes.indexOf(child);
    if (at < 0) throw new Error('removeChild: not a child');
    this.childNodes.splice(at, 1);
    child.parentNode = null;
    // As in a browser, focus inside a removed subtree goes back to the body.
    const doc = this.ownerDocument ?? (this as unknown as FakeDocument);
    if (doc.focused && child.contains(doc.focused)) doc.focused = null;
    return child;
  }
  contains(other: FakeNode | null): boolean {
    for (let n = other; n; n = n.parentNode) if (n === this) return true;
    return false;
  }
  getRootNode(): FakeNode {
    let n: FakeNode = this;
    while (n.parentNode) n = n.parentNode;
    return n;
  }
  get isConnected(): boolean {
    return this.getRootNode().nodeType === DOCUMENT;
  }

  get textContent(): string {
    return this.childNodes.map((c) => c.textContent).join('');
  }
  set textContent(value: string | null) {
    for (const c of [...this.childNodes]) this.removeChild(c);
    if (value) this.appendChild(new FakeText(this.ownerDocument, String(value)));
  }

  addEventListener(type: string, fn: (e: FakeEvent) => void, options?: boolean | { capture?: boolean }) {
    const capture = typeof options === 'boolean' ? options : !!options?.capture;
    const list = this.listeners.get(type) ?? [];
    if (!list.some((l) => l.fn === fn && l.capture === capture)) list.push({ fn, capture });
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, fn: (e: FakeEvent) => void, options?: boolean | { capture?: boolean }) {
    const capture = typeof options === 'boolean' ? options : !!options?.capture;
    const list = this.listeners.get(type);
    if (list) this.listeners.set(type, list.filter((l) => l.fn !== fn || l.capture !== capture));
  }
}

class FakeText extends FakeNode {
  constructor(
    doc: FakeDocument | null,
    public data: string,
  ) {
    super(doc, TEXT, '#text');
  }
  get nodeValue(): string {
    return this.data;
  }
  set nodeValue(v: string) {
    this.data = v;
  }
  override get textContent(): string {
    return this.data;
  }
  override set textContent(v: string | null) {
    this.data = v ?? '';
  }
}

/** The style object React writes to: custom properties through setProperty, the rest as fields. */
function makeStyle() {
  const custom = new Map<string, string>();
  return Object.assign(Object.create(null) as Record<string, unknown>, {
    setProperty: (name: string, value: string) => void (value === '' ? custom.delete(name) : custom.set(name, String(value))),
    removeProperty: (name: string) => {
      const was = custom.get(name) ?? '';
      custom.delete(name);
      return was;
    },
    getPropertyValue: (name: string) => custom.get(name) ?? '',
  });
}

class FakeElement extends FakeNode {
  readonly attrs = new Map<string, string>();
  readonly style = makeStyle();
  readonly tagName: string;
  readonly localName: string;
  /** Where the element sits on screen, for drags and hit tests; tests set it. */
  box: Box | null = null;
  readonly captured = new Set<number>();
  scrollLeft = 0;
  scrollTop = 0;
  onclick: unknown = undefined;

  constructor(
    doc: FakeDocument,
    tag: string,
    public readonly namespaceURI: string,
  ) {
    super(doc, ELEMENT, namespaceURI === HTML_NS ? tag.toUpperCase() : tag);
    this.tagName = this.nodeName;
    this.localName = tag.toLowerCase();
  }

  setAttribute(name: string, value: unknown) {
    this.attrs.set(name, String(value));
    // A subtree turned inert loses focus, as a browser's focus fixup does.
    const doc = this.ownerDocument!;
    if (name === 'inert' && doc.focused && this.contains(doc.focused)) doc.focused = null;
    if (name === 'disabled' && doc.focused === this) doc.focused = null;
  }
  setAttributeNS(_ns: string | null, name: string, value: unknown) {
    this.setAttribute(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.attrs.has(name);
  }
  removeAttribute(name: string) {
    this.attrs.delete(name);
  }
  removeAttributeNS(_ns: string | null, name: string) {
    this.attrs.delete(name);
  }
  get id(): string {
    return this.getAttribute('id') ?? '';
  }
  get className(): string {
    return this.getAttribute('class') ?? '';
  }
  get classList() {
    const list = this.className.split(/\s+/).filter(Boolean);
    return { contains: (c: string) => list.includes(c) };
  }
  get dataset(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.attrs) if (k.startsWith('data-')) out[k.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
    return out;
  }
  get children(): FakeElement[] {
    return this.childNodes.filter((c): c is FakeElement => c instanceof FakeElement);
  }

  focus() {
    this.ownerDocument!.focus(this);
  }
  blur() {
    if (this.ownerDocument!.focused === this) this.ownerDocument!.focused = null;
  }
  matches(selector: string): boolean {
    return matchesList(this, parseList(selector));
  }
  closest(selector: string): FakeElement | null {
    const list = parseList(selector);
    for (let n: FakeNode | null = this; n; n = n.parentNode) if (n instanceof FakeElement && matchesList(n, list)) return n;
    return null;
  }
  querySelectorAll(selector: string): FakeElement[] {
    const list = parseList(selector);
    return descendants(this).filter((el) => matchesList(el, list));
  }
  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  getBoundingClientRect() {
    const b = this.box ?? { left: 0, top: 0, width: 0, height: 0 };
    return { left: b.left, top: b.top, right: b.left + b.width, bottom: b.top + b.height, x: b.left, y: b.top, width: b.width, height: b.height };
  }
  setPointerCapture(id: number) {
    this.captured.add(id);
  }
  hasPointerCapture(id: number) {
    return this.captured.has(id);
  }
  releasePointerCapture(id: number) {
    this.captured.delete(id);
  }
}

class FakeDocument extends FakeNode {
  readonly documentElement: FakeElement;
  readonly head: FakeElement;
  readonly body: FakeElement;
  focused: FakeElement | null = null;
  visibilityState: 'visible' | 'hidden' = 'visible';
  /** True while the test drives the page from the keyboard: `:focus-visible` matches the focused element then. */
  keyboard = false;
  defaultView: unknown = null;

  constructor() {
    super(null, DOCUMENT, '#document');
    this.documentElement = this.appendChild(new FakeElement(this, 'html', HTML_NS));
    this.head = this.documentElement.appendChild(new FakeElement(this, 'head', HTML_NS));
    this.body = this.documentElement.appendChild(new FakeElement(this, 'body', HTML_NS));
  }

  get activeElement(): FakeElement {
    return this.focused ?? this.body;
  }
  createElement(tag: string) {
    return new FakeElement(this, tag, HTML_NS);
  }
  createElementNS(ns: string, tag: string) {
    return new FakeElement(this, tag, ns);
  }
  createTextNode(text: string) {
    return new FakeText(this, text);
  }
  createComment() {
    return new FakeNode(this, 8, '#comment');
  }

  /** focus(), as a browser allows it: a connected, focusable element outside anything inert. */
  focus(el: FakeElement) {
    if (!el.isConnected || isInert(el) || !isFocusable(el)) return;
    this.focused = el;
  }

  /** Every element under a screen point, topmost first. */
  elementsFromPoint(x: number, y: number): FakeElement[] {
    return descendants(this.documentElement)
      .filter((el) => el.box && x >= el.box.left && x <= el.box.left + el.box.width && y >= el.box.top && y <= el.box.top + el.box.height)
      .reverse();
  }
}

function descendants(root: FakeNode): FakeElement[] {
  const out: FakeElement[] = [];
  const walk = (n: FakeNode) => {
    for (const c of n.childNodes) {
      if (c instanceof FakeElement) {
        out.push(c);
        walk(c);
      }
    }
  };
  walk(root);
  return out;
}

const isInert = (el: FakeElement) => !!el.closest('[inert]');

function isFocusable(el: FakeElement): boolean {
  if (el.hasAttribute('tabindex')) return true;
  if (el.localName === 'button' || el.localName === 'input' || el.localName === 'select' || el.localName === 'textarea') return !el.hasAttribute('disabled');
  return el.localName === 'a' && el.hasAttribute('href');
}

/* ---------- A selector engine for the selectors the app and these tests use ---------- */

type Simple =
  | { kind: 'tag'; name: string }
  | { kind: 'class'; name: string }
  | { kind: 'id'; name: string }
  | { kind: 'attr'; name: string; value: string | null }
  | { kind: 'not'; list: Compound[][] }
  | { kind: 'pseudo'; name: string };
type Compound = Simple[];

const parsed = new Map<string, Compound[][]>();

/** "a, b c" into a list of complex selectors, each a list of compounds joined by descendant combinators. */
function parseList(selector: string): Compound[][] {
  const hit = parsed.get(selector);
  if (hit) return hit;
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = '';
  for (const ch of selector) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  const list = parts.map((p) => splitCompounds(p.trim()).map(parseCompound));
  parsed.set(selector, list);
  return list;
}

function splitCompounds(complex: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = '';
  for (const ch of complex) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function parseCompound(s: string): Compound {
  const out: Compound = [];
  let i = 0;
  const name = () => {
    const m = /^[\w-]+/.exec(s.slice(i));
    if (!m) throw new Error(`Bad selector: ${s}`);
    i += m[0].length;
    return m[0];
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '.') {
      i++;
      out.push({ kind: 'class', name: name() });
    } else if (ch === '#') {
      i++;
      out.push({ kind: 'id', name: name() });
    } else if (ch === '[') {
      const end = s.indexOf(']', i);
      const body = s.slice(i + 1, end);
      const m = /^([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?$/.exec(body);
      if (!m) throw new Error(`Bad attribute selector: ${s}`);
      out.push({ kind: 'attr', name: m[1], value: m[2] ?? m[3] ?? m[4] ?? null });
      i = end + 1;
    } else if (ch === ':') {
      i++;
      const pseudo = name();
      if (pseudo === 'not') {
        let depth = 0;
        const start = i + 1;
        for (; i < s.length; i++) {
          if (s[i] === '(') depth++;
          else if (s[i] === ')' && --depth === 0) break;
        }
        out.push({ kind: 'not', list: parseList(s.slice(start, i)) });
        i++;
      } else out.push({ kind: 'pseudo', name: pseudo });
    } else if (ch === '*') i++;
    else out.push({ kind: 'tag', name: name().toLowerCase() });
  }
  return out;
}

function matchesSimple(el: FakeElement, s: Simple): boolean {
  switch (s.kind) {
    case 'tag':
      return el.localName === s.name;
    case 'class':
      return el.className.split(/\s+/).includes(s.name);
    case 'id':
      return el.id === s.name;
    case 'attr':
      return el.hasAttribute(s.name) && (s.value === null || el.getAttribute(s.name) === s.value);
    case 'not':
      return !matchesList(el, s.list);
    case 'pseudo':
      if (s.name === 'focus-visible') return el.ownerDocument!.keyboard && el.ownerDocument!.focused === el;
      if (s.name === 'focus') return el.ownerDocument!.focused === el;
      if (s.name === 'disabled') return el.hasAttribute('disabled');
      throw new Error(`No :${s.name} here`);
  }
}

const matchesCompound = (el: FakeElement, c: Compound) => c.every((s) => matchesSimple(el, s));

function matchesComplex(el: FakeElement, parts: Compound[]): boolean {
  if (!matchesCompound(el, parts[parts.length - 1])) return false;
  let k = parts.length - 2;
  for (let n = el.parentElement; n && k >= 0; n = n.parentElement) if (matchesCompound(n, parts[k])) k--;
  return k < 0;
}

const matchesList = (el: FakeElement, list: Compound[][]) => list.some((parts) => matchesComplex(el, parts));

/* ---------- Events ---------- */

function makeEvent(type: string, target: FakeNode, init: Record<string, unknown> = {}): FakeEvent {
  const ev: FakeEvent = {
    type,
    target,
    currentTarget: null,
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    eventPhase: 0,
    timeStamp: Date.now(),
    isTrusted: true,
    stopped: false,
    preventDefault() {
      ev.defaultPrevented = true;
    },
    stopPropagation() {
      ev.stopped = true;
    },
    stopImmediatePropagation() {
      ev.stopped = true;
    },
    ...init,
  };
  return ev;
}

/** Dispatch through the path: capture from the top down to the target, then bubble back up. */
function dispatch(target: FakeNode, ev: FakeEvent): FakeEvent {
  const path: FakeNode[] = [];
  for (let n: FakeNode | null = target; n; n = n.parentNode) path.push(n);
  const run = (node: FakeNode, capture: boolean | null, phase: number) => {
    ev.currentTarget = node;
    ev.eventPhase = phase;
    for (const l of [...(node.listeners.get(ev.type) ?? [])]) if (capture === null || l.capture === capture) l.fn(ev);
  };
  for (let i = path.length - 1; i > 0 && !ev.stopped; i--) run(path[i], true, 1);
  if (!ev.stopped) run(path[0], null, 2);
  if (ev.bubbles) for (let i = 1; i < path.length && !ev.stopped; i++) run(path[i], false, 3);
  ev.currentTarget = null;
  return ev;
}

/* =====================================================================================================
 * The test page: window, document, voice, sound and clock
 * ===================================================================================================== */

let doc: FakeDocument;
let spoken: string[];
let sounds: string[];
const roots: (() => void)[] = [];

function makeWindow(d: FakeDocument) {
  let hash = '#/';
  const listeners = new Map<string, Set<() => void>>();
  const win = {
    document: d,
    event: undefined,
    innerWidth: 390,
    innerHeight: 844,
    HTMLIFrameElement: class {},
    location: {
      get hash() {
        return hash;
      },
      set hash(v: string) {
        hash = v.startsWith('#') ? v : `#${v}`;
      },
      pathname: '/',
      search: '',
      replace(url: string) {
        hash = url.slice(url.indexOf('#'));
      },
    },
    speechSynthesis: {
      speak: (u: { text: string }) => void spoken.push(u.text),
      cancel: () => {},
      getVoices: () => [],
      addEventListener: () => {},
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener: (type: string, fn: () => void) => void (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn),
    removeEventListener: (type: string, fn: () => void) => void listeners.get(type)?.delete(fn),
    // Read the timers when called, so Vitest's fake ones are used.
    setTimeout: (fn: () => void, ms?: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    setInterval: (fn: () => void, ms?: number) => setInterval(fn, ms),
    clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
    requestAnimationFrame: (fn: (t: number) => void) => setTimeout(() => fn(Date.now()), 16),
    cancelAnimationFrame: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
  };
  d.defaultView = win;
  return win;
}

class Utterance {
  rate = 1;
  pitch = 1;
  voice: unknown = null;
  constructor(public text: string) {}
}

beforeEach(() => {
  doc = new FakeDocument();
  spoken = [];
  sounds = [];
  vi.stubGlobal('window', makeWindow(doc));
  vi.stubGlobal('document', doc);
  vi.stubGlobal('HTMLElement', FakeElement);
  vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  for (const name of ['tap', 'good', 'wrong', 'win', 'move', 'bump', 'exit', 'line', 'lose'] as const) {
    vi.spyOn(sfx, name).mockImplementation(() => void sounds.push(name));
  }
  progressStore.replace(emptyState());
});

afterEach(() => {
  roots.splice(0).forEach((unmount) => unmount());
  progressStore.replace(emptyState());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** A child on this device, active, in an age band. */
function child(band: AgeBand = '5-6', name = 'Maya') {
  const p = progressStore.addPlayer({ name, ageBand: band, color: 'blue' });
  progressStore.setActivePlayer(p.id);
  return p;
}

/** Stars on levels 0 to count - 1, so `count` is the current level. */
function starUpTo(game: string, count: number, stars = 3) {
  for (let i = 0; i < count; i++) progressStore.recordStars(game, i, stars);
}

function mount(node: ReactElement) {
  const container = doc.createElement('div');
  doc.body.appendChild(container);
  const root = createRoot(container as unknown as Element);
  act(() => root.render(node));
  let mounted = true;
  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    act(() => root.unmount());
  };
  roots.push(unmount);
  return { container, unmount };
}

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const hash = () => (window as unknown as { location: { hash: string } }).location.hash;

/* ---------- Reading the page the way assistive tech does ---------- */

/** Hidden from assistive tech: inside aria-hidden="true" or inert. */
const isHidden = (el: FakeElement) => !!el.closest('[aria-hidden="true"]') || isInert(el);

const IMPLICIT: Record<string, string> = { button: 'button', h1: 'heading', h2: 'heading', main: 'main', header: 'banner' };
function roleOf(el: FakeElement): string | null {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;
  if (el.localName === 'a' && el.hasAttribute('href')) return 'link';
  return IMPLICIT[el.localName] ?? null;
}
const nameOf = (el: FakeElement) => el.getAttribute('aria-label') ?? el.textContent.replace(/\s+/g, ' ').trim();

/** Every element with this role (and name) that assistive tech can reach, in page order. */
function allByRole(role: string, name?: string | RegExp, root: FakeElement = doc.body): FakeElement[] {
  return descendants(root).filter((el) => {
    if (roleOf(el) !== role || isHidden(el)) return false;
    if (name === undefined) return true;
    const n = nameOf(el);
    return typeof name === 'string' ? n === name : name.test(n);
  });
}

function byRole(role: string, name?: string | RegExp, root?: FakeElement): FakeElement {
  const found = allByRole(role, name, root);
  if (found.length !== 1) throw new Error(`Expected one ${role} named ${String(name)}, found ${found.length}: ${allByRole(role, undefined, root).map(nameOf).join(' | ')}`);
  return found[0];
}

const queryRole = (role: string, name?: string | RegExp, root?: FakeElement): FakeElement | null => allByRole(role, name, root)[0] ?? null;
const button = (name: string | RegExp, root?: FakeElement) => byRole('button', name, root);
const helpLine = () => byRole('status').textContent;
const dots = () => doc.body.querySelector('.bw-dots')!.getAttribute('aria-label');
const card = () => queryRole('dialog');
const pressed = (el: FakeElement) => el.getAttribute('aria-pressed');

/* ---------- Acting on the page like a child ---------- */

/**
 * A mouse or finger click on an element, as a browser delivers it: nothing reaches a disabled button or
 * anything inert. The clicked element takes focus, as a click on a button does in Chrome.
 */
function click(el: FakeElement, init: Record<string, unknown> = {}) {
  if (isInert(el) || (el.localName === 'button' && el.hasAttribute('disabled'))) return false;
  act(() => {
    doc.keyboard = false;
    doc.focus(el.closest('button, a[href], [tabindex]') ?? el);
    dispatch(el, makeEvent('click', el, { button: 0, buttons: 0, detail: 1, clientX: 0, clientY: 0, ...init }));
  });
  return true;
}

/** A tap with a finger: pointer down and up on the spot, then the click. */
function tap(el: FakeElement) {
  if (isInert(el)) return false;
  const at = centre(el);
  act(() => {
    dispatch(el, makeEvent('pointerdown', el, { pointerId: 1, button: 0, buttons: 1, clientX: at.x, clientY: at.y, pointerType: 'touch', isPrimary: true }));
  });
  act(() => {
    dispatch(el, makeEvent('pointerup', el, { pointerId: 1, button: 0, buttons: 0, clientX: at.x, clientY: at.y, pointerType: 'touch', isPrimary: true }));
  });
  return click(el, { clientX: at.x, clientY: at.y });
}

const centre = (el: FakeElement) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/** A real pointer drag: down on `from`, moves in steps, up over `to` (or a point), with the pointer captured on `from`. */
function drag(from: FakeElement, to: FakeElement | { x: number; y: number }, { cancel = false, steps = 4 } = {}) {
  const a = centre(from);
  const b = to instanceof FakeElement ? centre(to) : to;
  const fire = (type: string, x: number, y: number) =>
    act(() => {
      dispatch(from, makeEvent(type, from, { pointerId: 7, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y, pointerType: 'touch', isPrimary: true }));
    });
  fire('pointerdown', a.x, a.y);
  for (let k = 1; k <= steps; k++) fire('pointermove', a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps);
  if (cancel) {
    fire('pointercancel', b.x, b.y);
    return;
  }
  fire('pointerup', b.x, b.y);
  // The pointer was captured, so the browser sends the click that follows to the dragged element, if it is still there.
  if (from.isConnected) {
    act(() => {
      dispatch(from, makeEvent('click', from, { button: 0, detail: 1, clientX: b.x, clientY: b.y }));
    });
  }
}

/** A key on the focused element. Enter and Space on a button or link click it, as a browser does (detail 0). */
function press(key: string) {
  act(() => {
    doc.keyboard = true;
    const target = doc.activeElement;
    const ev = dispatch(target, makeEvent('keydown', target, { key, code: key, keyCode: key === 'Enter' ? 13 : key === 'Escape' ? 27 : 0 }));
    const clickable = target.localName === 'button' || (target.localName === 'a' && target.hasAttribute('href'));
    if (!ev.defaultPrevented && clickable && (key === 'Enter' || key === ' ') && !isInert(target) && !target.hasAttribute('disabled')) {
      dispatch(target, makeEvent('click', target, { button: 0, detail: 0 }));
    }
  });
}

/** Put the page in the background, or bring it back, as the browser reports it. */
function setPageHidden(hidden: boolean) {
  act(() => {
    doc.visibilityState = hidden ? 'hidden' : 'visible';
    dispatch(doc, makeEvent('visibilitychange', doc, { bubbles: false }));
  });
}

/** The stored run of a 0-based level for the active child. */
const storedRun = (game: string, level: number): LevelRun | null => runOf(activePlayer(progressStore.getState()), game, level);
const storedStars = (game: string, level: number) => activePlayer(progressStore.getState())?.games[game]?.stars[level];

/** Waits out the level card's delay and gives its dialog. */
function openCard(): FakeElement {
  expect(card()).toBeNull();
  wait(LEVEL_CARD_DELAY_MS);
  const d = card();
  if (!d) throw new Error('No level card');
  return d;
}

/* =====================================================================================================
 * The kit on a page: PlayScreen's focus rules and ChoiceRow's marks (10.1)
 * ===================================================================================================== */

function runApi(over: Partial<LevelRunApi<null>>, calls: string[]): LevelRunApi<null> {
  return {
    phase: 'play',
    level: 2,
    puzzleNo: 0,
    puzzle: null,
    band: '5-6',
    dots: { solved: 1, at: 2 },
    offer: false,
    shared: null,
    slip: () => void calls.push('slip'),
    progress: () => void calls.push('progress'),
    hold: () => void calls.push('hold'),
    solve: () => void calls.push('solve'),
    swap: () => void calls.push('swap'),
    next: () => void calls.push('next'),
    hint: null,
    card: null,
    round: 0,
    finish: null,
    slot: 'controls',
    ...over,
  };
}

/** A PlayScreen on the page, drawn again with each new run state, as useLevelRun would hand it over. */
function playScreen(parts: { controls?: boolean; marked?: 'controls' | 'body' | null; body?: boolean } = {}) {
  const { controls = true, marked = null, body = true } = parts;
  const calls: string[] = [];
  const container = doc.createElement('div');
  doc.body.appendChild(container);
  const root = createRoot(container as unknown as Element);
  roots.push(() => act(() => root.unmount()));
  const mark = (where: 'controls' | 'body') => (marked === where ? { [FIRST_CONTROL]: '' } : {});
  const show = (over: Partial<LevelRunApi<null>> = {}, speaker = 'Can you make green?') =>
    act(() =>
      root.render(
        createElement(PlayScreen<null>, {
          run: runApi(over, calls),
          speaker: { label: 'Hear the question', text: () => speaker },
          line: 'Tap the paint that makes green.',
          lineStyle: 'help',
          top: createElement('div', { className: 'game-top' }, createElement('button', { type: 'button' }, 'Goal')),
          children: body ? createElement('div', { className: 'game-body' }, createElement('button', { type: 'button', ...mark('body') }, 'Board')) : undefined,
          controls: controls
            ? createElement(
                'div',
                { className: 'game-controls' },
                createElement('button', { type: 'button' }, 'Red paint'),
                createElement('button', { type: 'button', ...mark('controls') }, 'Blue paint'),
              )
            : undefined,
        }),
      ),
    );
  return { show, calls };
}

const doneCard = (calls: string[]): LevelCardProps => ({
  title: 'You finished Level 3',
  stars: 3,
  fact: '4 puzzles, no slips.',
  primary: { label: 'Play Level 4', onClick: () => void calls.push('play') },
  secondary: { label: 'Back to games', href: '#/' },
  onClose: () => void calls.push('close'),
});

describe('PlayScreen focus rules on a page (brief 3.1, 9.1; four-puzzle 10)', () => {
  it('moves focus to Next puzzle on a solve, and Next calls the level’s next()', () => {
    const { show, calls } = playScreen();
    show();
    button('Red paint').focus();
    show({ phase: 'solved', slot: 'next' });
    const next = button('Next puzzle');
    expect(doc.activeElement).toBe(next);
    // The controls are out of reach behind Next: inert, so the focus fixup moved nothing onto them.
    expect(queryRole('button', 'Red paint')).toBeNull();
    click(next);
    expect(calls).toEqual(['next']);
  });

  it('after Next, moves focus to the first control in the controls slot', () => {
    const { show } = playScreen();
    show();
    show({ phase: 'solved', slot: 'next' });
    show({ round: 1, dots: { solved: 2, at: 3 } });
    expect(doc.activeElement).toBe(button('Red paint'));
  });

  it('after Next, prefers the control the game marked with FIRST_CONTROL, in the slot or in the body', () => {
    const inSlot = playScreen({ marked: 'controls' });
    inSlot.show();
    inSlot.show({ phase: 'solved', slot: 'next' });
    inSlot.show({ round: 1 });
    expect(doc.activeElement).toBe(button('Blue paint'));
    roots.splice(0).forEach((unmount) => unmount());

    const inBody = playScreen({ marked: 'body' });
    inBody.show();
    inBody.show({ phase: 'solved', slot: 'next' });
    inBody.show({ round: 1 });
    expect(doc.activeElement).toBe(button('Board'));
  });

  it('with no controls of its own, after Next focus goes to the body’s first control, then the top’s', () => {
    const noSlot = playScreen({ controls: false });
    noSlot.show();
    noSlot.show({ phase: 'solved', slot: 'next' });
    noSlot.show({ round: 1 });
    expect(doc.activeElement).toBe(button('Board'));
    roots.splice(0).forEach((unmount) => unmount());

    const onlyTop = playScreen({ controls: false, body: false });
    onlyTop.show();
    onlyTop.show({ phase: 'solved', slot: 'next' });
    onlyTop.show({ round: 1 });
    expect(doc.activeElement).toBe(button('Goal'));
  });

  it('never gives the offer focus by itself, and after a swap from it lands on the first control', () => {
    const { show, calls } = playScreen();
    show();
    button('Blue paint').focus();
    show({ offer: true, shared: 'offer' });
    const offer = button('New puzzle');
    expect(doc.activeElement).not.toBe(offer);
    // The offer comes last in the help row, after the line and the hint cell.
    expect(offer.parentElement!.className).toBe('bw-helprow__offer');
    expect(offer.parentElement!.previousSibling).toBe(doc.body.querySelector('.bw-helprow__hint'));
    click(offer);
    expect(calls).toEqual(['swap']);
    expect(doc.activeElement).toBe(offer);
    show({ round: 1, shared: 'swapped' });
    expect(doc.activeElement).toBe(button('Red paint'));
    expect(helpLine()).toBe(SWAPPED_LINE);
  });

  it('leaves focus where it is after a swap when it was not lost (the speaker, say)', () => {
    const { show } = playScreen();
    show({ offer: true, shared: 'offer' });
    const speaker = button(READ_HELP_ALOUD);
    speaker.focus();
    show({ round: 1, shared: 'swapped' });
    expect(doc.activeElement).toBe(button('Hear the question'));
  });

  it('moves no focus when a new puzzle comes without a solve or an offer before it (a stored run that moved the puzzle)', () => {
    const { show } = playScreen();
    show();
    const speaker = button('Hear the question');
    speaker.focus();
    show({ round: 1 });
    expect(doc.activeElement).toBe(speaker);
  });

  it('shows nothing in the slot behind the card, and Play Level N with focus once the card is closed', () => {
    const { show, calls } = playScreen();
    show({ phase: 'solved', slot: 'next' });
    const done = { phase: 'done' as const, dots: { solved: 4, at: 4 }, finish: { stars: 3, next: 3, results: [] } };
    show({ ...done, slot: 'empty' });
    expect(queryRole('button', 'Next puzzle')).toBeNull();
    show({ ...done, slot: 'empty', card: doneCard(calls) });
    const dialog = card()!;
    // The card puts focus on its own primary button.
    expect(doc.activeElement).toBe(button('Play Level 4', dialog));
    press('Escape');
    expect(calls).toEqual(['close']);
    show({ ...done, slot: 'play' });
    const play = button('Play Level 4');
    expect(play.closest('.bw-play__slot')).not.toBeNull();
    expect(doc.activeElement).toBe(play);
    click(play);
    expect(calls).toEqual(['close', 'next']);
  });

  it('puts Back to games in the slot with focus once the last level’s card is closed', () => {
    const { show } = playScreen();
    show({ phase: 'done', slot: 'empty', finish: { stars: 2, next: null, results: [] } });
    show({ phase: 'done', slot: 'home', finish: { stars: 2, next: null, results: [] } });
    const back = byRole('link', 'Back to games');
    expect(back.getAttribute('href')).toBe('#/');
    expect(doc.activeElement).toBe(back);
  });

  it('reads the game’s text when the speaker is tapped, the offer line while the offer shows, and nothing before a tap', () => {
    const { show } = playScreen();
    show({}, 'Can you make cream?');
    expect(spoken).toEqual([]);
    click(button('Hear the question'));
    expect(spoken).toEqual(['Can you make cream?']);
    show({ offer: true, shared: 'offer' }, 'Can you make cream?');
    expect(spoken).toHaveLength(1);
    click(button(READ_HELP_ALOUD));
    expect(spoken).toEqual(['Can you make cream?', OFFER_LINE]);
  });
});

describe('ChoiceRow on a page (brief 3.1, 7.2)', () => {
  type Pick = { color: string; right: boolean };
  function choiceRow(locked = false) {
    const picks: Pick[] = [];
    const container = doc.createElement('div');
    doc.body.appendChild(container);
    const root = createRoot(container as unknown as Element);
    roots.push(() => act(() => root.unmount()));
    const show = (isLocked: boolean) =>
      act(() =>
        root.render(
          createElement(ChoiceRow<string>, {
            items: ['Orange', 'Green', 'Purple'],
            name: (c) => c,
            isRight: (c) => c === 'Green',
            onPick: (color, _i, right) => void picks.push({ color, right }),
            locked: isLocked,
            label: 'Colors',
            children: (c, _i, state) => createElement('span', { 'data-state': state }, c),
          }),
        ),
      );
    show(locked);
    const choice = (c: string) => button(c, byRole('group', 'Colors'));
    const state = (c: string) => choice(c).querySelector('span')!.getAttribute('data-state');
    return { picks, show, choice, state };
  }

  it('dims a wrong choice for 500 ms, then brings it back; a second wrong one moves the mark and starts the 500 ms again', () => {
    const { picks, choice, state } = choiceRow();
    click(choice('Orange'));
    expect(picks).toEqual([{ color: 'Orange', right: false }]);
    expect(choice('Orange').className).toBe('bw-choice is-wrong');
    expect(state('Orange')).toBe('wrong');
    wait(300);
    click(choice('Purple'));
    expect(choice('Orange').className).toBe('bw-choice');
    expect(state('Purple')).toBe('wrong');
    wait(CHOICE_WRONG_MS - 1);
    expect(state('Purple')).toBe('wrong');
    wait(1);
    expect(state('Purple')).toBe('idle');
    // A wrong choice can be tapped again: every tap reaches the game, which decides what counts.
    click(choice('Purple'));
    expect(picks.map((p) => p.color)).toEqual(['Orange', 'Purple', 'Purple']);
  });

  it('rings the right choice, takes no more taps from then on and marks the row aria-disabled, before the game locks it', () => {
    const { picks, choice, state, show } = choiceRow();
    click(choice('Orange'));
    act(() => {
      dispatch(choice('Green'), makeEvent('click', choice('Green'), { button: 0, detail: 1 }));
      dispatch(choice('Green'), makeEvent('click', choice('Green'), { button: 0, detail: 1 }));
    });
    expect(picks).toEqual([
      { color: 'Orange', right: false },
      { color: 'Green', right: true },
    ]);
    expect(state('Green')).toBe('right');
    expect(choice('Green').className).toBe('bw-choice is-right');
    // The wrong mark goes at once.
    expect(state('Orange')).toBe('idle');
    for (const c of ['Orange', 'Green', 'Purple']) expect(choice(c).getAttribute('aria-disabled')).toBe('true');
    click(choice('Purple'));
    expect(picks).toHaveLength(2);
    show(true);
    expect(state('Green')).toBe('right');
  });

  it('takes no taps at all while locked, and shows no marks', () => {
    const { picks, choice, state } = choiceRow(true);
    click(choice('Orange'));
    click(choice('Green'));
    expect(picks).toEqual([]);
    expect(state('Orange')).toBe('idle');
    expect(state('Green')).toBe('idle');
  });
});

/* =====================================================================================================
 * Color Mixer
 * ===================================================================================================== */

const COLOR_BY_NAME = new Map<string, ResultId | PaintId>(
  [...Object.values(RESULTS).map((c) => [c.name.toLowerCase(), c.id] as const), ...(['red', 'yellow', 'blue', 'white'] as PaintId[]).map((p) => [p, p] as const)],
);
const colorByName = (name: string) => {
  const id = COLOR_BY_NAME.get(name.trim().toLowerCase());
  if (!id) throw new Error(`No colour named ${name}`);
  return id;
};
const PAINT_NAME: Record<PaintId, string> = { red: 'Red', yellow: 'Yellow', blue: 'Blue', white: 'White' };

/** The text a screen reader gets from a node: aria-hidden parts are skipped. */
function readerText(node: FakeNode): string {
  if (node instanceof FakeText) return node.data;
  if (node instanceof FakeElement && node.getAttribute('aria-hidden') === 'true') return '';
  return node.childNodes.map(readerText).join('');
}

/** What the Mixer screen asks, read from the page as a reader would: the chip, the slots and the shelf or swatches. */
function mixerOnScreen() {
  const chip = readerText(doc.body.querySelector('.mix-chip')! as unknown as FakeNode);
  const slots = allByRole('button', /^Paint [12]: /).map(nameOf);
  const colors = queryRole('group', 'Colors');
  if (colors) {
    const m = /^What do (.+) and (.+) make\?$/.exec(chip);
    if (!m) throw new Error(`Not a Guess chip: ${chip}`);
    const paints = [colorByName(m[1]), colorByName(m[2])] as [PaintId, PaintId];
    return { form: 'guess' as const, chip, slots, paints, answer: mixOf(paints[0], paints[1])!, choices: allByRole('button', undefined, colors).map(nameOf) };
  }
  const m = /^Can you make ?(.+)\?$/.exec(chip);
  if (!m) throw new Error(`Not a goal chip: ${chip}`);
  const goal = colorByName(m[1]) as ResultId;
  const shelf = allByRole('button', / paint$/, byRole('group', 'Paints')).map((b) => colorByName(nameOf(b).replace(/ paint$/, '')) as PaintId);
  const pair = RECIPES.find((r) => r.result === goal)!.pair;
  const given = /^Paint 1: (.+), given$/.exec(slots[0])?.[1];
  if (given !== undefined) {
    const g = colorByName(given) as PaintId;
    return { form: 'finish' as const, chip, slots, goal, given: g, shelf, right: pair.find((p) => p !== g)! };
  }
  return { form: 'make' as const, chip, slots, goal, shelf, pair };
}

const pot = (paint: PaintId) => button(`${PAINT_NAME[paint]} paint`);
const bowl = () => byRole('img', /^Bowl: /).getAttribute('aria-label');
const resultName = () => doc.body.querySelector('.mix-result__name')!.textContent;
const resultText = () => doc.body.querySelector('.mix-result__text')!.textContent;

/** Solve the Mixer puzzle on screen with the right taps. */
function solveMixer() {
  const p = mixerOnScreen();
  if (p.form === 'finish') tap(pot(p.right));
  else if (p.form === 'make') {
    tap(pot(p.pair[0]));
    tap(pot(p.pair[1]));
  } else click(button(RESULTS[p.answer].name, byRole('group', 'Colors')));
}

/** A wrong pot in Finish (the shelf paint that does not make the goal), or null when there is none. */
function wrongFinishPot(p: ReturnType<typeof mixerOnScreen>): PaintId | null {
  if (p.form !== 'finish') throw new Error('Not Finish');
  return p.shelf.find((x) => x !== p.right) ?? null;
}

function openMixer(level = 0) {
  const params = [String(level + 1)];
  return mount(createElement(MixerApp, { params }));
}

describe('Color Mixer: Finish the mix (Level 1)', () => {
  it('opens on the goal chip with paint 1 given and nothing said (board: play)', () => {
    child();
    openMixer(0);
    const p = mixerOnScreen();
    if (p.form !== 'finish') throw new Error('Level 1 is Finish');
    expect(byRole('heading', 'Level 1')).toBeTruthy();
    expect(dots()).toBe('Puzzle 1 of 4. 0 solved.');
    expect(p.chip).toMatch(/^Can you make ?(orange|green|purple)\?$/);
    // A screen reader gets the chip as one sentence, with the space before the colour (brief 9.2).
    expect(p.chip).toMatch(/^Can you make (orange|green|purple)\?$/);
    expect(p.slots).toEqual([`Paint 1: ${colorWord(p.given)}, given`, 'Paint 2: empty']);
    // The given slot takes no taps and no focus; an empty slot neither.
    for (const slot of allByRole('button', /^Paint [12]: /)) {
      expect(slot.getAttribute('aria-disabled')).toBe('true');
      expect(slot.getAttribute('tabindex')).toBe('-1');
    }
    // The shelf leaves out the given paint: red, yellow and blue less one.
    expect(p.shelf).toHaveLength(2);
    expect(p.shelf).not.toContain(p.given);
    for (const paint of p.shelf) expect(pressed(pot(paint))).toBe('false');
    expect(bowl()).toBe(`Bowl: ${colorWord(p.given)}`);
    expect(resultName()).toBe('Pick one more paint');
    expect(resultText()).toBe('');
    expect(helpLine()).toBe(`Tap the paint that makes ${colorWord(p.goal)}.`);
    expect(doc.body.querySelector('[role="status"]')!.className).toContain('bw-helprow__line--help');
    expect(doc.body.querySelector('.mix-result')!.getAttribute('aria-live')).toBe('polite');
    expect(button('Hear the question')).toBeTruthy();
    expect(spoken).toEqual([]);
    expect(sounds).toEqual([]);
  });

  it('a wrong paint mixes in the bowl, names and teaches the colour, says not yet and counts as one slip (board: slip)', () => {
    child();
    openMixer(0);
    const p = mixerOnScreen();
    if (p.form !== 'finish') throw new Error('Level 1 is Finish');
    const wrong = wrongFinishPot(p)!;
    const made = mixOf(p.given, wrong)!;
    tap(pot(wrong));
    expect(sounds).toEqual(['wrong']);
    expect(nameOf(button(/^Paint 2: /))).toBe(`Paint 2: ${colorWord(wrong)}`);
    expect(pressed(pot(wrong))).toBe('true');
    expect(bowl()).toBe(`Bowl: ${colorWord(made)}`);
    expect(resultName()).toBe(RESULTS[made].name);
    expect(resultText()).toBe(RECIPES.find((r) => r.result === made)!.text);
    expect(helpLine()).toBe(`Not ${colorWord(p.goal)} yet. Try another paint.`);
    // A slip is not a wrong-answer colour in the help style: the line keeps the help look.
    expect(doc.body.querySelector('[role="status"]')!.className).not.toContain('is-wrong');
    // A second tap on the pot already in slot 2 changes nothing and is no new slip.
    tap(pot(wrong));
    expect(sounds).toEqual(['wrong']);
    expect(spoken).toEqual([]);
  });

  it('the right paint solves: the dot fills, the line states the result, Next puzzle takes the shelf’s place and focus (board: solved)', () => {
    child();
    openMixer(0);
    const p = mixerOnScreen();
    if (p.form !== 'finish') throw new Error('Level 1 is Finish');
    tap(pot(p.right));
    expect(sounds).toEqual(['win']);
    expect(dots()).toBe('Puzzle 1 of 4. 1 solved.');
    expect(bowl()).toBe(`Bowl: ${colorWord(p.goal)}`);
    expect(resultName()).toBe(RESULTS[p.goal].name);
    expect(resultText()).toBe(RECIPES.find((r) => r.result === p.goal)!.text);
    expect(helpLine()).toBe(`You made ${colorWord(p.goal)}.`);
    const next = button('Next puzzle');
    expect(doc.activeElement).toBe(next);
    // The shelf stays in place, hidden and inert, so nothing moves; its pots take no more taps.
    expect(queryRole('group', 'Paints')).toBeNull();
    const shelf = doc.body.querySelector('.mix-shelf')!;
    expect(isInert(shelf)).toBe(true);
    expect(tap(shelf.querySelector('button')!)).toBe(false);
    expect(storedRun('mixer', 0)!.solved).toEqual([{ puzzle: 0, count: 0, usedHint: false, outOfTime: false }]);
    expect(spoken).toEqual([]);

    // Next: puzzle 2 starts from its own start, focus on the first pot.
    click(next);
    expect(dots()).toBe('Puzzle 2 of 4. 1 solved.');
    const q = mixerOnScreen();
    expect(q.form).toBe('finish');
    expect(q.slots[1]).toBe('Paint 2: empty');
    expect(resultName()).toBe('Pick one more paint');
    expect(doc.activeElement).toBe(allByRole('button', / paint$/, byRole('group', 'Paints'))[0]);
  });

  it('a tap on another pot replaces paint 2, so a wrong paint then the right one solves with one slip', () => {
    child();
    openMixer(0);
    const p = mixerOnScreen();
    if (p.form !== 'finish') throw new Error('Level 1 is Finish');
    tap(pot(wrongFinishPot(p)!));
    tap(pot(p.right));
    expect(nameOf(button(/^Paint 2: /))).toBe(`Paint 2: ${colorWord(p.right)}`);
    expect(sounds).toEqual(['wrong', 'win']);
    expect(storedRun('mixer', 0)!.solved[0]).toMatchObject({ count: 1 });
  });

  it('counts a repeated wrong pair once for stars and every time for the offer, which comes at 3 for ages 3 to 4', () => {
    child('3-4');
    openMixer(0);
    const p = mixerOnScreen();
    if (p.form !== 'finish') throw new Error('Level 1 is Finish');
    const wrong = wrongFinishPot(p)!;
    const slot2 = () => button(/^Paint 2: /);
    tap(pot(wrong));
    // A filled slot empties on a tap, and the bowl shows the one paint left.
    expect(slot2().getAttribute('aria-disabled')).toBeNull();
    tap(slot2());
    expect(nameOf(slot2())).toBe('Paint 2: empty');
    expect(bowl()).toBe(`Bowl: ${colorWord(p.given)}`);
    expect(helpLine()).toBe(`Tap the paint that makes ${colorWord(p.goal)}.`);
    tap(pot(wrong));
    expect(queryRole('button', 'New puzzle')).toBeNull();
    tap(slot2());
    tap(pot(wrong));
    // Three wrong tries: the offer, in the help row's left cell, with its line.
    const offer = button('New puzzle');
    expect(helpLine()).toBe(OFFER_LINE);
    expect(offer.parentElement!.className).toBe('bw-helprow__offer');
    expect(doc.activeElement).not.toBe(offer);
    expect(sounds.filter((s) => s === 'wrong')).toHaveLength(3);
    // Now fix the pair and solve: the one wrong pair counted once.
    tap(slot2());
    tap(pot(p.right));
    expect(storedRun('mixer', 0)!.solved[0]).toMatchObject({ puzzle: 0, count: 1 });
  });

  it('the speaker reads the chip, and the result text after a mix; with the offer up it reads the offer line', () => {
    child('3-4');
    openMixer(0);
    const p = mixerOnScreen();
    if (p.form !== 'finish') throw new Error('Level 1 is Finish');
    const speaker = () => button(/^(Hear the question|Read the help line aloud)$/);
    click(speaker());
    const chip = `Can you make ${colorWord(p.goal)}?`;
    expect(spoken).toEqual([chip]);
    const wrong = wrongFinishPot(p)!;
    tap(pot(wrong));
    // A pot tap says nothing; the speaker then reads the chip and what the mix taught.
    expect(spoken).toEqual([chip]);
    click(speaker());
    expect(spoken[1]).toBe(`${chip} ${RECIPES.find((r) => r.result === mixOf(p.given, wrong))!.text}`);
    tap(button(/^Paint 2: /));
    tap(pot(wrong));
    tap(button(/^Paint 2: /));
    tap(pot(wrong));
    expect(nameOf(speaker())).toBe(READ_HELP_ALOUD);
    click(speaker());
    expect(spoken[2]).toBe(OFFER_LINE);
  });

  it('a swap brings a different puzzle, keeps the dots, moves focus to the first pot and forgets the swapped puzzle’s slips', () => {
    child('3-4');
    openMixer(0);
    const p = mixerOnScreen();
    if (p.form !== 'finish') throw new Error('Level 1 is Finish');
    const wrong = wrongFinishPot(p)!;
    for (let i = 0; i < 3; i++) {
      if (i) tap(button(/^Paint 2: /));
      tap(pot(wrong));
    }
    click(button('New puzzle'));
    expect(helpLine()).toBe(SWAPPED_LINE);
    expect(queryRole('button', 'New puzzle')).toBeNull();
    expect(dots()).toBe('Puzzle 1 of 4. 0 solved.');
    const q = mixerOnScreen();
    if (q.form !== 'finish') throw new Error('Level 1 is Finish');
    // On Level 1 two puzzles may share a goal, but then the given paint differs.
    expect(`${q.goal}|${q.given}`).not.toBe(`${p.goal}|${p.given}`);
    expect(q.slots[1]).toBe('Paint 2: empty');
    expect(bowl()).toBe(`Bowl: ${colorWord(q.given)}`);
    expect(doc.activeElement).toBe(allByRole('button', / paint$/, byRole('group', 'Paints'))[0]);
    expect(storedRun('mixer', 0)!.queue.at(-1)).toBe(0);
    // The swapped-in puzzle starts clean.
    tap(pot(q.right));
    expect(storedRun('mixer', 0)!.solved).toEqual([{ puzzle: 1, count: 0, usedHint: false, outOfTime: false }]);
  });

  it('brings the offer after 30 s with no answer at ages 3 to 4, not before, and not while the page is hidden', () => {
    child('3-4');
    openMixer(0);
    wait(29 * TICK_MS);
    expect(queryRole('button', 'New puzzle')).toBeNull();
    setPageHidden(true);
    wait(60 * TICK_MS);
    setPageHidden(false);
    expect(queryRole('button', 'New puzzle')).toBeNull();
    wait(TICK_MS);
    expect(button('New puzzle')).toBeTruthy();
    expect(helpLine()).toBe(OFFER_LINE);
    // Nothing is said when the offer comes up by itself.
    expect(spoken).toEqual([]);
    expect(sounds).toEqual([]);
  });
});

describe('Color Mixer: Guess the mix (Level 2)', () => {
  function openGuess(band: AgeBand = '5-6') {
    child(band);
    starUpTo('mixer', 1);
    openMixer(1);
    const p = mixerOnScreen();
    if (p.form !== 'guess') throw new Error('Level 2 is Guess');
    return p;
  }
  const swatch = (name: string) => button(name, byRole('group', 'Colors'));

  it('shows both paints given, an empty bowl and three named colours (board: MixerGuess)', () => {
    const p = openGuess();
    expect(p.slots).toEqual([`Paint 1: ${colorWord(p.paints[0])}, given`, `Paint 2: ${colorWord(p.paints[1])}, given`]);
    expect(p.choices).toHaveLength(3);
    expect(new Set(p.choices).size).toBe(3);
    expect(p.choices).toContain(RESULTS[p.answer].name);
    expect(queryRole('group', 'Paints')).toBeNull();
    expect(bowl()).toBe('Bowl: empty');
    expect(resultName()).toBe('Pick a color');
    expect(helpLine()).toBe('Tap the color they make.');
    // Both slots are given: a tap does nothing.
    tap(button(/^Paint 1: /));
    expect(sounds).toEqual([]);
  });

  it('a wrong colour dims and comes back after 500 ms, the bowl stays empty, and a repeat costs no new star (board: slip)', () => {
    const p = openGuess();
    const wrong = p.choices.find((c) => c !== RESULTS[p.answer].name)!;
    click(swatch(wrong));
    expect(sounds).toEqual(['wrong']);
    expect(swatch(wrong).className).toContain('is-wrong');
    expect(bowl()).toBe('Bowl: empty');
    expect(resultName()).toBe('Pick a color');
    expect(helpLine()).toBe('Not that one. Look at the two paints again.');
    wait(CHOICE_WRONG_MS - 1);
    expect(swatch(wrong).className).toContain('is-wrong');
    wait(1);
    expect(swatch(wrong).className).not.toContain('is-wrong');
    // The line stays until the next answer.
    expect(helpLine()).toBe('Not that one. Look at the two paints again.');
    click(swatch(wrong));
    expect(sounds).toEqual(['wrong', 'wrong']);
    // Wrong, then right: one slip.
    click(swatch(RESULTS[p.answer].name));
    expect(storedRun('mixer', 1)!.solved[0]).toMatchObject({ count: 1 });
  });

  it('the right colour rings, fills the bowl only now, locks the row and solves once on a double tap (board: solved)', () => {
    const p = openGuess();
    const right = swatch(RESULTS[p.answer].name);
    click(right);
    click(right);
    expect(sounds).toEqual(['win']);
    expect(right.className).toContain('is-right');
    expect(bowl()).toBe(`Bowl: ${colorWord(p.answer)}`);
    expect(resultName()).toBe(RESULTS[p.answer].name);
    expect(resultText()).toBe(RECIPES.find((r) => r.result === p.answer)!.text);
    expect(helpLine()).toBe(`They make ${colorWord(p.answer)}.`);
    expect(storedRun('mixer', 1)!.solved).toHaveLength(1);
    expect(doc.activeElement).toBe(button('Next puzzle'));
    for (const b of doc.body.querySelectorAll('.bw-choice')) expect(b.getAttribute('aria-disabled')).toBe('true');
    // After Next, focus goes to the first swatch of the new question.
    click(button('Next puzzle'));
    expect(doc.activeElement).toBe(allByRole('button', undefined, byRole('group', 'Colors'))[0]);
    expect(bowl()).toBe('Bowl: empty');
  });
});

describe('Color Mixer: Make it (Level 3)', () => {
  function openMake(band: AgeBand = '5-6') {
    child(band);
    starUpTo('mixer', 2);
    openMixer(2);
    const p = mixerOnScreen();
    if (p.form !== 'make') throw new Error('Level 3 is Make it');
    return p;
  }

  it('starts with both slots empty and the three paints (board: play)', () => {
    const p = openMake();
    expect(p.slots).toEqual(['Paint 1: empty', 'Paint 2: empty']);
    expect([...p.shelf].sort()).toEqual(['blue', 'red', 'yellow']);
    expect(bowl()).toBe('Bowl: empty');
    expect(resultName()).toBe('Pick two paints');
    expect(helpLine()).toBe('Tap two paints to mix them.');
  });

  it('a paint of the goal’s pair is progress (good); another paint is a plain tap; the bowl shows the one paint', () => {
    const p = openMake();
    const other = p.shelf.find((x) => !p.pair.includes(x))!;
    tap(pot(other));
    expect(sounds).toEqual(['tap']);
    expect(nameOf(button(/^Paint 1: /))).toBe(`Paint 1: ${colorWord(other)}`);
    expect(bowl()).toBe(`Bowl: ${colorWord(other)}`);
    expect(resultName()).toBe('Pick two paints');
    tap(button(/^Paint 1: /));
    expect(sounds).toEqual(['tap', 'tap']);
    tap(pot(p.pair[0]));
    expect(sounds).toEqual(['tap', 'tap', 'good']);
  });

  it('the same paint twice shows that paint and teaches, with no slip', () => {
    const p = openMake('3-4');
    const paint = p.shelf[0];
    for (let i = 0; i < 3; i++) {
      tap(pot(paint));
      tap(pot(paint));
      expect(resultName()).toBe(PAINT_NAME[paint]);
      expect(resultText()).toBe(SAME_TEXT);
      expect(bowl()).toBe(`Bowl: ${colorWord(paint)}`);
      expect(helpLine()).toBe('Tap two paints to mix them.');
      // A third tap starts a new pair with that paint.
      tap(pot(paint));
      expect(nameOf(button(/^Paint 2: /))).toBe('Paint 2: empty');
      tap(button(/^Paint 1: /));
    }
    expect(sounds).not.toContain('wrong');
    expect(queryRole('button', 'New puzzle')).toBeNull();
  });

  it('a wrong pair slips once in either order, a third tap starts a new pair, and the right pair solves in either order (board: MixerMake slip)', () => {
    const p = openMake();
    const other = p.shelf.find((x) => !p.pair.includes(x))!;
    tap(pot(p.pair[0]));
    tap(pot(other));
    const made = mixOf(p.pair[0], other)!;
    expect(sounds.at(-1)).toBe('wrong');
    expect(helpLine()).toBe(`Not ${colorWord(p.goal)} yet. Try another pair.`);
    expect(bowl()).toBe(`Bowl: ${colorWord(made)}`);
    // The same pair the other way round: a new slip for the offer, the same one for stars.
    tap(pot(other));
    expect(button(/^Paint 1: /).getAttribute('aria-label')).toBe(`Paint 1: ${colorWord(other)}`);
    expect(nameOf(button(/^Paint 2: /))).toBe('Paint 2: empty');
    tap(pot(p.pair[0]));
    expect(sounds.filter((s) => s === 'wrong')).toHaveLength(2);
    // Start over and make the goal, second paint first.
    tap(pot(p.pair[1]));
    tap(pot(p.pair[0]));
    expect(sounds.at(-1)).toBe('win');
    expect(helpLine()).toBe(`You made ${colorWord(p.goal)}.`);
    expect(storedRun('mixer', 2)!.solved[0]).toMatchObject({ count: 1 });
  });

  it('progress hides the offer, and only a fresh slip run brings it back (four-puzzle 3.2)', () => {
    const p = openMake('3-4');
    const other = p.shelf.find((x) => !p.pair.includes(x))!;
    for (let i = 0; i < 3; i++) {
      tap(pot(i % 2 ? other : p.pair[0]));
      tap(pot(i % 2 ? p.pair[0] : other));
    }
    expect(button('New puzzle')).toBeTruthy();
    tap(pot(p.pair[0]));
    expect(queryRole('button', 'New puzzle')).toBeNull();
    expect(helpLine()).toBe('Tap two paints to mix them.');
  });
});

describe('Color Mixer: the level’s end and the finished state', () => {
  it('four solves record the stars, open the card after 600 ms with Play Level 2 focused, and Escape leaves Play Level 2 in the shelf’s place (board: levelDone)', () => {
    child();
    openMixer(0);
    for (let n = 0; n < 4; n++) {
      solveMixer();
      if (n < 3) click(button('Next puzzle'));
    }
    expect(dots()).toBe('4 of 4 solved.');
    expect(queryRole('button', 'Next puzzle')).toBeNull();
    const dialog = openCard();
    expect(byRole('heading', 'You finished Level 1', dialog)).toBeTruthy();
    expect(byRole('img', '3 of 3 stars', dialog)).toBeTruthy();
    expect(dialog.textContent).toContain('4 puzzles, no slips.');
    expect(dialog.textContent).toContain('3 stars: 1 slip or none. 2 stars: 4 slips or fewer.');
    expect(dialog.textContent).not.toContain('Using a hint');
    expect(doc.activeElement).toBe(button('Play Level 2', dialog));
    expect(storedStars('mixer', 0)).toBe(3);
    press('Escape');
    expect(card()).toBeNull();
    const play = button('Play Level 2');
    expect(play.closest('.bw-play__slot')).not.toBeNull();
    expect(doc.activeElement).toBe(play);
    click(play);
    expect(hash()).toBe('#/game/mixer/2');
    // Nothing is said on the level card or at the level's end.
    expect(spoken).toEqual([]);
  });

  it('shows the finished state with the empty slots and bowl behind the card once every level has stars (board: gameDone)', () => {
    child();
    starUpTo('mixer', 9, 2);
    mount(createElement(MixerApp, { params: [] }));
    expect(byRole('heading', 'Color Mixer')).toBeTruthy();
    const dialog = card()!;
    expect(byRole('heading', 'You finished every level!', dialog)).toBeTruthy();
    expect(byRole('img', '18 of 27 stars', dialog)).toBeTruthy();
    expect(dialog.textContent).toContain('9 levels, 18 of 27 stars.');
    expect(dialog.textContent).toContain('A grown-up can pick a level to play again.');
    expect(doc.activeElement).toBe(byRole('link', 'Back to games', dialog));
    // Behind the card: the empty slots and bowl, out of reach.
    const behind = doc.body.querySelector('.bw-play__body')!;
    expect(isHidden(behind)).toBe(true);
    expect(behind.querySelector('[aria-label="Bowl: empty"]')).not.toBeNull();
    expect(behind.querySelectorAll('[aria-label="Paint 1: empty"], [aria-label="Paint 2: empty"]')).toHaveLength(2);
    expect(queryRole('status')).toBeNull();
    press('Escape');
    expect(hash()).toBe('#/');
  });

  it('opens Break at Next once the daily limit is used up, and the level waits at the solved puzzle', () => {
    child();
    openMixer(0);
    solveMixer();
    act(() => progressStore.addMinutesPlayed(60));
    click(button('Next puzzle'));
    expect(hash()).toBe('#/break');
    expect(dots()).toBe('Puzzle 1 of 4. 1 solved.');
    expect(storedRun('mixer', 0)!.solved).toHaveLength(1);
  });
});

/* =====================================================================================================
 * Shape Sorter
 * ===================================================================================================== */

const tray = () => byRole('group', 'Shapes to place');
const holesGroup = () => byRole('group', 'Holes');
const pieces = () => allByRole('button', undefined, tray());
const openHoles = () => allByRole('button', undefined, holesGroup());
const piece = (name: string) => button(name, tray());
const hole = (name: string) => button(`${name} hole`, holesGroup());
const factText = () => doc.body.querySelector('.sort-fact__text')!.textContent;
const sorterName = (p: SorterPiece, colorMatters: boolean) => (colorMatters ? `${p.color} ${p.shape}` : p.shape);

function openSorter(level = 0, band: AgeBand = '5-6') {
  child(band);
  starUpTo('sorter', level);
  return mount(createElement(SorterApp, { params: [String(level + 1)] }));
}

/** Place every piece on screen in its own hole by the tap path, in tray order. */
function sortAll() {
  for (const p of pieces()) {
    const name = nameOf(p);
    tap(p);
    tap(hole(name));
  }
}

/** Lay the board out on screen (tray pieces in a row, holes in a row above), so drags have somewhere to go. */
function layOutSorter() {
  pieces().forEach((p, i) => (p.box = { left: 10 + i * 80, top: 600, width: 64, height: 76 }));
  openHoles().forEach((h, i) => (h.box = { left: 10 + i * 100, top: 200, width: 92, height: 92 }));
}

describe('Shape Sorter: a shape level (Level 1)', () => {
  it('opens with the prompt, the tray and the holes named for a reader, and nothing said (board: play)', () => {
    openSorter(0);
    const board = sorterPuzzle(0, 0);
    expect(byRole('heading', 'Level 1')).toBeTruthy();
    expect(dots()).toBe('Puzzle 1 of 4. 0 solved.');
    expect(helpLine()).toBe('Drag each shape into its hole.');
    expect(doc.body.querySelector('[role="status"]')!.className).toBe('bw-helprow__line bw-helprow__line--prompt');
    expect(pieces().map(nameOf)).toEqual(board.pieces.map((p) => p.shape));
    for (const p of pieces()) expect(pressed(p)).toBe('false');
    expect(openHoles().map(nameOf)).toEqual(board.holes.map((h) => `${h.shape} hole`));
    expect(factText()).toBe('Every shape has a home. Look at the corners.');
    // The "?" badge before the first placement says nothing to a reader.
    expect(doc.body.querySelector('.sort-fact__badge')!.getAttribute('aria-hidden')).toBe('true');
    expect(button('Hear the help line')).toBeTruthy();
    expect(spoken).toEqual([]);
    expect(sounds).toEqual([]);
  });

  it('a tap picks a piece, a second piece moves the pick and the picked one puts it down (board: picked)', () => {
    openSorter(0);
    const [a, b] = pieces();
    tap(a);
    expect(sounds).toEqual(['tap']);
    expect(pressed(a)).toBe('true');
    expect(helpLine()).toBe(`Now tap the ${nameOf(a)} hole.`);
    tap(b);
    expect(pressed(a)).toBe('false');
    expect(pressed(b)).toBe('true');
    expect(helpLine()).toBe(`Now tap the ${nameOf(b)} hole.`);
    tap(b);
    expect(pressed(b)).toBe('false');
    expect(helpLine()).toBe('Drag each shape into its hole.');
    // A hole with nothing picked does nothing: no slip, no sound.
    tap(openHoles()[0]);
    expect(sounds).toEqual(['tap', 'tap']);
    expect(helpLine()).toBe('Drag each shape into its hole.');
  });

  it('a wrong hole shakes red, names the shape it is for, sends the piece back and clears the pick (board: wrong)', () => {
    openSorter(0);
    const [a] = pieces();
    const other = openHoles().find((h) => nameOf(h) !== `${nameOf(a)} hole`)!;
    const forShape = nameOf(other).replace(/ hole$/, '');
    tap(a);
    tap(other);
    expect(sounds).toEqual(['tap', 'wrong']);
    expect(helpLine()).toBe(`That hole is for the ${forShape}.`);
    expect(doc.body.querySelector('[role="status"]')!.className).toContain('is-wrong');
    expect(other.className).toContain('is-wrong');
    expect(pressed(piece(nameOf(a)))).toBe('false');
    expect(pieces()).toHaveLength(2);
    expect(doc.activeElement).toBe(piece(nameOf(a)));
    // The ring fades; the line stays until the next pick.
    wait(700);
    expect(other.className).not.toContain('is-wrong');
    expect(helpLine()).toBe(`That hole is for the ${forShape}.`);
    tap(a);
    expect(helpLine()).toBe(`Now tap the ${nameOf(a)} hole.`);
    expect(doc.body.querySelector('[role="status"]')!.className).not.toContain('is-wrong');
  });

  it('a right placement leaves a ghost, fills the hole as an image, says the shape, shows its fact and moves focus on', () => {
    openSorter(0);
    const [a, b] = pieces();
    const name = nameOf(a);
    tap(a);
    tap(hole(name));
    expect(sounds).toEqual(['tap', 'good']);
    expect(spoken).toEqual([name]);
    // A ghost keeps the piece's place in the tray, hidden from a reader.
    expect(pieces().map(nameOf)).toEqual([nameOf(b)]);
    const ghost = tray().children[0];
    expect(ghost.className).toBe('sort-ghost');
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(tray().children).toHaveLength(2);
    // The filled hole is an image, out of the tab order.
    const filled = byRole('img', `Filled ${name} hole`, holesGroup());
    expect(filled.localName).toBe('div');
    expect(isFocusable(filled)).toBe(false);
    expect(queryRole('button', `${name} hole`)).toBeNull();
    // The fact bar: the shape's fact and its badge, named.
    const shape = sorterPuzzle(0, 0).pieces[0].shape;
    expect(factText()).toBe(SHAPE_FACT[shape]);
    const badge = doc.body.querySelector('.sort-fact__badge')!;
    expect(badge.getAttribute('role')).toBe('img');
    expect(badge.getAttribute('aria-label')).toBe(SHAPE_BADGE[shape].name);
    expect(badge.textContent).toBe(SHAPE_BADGE[shape].text);
    expect(doc.activeElement).toBe(b);
    expect(dots()).toBe('Puzzle 1 of 4. 0 solved.');
    // A tap on the filled hole does nothing, even with a piece picked.
    tap(b);
    click(filled);
    expect(pressed(b)).toBe('true');
    expect(sounds).toEqual(['tap', 'good', 'tap']);
  });

  it('the last placement solves at once: every shape is home and Next puzzle sits in the tray well with focus (board: solved)', () => {
    openSorter(0);
    sortAll();
    expect(sounds.filter((s) => s === 'win')).toHaveLength(1);
    expect(sounds).not.toContain('wrong');
    expect(helpLine()).toBe('Every shape is home.');
    expect(dots()).toBe('Puzzle 1 of 4. 1 solved.');
    const next = button('Next puzzle');
    expect(next.closest('.bw-play__slot')!.className).toContain('sort-well');
    expect(doc.activeElement).toBe(next);
    expect(storedRun('sorter', 0)!.solved).toEqual([{ puzzle: 0, count: 0, usedHint: false, outOfTime: false }]);
    click(next);
    expect(dots()).toBe('Puzzle 2 of 4. 1 solved.');
    expect(helpLine()).toBe('Drag each shape into its hole.');
    expect(doc.activeElement).toBe(pieces()[0]);
    expect(pieces().map(nameOf)).toEqual(sorterPuzzle(0, 1).pieces.map((p) => p.shape));
  });

  it('counts the same wrong placement once for stars and every time for the offer, which comes at 3 (ages 5 to 6)', () => {
    openSorter(0);
    const [a] = pieces();
    const wrong = openHoles().find((h) => nameOf(h) !== `${nameOf(a)} hole`)!;
    for (let i = 0; i < 2; i++) {
      tap(piece(nameOf(a)));
      tap(wrong);
    }
    expect(queryRole('button', 'New puzzle')).toBeNull();
    tap(piece(nameOf(a)));
    tap(wrong);
    expect(button('New puzzle')).toBeTruthy();
    expect(helpLine()).toBe(OFFER_LINE);
    expect(sounds.filter((s) => s === 'wrong')).toHaveLength(3);
    // The offer line takes the wrong line's place, and it is not drawn as an error.
    expect(doc.body.querySelector('[role="status"]')!.className).not.toContain('is-wrong');
    sortAll();
    expect(storedRun('sorter', 0)!.solved[0]).toMatchObject({ puzzle: 0, count: 1 });
  });

  it('drags a piece into its hole with real pointer events, the line following the drag (board: dragging)', () => {
    openSorter(0);
    layOutSorter();
    const [a] = pieces();
    const name = nameOf(a);
    const target = hole(name);
    const from = centre(a);
    const to = centre(target);
    const pointer = (type: string, x: number, y: number) =>
      act(() => {
        dispatch(a, makeEvent(type, a, { pointerId: 3, button: 0, clientX: x, clientY: y }));
      });
    pointer('pointerdown', from.x, from.y);
    expect(a.captured.has(3)).toBe(true);
    // Under the 8 px threshold (x plus y travel) it is still a tap.
    pointer('pointermove', from.x + 4, from.y + 3);
    expect(helpLine()).toBe('Drag each shape into its hole.');
    pointer('pointermove', from.x + 6, from.y + 3);
    expect(helpLine()).toBe(`Drop the ${name} in its hole.`);
    expect(sounds).toEqual(['tap']);
    expect(a.style.getPropertyValue('--drag-x')).toBe('6px');
    expect(a.style.getPropertyValue('--drag-y')).toBe('3px');
    pointer('pointermove', to.x, to.y);
    pointer('pointerup', to.x, to.y);
    expect(byRole('img', `Filled ${name} hole`)).toBeTruthy();
    expect(spoken).toEqual([name]);
    expect(sounds).toEqual(['tap', 'good']);
  });

  it('a drag released off every hole, or cut off by the system, goes back with no slip; the click after a drag is ignored and the next tap works', () => {
    openSorter(0);
    layOutSorter();
    const [a] = pieces();
    const name = nameOf(a);
    drag(a, { x: 380, y: 820 });
    expect(pieces().map(nameOf)).toContain(name);
    expect(a.style.getPropertyValue('--drag-x')).toBe('');
    expect(helpLine()).toBe('Drag each shape into its hole.');
    // The click the browser sent after the drag did not pick the piece.
    expect(pressed(a)).toBe('false');
    drag(a, hole(name), { cancel: true });
    expect(pieces().map(nameOf)).toContain(name);
    expect(sounds).not.toContain('wrong');
    expect(sounds).not.toContain('good');
    tap(a);
    expect(pressed(a)).toBe('true');
    // A drop on a filled hole is no slip either: place one piece, then drag the other onto its hole.
    tap(hole(name));
    const [b] = pieces();
    const filled = byRole('img', `Filled ${name} hole`);
    filled.box = { left: 250, top: 400, width: 92, height: 92 };
    drag(b, filled);
    expect(sounds).not.toContain('wrong');
    expect(pieces().map(nameOf)).toEqual([nameOf(b)]);
    expect(helpLine()).toBe('Drag each shape into its hole.');
  });

  it('divides the drag offset by the tablet zoom (834 x 1194 is zoom 1.4)', () => {
    const win = window as unknown as { innerWidth: number; innerHeight: number };
    win.innerWidth = 834;
    win.innerHeight = 1194;
    openSorter(0);
    layOutSorter();
    const [a] = pieces();
    const from = centre(a);
    const pointer = (type: string, x: number, y: number) =>
      act(() => {
        dispatch(a, makeEvent(type, a, { pointerId: 4, button: 0, clientX: x, clientY: y }));
      });
    pointer('pointerdown', from.x, from.y);
    pointer('pointermove', from.x + 28, from.y - 14);
    expect(a.style.getPropertyValue('--drag-x')).toBe('20px');
    expect(a.style.getPropertyValue('--drag-y')).toBe('-10px');
  });

  it('plays from the keyboard: Enter picks a piece and focus goes to the first open hole, Escape puts it down, Enter on its hole places it', () => {
    openSorter(0);
    const [a, b] = pieces();
    a.focus();
    press('Enter');
    expect(pressed(a)).toBe('true');
    expect(doc.activeElement).toBe(openHoles()[0]);
    press('Escape');
    expect(pressed(a)).toBe('false');
    expect(doc.activeElement).toBe(a);
    press('Enter');
    hole(nameOf(a)).focus();
    press('Enter');
    expect(byRole('img', `Filled ${nameOf(a)} hole`)).toBeTruthy();
    expect(doc.activeElement).toBe(b);
  });

  it('the speaker reads the help line, then the fact bar', () => {
    openSorter(0);
    click(button('Hear the help line'));
    expect(spoken).toEqual(['Drag each shape into its hole. Every shape has a home. Look at the corners.']);
  });
});

describe('Shape Sorter: a colour level (Level 5)', () => {
  const board = sorterPuzzle(4, 0);
  const find = (test: (p: SorterPiece, h: SorterPiece) => boolean) => {
    for (const p of board.pieces) for (const h of board.holes) if (h.id !== p.id && test(p, h)) return { p, h };
    throw new Error('No such pair on the board');
  };

  it('names pieces and holes by colour and shape, with the colour prompt and fact (board: SorterColors)', () => {
    openSorter(4);
    expect(helpLine()).toBe('Match the shape and the color.');
    expect(factText()).toBe('Look closely: each hole has a color too.');
    expect(pieces().map(nameOf)).toEqual(board.pieces.map((p) => `${p.color} ${p.shape}`));
    expect(openHoles().map(nameOf)).toEqual(board.holes.map((h) => `${h.color} ${h.shape} hole`));
    // Level 5's board has no green piece (9.4).
    expect(board.pieces.some((p) => p.color === 'green')).toBe(false);
  });

  it('says what matched on a wrong hole: the same shape, the same colour, or neither', () => {
    openSorter(4, '9-10');
    const shape = find((p, h) => p.shape === h.shape);
    tap(piece(sorterName(shape.p, true)));
    tap(hole(sorterName(shape.h, true)));
    expect(helpLine()).toBe(`Same shape, but this hole is ${shape.h.color}.`);
    const color = find((p, h) => p.color === h.color && p.shape !== h.shape);
    tap(piece(sorterName(color.p, true)));
    expect(helpLine()).toBe(`Now tap the ${sorterName(color.p, true)} hole.`);
    tap(hole(sorterName(color.h, true)));
    expect(helpLine()).toBe(`Same color, but this hole is a ${color.h.shape}.`);
    const neither = find((p, h) => p.color !== h.color && p.shape !== h.shape);
    tap(piece(sorterName(neither.p, true)));
    tap(hole(sorterName(neither.h, true)));
    expect(helpLine()).toBe(`That hole is for the ${neither.h.color} ${neither.h.shape}.`);
    // A right placement says the colour and the shape.
    tap(piece(sorterName(board.pieces[0], true)));
    tap(hole(sorterName(board.pieces[0], true)));
    expect(spoken).toEqual([sorterName(board.pieces[0], true)]);
    expect(byRole('img', `Filled ${sorterName(board.pieces[0], true)} hole`)).toBeTruthy();
  });

  it('fits a piece only in the hole with its shape and its colour, and solves when all six are home', () => {
    openSorter(4);
    sortAll();
    expect(helpLine()).toBe('Every shape is home.');
    expect(storedRun('sorter', 4)!.solved[0]).toMatchObject({ count: 0 });
  });
});

describe('Shape Sorter: eight pieces, the level’s end and the finished state', () => {
  it('lays eight pieces out four to a row on a phone (board: SorterBig)', () => {
    openSorter(6);
    expect(pieces()).toHaveLength(8);
    expect(openHoles()).toHaveLength(8);
    expect(doc.body.querySelector('.bw-play')!.className).toContain('sort--rows-2');
    expect(tray().style.getPropertyValue('--sort-cols')).toBe('4');
  });

  it('takes all eight in one row on a tablet', () => {
    const win = window as unknown as { innerWidth: number; innerHeight: number };
    win.innerWidth = 834;
    win.innerHeight = 1194;
    openSorter(6);
    expect(doc.body.querySelector('.bw-play')!.className).toContain('sort--rows-1');
    expect(tray().className).toContain('is-tight');
    expect(tray().style.getPropertyValue('--sort-cols')).toBe('8');
  });

  it('finishes the level on the fourth board, with the slips on the card (board: levelDone)', () => {
    openSorter(0);
    for (let n = 0; n < 4; n++) {
      if (n === 1) {
        // One slip on the second board.
        const [a] = pieces();
        tap(a);
        tap(openHoles().find((h) => nameOf(h) !== `${nameOf(a)} hole`)!);
      }
      sortAll();
      if (n < 3) click(button('Next puzzle'));
    }
    const dialog = openCard();
    expect(byRole('heading', 'You finished Level 1', dialog)).toBeTruthy();
    expect(dialog.textContent).toContain('4 puzzles, 1 slip.');
    expect(byRole('img', '3 of 3 stars', dialog)).toBeTruthy();
    expect(storedStars('sorter', 0)).toBe(3);
    // A tap on the scrim closes the card, as Escape does: Play Level 2 then sits in the tray well, with focus.
    click(doc.body.querySelector('.bw-levelcard-scrim')!);
    expect(card()).toBeNull();
    const play = button('Play Level 2');
    expect(play.closest('.bw-play__slot')!.className).toContain('sort-well');
    expect(doc.activeElement).toBe(play);
    click(play);
    expect(hash()).toBe('#/game/sorter/2');
  });

  it('shows the empty holes panel and tray well behind the finished card (board: gameDone)', () => {
    child();
    progressStore.recordStars('sorter', 0, 3);
    for (let i = 1; i < 9; i++) progressStore.recordStars('sorter', i, 2);
    mount(createElement(SorterApp, { params: [] }));
    const done = card()!;
    expect(byRole('heading', 'You finished every level!', done)).toBeTruthy();
    expect(done.textContent).toContain('9 levels, 19 of 27 stars.');
    const behind = doc.body.querySelector('.bw-play__body')!;
    expect(isHidden(behind)).toBe(true);
    expect(behind.querySelector('.sort-holes.is-empty')).not.toBeNull();
    expect(behind.querySelector('.sort-well.is-empty')).not.toBeNull();
    expect(behind.querySelectorAll('button')).toHaveLength(0);
  });
});

/* =====================================================================================================
 * Number Line-up
 * ===================================================================================================== */

const towers = () => allByRole('button', /^Tower of /);
/** The towers left to right, read from their names ("Tower of 4, spot 2 of 6, ..."). */
function row(): number[] {
  return towers().map((t, i) => {
    const m = /^Tower of (\d+), spot (\d) of 6, (in|not in) the right spot$/.exec(nameOf(t));
    if (!m) throw new Error(`Not a tower name: ${nameOf(t)}`);
    expect(Number(m[2])).toBe(i + 1);
    return Number(m[1]);
  });
}
const goalText = () => doc.body.querySelector('.num-goal__text')!.textContent;
const dirNow = (): 'up' | 'down' => (/smallest first/.test(goalText()) ? 'up' : 'down');
const goalOfRow = (r: number[]) => [...r].sort((a, b) => (dirNow() === 'up' ? a - b : b - a));
const hintButton = () => button(/^Hint, \d left$/);
const marks = () => doc.body.querySelectorAll('.num-mark');
const rightMarks = () => doc.body.querySelectorAll('.num-mark.is-right').length;

/** Swap the towers in spots i and j by two taps. */
function swapTowers(i: number, j: number) {
  tap(towers()[i]);
  tap(towers()[j]);
}

/** The next swap toward the goal: the tower that belongs in the first wrong spot, onto that spot. */
function forwardSwap(): [number, number] {
  const r = row();
  const goal = goalOfRow(r);
  const to = r.findIndex((v, i) => v !== goal[i]);
  return [r.indexOf(goal[to]), to];
}

/** Two neighbours already in the level's order: swapping them moves the row further from done. */
function backwardSwap(): [number, number] {
  const r = row();
  for (let i = 0; i + 1 < r.length; i++) if (swapKind(r, i, i + 1, dirNow()) === 'backward') return [i, i + 1];
  throw new Error('No backward swap');
}

function solveNumbers() {
  for (let guard = 0; guard < 10 && queryRole('button', 'Next puzzle') === null && towers().some((t) => t.getAttribute('aria-disabled') !== 'true'); guard++) {
    const [a, b] = forwardSwap();
    swapTowers(a, b);
  }
}

function openNumbers(level = 0, band: AgeBand = '5-6') {
  child(band);
  starUpTo('numbers', level);
  return mount(createElement(NumbersApp, { params: [String(level + 1)] }));
}

describe('Number Line-up: the stairs (Level 1)', () => {
  it('opens with the goal strip, the prompt, six named towers, the legend and Hint with 3 left (board: play)', () => {
    openNumbers(0);
    expect(byRole('heading', 'Level 1')).toBeTruthy();
    expect(dots()).toBe('Puzzle 1 of 4. 0 solved.');
    expect(doc.body.querySelector('.num-goal__label')!.textContent).toBe('GOAL');
    expect(goalText()).toBe('Line up 1 to 6, smallest first, so the towers make stairs going up.');
    expect(doc.body.querySelector('.num-goal__bars')!.getAttribute('aria-hidden')).toBe('true');
    expect(helpLine()).toBe('Drag or tap two towers to swap them.');
    expect(doc.body.querySelector('[role="status"]')!.className).toBe('bw-helprow__line bw-helprow__line--prompt');
    const r = row();
    expect([...r].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    // Not already in order, and each name says whether the tower stands in its right spot.
    expect(inversions(r, 'up')).toBeGreaterThan(0);
    towers().forEach((t, i) => {
      expect(nameOf(t)).toBe(`Tower of ${r[i]}, spot ${i + 1} of 6, ${r[i] === i + 1 ? 'in' : 'not in'} the right spot`);
      expect(pressed(t)).toBe('false');
      // Stairs towers are as many bricks high as their number.
      expect(t.querySelectorAll('.num-stud')).toHaveLength(r[i] - 1);
    });
    // The marks are hidden from a reader: the tower names carry them.
    expect(doc.body.querySelector('.num-well__marks')!.getAttribute('aria-hidden')).toBe('true');
    expect(marks()).toHaveLength(6);
    expect(rightMarks()).toBe(r.filter((v, i) => v === i + 1).length);
    expect(doc.body.querySelector('.bw-play__controls')!.textContent).toBe('A filled green line means that tower is in the right spot.');
    const hint = hintButton();
    expect(nameOf(hint)).toBe('Hint, 3 left');
    expect(hint.parentElement!.className).toBe('bw-helprow__hint');
    expect(hint.getAttribute('aria-disabled')).toBeNull();
    expect(button('Hear the help line')).toBeTruthy();
    expect(spoken).toEqual([]);
    expect(sounds).toEqual([]);
  });

  it('a tap lifts a tower, a tap on it puts it down (board: picked)', () => {
    openNumbers(0);
    const [t] = towers();
    tap(t);
    expect(sounds).toEqual(['tap']);
    expect(pressed(t)).toBe('true');
    expect(t.className).toContain('is-picked');
    expect(helpLine()).toBe('Now tap where it should go.');
    tap(t);
    expect(pressed(towers()[0])).toBe('false');
    expect(helpLine()).toBe('Drag or tap two towers to swap them.');
  });

  it('a forward swap is progress; a backward one is a slip, and every backward one counts (no key)', () => {
    openNumbers(0, '9-10');
    const before = row();
    const [a, b] = forwardSwap();
    swapTowers(a, b);
    expect(sounds).toEqual(['tap', 'good']);
    const after = row();
    expect(after[a]).toBe(before[b]);
    expect(after[b]).toBe(before[a]);
    expect(inversions(after, 'up')).toBeLessThan(inversions(before, 'up'));
    expect(helpLine()).toBe('Drag or tap two towers to swap them.');
    expect(rightMarks()).toBe(after.filter((v, i) => v === i + 1).length);
    // Two backward swaps: the same towers back and forth still count twice.
    const [c, d] = backwardSwap();
    swapTowers(c, d);
    expect(sounds.at(-1)).toBe('wrong');
    swapTowers(c, d);
    expect(sounds.at(-1)).toBe('good');
    swapTowers(c, d);
    expect(sounds.filter((s) => s === 'wrong')).toHaveLength(2);
    solveNumbers();
    expect(storedRun('numbers', 0)!.solved[0]).toMatchObject({ count: 2, usedHint: false });
  });

  it('brings the offer at the third backward swap for ages 5 to 6, with Hint still on the right', () => {
    openNumbers(0);
    for (let i = 0; i < 3; i++) {
      const [c, d] = backwardSwap();
      swapTowers(c, d);
    }
    expect(button('New puzzle')).toBeTruthy();
    expect(helpLine()).toBe(OFFER_LINE);
    // Hint and offer can show together.
    expect(hintButton().getAttribute('aria-disabled')).toBeNull();
    const cells = [...doc.body.querySelector('.bw-helprow')!.children].map((c) => c.className);
    expect(cells).toEqual(['bw-helprow__line bw-helprow__line--prompt', 'bw-helprow__hint', 'bw-helprow__offer']);
    click(button('New puzzle'));
    expect(helpLine()).toBe(SWAPPED_LINE);
    expect(dots()).toBe('Puzzle 1 of 4. 0 solved.');
    // Focus went with the offer button, so it lands on the first tower.
    expect(doc.activeElement).toBe(towers()[0]);
  });

  it('a hint lifts nothing, rings two towers with an arrow, counts down the badge and stays until the next swap (board: hint)', () => {
    openNumbers(0);
    tap(towers()[0]);
    const r = row();
    const goal = goalOfRow(r);
    const to = r.findIndex((v, i) => v !== goal[i]);
    const from = r.indexOf(goal[to]);
    click(hintButton());
    expect(nameOf(hintButton())).toBe('Hint, 2 left');
    expect(hintButton().querySelector('.bw-iconbtn__badge')!.textContent).toBe('2');
    const SPOTS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
    expect(helpLine()).toBe(`${goal[to]} belongs in the ${SPOTS[to]} spot. Swap them.`);
    // The hint clears the pick.
    expect(towers().every((t) => pressed(t) === 'false')).toBe(true);
    const lit = towers().filter((t) => t.querySelector('.num-stack.is-lit'));
    expect(lit).toEqual([towers()[Math.min(from, to)], towers()[Math.max(from, to)]]);
    expect(towers()[from].querySelector('svg.num-arrow')).not.toBeNull();
    expect(towers().filter((t) => t.querySelector('svg.num-arrow'))).toHaveLength(1);
    expect(sounds).toEqual(['tap', 'tap']);
    // The hint stays through a pick, and goes with the next swap.
    tap(towers()[from]);
    expect(helpLine()).toBe(`${goal[to]} belongs in the ${SPOTS[to]} spot. Swap them.`);
    tap(towers()[to]);
    expect(helpLine()).toBe('Drag or tap two towers to swap them.');
    expect(doc.body.querySelector('.num-stack.is-lit')).toBeNull();
    expect(row()[to]).toBe(goal[to]);
  });

  it('the hint runs out at 0 and is off after the solve, still named so a reader hears how many are left', () => {
    openNumbers(0);
    for (const left of [2, 1, 0]) {
      click(hintButton());
      expect(nameOf(hintButton())).toBe(`Hint, ${left} left`);
    }
    expect(hintButton().getAttribute('aria-disabled')).toBe('true');
    const line = helpLine();
    const heard = sounds.length;
    click(hintButton());
    expect(nameOf(hintButton())).toBe('Hint, 0 left');
    expect(helpLine()).toBe(line);
    expect(sounds.length).toBe(heard);
    expect(storedRun('numbers', 0)!.hintsLeft).toBe(0);
  });

  it('following the hints solves in the fewest swaps; the solved row locks, every mark fills and Next takes focus (board: solved)', () => {
    openNumbers(0);
    let swaps = 0;
    while (queryRole('button', 'Next puzzle') === null && swaps < 6) {
      click(hintButton());
      const [a, b] = forwardSwap();
      swapTowers(a, b);
      swaps++;
    }
    // Level 1 needs 2 swaps.
    expect(swaps).toBe(2);
    expect(sounds.at(-1)).toBe('win');
    expect(helpLine()).toBe('Stairs going up: 1, 2, 3, 4, 5, 6.');
    expect(row()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rightMarks()).toBe(6);
    for (const t of towers()) expect(t.getAttribute('aria-disabled')).toBe('true');
    expect(hintButton().getAttribute('aria-disabled')).toBe('true');
    const next = button('Next puzzle');
    expect(doc.activeElement).toBe(next);
    // A tap on a locked tower does nothing.
    const heard = sounds.length;
    tap(towers()[0]);
    expect(sounds.length).toBe(heard);
    expect(storedRun('numbers', 0)!.solved[0]).toMatchObject({ count: 0, usedHint: true });
    // After Next, focus goes to the first tower, the game's first control.
    click(next);
    expect(towers()[0].hasAttribute('data-kit-first')).toBe(true);
    expect(doc.activeElement).toBe(towers()[0]);
    expect(nameOf(hintButton())).toBe('Hint, 1 left');
  });

  it('plays from the keyboard: Enter on one tower and then another swaps them, and Space does too', () => {
    openNumbers(0);
    const before = row();
    const [a, b] = forwardSwap();
    towers()[a].focus();
    press('Enter');
    expect(pressed(towers()[a])).toBe('true');
    towers()[b].focus();
    press('Enter');
    expect(row()[b]).toBe(before[a]);
    expect(row()[a]).toBe(before[b]);
    const mid = row();
    const [c, d] = forwardSwap();
    towers()[c].focus();
    press(' ');
    towers()[d].focus();
    press(' ');
    expect(row()[d]).toBe(mid[c]);
    expect(sounds.filter((s) => s === 'good' || s === 'win').length).toBe(2);
  });

  it('the speaker reads the goal and the help line, and once solved the solved line', () => {
    openNumbers(0);
    click(button('Hear the help line'));
    expect(spoken).toEqual(['Line up 1 to 6, smallest first, so the towers make stairs going up. Drag or tap two towers to swap them.']);
    solveNumbers();
    click(button('Hear the help line'));
    expect(spoken[1]).toBe('Stairs going up: 1, 2, 3, 4, 5, 6.');
  });

  it('swaps by dragging one tower onto another with real pointer events; a drag let go over empty space goes back', () => {
    openNumbers(0);
    towers().forEach((t, i) => (t.box = { left: 12 + i * 58, top: 300, width: 52, height: 240 }));
    const before = row();
    drag(towers()[0], { x: 200, y: 700 });
    expect(row()).toEqual(before);
    expect(sounds).toEqual(['tap']);
    const [a, b] = forwardSwap();
    drag(towers()[a], towers()[b]);
    const after = row();
    expect(after[a]).toBe(before[b]);
    expect(after[b]).toBe(before[a]);
    expect(sounds).toEqual(['tap', 'tap', 'good']);
    // The click after the drag picked nothing.
    expect(towers().every((t) => pressed(t) === 'false')).toBe(true);
  });

  it('finishes Level 1 with its stars, and caps the level at 2 stars when a hint helped a solved puzzle (board: levelDone)', () => {
    openNumbers(0);
    for (let n = 0; n < 4; n++) {
      if (n === 2) click(hintButton());
      solveNumbers();
      if (n < 3) click(button('Next puzzle'));
    }
    const dialog = openCard();
    expect(byRole('heading', 'You finished Level 1', dialog)).toBeTruthy();
    expect(dialog.textContent).toContain('4 puzzles, no slips.');
    expect(dialog.textContent).toContain('Using a hint caps the level at 2 stars.');
    expect(byRole('img', '2 of 3 stars', dialog)).toBeTruthy();
    expect(storedStars('numbers', 0)).toBe(2);
  });

  it('a hint spent on a puzzle swapped away stays spent but does not cap the level', () => {
    openNumbers(0, '3-4');
    click(hintButton());
    for (let i = 0; i < 3; i++) {
      const [c, d] = backwardSwap();
      swapTowers(c, d);
    }
    click(button('New puzzle'));
    expect(nameOf(hintButton())).toBe('Hint, 2 left');
    for (let n = 0; n < 4; n++) {
      solveNumbers();
      if (n < 3) click(button('Next puzzle'));
    }
    const dialog = openCard();
    expect(dialog.textContent).toContain('4 puzzles, no slips.');
    expect(dialog.textContent).not.toContain('Using a hint');
    expect(byRole('img', '3 of 3 stars', dialog)).toBeTruthy();
  });
});

describe('Number Line-up: bigger numbers (Levels 9 to 12)', () => {
  it('draws one-brick towers with the band’s numbers and a goal strip without numbers (board: NumbersBig)', () => {
    openNumbers(8, '9-10');
    expect(goalText()).toBe('Line up the numbers, smallest first.');
    const r = row();
    expect(new Set(r).size).toBe(6);
    for (const v of r) expect(v >= 1 && v <= 999).toBe(true);
    towers().forEach((t, i) => {
      expect(t.querySelectorAll('.num-stud')).toHaveLength(0);
      // Three-digit numbers get the face's three-digit size.
      expect(t.getAttribute('data-digits')).toBe(String(String(r[i]).length));
    });
    for (const bar of doc.body.querySelectorAll('.num-goal__bar')) expect(bar.hasAttribute('data-brick')).toBe(false);
    solveNumbers();
    const goal = [...r].sort((a, b) => a - b);
    expect(helpLine()).toBe(`In order: ${goal.join(', ')}.`);
  });

  it('counts by one even step on Level 11 at ages 7 to 8', () => {
    openNumbers(10, '7-8');
    const goal = [...row()].sort((a, b) => a - b);
    const step = goal[1] - goal[0];
    expect([5, 10]).toContain(step);
    goal.forEach((v, i) => expect(v).toBe(goal[0] + i * step));
  });

  it('keeps the puzzle on screen when the age band changes mid-level, keeps the solved ones, and takes the new band’s numbers from the next puzzle', () => {
    const maya = child('3-4');
    starUpTo('numbers', 8);
    mount(createElement(NumbersApp, { params: ['9'] }));
    for (let n = 0; n < 2; n++) {
      for (const v of row()) expect(v).toBeLessThanOrEqual(10);
      solveNumbers();
      click(button('Next puzzle'));
    }
    expect(storedRun('numbers', 8)!.set).toBe('numbers:1:3-4');
    const onScreen = row();
    // A grown-up moves Maya to ages 9 to 10 while the third puzzle is on screen.
    act(() => progressStore.updatePlayer(maya.id, { ageBand: '9-10' }));
    expect(row()).toEqual(onScreen);
    solveNumbers();
    expect(dots()).toBe('Puzzle 3 of 4. 3 solved.');
    click(button('Next puzzle'));
    const run = storedRun('numbers', 8)!;
    expect(run.set).toBe('numbers:1:9-10');
    expect(run.solved).toHaveLength(3);
    expect(dots()).toBe('Puzzle 4 of 4. 3 solved.');
    expect(Math.max(...row())).toBeGreaterThan(10);
    solveNumbers();
    const dialog = openCard();
    expect(byRole('heading', 'You finished Level 9', dialog)).toBeTruthy();
  });
});

/* =====================================================================================================
 * Stored runs on screen: a saved level resumes, a corrupt one restarts at puzzle 1 (10.1, 10.2)
 * ===================================================================================================== */

describe('a stored run on screen', () => {
  const mixerPuzzleAt = (level: number, n: number, seed: number) => {
    const p = mixerPuzzle(level, n, { seed, band: '5-6' });
    if (p.form !== 'finish') throw new Error('Expected a Finish puzzle');
    return p;
  };
  const numbersPuzzleAt = (level: number, n: number, seed: number) => numbersPuzzle(level, n, { seed, band: '5-6' });
  const openNumbersAs = () => mount(createElement(NumbersApp, { params: ['1'] }));
  const solvedResult = (puzzle: number, count = 0) => ({ puzzle, count, usedHint: false, outOfTime: false });
  /** A saved record with one run for level 0 of `game`, loaded the way the store loads storage (sanitize). */
  function load(game: string, run: unknown) {
    progressStore.replace({
      version: 3,
      players: [{ id: 'maya', name: 'Maya', ageBand: '5-6', color: 'blue', games: { [game]: { unlocked: 0, stars: {}, best: {}, runs: { 0: run } } } }],
      activePlayerId: 'maya',
    } as unknown as Parameters<typeof progressStore.replace>[0]);
  }

  it('Color Mixer resumes at the next unsolved puzzle with the run’s own seed', () => {
    load('mixer', { set: 'mixer:1', seed: 4242, queue: [3, 4, 5, 2], solved: [solvedResult(0), solvedResult(1, 2)], updatedAt: 1 });
    openMixer(0);
    expect(dots()).toBe('Puzzle 3 of 4. 2 solved.');
    const p = mixerOnScreen();
    if (p.form !== 'finish') throw new Error('Level 1 is Finish');
    const want = mixerPuzzleAt(0, 3, 4242);
    expect(`${p.goal}|${p.given}`).toBe(`${want.goal}|${want.given}`);
  });

  it('Number Line-up resumes with its spent hints', () => {
    load('numbers', { set: 'numbers:1:5-6', seed: 99, queue: [1, 2, 3, 4, 5], solved: [solvedResult(0)], hintsLeft: 1, updatedAt: 1 });
    openNumbersAs();
    expect(dots()).toBe('Puzzle 2 of 4. 1 solved.');
    expect(nameOf(hintButton())).toBe('Hint, 1 left');
    expect(row()).toEqual(numbersPuzzleAt(0, 1, 99).start);
  });

  for (const [what, run] of [
    ['a puzzle number past 5', { set: 'mixer:1', seed: 1, queue: [2, 3, 6], solved: [solvedResult(0)], updatedAt: 1 }],
    ['a repeated puzzle', { set: 'mixer:1', seed: 1, queue: [2, 2, 4, 5], solved: [solvedResult(0)], updatedAt: 1 }],
    ['negative slips', { set: 'mixer:1', seed: 1, queue: [2, 3, 4, 5], solved: [solvedResult(0), solvedResult(1, -3)], updatedAt: 1 }],
    ['a negative seed', { set: 'mixer:1', seed: -4, queue: [1, 2, 3, 4, 5], solved: [solvedResult(0)], updatedAt: 1 }],
    ['no queue', { set: 'mixer:1', seed: 1, solved: [], updatedAt: 1 }],
  ] as const) {
    it(`Color Mixer drops a run with ${what} and starts the level at puzzle 1`, () => {
      load('mixer', run);
      expect(storedRun('mixer', 0)).toBeNull();
      openMixer(0);
      expect(dots()).toBe('Puzzle 1 of 4. 0 solved.');
      expect(storedRun('mixer', 0)).toMatchObject({ set: 'mixer:1', queue: [0, 1, 2, 3, 4, 5], solved: [] });
    });
  }

  it('Number Line-up drops a run with more hints left than a level has, and starts over with 3', () => {
    load('numbers', { set: 'numbers:1:5-6', seed: 99, queue: [1, 2, 3, 4, 5], solved: [solvedResult(0)], hintsLeft: 7, updatedAt: 1 });
    expect(storedRun('numbers', 0)).toBeNull();
    openNumbersAs();
    expect(dots()).toBe('Puzzle 1 of 4. 0 solved.');
    expect(nameOf(hintButton())).toBe('Hint, 3 left');
  });

  it('Number Line-up restarts a run saved under another set version, even though it keeps solved puzzles across bands', () => {
    load('numbers', { set: 'numbers:2:5-6', seed: 99, queue: [1, 2, 3, 4, 5], solved: [solvedResult(0)], hintsLeft: 2, updatedAt: 1 });
    openNumbersAs();
    // A raised set version restarts the level, even for a keepSolved game.
    expect(dots()).toBe('Puzzle 1 of 4. 0 solved.');
    expect(storedRun('numbers', 0)).toMatchObject({ set: 'numbers:1:5-6', solved: [], hintsLeft: 3 });
  });
});

describe('Number Line-up: the finished state', () => {
  it('shows the empty tower well behind the finished card (board: gameDone)', () => {
    child();
    starUpTo('numbers', 12);
    mount(createElement(NumbersApp, { params: [] }));
    const dialog = card()!;
    expect(byRole('heading', 'You finished every level!', dialog)).toBeTruthy();
    expect(dialog.textContent).toContain('12 levels, 36 of 36 stars.');
    const behind = doc.body.querySelector('.bw-play__body')!;
    expect(isHidden(behind)).toBe(true);
    expect(behind.querySelectorAll('.num-tower')).toHaveLength(0);
    expect(behind.querySelectorAll('.num-mark')).toHaveLength(6);
    expect(behind.querySelectorAll('.num-mark.is-right')).toHaveLength(0);
    expect(byRole('heading', 'Number Line-up')).toBeTruthy();
  });
});
