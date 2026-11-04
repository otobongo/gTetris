import { useEffect } from 'react';
import { progressStore } from '../shared/progress';

const MINUTE = 60_000;
/** Visible play time not yet counted as a whole minute, kept across levels. */
let carry = 0;

/**
 * Counts play time for the daily limit: one minute for every minute a level is open on screen
 * while the page is visible. Break takes over at the next screen change once the limit is used
 * up, so a level in progress is never cut off (see open issues: saving a board mid-level).
 */
export function usePlayClock(playing: boolean) {
  useEffect(() => {
    if (!playing) return;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible') carry += now - last;
      last = now;
      while (carry >= MINUTE) {
        carry -= MINUTE;
        if (progressStore.getState().activePlayerId) progressStore.addMinutesPlayed(1);
      }
    };
    const id = window.setInterval(tick, 5_000);
    return () => {
      tick();
      window.clearInterval(id);
    };
  }, [playing]);
}
