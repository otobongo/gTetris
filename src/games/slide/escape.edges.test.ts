import { describe, expect, it } from 'vitest';
import {
  designProblems,
  exitGate,
  fromSpec,
  initialState,
  isLocked,
  isSolved,
  occupancy,
  reachable,
  starsFor,
  validate,
  withMove,
  type GateDef,
  type Level,
} from './engine';
import { LEVELS } from './levels';
import { meta } from './meta';
import { solve } from './solver';

const chapter = (title: string) => {
  const c = meta.chapters.find((x) => x.title === title)!;
  return LEVELS.slice(c.start, c.start + c.count);
};

/** Plays a solution move by move through the same rules the board uses. */
function replay(level: Level, moves: { block: number; to: readonly [number, number] | null }[]) {
  let s = initialState(level);
  for (const m of moves) {
    const reach = reachable(level, s, m.block);
    if (m.to === null) expect(reach.exit, `level ${level.id}: brick ${m.block} can leave`).not.toBeNull();
    else expect(reach.spots.has(`${m.to[0]},${m.to[1]}`), `level ${level.id}: brick ${m.block} can reach ${m.to}`).toBe(true);
    s = withMove(s, m.block, m.to);
  }
  return s;
}

describe('Brick Escape level set', () => {
  it('has 31 levels numbered 1 to 31, in chapters of 8, 5, 6, 6, 5 and 1', () => {
    expect(LEVELS.map((l) => l.id)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
    expect(meta.chapters.map((c) => c.count)).toEqual([8, 5, 6, 6, 5, 1]);
    expect(meta.chapters.filter((c) => c.more).map((c) => c.title)).toEqual(['Master']);
  });

  it('never asks for fewer moves than there are bricks, since every brick has to leave', () => {
    for (const l of LEVELS) expect(l.par, `level ${l.id}`).toBeGreaterThanOrEqual(l.blocks.length);
  });

  it('gives a bigger board at least as much clock time as a smaller one', () => {
    const area = (l: Level) => l.rows * l.cols;
    for (const a of LEVELS) for (const b of LEVELS) if (area(a) > area(b)) expect(a.base!, `level ${a.id} vs ${b.id}`).toBeGreaterThanOrEqual(b.base!);
  });

  it('teaches one idea per chapter: icy doors in Icy doors, stones or shaped trays in the chapter after', () => {
    for (const l of chapter('Icy doors')) expect(l.gates.some((g) => g.lock || g.lockColor), `level ${l.id}`).toBe(true);
    for (const l of chapter('[PLACEHOLDER: chapter name]')) expect(Boolean(l.stone) || l.void.flat().some(Boolean), `level ${l.id}`).toBe(true);
  });

  it('brings in grey stones only once their chapter starts', () => {
    const first = meta.chapters.find((c) => c.title === '[PLACEHOLDER: chapter name]')!.start;
    for (const l of LEVELS.slice(0, first)) expect(l.stone, `level ${l.id}`).toBeUndefined();
  });

  it('starts on small 4 x 4 boards and never goes past 8 x 8', () => {
    for (const l of LEVELS.slice(0, 4)) expect([l.rows, l.cols], `level ${l.id}`).toEqual([4, 4]);
    for (const l of LEVELS) expect(Math.max(l.rows, l.cols), `level ${l.id}`).toBeLessThanOrEqual(8);
  });

  it('can never ask a door to wait for more bricks than can leave before it', () => {
    for (const l of LEVELS) {
      for (const g of l.gates) {
        const others = l.blocks.filter((b) => b.color !== g.color).length;
        if (g.lock) expect(g.lock, `level ${l.id} ${g.color} door`).toBeLessThanOrEqual(others);
      }
    }
  });

  it('has solutions that the board itself would accept, move by move (Getting started and Icy doors)', () => {
    for (const l of [...chapter('Getting started'), ...chapter('Icy doors')]) {
      const sol = solve(l, initialState(l), 2_000_000)!;
      expect(isSolved(replay(l, sol.moves)), `level ${l.id}`).toBe(true);
    }
  }, 60_000);
});

describe('Brick Escape rules: doors and locks', () => {
  const lvl = fromSpec(
    {
      map: ['A.', 'B.', 'C.'],
      colors: { A: 'red', B: 'blue', C: 'green' },
      gates: [
        { side: 'right', at: 0, len: 1, color: 'red', lock: 1, lockColor: 'blue' },
        { side: 'bottom', at: 1, len: 1, color: 'blue' },
        { side: 'left', at: 2, len: 1, color: 'green' },
      ],
    },
    1,
  );

  it('keeps a door with both a count and a colour lock shut until both are met', () => {
    const red = lvl.gates[0];
    const s = initialState(lvl);
    const greenOut = withMove(s, 2, null); // one brick out, but blue is still on the board
    expect(isLocked(red, greenOut, lvl)).toBe(true);
    const blueOut = withMove(s, 1, null); // blue out, and that is one brick
    expect(isLocked(red, blueOut, lvl)).toBe(false);
  });

  it('checks only the count lock when it is not told which level it is on', () => {
    const red = lvl.gates[0];
    expect(isLocked(red, withMove(initialState(lvl), 2, null))).toBe(false);
    expect(isLocked(red, initialState(lvl))).toBe(true);
  });

  it('never lets a brick out through a door of another colour', () => {
    const s = initialState(lvl);
    const occ = occupancy(lvl, s);
    // green starts on the left edge right at its own door
    expect(exitGate(lvl, occ, s, 2, 2, 0)).toBe(2);
    // red touching its door on the right still waits: the door is iced
    expect(exitGate(lvl, occ, s, 0, 0, 1)).toBe(-1);
    const wrong = fromSpec({ map: ['A.'], colors: { A: 'red' }, gates: [{ side: 'right', at: 0, len: 1, color: 'blue' }] }, 1);
    const ws = initialState(wrong);
    expect(exitGate(wrong, occupancy(wrong, ws), ws, 0, 0, 1)).toBe(-1);
  });

  it('gives a brick that has already left nowhere to go', () => {
    const out = withMove(initialState(lvl), 2, null);
    expect(reachable(lvl, out, 2)).toEqual({ spots: new Map(), exit: null });
  });
});

describe('Brick Escape rules: building and checking a level', () => {
  it('stops with a clear message when a brick letter has no colour', () => {
    expect(() => fromSpec({ map: ['AB'], colors: { A: 'red' }, gates: [] }, 1)).toThrow('No color for brick B');
  });

  it('pads short map rows with tray gaps', () => {
    const l = fromSpec({ map: ['A..', 'B'], colors: { A: 'red', B: 'red' }, gates: [{ side: 'right', at: 0, len: 1, color: 'red' }] }, 1);
    expect(l.cols).toBe(3);
    expect(l.void[1]).toEqual([false, true, true]);
    expect(l.stone).toBeUndefined();
  });

  it('flags a brick off the tray, on a stone, or on top of another brick', () => {
    const base = fromSpec({ map: ['#AB*'], colors: { A: 'red', B: 'red' }, gates: [{ side: 'right', at: 0, len: 1, color: 'red' }] }, 1);
    const moved = (i: number, c: number): Level => ({ ...base, blocks: base.blocks.map((b, j) => (j === i ? { ...b, c } : b)) });
    expect(validate(moved(0, 0))).toContain('brick 0 off tray');
    expect(validate(moved(1, 3))).toContain('brick 1 sits on a stone');
    expect(validate(moved(1, 1))).toContain('brick 1 overlaps');
  });

  it('flags a door past the edge, two doors on the same cells, and a door along an uneven edge', () => {
    const map = ['A..', '...', '...'];
    const red = (g: Partial<GateDef>): GateDef => ({ side: 'right', at: 0, len: 1, color: 'red', ...g });
    expect(validate(fromSpec({ map, colors: { A: 'red' }, gates: [red({ at: 2, len: 2 })] }, 1))).toContain('gate 0 out of range');
    expect(validate(fromSpec({ map, colors: { A: 'red' }, gates: [red({ at: -1 })] }, 1))).toContain('gate 0 out of range');
    expect(validate(fromSpec({ map, colors: { A: 'red', B: 'blue' }, gates: [red({ len: 2 }), red({ at: 1, color: 'blue' })] }, 1))).toContain(
      'gate 1 overlaps another gate',
    );
    const notched = fromSpec({ map: ['#A.', '...'], colors: { A: 'red' }, gates: [{ side: 'top', at: 0, len: 2, color: 'red' }] }, 1);
    expect(validate(notched)).toContain('gate 0 spans an uneven edge');
  });

  it('flags a brick whose colour has no door', () => {
    const l = fromSpec({ map: ['AB'], colors: { A: 'red', B: 'blue' }, gates: [{ side: 'left', at: 0, len: 1, color: 'red' }] }, 1);
    expect(validate(l)).toContain('brick 1 has no blue gate');
  });

  it('flags a door that no brick uses', () => {
    const l = fromSpec({ map: ['A.'], colors: { A: 'red' }, gates: [{ side: 'right', at: 0, len: 1, color: 'red' }, { side: 'left', at: 0, len: 1, color: 'green' }] }, 1);
    expect(designProblems(l)).toContain('door 1 is 1 long but its bricks need 0');
  });

  it('still checks door length on advanced levels, where a door may sit mid-edge', () => {
    const l = fromSpec({ map: ['...', 'AA.', '...'], colors: { A: 'red' }, gates: [{ side: 'left', at: 1, len: 2, color: 'red' }], advanced: true }, 1);
    expect(designProblems(l)).toEqual(['door 0 is 2 long but its bricks need 1']);
  });
});

describe('Brick Escape solver and stars', () => {
  it('needs no moves for a board that is already clear', () => {
    const l = fromSpec({ map: ['A.'], colors: { A: 'red' }, gates: [{ side: 'right', at: 0, len: 1, color: 'red' }] }, 1);
    expect(solve(l, withMove(initialState(l), 0, null))).toEqual({ moves: [], explored: 0 });
  });

  it('gives up and says so when the search runs past its limit', () => {
    const hard = LEVELS[LEVELS.length - 2];
    expect(solve(hard, initialState(hard), 3)).toBeNull();
  });

  it('never gives fewer than 1 star or more than 3', () => {
    for (const moves of [0, 1, 5, 10, 13, 14, 100, 10_000]) {
      for (const hint of [false, true]) {
        for (const late of [false, true]) {
          const s = starsFor(moves, 10, hint, late);
          expect(s).toBeGreaterThanOrEqual(1);
          expect(s).toBeLessThanOrEqual(hint || late ? 2 : 3);
        }
      }
    }
  });

  it('caps at 2 with a hint and the clock run out together, not at 1', () => {
    expect(starsFor(10, 10, true, true)).toBe(2);
    expect(starsFor(13, 10, true, true)).toBe(2);
    expect(starsFor(14, 10, true, true)).toBe(1);
  });
});

describe('Brick Escape: review additions', () => {
  it('points the fallback hint at a brick that can move, on the opening board of every level', () => {
    // The hint first runs a short live search; on the Big bricks levels that search gives up on the
    // opening board, so the first brick of the stored order (still on the board) is what lights up.
    for (const l of LEVELS) {
      const s = initialState(l);
      const hinted = (l.order ?? l.blocks.map((_, i) => i)).find((i) => s.pos[i] !== null)!;
      const reach = reachable(l, s, hinted);
      expect(reach.exit !== null || reach.spots.size > 0, `level ${l.id}: brick ${hinted}`).toBe(true);
    }
  });

  it('keeps a brick in when part of it is shadowed by another brick on the way to its door', () => {
    // A is an L: its top row touches the right-hand door, but the cell below is behind B.
    const lvl = fromSpec(
      {
        map: ['AA', 'AB'],
        colors: { A: 'red', B: 'blue' },
        gates: [
          { side: 'right', at: 0, len: 2, color: 'red' },
          { side: 'bottom', at: 1, len: 1, color: 'blue' },
        ],
      },
      1,
    );
    const s = initialState(lvl);
    expect(exitGate(lvl, occupancy(lvl, s), s, 0, 0, 0)).toBe(-1);
    expect(reachable(lvl, s, 0).exit).toBeNull();
    const bOut = withMove(s, 1, null);
    expect(exitGate(lvl, occupancy(lvl, bOut), bOut, 0, 0, 0)).toBe(0);
    expect(solve(lvl, s)!.moves).toEqual([
      { block: 1, to: null },
      { block: 0, to: null },
    ]);
  });

  it('keeps a brick in that sits half across its door, and lets it out once it lines up', () => {
    const lvl = fromSpec({ map: ['A.', 'A.', '..'], colors: { A: 'red' }, gates: [{ side: 'right', at: 1, len: 2, color: 'red' }], advanced: true }, 1);
    const s = initialState(lvl);
    const occ = occupancy(lvl, s);
    expect(exitGate(lvl, occ, s, 0, 0, 1)).toBe(-1); // rows 0 and 1: only row 1 is inside the door
    expect(exitGate(lvl, occ, s, 0, 1, 1)).toBe(0); // rows 1 and 2
    expect(solve(lvl, s)!.moves).toHaveLength(1);
  });
});
