import { describe, expect, it } from 'vitest';
import { exitGate, fromSpec, initialState, occupancy, reachable, starsFor, validate, withMove } from './engine';
import { LEVELS } from './levels';
import { ICE_BRICK, ICE_DOOR, TUTORIAL } from './levels.hand';
import { solve } from './solver';

describe('exit rules', () => {
  const lvl = fromSpec(
    {
      map: ['AA.', '...', '...'],
      colors: { A: 'red' },
      gates: [{ side: 'right', at: 0, len: 1, color: 'red' }],
    },
    1,
  );

  it('exits only when touching a matching door', () => {
    const s = initialState(lvl);
    const occ = occupancy(lvl, s);
    expect(exitGate(lvl, occ, s, 0, 0, 0)).toBe(-1);
    expect(exitGate(lvl, occ, s, 0, 0, 1)).toBe(0);
  });

  it('a brick wider than the door cannot leave', () => {
    const tall = fromSpec({ map: ['A..', 'A..', '...'], colors: { A: 'red' }, gates: [{ side: 'right', at: 0, len: 1, color: 'red' }] }, 1);
    const s = initialState(tall);
    expect(reachable(tall, s, 0).exit).toBeNull();
  });

  it('respects ice locks on doors', () => {
    const locked = fromSpec({ map: ['A.', 'B.'], colors: { A: 'red', B: 'blue' }, gates: [{ side: 'right', at: 0, len: 1, color: 'red', lock: 1 }, { side: 'bottom', at: 0, len: 1, color: 'blue' }] }, 1);
    const s = initialState(locked);
    expect(reachable(locked, s, 0).exit).toBeNull();
    const after = withMove(s, 1, null);
    expect(reachable(locked, after, 0).exit).not.toBeNull();
  });

  it('frozen bricks cannot move until enough bricks leave', () => {
    const lvl2 = fromSpec(ICE_BRICK, 1);
    const s = initialState(lvl2);
    const frozenIdx = lvl2.blocks.findIndex((b) => b.frozen);
    expect(reachable(lvl2, s, frozenIdx).spots.size).toBe(0);
  });

  it('stars: 3 at par, hint caps at 2', () => {
    expect(starsFor(5, 5, false)).toBe(3);
    expect(starsFor(5, 5, true)).toBe(2);
    expect(starsFor(7, 5, false)).toBe(2);
    expect(starsFor(30, 5, false)).toBe(1);
  });
});

describe('levels', () => {
  it('hand-made levels are valid and solvable', () => {
    for (const spec of [...TUTORIAL, ICE_DOOR, ICE_BRICK]) {
      const lvl = fromSpec(spec, 1);
      expect(validate(lvl), spec.name).toEqual([]);
      expect(solve(lvl, initialState(lvl)), spec.name).not.toBeNull();
    }
  });

  it('every shipped level is valid and solvable in exactly its par', () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(30);
    for (const lvl of LEVELS) {
      expect(validate(lvl), `level ${lvl.id}`).toEqual([]);
      const sol = solve(lvl, initialState(lvl), 2_000_000);
      expect(sol, `level ${lvl.id}`).not.toBeNull();
      expect(sol!.moves.length, `level ${lvl.id}`).toBe(lvl.par);
    }
  }, 120_000);

  it('difficulty never drops sharply as levels go on', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      // teaching levels for a new mechanic may be easier than the level before them, but not by much
      expect(LEVELS[i].par, `level ${i + 1}`).toBeGreaterThanOrEqual(LEVELS[i - 1].par - 6);
    }
  });
});
