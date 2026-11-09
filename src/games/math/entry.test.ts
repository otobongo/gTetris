/** Brick Calculator keypad rules (brief 4.5 "New keypad" and "Edge cases", 3.3, 9.2, 10.2 "Calculator"): two digits at
    most, "07" counts as 7, = with nothing typed does nothing, a wrong = clears the entry and is a slip, 0 is typeable for
    the mixed levels, keys do nothing after the solve or while a card is open, a second = solves once, and the physical
    keyboard keys. Every answer a level can deal is typeable in 2 digits. */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS } from '../../shared/progress';
import {
  DIGITS,
  EMPTY_ENTRY,
  KEY_ROWS,
  MAX_DIGITS,
  START_STATE,
  entryValue,
  isKeyPress,
  keyFromKeyboard,
  keyboardKey,
  pressKey,
  type KeyEvent,
  type KeyId,
  type KeyResult,
  type KeypadState,
} from './entry';
import { LEVELS, makePuzzles } from './puzzles';

const ALL_KEYS: readonly KeyId[] = [...DIGITS, 'clear', 'equals'];

/** Presses keys in turn from `state`, with the same answer and lock for each; returns every result. */
function press(keys: readonly KeyId[], answer: number, state: KeypadState = START_STATE, locked = false): KeyResult[] {
  const out: KeyResult[] = [];
  let now = state;
  for (const k of keys) {
    const r = pressKey(now, k, answer, locked);
    out.push(r);
    now = r.state;
  }
  return out;
}
const last = (rs: readonly KeyResult[]) => rs[rs.length - 1];
const events = (rs: readonly KeyResult[]) => rs.map((r) => r.event);
/** The digits of a number as key presses: 15 is 1 then 5. */
const digitsOf = (n: number) => [...String(n)].map(Number) as KeyId[];

describe('the keypad (4.5 "New keypad", 7.7)', () => {
  it('lays out 4 rows of 4: 7 8 9 C / 4 5 6 = / 1 2 3 = / 0 0 0 =', () => {
    expect(KEY_ROWS).toEqual([
      [7, 8, 9, 'clear'],
      [4, 5, 6, 'equals'],
      [1, 2, 3, 'equals'],
      [0, 0, 0, 'equals'],
    ]);
  });

  it('has 12 keys: the ten digits, C and =, with 0 across three columns and = down three rows', () => {
    const keys = new Set(KEY_ROWS.flat());
    expect(keys.size).toBe(12);
    expect(keys).toEqual(new Set(ALL_KEYS));
    expect(KEY_ROWS[3].slice(0, 3)).toEqual([0, 0, 0]);
    expect(KEY_ROWS.map((row) => row[3])).toEqual(['clear', 'equals', 'equals', 'equals']);
    expect(KEY_ROWS.flat().filter((k) => k === 0)).toHaveLength(3);
    expect(KEY_ROWS.flat().filter((k) => k === 'equals')).toHaveLength(3);
  });

  it('has no plus, minus, 10 or surprise key (8.9)', () => {
    for (const k of KEY_ROWS.flat()) expect(['plus', 'minus', 'ten', 10, '?', 'surprise']).not.toContain(k);
  });

  it('takes two digits at most', () => {
    expect(MAX_DIGITS).toBe(2);
    expect([...DIGITS]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('starts every puzzle empty and unsolved', () => {
    expect(START_STATE).toEqual({ entry: '', solved: false });
    expect(EMPTY_ENTRY).toBe('');
  });
});

describe('typing the answer', () => {
  it('adds each digit to the entry as typed', () => {
    const rs = press([1, 5], 15);
    expect(events(rs)).toEqual(['digit', 'digit']);
    expect(rs.map((r) => r.state.entry)).toEqual(['1', '15']);
    expect(rs.every((r) => r.sent === null && !r.state.solved)).toBe(true);
  });

  it('ignores a third digit and keeps the two typed (the line then says "Press = to check, or C to clear.")', () => {
    const rs = press([1, 2, 3], 12);
    expect(events(rs)).toEqual(['digit', 'digit', 'full']);
    expect(last(rs).state).toEqual({ entry: '12', solved: false });
    expect(last(rs).state).toBe(rs[1].state);
    expect(events(press([1, 2, 3, 4, 5], 12)).slice(2)).toEqual(['full', 'full', 'full']);
  });

  it('counts "07" as 7: it is right for 7 and uses both digit places', () => {
    const rs = press([0, 7], 7);
    expect(last(rs).state.entry).toBe('07');
    expect(entryValue('07')).toBe(7);
    expect(pressKey(last(rs).state, 8, 7).event).toBe('full');
    expect(pressKey(last(rs).state, 'equals', 7)).toMatchObject({ event: 'right', sent: 7, state: { solved: true } });
  });

  it('reads the entry as its number: nothing typed is no number, "0" and "00" are 0', () => {
    expect(entryValue('')).toBeNull();
    expect(entryValue('0')).toBe(0);
    expect(entryValue('00')).toBe(0);
    expect(entryValue('9')).toBe(9);
    expect(entryValue('20')).toBe(20);
    expect(entryValue('99')).toBe(99);
  });

  it('reads nothing that the keypad cannot type as a number', () => {
    for (const bad of ['123', 'a', '1a', ' 1', '-1', '1.5', '+2']) expect(entryValue(bad), bad).toBeNull();
  });

  it('empties the entry with C, also when nothing is typed', () => {
    expect(press([4, 'clear'], 4).map((r) => r.state.entry)).toEqual(['4', '']);
    expect(pressKey(START_STATE, 'clear', 4)).toMatchObject({ event: 'clear', state: { entry: '', solved: false }, sent: null });
  });

  it('takes digits again after C, even after a third digit was ignored', () => {
    const rs = press([1, 2, 3, 'clear', 9], 9);
    expect(events(rs)).toEqual(['digit', 'digit', 'full', 'clear', 'digit']);
    expect(last(rs).state.entry).toBe('9');
  });
});

describe('pressing = (4.5 "Edge cases")', () => {
  it('does nothing with nothing typed: no slip, no solve, the same state', () => {
    const r = pressKey(START_STATE, 'equals', 7);
    expect(r).toEqual({ state: START_STATE, event: 'empty', sent: null });
    expect(r.state).toBe(START_STATE);
  });

  it('solves on the right answer and keeps it on screen', () => {
    const r = last(press([7, 'equals'], 7));
    expect(r).toEqual({ state: { entry: '7', solved: true }, event: 'right', sent: 7 });
  });

  it('solves two-digit answers up to 20', () => {
    for (const answer of [10, 15, 19, 20]) expect(last(press([...digitsOf(answer), 'equals'], answer)).event, String(answer)).toBe('right');
  });

  it('makes a wrong answer a slip: the entry clears and the answer is never shown', () => {
    const r = last(press([6, 'equals'], 7));
    expect(r).toEqual({ state: { entry: '', solved: false }, event: 'wrong', sent: 6 });
  });

  it('sends the number, so "07" and "7" are the same answer for the slip key (a repeat is no new star slip)', () => {
    expect(last(press([0, 7, 'equals'], 8)).sent).toBe(7);
    expect(last(press([7, 'equals'], 8)).sent).toBe(7);
    expect(String(last(press([0, 7, 'equals'], 8)).sent)).toBe(String(last(press([7, 'equals'], 8)).sent));
  });

  it('lets the child try again after a wrong answer, and a new wrong one is sent with its own number', () => {
    const rs = press([5, 'equals', 6, 'equals', 7, 'equals'], 7);
    expect(events(rs)).toEqual(['digit', 'wrong', 'digit', 'wrong', 'digit', 'right']);
    expect(rs.filter((r) => r.event === 'wrong').map((r) => r.sent)).toEqual([5, 6]);
  });

  it('after a wrong answer, = with the cleared entry does nothing', () => {
    const rs = press([5, 'equals', 'equals'], 7);
    expect(events(rs)).toEqual(['digit', 'wrong', 'empty']);
  });

  it('solves 0 from "0" or "00", the right answer from Level 9', () => {
    expect(last(press([0, 'equals'], 0))).toMatchObject({ event: 'right', sent: 0 });
    expect(last(press([0, 0, 'equals'], 0))).toMatchObject({ event: 'right', sent: 0 });
  });

  it('makes 0 a wrong answer, a slip like any other, when the answer is not 0', () => {
    expect(last(press([0, 'equals'], 3))).toMatchObject({ event: 'wrong', sent: 0, state: { entry: '' } });
  });

  it('makes a two-digit answer that is too big a slip, not an error', () => {
    expect(last(press([9, 9, 'equals'], 20))).toMatchObject({ event: 'wrong', sent: 99 });
  });

  it('solves once: a second = after the right answer does nothing', () => {
    const solved = last(press([7, 'equals'], 7)).state;
    const again = pressKey(solved, 'equals', 7);
    expect(again).toEqual({ state: solved, event: 'locked', sent: null });
    expect(again.state).toBe(solved);
  });
});

describe('keys do nothing after the solve or while a card is open', () => {
  const solved = last(press([4, 'equals'], 4)).state;

  it('locks every key once the puzzle is solved, and the right answer stays', () => {
    for (const k of ALL_KEYS) {
      const r = pressKey(solved, k, 4);
      expect(r, String(k)).toEqual({ state: solved, event: 'locked', sent: null });
    }
    expect(solved).toEqual({ entry: '4', solved: true });
  });

  it('locks every key while a level card is open, with something typed or not', () => {
    for (const state of [START_STATE, { entry: '1', solved: false }, { entry: '12', solved: false }])
      for (const k of ALL_KEYS) {
        const r = pressKey(state, k, 12, true);
        expect(r, `${state.entry} ${String(k)}`).toEqual({ state, event: 'locked', sent: null });
        expect(r.state).toBe(state);
      }
  });

  it('does not solve the right answer while a card is open, and solves it once the card is gone', () => {
    const typed = { entry: '12', solved: false };
    expect(pressKey(typed, 'equals', 12, true).event).toBe('locked');
    expect(pressKey(typed, 'equals', 12, false).event).toBe('right');
  });

  it('starts the next puzzle from a fresh state, so its keys work again', () => {
    expect(pressKey(START_STATE, 3, 3).event).toBe('digit');
    expect(START_STATE).toEqual({ entry: '', solved: false });
  });
});

describe('any key press resets the time signal (3.3)', () => {
  it('counts every press that reached the keypad, an ignored third digit and an empty = too', () => {
    const counted: KeyEvent[] = ['digit', 'full', 'clear', 'empty', 'right', 'wrong'];
    for (const e of counted) expect(isKeyPress(e), e).toBe(true);
  });

  it('does not count a press that did nothing because the puzzle is solved or a card is open', () => {
    expect(isKeyPress('locked')).toBe(false);
  });
});

describe('the physical keyboard (4.5, 9.2): digits, Enter for =, Backspace or Escape for C', () => {
  it('presses each digit key', () => {
    for (const d of DIGITS) expect(keyFromKeyboard({ key: String(d) }), String(d)).toBe(d);
  });

  it('presses = on Enter and C on Backspace or Escape', () => {
    expect(keyFromKeyboard({ key: 'Enter' })).toBe('equals');
    expect(keyFromKeyboard({ key: 'Backspace' })).toBe('clear');
    expect(keyFromKeyboard({ key: 'Escape' })).toBe('clear');
  });

  it('ignores every other key, the old plus and minus keys among them', () => {
    for (const key of ['a', '+', '-', '=', '*', '/', ' ', 'Tab', 'ArrowUp', 'Delete', 'Shift', 'c', 'C', '10', '', 'Spacebar', '!'])
      expect(keyFromKeyboard({ key }), JSON.stringify(key)).toBeNull();
  });

  it('ignores a digit or Enter held with Ctrl, Meta or Alt, so browser shortcuts stay theirs', () => {
    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }])
      for (const key of ['1', 'Enter', 'Backspace', 'Escape']) expect(keyFromKeyboard({ key, ...mod }), `${key} ${JSON.stringify(mod)}`).toBeNull();
  });

  it('takes a key with the modifiers off as a key', () => {
    expect(keyFromKeyboard({ key: '4', ctrlKey: false, metaKey: false, altKey: false })).toBe(4);
  });

  it('plays a sum from the keyboard alone: 1, 5, Enter solves 15; Backspace clears', () => {
    const keys = ['1', '5', 'Backspace', '1', '5', 'Enter'].map((key) => keyFromKeyboard({ key })!);
    expect(events(press(keys, 15))).toEqual(['digit', 'digit', 'clear', 'digit', 'digit', 'right']);
  });
});

describe('the physical keyboard and focus (4.5, 9.1, 9.2): Enter is = on the keypad, and presses any other control', () => {
  it('sends the typed answer on Enter while a keypad key has focus (the 7 key after Next, or a tapped key)', () => {
    expect(keyboardKey({ key: 'Enter' }, 'keypad')).toBe('equals');
    const keys = ['5', 'Enter'].map((key) => keyboardKey({ key }, 'keypad')!);
    expect(keys).toEqual([5, 'equals']);
    expect(events(press(keys, 5))).toEqual(['digit', 'right']);
  });

  it('sends the answer on Enter when nothing in particular has focus', () => {
    expect(keyboardKey({ key: 'Enter' }, 'none')).toBe('equals');
  });

  it('leaves Enter to a focused button or link outside the keypad (Next puzzle, New puzzle, the speaker, Back to home)', () => {
    expect(keyboardKey({ key: 'Enter' }, 'control')).toBeNull();
  });

  it('presses digits and C wherever focus is', () => {
    for (const focus of ['keypad', 'control', 'none'] as const) {
      expect(keyboardKey({ key: '7' }, focus), focus).toBe(7);
      expect(keyboardKey({ key: 'Backspace' }, focus), focus).toBe('clear');
      expect(keyboardKey({ key: 'Escape' }, focus), focus).toBe('clear');
    }
  });

  it('ignores other keys and chords wherever focus is, so Space and Tab stay the browser\'s', () => {
    for (const focus of ['keypad', 'control', 'none'] as const)
      for (const e of [{ key: ' ' }, { key: 'Tab' }, { key: 'a' }, { key: 'Enter', ctrlKey: true }, { key: '3', metaKey: true }])
        expect(keyboardKey(e, focus), `${JSON.stringify(e)} ${focus}`).toBeNull();
  });
});

describe('every answer a level can deal is typeable in 2 digits and solves (4.5 content checks)', () => {
  it('solves each dealt answer from its digits, every level and band over 40 seeds', () => {
    const answers = new Set<number>();
    for (const band of AGE_BANDS)
      for (let level = 0; level < LEVELS.length; level++)
        for (let seed = 0; seed < 40; seed++) for (const p of makePuzzles(level, seed * 131 + 7, band)) answers.add(p.answer);
    for (const answer of answers) {
      const keys = digitsOf(answer);
      expect(keys.length, String(answer)).toBeLessThanOrEqual(MAX_DIGITS);
      expect(last(press([...keys, 'equals'], answer)).event, String(answer)).toBe('right');
    }
    expect(Math.min(...answers)).toBe(0);
    expect(Math.max(...answers)).toBe(20);
  });

  it('solves the answers 0 to 9 typed with a leading 0 too, as "05"', () => {
    for (let answer = 0; answer <= 9; answer++) expect(last(press([0, answer as KeyId, 'equals'], answer)).event).toBe('right');
  });
});
