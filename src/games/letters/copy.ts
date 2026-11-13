/* Letter Builder's child-facing lines for four-puzzle levels, exactly as brief section 9 words them.
   Spelling levels say "word" and "built" where the others say "puzzle" and "solved". */
import { SOLVES_PER_LEVEL } from '../../shared/progress';
import type { Prompt } from './levels';

/** The help line once a puzzle is solved (9.1 "Solved line"). */
export function solvedLine(p: Prompt): string {
  switch (p.kind) {
    case 'train':
      return `${p.cells[0]} to ${p.cells[p.cells.length - 1]}, all in order.`;
    case 'missing':
      return 'Every gap is filled.';
    case 'match':
      return 'Every pair matched.';
    case 'sound': {
      const w = p.word.word;
      return `${w.charAt(0).toUpperCase()}${w.slice(1)} starts with ${p.answer}.`;
    }
    case 'spell':
      return `You built ${(p.word?.word ?? p.cells.join('')).toUpperCase()}.`;
  }
}

/** The help line after the first right tap of a row. */
export const MID_LINE = 'What comes next?';

/** Practice (Level 1, ages 3 to 4): the puzzle's line, kept up the whole puzzle because any order goes in. */
export const PRACTICE_LINE = 'Drag each letter to its place.';
export const PRACTICE_SPEECH = 'Drag each letter up to its place.';

/** Practice: the note after a tap, which says the letter and places nothing. */
export const DRAG_NOTE = 'Hold the letter and drag it up.';

export const nextLabel = (spelling: boolean) => (spelling ? 'Next word' : 'Next puzzle');

/** The stuck offer: the help line and the green button's name (3.2). */
export const offerLine = (spelling: boolean) =>
  spelling ? 'This word is tricky. Want a different one?' : 'This one is tricky. Want a different puzzle?';
export const offerName = (spelling: boolean) => (spelling ? 'New word' : 'New puzzle');

/** The help line once, after a swap (3.3). */
export const swapLine = (spelling: boolean) => (spelling ? 'Here is a different word.' : 'Here is a different puzzle.');

/** Level card fact: "4 puzzles, no slips.", "4 words, 1 slip.", "4 words, 3 slips." */
export function levelFact(spelling: boolean, slips: number): string {
  const what = slips <= 0 ? 'no slips' : slips === 1 ? '1 slip' : `${slips} slips`;
  return `${SOLVES_PER_LEVEL} ${spelling ? 'words' : 'puzzles'}, ${what}.`;
}

export const levelTitle = (levelNumber: number) => `You finished Level ${levelNumber}`;
export const playLabel = (levelNumber: number) => `Play Level ${levelNumber}`;
export const BACK_TO_GAMES = 'Back to games';

/** The card after the game's last level, and on a later visit to a finished game (2.5). */
export const GAME_DONE_TITLE = 'You finished every level!';
export const gameDoneFact = (levels: number, stars: number) => `${levels} levels, ${stars} of ${levels * 3} stars.`;
export const GAME_DONE_NOTE = 'A grown-up can pick a level to play again.';
