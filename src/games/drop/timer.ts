import type { AgeBand, TimerMode } from '../../shared/progress';
import type { Stage } from './stages';

/**
 * The game timer on the Brick Drop board (Grownups board, "game timer" modes):
 * - off: no timer row at all.
 * - relaxed, or ages 3 to 4 (age factor 0): the gentle sand timer (decision D3), a bar that fills over
 *   the stage's base time (x2 for ages 3 to 4, as in Brick Escape), with no digits. It never ends a game
 *   and never costs a star.
 * - auto: a countdown. Time is the stage's base time times the age factor. Running out never ends
 *   the game; it caps the stage at 2 stars, the shared rule every game uses (games/stars.ts).
 */
export type TimerPlan = { kind: 'off' } | { kind: 'relaxed'; seconds: number } | { kind: 'countdown'; seconds: number };

/** Age factor from the Grownups board. */
export const AGE_FACTOR: Record<AgeBand, number> = { '3-4': 0, '5-6': 2, '7-8': 1.5, '9-10': 1 };

/** [PLACEHOLDER: seconds of base time per goal row. The boards only show a sample (2:00 for a 6-row stage at age 7). Confirm before release.] */
export const SECONDS_PER_ROW = 15;

export function timerPlan(stage: Stage, mode: TimerMode, band: AgeBand): TimerPlan {
  if (mode === 'off') return { kind: 'off' };
  const factor = AGE_FACTOR[band];
  const base = stage.goalRows * SECONDS_PER_ROW;
  // ages 3 to 4 have no age factor, so their sand runs at the slowest factor there is (x2)
  if (mode === 'relaxed' || factor === 0) return { kind: 'relaxed', seconds: Math.round(base * (factor || 2)) };
  return { kind: 'countdown', seconds: Math.round(base * factor) };
}

/** True once a counted clock has run out. A relaxed timer or no timer never runs out. */
export function ranOut(plan: TimerPlan, elapsedSeconds: number): boolean {
  return plan.kind === 'countdown' && elapsedSeconds >= plan.seconds;
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
