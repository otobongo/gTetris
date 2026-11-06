import type { GameMeta } from '../meta';
import { CHAPTERS, LEVELS } from './levels';

/** Letter Builder level count and chapters, for Home and the Levels screen. Owned by the Letter Builder game.
    Chapter names and notes are the ones in levels.ts, so the Levels screen and the game always agree. */
export const meta: GameMeta = {
  levelCount: LEVELS.length,
  chapters: CHAPTERS.map((c) => ({ title: c.title, note: c.note, start: c.start, count: c.count })),
};
