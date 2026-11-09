/* Brick Calculator's child-facing lines, word for word from brief section 8.6 (accessible names from 9.2).
   The shared lines (offer, swap, level card, game finished) are the kit's (8.1).
   Every line uses the help style: 54 characters at most, the longest numbers filled in (7.2). */
import type { KeyId } from './entry';
import type { Op, Pair } from './puzzles';

/** Help line at the start of a puzzle. */
export const START_LINE = 'Count the bricks. Type the answer, then press =.';

/** Help line after a wrong answer; the entry has cleared. */
export const SLIP_LINE = 'Not quite. Count the bricks again.';

/** Help line when a third digit was ignored. */
export const FULL_LINE = 'Press = to check, or C to clear.';

/** The operation in words: "3 plus 4", "7 take away 3". */
export const opWords = (op: Op): string => (op === 'plus' ? 'plus' : 'take away');

/** "3 plus 4" / "7 take away 3". */
export const sumWords = (p: Pair): string => `${p.a} ${opWords(p.op)} ${p.b}`;

/** Help line once solved: "3 plus 4 makes 7." / "7 take away 3 makes 4." */
export const solvedLine = (p: Pair & { answer: number }): string => `${sumWords(p)} makes ${p.answer}.`;

/** The panel caption while playing, as the board sets it: one sentence to a line. */
export const CAPTION_LINES = ['Each row holds 5.', 'Two rows make 10.'] as const;

/** The panel caption while playing. */
export const CAPTION = CAPTION_LINES.join(' ');

/** The panel caption once solved: "Count them: 7". */
export const solvedCaption = (answer: number): string => `Count them: ${answer}`;

/** The keypad group's accessible name. */
export const KEYPAD_NAME = 'Keypad';

/** The speaker button's accessible name. */
export const SPEAKER_NAME = 'Hear the sum';

/** What the speaker reads before the answer: "3 plus 4. How many?" */
export const questionText = (p: Pair): string => `${sumWords(p)}. How many?`;

/** What the speaker reads once solved, and what a right = says: "3 plus 4 makes 7." */
export const spokenSolved = solvedLine;

/** What the speaker reads: the question, or once solved the solved line. */
export const spokenText = (p: Pair & { answer: number }, solved: boolean): string => (solved ? solvedLine(p) : questionText(p));

/** What a digit tap says straight after the tap: the number now typed, "15". '07' is said as 7. */
export const spokenEntry = (value: number): string => String(value);

/** A key's accessible name (9.2): digits by their numeral, "Clear", "Equals". */
export const keyName = (key: KeyId): string => (key === 'clear' ? 'Clear' : key === 'equals' ? 'Equals' : String(key));

/** A key's label on the cap: the numeral, "C" or "=". */
export const keyLabel = (key: KeyId): string => (key === 'clear' ? 'C' : key === 'equals' ? '=' : String(key));

/** The equation's accessible name before the answer: "3 plus 4 equals what?" */
export const equationName = (p: Pair): string => `${sumWords(p)} equals what?`;

/** The equation's accessible name once solved: "3 plus 4 equals 7". */
export const equationSolvedName = (p: Pair & { answer: number }): string => `${sumWords(p)} equals ${p.answer}`;

const bricks = (n: number, colour: string): string => `${n} ${colour} ${n === 1 ? 'brick' : 'bricks'}`;

/** The ten-frames' accessible name: "3 blue bricks and 4 orange bricks" / "7 blue bricks, 3 taken away". */
export const framesName = (p: Pair): string =>
  p.op === 'plus' ? `${bricks(p.a, 'blue')} and ${bricks(p.b, 'orange')}` : `${bricks(p.a, 'blue')}, ${p.b} taken away`;
