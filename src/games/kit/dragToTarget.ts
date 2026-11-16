/**
 * Drag an item onto a target (six-games brief 3.1, 7.2): Shape Sorter drops a piece into its hole,
 * Number Line-up drops a tower onto another tower. This file is the pure part (the 8 px threshold,
 * the offset with the tablet zoom taken out, the hit test with its optional catch area, one drag as a
 * small state machine) plus the pointer parts on their own, which Picture Builder's paint strokes use.
 *
 * The pointer handling copies Brick Escape's (SlideGame.tsx): pointer capture as a nicety, offsets
 * divided by the zoom of the tablet frame, and a lost pointer (pointercancel) never counts. With
 * `takeover`, a new finger replaces a still press (a resting palm), and the resting finger's lift
 * and the click after it count for nothing.
 */

/** Travel, x plus y in screen px, before a press becomes a drag (7.2). */
export const DRAG_THRESHOLD_PX = 8;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** True once a press has travelled the threshold: |dx| + |dy| of 8 px or more. */
export function pastThreshold(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX): boolean {
  return Math.abs(dx) + Math.abs(dy) >= threshold;
}

/** A safe zoom: the tablet frame's CSS zoom, 1 on phone; anything not a positive number counts as 1. */
const safeZoom = (zoom: number) => (Number.isFinite(zoom) && zoom > 0 ? zoom : 1);

/**
 * How far the dragged item moves in the frame's own px: the pointer's travel on screen divided by the
 * tablet zoom, because the frame is scaled with CSS zoom and a translate inside it is scaled again.
 */
export function dragOffset(start: Point, now: Point, zoom = 1): Point {
  const z = safeZoom(zoom);
  return { x: (now.x - start.x) / z, y: (now.y - start.y) / z };
}

export const inRect = (p: Point, r: Rect): boolean => p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;

/**
 * How far a point is from a rect: 0 inside it or on its edge (as inRect counts them), else the straight
 * line to the nearest point of the rect, so out from a corner it is the line to that corner.
 */
export function rectDistance(p: Point, r: Rect): number {
  const dx = Math.max(r.left - p.x, 0, p.x - r.right);
  const dy = Math.max(r.top - p.y, 0, p.y - r.bottom);
  return Math.hypot(dx, dy);
}

/**
 * The target under a screen point, from targets' screen rects (getBoundingClientRect, so no zoom is
 * needed). `skip` leaves one out: the dragged tower is itself a target in Number Line-up. When rects
 * overlap, the last one listed wins, as the one painted on top would.
 *
 * `reach` is the catch area, in screen px (Shape Sorter's, brief 7.4): when no rect holds the point,
 * the target whose edge is nearest, and no further than `reach`, counts as under it; on an exact tie the
 * first listed wins. A release inside a target always wins over one near another. A reach of 0, below 0
 * or not a finite number means exact drops only, which is every other game's rule.
 */
export function targetAt<T extends string>(
  point: Point,
  targets: Iterable<readonly [T, Rect]>,
  skip?: string | null,
  reach = 0,
): T | null {
  const near = Number.isFinite(reach) && reach > 0;
  let hit: T | null = null;
  let nearest: T | null = null;
  let best = Infinity;
  for (const [id, rect] of targets) {
    if (id === skip) continue;
    if (inRect(point, rect)) hit = id;
    else if (near && hit === null) {
      const d = rectDistance(point, rect);
      if (d <= reach && d < best) {
        best = d;
        nearest = id;
      }
    }
  }
  return hit ?? nearest;
}

/* ---------- One drag, as a state machine ---------- */

export type DragPhase<I extends string> =
  | { kind: 'idle' }
  /** Pointer down on an item, under the threshold: still a tap. */
  | { kind: 'pressed'; item: I; pointerId: number; start: Point }
  /** Past the threshold: the item follows the pointer. */
  | { kind: 'dragging'; item: I; pointerId: number; start: Point };

/** A still press a new finger took over (a resting palm, say): the pointer and the item it rests on. */
export interface RestingPress<I extends string> {
  pointerId: number;
  item: I;
}

export interface DragTrack<I extends string> {
  phase: DragPhase<I>;
  /**
   * Set when a drag ends, so the click the browser sends after it is ignored. The next pointerdown
   * clears it (the boards cleared it on the next click, which could swallow a real tap), and so does
   * the one click it swallows.
   */
  swallowClick: boolean;
  /**
   * Presses a new finger took over (`takeover` on its pointerdown). They can no longer move, drop or
   * cancel anything; when one lifts, the click the browser sends on its item is swallowed. Left out
   * when there are none.
   */
  resting?: readonly RestingPress<I>[];
  /**
   * Items a resting finger lifted from: the next pointer click on each is swallowed, so a palm never
   * picks the piece it lay on. The next pointerdown clears them, as it clears `swallowClick`. Left out
   * when there are none.
   */
  swallowItems?: readonly I[];
}

export const DRAG_IDLE: DragTrack<never> = Object.freeze({ phase: Object.freeze({ kind: 'idle' as const }), swallowClick: false });

export type DragInput<I extends string> =
  /**
   * `takeover`: this press may replace a press that has never moved, so a palm or a second hand
   * resting on one item does not block a real drag of another. A drag under way always keeps its finger.
   */
  | { type: 'down'; item: I; pointerId: number; point: Point; takeover?: boolean }
  | { type: 'move'; pointerId: number; point: Point; zoom?: number }
  /** `target`: what targetAt found under the release point (the caller looks it up, leaving out the dragged item itself). */
  | { type: 'up'; pointerId: number; target: string | null }
  /** pointercancel or a lost capture: the drag is dropped, with no slip. */
  | { type: 'cancel'; pointerId: number }
  /**
   * A click on an item or target. `keyboard`: Enter or Space (detail 0), which is never swallowed.
   * `item`: the item clicked, so the click after a resting finger lifts from it can be swallowed.
   */
  | { type: 'click'; keyboard?: boolean; item?: I };

export type DragEffect<I extends string> =
  | { kind: 'none' }
  /** The press crossed the threshold: the item starts following the pointer. */
  | { kind: 'start'; item: I; offset: Point }
  /** The item's offset in the frame's px. */
  | { kind: 'move'; item: I; offset: Point }
  /** Released over a target. */
  | { kind: 'drop'; item: I; target: string }
  /** Released over no target: the item goes back. */
  | { kind: 'miss'; item: I }
  /** The pointer was lost: the item goes back, nothing counts. */
  | { kind: 'cancel'; item: I }
  /** A real click or tap: act on it (the tap path). */
  | { kind: 'click' }
  /** The click that followed a drag, or a resting finger's lift: ignore it. */
  | { kind: 'swallow' }
  /** A new finger took over this still press: let go of its pointer. */
  | { kind: 'release'; item: I; pointerId: number };

const NONE = { kind: 'none' } as const;

/** The optional lists, each left out when empty, so a track with none looks as it always has. */
function lists<I extends string>(resting: readonly RestingPress<I>[] | undefined, swallowItems: readonly I[] | undefined): Pick<DragTrack<I>, 'resting' | 'swallowItems'> {
  return { ...(resting?.length ? { resting } : {}), ...(swallowItems?.length ? { swallowItems } : {}) };
}

/** A resting finger lifted: its item's next click is swallowed. Any other pointer's release does nothing. */
function lift<I extends string>(track: DragTrack<I>, pointerId: number): { track: DragTrack<I>; effect: DragEffect<I> } {
  const rest = track.resting?.find((r) => r.pointerId === pointerId);
  if (!rest) return { track, effect: NONE };
  const resting = track.resting!.filter((r) => r !== rest);
  return {
    track: { phase: track.phase, swallowClick: track.swallowClick, ...lists(resting, [...(track.swallowItems ?? []), rest.item]) },
    effect: NONE,
  };
}

/** One pointer event in, the drag's next state and what to do about it out. Pure. */
export function dragStep<I extends string>(track: DragTrack<I>, input: DragInput<I>): { track: DragTrack<I>; effect: DragEffect<I> } {
  const p = track.phase;
  switch (input.type) {
    case 'down': {
      const pressed: DragPhase<I> = { kind: 'pressed', item: input.item, pointerId: input.pointerId, start: input.point };
      // a pointer id can come back for a new touch: that finger is no longer resting
      const resting = track.resting?.filter((r) => r.pointerId !== input.pointerId);
      // a new press clears the clicks still to swallow, as it clears swallowClick: the next click is its own
      if (p.kind === 'idle') return { track: { phase: pressed, swallowClick: false, ...lists(resting, undefined) }, effect: NONE };
      // a new finger may take over a press that never moved (a resting palm); the old finger stays down, resting
      if (input.takeover && p.kind === 'pressed' && p.pointerId !== input.pointerId) {
        const took: RestingPress<I> = { pointerId: p.pointerId, item: p.item };
        return {
          track: { phase: pressed, swallowClick: false, ...lists([...(resting ?? []), took], undefined) },
          effect: { kind: 'release', item: p.item, pointerId: p.pointerId },
        };
      }
      // a second finger while one drag is under way is ignored
      return { track, effect: NONE };
    }
    case 'move': {
      if (p.kind === 'idle' || p.pointerId !== input.pointerId) return { track, effect: NONE };
      const offset = dragOffset(p.start, input.point, input.zoom);
      if (p.kind === 'dragging') return { track, effect: { kind: 'move', item: p.item, offset } };
      if (!pastThreshold(input.point.x - p.start.x, input.point.y - p.start.y)) return { track, effect: NONE };
      return { track: { ...track, phase: { ...p, kind: 'dragging' } }, effect: { kind: 'start', item: p.item, offset } };
    }
    case 'up': {
      if (p.kind === 'idle' || p.pointerId !== input.pointerId) return lift(track, input.pointerId);
      const kept = lists(track.resting, track.swallowItems);
      // under the threshold it was a tap: the click that follows does the work
      if (p.kind === 'pressed') return { track: { phase: { kind: 'idle' }, swallowClick: false, ...kept }, effect: NONE };
      const effect: DragEffect<I> = input.target !== null ? { kind: 'drop', item: p.item, target: input.target } : { kind: 'miss', item: p.item };
      return { track: { phase: { kind: 'idle' }, swallowClick: true, ...kept }, effect };
    }
    case 'cancel': {
      // a resting finger's cancel (the capture let go on takeover) changes nothing: its lift still swallows
      if (p.kind === 'idle' || p.pointerId !== input.pointerId) return { track, effect: NONE };
      const wasDrag = p.kind === 'dragging';
      return {
        track: { phase: { kind: 'idle' }, swallowClick: wasDrag, ...lists(track.resting, track.swallowItems) },
        effect: wasDrag ? { kind: 'cancel', item: p.item } : NONE,
      };
    }
    case 'click': {
      if (input.keyboard) return { track, effect: { kind: 'click' } };
      const at = input.item === undefined ? -1 : (track.swallowItems?.indexOf(input.item) ?? -1);
      if (at >= 0) {
        const swallowItems = track.swallowItems!.filter((_, i) => i !== at);
        return { track: { phase: track.phase, swallowClick: track.swallowClick, ...lists(track.resting, swallowItems) }, effect: { kind: 'swallow' } };
      }
      if (track.swallowClick) return { track: { ...track, swallowClick: false }, effect: { kind: 'swallow' } };
      return { track, effect: { kind: 'click' } };
    }
  }
}

/* ---------- The tap path: tap an item, then a target ---------- */

export interface TapState<I extends string> {
  picked: I | null;
}

export type TapEffect<I extends string> =
  | { kind: 'none' }
  | { kind: 'pick'; item: I | null }
  | { kind: 'drop'; item: I; target: string };

/**
 * A tap on an item picks it, a tap on the picked item puts it down, and a tap on another item moves the
 * pick (or, when items are also targets, as Number Line-up's towers are, drops the picked one on it).
 * A tap on a target with an item picked drops it there; with nothing picked it does nothing.
 */
export function tapStep<I extends string>(
  picked: I | null,
  tap: { item: I; asTarget?: boolean } | { target: string },
): TapEffect<I> {
  if ('target' in tap) return picked === null ? { kind: 'none' } : { kind: 'drop', item: picked, target: tap.target };
  if (picked === tap.item) return { kind: 'pick', item: null };
  if (picked !== null && tap.asTarget) return { kind: 'drop', item: picked, target: tap.item };
  return { kind: 'pick', item: tap.item };
}

/* ---------- Pointer parts, for Picture Builder's paint strokes ---------- */

/** Capture the pointer on the element, so moves and the release still arrive off it. Capture is a nicety: failures are ignored. */
export function capturePointer(el: Element | null | undefined, pointerId: number): void {
  try {
    el?.setPointerCapture(pointerId);
  } catch {
    /* capture is a nicety */
  }
}

/** Let go of a captured pointer; failures are ignored. */
export function releasePointer(el: Element | null | undefined, pointerId: number): void {
  try {
    if (el?.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
  } catch {
    /* nothing to release */
  }
}

/** The pointer's point inside an element, in the frame's own px (the tablet zoom taken out). */
export function localPoint(client: Point, el: Element, zoom = 1): Point {
  const r = el.getBoundingClientRect();
  return dragOffset({ x: r.left, y: r.top }, client, zoom);
}

/**
 * The element under a screen point that matches `selector` (or the topmost element when none is
 * given), skipping anything inside `skip`, such as the dragged item. Null outside a browser.
 */
export function elementUnder(client: Point, selector?: string, skip?: Element | null): Element | null {
  if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') return null;
  for (const el of document.elementsFromPoint(client.x, client.y)) {
    if (skip && skip.contains(el)) continue;
    if (!selector) return el;
    const hit = el.closest(selector);
    if (hit && !(skip && skip.contains(hit))) return hit;
  }
  return null;
}
