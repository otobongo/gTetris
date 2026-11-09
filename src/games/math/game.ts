/* Brick Calculator as a kit game (six-games brief 3.1, 4.5, 6): the registry meta, the band-dependent
   set 'math:1:<band>' from run.ts, a new random seed per run, and solved puzzles kept across a band
   change (the band sets the numbers). No hints. */
import type { KitGame } from '../kit/levelRun';
import { mathSet } from '../run';
import { MATH_GAME, meta } from './meta';
import type { MathPuzzle } from './puzzles';

export const MATH: KitGame<MathPuzzle> = {
  id: 'math',
  meta,
  title: MATH_GAME.title,
  set: (band) => mathSet(band),
  seed: MATH_GAME.seed,
  keepSolved: MATH_GAME.keepSolved,
  puzzle: MATH_GAME.puzzle,
};
