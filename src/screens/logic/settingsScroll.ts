/**
 * Where Settings was scrolled to when a grown-up opened a game's level picker from a Progress row
 * (usability batch D, app-grownups-5). Back and "Set Level N for Leo" both mount Settings again, which
 * takes the value once and scrolls back there, so setting levels for several games or children does
 * not start each round at the top. It is its own one-shot value: settingsReturn.child() is also set by a
 * plain chip tap, so it cannot tell a return from the picker.
 */
import { parseRoute, splitPath, type Route } from '../../shared/router';

let stored: number | null = null;
let listening = false;

/** Remember the Settings scroller's scrollTop. Anything but a finite number of pixels from 0 up is ignored. */
export function setScroll(n: number): void {
  stored = Number.isFinite(n) && n >= 0 ? n : null;
  if (stored !== null) listen();
}

/** The remembered scrollTop, or null; reading it clears it. */
export function takeScroll(): number | null {
  const n = stored;
  stored = null;
  return n;
}

/**
 * The place is only for the way back from the picker. It stays while the grown-up is on a level picker
 * or back on Settings, and goes on any other screen: Play Level N for the child who is playing opens the
 * game, and the next visit to Settings, through Home and the grown-up check, starts at the top.
 */
export function followRoute(route: Route): void {
  if (route.name !== 'settings' && route.name !== 'levelPicker') stored = null;
}

/** Follow each new hash once a place is stored (every app link and redirect changes the hash). */
function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('hashchange', () => followRoute(parseRoute(splitPath(window.location.hash))));
}
