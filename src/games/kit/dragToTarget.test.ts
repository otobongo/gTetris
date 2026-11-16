/**
 * Drag an item onto a target, the pure part (six-games brief 3.1, 7.2, 10.1): the 8 px threshold, the
 * offset with the tablet zoom taken out, the hit test, the catch area around a target (a release
 * within `reach` of its edge, which only Shape Sorter uses), a drop, a miss that returns, a lost
 * pointer that counts for nothing, and the click after a drag, ignored once through a flag that the
 * next pointerdown clears. Also the tap path and the pointer parts Picture Builder reuses.
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
  rectDistance,
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

const kinds = (effects: DragEffect<Item>[]) => effects.map((e) => e.kind);

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

describe('the distance from a point to a rect (the catch area, brief 7.2, 7.4)', () => {
  const box: Rect = { left: 10, top: 20, right: 60, bottom: 70 };

  it('is 0 inside the rect', () => {
    expect(rectDistance({ x: 35, y: 45 }, box)).toBe(0);
    expect(rectDistance({ x: 11, y: 69 }, box)).toBe(0);
  });

  it('is 0 on any edge or corner, as inRect counts them inside', () => {
    expect(rectDistance({ x: 10, y: 45 }, box)).toBe(0);
    expect(rectDistance({ x: 60, y: 45 }, box)).toBe(0);
    expect(rectDistance({ x: 35, y: 20 }, box)).toBe(0);
    expect(rectDistance({ x: 35, y: 70 }, box)).toBe(0);
    expect(rectDistance({ x: 10, y: 20 }, box)).toBe(0);
    expect(rectDistance({ x: 60, y: 70 }, box)).toBe(0);
  });

  it('straight out from a side, is the gap to that side', () => {
    expect(rectDistance({ x: 0, y: 45 }, box)).toBe(10);
    expect(rectDistance({ x: 72, y: 45 }, box)).toBe(12);
    expect(rectDistance({ x: 35, y: 5 }, box)).toBe(15);
    expect(rectDistance({ x: 35, y: 94 }, box)).toBe(24);
    // level with an edge but past the end of it: still straight out from the side
    expect(rectDistance({ x: 10, y: 0 }, box)).toBe(20);
    expect(rectDistance({ x: 76, y: 70 }, box)).toBe(16);
  });

  it('out from a corner, is the straight line to that corner, not x plus y', () => {
    expect(rectDistance({ x: 7, y: 16 }, box)).toBeCloseTo(5, 9);
    expect(rectDistance({ x: 63, y: 74 }, box)).toBeCloseTo(5, 9);
    expect(rectDistance({ x: 66, y: 12 }, box)).toBeCloseTo(10, 9);
    expect(rectDistance({ x: 5, y: 82 }, box)).toBeCloseTo(13, 9);
    expect(rectDistance({ x: 0, y: 0 }, box)).toBeCloseTo(Math.sqrt(500), 9);
  });

  it('works for a rect with no size: the distance to that point', () => {
    expect(rectDistance({ x: 3, y: 4 }, { left: 0, top: 0, right: 0, bottom: 0 })).toBeCloseTo(5, 9);
    expect(rectDistance({ x: 0, y: 0 }, { left: 0, top: 0, right: 0, bottom: 0 })).toBe(0);
  });
});

describe('the hit test with a catch area (reach): a release near a target counts as on it', () => {
  // Two 50 px holes side by side, 50 px apart.
  const holes: [string, Rect][] = [
    ['circle', { left: 0, top: 0, right: 50, bottom: 50 }],
    ['square', { left: 100, top: 0, right: 150, bottom: 50 }],
  ];

  it('a release inside a target still finds it, with or without a reach', () => {
    expect(targetAt({ x: 25, y: 25 }, holes, null, 24)).toBe('circle');
    expect(targetAt({ x: 125, y: 25 }, holes, null, 24)).toBe('square');
  });

  it('a release inside a target wins over a neighbour whose edge is nearer than that target’s middle', () => {
    const tight: [string, Rect][] = [
      ['circle', { left: 0, top: 0, right: 50, bottom: 50 }],
      ['square', { left: 52, top: 0, right: 102, bottom: 50 }],
    ];
    // 1 px inside the circle's right edge, 3 px from the square, 24 px from the circle's middle
    expect(targetAt({ x: 49, y: 25 }, tight, null, 24)).toBe('circle');
    expect(targetAt({ x: 49, y: 25 }, [...tight].reverse(), null, 24)).toBe('circle');
  });

  it('where rects overlap, a release inside both still gives the last listed, as with no reach', () => {
    const overlap: [string, Rect][] = [
      ['under', { left: 0, top: 0, right: 100, bottom: 100 }],
      ['over', { left: 50, top: 50, right: 150, bottom: 150 }],
    ];
    expect(targetAt({ x: 75, y: 75 }, overlap, null, 24)).toBe('over');
    expect(targetAt({ x: 25, y: 25 }, overlap, null, 24)).toBe('under');
  });

  it('a release outside every target but within reach of one finds that one', () => {
    expect(targetAt({ x: 25, y: 60 }, holes, null, 24)).toBe('circle');
    expect(targetAt({ x: 160, y: 25 }, holes, null, 24)).toBe('square');
    expect(targetAt({ x: -10, y: -10 }, holes, null, 24)).toBe('circle');
  });

  it('a release within reach of two targets finds the nearer one, whichever is listed first', () => {
    expect(targetAt({ x: 70, y: 25 }, holes, null, 40)).toBe('circle');
    expect(targetAt({ x: 85, y: 25 }, holes, null, 40)).toBe('square');
    expect(targetAt({ x: 85, y: 25 }, [...holes].reverse(), null, 40)).toBe('square');
    expect(targetAt({ x: 70, y: 25 }, [...holes].reverse(), null, 40)).toBe('circle');
  });

  it('on an exact tie, the first listed target wins', () => {
    expect(targetAt({ x: 75, y: 25 }, holes, null, 30)).toBe('circle');
    expect(targetAt({ x: 75, y: 25 }, [...holes].reverse(), null, 30)).toBe('square');
  });

  it('a release exactly `reach` from a target counts; just past it, nothing is found', () => {
    expect(targetAt({ x: 25, y: 74 }, holes, null, 24)).toBe('circle');
    expect(targetAt({ x: 25, y: 74.5 }, holes, null, 24)).toBeNull();
    // out from a corner the reach is a straight line: 18 by 18 is about 25.5 px, past a 24 px reach
    expect(targetAt({ x: -18, y: -18 }, holes, null, 24)).toBeNull();
    expect(targetAt({ x: -18, y: -18 }, holes, null, 26)).toBe('circle');
  });

  it('a reach of 0, below 0 or not a finite number means exact drops only', () => {
    for (const reach of [0, -24, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(targetAt({ x: 25, y: 60 }, holes, null, reach), `${reach}`).toBeNull();
      expect(targetAt({ x: 500, y: 500 }, holes, null, reach), `${reach}`).toBeNull();
      expect(targetAt({ x: 25, y: 25 }, holes, null, reach), `${reach}`).toBe('circle');
      expect(targetAt({ x: 50, y: 50 }, holes, null, reach), `${reach}`).toBe('circle');
    }
  });

  it('with no reach given, drops are exact, so every caller that passes none is unchanged', () => {
    expect(targetAt({ x: 25, y: 51 }, holes)).toBeNull();
    expect(targetAt({ x: 25, y: 51 }, holes, null)).toBeNull();
    expect(targetAt({ x: 25, y: 51 }, holes, undefined)).toBeNull();
    expect(targetAt({ x: 25, y: 25 }, holes)).toBe('circle');
  });

  it('never finds the skipped target, even within reach, but still finds another one in reach', () => {
    expect(targetAt({ x: 25, y: 60 }, holes, 'circle', 24)).toBeNull();
    expect(targetAt({ x: 70, y: 25 }, holes, 'circle', 40)).toBe('square');
    expect(targetAt({ x: 25, y: 60 }, holes, 'square', 24)).toBe('circle');
  });

  it('finds nothing with no targets, and reads a Map as well as an array', () => {
    expect(targetAt({ x: 25, y: 60 }, [], null, 24)).toBeNull();
    expect(targetAt({ x: 160, y: 25 }, new Map(holes), null, 24)).toBe('square');
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

/**
 * A resting palm or a second hand on one tray piece must not block a real drag of another (the
 * kit drag takeover, found with multi-touch on iPad). With `takeover` on the press, a new finger
 * replaces a press that has never moved; a drag under way still keeps its finger.
 */
describe('a new finger takes over a still press (takeover)', () => {
  /** A pointerdown that may take over a still press. */
  const grab = (item: Item, x: number, y: number, pointerId: number): DragInput<Item> => ({ type: 'down', item, pointerId, point: { x, y }, takeover: true });
  /** A click on an item, as the hook sends it: the item it landed on. */
  const clickOn = (item: Item): DragInput<Item> => ({ type: 'click', item });

  /** (a) A palm rests on red (pointer 1), then a finger drags blue (pointer 2) onto the circle hole. */
  const palmThenDrag = () => drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2), move(320, 100, 1, 2), up('circle', 2)]);

  it('(a) a still press on one item, then a drag of another, drops the dragged one, exactly once', () => {
    const r = palmThenDrag();
    expect(r.effects.filter((e) => e.kind === 'drop')).toEqual([{ kind: 'drop', item: 'blue', target: 'circle' }]);
    expect(r.effects.filter((e) => e.kind === 'start')).toEqual([{ kind: 'start', item: 'blue', offset: { x: 20, y: 0 } }]);
    expect(r.track.phase.kind).toBe('idle');
  });

  it('(a) the takeover tells the hook which pointer to let go of', () => {
    const r = drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2)]);
    expect(r.effects[1]).toEqual({ kind: 'release', item: 'red', pointerId: 1 });
    expect(r.track.phase).toEqual({ kind: 'pressed', item: 'blue', pointerId: 2, start: { x: 300, y: 100 } });
  });

  it('(a) the resting finger cannot cancel or drop anything, and once the new finger drags it cannot move anything', () => {
    // a wiggle under the threshold, the lost capture the release sends, then the new finger drags
    const r = drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2), move(104, 102, 1, 1), cancel(1), move(320, 100, 1, 2), move(200, 300, 1, 1)]);
    expect(kinds(r.effects)).toEqual(['none', 'release', 'none', 'none', 'start', 'none']);
    expect(r.track.phase).toMatchObject({ kind: 'dragging', item: 'blue', pointerId: 2 });
    expect(drive([up('circle', 1)], r.track).last).toEqual({ kind: 'none' });
  });

  it('(b) after the drop, the resting finger’s release does nothing and the click on its item is swallowed', () => {
    const afterDrop = palmThenDrag().track;
    const lift = dragStep(afterDrop, up('square', 1));
    expect(lift.effect).toEqual({ kind: 'none' });
    expect(lift.track.phase.kind).toBe('idle');
    expect(dragStep(lift.track, clickOn('red')).effect).toEqual({ kind: 'swallow' });
  });

  it('(b) the swallow is for the resting item even once the drag’s own click is spent', () => {
    // the browser's click after the drag lands on blue and uses the drag's flag
    const spent = drive([clickOn('blue')], palmThenDrag().track);
    expect(spent.last).toEqual({ kind: 'swallow' });
    expect(spent.track.swallowClick).toBe(false);
    const r = drive([up(null, 1), clickOn('red')], spent.track);
    expect(r.effects).toEqual([{ kind: 'none' }, { kind: 'swallow' }]);
  });

  it('(b) only that one click is swallowed: the next tap on the item counts', () => {
    const r = drive([clickOn('blue'), up(null, 1), clickOn('red'), grab('red', 100, 100, 3), up(null, 3), clickOn('red')], palmThenDrag().track);
    expect(kinds(r.effects)).toEqual(['swallow', 'none', 'swallow', 'none', 'none', 'click']);
  });

  it('(b) the resting finger lifting while the new finger is still down does nothing to the new press', () => {
    const r = drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2), up(null, 1), clickOn('red')]);
    expect(kinds(r.effects)).toEqual(['none', 'release', 'none', 'swallow']);
    expect(r.track.phase).toMatchObject({ kind: 'pressed', item: 'blue', pointerId: 2 });
    expect(drive([move(320, 100, 1, 2), up('circle', 2)], r.track).last).toEqual({ kind: 'drop', item: 'blue', target: 'circle' });
  });

  it('(c) two still presses, released in either order, give one tap: the press still tracked', () => {
    const orders: DragInput<Item>[][] = [
      [up(null, 1), clickOn('red'), up(null, 2), clickOn('blue')],
      [up(null, 2), clickOn('blue'), up(null, 1), clickOn('red')],
      [up(null, 2), up(null, 1), clickOn('blue'), clickOn('red')],
      [up(null, 1), up(null, 2), clickOn('red'), clickOn('blue')],
    ];
    for (const rest of orders) {
      const r = drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2), ...rest]);
      const name = rest.map((i) => (i.type === 'click' ? `click ${i.item}` : `up ${i.pointerId}`)).join(', ');
      // the one click that counts is blue's: the click on red is swallowed
      const counted = rest.filter((_, i) => r.effects[i + 2].kind === 'click');
      expect(counted, name).toEqual([clickOn('blue')]);
      expect(r.track.phase.kind, name).toBe('idle');
    }
  });

  it('(d) a second finger during a drag is still ignored, takeover or not', () => {
    const dragging = drive([grab('red', 100, 100, 1), move(120, 100)]).track;
    const second = dragStep(dragging, grab('blue', 300, 300, 2));
    expect(second.effect).toEqual({ kind: 'none' });
    expect(second.track).toBe(dragging);
    const r = drive([move(350, 300, 1, 2), up('square', 2), cancel(2), move(130, 100), up('circle')], second.track);
    expect(kinds(r.effects)).toEqual(['none', 'none', 'none', 'move', 'drop']);
    expect(r.last).toEqual({ kind: 'drop', item: 'red', target: 'circle' });
  });

  it('(d) the finger ignored during a drag does not have its later click swallowed by a takeover', () => {
    // pointer 2 came down during the drag: it was ignored, not taken over, so nothing marks it
    const r = drive([grab('red', 100, 100, 1), move(120, 100), grab('blue', 300, 300, 2), up('circle'), clickOn('red'), up(null, 2), clickOn('blue')]);
    expect(kinds(r.effects)).toEqual(['none', 'start', 'none', 'drop', 'swallow', 'none', 'click']);
  });

  it('the same finger pressing again on the same item is a fresh press, not a takeover', () => {
    const r = drive([grab('red', 100, 100, 1), grab('red', 100, 100, 1)]);
    expect(kinds(r.effects)).toEqual(['none', 'none']);
    expect(drive([up(null, 1), clickOn('red')], r.track).last).toEqual({ kind: 'click' });
  });

  it('a finger that reuses the resting finger’s id later is a new press whose tap counts', () => {
    // the resting finger's release was lost (no up), then the browser reuses its id for a new touch
    const afterDrop = palmThenDrag().track;
    const r = drive([grab('red', 100, 100, 1), up(null, 1), clickOn('red')], afterDrop);
    expect(kinds(r.effects)).toEqual(['none', 'none', 'click']);
  });

  it('a new press clears a swallow the browser never used, so a later tap on that item counts', () => {
    // the resting finger lifts but the browser sends no click for it
    const lifted = drive([clickOn('blue'), up(null, 1)], palmThenDrag().track).track;
    const r = drive([grab('blue', 300, 100, 4), up(null, 4), clickOn('blue'), grab('red', 100, 100, 5), up(null, 5), clickOn('red')], lifted);
    expect(kinds(r.effects)).toEqual(['none', 'none', 'click', 'none', 'none', 'click']);
  });

  it('a keyboard click on the resting item is never swallowed', () => {
    const r = drive([clickOn('blue'), up(null, 1), { type: 'click', item: 'red', keyboard: true }], palmThenDrag().track);
    expect(r.last).toEqual({ kind: 'click' });
  });

  it('without takeover, a second finger on a still press is ignored as before', () => {
    const pressed = drive([down('red')]).track;
    const second = dragStep(pressed, down('blue', 300, 300, 2));
    expect(second.effect).toEqual({ kind: 'none' });
    expect(second.track).toBe(pressed);
  });

  it('never changes the track it is given', () => {
    const pressed = drive([grab('red', 100, 100, 1)]).track;
    const copy = JSON.parse(JSON.stringify(pressed));
    const taken = dragStep(pressed, grab('blue', 300, 100, 2)).track;
    expect(pressed).toEqual(copy);
    const takenCopy = JSON.parse(JSON.stringify(taken));
    dragStep(taken, up(null, 1));
    dragStep(taken, clickOn('red'));
    expect(taken).toEqual(takenCopy);
  });
});

/**
 * The other order: the finger presses a piece first and the palm lands still on another before the finger
 * has moved (the heel of a child's hand settling after the fingertip). The palm takes over the still press,
 * so the finger that moves first must take the drag back, or the finger drags and nothing follows it.
 */
describe('the finger that moves first drags (takeover)', () => {
  const grab = (item: Item, x: number, y: number, pointerId: number): DragInput<Item> => ({ type: 'down', item, pointerId, point: { x, y }, takeover: true });
  const clickOn = (item: Item): DragInput<Item> => ({ type: 'click', item });

  /** A finger presses red (pointer 1), a palm lands still on blue (pointer 2), then the finger drags red onto the circle. */
  const fingerThenPalm = () => drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2), cancel(1), move(130, 100, 1, 1), move(150, 300, 1, 1), up('circle', 1)]);

  it('the finger drags its own piece and drops it, exactly once, even after its capture was let go', () => {
    const r = fingerThenPalm();
    expect(kinds(r.effects)).toEqual(['none', 'release', 'none', 'start', 'move', 'drop']);
    expect(r.effects[3]).toEqual({ kind: 'start', item: 'red', offset: { x: 30, y: 0 } });
    expect(r.effects.filter((e) => e.kind === 'drop')).toEqual([{ kind: 'drop', item: 'red', target: 'circle' }]);
    expect(r.track.phase.kind).toBe('idle');
  });

  it('uses the finger’s own start: 7 px stays still, 8 px drags, and the offset has the tablet zoom taken out', () => {
    const pressed = drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2)]).track;
    const under = drive([move(104, 103, 1.4, 1)], pressed);
    expect(under.last).toEqual({ kind: 'none' });
    expect(under.track.phase).toMatchObject({ kind: 'pressed', item: 'blue', pointerId: 2 });
    const past = drive([move(100, 108, 1.4, 1)], under.track);
    expect(past.last).toEqual({ kind: 'start', item: 'red', offset: { x: 0, y: 8 / 1.4 } });
    expect(past.track.phase).toEqual({ kind: 'dragging', item: 'red', pointerId: 1, start: { x: 100, y: 100 } });
  });

  it('the palm it took the drag back from now rests: its lift and its click pick nothing, and its next real tap counts', () => {
    // the drag's own click on red, then the palm lifts and the browser clicks blue
    const r = drive([clickOn('red'), up(null, 2), clickOn('blue'), grab('blue', 300, 100, 3), up(null, 3), clickOn('blue')], fingerThenPalm().track);
    expect(kinds(r.effects)).toEqual(['swallow', 'none', 'swallow', 'none', 'none', 'click']);
  });

  it('the palm lifting during the finger’s drag does not end it, and nothing else of the palm’s counts', () => {
    const dragging = drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2), move(130, 100, 1, 1)]).track;
    const r = drive([move(400, 400, 1, 2), cancel(2), up('square', 2), move(150, 300, 1, 1), up('circle', 1)], dragging);
    expect(kinds(r.effects)).toEqual(['none', 'none', 'none', 'move', 'drop']);
    expect(r.last).toEqual({ kind: 'drop', item: 'red', target: 'circle' });
    expect(dragStep(r.track, clickOn('blue')).effect).toEqual({ kind: 'swallow' });
  });

  it('a finger lifted without moving cannot take anything back', () => {
    const r = drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2), up(null, 1), move(160, 100, 1, 1)]);
    expect(kinds(r.effects)).toEqual(['none', 'release', 'none', 'none']);
    expect(r.track.phase).toMatchObject({ kind: 'pressed', item: 'blue', pointerId: 2 });
  });

  it('once the newer press is over, a palm still resting never starts a drag of its own when it drifts', () => {
    // after the new finger's drop
    const afterDrop = drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2), move(320, 100, 1, 2), up('circle', 2)]).track;
    const drift = drive([move(160, 140, 1, 1), up('square', 1)], afterDrop);
    expect(kinds(drift.effects)).toEqual(['none', 'none']);
    expect(drift.track.phase.kind).toBe('idle');
    // after the new finger's tap
    const afterTap = drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2), up(null, 2), clickOn('blue'), move(160, 140, 1, 1)]);
    expect(kinds(afterTap.effects)).toEqual(['none', 'release', 'none', 'click', 'none']);
    expect(afterTap.track.phase.kind).toBe('idle');
  });

  it('with three fingers down, the one that moves first drags and the two still ones pick nothing', () => {
    const r = drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2), grab('red', 120, 100, 3), move(300, 120, 1, 2), up('square', 2)]);
    expect(kinds(r.effects)).toEqual(['none', 'release', 'release', 'start', 'drop']);
    expect(r.last).toEqual({ kind: 'drop', item: 'blue', target: 'square' });
    const lifts = drive([clickOn('blue'), up(null, 1), up(null, 3), clickOn('red'), clickOn('red'), grab('red', 100, 100, 4), up(null, 4), clickOn('red')], r.track);
    expect(kinds(lifts.effects)).toEqual(['swallow', 'none', 'none', 'swallow', 'swallow', 'none', 'none', 'click']);
  });

  it('without takeover a second finger is ignored, so the first finger still drags as before', () => {
    const r = drive([down('red'), down('blue', 300, 100, 2), move(130, 100), up('circle')]);
    expect(kinds(r.effects)).toEqual(['none', 'none', 'start', 'drop']);
  });

  it('never changes the track it is given', () => {
    const taken = drive([grab('red', 100, 100, 1), grab('blue', 300, 100, 2)]).track;
    const copy = JSON.parse(JSON.stringify(taken));
    const back = dragStep(taken, move(130, 100, 1, 1));
    expect(back.effect.kind).toBe('start');
    expect(taken).toEqual(copy);
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
