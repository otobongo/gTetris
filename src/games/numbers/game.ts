/* Number Line-up as a kit game (six-games brief 3.1, 4.3, 6): the registry meta, the band-dependent
   set 'numbers:1:<band>' from run.ts, a new random seed per run, solved puzzles kept across a band
   change (Levels 9 to 12 take the band's numbers), and 3 hints per level through spendHint. */
import type { KitGame } from '../kit/levelRun';
import { numbersSet } from '../run';
import { NUMBERS_GAME, meta } from './meta';
import type { NumbersPuzzle } from './puzzles';

export const NUMBERS: KitGame<NumbersPuzzle> = {
  id: 'numbers',
  meta,
  title: NUMBERS_GAME.title,
  set: (band) => numbersSet(band),
  seed: NUMBERS_GAME.seed,
  keepSolved: NUMBERS_GAME.keepSolved,
  hints: NUMBERS_GAME.hints,
  puzzle: NUMBERS_GAME.puzzle,
};
