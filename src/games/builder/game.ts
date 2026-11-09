/* Picture Builder on the kit (six-games brief 3.1, 4.6): the KitGame object the kit builds on.
   The kit passes `puzzle` a 0-based level and a 0-based puzzle number, which is what puzzles.ts takes, so
   nothing is adapted here. Every band gets the same pictures; the band sets only the look times (LOOK_SECONDS)
   and the stuck limits. No hints, no clock: the Play screen calls `hold(true)` during each look. */
import type { KitGame } from '../kit/levelRun';
import { builderSet } from '../run';
import { meta } from './meta';
import { BUILDER_SET_VERSION, BUILDER_TITLE, puzzle, type BuilderPuzzle } from './puzzles';

export const GAME: KitGame<BuilderPuzzle> = {
  id: 'builder',
  meta,
  title: BUILDER_TITLE,
  // 'builder:1', the same for every band.
  set: () => builderSet(BUILDER_SET_VERSION),
  // The pictures are fixed: the run seed is always 0.
  seed: 'fixed',
  puzzle: (level, n, ctx) => puzzle(level, n, ctx),
};
