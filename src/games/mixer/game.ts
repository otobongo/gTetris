/* Color Mixer as a kit game (six-games brief 3.1, 3.2): its id, registry meta, title, set name and puzzle maker.
   Every band gets the same puzzles (set `mixer:1`), the run seeds the order and the choices, and nothing
   keeps solved puzzles or spends hints. */
import type { KitGame } from '../kit/levelRun';
import { mixerSet } from '../run';
import { TITLE } from './copy';
import { meta } from './meta';
import { puzzle, type Puzzle } from './puzzles';

export const GAME: KitGame<Puzzle> = {
  id: 'mixer',
  meta,
  title: TITLE,
  set: () => mixerSet(),
  seed: 'run',
  puzzle,
};
