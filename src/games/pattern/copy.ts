/* Pattern Train's child-facing lines, exactly as brief 8.5 and 9.2 word them (open question 4, A: literal
   lines). The shared lines (Next puzzle, the offer, the level card) live in the kit's copy.ts. Car names inside a
   sentence are lower case ("red circle"); a name that starts a line is capitalised ("Yellow triangle comes
   next."). Help lines are help style: 54 characters at most. */
import { carName, type Car } from './cars';
import type { PatternPuzzle } from './puzzles';

export const TITLE = 'Pattern Train';

/** Help-style lines stay within 2 lines at 390 px (7.2). */
export const HELP_MAX_CHARS = 54;

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The prompt line above the train. */
export const PROMPT = 'Look at the train. What is the pattern?';
export const PROMPT_SOLVED = 'Pattern complete.';

/** The label above the choice tray. */
export const TRAY_LABEL = 'Which car comes next?';

/** Help lines. */
export const HELP_START = 'Say the cars out loud, then pick the next one.';
export const HELP_WRONG = 'Say the pattern out loud and try again.';
/** "Yellow triangle comes next." */
export const helpSolved = (answer: Car): string => `${capital(carName(answer))} comes next.`;

/** The speaker's name; it reads the train. */
export const SPEAKER_NAME = 'Hear the pattern';

/** What the speaker reads: "Red circle, blue square, red circle, blue square. What comes next?" */
export const speech = (cars: readonly Car[]): string => `${capital(cars.map(carName).join(', '))}. What comes next?`;

/* ---------- accessible names (brief 9.2) ---------- */

/** The train, one image: "Train: red circle, blue square, red circle, blue square, empty car." The answer replaces "empty car" once solved. */
export const trainName = (cars: readonly Car[], solvedWith: Car | null): string =>
  `Train: ${[...cars.map(carName), solvedWith ? carName(solvedWith) : 'empty car'].join(', ')}.`;

/** A choice is named by its car: "red circle". */
export const choiceName = (c: Car): string => carName(c);

/** Every help-row line a puzzle can show, for the automatic length check: start, wrong and solved. */
export function helpLines(p: PatternPuzzle): string[] {
  return [HELP_START, HELP_WRONG, helpSolved(p.answer)];
}
