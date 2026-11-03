import type { CSSProperties, ReactNode } from 'react';
import type { BrickColor } from './palette';

export interface BrickProps {
  color: BrickColor;
  /** Size of one grid square in px. Draws one stud per square; leave out for a plain face (letter and number bricks). */
  stud?: number;
  /** Width and height in grid squares (needs `stud`). Defaults to 1 x 1. */
  cols?: number;
  rows?: number;
  /** Explicit size in px, for bricks that are not whole squares (Home art). Overrides cols and rows. */
  width?: number;
  height?: number;
  /** Corner radius in px (default 5, the art bricks; avatars use 22, 14 or 11). */
  radius?: number;
  /** Text on the brick face, such as a letter or a player's initial. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Bricks are pictures; the control around them carries the name. Pass a label only for a standalone image. */
  label?: string;
}

/** Port of the canvas brick(color, stud): a lit gradient face, and one stud per grid square when `stud` is set. */
export function Brick({ color, stud, cols = 1, rows = 1, width, height, radius = 5, children, className, style, label }: BrickProps) {
  const w = width ?? (stud ? stud * cols : undefined);
  const h = height ?? (stud ? stud * rows : undefined);
  const vars = {
    '--stud': stud ? `${stud}px` : undefined,
    width: w,
    height: h,
    borderRadius: radius,
    ...style,
  } as CSSProperties;
  return (
    <span
      className={['bw-brick', stud ? 'bw-brick--studs' : '', className].filter(Boolean).join(' ')}
      data-brick={color}
      style={vars}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </span>
  );
}
