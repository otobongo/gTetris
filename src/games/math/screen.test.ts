/** The pure helpers behind Brick Calculator's play screen (brief 4.5, 7.7): the keypad's grid cells, the
    help line after each press, the ten-frames cell by cell, and the caption lines. No DOM. */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS } from '../../shared/progress';
import { CAPTION, CAPTION_LINES, KEYPAD_NAME } from './copy';
import { KEY_CELLS, KEY_ROWS, helpAfter, keyCells, type HelpKind, type KeyEvent, type KeyId } from './entry';
import { EMPTY_FRAMES, FRAME_CELLS, FRAME_SIZE, LEVELS, frameCells, makePuzzles, type Pair } from './puzzles';

describe('keyCells (the keypad grid)', () => {
  it('places 12 keys: ten digits, C and =', () => {
    expect(KEY_CELLS).toHaveLength(12);
    expect(new Set(KEY_CELLS.map((c) => c.key)).size).toBe(12);
  });

  it('puts 7 8 9 C on the first row and 0 spanning three columns on the last', () => {
    const at = (key: KeyId) => KEY_CELLS.find((c) => c.key === key)!;
    expect([7, 8, 9, 'clear'].map((k) => at(k as KeyId).col)).toEqual([0, 1, 2, 3]);
    expect([7, 8, 9, 'clear'].map((k) => at(k as KeyId).row)).toEqual([0, 0, 0, 0]);
    expect(at(0)).toMatchObject({ row: 3, col: 0, rowSpan: 1, colSpan: 3 });
  });

  it('makes = one key three rows tall in the last column', () => {
    expect(KEY_CELLS.find((c) => c.key === 'equals')).toMatchObject({ row: 1, col: 3, rowSpan: 3, colSpan: 1 });
  });

  it('covers every grid cell exactly once', () => {
    const grid = KEY_ROWS.map((r) => r.map(() => 0));
    for (const c of KEY_CELLS) for (let r = c.row; r < c.row + c.rowSpan; r += 1) for (let k = c.col; k < c.col + c.colSpan; k += 1) grid[r][k] += 1;
    expect(grid.flat().every((n) => n === 1)).toBe(true);
  });

  it('reads any layout: equal neighbours join, and an empty layout has no keys', () => {
    expect(keyCells([[1, 1], [2, 3]])).toEqual([
      { key: 1, row: 0, col: 0, rowSpan: 1, colSpan: 2 },
      { key: 2, row: 1, col: 0, rowSpan: 1, colSpan: 1 },
      { key: 3, row: 1, col: 1, rowSpan: 1, colSpan: 1 },
    ]);
    expect(keyCells([])).toEqual([]);
  });
});

describe('helpAfter (the line under the display)', () => {
  const events: KeyEvent[] = ['digit', 'full', 'clear', 'empty', 'right', 'wrong', 'locked'];
  const kinds: HelpKind[] = ['start', 'slip', 'full'];

  it('goes back to the start line on a digit or C', () => {
    for (const k of kinds) {
      expect(helpAfter(k, 'digit')).toBe('start');
      expect(helpAfter(k, 'clear')).toBe('start');
    }
  });

  it('shows the slip line after a wrong = and the third-digit line after a third digit', () => {
    for (const k of kinds) {
      expect(helpAfter(k, 'wrong')).toBe('slip');
      expect(helpAfter(k, 'full')).toBe('full');
    }
  });

  it('keeps the line when = has nothing to send, after a right answer, and for a locked press', () => {
    for (const k of kinds) for (const e of ['empty', 'right', 'locked'] as const) expect(helpAfter(k, e)).toBe(k);
  });

  it('always answers with one of the three lines', () => {
    for (const k of kinds) for (const e of events) expect(kinds).toContain(helpAfter(k, e));
  });
});

describe('frameCells (the two ten-frames)', () => {
  const plus = (a: number, b: number): Pair => ({ op: 'plus', a, b });
  const minus = (a: number, b: number): Pair => ({ op: 'minus', a, b });
  const count = (cells: readonly string[], kind: string) => cells.filter((c) => c === kind).length;

  it('draws 3 + 4 as 3 blue, 4 orange, then 13 empty', () => {
    const cells = frameCells(plus(3, 4));
    expect(cells).toHaveLength(FRAME_CELLS);
    expect(cells.slice(0, 3)).toEqual(['blue', 'blue', 'blue']);
    expect(cells.slice(3, 7)).toEqual(['orange', 'orange', 'orange', 'orange']);
    expect(count(cells, 'empty')).toBe(13);
  });

  it('draws 7 take away 3 as 4 blue, then the last 3 of the 7 taken away', () => {
    const cells = frameCells(minus(7, 3));
    expect(cells.slice(0, 4)).toEqual(['blue', 'blue', 'blue', 'blue']);
    expect(cells.slice(4, 7)).toEqual(['taken', 'taken', 'taken']);
    expect(count(cells, 'orange')).toBe(0);
    expect(count(cells, 'empty')).toBe(13);
  });

  it('runs on into the second frame past 10 and fills all 20 cells at the most', () => {
    const cells = frameCells(plus(12, 8));
    expect(cells.slice(FRAME_SIZE).every((c) => c !== 'empty')).toBe(true);
    expect(count(cells, 'empty')).toBe(0);
    expect(count(frameCells(minus(20, 1)), 'taken')).toBe(1);
  });

  it('can take everything away (answer 0 on the mixed levels)', () => {
    const cells = frameCells(minus(5, 5));
    expect(count(cells, 'blue')).toBe(0);
    expect(count(cells, 'taken')).toBe(5);
  });

  it('refuses a sum that does not fit or cannot be taken', () => {
    expect(() => frameCells(plus(15, 6))).toThrow(RangeError);
    expect(() => frameCells(minus(21, 1))).toThrow(RangeError);
    expect(() => frameCells(minus(3, 4))).toThrow(RangeError);
    expect(() => frameCells(plus(-1, 2))).toThrow(RangeError);
    expect(() => frameCells(plus(1.5, 2))).toThrow(RangeError);
  });

  it('matches the sum for every puzzle of every level and band', () => {
    for (const band of AGE_BANDS) {
      for (let level = 0; level < LEVELS.length; level += 1) {
        for (const p of makePuzzles(level, 7, band)) {
          const cells = frameCells(p);
          expect(count(cells, 'blue') + count(cells, 'taken')).toBe(p.a);
          expect(count(cells, 'orange')).toBe(p.op === 'plus' ? p.b : 0);
          expect(count(cells, 'taken')).toBe(p.op === 'minus' ? p.b : 0);
        }
      }
    }
  });

  it('has an empty finished state of 20 empty cells', () => {
    expect(EMPTY_FRAMES).toHaveLength(FRAME_CELLS);
    expect(EMPTY_FRAMES.every((c) => c === 'empty')).toBe(true);
  });
});

describe('the caption and the keypad name', () => {
  it('breaks the caption into the board\'s two lines without changing it', () => {
    expect(CAPTION_LINES).toEqual(['Each row holds 5.', 'Two rows make 10.']);
    expect(CAPTION).toBe('Each row holds 5. Two rows make 10.');
  });

  it('names the keypad group', () => {
    expect(KEYPAD_NAME).toBe('Keypad');
  });
});
