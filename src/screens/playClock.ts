import { useEffect } from 'react';
import { progressStore } from '../shared/progress';
import { TICK_MS, countPlayTime } from './logic/minutes';

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
      const count = countPlayTime(carry, now - last, document.visibilityState === 'visible');
      last = now;
      carry = count.carry;
      if (count.minutes > 0 && progressStore.getState().activePlayerId) progressStore.addMinutesPlayed(count.minutes);
    };
    const id = window.setInterval(tick, TICK_MS);
    return () => {
      tick();
      window.clearInterval(id);
    };
  }, [playing]);
}
