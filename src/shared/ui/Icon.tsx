import type { ReactNode } from 'react';

/** Inline SVG icons on a 24 viewBox, stroke-based, inheriting currentColor. Fills only for the star and play. */
const paths = {
  back: <path d="M15 5l-7 7 7 7" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  down: <path d="M5 9l7 7 7-7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  restart: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v5h5" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
  pause: (
    <>
      <path d="M9 5v14" />
      <path d="M15 5v14" />
    </>
  ),
  play: <path d="M8 5l11 7-11 7z" fill="currentColor" />,
  star: <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" fill="currentColor" stroke="none" />,
  hint: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M17 8a5 5 0 0 1 0 8" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M17 9l5 6M22 9l-5 6" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16.5 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M19 7a7 7 0 0 1 0 10" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M4 7l8 6 8-6" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  document: (
    <>
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 13h6M10 17h6" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4v5h-5" />
    </>
  ),
  drop: (
    <>
      <path d="M6 5l6 6 6-6" />
      <path d="M6 12l6 6 6-6" />
    </>
  ),
  hold: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="3" />
      <path d="M9 12h6" />
    </>
  ),
  shuffle: (
    <>
      <path d="M4 7h3c5 0 5 10 10 10h3" />
      <path d="M4 17h3c2 0 3-1.5 4-3.5" />
      <path d="M13 9.5c1-2 2-2.5 4-2.5h3" />
      <path d="M18 4l3 3-3 3M18 14l3 3-3 3" />
    </>
  ),
  /** Take a different puzzle (the stuck offer, brief section 8). */
  swap: (
    <>
      <path d="M4 8h12M13 5l3 3-3 3" />
      <path d="M20 16H8M11 13l-3 3 3 3" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v10h12V10" />
    </>
  ),
  /** Picture Builder's Peek cover (six-games brief 3.6, 7.8), as drawn on the Builder board. */
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  /** Picture Builder's eraser in the palette (six-games brief 3.6, 7.8), as drawn on the Builder board. */
  eraser: (
    <>
      <path d="M7 21h10" />
      <path d="M5 15l8-8 6 6-6 6H9z" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export interface IconProps {
  /** Icon name. Unknown names render an empty icon (the games pass strings). */
  name: IconName | (string & {});
  /** Pixel size, default 26. */
  size?: number;
  /** Stroke width, 2.2 to 2.8 (default 2.6; top bar buttons use 2.8). */
  strokeWidth?: number;
}

/** Decorative by design (aria-hidden): the control around it carries the name. */
export function Icon({ name, size = 26, strokeWidth = 2.6 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {(paths as Record<string, ReactNode>)[name]}
    </svg>
  );
}
