/* Shape Sorter on the kit (six-games brief 3.1, 4.2): the KitGame object the kit builds on.
   The kit passes `puzzle` a 0-based level and a 0-based puzzle number (LevelRunApi.level and puzzleNo), which
   is what puzzles.ts takes, so nothing is adapted here. One constant, SORTER_SET_VERSION, drives the set. */
import { sorterSet } from '../run';
import type { KitGame } from '../kit/levelRun';
import { meta } from './meta';
import { SORTER_SET_VERSION, SORTER_TITLE, puzzle, type SorterPuzzle } from './puzzles';

export const GAME: KitGame<SorterPuzzle> = {
  id: 'sorter',
  meta,
  title: SORTER_TITLE,
  // 'sorter:1'. The age band changes only the stuck limits, so the set is the same for every band.
  set: () => sorterSet(SORTER_SET_VERSION),
  // Sorter's boards are fixed: the run seed is always 0.
  seed: 'fixed',
  puzzle: (level, n, ctx) => puzzle(level, n, ctx),
};
