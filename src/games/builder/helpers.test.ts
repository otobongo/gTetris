/**
 * The pure helpers the Play screen added to the stage 1 modules (six-games brief 4.6, 7.8, 9.2): where a pointer
 * is on the board, the squares a quick drag passes over, a lost pointer that never counts, and the look rules of
 * memory levels. No DOM: the screen passes points it measured with the kit's localPoint.
 */
import { describe, expect, it } from 'vitest';
import {
  BOARD_GAP_PX,
  BOARD_PX,
  cancelStroke,
  endStroke,
  newBoard,
  paintSquare,
  startStroke,
  squareAt,
  squaresAlong,
  type Cell,
} from './board';
import { BOARD_NAME, PALETTE_NAME, viewOf } from './copy';
import { LOOK_SECONDS, canPeek, firstLook, lookMs, pictureShows } from './puzzles';

const cell = (size: number, width = BOARD_PX) => (width - ((width * BOARD_GAP_PX) / BOARD_PX) * (size - 1)) / size;
/** The middle of square (row, col), in grid px. */
const mid = (size: number, row: number, col: number, width = BOARD_PX) => {
  const c = cell(size, width);
  const pitch = c + (width * BOARD_GAP_PX) / BOARD_PX;
  return { x: col * pitch + c / 2, y: row * pitch + c / 2 };
};

describe('squareAt: the square under a point (7.8)', () => {
  it('draws the squares the brief gives: 107, 79 and 62 px in the same 334 px grid', () => {
    expect(Math.floor(cell(3))).toBe(107);
    expect(cell(4)).toBe(79);
    expect(cell(5)).toBe(62);
  });

  it('finds every square of every grid size from its middle, row by row', () => {
    for (const size of [3, 4, 5]) {
      for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) expect(squareAt(mid(size, r, c), size)).toBe(r * size + c);
    }
  });

  it('finds the corners of the grid', () => {
    expect(squareAt({ x: 0, y: 0 }, 4)).toBe(0);
    expect(squareAt({ x: BOARD_PX - 0.5, y: BOARD_PX - 0.5 }, 4)).toBe(15);
  });

  it('gives null in the gap between squares, so a stroke paints nothing there', () => {
    // 4x4: square 0 ends at 79, square 1 starts at 85.
    expect(squareAt({ x: 82, y: 10 }, 4)).toBeNull();
    expect(squareAt({ x: 10, y: 82 }, 4)).toBeNull();
    expect(squareAt({ x: 79.5, y: 10 }, 4)).toBeNull();
    expect(squareAt({ x: 85, y: 10 }, 4)).toBe(1);
  });

  it('gives null outside the grid and for a point that is not a number', () => {
    expect(squareAt({ x: -1, y: 10 }, 4)).toBeNull();
    expect(squareAt({ x: 10, y: BOARD_PX }, 4)).toBeNull();
    expect(squareAt({ x: Number.NaN, y: 10 }, 4)).toBeNull();
  });

  it('holds at any zoom: the same fraction of the grid finds the same square', () => {
    for (const width of [334 * 0.88, 334 * 1.4, 200]) {
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) expect(squareAt(mid(5, r, c, width), 5, width)).toBe(r * 5 + c);
    }
  });

  it('gives null for a size or width that cannot be a board', () => {
    expect(squareAt({ x: 10, y: 10 }, 0)).toBeNull();
    expect(squareAt({ x: 10, y: 10 }, 2.5)).toBeNull();
    expect(squareAt({ x: 10, y: 10 }, 4, 0)).toBeNull();
  });
});

describe('squaresAlong: no square skipped on a quick drag', () => {
  it('lists the squares on the way, in order, leaving out the one it starts on', () => {
    expect(squaresAlong(mid(4, 0, 0), mid(4, 0, 3), 4)).toEqual([1, 2, 3]);
    expect(squaresAlong(mid(5, 4, 0), mid(5, 0, 0), 5)).toEqual([15, 10, 5, 0]);
  });

  it('lists each square once even when many samples fall on it', () => {
    const path = squaresAlong(mid(3, 1, 0), mid(3, 1, 2), 3);
    expect(path).toEqual([4, 5]);
  });

  it('gives nothing for a move inside one square', () => {
    const a = mid(4, 2, 2);
    expect(squaresAlong(a, { x: a.x + 3, y: a.y - 2 }, 4)).toEqual([]);
  });

  it('starts from outside the grid and still finds the squares it enters', () => {
    expect(squaresAlong({ x: -40, y: mid(4, 1, 0).y }, mid(4, 1, 1), 4)).toEqual([4, 5]);
  });

  it('gives nothing for a size or width that cannot be a board', () => {
    expect(squaresAlong({ x: 0, y: 0 }, { x: 300, y: 300 }, 0)).toEqual([]);
    expect(squaresAlong({ x: 0, y: 0 }, { x: 300, y: 300 }, 4, -1)).toEqual([]);
  });
});

describe('cancelStroke: a lost pointer never counts', () => {
  const target: Cell[] = ['red', 'red', null, null];

  it('ends the stroke with no slip, and the bricks it laid stay', () => {
    let b = startStroke(newBoard(target), 'blue');
    b = paintSquare(b, 0).board;
    b = cancelStroke(b);
    expect(b.stroke).toBeNull();
    expect(b.cells[0]).toBe('blue');
    expect(b.given).toEqual([]);
    // Pointer up after the loss finds no stroke: still no slip.
    expect(endStroke(b).slip).toBeNull();
  });

  it('returns the same board when no stroke is under way', () => {
    const b = newBoard(target);
    expect(cancelStroke(b)).toBe(b);
  });
});

describe('the looks of memory levels (4.6, 7.8)', () => {
  it('opens a memory puzzle on its first look and a copy puzzle on none', () => {
    expect(firstLook('memory')).toBe('first');
    expect(firstLook('copy')).toBeNull();
  });

  it('times each look from the one LOOK_SECONDS table, in milliseconds', () => {
    for (const band of ['3-4', '5-6', '7-8', '9-10'] as const) {
      expect(lookMs(band, 'first')).toBe(LOOK_SECONDS[band].first * 1000);
      expect(lookMs(band, 'peek')).toBe(LOOK_SECONDS[band].peek * 1000);
    }
    expect(lookMs('7-8', 'first')).toBe(4000);
    expect(lookMs('7-8', 'peek')).toBe(2000);
  });

  it('offers Peek only on a memory puzzle in play with the picture hidden', () => {
    expect(canPeek('memory', null, true)).toBe(true);
    expect(canPeek('memory', 'first', true)).toBe(false);
    expect(canPeek('memory', 'peek', true)).toBe(false);
    expect(canPeek('memory', null, false)).toBe(false);
    expect(canPeek('copy', null, true)).toBe(false);
  });

  it('shows the picture on copy levels, during a look and after the solve, and hides it otherwise', () => {
    expect(pictureShows('copy', null, true)).toBe(true);
    expect(pictureShows('memory', 'first', true)).toBe(true);
    expect(pictureShows('memory', 'peek', true)).toBe(true);
    expect(pictureShows('memory', null, false)).toBe(true);
    expect(pictureShows('memory', null, true)).toBe(false);
  });

  it('turns a look into the copy view: looking while one runs, hidden otherwise', () => {
    expect(viewOf('first')).toBe('look');
    expect(viewOf('peek')).toBe('look');
    expect(viewOf(null)).toBe('hidden');
  });
});

describe('group names, as the Builder board names them', () => {
  it('names the board "Board" and the palette "Colors"', () => {
    expect(BOARD_NAME).toBe('Board');
    expect(PALETTE_NAME).toBe('Colors');
  });
});
