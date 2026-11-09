/* Pattern Train as a kit game (six-games brief 3.1, 4.4, 6): the registry meta, the set 'pattern:1' from run.ts,
   a new random seed per run, and the same puzzles for every age band. Nothing keeps solved puzzles or spends hints. */
import type { KitGame } from '../kit/levelRun';
import { patternSet } from '../run';
import { TITLE } from './copy';
import { meta } from './meta';
import { PATTERN_SET_VERSION, puzzle, type PatternPuzzle } from './puzzles';

export const GAME: KitGame<PatternPuzzle> = {
  id: 'pattern',
  meta,
  title: TITLE,
  // 'pattern:1'. The age band changes only the stuck limits, so the set is the same for every band.
  set: () => patternSet(PATTERN_SET_VERSION),
  seed: 'run',
  puzzle,
};
