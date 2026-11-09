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

/** Where keyboard focus is when a key goes down: on a keypad key, on another button or link, or neither. */
export type KeyFocus = 'keypad' | 'control' | 'none';

/**
 * The keypad key a physical key presses, given where focus is (4.5, 9.1, 9.2), or null to leave the key
 * to the browser. Enter is = on a focused keypad key too: focus goes to the 7 key after Next, and a
 * tapped key keeps focus, so Enter there must send the answer and not press that key again. On any other
 * button or link (Next puzzle, New puzzle, the speaker, Back to home) Enter presses that control.
 */
export function keyboardKey(e: Parameters<typeof keyFromKeyboard>[0], focus: KeyFocus): KeyId | null {
  const key = keyFromKeyboard(e);
  if (key === 'equals' && focus === 'control') return null;
  return key;
}

/* ---------- What the screen draws from the layout and the presses ---------- */

/** One key as the keypad grid places it: 0-based row and column, and how many it spans. */
export interface KeyCell {
  key: KeyId;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

/**
 * The 12 keys with their grid cells, read from `KEY_ROWS`: equal neighbours in a row or a column are one
 * key that spans them (0 spans three columns, = three rows).
 */
export function keyCells(rows: readonly (readonly KeyId[])[] = KEY_ROWS): KeyCell[] {
  const used = rows.map((r) => r.map(() => false));
  const cells: KeyCell[] = [];
  rows.forEach((line, row) => {
    line.forEach((key, col) => {
      if (used[row][col]) return;
      let colSpan = 1;
      while (col + colSpan < line.length && line[col + colSpan] === key && !used[row][col + colSpan]) colSpan += 1;
      let rowSpan = 1;
      const same = (r: number) => r < rows.length && Array.from({ length: colSpan }, (_, k) => rows[r][col + k] === key && !used[r][col + k]).every(Boolean);
      while (same(row + rowSpan)) rowSpan += 1;
      for (let r = row; r < row + rowSpan; r += 1) for (let c = col; c < col + colSpan; c += 1) used[r][c] = true;
      cells.push({ key, row, col, rowSpan, colSpan });
    });
  });
  return cells;
}

/** The keypad as drawn: 12 keys. */
export const KEY_CELLS: readonly KeyCell[] = keyCells();

/** Which help line the screen shows while the puzzle is in play: the start line, the slip line or the third-digit line. */
export type HelpKind = 'start' | 'slip' | 'full';

/**
 * The help line after a press. A slip or a third digit keeps its line until the child types a digit or
 * presses C; = with nothing typed changes nothing; a press that was locked changes nothing.
 */
export function helpAfter(prev: HelpKind, event: KeyEvent): HelpKind {
  switch (event) {
    case 'digit':
    case 'clear':
      return 'start';
    case 'wrong':
      return 'slip';
    case 'full':
      return 'full';
    default:
      return prev;
  }
}
