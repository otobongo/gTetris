import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { letterColor, type BrickColor } from './data';

/** A letter brick has the colour of its letter, or white for the small letters in Big and small. */
export type LetterColor = BrickColor | 'white';

const faceColor = (ch: string, color?: LetterColor) => color ?? letterColor(ch);

/** Tile: a toy-brick letter with two studs on top, sized by the tray's --tw / --th variables (see sizing.ts).
    Slot: the same face without studs, sitting in the answer row, sized by --sw / --sh.
    Tap works everywhere; when `onDrop` is given the tile can also be dragged onto any `[data-drop]` zone. */
export function LetterBrick({
  ch,
  id,
  className = '',
  color,
  shape = 'tile',
  onTap,
  onDrop,
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
  onDrop?: () => void;
  label?: string;
  /** Tilt in degrees, so a tray looks tossed, not like a keyboard. */
  rot?: number;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const draggable = !!onDrop && !disabled;

  const end = (el: HTMLElement) => {
    el.classList.remove('is-dragging');
    el.style.removeProperty('--dx');
    el.style.removeProperty('--dy');
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
          el.style.setProperty('--dx', `${dx}px`);
          el.style.setProperty('--dy', `${dy}px`);
        },
        onPointerUp: (e: PointerEvent<HTMLButtonElement>) => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          end(e.currentTarget);
          if (!d.moved) onTap?.();
          else if (document.elementsFromPoint(e.clientX, e.clientY).some((n) => n.closest('[data-drop]'))) onDrop?.();
        },
        onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => {
          drag.current = null;
          end(e.currentTarget);
        },
      }
    : {};

  return (
    <button
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
