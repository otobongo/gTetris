import { describe, expect, it } from 'vitest';
import { designProblems, exitGate, fromSpec, initialState, isLocked, locksLeft, occupancy, reachable, starsFor, validate, withMove } from './engine';
import { solve } from './solver';

describe('color locks', () => {
  // red waits for every blue brick; blue is open
  const lvl = fromSpec(
    {
      map: ['A.', 'B.', 'C.'],
      colors: { A: 'red', B: 'blue', C: 'blue' },
      gates: [
        { side: 'right', at: 0, len: 1, color: 'red', lockColor: 'blue' },
        { side: 'bottom', at: 1, len: 1, color: 'blue' },
      ],
    },
    1,
  );

  it('keeps the door iced while any brick of that color is on the board', () => {
    const s = initialState(lvl);
    expect(isLocked(lvl.gates[0], s, lvl)).toBe(true);
    const oneOut = withMove(s, 1, null);
    expect(isLocked(lvl.gates[0], oneOut, lvl)).toBe(true);
    expect(reachable(lvl, oneOut, 0).exit).toBeNull();
  });

  it('melts once the last brick of that color is out', () => {
    const bothOut = withMove(withMove(initialState(lvl), 1, null), 2, null);
    expect(isLocked(lvl.gates[0], bothOut, lvl)).toBe(false);
    expect(reachable(lvl, bothOut, 0).exit).not.toBeNull();
  });

  it('the solver clears the waited-for color first', () => {
    const sol = solve(lvl, initialState(lvl));
    expect(sol).not.toBeNull();
    const redStep = sol!.moves.findIndex((m) => m.block === 0 && m.to === null);
    const blueOut = sol!.moves.filter((m, i) => m.to === null && i < redStep && lvl.blocks[m.block].color === 'blue');
    expect(blueOut).toHaveLength(2);
  });

  it('a chain where two doors wait for each other has no solution', () => {
    const stuck = fromSpec(
      {
        map: ['A.', '..', 'B.'],
        colors: { A: 'red', B: 'blue' },
        gates: [
          { side: 'right', at: 0, len: 1, color: 'red', lockColor: 'blue' },
          { side: 'right', at: 2, len: 1, color: 'blue', lockColor: 'red' },
        ],
      },
      1,
    );
    expect(solve(stuck, initialState(stuck))).toBeNull();
  });

  it('flags a door that waits for a color no brick has', () => {
    const bad = fromSpec(
      { map: ['A.', '..'], colors: { A: 'red' }, gates: [{ side: 'right', at: 0, len: 1, color: 'red', lockColor: 'green' }] },
      1,
    );
    expect(validate(bad).some((e) => e.includes('waits for a color'))).toBe(true);
  });
});

describe('count locks', () => {
  it('counts down as bricks leave and never goes below 0', () => {
    const g = { side: 'left' as const, at: 0, len: 1, color: 'red' as const, lock: 2 };
    const s = { pos: [], exited: 0 };
    expect(locksLeft(g, s)).toBe(2);
    expect(locksLeft(g, { pos: [], exited: 1 })).toBe(1);
    expect(locksLeft(g, { pos: [], exited: 5 })).toBe(0);
    expect(locksLeft({ ...g, lock: undefined }, s)).toBe(0);
  });
});

describe('stones', () => {
  const lvl = fromSpec(
    {
      map: ['A*.', '...', '...'],
      colors: { A: 'red' },
      gates: [{ side: 'right', at: 0, len: 1, color: 'red' }],
    },
    1,
  );

  it('parses * as a stone, not a brick', () => {
    expect(lvl.blocks).toHaveLength(1);
    expect(lvl.stone?.[0][1]).toBe(true);
    expect(lvl.void[0][1]).toBe(false);
  });

  it('a brick can not slide onto or through a stone', () => {
    const reach = reachable(lvl, initialState(lvl), 0);
    expect(reach.spots.has('0,1')).toBe(false);
    // the way round still works: down, across, up to the door
    expect(solve(lvl, initialState(lvl))!.moves).toHaveLength(1);
  });

  it('a stone between a brick and its door blocks the exit', () => {
    const blocked = fromSpec({ map: ['A*.'], colors: { A: 'red' }, gates: [{ side: 'right', at: 0, len: 1, color: 'red' }] }, 1);
    const s = initialState(blocked);
    expect(exitGate(blocked, occupancy(blocked, s), s, 0, 0, 0)).toBe(-1);
    expect(solve(blocked, s)).toBeNull();
  });

  it('flags a door that opens onto a stone', () => {
    const bad = fromSpec({ map: ['A.*', '...'], colors: { A: 'red' }, gates: [{ side: 'right', at: 0, len: 1, color: 'red' }] }, 1);
    expect(validate(bad).some((e) => e.includes('stone'))).toBe(true);
  });
});

describe('a brick that starts at its own door', () => {
  it('is valid and leaves in one move', () => {
    const lvl = fromSpec({ map: ['A.', '..'], colors: { A: 'white' }, gates: [{ side: 'left', at: 0, len: 1, color: 'white' }] }, 1);
    expect(validate(lvl)).toEqual([]);
    expect(reachable(lvl, initialState(lvl), 0).exit).not.toBeNull();
    expect(solve(lvl, initialState(lvl))!.moves).toHaveLength(1);
  });
});

describe('design rules', () => {
  const base = {
    map: ['AA..', 'AA..', '....', '....'],
    colors: { A: 'red' as const },
  };

  it('accepts a corner door exactly as long as its bricks', () => {
    expect(designProblems(fromSpec({ ...base, gates: [{ side: 'right', at: 0, len: 2, color: 'red' }] }, 1))).toEqual([]);
    expect(designProblems(fromSpec({ ...base, gates: [{ side: 'bottom', at: 2, len: 2, color: 'red' }] }, 1))).toEqual([]);
  });

  it('rejects a door in the middle of an edge unless the level is advanced', () => {
    const mid = { ...base, gates: [{ side: 'right' as const, at: 1, len: 2, color: 'red' as const }] };
    expect(designProblems(fromSpec(mid, 1)).some((e) => e.includes('corner'))).toBe(true);
    expect(designProblems(fromSpec({ ...mid, advanced: true }, 1))).toEqual([]);
  });

  it('rejects a door longer or shorter than its bricks', () => {
    expect(designProblems(fromSpec({ ...base, gates: [{ side: 'right', at: 0, len: 3, color: 'red' }] }, 1)).some((e) => e.includes('need 2'))).toBe(true);
    expect(designProblems(fromSpec({ ...base, gates: [{ side: 'right', at: 0, len: 1, color: 'red' }] }, 1)).some((e) => e.includes('need 2'))).toBe(true);
  });

  it('measures the side that crosses the door: a 3 wide, 2 tall brick needs 2 on the left, 3 on top', () => {
    const wide = { map: ['AAA.', 'AAA.', '....'], colors: { A: 'blue' as const } };
    expect(designProblems(fromSpec({ ...wide, gates: [{ side: 'left', at: 0, len: 2, color: 'blue' }] }, 1))).toEqual([]);
    expect(designProblems(fromSpec({ ...wide, gates: [{ side: 'top', at: 0, len: 3, color: 'blue' }] }, 1))).toEqual([]);
  });

  it('rejects frozen bricks', () => {
    const lvl = fromSpec({ ...base, gates: [{ side: 'right', at: 0, len: 2, color: 'red' }], frozen: { A: 1 } }, 1);
    expect(designProblems(lvl).some((e) => e.includes('frozen'))).toBe(true);
  });
});

describe('stars', () => {
  it('3 at par, 2 within 3 moves, then 1', () => {
    expect(starsFor(10, 10, false)).toBe(3);
    expect(starsFor(13, 10, false)).toBe(2);
    expect(starsFor(14, 10, false)).toBe(1);
  });

  it('running out of time on a counted clock caps the board at 2 stars', () => {
    expect(starsFor(10, 10, false, true)).toBe(2);
    expect(starsFor(13, 10, false, true)).toBe(2);
    expect(starsFor(20, 10, false, true)).toBe(1);
  });
});
