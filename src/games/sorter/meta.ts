import type { GameMeta } from '../meta';
import { LEVEL_COUNT, SORTER_CHAPTERS } from './puzzles';

/** Shape Sorter level count and chapters, for Home and the Levels screen. Owned by the Shape Sorter game.
    Chapters match the sticker book (3.4): Shapes, Shape and color, Big boards. */
export const meta: GameMeta = {
  levelCount: LEVEL_COUNT,
  chapters: SORTER_CHAPTERS.map((c) => ({ title: c.title, note: c.note, start: c.start, count: c.count })),
  // A new 7-8 child starts at Level 4, Shape and color; a new 9-10 child at Level 7, Big boards (usability decision 10).
  bandStart: { '7-8': 3, '9-10': 6 },
};
