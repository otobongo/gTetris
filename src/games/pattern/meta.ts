import type { GameMeta } from '../meta';
import { CHAPTERS, LEVEL_COUNT } from './levels';

/** Pattern Train level count and chapters, for Home and the Levels screen. Owned by the Pattern Train game.
    Chapter titles and notes are the ones in levels.ts, so the picker and the game always agree. */
export const meta: GameMeta = {
  levelCount: LEVEL_COUNT,
  chapters: CHAPTERS.map((c) => ({ title: c.title, note: c.note, start: c.start, count: c.count })),
};
