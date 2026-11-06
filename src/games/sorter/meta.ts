import type { GameMeta } from '../meta';
import { LEVEL_COUNT, SORTER_CHAPTERS } from './puzzles';

/** Shape Sorter level count and chapters, for Home and the Levels screen. Owned by the Shape Sorter game.
    Chapters match the sticker book (3.4): Shapes, Shape and color, Big boards. */
export const meta: GameMeta = {
  levelCount: LEVEL_COUNT,
  chapters: SORTER_CHAPTERS.map((c) => ({ title: c.title, note: c.note, start: c.start, count: c.count })),
};
