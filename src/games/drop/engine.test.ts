import { describe, expect, it } from 'vitest';
import {
  CLEAR_MS,
  collides,
  emptyBoard,
  fullRows,
  ghostY,
  hardDrop,
  hold,
  move,
  newGame,
  removeRows,
  rotate,
  softDrop,
  spawnPosition,
  step,
  withBoard,
  type Board,
  type GameState,
  type Rules,
} from './engine';
import { PIECES, PIECE_IDS, boundsOf, shapeOf, type PieceId } from './pieces';
import { STAGES, averageCells, newPieces, starRule, starsEarned } from './stages';

const rules = (over: Partial<Rules> = {}): Rules => ({
  cols: 10,
  rows: 18,
  pieces: ['tee'],
  goalRows: 3,
  gravityMs: 1000,
  lockDelayMs: 500,
  ...over,
});

/** Board from strings: '#' filled, '.' empty. */
function board(lines: string[]): Board {
  return lines.map((l) => [...l].map((ch) => (ch === '#' ? 'black' : null)));
}

function game(over: Partial<Rules> = {}, seed = 1): GameState {
  return newGame(rules(over), seed);
}

describe('pieces', () => {
  it('every piece is a connected shape inside its rotation box', () => {
    for (const id of PIECE_IDS) {
      const { cells, box } = PIECES[id];
      for (const [x, y] of cells) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(box);
        expect(y).toBeLessThan(box);
      }
      const key = (x: number, y: number) => `${x},${y}`;
      const all = new Set(cells.map(([x, y]) => key(x, y)));
      expect(all.size).toBe(cells.length);
      const seen = new Set([key(...cells[0])]);
      const stack = [cells[0]];
      while (stack.length) {
        const [x, y] = stack.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = key(x + dx, y + dy);
          if (all.has(k) && !seen.has(k)) {
            seen.add(k);
            stack.push([x + dx, y + dy]);
          }
        }
      }
      expect(seen.size, id).toBe(cells.length);
    }
  });

  it('four turns bring a shape back to where it started', () => {
    for (const id of PIECE_IDS) {
      expect(shapeOf(id, 4)).toEqual(shapeOf(id, 0));
      expect(shapeOf(id, -1)).toEqual(shapeOf(id, 3));
      expect(shapeOf(id, 1)).toHaveLength(PIECES[id].cells.length);
    }
  });
});

describe('collision', () => {
  const tee = shapeOf('tee', 0);
  it('blocks walls and floor but allows space above the top', () => {
    const b = emptyBoard(10, 18);
    expect(collides(b, tee, 0, 0)).toBe(false);
    expect(collides(b, tee, -1, 0)).toBe(true);
    expect(collides(b, tee, 8, 0)).toBe(true);
    expect(collides(b, tee, 7, 16)).toBe(false);
    expect(collides(b, tee, 7, 17)).toBe(true);
    expect(collides(b, tee, 3, -1)).toBe(false);
  });

  it('blocks settled bricks', () => {
    const b = emptyBoard(10, 18);
    b[5][4] = 'red';
    expect(collides(b, tee, 3, 4)).toBe(true); // cell (1,1) lands on (4,5)
    expect(collides(b, tee, 3, 3)).toBe(false);
  });

  it('moving into a wall bumps and keeps the brick in place', () => {
    let g = game();
    for (let i = 0; i < 20; i++) g = move(g, -1);
    expect(g.events).toEqual(['bump']);
    const minX = Math.min(...shapeOf('tee', 0).map((c) => c[0] + g.active!.x));
    expect(minX).toBe(0);
  });
});

describe('rotation and kicks', () => {
  it('rotates in place in open space', () => {
    const g = rotate(game(), 1);
    expect(g.active!.rot).toBe(1);
    expect(g.events).toEqual(['rotate']);
  });

  it('kicks away from the wall when a turn would poke out', () => {
    // Long stick vertical against the right wall, then turned flat.
    let g = game({ pieces: ['long'] });
    g = rotate(g, 1); // vertical, cells in column 2 of its box
    for (let i = 0; i < 10; i++) g = move(g, 1);
    const before = g.active!;
    const cellsX = shapeOf('long', 1).map((c) => c[0] + before.x);
    expect(Math.max(...cellsX)).toBe(9);
    g = rotate(g, 1);
    expect(g.events).toEqual(['rotate']);
    expect(g.active!.rot).toBe(2);
    expect(g.active!.x).toBeLessThan(before.x); // kicked left
    expect(collides(g.board, shapeOf('long', 2), g.active!.x, g.active!.y)).toBe(false);
  });

  it('kicks up off the floor', () => {
    let g = game({ pieces: ['long'] });
    g = { ...g, active: { ...g.active!, y: 16 } }; // flat stick on bottom row (cells at y+1 = 17)
    g = rotate(g, 1);
    expect(g.events).toEqual(['rotate']);
    expect(g.active!.y).toBeLessThan(16);
  });

  it('refuses a turn with nowhere to go', () => {
    // A tee-shaped hole and nothing else: no turn or kick can fit.
    const b = board([
      ...Array(15).fill('##########'),
      '####.#####',
      '###...####',
      '##########',
    ]);
    let g = withBoard(game(), b, { id: 'tee', rot: 0, x: 3, y: 15 });
    expect(collides(b, shapeOf('tee', 0), 3, 15)).toBe(false);
    g = rotate(g, 1);
    expect(g.events).toEqual(['bump']);
    expect(rotate(g, -1).events).toEqual(['bump']);
    expect(g.active!.rot).toBe(0);
  });
});

describe('line clearing', () => {
  it('finds and removes full rows, shifting the rest down', () => {
    const b = board(['#.........', '##########', '.#........', '##########']);
    expect(fullRows(b)).toEqual([1, 3]);
    const after = removeRows(b, [1, 3]);
    expect(after).toHaveLength(4);
    expect(after[0].every((c) => c === null)).toBe(true);
    expect(after[1].every((c) => c === null)).toBe(true);
    expect(after[2][0]).toBe('black');
    expect(after[3][1]).toBe('black');
  });

  it('a hard drop that fills a row flashes it, then clears and counts it', () => {
    const rows = Array(17).fill('..........');
    let g = game({ pieces: ['long'] });
    g = withBoard(g, board([...rows, '####....##']), { id: 'long', rot: 0, x: 4, y: 0 });
    expect(ghostY(g.board, g.active!)).toBe(16);
    g = hardDrop(g);
    expect(g.status).toBe('clearing');
    expect(g.clearing).toEqual([17]);
    expect(g.lines).toBe(1);
    expect(g.events).toContain('clear');
    expect(g.score).toBeGreaterThanOrEqual(100);
    g = step(g, CLEAR_MS + 1);
    expect(g.status).toBe('playing');
    expect(g.board[17].every((c) => c === null)).toBe(true);
    expect(g.placed).toBe(1);
  });

  it('reaching the goal wins the stage', () => {
    let g = game({ pieces: ['long'], goalRows: 1 });
    g = withBoard(g, board([...Array(17).fill('..........'), '###....###']), { id: 'long', rot: 0, x: 3, y: 0 });
    g = step(hardDrop(g), CLEAR_MS + 1);
    expect(g.status).toBe('won');
    expect(g.events).toEqual(['win']);
  });
});

describe('gravity and lock delay', () => {
  it('falls one row per gravity tick', () => {
    let g = game({ gravityMs: 500 });
    const y0 = g.active!.y;
    g = step(g, 499);
    expect(g.active!.y).toBe(y0);
    g = step(g, 2);
    expect(g.active!.y).toBe(y0 + 1);
  });

  it('waits for the lock delay on the ground, and moving resets it', () => {
    let g = game({ lockDelayMs: 500 });
    g = { ...g, active: { ...g.active!, y: ghostY(g.board, g.active!) } };
    g = step(g, 400);
    expect(g.placed).toBe(0);
    g = move(g, 1); // slide resets the timer
    g = step(g, 400);
    expect(g.placed).toBe(0);
    g = step(g, 200);
    expect(g.placed).toBe(1);
  });

  it('soft drop moves down and scores a point', () => {
    const g0 = game();
    const g = softDrop(g0);
    expect(g.active!.y).toBe(g0.active!.y + 1);
    expect(g.score).toBe(1);
  });
});

describe('hold and preview', () => {
  it('holds once per brick and swaps on the next one', () => {
    let g = game({ pieces: ['tee', 'square', 'long'] });
    const first = g.active!.id;
    const nextUp = g.queue[0];
    g = hold(g);
    expect(g.hold).toBe(first);
    expect(g.active!.id).toBe(nextUp);
    const again = hold(g);
    expect(again).toBe(g); // already used
    g = hardDrop(g);
    const cur = g.active!.id;
    g = hold(g);
    expect(g.active!.id).toBe(first);
    expect(g.hold).toBe(cur);
  });

  it('bag randomizer deals every kind evenly', () => {
    const kinds: PieceId[] = ['dot', 'pair', 'stick3'];
    let g = newGame(rules({ pieces: kinds, rows: 40 }), 42);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 12; i++) {
      counts[g.active!.id] = (counts[g.active!.id] ?? 0) + 1;
      g = { ...g, board: emptyBoard(10, 40) };
      g = hardDrop(g);
    }
    expect(counts).toEqual({ dot: 4, pair: 4, stick3: 4 });
    expect(g.queue.length).toBeGreaterThanOrEqual(3);
  });
});

describe('game over', () => {
  it('ends when a new brick cannot appear', () => {
    let g = game({ pieces: ['square'] });
    const b = emptyBoard(10, 18);
    for (let y = 2; y < 18; y++) for (let x = 0; x < 10; x++) b[y][x] = x === 0 ? null : 'black';
    // Stack fills everything but column 0, reaching row 2; the next square lands on top and the following one has no room.
    g = withBoard(g, b, spawnPosition('square', 10));
    g = hardDrop(g); // lands on rows 0-1
    expect(g.status).toBe('over');
    expect(g.events).toContain('over');
  });

  it('ignores input once over', () => {
    let g = game({ pieces: ['square'] });
    g = { ...g, status: 'over' };
    expect(move(g, 1)).toBe(g);
    expect(rotate(g)).toBe(g);
    expect(hardDrop(g)).toBe(g);
    expect(hold(g)).toBe(g);
    expect(step(g, 1000)).toBe(g);
  });
});

describe('stages', () => {
  it('has about a dozen stages with valid piece sets', () => {
    expect(STAGES.length).toBe(12);
    const colors = new Set(['red', 'yellow', 'green', 'blue', 'purple', 'orange', 'pink', 'teal', 'white', 'black']);
    STAGES.forEach((s, i) => {
      expect(s.pieces.length, s.name).toBeGreaterThan(0);
      expect(new Set(s.pieces).size, `${s.name} duplicate`).toBe(s.pieces.length);
      for (const id of s.pieces) {
        expect(PIECES[id], `${s.name}: ${id}`).toBeDefined();
        expect(colors.has(PIECES[id].color)).toBe(true);
        // every orientation fits across the board, and spawns inside it
        for (let r = 0; r < 4; r++) expect(boundsOf(shapeOf(id, r)).w).toBeLessThanOrEqual(s.cols);
        const sp = spawnPosition(id, s.cols);
        expect(collides(emptyBoard(s.cols, s.rows), shapeOf(id, 0), sp.x, sp.y)).toBe(false);
      }
      // each kind in a stage has its own brick color
      const used = s.pieces.map((id) => PIECES[id].color);
      expect(new Set(used).size, `${s.name} colors`).toBe(used.length);
      expect(s.goalRows).toBeGreaterThan(0);
      expect(s.goalRows).toBeLessThan(s.rows * 3);
      expect(s.lockDelayMs).toBeGreaterThanOrEqual(500);
      if (i > 0) {
        const prev = STAGES[i - 1];
        expect(s.cols * s.rows, `${s.name} board`).toBeGreaterThanOrEqual(prev.cols * prev.rows);
        expect(s.goalRows).toBeGreaterThanOrEqual(prev.goalRows);
      }
    });
  });

  it('goes from small bricks to big ones', () => {
    const maxCells = (i: number) => Math.max(...STAGES[i].pieces.map((id) => PIECES[id].cells.length));
    expect(maxCells(0)).toBeLessThanOrEqual(2);
    expect(maxCells(2)).toBeLessThanOrEqual(3);
    expect(maxCells(6)).toBe(4);
    expect(maxCells(STAGES.length - 1)).toBe(5);
    expect(STAGES[0].cols).toBeLessThan(STAGES[6].cols);
    expect(STAGES[STAGES.length - 1].gravityMs).toBeLessThan(STAGES[0].gravityMs);
    expect(newPieces(0)).toEqual(['dot', 'pair']);
    expect(STAGES.filter((s) => s.speedy).length).toBeGreaterThan(0);
  });

  it('star rule rewards fewer bricks and always gives at least one', () => {
    for (const s of STAGES) {
      const { three, two } = starRule(s);
      const ideal = (s.goalRows * s.cols) / averageCells(s);
      expect(three).toBeGreaterThan(ideal);
      expect(two).toBeGreaterThan(three);
      expect(starsEarned(s, three)).toBe(3);
      expect(starsEarned(s, three + 1)).toBe(2);
      expect(starsEarned(s, two + 1)).toBe(1);
    }
  });
});
