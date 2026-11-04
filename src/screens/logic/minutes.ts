/**
 * Play-time counting for the daily limit (brief 3.4), as one pure step so it can be tested
 * without a browser. While a level is open the play clock ticks every TICK_MS. Each tick adds
 * the time since the last tick, only while the page is visible, and hands whole minutes to the
 * store. Part of a minute carries over to the next tick and the next level.
 */
export const MINUTE_MS = 60_000;
export const TICK_MS = 5_000;
/**
 * The most one tick can count. The interval does not run while a device sleeps or a hidden tab is
 * frozen, so the first tick afterwards can see hours since the last one; only the stretch a running
 * clock could have seen counts. Time going backwards (the device clock was changed) counts as none.
 */
export const MAX_STEP_MS = TICK_MS * 2;

export interface PlayCount {
  /** Visible play time not yet counted as a whole minute (ms). */
  carry: number;
  /** Whole minutes to add to today's count. */
  minutes: number;
}

export function countPlayTime(carry: number, elapsedMs: number, visible: boolean): PlayCount {
  const step = Number.isFinite(elapsedMs) ? Math.min(MAX_STEP_MS, Math.max(0, elapsedMs)) : 0;
  let c = carry + (visible ? step : 0);
  let minutes = 0;
  while (c >= MINUTE_MS) {
    c -= MINUTE_MS;
    minutes++;
  }
  return { carry: c, minutes };
}
