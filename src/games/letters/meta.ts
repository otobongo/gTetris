import type { GameMeta } from '../meta';
import { CHAPTERS, LEVELS } from './levels';

/** Letter Builder chapters for the Levels screen, without the emoji levels.ts carries. Owned by the Letter Builder game. */
const notes = ['tap the letters in order', 'match A with a', 'what does it start with?', 'build the word'];
const titles = ['Alphabet Train', 'Big and small', 'First sounds', 'Spell it'];

export const meta: GameMeta = {
  levelCount: LEVELS.length,
  chapters: CHAPTERS.map((c, i) => ({ title: titles[i] ?? c.title, note: notes[i] ?? '', start: c.start, count: c.count })),
};
