/**
 * Brick Escape's four-puzzle levels (brief 2, 4.1, 5, 7.1, 9): the six boards of each level, the run rules
 * the progress store needs, which route plays what, and the lines the play screen and the level card show.
 * Pure: no React, no store writes.
 */
import type { PuzzleResult, PuzzleRules } from '../../shared/progress';
import { capRule } from '../stars';
import { LEVEL_STAR_RULES, escapeLevelStars, escapeSet, levelTotals } from '../run';
import { type Level, fromSpec } from './engine';
import { PUZZLE_DATA } from './puzzles.data';

/** The game id the progress store keeps Brick Escape under (the code's old key 'slide' maps to it). */
export const GAME = 'escape';

export interface PuzzleLevel {
  /** First 12 hex characters of a SHA-256 of the level's puzzles; a new id restarts that level's run. */
  id: string;
  /** Six boards. Puzzle 1 (index 0) is the level's original board. */
  puzzles: Level[];
}

/** Every level with its six boards, in level order. Level ids on the boards are 1-based like LEVELS. */
export const PUZZLE_LEVELS: PuzzleLevel[] = PUZZLE_DATA.map((d, i) => ({
  id: d.id,
  puzzles: d.puzzles.map((p) => ({ ...fromSpec(p.spec, i + 1, p.par), order: p.order })),
}));

/** The run rules for one level (0-based): its puzzle set, no seed, and the Escape star rule over 4 puzzles. */
export function escapeRules(index: number): PuzzleRules {
  return { set: escapeSet(PUZZLE_LEVELS[index].id), seed: 0, levelCount: PUZZLE_LEVELS.length, stars: escapeLevelStars };
}

/* ---------- routes (brief 2.5, 7.4) ---------- */

export type RouteDecision =
  /** Play this 0-based level. */
  | { kind: 'play'; index: number }
  /** Every level has stars: the finished state on `#/game/escape`. */
  | { kind: 'finished' }
  | { kind: 'redirect'; to: string };

/**
 * What `#/game/escape[/<n>]` shows. With no level it opens the current level (or the finished state when
 * there is none); `<n>` plays only the current level, and anything else goes back to `#/game/escape`.
 */
export function routeFor(params: readonly string[], current: number | null, levelCount = PUZZLE_LEVELS.length): RouteDecision {
  if (params.length === 0) return current === null ? { kind: 'finished' } : { kind: 'redirect', to: `/game/escape/${current + 1}` };
  const n = /^\d+$/.test(params[0]) ? Number(params[0]) : NaN;
  if (params.length === 1 && Number.isInteger(n) && n >= 1 && n <= levelCount && current === n - 1) return { kind: 'play', index: n - 1 };
  return { kind: 'redirect', to: '/game/escape' };
}

/* ---------- copy (brief 9.1; rendered copy uses the curly apostrophe) ---------- */

export const HELP_LINE = 'Drag each brick out through the door of its color.';
export const OFFER_LINE = 'This one is tricky. Want a different puzzle?';
export const SWAPPED_LINE = 'Here is a different puzzle.';
export const TIME_UP_LINE = 'Time’s up! Keep going, you can still finish.';
export const HINT_LINE = 'Try the glowing brick first.';
export const FINISHED_NOTE = 'A grown-up can pick a level to play again.';

export const solvedLine = (moves: number) => `Solved in ${moves} ${moves === 1 ? 'move' : 'moves'}.`;

/** "Maya: each puzzle gets 45s x 1.5 = 1:08"; without a name, "Each puzzle gets 45s x 1.5 = 1:08". */
export function clockCaption(name: string | null, base: number, factor: number, clock: string): string {
  const line = `each puzzle gets ${base}s x ${factor} = ${clock}`;
  return name ? `${name}: ${line}` : line.charAt(0).toUpperCase() + line.slice(1);
}

export interface CardCopy {
  title: string;
  fact: string;
  rule?: string;
  cap?: string;
  /** The green button's label: "Play Level 10", or "Back to games" when the game is finished. */
  primary: string;
  /** True when the primary button goes Home (the game is finished). */
  home: boolean;
}

/**
 * The level card after the fourth solve (2.1 step 5): title, the level's moves, the star rule over the four
 * Bests and the cap line when a hint or a counted clock applied. With no next level (`next` null) the game
 * is finished (2.5): "You finished every level!" with the game's star total and one button home.
 */
export function levelCard(
  levelNo: number,
  results: readonly PuzzleResult[],
  next: number | null,
  totalStars: number,
  levelCount = PUZZLE_LEVELS.length,
): CardCopy {
  if (next === null) return finishedCard(totalStars, levelCount);
  const t = levelTotals(results);
  const cap = capRule({ hint: t.usedHint, clock: t.outOfTime });
  return {
    title: `You finished Level ${levelNo}`,
    fact: `4 puzzles in ${t.count} moves.`,
    rule: `3 stars: ${t.par + LEVEL_STAR_RULES.escape.three} moves or fewer. 2 stars: ${t.par + LEVEL_STAR_RULES.escape.two} or fewer.`,
    cap: cap || undefined,
    primary: `Play Level ${next + 1}`,
    home: false,
  };
}

/** The finished card (2.5, 9.1): "You finished every level!" and "31 levels, 78 of 93 stars." */
export function finishedCard(totalStars: number, levelCount = PUZZLE_LEVELS.length): CardCopy {
  return { title: 'You finished every level!', fact: `${levelCount} levels, ${totalStars} of ${levelCount * 3} stars.`, primary: 'Back to games', home: true };
}
