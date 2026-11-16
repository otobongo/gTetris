/**
 * The drag hook with `takeover` on (the kit drag takeover): a palm or a second hand resting on one
 * tray piece must not block a real drag of another. A new finger takes over a press that never moved,
 * the resting finger's capture is let go, and its lift and the click after it pick nothing.
 *
 * The hook runs in a real React root. The browser parts are stand-ins, as in useDragToTarget.review.test.ts:
 * the window, the elements (their rects, style and pointer capture) and the pointer events.
 */
import { act, createElement, type MouseEvent, type PointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAG_X, useDragToTarget, type DragApi, type UseDragToTargetOptions } from './useDragToTarget';

type Item = 'red' | 'blue';
type Hole = 'circle' | 'square';

const doc = { activeElement: null, body: null, addEventListener() {}, removeEventListener() {}, defaultView: null as unknown };
const win = { event: undefined, document: doc, innerWidth: 390, innerHeight: 844, HTMLIFrameElement: class {}, addEventListener() {}, removeEventListener() {} };
doc.defaultView = win;

beforeEach(() => {
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});

const roots: (() => void)[] = [];
afterEach(() => {
  roots.splice(0).forEach((unmount) => unmount());
  vi.unstubAllGlobals();
});

/** A button on the board: its screen rect, the CSS variables written on it and the pointers it holds. */
function element(left: number, top: number, size = 50) {
  const vars = new Map<string, string>();
  const captured = new Set<number>();
  return {
    vars,
    captured,
    style: {
      setProperty: (k: string, v: string) => void vars.set(k, v),
      removeProperty: (k: string) => {
        vars.delete(k);
        return '';
      },
    },
    getBoundingClientRect: () => ({ left, top, right: left + size, bottom: top + size, x: left, y: top, width: size, height: size }),
    setPointerCapture: (id: number) => void captured.add(id),
    hasPointerCapture: (id: number) => captured.has(id),
    releasePointerCapture: (id: number) => void captured.delete(id),
  };
}

/** A Sorter-like board: red at 0,0 and blue at 100,0 in the tray, the circle hole at 0,200 and the square at 100,200. */
function board(over: Partial<UseDragToTargetOptions<Item, Hole>> = {}) {
  const log: string[] = [];
  const options: UseDragToTargetOptions<Item, Hole> = {
    onDrop: (item, target, how) => void log.push(`drop ${item} on ${target} by ${how}`),
    onMiss: (item) => void log.push(`miss ${item}`),
    onPick: (item) => void log.push(`pick ${item}`),
    onDragStart: (item) => void log.push(`start ${item}`),
    takeover: true,
    ...over,
  };
  let latest: DragApi<Item, Hole> | undefined;
  function Probe() {
    latest = useDragToTarget<Item, Hole>(options);
    return null;
  }
  const container = { nodeType: 1, nodeName: 'DIV', tagName: 'DIV', namespaceURI: 'http://www.w3.org/1999/xhtml', ownerDocument: doc, textContent: '', addEventListener() {}, removeEventListener() {} };
  const root = createRoot(container as unknown as globalThis.Element);
  act(() => root.render(createElement(Probe)));
  roots.push(() => act(() => root.unmount()));
  const api = () => latest!;

  const els = { red: element(0, 0), blue: element(100, 0), circle: element(0, 200), square: element(100, 200) };
  act(() => {
    api().item('red').ref(els.red as unknown as HTMLElement);
    api().item('blue').ref(els.blue as unknown as HTMLElement);
    api().target('circle').ref(els.circle as unknown as HTMLElement);
    api().target('square').ref(els.square as unknown as HTMLElement);
  });

  const pointer = (item: Item, x: number, y: number, pointerId: number) =>
    ({ pointerId, clientX: x, clientY: y, button: 0, currentTarget: els[item], detail: 1 }) as unknown as PointerEvent<HTMLElement>;
  const clickEvent = (keyboard: boolean) => ({ detail: keyboard ? 0 : 1 }) as unknown as MouseEvent<HTMLElement>;

  return {
    log,
    els,
    api,
    down: (item: Item, x: number, y: number, id: number) => act(() => api().item(item).onPointerDown(pointer(item, x, y, id))),
    move: (item: Item, x: number, y: number, id: number) => act(() => api().item(item).onPointerMove(pointer(item, x, y, id))),
    up: (item: Item, x: number, y: number, id: number) => act(() => api().item(item).onPointerUp(pointer(item, x, y, id))),
    lost: (item: Item, id: number) => act(() => api().item(item).onLostPointerCapture(pointer(item, 0, 0, id))),
    click: (item: Item, { keyboard = false } = {}) => act(() => api().item(item).onClick(clickEvent(keyboard))),
    clickHole: (hole: Hole) => act(() => api().target(hole).onClick(clickEvent(false))),
  };
}

describe('takeover: a resting palm on one piece', () => {
  it('a still touch on red, then a drag of blue onto the square, drops blue there', () => {
    const b = board();
    b.down('red', 25, 25, 1);
    b.down('blue', 125, 25, 2);
    b.move('blue', 125, 225, 2);
    expect(b.api().dragging).toBe('blue');
    expect(b.els.blue.vars.get(DRAG_X)).toBe('0px');
    b.up('blue', 125, 225, 2);
    expect(b.log).toEqual(['start blue', 'drop blue on square by drag']);
    expect(b.els.red.vars.size).toBe(0);
  });

  it('lets go of the resting finger’s capture when the new finger takes over', () => {
    const b = board();
    b.down('red', 25, 25, 1);
    expect(b.els.red.captured.has(1)).toBe(true);
    b.down('blue', 125, 25, 2);
    expect(b.els.red.captured.has(1)).toBe(false);
    expect(b.els.blue.captured.has(2)).toBe(true);
  });

  it('the lost capture that follows the release does not end the new press', () => {
    const b = board();
    b.down('red', 25, 25, 1);
    b.down('blue', 125, 25, 2);
    b.lost('red', 1);
    b.move('blue', 125, 225, 2);
    b.up('blue', 125, 225, 2);
    expect(b.log).toEqual(['start blue', 'drop blue on square by drag']);
  });

  it('the resting finger’s lift and the click after it pick nothing', () => {
    const b = board();
    b.down('red', 25, 25, 1);
    b.down('blue', 125, 25, 2);
    b.move('blue', 125, 225, 2);
    b.up('blue', 125, 225, 2);
    b.click('blue'); // the browser's click after the drag
    b.up('red', 25, 25, 1);
    b.click('red');
    expect(b.log).toEqual(['start blue', 'drop blue on square by drag']);
    expect(b.api().picked).toBeNull();
  });

  it('two still touches give one tap: the newer one picks, the resting one does not', () => {
    const b = board();
    b.down('red', 25, 25, 1);
    b.down('blue', 125, 25, 2);
    b.up('red', 25, 25, 1);
    b.click('red');
    b.up('blue', 125, 25, 2);
    b.click('blue');
    expect(b.log).toEqual(['pick blue']);
    expect(b.api().picked).toBe('blue');
  });

  it('after the resting finger’s swallowed click, the next tap on its piece counts', () => {
    const b = board();
    b.down('red', 25, 25, 1);
    b.down('blue', 125, 25, 2);
    b.up('red', 25, 25, 1);
    b.click('red');
    b.up('blue', 125, 25, 2);
    b.click('blue');
    b.down('red', 25, 25, 3);
    b.up('red', 25, 25, 3);
    b.click('red');
    expect(b.log).toEqual(['pick blue', 'pick red']);
  });

  it('a keyboard press on the resting piece still counts', () => {
    const b = board();
    b.down('red', 25, 25, 1);
    b.down('blue', 125, 25, 2);
    b.up('red', 25, 25, 1);
    b.click('red', { keyboard: true });
    expect(b.log).toEqual(['pick red']);
  });

  it('a second finger during a real drag is still ignored', () => {
    const b = board();
    b.down('red', 25, 25, 1);
    b.move('red', 25, 125, 1);
    b.down('blue', 125, 25, 2);
    b.move('blue', 125, 225, 2);
    b.up('blue', 125, 225, 2);
    expect(b.log).toEqual(['start red']);
    expect(b.api().dragging).toBe('red');
    expect(b.els.red.captured.has(1)).toBe(true);
    b.move('red', 25, 225, 1);
    b.up('red', 25, 225, 1);
    expect(b.log).toEqual(['start red', 'drop red on circle by drag']);
  });

  it('a tap on a hole after the takeover still drops the picked piece', () => {
    const b = board();
    b.down('red', 25, 25, 1);
    b.down('blue', 125, 25, 2);
    b.up('blue', 125, 25, 2);
    b.click('blue');
    b.clickHole('square');
    expect(b.log).toEqual(['pick blue', 'pick null', 'drop blue on square by tap']);
  });

  it('off by default: a second finger on a still press is ignored, as every other caller has it', () => {
    const b = board({ takeover: undefined });
    b.down('red', 25, 25, 1);
    b.down('blue', 125, 25, 2);
    b.move('blue', 125, 225, 2);
    b.up('blue', 125, 225, 2);
    expect(b.log).toEqual([]);
    expect(b.els.red.captured.has(1)).toBe(true);
  });
});
