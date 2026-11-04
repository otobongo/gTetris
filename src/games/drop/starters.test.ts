import { describe, expect, it } from 'vitest';
import { CLEAR_MS, ghostY, hardDrop, step, withBoard } from './engine';
import { PIECES, shapeOf, type Cell } from './pieces';
import { puzzleGame } from './puzzles';
import { STAGES, newPieces } from './stages';
import { STACK_COLORS, STARTER_CUT, holeBricks, starterBoard, starterFor, starterHoles, starterRows, starterSeed, type Starter } from './starters';

const ALL: Starter[] = STAGES.flatMap((_, i) => Array.from({ length: 6 }, (_, p) => starterFor(i, p)));
const key = (cells: readonly Cell[]) => cells.map(([x, y]) => `${x},${y}`).sort().join(' ');
const norm = (cells: readonly Cell[]) => {
  const mx = Math.min(...cells.map((c) => c[0]));
  const my = Math.min(...cells.map((c) => c[1]));
  return key(cells.map(([x, y]) => [x - mx, y - my] as const));
};

describe('Brick Drop starter stacks: the rules of brief 4.2', () => {
  it('has 6 stacks for each of the 12 stages, 72 in all', () => {
    expect(ALL).toHaveLength(72);
    STAGES.forEach((_, i) => expect(new Set(ALL.filter((s) => s.stage === i).map((s) => s.puzzle))).toEqual(new Set([0, 1, 2, 3, 4, 5])));
  });

  it('builds 2 rows with 2 holes on Stages 1 to 3, and 3 rows with 3 holes from Stage 4', () => {
    for (const s of ALL) {
      expect(s.rows, `stage ${s.stage + 1}`).toBe(s.stage < 3 ? 2 : 3);
      expect(s.holes, `stage ${s.stage + 1}`).toHaveLength(s.stage < 3 ? 2 : 3);
      expect(starterRows(s.stage)).toBe(s.rows);
      expect(starterHoles(s.stage)).toBe(s.holes.length);
    }
  });

  it('puts the stack at the bottom of the board and leaves every row above it empty', () => {
    for (const s of ALL) {
      const stage = STAGES[s.stage];
      expect(s.board).toHaveLength(stage.rows);
      s.board.forEach((row, y) => {
        expect(row).toHaveLength(stage.cols);
        if (y < stage.rows - s.rows) expect(row.every((c) => c === null), `stage ${s.stage + 1} row ${y}`).toBe(true);
      });
    }
  });

  it('cuts holes in the exact shape of one of the stage’s bricks, in some turn', () => {
    for (const s of ALL) {
      for (const h of s.holes) {
        expect(STAGES[s.stage].pieces, `stage ${s.stage + 1}`).toContain(h.piece);
        expect(norm(h.cells)).toBe(norm(shapeOf(h.piece, h.rot)));
        expect(h.cells).toHaveLength(PIECES[h.piece].cells.length);
      }
    }
  });

  it('leaves exactly the hole cells open inside the stack, filled with the brick palette by column', () => {
    for (const s of ALL) {
      const stage = STAGES[s.stage];
      const top = stage.rows - s.rows;
      const open = new Set(s.holes.flatMap((h) => h.cells.filter(([, y]) => y >= 0).map(([x, y]) => `${x},${y}`)));
      let filled = 0;
      for (let y = 0; y < s.rows; y++)
        for (let x = 0; x < stage.cols; x++) {
          const c = s.board[top + y][x];
          if (open.has(`${x},${y}`)) expect(c).toBeNull();
          else {
            expect(c).toBe(STACK_COLORS[x % STACK_COLORS.length]);
            filled++;
          }
        }
      expect(s.filled).toBe(filled);
      expect(s.cut).toBe(s.rows * stage.cols - filled);
    }
  });

  it('lets each brick drop straight in: every stack cell above a hole cell belongs to the same hole', () => {
    for (const s of ALL) {
      for (const h of s.holes) {
        const mine = new Set(h.cells.map(([x, y]) => `${x},${y}`));
        for (const [x, y] of h.cells) for (let above = 0; above < y; above++) expect(mine.has(`${x},${above}`), `stage ${s.stage + 1} hole ${h.piece}`).toBe(true);
      }
    }
  });

  it('never lets two holes touch along a side', () => {
    for (const s of ALL) {
      s.holes.forEach((a, i) =>
        s.holes.slice(i + 1).forEach((b) => {
          for (const [ax, ay] of a.cells) for (const [bx, by] of b.cells) expect(Math.abs(ax - bx) + Math.abs(ay - by), `stage ${s.stage + 1}`).toBeGreaterThan(1);
        }),
      );
    }
  });

  it('gives every stack row a hole cell, so no row starts complete', () => {
    for (const s of ALL) {
      const top = STAGES[s.stage].rows - s.rows;
      for (let y = top; y < STAGES[s.stage].rows; y++) expect(s.board[y].some((c) => c === null), `stage ${s.stage + 1} row ${y}`).toBe(true);
    }
  });

  it('includes a hole for a brick the stage adds, and Stage 7’s Zig or Zag on Stages 8 and 9', () => {
    for (const s of ALL) {
      const want = holeBricks(s.stage);
      expect(s.holes.some((h) => want.includes(h.piece)), `stage ${s.stage + 1} puzzle ${s.puzzle + 1}`).toBe(true);
    }
    expect(newPieces(7)).toEqual([]);
    expect(newPieces(8)).toEqual([]);
    expect(holeBricks(7)).toEqual(['zig', 'zag']);
    expect(holeBricks(8)).toEqual(['zig', 'zag']);
    expect(holeBricks(9)).toEqual(['flag']);
  });

  it('cuts the same number of cells from all 6 stacks of a stage', () => {
    STAGES.forEach((_, i) => {
      const cuts = new Set(ALL.filter((s) => s.stage === i).map((s) => s.cut));
      expect([...cuts], `stage ${i + 1}`).toEqual([STARTER_CUT[i]]);
    });
  });

  it('gives the 6 stacks of a stage different holes and a different brick order', () => {
    STAGES.forEach((_, i) => {
      const mine = ALL.filter((s) => s.stage === i);
      expect(new Set(mine.map((s) => key(s.holes.flatMap((h) => h.cells)))).size, `stage ${i + 1} layouts`).toBe(6);
      const orders = mine.map((s) => {
        const g = puzzleGame(i, s.puzzle);
        return [g.active!.id, ...g.queue].join(' ');
      });
      expect(new Set(orders).size, `stage ${i + 1} brick orders`).toBe(6);
    });
  });

  it('only Zig and Zag rise one cell above the stack (they fit a step, never a flat hole)', () => {
    for (const s of ALL)
      for (const h of s.holes) {
        const air = h.cells.filter(([, y]) => y < 0);
        if (h.piece === 'zig' || h.piece === 'zag') expect(air).toHaveLength(1);
        else expect(air, `${h.piece} on stage ${s.stage + 1}`).toHaveLength(0);
      }
  });

  it('is seeded with 1000 x stage + puzzle, so the same puzzle always gives the same stack and bricks', () => {
    for (const s of ALL) expect(s.seed).toBe(starterSeed(s.stage, s.puzzle));
    expect(starterSeed(0, 0)).toBe(1000);
    expect(starterSeed(11, 5)).toBe(12005);
    const a = puzzleGame(6, 3);
    const b = puzzleGame(6, 3);
    expect(b.board).toEqual(a.board);
    expect([b.active!.id, ...b.queue]).toEqual([a.active!.id, ...a.queue]);
  });

  it('hands the engine a copy of the board, so playing never changes the stored stack', () => {
    const s = starterFor(3, 2);
    const copy = starterBoard(s);
    copy[copy.length - 1][0] = 'black';
    expect(starterFor(3, 2).board[copy.length - 1][0]).not.toBe('black');
  });

  it('rejects a stage that does not exist and keeps puzzle numbers inside 0 to 5', () => {
    expect(() => starterFor(12, 0)).toThrow(RangeError);
    expect(() => starterFor(-1, 0)).toThrow(RangeError);
    expect(starterFor(0, 9)).toBe(starterFor(0, 5));
    expect(starterFor(0, -2)).toBe(starterFor(0, 0));
  });
});

describe('every hole’s brick comes in the puzzle’s first bag', () => {
  it('holds for all 72 puzzles', () => {
    for (const s of ALL) {
      const kinds = STAGES[s.stage].pieces;
      const bag = Math.max(1, Math.ceil(6 / kinds.length)) * kinds.length;
      const g = puzzleGame(s.stage, s.puzzle);
      const first = [g.active!.id, ...g.queue].slice(0, bag);
      for (const h of s.holes) expect(first, `stage ${s.stage + 1} puzzle ${s.puzzle + 1}`).toContain(h.piece);
    }
  });
});

describe('dropping each hole’s brick into it clears the stack', () => {
  it('lands every brick exactly in its hole and clears every stack row, for all 72 puzzles', () => {
    for (const s of ALL) {
      const stage = STAGES[s.stage];
      const top = stage.rows - s.rows;
      const where = `stage ${s.stage + 1} puzzle ${s.puzzle + 1}`;
      let g = puzzleGame(s.stage, s.puzzle);
      // each hole's cells on the board, kept in step with the rows the engine removes
      let holes = s.holes.map((h) => h.cells.map(([x, y]) => [x, y + top] as const));
      for (let i = 0; i < s.holes.length; i++) {
        const { piece, rot } = s.holes[i];
        const shape = shapeOf(piece, rot);
        const x = Math.min(...holes[i].map((c) => c[0])) - Math.min(...shape.map((c) => c[0]));
        const y = Math.min(...holes[i].map((c) => c[1])) - Math.min(...shape.map((c) => c[1]));
        // start above the board and fall straight down: it must land exactly in the hole
        const falling = withBoard(g, g.board, { id: piece, rot, x, y: y - stage.rows });
        expect(ghostY(falling.board, falling.active!), `${where} hole ${i + 1}`).toBe(y);
        let next = hardDrop(falling);
        const cleared = next.clearing.slice();
        while (next.status === 'clearing') next = step(next, CLEAR_MS);
        expect(next.status, where).toBe('playing');
        g = next;
        holes = holes.map((cells) => cells.map(([cx, cy]) => [cx, cy + cleared.filter((r) => r > cy).length] as const));
      }
      expect(g.lines, where).toBe(s.rows);
      // only the cell a Zig or Zag left above the stack can remain
      const left = g.board.flat().filter((c) => c !== null).length;
      expect(left, where).toBe(s.holes.filter((h) => h.cells.some(([, cy]) => cy < 0)).length);
    }
  });
});
