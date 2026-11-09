/**
 * Picture Builder's board rules (six-games brief 4.6, 3.1, 9.2, 10.2): the match count counts only bricks, one slip
 * per stroke, a repeated wrong colour on a square counts once for stars, erasing never slips, painting a square
 * with its own colour is skipped, the eraser on an empty square does nothing, the last right brick solves at once,
 * the board locks during a look, and the keyboard's one tab stop.
 *
 * Slips are checked where they land: each stroke's slip goes into the kit's level reducer with Picture Builder's
 * own KitGame, as the Play screen passes it, and the test reads the star slips and the stuck count back.
 */
import { describe, expect, it } from 'vitest';
import { initLevelRun, levelRunReducer, type LevelRunState } from '../kit/levelRun';
import {
  endStroke,
  indexOf,
  isSolved,
  matchCount,
  moveFocus,
  newBoard,
  paintOnce,
  paintSquare,
  rowColOf,
  setLocked,
  slipKey,
  squareMatches,
  startStroke,
  wrongCount,
  type Board,
  type Paint,
  type PaintResult,
} from './board';
import { GAME } from './game';
import { cellsOf } from './pictures';
import { LEVEL_COUNT, makePuzzles } from './puzzles';

const NOW = new Date(2026, 10, 9, 12, 0).getTime();

/**
 * A 3x3 picture with 3 bricks and 6 squares that stay empty:
 *   R B .
 *   . R .
 *   . . .
 * Squares 0 and 4 are red, square 1 is blue, the rest stay empty.
 */
const TARGET = cellsOf('RB./.R./...');
const HOUSE = cellsOf('.RR./RRRR/YYBY/YYBY');

/** The board plus the kit's level state, played the way the Play screen plays them. */
interface Play {
  board: Board;
  run: LevelRunState;
}

const start = (target = TARGET, locked = false, level = 0): Play => ({
  board: newBoard(target, locked),
  run: initLevelRun({ game: GAME, level, band: '5-6', stored: null, now: NOW }),
});

/** One stroke: pointer down with `paint`, over `squares` in order, pointer up. Progress, solve and slip go to the kit. */
function stroke(play: Play, paint: Paint, squares: number[]): { play: Play; results: PaintResult[]; slip: string | null } {
  let board = startStroke(play.board, paint);
  let run = play.run;
  const results: PaintResult[] = [];
  for (const i of squares) {
    const step = paintSquare(board, i);
    board = step.board;
    results.push(step.result);
    if (step.result === 'right') run = levelRunReducer(run, { type: 'progress' });
    if (step.result === 'solved') run = levelRunReducer(run, { type: 'solve', outcome: { kind: 'ignored' } });
  }
  const end = endStroke(board);
  if (end.slip !== null) run = levelRunReducer(run, { type: 'slip', key: end.slip });
  return { play: { board: end.board, run }, results, slip: end.slip };
}

/** Several strokes in a row. */
function strokes(play: Play, ...list: [Paint, number[]][]): { play: Play; slips: (string | null)[] } {
  const slips: (string | null)[] = [];
  let p = play;
  for (const [paint, squares] of list) {
    const s = stroke(p, paint, squares);
    p = s.play;
    slips.push(s.slip);
  }
  return { play: p, slips };
}

/** Star slips and the stuck count as the kit holds them. */
const counts = (p: Play) => ({ stars: p.run.slips, stuck: p.run.stuck.count });

/* ---------- A new board ---------- */

describe('a new board', () => {
  it('starts empty, unsolved, unlocked and with no stroke', () => {
    const b = newBoard(TARGET);
    expect(b.cells).toEqual(Array(9).fill(null));
    expect(b.target).toEqual(TARGET);
    expect(b.solved).toBe(false);
    expect(b.locked).toBe(false);
    expect(b.stroke).toBeNull();
    expect(isSolved(b)).toBe(false);
    expect(wrongCount(b)).toBe(0);
  });

  it('starts locked for a memory puzzle’s first look', () => {
    expect(newBoard(TARGET, true).locked).toBe(true);
  });

  it('starts every one of the 72 puzzles empty and unsolved, with the picture’s bricks still to place', () => {
    for (let l = 0; l < LEVEL_COUNT; l++)
      for (const p of makePuzzles(l)) {
        const b = newBoard(p.target);
        expect(isSolved(b), `Level ${l + 1} puzzle ${p.n + 1}`).toBe(false);
        expect(matchCount(b), `Level ${l + 1} puzzle ${p.n + 1}`).toEqual({ right: 0, total: p.bricks });
      }
  });
});

/* ---------- The match count (4.6, 10.2) ---------- */

describe('the match count counts only the picture’s bricks (4.6, 10.2)', () => {
  it('reads 0 of 3 on an empty board, though its 6 empty squares already match', () => {
    const b = newBoard(TARGET);
    expect(matchCount(b)).toEqual({ right: 0, total: 3 });
    expect([2, 3, 5, 6, 7, 8].every((i) => squareMatches(b, i))).toBe(true);
  });

  it('counts a right brick, and not a wrong colour on a brick square', () => {
    const { play } = strokes(start(), ['red', [0]], ['red', [1]]);
    expect(matchCount(play.board)).toEqual({ right: 1, total: 3 });
  });

  it('does not count a brick on a square that must stay empty, right or total', () => {
    const { play } = strokes(start(), ['red', [0, 2, 3]]);
    expect(matchCount(play.board)).toEqual({ right: 1, total: 3 });
  });

  it('counts the house as 14 bricks: the board’s "of 16 squares" is gone', () => {
    expect(matchCount(newBoard(HOUSE))).toEqual({ right: 0, total: 14 });
  });

  it('reads all of them right once the picture is built', () => {
    const { play } = strokes(start(), ['red', [0, 4]], ['blue', [1]]);
    expect(matchCount(play.board)).toEqual({ right: 3, total: 3 });
  });
});

describe('the wrong count, for the copy levels’ wrong line', () => {
  it('counts every brick that does not match, a colour on a square that must stay empty included', () => {
    const { play } = strokes(start(), ['blue', [0, 1, 2, 3]]);
    // 0 is red (wrong), 1 is blue (right), 2 and 3 stay empty (wrong)
    expect(wrongCount(play.board)).toBe(3);
  });

  it('never counts an empty square, and drops a brick once it is erased or painted right', () => {
    let { play } = strokes(start(), ['blue', [0, 2]]);
    expect(wrongCount(play.board)).toBe(2);
    ({ play } = strokes(play, ['eraser', [2]], ['red', [0]]));
    expect(wrongCount(play.board)).toBe(0);
  });
});

/* ---------- Painting a square ---------- */

describe('painting a square (4.6)', () => {
  it('lays a brick that matches as right, and one that does not as wrong', () => {
    expect(stroke(start(), 'red', [0]).results).toEqual(['right']);
    expect(stroke(start(), 'blue', [0]).results).toEqual(['wrong']);
  });

  it('lays a colour on a square that must stay empty as wrong', () => {
    const { results, play } = stroke(start(), 'green', [8]);
    expect(results).toEqual(['wrong']);
    expect(play.board.cells[8]).toBe('green');
  });

  it('skips a square that already holds the stroke’s colour, right or wrong', () => {
    const { play } = strokes(start(), ['red', [0, 2]]);
    const again = stroke(play, 'red', [0, 2]);
    expect(again.results).toEqual(['none', 'none']);
    expect(again.play.board.cells).toEqual(play.board.cells);
    expect(again.slip).toBeNull();
  });

  it('does nothing with the eraser on an empty square', () => {
    const { results, play, slip } = stroke(start(), 'eraser', [0, 2, 8]);
    expect(results).toEqual(['none', 'none', 'none']);
    expect(play.board.cells).toEqual(Array(9).fill(null));
    expect(slip).toBeNull();
  });

  it('takes a brick away with the eraser, right or wrong', () => {
    const { play } = strokes(start(), ['red', [0, 2]]);
    const erased = stroke(play, 'eraser', [0, 2]);
    expect(erased.results).toEqual(['erased', 'erased']);
    expect(erased.play.board.cells).toEqual(Array(9).fill(null));
    expect(matchCount(erased.play.board).right).toBe(0);
  });

  it('turns a wrong brick right when the right colour goes over it', () => {
    const { play } = strokes(start(), ['blue', [0]]);
    expect(stroke(play, 'red', [0]).results).toEqual(['right']);
  });

  it('paints nothing outside the board and nothing without a stroke', () => {
    const b = startStroke(newBoard(TARGET), 'red');
    for (const i of [-1, 9, 100, 1.5, Number.NaN]) expect(paintSquare(b, i).result, `square ${i}`).toBe('none');
    expect(paintSquare(newBoard(TARGET), 0).result).toBe('none');
  });

  it('leaves the board it was given as it was', () => {
    const b = startStroke(newBoard(TARGET), 'red');
    const cells = [...b.cells];
    paintSquare(b, 0);
    expect(b.cells).toEqual(cells);
  });
});

describe('the progress that resets the time signal: a new right brick (3.3)', () => {
  it('sends progress for a right brick only, never for a wrong one, an erase or a skipped square', () => {
    const { results } = stroke(start(), 'red', [0, 2, 0]);
    expect(results).toEqual(['right', 'wrong', 'none']);
    expect(stroke(start(), 'eraser', [0]).results).toEqual(['none']);
  });

  it('resets the kit’s seconds on a right brick and leaves them on a wrong one', () => {
    let play = start();
    play = { ...play, run: levelRunReducer(play.run, { type: 'tick', seconds: 20 }) };
    const wrong = stroke(play, 'blue', [0]).play;
    expect(wrong.run.stuck.seconds).toBe(20);
    const right = stroke(play, 'red', [0]).play;
    expect(right.run.stuck.seconds).toBe(0);
  });
});

/* ---------- The solve ---------- */

describe('the last right brick solves at once (4.6)', () => {
  it('solves on the brick that makes every square match, in the middle of a stroke', () => {
    const { play } = strokes(start(), ['blue', [1]]);
    expect(isSolved(play.board)).toBe(false);
    const { results, play: done } = stroke(play, 'red', [0, 4]);
    expect(results).toEqual(['right', 'solved']);
    expect(done.board.solved).toBe(true);
    expect(isSolved(done.board)).toBe(true);
    expect(done.run.phase).toBe('solved');
  });

  it('is not solved while a square that must stay empty holds a brick', () => {
    const { play } = strokes(start(), ['red', [0, 4, 2]], ['blue', [1]]);
    expect(isSolved(play.board)).toBe(false);
    expect(play.board.solved).toBe(false);
    expect(play.run.phase).toBe('play');
  });

  it('solves when the eraser takes away the last wrong brick', () => {
    const { play } = strokes(start(), ['red', [0, 4, 2]], ['blue', [1]]);
    const { results, play: done, slip } = stroke(play, 'eraser', [2]);
    expect(results).toEqual(['solved']);
    expect(done.board.solved).toBe(true);
    expect(slip).toBeNull();
    expect(done.run.phase).toBe('solved');
  });

  it('paints nothing more once solved, and starts no new stroke', () => {
    const { play } = strokes(start(), ['red', [0, 4]], ['blue', [1]]);
    expect(play.board.solved).toBe(true);
    const after = stroke(play, 'green', [2, 3]);
    expect(after.results).toEqual(['none', 'none']);
    expect(after.play.board.cells).toEqual(play.board.cells);
    expect(after.slip).toBeNull();
    expect(startStroke(play.board, 'red').stroke).toBeNull();
  });

  it('ends the stroke that solves with no slip, and records 0 slips for a clean build', () => {
    const { play, slips } = strokes(start(), ['red', [0, 4]], ['blue', [1]]);
    expect(slips).toEqual([null, null]);
    expect(play.run.phase).toBe('solved');
    expect(play.run.run.solved).toEqual([{ puzzle: 0, count: 0, usedHint: false, outOfTime: false }]);
  });
});

/* ---------- Slips (4.6, 3.1) ---------- */

describe('one slip per stroke (4.6, 10.2)', () => {
  it('counts a drag over three wrong squares as one slip, for stars and for the stuck offer', () => {
    const { play, slip } = stroke(start(), 'green', [0, 1, 2]);
    expect(slip).not.toBeNull();
    expect(counts(play)).toEqual({ stars: 1, stuck: 1 });
  });

  it('counts a stroke with right and wrong bricks as one slip', () => {
    const { play, results } = stroke(start(), 'red', [0, 1, 4, 5]);
    expect(results).toEqual(['right', 'wrong', 'right', 'wrong']);
    expect(counts(play)).toEqual({ stars: 1, stuck: 1 });
  });

  it('gives no slip for a stroke of right bricks only', () => {
    const { play, slip } = stroke(start(), 'red', [0, 4]);
    expect(slip).toBeNull();
    expect(counts(play)).toEqual({ stars: 0, stuck: 0 });
  });

  it('counts two wrong strokes as two slips', () => {
    const { play } = strokes(start(), ['green', [0]], ['yellow', [1]]);
    expect(counts(play)).toEqual({ stars: 2, stuck: 2 });
  });

  it('treats one key press as one stroke on one square (Enter or Space)', () => {
    const wrong = paintOnce(newBoard(TARGET), 'blue', 0);
    expect(wrong.result).toBe('wrong');
    expect(wrong.slip).not.toBeNull();
    expect(wrong.board.stroke).toBeNull();
    const right = paintOnce(newBoard(TARGET), 'red', 0);
    expect(right.result).toBe('right');
    expect(right.slip).toBeNull();
  });

  it('ends a stroke that never started with no slip', () => {
    const b = newBoard(TARGET);
    expect(endStroke(b)).toEqual({ board: b, slip: null });
  });
});

describe('the same wrong colour on the same square counts once for stars (4.6, 3.1)', () => {
  it('adds no star slip when a wrong brick is erased and laid again, but still feeds the stuck offer', () => {
    const { play, slips } = strokes(start(), ['blue', [0]], ['eraser', [0]], ['blue', [0]]);
    expect(slips[0]).not.toBeNull();
    expect(slips[1]).toBeNull();
    expect(slips[2]).not.toBeNull();
    expect(counts(play)).toEqual({ stars: 1, stuck: 2 });
  });

  it('adds no star slip when the same wrong colour comes back after another colour on that square', () => {
    const { play } = strokes(start(), ['blue', [0]], ['green', [0]], ['blue', [0]]);
    expect(counts(play)).toEqual({ stars: 2, stuck: 3 });
  });

  it('counts a different wrong colour on the same square as a new slip', () => {
    const { play } = strokes(start(), ['blue', [0]], ['green', [0]]);
    expect(counts(play)).toEqual({ stars: 2, stuck: 2 });
  });

  it('counts the same wrong colour on another square as a new slip', () => {
    const { play } = strokes(start(), ['blue', [0]], ['blue', [4]]);
    expect(counts(play)).toEqual({ stars: 2, stuck: 2 });
  });

  it('counts a stroke that repeats an old wrong brick and lays a new one as a new slip', () => {
    const { play } = strokes(start(), ['green', [0]], ['eraser', [0]], ['green', [0, 1]]);
    expect(counts(play)).toEqual({ stars: 2, stuck: 2 });
  });

  it('remembers the second new wrong brick of a stroke too, so laying it again later adds no star slip', () => {
    const { play } = strokes(start(), ['green', [0, 1]], ['eraser', [1]], ['green', [1]]);
    expect(counts(play)).toEqual({ stars: 1, stuck: 2 });
  });

  it('keeps the count on one puzzle: the next puzzle starts with no wrong bricks seen', () => {
    const first = strokes(start(), ['blue', [0]]).play;
    const fresh = strokes(start(), ['blue', [0]]).play;
    expect(counts(first)).toEqual(counts(fresh));
    expect(newBoard(TARGET).seen).toEqual([]);
  });

  it('gives each square and colour its own slip key', () => {
    const keys = Array.from({ length: 25 }, (_, i) => ['red', 'yellow', 'green', 'blue', 'orange', 'white'].map((c) => slipKey(i, c as never))).flat();
    expect(new Set(keys).size).toBe(25 * 6);
    expect(slipKey(5, 'red')).toBe(slipKey(5, 'red'));
  });
});

describe('erasing never slips (4.6)', () => {
  it('gives no slip for an eraser stroke over wrong and right bricks', () => {
    const laid = strokes(start(), ['red', [0, 1, 2]]).play;
    expect(counts(laid)).toEqual({ stars: 1, stuck: 1 });
    const { play, slip } = stroke(laid, 'eraser', [0, 1, 2]);
    expect(slip).toBeNull();
    expect(counts(play)).toEqual({ stars: 1, stuck: 1 });
  });

  it('gives no slip for the eraser on empty squares', () => {
    const { play, slip } = stroke(start(), 'eraser', [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(slip).toBeNull();
    expect(counts(play)).toEqual({ stars: 0, stuck: 0 });
  });
});

describe('stars and the stuck offer from the strokes (3.2, 3.3)', () => {
  it('brings the offer at 3 wrong strokes for ages 5 to 6, however few star slips they hold', () => {
    const { play } = strokes(start(), ['blue', [0]], ['eraser', [0]], ['blue', [0]], ['eraser', [0]], ['blue', [0]]);
    expect(counts(play)).toEqual({ stars: 1, stuck: 3 });
    expect(play.run.stuck.offer).toBe(true);
  });

  it('records the star slips, not the stuck count, as the solved puzzle’s slips', () => {
    const { play } = strokes(start(), ['blue', [0]], ['eraser', [0]], ['blue', [0]], ['red', [0, 4]], ['blue', [1]]);
    expect(play.run.phase).toBe('solved');
    expect(play.run.run.solved[0].count).toBe(1);
  });
});

/* ---------- The look (4.6) ---------- */

describe('the board locks during a look (4.6, 10.2)', () => {
  it('paints nothing while locked: no stroke starts and a key press does nothing', () => {
    const locked = newBoard(TARGET, true);
    expect(startStroke(locked, 'red').stroke).toBeNull();
    expect(stroke({ ...start(), board: locked }, 'red', [0, 1]).results).toEqual(['none', 'none']);
    const press = paintOnce(locked, 'blue', 0);
    expect(press.result).toBe('none');
    expect(press.slip).toBeNull();
    expect(press.board.cells).toEqual(Array(9).fill(null));
  });

  it('paints again once the look ends', () => {
    const open = setLocked(newBoard(TARGET, true), false);
    expect(open.locked).toBe(false);
    expect(paintOnce(open, 'red', 0).result).toBe('right');
  });

  it('keeps the bricks already built when a Peek locks the board, and gives them back after', () => {
    const built = strokes(start(), ['red', [0, 4]]).play.board;
    const peeking = setLocked(built, true);
    expect(peeking.cells).toEqual(built.cells);
    expect(paintOnce(peeking, 'blue', 1).result).toBe('none');
    const back = setLocked(peeking, false);
    expect(back.cells).toEqual(built.cells);
    expect(paintOnce(back, 'blue', 1).result).toBe('solved');
  });

  it('cuts a stroke short when the board locks: nothing more paints and the cut stroke gives no slip, as a cancelled drag (3.1)', () => {
    let b = startStroke(newBoard(TARGET), 'green');
    b = paintSquare(b, 0).board;
    b = setLocked(b, true);
    expect(b.stroke).toBeNull();
    expect(paintSquare(b, 1).result).toBe('none');
    expect(endStroke(b).slip).toBeNull();
  });

  it('returns the same board when the lock does not change', () => {
    const b = newBoard(TARGET);
    expect(setLocked(b, false)).toBe(b);
    const l = newBoard(TARGET, true);
    expect(setLocked(l, true)).toBe(l);
  });
});

/* ---------- Keyboard (9.2) ---------- */

describe('the board’s one tab stop: arrow keys move, Enter or Space paints (9.2)', () => {
  for (const size of [3, 4, 5]) {
    const last = size * size - 1;
    it(`moves one square per arrow on the ${size}x${size} grid and stays put at an edge`, () => {
      expect(moveFocus(size, 0, 'ArrowRight')).toBe(1);
      expect(moveFocus(size, 0, 'ArrowDown')).toBe(size);
      expect(moveFocus(size, 0, 'ArrowLeft')).toBe(0);
      expect(moveFocus(size, 0, 'ArrowUp')).toBe(0);
      expect(moveFocus(size, last, 'ArrowRight')).toBe(last);
      expect(moveFocus(size, last, 'ArrowDown')).toBe(last);
      expect(moveFocus(size, last, 'ArrowLeft')).toBe(last - 1);
      expect(moveFocus(size, last, 'ArrowUp')).toBe(last - size);
    });

    it(`goes to the row’s first and last square with Home and End on the ${size}x${size} grid`, () => {
      const mid = indexOf(size, 1, 1);
      expect(moveFocus(size, mid, 'Home')).toBe(indexOf(size, 1, 0));
      expect(moveFocus(size, mid, 'End')).toBe(indexOf(size, 1, size - 1));
    });

    it(`never wraps to another row and never leaves the ${size}x${size} grid`, () => {
      for (let i = 0; i <= last; i++) {
        const { row, col } = rowColOf(size, i);
        expect(rowColOf(size, moveFocus(size, i, 'ArrowLeft')).row).toBe(row);
        expect(rowColOf(size, moveFocus(size, i, 'ArrowRight')).row).toBe(row);
        expect(rowColOf(size, moveFocus(size, i, 'ArrowUp')).col).toBe(col);
        expect(rowColOf(size, moveFocus(size, i, 'ArrowDown')).col).toBe(col);
        for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'] as const) {
          const to = moveFocus(size, i, key);
          expect(to).toBeGreaterThanOrEqual(0);
          expect(to).toBeLessThanOrEqual(last);
        }
      }
    });

    it(`reads every square of the ${size}x${size} grid back from its row and column`, () => {
      for (let i = 0; i <= last; i++) {
        const { row, col } = rowColOf(size, i);
        expect(indexOf(size, row, col)).toBe(i);
      }
      expect(rowColOf(size, last)).toEqual({ row: size - 1, col: size - 1 });
    });
  }

  it('builds a whole picture by key presses alone, one square at a time', () => {
    for (const p of makePuzzles(10).slice(0, 2)) {
      let b = newBoard(p.target);
      let result: PaintResult = 'none';
      p.target.forEach((c, i) => {
        if (c === null) return;
        ({ board: b, result } = paintOnce(b, c, i));
      });
      expect(result).toBe('solved');
      expect(b.solved).toBe(true);
    }
  });
});
