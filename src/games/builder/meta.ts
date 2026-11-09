import type { GameMeta } from '../meta';
import { CHAPTERS, LEVEL_COUNT } from './puzzles';

/** Picture Builder level count and chapters, for Home, Settings and the sticker book. Owned by the Picture Builder game.
    Chapters match the sticker book (3.4): Copy it, From memory, Big pictures, with the picker notes from 4.6. */
export const meta: GameMeta = {
  levelCount: LEVEL_COUNT,
  chapters: CHAPTERS.map((c) => ({ title: c.title, note: c.note, start: c.start, count: c.count })),
};
