import { useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import { useLayout } from '../../shared/ui';
import { letterColor, type BrickColor } from './data';
import { overlapsDrop } from './logic';

/** A letter brick has the colour of its letter, or white for the small letters in Big and small. */
export type LetterColor = BrickColor | 'white';

const faceColor = (ch: string, color?: LetterColor) => color ?? letterColor(ch);

/** Where a dragged brick was let go: its centre on screen and its width there (drawn bigger while it is dragged). */
export interface DropAt {
  x: number;
  y: number;
  w: number;
}

/** Tile: a toy-brick letter with two studs on top, sized by the tray's --tw / --th variables (see sizing.ts).
    Slot: the same face without studs, sitting in the answer row, sized by --sw / --sh.
    Tap works everywhere; when `onDrop` is given the tile can also be dragged onto any `[data-drop]` zone.
    `onPointerTap`, when given, takes a pointer tap on a draggable tile instead of `onTap`; the keyboard still calls `onTap`.
    `dropByOverlap` (practice) also takes a drop when the dragged brick itself overlaps the zone, and lights the zone
    (is-over) while it does; `onMiss` hears a drag let go off every zone. */
export function LetterBrick({
  ch,
  id,
  className = '',
  color,
  shape = 'tile',
  onTap,
  onPointerTap,
  onDrop,
  dropByOverlap = false,
  onMiss,
  label,
  rot = 0,
  style,
  disabled,
}: {
  ch: string;
  id?: string;
  className?: string;
  color?: LetterColor;
  shape?: 'tile' | 'slot';
  onTap?: () => void;
  onPointerTap?: () => void;
  onDrop?: (at: DropAt) => void;
  dropByOverlap?: boolean;
  onMiss?: () => void;
  label?: string;
  /** Tilt in degrees, so a tray looks tossed, not like a keyboard. */
  rot?: number;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  /** A finger tap was just handled in pointerup, so the click the browser sends after touchend must not land. */
  const tapHandled = useRef(false);
  const draggable = !!onDrop && !disabled;
  // The tablet frame is scaled with CSS zoom and a translate inside it is scaled again, so the offset is divided by it.
  const { zoom } = useLayout();
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;

  // A tap is handled on pointerup, and what it changes (the last letter in: Next takes the tray's place) is drawn
  // before touchend. The click that follows would then press whatever now sits under the finger. React's own
  // onTouchEnd never hears it, because React has already swapped this tile for its ghost, but a listener on the
  // node itself still does, and cancelling touchend there cancels that click. A tile unmounted by its own tap
  // keeps listening until that touchend arrives.
  useEffect(() => {
    const el = ref.current;
    if (!el || !draggable) return;
    let timer = 0;
    const onEnd = (e: TouchEvent) => {
      if (!tapHandled.current) return;
      tapHandled.current = false;
      if (e.cancelable) e.preventDefault();
      if (timer) stop();
    };
    const stop = () => {
      window.clearTimeout(timer);
      el.removeEventListener('touchend', onEnd);
    };
    el.addEventListener('touchend', onEnd, { passive: false });
    return () => {
      if (tapHandled.current) timer = window.setTimeout(stop, 1000);
      else stop();
    };
  }, [draggable]);

  /** The drop zones the brick is over now: under the finger, or (dropByOverlap) under the brick itself. */
  const zonesAt = (x: number, y: number, r: DOMRect): Element[] => {
    const under = new Set(
      document
        .elementsFromPoint(x, y)
        .map((n) => n.closest('[data-drop]'))
        .filter((n): n is Element => !!n),
    );
    if (dropByOverlap) for (const zone of document.querySelectorAll('[data-drop]')) if (overlapsDrop(r, zone.getBoundingClientRect())) under.add(zone);
    return [...under];
  };

  /** Practice lights the zone the brick would go into, and only while it is over it (no motion). */
  const light = (zones: Element[]) => {
    if (!dropByOverlap) return;
    for (const zone of document.querySelectorAll('[data-drop]')) zone.classList.toggle('is-over', zones.includes(zone));
  };

  const end = (el: HTMLElement) => {
    el.classList.remove('is-dragging');
    el.style.removeProperty('--dx');
    el.style.removeProperty('--dy');
    light([]);
  };

  const handlers = draggable
    ? {
        onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
          if (e.button !== 0) return;
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* synthetic pointer */
          }
        },
        onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (!d.moved && Math.hypot(dx, dy) < 10) return;
          d.moved = true;
          const el = e.currentTarget;
          el.classList.add('is-dragging');
          el.style.setProperty('--dx', `${dx / z}px`);
          el.style.setProperty('--dy', `${dy / z}px`);
          if (dropByOverlap) light(zonesAt(e.clientX, e.clientY, el.getBoundingClientRect()));
        },
        onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          const el = e.currentTarget;
          // Measured before the brick drops its drag transform, so a flight can start where the child let go.
          const r = el.getBoundingClientRect();
          const over = d.moved && zonesAt(e.clientX, e.clientY, r).length > 0;
          end(el);
          if (!d.moved) {
            tapHandled.current = e.pointerType === 'touch';
            (onPointerTap ?? onTap)?.();
          } else if (over) onDrop?.({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width });
          else onMiss?.();
        },
        onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => {
          drag.current = null;
          end(e.currentTarget);
        },
      }
    : {};

  return (
    <button
      ref={ref}
      type="button"
      className={`lb-brick lb-brick--${shape} ${draggable ? 'is-draggable ' : ''}${className}`}
      data-brick={faceColor(ch, color)}
      data-id={id}
      aria-label={label ?? ch}
      disabled={disabled}
      style={{ '--rot': `${rot}deg`, ...style } as CSSProperties}
      // Pointer taps on draggable bricks are handled in pointerup; click stays for keyboard (detail 0).
      onClick={(e) => {
        if (!draggable || e.detail === 0) onTap?.();
      }}
      {...handlers}
    >
      <span className="lb-brick__ch" aria-hidden="true">
        {ch}
      </span>
    </button>
  );
}

/** A filled answer-row brick that cannot be pressed (used when slots are too small to be a 44px target). */
export function StaticBrick({ ch, className = '', style }: { ch: string; className?: string; style?: CSSProperties }) {
  return (
    <span className={`lb-brick lb-brick--slot ${className}`} data-brick={letterColor(ch)} style={style}>
      <span className="lb-brick__ch">{ch}</span>
    </span>
  );
}
