/**
 * The pointer hook over dragToTarget.ts (six-games brief 3.1, 7.2): drag an item onto a target, or tap
 * the item and then the target. Shape Sorter drops pieces into holes; Number Line-up drops a tower
 * onto another tower (`itemsAreTargets`).
 *
 * - A press becomes a drag after 8 px of travel; the pointer is captured; the offset is divided by the
 *   tablet zoom and written to the item as the CSS variables `--drag-x` and `--drag-y` (no React render
 *   per move), while `dragging` names the item once, so the game adds its dragging class.
 * - A release over a target drops the item there; anywhere else it goes back (`onMiss`, never a slip).
 *   With `reach` (Shape Sorter's catch area, brief 7.4), a release within that many px of a target's
 *   edge drops it on the nearest such target too; a release inside a target still wins. The default is
 *   0: exact drops, as every other game has them.
 * - `pointercancel` (or a lost capture) drops the drag and nothing counts.
 * - The click the browser sends after a drag is ignored, through a flag the next pointerdown clears;
 *   keyboard clicks (Enter, Space) always count.
 */
import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { useLayout } from '../../shared/ui/layout';
import { DRAG_IDLE, capturePointer, dragStep, tapStep, targetAt, type DragEffect, type DragInput, type DragTrack, type Rect } from './dragToTarget';

/** The CSS variables the hook writes on the dragged item, in px of the frame. */
export const DRAG_X = '--drag-x';
export const DRAG_Y = '--drag-y';

export interface UseDragToTargetOptions<I extends string, T extends string> {
  /**
   * The item was released over a target, or tapped and then the target tapped. The game decides right
   * or wrong (a wrong one is its slip). The pick is cleared first.
   */
  onDrop: (item: I, target: T | I, how: 'drag' | 'tap') => void;
  /** A drag released over no target: the item goes back. Never a slip. */
  onMiss?: (item: I) => void;
  /** The tap path picked an item, or put it down (null): for `sfx.tap` and the help line. */
  onPick?: (item: I | null) => void;
  /** A press became a drag: for the help line ("Drop the red circle in its hole."). */
  onDragStart?: (item: I) => void;
  /** Items are targets too: a tap on another item, or a drag onto it, drops the picked one there. */
  itemsAreTargets?: boolean;
  /** No drags and no taps: after the solve, while a card is open, during a look. */
  disabled?: boolean;
  /** The tablet frame's zoom; defaults to the layout's. */
  zoom?: number;
  /**
   * The catch area around each target, in the frame's px (default 0, exact drops only). The hit test
   * works in screen px, so it is multiplied by the zoom: Shape Sorter's 24 px is 33.6 px on the tablet frame.
   */
  reach?: number;
}

/** Spread on each item's <button>. */
export interface DragItemProps {
  ref: (el: HTMLElement | null) => void;
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLElement>) => void;
  onLostPointerCapture: (e: PointerEvent<HTMLElement>) => void;
  onClick: (e: MouseEvent<HTMLElement>) => void;
}

/** Spread on each target's <button>. */
export interface DragTargetProps {
  ref: (el: HTMLElement | null) => void;
  onClick: (e: MouseEvent<HTMLElement>) => void;
}

export interface DragApi<I extends string, T extends string> {
  /** The item the tap path picked, or null. */
  picked: I | null;
  /** The item following the pointer, or null. */
  dragging: I | null;
  /** Set or clear the pick (a game clears it after a wrong placement, say). */
  pick(item: I | null): void;
  item(id: I): DragItemProps;
  target(id: T): DragTargetProps;
}

const isKeyboardClick = (e: MouseEvent) => e.detail === 0;

export function useDragToTarget<I extends string, T extends string = string>(options: UseDragToTargetOptions<I, T>): DragApi<I, T> {
  const layout = useLayout();
  const [picked, setPicked] = useState<I | null>(null);
  const [dragging, setDragging] = useState<I | null>(null);
  /** The latest options and pick, read by handlers that live for the whole component. */
  const live = useRef({ options, zoom: options.zoom ?? layout.zoom, picked });
  live.current = { options, zoom: options.zoom ?? layout.zoom, picked };
  const track = useRef<DragTrack<I>>(DRAG_IDLE);
  const items = useRef(new Map<string, HTMLElement>());
  const targets = useRef(new Map<string, HTMLElement>());

  const api = useMemo(() => {
    const itemRefs = new Map<string, (el: HTMLElement | null) => void>();
    const targetRefs = new Map<string, (el: HTMLElement | null) => void>();
    const refFor = (cache: Map<string, (el: HTMLElement | null) => void>, into: Map<string, HTMLElement>, id: string) => {
      let fn = cache.get(id);
      if (!fn) {
        fn = (el) => {
          if (el) into.set(id, el);
          else into.delete(id);
        };
        cache.set(id, fn);
      }
      return fn;
    };

    const setPick = (item: I | null) => {
      if (live.current.picked === item) return;
      live.current.picked = item;
      setPicked(item);
      live.current.options.onPick?.(item);
    };

    const place = (item: I | null, offset: { x: number; y: number } | null) => {
      const el = item === null ? null : items.current.get(item);
      if (!el) return;
      if (offset) {
        el.style.setProperty(DRAG_X, `${offset.x}px`);
        el.style.setProperty(DRAG_Y, `${offset.y}px`);
      } else {
        el.style.removeProperty(DRAG_X);
        el.style.removeProperty(DRAG_Y);
      }
    };

    const endDrag = (item: I) => {
      place(item, null);
      setDragging(null);
    };

    const apply = (effect: DragEffect<I>) => {
      const o = live.current.options;
      switch (effect.kind) {
        case 'start':
          setPick(null);
          setDragging(effect.item);
          place(effect.item, effect.offset);
          o.onDragStart?.(effect.item);
          return;
        case 'move':
          place(effect.item, effect.offset);
          return;
        case 'drop':
          endDrag(effect.item);
          o.onDrop(effect.item, effect.target as T | I, 'drag');
          return;
        case 'miss':
          endDrag(effect.item);
          o.onMiss?.(effect.item);
          return;
        case 'cancel':
          endDrag(effect.item);
          return;
        default:
          return;
      }
    };

    const step = (input: DragInput<I>): DragEffect<I> => {
      const out = dragStep(track.current, input);
      track.current = out.track;
      apply(out.effect);
      return out.effect;
    };

    const point = (e: PointerEvent) => ({ x: e.clientX, y: e.clientY });

    /**
     * The target under the release point. With itemsAreTargets the other items count too, never the
     * dragged one (it is under the finger). A target may share the dragged item's id (a piece and its own hole).
     * The rects are screen px, so the reach (the frame's px) is scaled by the same zoom as the drag.
     */
    const hit = (e: PointerEvent, item: string | null): string | null => {
      const rects: [string, Rect][] = [];
      targets.current.forEach((el, id) => rects.push([id, el.getBoundingClientRect()]));
      if (live.current.options.itemsAreTargets) items.current.forEach((el, id) => id !== item && rects.push([id, el.getBoundingClientRect()]));
      const { options: o, zoom } = live.current;
      return targetAt(point(e), rects, null, (o.reach ?? 0) * zoom);
    };

    const dragged = () => (track.current.phase.kind === 'idle' ? null : track.current.phase.item);

    return {
      setPick,
      reset() {
        const item = dragged();
        track.current = DRAG_IDLE;
        if (item !== null) endDrag(item);
        setPick(null);
      },
      item: (id: I): DragItemProps => ({
        ref: refFor(itemRefs, items.current, id),
        onPointerDown(e) {
          if (live.current.options.disabled || e.button > 0) return;
          capturePointer(e.currentTarget, e.pointerId);
          step({ type: 'down', item: id, pointerId: e.pointerId, point: point(e) });
        },
        onPointerMove(e) {
          step({ type: 'move', pointerId: e.pointerId, point: point(e), zoom: live.current.zoom });
        },
        onPointerUp(e) {
          if (live.current.options.disabled) {
            step({ type: 'cancel', pointerId: e.pointerId });
            return;
          }
          step({ type: 'up', pointerId: e.pointerId, target: hit(e, dragged()) });
        },
        onPointerCancel(e) {
          step({ type: 'cancel', pointerId: e.pointerId });
        },
        onLostPointerCapture(e) {
          // also fires after a normal release, when the drag is already over: then it does nothing
          step({ type: 'cancel', pointerId: e.pointerId });
        },
        onClick(e) {
          if (step({ type: 'click', keyboard: isKeyboardClick(e) }).kind !== 'click') return;
          if (live.current.options.disabled) return;
          const tap = tapStep(live.current.picked, { item: id, asTarget: live.current.options.itemsAreTargets });
          if (tap.kind === 'pick') setPick(tap.item);
          else if (tap.kind === 'drop') {
            setPick(null);
            live.current.options.onDrop(tap.item, tap.target as T | I, 'tap');
          }
        },
      }),
      target: (id: T): DragTargetProps => ({
        ref: refFor(targetRefs, targets.current, id),
        onClick(e) {
          if (step({ type: 'click', keyboard: isKeyboardClick(e) }).kind !== 'click') return;
          if (live.current.options.disabled) return;
          const tap = tapStep(live.current.picked, { target: id });
          if (tap.kind !== 'drop') return;
          setPick(null);
          live.current.options.onDrop(tap.item, tap.target as T, 'tap');
        },
      }),
    };
  }, []);

  // Turning the board off (a solve, a card, a look) drops any drag and the pick.
  useEffect(() => {
    if (options.disabled) api.reset();
  }, [options.disabled, api]);

  return { picked, dragging, pick: api.setPick, item: api.item, target: api.target };
}
