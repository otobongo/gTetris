/**
 * Which route plays what, for every kit game (six-games brief 3.1): Brick Escape's routeFor in
 * slide/puzzles.ts, made generic. Pure.
 */

export type RouteDecision =
  /** Play this 0-based level. */
  | { kind: 'play'; index: number }
  /** Every level has stars: the finished state on `#/game/<id>`. */
  | { kind: 'finished' }
  | { kind: 'redirect'; to: string };

/** The game itself: `/game/mixer`. */
export const gamePath = (gameId: string) => `/game/${gameId}`;
/** A 0-based level's route: `/game/mixer/3` for Level 3. */
export const levelPath = (gameId: string, level: number) => `/game/${gameId}/${level + 1}`;

/**
 * What `#/game/<id>[/<n>]` shows. With no level it opens the current level, or the finished state when
 * there is none; `<n>` plays only the current level, and anything else goes back to `#/game/<id>`.
 */
export function routeFor(gameId: string, params: readonly string[], current: number | null, levelCount: number): RouteDecision {
  if (params.length === 0) return current === null ? { kind: 'finished' } : { kind: 'redirect', to: levelPath(gameId, current) };
  const n = /^\d+$/.test(params[0]) ? Number(params[0]) : NaN;
  if (params.length === 1 && Number.isInteger(n) && n >= 1 && n <= levelCount && current === n - 1) return { kind: 'play', index: n - 1 };
  return { kind: 'redirect', to: gamePath(gameId) };
}
