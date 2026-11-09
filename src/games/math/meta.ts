import type { GameMeta } from '../meta';
import { CHAPTERS, LEVELS, puzzle } from './puzzles';

/** Brick Calculator level count and chapters, for Home, Settings and the sticker book. Owned by the Brick Calculator game.
    Chapter names and notes are the ones in puzzles.ts, so the picker and the game always agree. */
export const meta: GameMeta = {
  levelCount: LEVELS.length,
  chapters: CHAPTERS.map((c) => ({ title: c.title, note: c.note, start: c.start, count: c.count })),
};

/**
 * The game's half of the kit's `KitGame` (brief 3.1), everything but `id`, `meta` and `set`
 * (`mathSet(band)` gives 'math:1:<band>'). A new random seed per run; a band change keeps solved
 * puzzles; no hints. Stuck limits are the `math` row of `STUCK` in run.ts and the star rule is
 * `LEVEL_STAR_RULES.math` (1 and 4 slips), so nothing is repeated here.
 */
export const MATH_GAME = {
  title: 'Brick Calculator',
  seed: 'run',
  keepSolved: true,
  puzzle,
} as const;
