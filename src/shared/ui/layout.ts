import { useSyncExternalStore } from 'react';

/** Phone or tablet, and the zoom the tablet boards use (inner 596 x 853 area scaled to the screen). */
export interface Layout {
  mode: 'phone' | 'tablet';
  /** 1 on phone; on tablet the scale that fits 596 x 853 into the viewport, from 1 to 2. */
  zoom: number;
  /** Viewport size in px. */
  width: number;
  height: number;
}

export const TABLET_MIN_WIDTH = 744; // narrowest iPad in portrait
export const TABLET_INNER = { width: 596, height: 853 };

/** Pure layout rule, so it can be tested without a browser. */
export function computeLayout(width: number, height: number): Layout {
  if (width < TABLET_MIN_WIDTH) return { mode: 'phone', zoom: 1, width, height };
  const fit = Math.min(width / TABLET_INNER.width, height / TABLET_INNER.height);
  const zoom = Math.round(Math.min(2, Math.max(1, fit)) * 100) / 100;
  return { mode: 'tablet', zoom, width, height };
}

const PHONE: Layout = { mode: 'phone', zoom: 1, width: 390, height: 844 };
let cached: Layout = PHONE;

function read(): Layout {
  if (typeof window === 'undefined') return PHONE;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (cached.width !== w || cached.height !== h) cached = computeLayout(w, h);
  return cached;
}

function subscribe(cb: () => void) {
  window.addEventListener('resize', cb);
  window.addEventListener('orientationchange', cb);
  return () => {
    window.removeEventListener('resize', cb);
    window.removeEventListener('orientationchange', cb);
  };
}

/** Current layout; re-renders on resize and rotation. Screens use `mode` to pick column counts. */
export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, read, () => PHONE);
}
