/* Color Mixer's drawn parts (brief 4.1, 7.3), as the Mixer board shows them: a slot, the bowl, a paint
   swatch. They hold no state; MixerPlay owns it. Paint and result colours are content (colors.ts), so they
   reach the CSS as one custom property, never as a hex in the stylesheet. */
import type { CSSProperties } from 'react';
import { cx } from '../../shared/ui';
import type { ColorId } from './colors';
import { hexOf } from './play';

export const paintStyle = (color: ColorId): CSSProperties => ({ ['--mix-paint' as string]: hexOf(color) });

export interface SlotProps {
  paint: ColorId | null;
  /** The word inside an empty slot ("paint 1"). */
  label: string;
  /** The accessible name ("Paint 1: red, given"). */
  name: string;
  /** True when a tap would empty the slot. */
  active?: boolean;
  onTap?: () => void;
}

/** One of the two 64 px slots: dashed with its label when empty, the paint's colour when filled. */
export function Slot({ paint, label, name, active = false, onTap }: SlotProps) {
  return (
    <button
      type="button"
      className={cx('mix-slot', paint ? 'is-filled' : 'is-empty')}
      style={paint ? paintStyle(paint) : undefined}
      aria-label={name}
      aria-disabled={active ? undefined : true}
      tabIndex={active ? undefined : -1}
      onClick={active ? onTap : undefined}
    >
      {paint ? null : label}
    </button>
  );
}

/** The 230 x 170 bowl. `color` null shows it empty (also in Guess until the right colour is tapped). */
export function Bowl({ color, name }: { color: ColorId | null; name: string }) {
  return (
    <div className="mix-bowl" role="img" aria-label={name}>
      <div className="mix-bowl__body" />
      <div className="mix-bowl__liquid" style={color ? paintStyle(color) : undefined} />
      <div className="mix-bowl__rim" />
    </div>
  );
}

/** The 64 px painted swatch of a pot or a Guess choice. */
export function Swatch({ color }: { color: ColorId }) {
  return <span className="mix-swatch" style={paintStyle(color)} />;
}
