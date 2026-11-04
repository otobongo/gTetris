import type { ReactNode } from 'react';

/**
 * Icons the screens need that the shared Icon set does not have yet, drawn from the boards in
 * the same style (24 viewBox, currentColor, round caps). Decorative: the control carries the name.
 */
const paths = {
  saved: (
    <>
      <path d="M6 3h12v18l-6-4-6 4z" />
      <path d="M9.5 9.5l2 2 3.5-3.5" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5h.01" />
    </>
  ),
  offline: (
    <>
      <path d="M2 8.5a15 15 0 0 1 4.2-2.7M9.6 5.1A15 15 0 0 1 22 8.5" />
      <path d="M5 12a10 10 0 0 1 3.4-2.1M15.4 10.2A10 10 0 0 1 19 12" />
      <path d="M8.5 15.5a5 5 0 0 1 7 0" />
      <path d="M12 19h.01" />
      <path d="M3 3l18 18" />
    </>
  ),
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  sticker: <path d="M5 4h10l4 4v12H5zM15 4v4h4" />,
  sounds: <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />,
  music: <path d="M9 18V5l12-2v13M3 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0M15 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0" />,
  voice: (
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5zM8.5 10h7M8.5 13.5h4.5" />
  ),
  bell: <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />,
  devices: (
    <>
      <rect x="2" y="4" width="12" height="16" rx="2" />
      <rect x="16" y="8" width="6" height="12" rx="1.5" />
      <path d="M7 17h2" />
    </>
  ),
  minus: <path d="M5 12h14" />,
} satisfies Record<string, ReactNode>;

export type GlyphName = keyof typeof paths;

export function Glyph({ name, size = 24, strokeWidth = 2.4 }: { name: GlyphName; size?: number; strokeWidth?: number }) {
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
      className="sc-glyph"
    >
      {paths[name]}
    </svg>
  );
}
