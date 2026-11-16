import { describe, expect, it } from 'vitest';
import { fromSpec, initialState, withMove, type GateDef } from './engine';
import { brickLabel, doorLabel, exitLine, moveLine, slidLine } from './labels';
import { PUZZLE_LEVELS } from './puzzles';

const DASHES = /[‒–—―−]/;

/*
 * A 4 x 5 tray:
 *   W W . . .   W: white, 1 row, 2 columns
 *   . . . . R   R: red, 3 rows, 1 column
 *   B B B . R   B: black, 1 row, 3 columns
 *   G . . . R   G: green, one square
 */
const lvl = fromSpec(
  {
    map: ['WW...', '....R', 'BBB.R', 'G...R'],
    colors: { W: 'white', R: 'red', B: 'black', G: 'green' },
    gates: [
      { side: 'right', at: 1, len: 1, color: 'white' },
      { side: 'top', at: 2, len: 1, color: 'black' },
      { side: 'left', at: 1, len: 2, color: 'red' },
      { side: 'bottom', at: 0, len: 1, color: 'green' },
    ],
  },
  1,
);
const start = initialState(lvl);
const id = (color: string) => lvl.blocks.findIndex((b) => b.color === color);
const at = (color: string) => start.pos[id(color)]!;
const block = (color: string) => lvl.blocks[id(color)];

/* A 2 x 3 brick and a 2 x 2 brick, the shapes the real levels use. */
const wide = fromSpec({ map: ['YYY.', 'YYY.', '..PP', '..PP'], colors: { Y: 'yellow', P: 'pink' }, gates: [] }, 2);

describe('brickLabel: colour, size and where the brick sits, counted from 1', () => {
  it('names a brick one row high by its length, its row and its columns', () => {
    expect(brickLabel(block('white'), at('white'))).toBe('White brick, 2 long, row 1, columns 1 to 2');
    expect(brickLabel(block('black'), at('black'))).toBe('Black brick, 3 long, row 3, columns 1 to 3');
  });

  it('names a brick one column wide by its length, its rows and its column', () => {
    expect(brickLabel(block('red'), at('red'))).toBe('Red brick, 3 long, rows 2 to 4, column 5');
  });

  it('names a one-square brick by its one row and one column', () => {
    expect(brickLabel(block('green'), at('green'))).toBe('Green brick, 1 square, row 4, column 1');
  });

  it('names a brick two or more squares each way by how wide and how tall it is', () => {
    expect(brickLabel(wide.blocks[0], [0, 0])).toBe('Yellow brick, 3 wide, 2 tall, rows 1 to 2, columns 1 to 3');
    expect(brickLabel(wide.blocks[1], [2, 2])).toBe('Pink brick, 2 wide, 2 tall, rows 3 to 4, columns 3 to 4');
  });

  it('follows the brick: the same brick in a new spot gets a new name', () => {
    expect(brickLabel(block('white'), [1, 2])).toBe('White brick, 2 long, row 2, columns 3 to 4');
  });

  it('tells two bricks of one colour apart', () => {
    const twins = fromSpec({ map: ['WW..', '....', '..XX'], colors: { W: 'white', X: 'white' }, gates: [] }, 3);
    const s = initialState(twins);
    const a = brickLabel(twins.blocks[0], s.pos[0]!);
    const b = brickLabel(twins.blocks[1], s.pos[1]!);
    expect(a).not.toBe(b);
  });
});

describe('doorLabel: colour, side and the rows or columns it covers', () => {
  it('names a door on each of the four sides', () => {
    expect(doorLabel(lvl, lvl.gates[0], start)).toBe('White door, right side, row 2');
    expect(doorLabel(lvl, lvl.gates[1], start)).toBe('Black door, top side, column 3');
    expect(doorLabel(lvl, lvl.gates[2], start)).toBe('Red door, left side, rows 2 to 3');
    expect(doorLabel(lvl, lvl.gates[3], start)).toBe('Green door, bottom side, column 1');
  });

  const iced = (gate: Partial<GateDef>) =>
    fromSpec({ map: ['A.', 'B.', 'C.'], colors: { A: 'red', B: 'blue', C: 'green' }, gates: [{ side: 'right', at: 0, len: 1, color: 'red', ...gate }] }, 4);

  it('keeps the frozen text for a door that waits for a number of bricks', () => {
    const l = iced({ lock: 2 });
    const s = initialState(l);
    expect(doorLabel(l, l.gates[0], s)).toBe('Frozen door, right side, row 1, melts after 2 more bricks leave');
    const one = withMove(s, 2, null);
    expect(doorLabel(l, l.gates[0], one)).toBe('Frozen door, right side, row 1, melts after 1 more brick leaves');
    expect(doorLabel(l, l.gates[0], withMove(one, 1, null))).toBe('Red door, right side, row 1');
  });

  it('keeps the icy text for a door that waits for every brick of a colour', () => {
    const l = iced({ lockColor: 'blue' });
    const s = initialState(l);
    expect(doorLabel(l, l.gates[0], s)).toBe('Frozen door, right side, row 1, melts when every blue brick is out');
    expect(doorLabel(l, l.gates[0], withMove(s, 1, null))).toBe('Red door, right side, row 1');
  });
});

describe('the lines read out after a move', () => {
  it('says where a brick slid, counted from 1', () => {
    expect(moveLine('white', 'column', 2)).toBe('White brick slid to column 3.');
    expect(moveLine('red', 'row', 0)).toBe('Red brick slid to row 1.');
  });

  it('says when a brick is out', () => {
    expect(exitLine('white')).toBe('White brick is out.');
  });

  it('after a drag, names the one line that changed, or both when it went round a corner', () => {
    expect(slidLine('white', [0, 0], [0, 2])).toBe('White brick slid to column 3.');
    expect(slidLine('white', [3, 1], [1, 1])).toBe('White brick slid to row 2.');
    expect(slidLine('white', [0, 0], [1, 2])).toBe('White brick slid to row 2, column 3.');
  });
});

describe('every name and line', () => {
  it('has no em or en dashes', () => {
    const all = [
      ...lvl.blocks.map((b, i) => brickLabel(b, start.pos[i]!)),
      ...wide.blocks.map((b) => brickLabel(b, [0, 0])),
      ...lvl.gates.map((g) => doorLabel(lvl, g, start)),
      doorLabel(lvl, { side: 'right', at: 0, len: 1, color: 'red', lock: 3 }, start),
      doorLabel(lvl, { side: 'right', at: 0, len: 1, color: 'red', lockColor: 'white' }, start),
      moveLine('pink', 'row', 5),
      exitLine('teal'),
      slidLine('purple', [0, 0], [3, 3]),
    ];
    for (const line of all) expect(line, line).not.toMatch(DASHES);
  });
});

describe('on every board the game plays', () => {
  it('no two bricks and no two doors share a name, every name says where it is, and none has a dash', () => {
    let boards = 0;
    PUZZLE_LEVELS.forEach((level, li) =>
      level.puzzles.forEach((board, pi) => {
        const where = `Level ${li + 1}, board ${pi}`;
        const s = initialState(board);
        const bricks = board.blocks.map((b, i) => brickLabel(b, s.pos[i]!));
        const doors = board.gates.map((g) => doorLabel(board, g, s));
        expect(new Set(bricks).size, where).toBe(bricks.length);
        expect(new Set(doors).size, where).toBe(doors.length);
        for (const name of bricks) expect(name, where).toMatch(/^[A-Z][a-z]+ brick, .+, rows? \d+( to \d+)?, columns? \d+( to \d+)?$/);
        for (const name of doors) expect(name, where).toMatch(/^[A-Z][a-z]+ door, (top|bottom|left|right) side, (rows?|columns?) \d+( to \d+)?(, melts .+)?$/);
        for (const name of [...bricks, ...doors]) expect(name, where).not.toMatch(DASHES);
        boards++;
      }),
    );
    expect(boards).toBeGreaterThan(100);
  });

  it('a door iced by a count and by a colour says the count first, then the colour', () => {
    const l = fromSpec({ map: ['A.', 'B.', 'C.'], colors: { A: 'red', B: 'blue', C: 'green' }, gates: [{ side: 'right', at: 0, len: 1, color: 'red', lock: 1, lockColor: 'blue' }] }, 5);
    const s = initialState(l);
    expect(doorLabel(l, l.gates[0], s)).toBe('Frozen door, right side, row 1, melts after 1 more brick leaves');
    const green = withMove(s, 2, null);
    expect(doorLabel(l, l.gates[0], green)).toBe('Frozen door, right side, row 1, melts when every blue brick is out');
    expect(doorLabel(l, l.gates[0], withMove(green, 1, null))).toBe('Red door, right side, row 1');
  });
});
