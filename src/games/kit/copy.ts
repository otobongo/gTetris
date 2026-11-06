/* The kit's shared lines, exactly as the six-games brief words them in 8.1. Every kit game shows
   these; each game's own copy.ts holds the rest. No apostrophes here, so no curly one is needed. */
import { SOLVES_PER_LEVEL } from '../../shared/progress';
import { capRule } from '../stars';

/** The top bar's title: "Level 3". */
export const levelName = (levelNumber: number) => `Level ${levelNumber}`;
/** The top bar's back button (brief 3.1). */
export const BACK_TO_HOME = 'Back to home';

export const NEXT_PUZZLE = 'Next puzzle';

/** The stuck offer: the help line and the green button's name. */
export const OFFER_LINE = 'This one is tricky. Want a different puzzle?';
export const OFFER_NAME = 'New puzzle';
/** The help line once, after a swap. */
export const SWAPPED_LINE = 'Here is a different puzzle.';
/** The speaker's name while the offer shows; it reads OFFER_LINE. */
export const READ_HELP_ALOUD = 'Read the help line aloud';

/** Level card. */
export const levelDoneTitle = (levelNumber: number) => `You finished Level ${levelNumber}`;
/** "4 puzzles, no slips.", "4 puzzles, 1 slip.", "4 puzzles, 3 slips." */
export function slipFact(slips: number): string {
  const n = Number.isFinite(slips) && slips > 0 ? Math.round(slips) : 0;
  const what = n === 0 ? 'no slips' : n === 1 ? '1 slip' : `${n} slips`;
  return `${SOLVES_PER_LEVEL} puzzles, ${what}.`;
}
export const LEVEL_RULE = '3 stars: 1 slip or none. 2 stars: 4 slips or fewer.';
/** Number Line-up only, when a hint on a solved puzzle capped the level: "Using a hint caps the level at 2 stars." */
export const HINT_CAP = capRule({ hint: true });
export const playLabel = (levelNumber: number) => `Play Level ${levelNumber}`;
export const BACK_TO_GAMES = 'Back to games';

/** The card after the last level, and the finished state on a later visit. */
export const GAME_DONE_TITLE = 'You finished every level!';
/** "9 levels, 24 of 27 stars." */
export const gameDoneFact = (levels: number, stars: number) => `${levels} levels, ${stars} of ${levels * 3} stars.`;
export const GAME_DONE_NOTE = 'A grown-up can pick a level to play again.';
