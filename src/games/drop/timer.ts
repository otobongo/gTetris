import type { AgeBand, TimerMode } from '../../shared/progress';
import type { Stage } from './stages';

/**
 * The game timer on the Brick Drop board (Grownups board, "game timer" modes):
 * - off: no timer row at all.
 * - relaxed, or ages 3 to 4 (age factor 0): a gentle clock that counts up. It never ends a game.
 * - auto: a countdown. Time is the stage's base time times the age factor. Running out never ends
 *   the game and never costs a star (Brick Drop's stars come from bricks used, not from time).
 */
export type TimerPlan = { kind: 'off' } | { kind: 'relaxed' } | { kind: 'countdown'; seconds: number };

/** Age factor from the Grownups board. */
export const AGE_FACTOR: Record<AgeBand, number> = { '3-4': 0, '5-6': 2, '7-8': 1.5, '9-10': 1 };

/** [PLACEHOLDER: seconds of base time per goal row. The boards only show a sample (2:00 for a 6-row stage at age 7). Confirm before release.] */
export const SECONDS_PER_ROW = 15;

export function timerPlan(stage: Stage, mode: TimerMode, band: AgeBand): TimerPlan {
  if (mode === 'off') return { kind: 'off' };
  const factor = AGE_FACTOR[band];
  if (mode === 'relaxed' || factor === 0) return { kind: 'relaxed' };
  return { kind: 'countdown', seconds: Math.round(stage.goalRows * SECONDS_PER_ROW * factor) };
}

/** 125 -> "2:05". Negative numbers count as 0. */
export function formatClock(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds));
  const s = t % 60;
  return `${Math.floor(t / 60)}:${s < 10 ? '0' : ''}${s}`;
}

export type TimerState = 'ok' | 'low' | 'out';

/** Bar colour state: green above a third of the time, yellow below, pink when it has run out. */
export function timerState(left: number, total: number): TimerState {
  return left <= 0 ? 'out' : left > total / 3 ? 'ok' : 'low';
}

/** The word that pops up when rows clear. */
export function clearMessage(rows: number): string {
  return rows <= 1 ? 'Nice row!' : rows === 2 ? 'Double rows!' : rows === 3 ? 'Triple rows!' : 'Big clear!';
}
