/* Brick Calculator's keypad rules (brief 4.5 "Edge cases"), pure so Vitest runs them without a DOM.
   The Play screen feeds every pointer or keyboard press through `pressKey` and draws what comes back.
   Rules: two digits at most (a third is ignored, with a line); "07" counts as 7; = with nothing typed
   does nothing; keys do nothing after the solve or while a card is open; a wrong = clears the entry
   (the slip); a second = after the right answer does nothing. */

/** The answer is typed in 2 digits at most: answers are 0 to 20. */
export const MAX_DIGITS = 2;

/** The 12 keys' ids, in the order the keypad draws them (7.7): 0 spans three columns, = three rows. */
export const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export type Digit = (typeof DIGITS)[number];
export type KeyId = Digit | 'clear' | 'equals';

/** Keypad layout, rows of 4 columns: `7 8 9 C` / `4 5 6 =` / `1 2 3 =` / `0 0 0 =` (0 and = are spans). */
export const KEY_ROWS: readonly (readonly KeyId[])[] = [
  [7, 8, 9, 'clear'],
  [4, 5, 6, 'equals'],
  [1, 2, 3, 'equals'],
  [0, 0, 0, 'equals'],
];

/** The typed digits as the child typed them: '' or one or two digits, so '07' stays '07'. */
export type Entry = string;

export const EMPTY_ENTRY: Entry = '';

/** The number an entry stands for: '07' is 7, '' is null. */
export function entryValue(entry: Entry): number | null {
  return /^\d{1,2}$/.test(entry) ? Number(entry) : null;
}

export interface KeypadState {
  entry: Entry;
  /** The right answer was sent: every key does nothing from here (until the next puzzle's fresh state). */
  solved: boolean;
}

export const START_STATE: KeypadState = { entry: EMPTY_ENTRY, solved: false };

/**
 * What a press did, for the screen:
 * - 'digit': a digit was added (say the number now typed).
 * - 'full': a third digit was ignored (the help line says "Press = to check, or C to clear.").
 * - 'clear': C emptied the entry.
 * - 'empty': = with nothing typed; nothing changes.
 * - 'right': = sent the right answer (solve).
 * - 'wrong': = sent a wrong answer: a slip, and the entry is cleared.
 * - 'locked': the press did nothing because the puzzle is solved or a card is open.
 */
export type KeyEvent = 'digit' | 'full' | 'clear' | 'empty' | 'right' | 'wrong' | 'locked';

export interface KeyResult {
  state: KeypadState;
  event: KeyEvent;
  /** For 'wrong': the answer that was sent, which the slip key uses (a repeat is no new star slip). */
  sent: number | null;
}

/**
 * One press. `answer` is the puzzle's right answer; `locked` is true while a level card is open.
 * A press while locked or after the solve returns the state unchanged with the event 'locked'.
 */
export function pressKey(state: KeypadState, key: KeyId, answer: number, locked = false): KeyResult {
  if (locked || state.solved) return { state, event: 'locked', sent: null };
  if (key === 'clear') return { state: { ...state, entry: EMPTY_ENTRY }, event: 'clear', sent: null };
  if (key === 'equals') {
    const value = entryValue(state.entry);
    if (value === null) return { state, event: 'empty', sent: null };
    if (value === answer) return { state: { entry: state.entry, solved: true }, event: 'right', sent: value };
    return { state: { ...state, entry: EMPTY_ENTRY }, event: 'wrong', sent: value };
  }
  if (state.entry.length >= MAX_DIGITS) return { state, event: 'full', sent: null };
  return { state: { ...state, entry: state.entry + String(key) }, event: 'digit', sent: null };
}

/** Any press that reached the keypad resets the time signal (3.3): everything but 'locked'. */
export const isKeyPress = (event: KeyEvent): boolean => event !== 'locked';

/**
 * The physical keyboard (9.2): digits press their key, Enter is =, Backspace or Escape is C.
 * Anything else, and any chord with Ctrl, Meta or Alt, is not a key of the keypad (null).
 */
export function keyFromKeyboard(e: { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean }): KeyId | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (/^[0-9]$/.test(e.key)) return Number(e.key) as Digit;
  if (e.key === 'Enter') return 'equals';
  if (e.key === 'Backspace' || e.key === 'Escape') return 'clear';
  return null;
}
