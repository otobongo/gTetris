import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { letterColor, type BrickColor } from './data';

/** Small stable tilt per brick so the tray looks scattered, not like a keyboard. */
function tilt(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (Math.abs(h) % 9) - 4;
}

/** A toy-brick letter tile: plain brick face, two studs on top, one big letter.
    Tap works everywhere; when `onDrop` is given the brick can also be dragged onto any `[data-drop]` zone. */
export function LetterBrick({
  ch,
  id,
  className = '',
  color,
  onTap,
  onDrop,
  label,
  scatter = false,
  style,
  disabled,
}: {
  ch: string;
  id?: string;
  className?: string;
  color?: BrickColor | 'white';
  onTap?: () => void;
  onDrop?: () => void;
  label?: string;
  scatter?: boolean;
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
      className={`lb-brick brick ${draggable ? 'is-draggable ' : ''}${className}`}
      data-color={color ?? letterColor(ch)}
      data-id={id}
      aria-label={label ?? ch}
      disabled={disabled}
      style={{ ...(scatter && id ? ({ '--rot': `${tilt(id)}deg` } as CSSProperties) : {}), ...style }}
      // Pointer taps on draggable bricks are handled in pointerup; click stays for keyboard (detail 0).
      onClick={(e) => {
        if (!draggable || e.detail === 0) onTap?.();
      }}
      {...handlers}
    >
      <span className="lb-brick__ch">{ch}</span>
    </button>
  );
}
