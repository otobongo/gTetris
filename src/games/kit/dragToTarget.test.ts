/**
 * Drag an item onto a target, the pure part (six-games brief 3.1, 7.2, 10.1): the 8 px threshold, the
 * offset with the tablet zoom taken out, the hit test, a drop, a miss that returns, a lost pointer
 * that counts for nothing, and the click after a drag, ignored once through a flag that the next
 * pointerdown clears. Also the tap path and the pointer parts Picture Builder reuses.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DRAG_IDLE,
  DRAG_THRESHOLD_PX,
  capturePointer,
  dragOffset,
  dragStep,
  elementUnder,
  inRect,
  localPoint,
  pastThreshold,
  releasePointer,
  tapStep,
  targetAt,
  type DragEffect,
  type DragInput,
  type DragTrack,
  type Rect,
} from './dragToTarget';

type Item = 'red' | 'blue';

/** Runs pointer inputs through dragStep from idle, giving every effect and the track at the end. */
function drive(inputs: DragInput<Item>[], from: DragTrack<Item> = DRAG_IDLE) {
  let track = from;
  const effects: DragEffect<Item>[] = [];
  for (const input of inputs) {
    const out = dragStep(track, input);
    track = out.track;
    effects.push(out.effect);
  }
  return { track, effects, last: effects[effects.length - 1] };
}

const down = (item: Item, x = 100, y = 100, pointerId = 1): DragInput<Item> => ({ type: 'down', item, pointerId, point: { x, y } });
const move = (x: number, y: number, zoom?: number, pointerId = 1): DragInput<Item> => ({ type: 'move', pointerId, point: { x, y }, zoom });
const up = (target: string | null, pointerId = 1): DragInput<Item> => ({ type: 'up', pointerId, target });
const cancel = (pointerId = 1): DragInput<Item> => ({ type: 'cancel', pointerId });
const click = (keyboard = false): DragInput<Item> => ({ type: 'click', keyboard });

/** A full drag of `red` from (100, 100) past the threshold, released over `target`. */
const dragged = (target: string | null) => drive([down('red'), move(120, 100), up(target)]);

describe('the threshold (7.2: 8 px of x plus y travel)', () => {
  it('is 8 px', () => {
    expect(DRAG_THRESHOLD_PX).toBe(8);
  });

  it('stays a tap at 7 px and becomes a drag at 8 px, on either axis and in either direction', () => {
    expect(pastThreshold(7, 0)).toBe(false);
    expect(pastThreshold(8, 0)).toBe(true);
    expect(pastThreshold(0, -7)).toBe(false);
    expect(pastThreshold(0, -8)).toBe(true);
    expect(pastThreshold(-8, 0)).toBe(true);
  });

  it('adds x and y travel, so a diagonal crosses sooner than either axis alone', () => {
    expect(pastThreshold(4, 3)).toBe(false);
    expect(pastThreshold(4, 4)).toBe(true);
    expect(pastThreshold(-5, 3)).toBe(true);
    expect(pastThreshold(0, 0)).toBe(false);
  });

  it('takes another threshold when given one', () => {
    expect(pastThreshold(2, 0, 3)).toBe(false);
    expect(pastThreshold(3, 0, 3)).toBe(true);
  });
});

describe('the offset, with the tablet zoom taken out', () => {
  it('is the pointer travel on phone (zoom 1)', () => {
    expect(dragOffset({ x: 10, y: 10 }, { x: 34, y: -6 })).toEqual({ x: 24, y: -16 });
    expect(dragOffset({ x: 10, y: 10 }, { x: 34, y: -6 }, 1)).toEqual({ x: 24, y: -16 });
  });

  it('divides the travel by the tablet frame’s zoom', () => {
    expect(dragOffset({ x: 10, y: 10 }, { x: 24, y: 38 }, 1.4)).toEqual({ x: 10, y: 20 });
    expect(dragOffset({ x: 0, y: 0 }, { x: -28, y: 14 }, 1.4)).toEqual({ x: -20, y: 10 });
  });

  it('treats a zoom that is not a positive number as 1', () => {
    for (const zoom of [0, -1.4, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(dragOffset({ x: 0, y: 0 }, { x: 14, y: 7 }, zoom), `${zoom}`).toEqual({ x: 14, y: 7 });
    }
  });

  it('is zero with no travel', () => {
    expect(dragOffset({ x: 5, y: 5 }, { x: 5, y: 5 }, 1.4)).toEqual({ x: 0, y: 0 });
  });
});

describe('the hit test', () => {
  const hole: Rect = { left: 0, top: 0, right: 100, bottom: 50 };

  it('counts a point on any edge of a rect as inside', () => {
    expect(inRect({ x: 0, y: 0 }, hole)).toBe(true);
    expect(inRect({ x: 100, y: 50 }, hole)).toBe(true);
    expect(inRect({ x: 50, y: 25 }, hole)).toBe(true);
  });

  it('counts a point just past an edge as outside', () => {
    expect(inRect({ x: -0.5, y: 25 }, hole)).toBe(false);
    expect(inRect({ x: 100.5, y: 25 }, hole)).toBe(false);
    expect(inRect({ x: 50, y: -0.5 }, hole)).toBe(false);
    expect(inRect({ x: 50, y: 50.5 }, hole)).toBe(false);
  });

  const holes: [string, Rect][] = [
    ['circle', { left: 0, top: 0, right: 50, bottom: 50 }],
    ['square', { left: 60, top: 0, right: 110, bottom: 50 }],
  ];

  it('finds the target under the release point', () => {
    expect(targetAt({ x: 25, y: 25 }, holes)).toBe('circle');
    expect(targetAt({ x: 80, y: 10 }, holes)).toBe('square');
  });

  it('finds no target between targets, outside them all, or with no targets', () => {
    expect(targetAt({ x: 55, y: 25 }, holes)).toBeNull();
    expect(targetAt({ x: 500, y: 500 }, holes)).toBeNull();
    expect(targetAt({ x: 25, y: 25 }, [])).toBeNull();
  });

  it('leaves out the skipped target, so a tower released over itself is a miss', () => {
    expect(targetAt({ x: 25, y: 25 }, holes, 'circle')).toBeNull();
    expect(targetAt({ x: 80, y: 10 }, holes, 'circle')).toBe('square');
    expect(targetAt({ x: 25, y: 25 }, holes, null)).toBe('circle');
  });

  it('gives the last listed target where rects overlap, as the one painted on top', () => {
    const overlap: [string, Rect][] = [
      ['under', { left: 0, top: 0, right: 100, bottom: 100 }],
      ['over', { left: 50, top: 50, right: 150, bottom: 150 }],
    ];
    expect(targetAt({ x: 75, y: 75 }, overlap)).toBe('over');
    expect(targetAt({ x: 25, y: 25 }, overlap)).toBe('under');
    expect(targetAt({ x: 75, y: 75 }, overlap, 'over')).toBe('under');
  });

  it('reads targets from a Map as well as an array', () => {
    expect(targetAt({ x: 80, y: 10 }, new Map(holes))).toBe('square');
  });
});

describe('one drag', () => {
  it('starts idle with nothing to swallow', () => {
    expect(DRAG_IDLE).toEqual({ phase: { kind: 'idle' }, swallowClick: false });
    expect(Object.isFrozen(DRAG_IDLE)).toBe(true);
  });

  it('a press is not a drag until the pointer has travelled 8 px', () => {
    const r = drive([down('red'), move(103, 104)]);
    expect(r.last).toEqual({ kind: 'none' });
    expect(r.track.phase.kind).toBe('pressed');
    const past = drive([move(104, 104)], r.track);
    expect(past.last).toEqual({ kind: 'start', item: 'red', offset: { x: 4, y: 4 } });
    expect(past.track.phase.kind).toBe('dragging');
  });

  it('measures the threshold from where the press began, not from the last move', () => {
    const r = drive([down('red'), move(104, 100), move(100, 103), move(105, 100)]);
    expect(r.effects).toEqual([{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }, { kind: 'none' }]);
    expect(drive([move(108, 100)], r.track).last.kind).toBe('start');
  });

  it('measures the threshold in screen px and moves the item in the frame’s px on the tablet', () => {
    const r = drive([down('red', 0, 0), move(7, 0, 1.4)]);
    expect(r.last).toEqual({ kind: 'none' });
    const start = drive([move(14, 0, 1.4)], r.track);
    expect(start.last).toEqual({ kind: 'start', item: 'red', offset: { x: 10, y: 0 } });
    expect(drive([move(28, -14, 1.4)], start.track).last).toEqual({ kind: 'move', item: 'red', offset: { x: 20, y: -10 } });
  });

  it('follows the pointer once dragging, even back inside the threshold', () => {
    const r = drive([down('red'), move(120, 100), move(102, 101)]);
    expect(r.last).toEqual({ kind: 'move', item: 'red', offset: { x: 2, y: 1 } });
  });

  it('drops the item on the target under the release', () => {
    const r = dragged('circle');
    expect(r.last).toEqual({ kind: 'drop', item: 'red', target: 'circle' });
    expect(r.track.phase.kind).toBe('idle');
  });

  it('a release over no target is a miss: the item goes back', () => {
    const r = dragged(null);
    expect(r.last).toEqual({ kind: 'miss', item: 'red' });
    expect(r.track.phase.kind).toBe('idle');
  });

  it('a target that shares the item’s id still counts as a drop (a piece and its own hole)', () => {
    expect(drive([down('red'), move(120, 100), up('red')]).last).toEqual({ kind: 'drop', item: 'red', target: 'red' });
  });

  it('a release under the threshold is a tap: no drop, and the click that follows does the work', () => {
    const r = drive([down('red'), move(103, 100), up('circle')]);
    expect(r.last).toEqual({ kind: 'none' });
    expect(r.track).toEqual({ phase: { kind: 'idle' }, swallowClick: false });
    expect(drive([click()], r.track).last).toEqual({ kind: 'click' });
  });

  it('a lost pointer (pointercancel) drops the drag with no drop and no miss', () => {
    const r = drive([down('red'), move(120, 100), cancel()]);
    expect(r.last).toEqual({ kind: 'cancel', item: 'red' });
    expect(r.track.phase.kind).toBe('idle');
    expect(r.effects.some((e) => e.kind === 'drop' || e.kind === 'miss')).toBe(false);
  });

  it('a lost pointer before the threshold does nothing at all', () => {
    const r = drive([down('red'), cancel()]);
    expect(r.last).toEqual({ kind: 'none' });
    expect(r.track).toEqual({ phase: { kind: 'idle' }, swallowClick: false });
  });

  it('a cancel or release after the drag is over does nothing (lostpointercapture after a normal release)', () => {
    const r = dragged('circle');
    const again = dragStep(r.track, cancel());
    expect(again.effect).toEqual({ kind: 'none' });
    expect(again.track).toBe(r.track);
    expect(dragStep(r.track, up('square')).track).toBe(r.track);
  });

  it('ignores moves, releases and cancels with no press', () => {
    for (const input of [move(150, 150), up('circle'), cancel()]) {
      const out = dragStep(DRAG_IDLE, input);
      expect(out.effect, input.type).toEqual({ kind: 'none' });
      expect(out.track, input.type).toBe(DRAG_IDLE);
    }
  });

  it('ignores a second finger while one press or drag is under way', () => {
    const pressed = drive([down('red')]).track;
    const second = dragStep(pressed, down('blue', 300, 300, 2));
    expect(second.effect).toEqual({ kind: 'none' });
    expect(second.track).toBe(pressed);
    const r = drive([move(150, 100, 1, 2), up('circle', 2), cancel(2)], pressed);
    expect(r.effects).toEqual([{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }]);
    expect(r.track).toBe(pressed);
  });

  it('a second finger cannot cancel or drop the first one’s drag', () => {
    const dragging = drive([down('red'), move(120, 100)]).track;
    expect(dragStep(dragging, cancel(2)).track).toBe(dragging);
    expect(dragStep(dragging, up('circle', 2)).track).toBe(dragging);
    expect(dragStep(dragging, up('circle', 1)).effect).toEqual({ kind: 'drop', item: 'red', target: 'circle' });
  });

  it('never changes the track it is given', () => {
    const before = drive([down('red'), move(120, 100)]).track;
    const copy = JSON.parse(JSON.stringify(before));
    dragStep(before, up('circle'));
    dragStep(before, cancel());
    expect(before).toEqual(copy);
  });
});

describe('the click after a drag', () => {
  it('is swallowed once after a drop, and the next click counts', () => {
    const r = drive([click(), click()], dragged('circle').track);
    expect(r.effects).toEqual([{ kind: 'swallow' }, { kind: 'click' }]);
    expect(r.track.swallowClick).toBe(false);
  });

  it('is swallowed after a miss too', () => {
    expect(drive([click()], dragged(null).track).last).toEqual({ kind: 'swallow' });
  });

  it('is cleared by the next pointerdown, so the next tap counts even if the browser sent no click after the drag', () => {
    const afterDrag = dragged('circle').track;
    expect(afterDrag.swallowClick).toBe(true);
    const r = drive([down('blue', 300, 300), up(null), click()], afterDrag);
    expect(r.last).toEqual({ kind: 'click' });
  });

  it('clears on pointerdown before any move, so a quick tap after a drag is never lost', () => {
    const pressed = drive([down('blue')], dragged('circle').track).track;
    expect(pressed.swallowClick).toBe(false);
  });

  it('never swallows a keyboard click (Enter or Space)', () => {
    const afterDrag = dragged('circle').track;
    expect(drive([click(true)], afterDrag).last).toEqual({ kind: 'click' });
    expect(drive([click(true), click(true)], afterDrag).effects).toEqual([{ kind: 'click' }, { kind: 'click' }]);
  });

  it('never swallows a click when no drag happened', () => {
    expect(drive([click(), click()]).effects).toEqual([{ kind: 'click' }, { kind: 'click' }]);
    expect(drive([down('red'), up(null), click()]).last).toEqual({ kind: 'click' });
  });

  it('after a lost drag, the next pointerdown still clears it, so the next tap counts', () => {
    const lost = drive([down('red'), move(120, 100), cancel()]).track;
    expect(drive([down('red'), up(null), click()], lost).last).toEqual({ kind: 'click' });
  });
});

describe('the tap path: tap an item, then a target', () => {
  it('a tap on an item with nothing picked picks it', () => {
    expect(tapStep<Item>(null, { item: 'red' })).toEqual({ kind: 'pick', item: 'red' });
  });

  it('a tap on the picked item puts it down', () => {
    expect(tapStep<Item>('red', { item: 'red' })).toEqual({ kind: 'pick', item: null });
    expect(tapStep<Item>('red', { item: 'red', asTarget: true })).toEqual({ kind: 'pick', item: null });
  });

  it('a tap on another item moves the pick when items are not targets', () => {
    expect(tapStep<Item>('red', { item: 'blue' })).toEqual({ kind: 'pick', item: 'blue' });
  });

  it('a tap on another item drops the picked one on it when items are targets (Number Line-up towers)', () => {
    expect(tapStep<Item>('red', { item: 'blue', asTarget: true })).toEqual({ kind: 'drop', item: 'red', target: 'blue' });
    expect(tapStep<Item>(null, { item: 'blue', asTarget: true })).toEqual({ kind: 'pick', item: 'blue' });
  });

  it('a tap on a target drops the picked item there, and does nothing with nothing picked', () => {
    expect(tapStep<Item>('red', { target: 'circle' })).toEqual({ kind: 'drop', item: 'red', target: 'circle' });
    expect(tapStep<Item>(null, { target: 'circle' })).toEqual({ kind: 'none' });
  });
});

describe('pointer parts (Picture Builder’s paint strokes)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('captures and releases the pointer on the element', () => {
    const el = { setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() };
    capturePointer(el as unknown as Element, 7);
    expect(el.setPointerCapture).toHaveBeenCalledWith(7);
    releasePointer(el as unknown as Element, 7);
    expect(el.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('releases only a pointer the element holds', () => {
    const el = { hasPointerCapture: vi.fn(() => false), releasePointerCapture: vi.fn() };
    releasePointer(el as unknown as Element, 7);
    expect(el.releasePointerCapture).not.toHaveBeenCalled();
  });

  it('ignores a missing element and a browser that refuses capture', () => {
    const refuses = {
      setPointerCapture: () => {
        throw new Error('NotFoundError');
      },
      hasPointerCapture: () => {
        throw new Error('NotFoundError');
      },
    };
    expect(() => capturePointer(null, 1)).not.toThrow();
    expect(() => capturePointer(undefined, 1)).not.toThrow();
    expect(() => releasePointer(null, 1)).not.toThrow();
    expect(() => capturePointer(refuses as unknown as Element, 1)).not.toThrow();
    expect(() => releasePointer(refuses as unknown as Element, 1)).not.toThrow();
  });

  it('gives the point inside an element in the frame’s px, with the zoom taken out', () => {
    const el = { getBoundingClientRect: () => ({ left: 100, top: 50, right: 300, bottom: 250 }) };
    expect(localPoint({ x: 170, y: 120 }, el as unknown as Element, 1.4)).toEqual({ x: 50, y: 50 });
    expect(localPoint({ x: 120, y: 60 }, el as unknown as Element)).toEqual({ x: 20, y: 10 });
  });

  it('finds no element outside a browser', () => {
    expect(elementUnder({ x: 10, y: 10 })).toBeNull();
  });

  it('finds the topmost element, or the nearest match for a selector, skipping the dragged item', () => {
    /** A stand-in element: a class list and a parent, with contains and closest as the DOM has them. */
    interface Fake {
      id: string;
      parent: Fake | null;
      cls: string[];
      contains(o: Fake): boolean;
      closest(sel: string): Fake | null;
    }
    const make = (id: string, parent: Fake | null, cls: string[] = []): Fake => ({
      id,
      parent,
      cls,
      contains(o) {
        for (let n: Fake | null = o; n; n = n.parent) if (n === this) return true;
        return false;
      },
      closest(sel) {
        for (let n: Fake | null = this; n; n = n.parent) if (n.cls.includes(sel.replace(/^\./, ''))) return n;
        return null;
      },
    });
    const square = make('square', null, ['pb-cell']);
    const label = make('label', square);
    const brick = make('brick', null, ['pb-cell']);
    // elementsFromPoint lists topmost first: the dragged brick under the finger, then the square's label, then the square
    vi.stubGlobal('document', { elementsFromPoint: () => [brick, label, square] });
    const id = (el: Element | null) => (el as unknown as Fake | null)?.id ?? null;
    const skip = brick as unknown as Element;

    expect(id(elementUnder({ x: 1, y: 1 }))).toBe('brick');
    expect(id(elementUnder({ x: 1, y: 1 }, undefined, skip))).toBe('label');
    expect(id(elementUnder({ x: 1, y: 1 }, '.pb-cell', skip))).toBe('square');
    expect(id(elementUnder({ x: 1, y: 1 }, '.nothing'))).toBeNull();
  });

  it('finds nothing when the browser has no elementsFromPoint', () => {
    vi.stubGlobal('document', {});
    expect(elementUnder({ x: 1, y: 1 })).toBeNull();
  });
});
