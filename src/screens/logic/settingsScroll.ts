/**
 * Where Settings was scrolled to when a grown-up opened a game's level picker from a Progress row
 * (usability batch D, app-grownups-5). Back and "Set Level N for Leo" both mount Settings again, which
 * takes the value once and scrolls back there, so setting levels for several games or children does
 * not start each round at the top. It is its own one-shot value: settingsReturn.child() is also set by a
 * plain chip tap, so it cannot tell a return from the picker.
 */
let stored: number | null = null;

/** Remember the Settings scroller's scrollTop. Anything but a finite number of pixels from 0 up is ignored. */
export function setScroll(n: number): void {
  stored = Number.isFinite(n) && n >= 0 ? n : null;
}

/** The remembered scrollTop, or null; reading it clears it. */
export function takeScroll(): number | null {
  const n = stored;
  stored = null;
  return n;
}
