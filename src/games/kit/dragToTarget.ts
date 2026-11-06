/**
 * Drag an item onto a target (six-games brief 3.1, 7.2): Shape Sorter drops a piece into its hole,
 * Number Line-up drops a tower onto another tower. This file is the pure part (the 8 px threshold,
 * the offset with the tablet zoom taken out, the hit test, one drag as a small state machine) plus
 * the pointer parts on their own, which Picture Builder's paint strokes use.
 *
 * The pointer handling copies Brick Escape's (SlideGame.tsx): pointer capture as a nicety, offsets
 * divided by the zoom of the tablet frame, and a lost pointer (pointercancel) never counts.
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
 * The target under a screen point, from targets' screen rects (getBoundingClientRect, so no zoom is
 * needed). `skip` leaves one out: the dragged tower is itself a target in Number Line-up. When rects
 * overlap, the last one listed wins, as the one painted on top would.
 */
export function targetAt<T extends string>(point: Point, targets: Iterable<readonly [T, Rect]>, skip?: string | null): T | null {
  let hit: T | null = null;
  for (const [id, rect] of targets) if (id !== skip && inRect(point, rect)) hit = id;
  return hit;
}

/* ---------- One drag, as a state machine ---------- */

export type DragPhase<I extends string> =
  | { kind: 'idle' }
  /** Pointer down on an item, under the threshold: still a tap. */
  | { kind: 'pressed'; item: I; pointerId: number; start: Point }
  /** Past the threshold: the item follows the pointer. */
  | { kind: 'dragging'; item: I; pointerId: number; start: Point };

export interface DragTrack<I extends string> {
  phase: DragPhase<I>;
  /**
   * Set when a drag ends, so the click the browser sends after it is ignored. The next pointerdown
   * clears it (the boards cleared it on the next click, which could swallow a real tap), and so does
   * the one click it swallows.
   */
  swallowClick: boolean;
}

export const DRAG_IDLE: DragTrack<never> = Object.freeze({ phase: Object.freeze({ kind: 'idle' as const }), swallowClick: false });

export type DragInput<I extends string> =
  | { type: 'down'; item: I; pointerId: number; point: Point }
  | { type: 'move'; pointerId: number; point: Point; zoom?: number }
  /** `target`: what targetAt found under the release point (the caller looks it up). */
  | { type: 'up'; pointerId: number; target: string | null }
  /** pointercancel or a lost capture: the drag is dropped, with no slip. */
  | { type: 'cancel'; pointerId: number }
  /** A click on an item or target. `keyboard`: Enter or Space (detail 0), which is never swallowed. */
  | { type: 'click'; keyboard?: boolean };

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
  /** The click that followed a drag: ignore it. */
  | { kind: 'swallow' };

const NONE = { kind: 'none' } as const;

/** One pointer event in, the drag's next state and what to do about it out. Pure. */
export function dragStep<I extends string>(track: DragTrack<I>, input: DragInput<I>): { track: DragTrack<I>; effect: DragEffect<I> } {
  const p = track.phase;
  switch (input.type) {
    case 'down':
      // a second finger while one drag is under way is ignored
      if (p.kind !== 'idle') return { track, effect: NONE };
      return { track: { phase: { kind: 'pressed', item: input.item, pointerId: input.pointerId, start: input.point }, swallowClick: false }, effect: NONE };
    case 'move': {
      if (p.kind === 'idle' || p.pointerId !== input.pointerId) return { track, effect: NONE };
      const offset = dragOffset(p.start, input.point, input.zoom);
      if (p.kind === 'dragging') return { track, effect: { kind: 'move', item: p.item, offset } };
      if (!pastThreshold(input.point.x - p.start.x, input.point.y - p.start.y)) return { track, effect: NONE };
      return { track: { ...track, phase: { ...p, kind: 'dragging' } }, effect: { kind: 'start', item: p.item, offset } };
    }
    case 'up': {
      if (p.kind === 'idle' || p.pointerId !== input.pointerId) return { track, effect: NONE };
      // under the threshold it was a tap: the click that follows does the work
      if (p.kind === 'pressed') return { track: { phase: { kind: 'idle' }, swallowClick: false }, effect: NONE };
      const effect: DragEffect<I> = input.target !== null && input.target !== p.item ? { kind: 'drop', item: p.item, target: input.target } : { kind: 'miss', item: p.item };
      return { track: { phase: { kind: 'idle' }, swallowClick: true }, effect };
    }
    case 'cancel': {
      if (p.kind === 'idle' || p.pointerId !== input.pointerId) return { track, effect: NONE };
      const wasDrag = p.kind === 'dragging';
      return { track: { phase: { kind: 'idle' }, swallowClick: wasDrag }, effect: wasDrag ? { kind: 'cancel', item: p.item } : NONE };
    }
    case 'click':
      if (input.keyboard) return { track, effect: { kind: 'click' } };
      if (track.swallowClick) return { track: { ...track, swallowClick: false }, effect: { kind: 'swallow' } };
      return { track, effect: { kind: 'click' } };
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
