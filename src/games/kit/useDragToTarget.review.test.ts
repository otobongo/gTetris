/**
 * Review cases for the drag hook (six-games brief 3.1, 7.2, 10.1), which had no tests of its own: the
 * 8 px threshold through the pointer handlers, the offset written as --drag-x and --drag-y on phone
 * (zoom 1) and on the tablet frame (zoom 1.4), pointer capture, a drop and a miss, pointercancel and
 * a lost capture, a second pointer during a drag, the click after a drag, the tap path, Number
 * Line-up's towers as targets, the board turned off mid-drag, and the catch area (`reach`, in the
 * frame's px, so 24 px is 33.6 screen px on the tablet frame) that Shape Sorter turns on.
 *
 * The hook runs in a real React root. The browser parts are stand-ins: the window (its size decides
 * the tablet zoom), the elements (their rects, style and pointer capture) and the pointer events.
 */
import { act, createElement, type MouseEvent, type PointerEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRAG_X, DRAG_Y, useDragToTarget, type DragApi, type UseDragToTargetOptions } from './useDragToTarget';

type Item = 'red' | 'blue';
type Hole = 'circle' | 'square';

/* ---------- The window, the elements and the events ---------- */

const doc = { activeElement: null, body: null, addEventListener() {}, removeEventListener() {}, defaultView: null as unknown };
const win = {
  event: undefined,
  document: doc,
  innerWidth: 390,
  innerHeight: 844,
  HTMLIFrameElement: class {},
  addEventListener() {},
  removeEventListener() {},
};
doc.defaultView = win;

/** A phone (zoom 1), or a tablet whose frame the layout zooms by 1.4 (834 x 1194). */
function screenOf(kind: 'phone' | 'tablet') {
  win.innerWidth = kind === 'phone' ? 390 : 834;
  win.innerHeight = kind === 'phone' ? 844 : 1194;
}

beforeEach(() => {
  screenOf('phone');
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
type Element_ = ReturnType<typeof element>;

/**
 * A Sorter-like board: two pieces in the tray (red at 0,0 and blue at 100,0, 50 px each) and two holes
 * below them (circle at 0,200 and square at 100,200). Every callback writes one line to `log`.
 */
function board(over: Partial<UseDragToTargetOptions<Item, Hole>> = {}) {
  const log: string[] = [];
  let options: UseDragToTargetOptions<Item, Hole> = {
    onDrop: (item, target, how) => void log.push(`drop ${item} on ${target} by ${how}`),
    onMiss: (item) => void log.push(`miss ${item}`),
    onPick: (item) => void log.push(`pick ${item}`),
    onDragStart: (item) => void log.push(`start ${item}`),
    ...over,
  };
  let latest: DragApi<Item, Hole> | undefined;
  function Probe() {
    latest = useDragToTarget<Item, Hole>(options);
    return null;
  }
  const container = { nodeType: 1, nodeName: 'DIV', tagName: 'DIV', namespaceURI: 'http://www.w3.org/1999/xhtml', ownerDocument: doc, textContent: '', addEventListener() {}, removeEventListener() {} };
  const root = createRoot(container as unknown as globalThis.Element);
  let renders = 0;
  const render = () => act(() => root.render(createElement(Probe, { renders: ++renders })));
  render();
  let mounted = true;
  roots.push(() => {
    if (mounted) act(() => root.unmount());
    mounted = false;
  });
  const api = () => latest!;

  const els: Record<Item | Hole, Element_> = { red: element(0, 0), blue: element(100, 0), circle: element(0, 200), square: element(100, 200) };
  act(() => {
    api().item('red').ref(els.red as unknown as HTMLElement);
    api().item('blue').ref(els.blue as unknown as HTMLElement);
    api().target('circle').ref(els.circle as unknown as HTMLElement);
    api().target('square').ref(els.square as unknown as HTMLElement);
  });

  const pointer = (item: Item, x: number, y: number, pointerId: number, button: number) =>
    ({ pointerId, clientX: x, clientY: y, button, currentTarget: els[item], detail: 1 }) as unknown as PointerEvent<HTMLElement>;
  const clickEvent = (keyboard: boolean) => ({ detail: keyboard ? 0 : 1 }) as unknown as MouseEvent<HTMLElement>;
  const isItem = (id: Item | Hole): id is Item => id === 'red' || id === 'blue';

  return {
    log,
    els,
    api,
    /** New options, as when the game re-renders (a solve turns the board off). */
    set(next: Partial<UseDragToTargetOptions<Item, Hole>>) {
      options = { ...options, ...next };
      render();
    },
    down: (item: Item, x: number, y: number, { id = 1, button = 0 } = {}) => act(() => api().item(item).onPointerDown(pointer(item, x, y, id, button))),
    move: (item: Item, x: number, y: number, { id = 1 } = {}) => act(() => api().item(item).onPointerMove(pointer(item, x, y, id, -1))),
    up: (item: Item, x: number, y: number, { id = 1 } = {}) => act(() => api().item(item).onPointerUp(pointer(item, x, y, id, 0))),
    cancel: (item: Item, { id = 1 } = {}) => act(() => api().item(item).onPointerCancel(pointer(item, 0, 0, id, 0))),
    lost: (item: Item, { id = 1 } = {}) => act(() => api().item(item).onLostPointerCapture(pointer(item, 0, 0, id, 0))),
    click: (id: Item | Hole, { keyboard = false } = {}) =>
      act(() => (isItem(id) ? api().item(id) : api().target(id)).onClick(clickEvent(keyboard))),
    /** A quick tap: press, release on the spot, and the click the browser sends after it. */
    tap(id: Item | Hole) {
      if (isItem(id)) {
        this.down(id, 25 + (id === 'blue' ? 100 : 0), 25);
        this.up(id, 25 + (id === 'blue' ? 100 : 0), 25);
      }
      this.click(id);
    },
  };
}

/* ---------- The tests ---------- */

describe('review: the 8 px threshold through the pointer handlers', () => {
  it('a press is a tap at 7 px of travel and becomes a drag at exactly 8 px', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 32, 25);
    expect(b.log).toEqual([]);
    expect(b.api().dragging).toBeNull();
    expect(b.els.red.vars.size).toBe(0);
    b.move('red', 33, 25);
    expect(b.log).toEqual(['start red']);
    expect(b.api().dragging).toBe('red');
    expect(b.els.red.vars.get(DRAG_X)).toBe('8px');
    expect(b.els.red.vars.get(DRAG_Y)).toBe('0px');
  });

  it('x and y travel add up: 4 px across and 4 px down is a drag', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 29, 28);
    expect(b.log).toEqual([]);
    b.move('red', 29, 29);
    expect(b.log).toEqual(['start red']);
  });

  it('a press released under the threshold is a tap: the click that follows picks the item', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 30, 27);
    b.up('red', 30, 27);
    b.click('red');
    expect(b.log).toEqual(['pick red']);
    expect(b.api().picked).toBe('red');
  });

  it('captures the pointer on the pressed item', () => {
    const b = board();
    b.down('red', 25, 25, { id: 7 });
    expect(b.els.red.captured.has(7)).toBe(true);
  });
});

describe('review: the offset on phone (zoom 1) and on the tablet frame (zoom 1.4)', () => {
  it('on phone the item follows the pointer px for px', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 53, 11);
    expect(b.els.red.vars.get(DRAG_X)).toBe('28px');
    expect(b.els.red.vars.get(DRAG_Y)).toBe('-14px');
  });

  it('on the tablet frame the threshold is still 8 screen px and the item moves in the frame’s px', () => {
    screenOf('tablet');
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 32, 25);
    expect(b.log).toEqual([]);
    b.move('red', 33, 25);
    expect(b.log).toEqual(['start red']);
    expect(b.els.red.vars.get(DRAG_X)).toBe(`${8 / 1.4}px`);
    b.move('red', 53, 11);
    expect(b.els.red.vars.get(DRAG_X)).toBe('20px');
    expect(b.els.red.vars.get(DRAG_Y)).toBe('-10px');
  });

  it('the hit test uses screen rects on the tablet too: a release over the hole’s screen rect drops there', () => {
    screenOf('tablet');
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 25, 120);
    b.up('red', 25, 225);
    expect(b.log).toEqual(['start red', 'drop red on circle by drag']);
  });

  it('a zoom the game passes wins over the layout’s', () => {
    screenOf('tablet');
    const b = board({ zoom: 1 });
    b.down('red', 25, 25);
    b.move('red', 53, 11);
    expect(b.els.red.vars.get(DRAG_X)).toBe('28px');
  });
});

describe('review: a drop, a miss, pointercancel and a lost capture', () => {
  it('a release over a hole drops the item there and puts it back in place', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 125, 225);
    b.up('red', 125, 225);
    expect(b.log).toEqual(['start red', 'drop red on square by drag']);
    expect(b.api().dragging).toBeNull();
    expect(b.els.red.vars.size).toBe(0);
  });

  it('a release over no hole is a miss: the item goes back, no drop', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 75, 120);
    b.up('red', 75, 120);
    expect(b.log).toEqual(['start red', 'miss red']);
    expect(b.els.red.vars.size).toBe(0);
  });

  it('pointercancel mid-drag drops the drag: no drop, no miss, the item back in place, and the release after it does nothing', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 25, 225);
    b.cancel('red');
    expect(b.log).toEqual(['start red']);
    expect(b.api().dragging).toBeNull();
    expect(b.els.red.vars.size).toBe(0);
    b.up('red', 25, 225);
    expect(b.log).toEqual(['start red']);
  });

  it('after pointercancel the next tap still counts', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 25, 225);
    b.cancel('red');
    b.tap('blue');
    b.tap('circle');
    expect(b.log).toEqual(['start red', 'pick blue', 'pick null', 'drop blue on circle by tap']);
  });

  it('a lost capture mid-drag (no pointercancel) drops the drag the same way', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 25, 225);
    b.lost('red');
    expect(b.log).toEqual(['start red']);
    expect(b.api().dragging).toBeNull();
    expect(b.els.red.vars.size).toBe(0);
  });

  it('a drag dropped by a lost capture still ignores the click its release sends: the piece is not picked', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 25, 225);
    b.lost('red');
    b.up('red', 25, 225);
    b.click('red');
    expect(b.api().picked).toBeNull();
    expect(b.log).toEqual(['start red']);
  });

  it('the lost capture the browser sends after a normal release does nothing more', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 25, 225);
    b.up('red', 25, 225);
    b.lost('red');
    expect(b.log).toEqual(['start red', 'drop red on circle by drag']);
  });
});

describe('review: a second pointer during a drag', () => {
  it('a second finger on another piece neither drags it, drops it, cancels nor picks, and the first drag goes on to its drop', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 40, 60);
    b.down('blue', 125, 25, { id: 2 });
    b.move('blue', 125, 225, { id: 2 });
    b.up('blue', 125, 225, { id: 2 });
    b.cancel('blue', { id: 2 });
    b.lost('blue', { id: 2 });
    expect(b.log).toEqual(['start red']);
    expect(b.api().dragging).toBe('red');
    expect(b.els.red.vars.get(DRAG_X)).toBe('15px');
    expect(b.els.blue.vars.size).toBe(0);
    b.move('red', 25, 225);
    b.up('red', 25, 225);
    expect(b.log).toEqual(['start red', 'drop red on circle by drag']);
  });

  it('a second finger during a press (under the threshold) is ignored, and the first finger can still drag', () => {
    const b = board();
    b.down('red', 25, 25);
    b.down('blue', 125, 25, { id: 2 });
    b.move('blue', 125, 125, { id: 2 });
    expect(b.log).toEqual([]);
    b.move('red', 25, 125);
    expect(b.log).toEqual(['start red']);
    expect(b.api().dragging).toBe('red');
  });

  it('a second finger cannot cancel the first one’s drag', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 25, 125);
    b.cancel('red', { id: 2 });
    b.lost('red', { id: 2 });
    expect(b.api().dragging).toBe('red');
    b.up('red', 25, 225);
    expect(b.log).toEqual(['start red', 'drop red on circle by drag']);
  });
});

describe('review: the click after a drag, and the tap path', () => {
  it('the click the browser sends after a drag is ignored, and the next tap counts', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 25, 225);
    b.up('red', 25, 225);
    b.click('red');
    expect(b.api().picked).toBeNull();
    b.tap('blue');
    b.tap('square');
    expect(b.log).toEqual(['start red', 'drop red on circle by drag', 'pick blue', 'pick null', 'drop blue on square by tap']);
  });

  it('when the browser sends no click after a drag, the next press clears the flag, so that tap counts', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 75, 120);
    b.up('red', 75, 120);
    b.tap('blue');
    expect(b.log).toEqual(['start red', 'miss red', 'pick blue']);
  });

  it('a keyboard click (Enter or Space) right after a drag is never ignored', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 75, 120);
    b.up('red', 75, 120);
    b.click('blue', { keyboard: true });
    expect(b.api().picked).toBe('blue');
  });

  it('a drag drops the pick the tap path had made', () => {
    const b = board();
    b.tap('blue');
    expect(b.api().picked).toBe('blue');
    b.down('red', 25, 25);
    b.move('red', 25, 125);
    expect(b.api().picked).toBeNull();
    expect(b.log).toEqual(['pick blue', 'pick null', 'start red']);
  });

  it('a tap on a hole with nothing picked does nothing', () => {
    const b = board();
    b.tap('circle');
    expect(b.log).toEqual([]);
  });
});

describe('review: towers as targets (Number Line-up)', () => {
  it('a tower dragged onto another drops on it; released over its own place it is a miss', () => {
    const b = board({ itemsAreTargets: true });
    b.down('red', 25, 25);
    b.move('red', 125, 25);
    b.up('red', 125, 25);
    b.down('red', 25, 25);
    b.move('red', 25, 40);
    b.up('red', 25, 40);
    expect(b.log).toEqual(['start red', 'drop red on blue by drag', 'start red', 'miss red']);
  });

  it('a tap on one tower and then another drops the first on the second', () => {
    const b = board({ itemsAreTargets: true });
    b.tap('red');
    b.tap('blue');
    expect(b.log).toEqual(['pick red', 'pick null', 'drop red on blue by tap']);
  });
});

describe('review: the board turned off', () => {
  it('turned off mid-drag (a solve, a card), the drag is dropped and the release after it is neither a drop nor a miss', () => {
    const b = board();
    b.down('red', 25, 25);
    b.move('red', 25, 125);
    b.set({ disabled: true });
    expect(b.api().dragging).toBeNull();
    expect(b.els.red.vars.size).toBe(0);
    b.up('red', 25, 225);
    expect(b.log).toEqual(['start red']);
  });

  it('while off, a press never drags and a tap never picks', () => {
    const b = board({ disabled: true });
    b.down('red', 25, 25);
    b.move('red', 25, 125);
    b.up('red', 25, 225);
    b.tap('blue');
    expect(b.log).toEqual([]);
    expect(b.els.red.captured.size).toBe(0);
  });

  it('a pick is dropped when the board turns off', () => {
    const b = board();
    b.tap('red');
    b.set({ disabled: true });
    expect(b.api().picked).toBeNull();
    b.set({ disabled: false });
    b.tap('circle');
    expect(b.log).toEqual(['pick red', 'pick null']);
  });

  it('a press with a mouse button other than the main one never drags', () => {
    const b = board();
    b.down('red', 25, 25, { button: 2 });
    b.move('red', 25, 125);
    b.up('red', 25, 225);
    expect(b.log).toEqual([]);
  });
});

/** Drag red from its place and let go at (x, y). */
function dragRedTo(b: ReturnType<typeof board>, x: number, y: number) {
  b.down('red', 25, 25);
  b.move('red', 25, 125);
  b.up('red', x, y);
}

describe('review: the catch area (reach), which Shape Sorter turns on (brief 7.2, 7.4)', () => {
  it('with no reach, a release 5 px below a hole is a miss, as before', () => {
    const b = board();
    dragRedTo(b, 25, 255);
    expect(b.log).toEqual(['start red', 'miss red']);
  });

  it('on phone (zoom 1), a release 20 px below a hole drops there with a 24 px reach, and 30 px below is a miss', () => {
    const b = board({ reach: 24 });
    dragRedTo(b, 25, 270);
    dragRedTo(b, 25, 280);
    expect(b.log).toEqual(['start red', 'drop red on circle by drag', 'start red', 'miss red']);
    expect(b.els.red.vars.size).toBe(0);
  });

  it('on the tablet frame (zoom 1.4), the reach is in the frame’s px: 30 screen px below a hole drops, 35 is a miss', () => {
    screenOf('tablet');
    const b = board({ reach: 24 });
    dragRedTo(b, 25, 280);
    dragRedTo(b, 25, 285);
    expect(b.log).toEqual(['start red', 'drop red on circle by drag', 'start red', 'miss red']);
  });

  it('a zoom the game passes sets the reach too: at zoom 1 on a tablet screen, 30 px below is a miss', () => {
    screenOf('tablet');
    const b = board({ reach: 24, zoom: 1 });
    dragRedTo(b, 25, 280);
    expect(b.log).toEqual(['start red', 'miss red']);
  });

  it('between two holes, the nearer one catches the release; halfway, past the reach of both, is a miss', () => {
    const b = board({ reach: 24 });
    dragRedTo(b, 70, 225);
    dragRedTo(b, 80, 225);
    dragRedTo(b, 75, 225);
    expect(b.log).toEqual(['start red', 'drop red on circle by drag', 'start red', 'drop red on square by drag', 'start red', 'miss red']);
  });

  it('a release inside a hole still drops there', () => {
    const b = board({ reach: 24 });
    dragRedTo(b, 140, 210);
    expect(b.log).toEqual(['start red', 'drop red on square by drag']);
  });

  it('with towers as targets, the dragged tower never catches its own release; another tower in reach does', () => {
    const b = board({ itemsAreTargets: true, reach: 24 });
    b.down('red', 25, 25);
    b.move('red', 25, 45);
    b.up('red', 25, 60);
    b.down('red', 25, 25);
    b.move('red', 60, 25);
    b.up('red', 80, 25);
    expect(b.log).toEqual(['start red', 'miss red', 'start red', 'drop red on blue by drag']);
  });

  it('the tap path is unchanged by the reach: a tap on a hole places the picked piece', () => {
    const b = board({ reach: 24 });
    b.tap('blue');
    b.tap('square');
    expect(b.log).toEqual(['pick blue', 'pick null', 'drop blue on square by tap']);
  });
});
