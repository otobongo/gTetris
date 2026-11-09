/**
 * Review cases for the drag math (six-games brief 3.1, 7.2, 10.1), added by the test review next to
 * dragToTarget.test.ts: the threshold at exactly 8 px through a whole drag, on phone (zoom 1) and on
 * the tablet frame (zoom 1.4), pointercancel at each stage, and a second pointer during a press or a drag.
 */
import { describe, expect, it } from 'vitest';
import { DRAG_IDLE, dragStep, type DragEffect, type DragInput, type DragTrack } from './dragToTarget';

type Item = 'red' | 'blue';

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

const down = (item: Item, x: number, y: number, pointerId = 1): DragInput<Item> => ({ type: 'down', item, pointerId, point: { x, y } });
const move = (x: number, y: number, zoom?: number, pointerId = 1): DragInput<Item> => ({ type: 'move', pointerId, point: { x, y }, zoom });
const up = (target: string | null, pointerId = 1): DragInput<Item> => ({ type: 'up', pointerId, target });
const cancel = (pointerId = 1): DragInput<Item> => ({ type: 'cancel', pointerId });
const click = (keyboard = false): DragInput<Item> => ({ type: 'click', keyboard });

const kinds = (effects: DragEffect<Item>[]) => effects.map((e) => e.kind);

describe('review: the threshold at exactly 8 px, through a drag', () => {
  it('starts at exactly 8 px on either axis, in either direction, and not a hair before', () => {
    for (const [dx, dy] of [
      [8, 0],
      [-8, 0],
      [0, 8],
      [0, -8],
    ]) {
      const before = drive([down('red', 100, 100), move(100 + dx * 0.999, 100 + dy * 0.999)]);
      expect(before.last, `${dx},${dy} just under`).toEqual({ kind: 'none' });
      expect(drive([move(100 + dx, 100 + dy)], before.track).last, `${dx},${dy}`).toEqual({ kind: 'start', item: 'red', offset: { x: dx, y: dy } });
    }
  });

  it('adds x and y travel to exactly 8 px on a diagonal, halves and all', () => {
    expect(drive([down('red', 100, 100), move(104.5, 103.5)]).last).toEqual({ kind: 'start', item: 'red', offset: { x: 4.5, y: 3.5 } });
    expect(drive([down('red', 100, 100), move(104.5, 103.25)]).last).toEqual({ kind: 'none' });
    expect(drive([down('red', 100, 100), move(96, 96)]).last).toEqual({ kind: 'start', item: 'red', offset: { x: -4, y: -4 } });
    expect(drive([down('red', 100, 100), move(105, 97)]).last.kind).toBe('start');
  });

  it('on the tablet frame (zoom 1.4) still starts at 8 screen px, with the offset in the frame’s px', () => {
    expect(drive([down('red', 0, 0), move(7.99, 0, 1.4)]).last).toEqual({ kind: 'none' });
    expect(drive([down('red', 0, 0), move(8, 0, 1.4)]).last).toEqual({ kind: 'start', item: 'red', offset: { x: 8 / 1.4, y: 0 } });
    expect(drive([down('red', 0, 0), move(0, -8, 1.4)]).last).toEqual({ kind: 'start', item: 'red', offset: { x: 0, y: -8 / 1.4 } });
  });

  it('the same pointer path moves the item 1.4 times less on the tablet frame than on phone', () => {
    const path = [down('red', 10, 10), move(38, 10), move(38, 38), move(-18, -4)];
    const phone = drive(path.map((p) => (p.type === 'move' ? { ...p, zoom: 1 } : p))).effects;
    const tablet = drive(path.map((p) => (p.type === 'move' ? { ...p, zoom: 1.4 } : p))).effects;
    expect(phone).toEqual([
      { kind: 'none' },
      { kind: 'start', item: 'red', offset: { x: 28, y: 0 } },
      { kind: 'move', item: 'red', offset: { x: 28, y: 28 } },
      { kind: 'move', item: 'red', offset: { x: -28, y: -14 } },
    ]);
    expect(tablet).toEqual([
      { kind: 'none' },
      { kind: 'start', item: 'red', offset: { x: 20, y: 0 } },
      { kind: 'move', item: 'red', offset: { x: 20, y: 20 } },
      { kind: 'move', item: 'red', offset: { x: -20, y: -10 } },
    ]);
  });

  it('a press that crossed 8 px and came back to where it began is still a drag: its release is a drop or a miss, never a tap', () => {
    const r = drive([down('red', 100, 100), move(108, 100), move(100, 100), up('circle')]);
    expect(kinds(r.effects)).toEqual(['none', 'start', 'move', 'drop']);
    expect(drive([click()], r.track).last).toEqual({ kind: 'swallow' });
    expect(drive([down('red', 100, 100), move(108, 100), move(100, 100), up(null)]).last).toEqual({ kind: 'miss', item: 'red' });
  });
});

describe('review: pointercancel', () => {
  it('mid-drag it drops the drag with no slip, and a release after it from the same pointer does nothing', () => {
    const r = drive([down('red', 0, 0), move(30, 0), cancel(), up('circle')]);
    expect(kinds(r.effects)).toEqual(['none', 'start', 'cancel', 'none']);
    expect(r.track.phase.kind).toBe('idle');
  });

  it('mid-drag it leaves no tap waiting: the next press and tap counts, a keyboard click too', () => {
    const lost = drive([down('red', 0, 0), move(30, 0), cancel()]).track;
    expect(drive([click(true)], lost).last).toEqual({ kind: 'click' });
    expect(drive([down('blue', 0, 0), up(null), click()], lost).last).toEqual({ kind: 'click' });
  });

  it('from another pointer it never drops this one’s press or drag', () => {
    const pressed = drive([down('red', 0, 0)]).track;
    expect(dragStep(pressed, cancel(2)).track).toBe(pressed);
    const dragging = drive([move(30, 0)], pressed).track;
    expect(dragStep(dragging, cancel(2)).track).toBe(dragging);
    expect(drive([move(40, 0), up('circle')], dragging).effects).toEqual([
      { kind: 'move', item: 'red', offset: { x: 40, y: 0 } },
      { kind: 'drop', item: 'red', target: 'circle' },
    ]);
  });
});

describe('review: a second pointer', () => {
  it('a second finger down during a drag cannot move, drop or cancel it, and the first finger’s drag goes on', () => {
    const dragging = drive([down('red', 0, 0), move(30, 0)]).track;
    const r = drive([down('blue', 200, 0, 2), move(260, 40, 1, 2), up('square', 2), cancel(2)], dragging);
    expect(r.effects.every((e) => e.kind === 'none')).toBe(true);
    expect(r.track).toBe(dragging);
    expect(drive([move(50, 0), up('circle')], r.track).effects).toEqual([
      { kind: 'move', item: 'red', offset: { x: 50, y: 0 } },
      { kind: 'drop', item: 'red', target: 'circle' },
    ]);
  });

  it('a finger that came down during another’s press never drags, even after the first one lifts', () => {
    const r = drive([down('red', 0, 0), down('blue', 200, 0, 2), up(null), move(260, 0, 1, 2), up('square', 2)]);
    expect(kinds(r.effects)).toEqual(['none', 'none', 'none', 'none', 'none']);
    expect(r.track).toEqual({ phase: { kind: 'idle' }, swallowClick: false });
  });

  it('once a drag is over, a press from any finger is a new press: it clears the flag, so its own tap counts', () => {
    const after = drive([down('red', 0, 0), move(30, 0), up('circle')]).track;
    expect(after.swallowClick).toBe(true);
    expect(drive([down('blue', 200, 0, 2), up(null, 2), click()], after).last).toEqual({ kind: 'click' });
  });

  it('the same pointer id can press again once its drag is over', () => {
    const r = drive([down('red', 0, 0), move(30, 0), up('circle'), down('blue', 200, 0), move(230, 0), up('square')]);
    expect(r.effects.filter((e) => e.kind === 'drop')).toEqual([
      { kind: 'drop', item: 'red', target: 'circle' },
      { kind: 'drop', item: 'blue', target: 'square' },
    ]);
  });
});
