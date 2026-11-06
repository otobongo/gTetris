import type { GameMeta } from '../meta';
import { CHAPTERS, LEVELS, puzzle } from './puzzles';

/** Number Line-up level count and chapters, for Home, Settings and the sticker book. Owned by the Number Line-up game.
    Chapter names and notes are the ones in puzzles.ts, so the picker and the game always agree. */
export const meta: GameMeta = {
  levelCount: LEVELS.length,
  chapters: CHAPTERS.map((c) => ({ title: c.title, note: c.note, start: c.start, count: c.count })),
};

/**
 * The game's half of the kit's `KitGame` (brief 3.1), everything but `id`, `meta` and `set`, which
 * the Play screen adds once the kit and `run.ts` land (`numbersSet(band)` gives 'numbers:1:<band>').
 * A new random seed per run; a band change keeps solved puzzles; 3 hints per level.
 */
export const NUMBERS_GAME = {
  title: 'Number Line-up',
  seed: 'run',
  keepSolved: true,
  hints: true,
  puzzle,
} as const;
