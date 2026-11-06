import { describe, expect, it } from 'vitest';
import { type Cell, DIRS, type Level, type State, canPlace, fromSpec, initialState, isSolved, occupancy, reachable, withMove } from './engine';
import { EXIT_PAST, dragStep, keyStep } from './drag';
import { LEVELS } from './levels';
import { meta } from './meta';
import { solve } from './solver';

/** One brick, one square from its left door: ['.A..'] */
const oneFromDoor = fromSpec({ map: ['.A..', '....'], colors: { A: 'red' }, gates: [{ side: 'left', at: 0, len: 1, color: 'red' }] }, 1);

describe('Brick Escape drag: a brick leaves only when dragged out through its door', () => {
  it('keeps a brick that is dragged right up to its door on the board, next to the door', () => {
    const s = initialState(oneFromDoor);
    const res = dragStep(oneFromDoor, s, 0, [0, 1], [0, -1]);
    expect(res.at).toEqual([0, 0]);
    expect(res.exit).toBe(-1);
  });

  it('keeps it in while the drag goes less than half a square past the edge, and shows it sliding into the door', () => {
    const s = initialState(oneFromDoor);
    const res = dragStep(oneFromDoor, s, 0, [0, 1], [0, -1.3]);
    expect(res.at).toEqual([0, 0]);
    expect(res.exit).toBe(-1);
    expect(res.pull?.side).toBe('left');
    expect(res.pull?.depth).toBeCloseTo(0.3);
  });

  it('lets it out once the drag carries it half a square or more past the edge, through the door', () => {
    const s = initialState(oneFromDoor);
    expect(EXIT_PAST).toBe(0.5);
    expect(dragStep(oneFromDoor, s, 0, [0, 1], [0, -1.5]).exit).toBe(0);
    expect(dragStep(oneFromDoor, s, 0, [0, 1], [0, -2.4]).exit).toBe(0);
    expect(dragStep(oneFromDoor, s, 0, [0, 1], [0, -1.49]).exit).toBe(-1);
  });

  it('works the same when the drag starts with the brick already at its door', () => {
    const s = withMove(initialState(oneFromDoor), 0, [0, 0]);
    expect(dragStep(oneFromDoor, s, 0, [0, 0], [0, -0.2])).toMatchObject({ at: [0, 0], exit: -1 });
    expect(dragStep(oneFromDoor, s, 0, [0, 0], [0, -0.6]).exit).toBe(0);
  });

  it('measures the pull in the door direction only: sideways or backwards drags never let it out', () => {
    const s = withMove(initialState(oneFromDoor), 0, [0, 0]);
    // pointer far up, above the board: that is not the left door
    expect(dragStep(oneFromDoor, s, 0, [0, 0], [-3, 0]).exit).toBe(-1);
    // pulling away from the door: no pull at all
    expect(dragStep(oneFromDoor, s, 0, [0, 0], [0, 0.4]).pull).toBeNull();
  });

  it('never lets a brick out through a door of another colour, an icy door, or a door it does not fit', () => {
    const wrong = fromSpec({ map: ['A.', '..'], colors: { A: 'red' }, gates: [{ side: 'left', at: 0, len: 1, color: 'blue' }] }, 1);
    expect(dragStep(wrong, initialState(wrong), 0, [0, 0], [0, -2])).toMatchObject({ exit: -1, pull: null });

    const iced = fromSpec({ map: ['A.', '..'], colors: { A: 'red' }, gates: [{ side: 'left', at: 0, len: 1, color: 'red', lock: 1 }] }, 1);
    expect(dragStep(iced, initialState(iced), 0, [0, 0], [0, -2])).toMatchObject({ exit: -1, pull: null });

    const tall = fromSpec({ map: ['A.', 'A.', '..'], colors: { A: 'red' }, gates: [{ side: 'left', at: 0, len: 1, color: 'red' }] }, 1);
    expect(dragStep(tall, initialState(tall), 0, [0, 0], [0, -2])).toMatchObject({ exit: -1, pull: null });
  });

  it('never drags a frozen brick, not even out through its own open door', () => {
    const lvl = fromSpec({ map: ['A.', '..'], colors: { A: 'red' }, gates: [{ side: 'left', at: 0, len: 1, color: 'red' }], frozen: { A: 1 } }, 1);
    const s = initialState(lvl);
    expect(dragStep(lvl, s, 0, [0, 0], [0, -2])).toMatchObject({ at: [0, 0], exit: -1, pull: null });
    expect(dragStep(lvl, s, 0, [0, 0], [1, 1]).at).toEqual([0, 0]);
    expect(keyStep(lvl, s, 0, [0, -1])).toEqual({ kind: 'blocked' });
  });

  it('stops at a brick in the way and does not jump past it to the door', () => {
    const lvl = fromSpec({ map: ['.BA.', '....'], colors: { A: 'red', B: 'blue' }, gates: [{ side: 'left', at: 0, len: 1, color: 'red' }, { side: 'bottom', at: 1, len: 1, color: 'blue' }] }, 1);
    const res = dragStep(lvl, initialState(lvl), 1, [0, 2], [0, -3]);
    expect(res.at).toEqual([0, 2]);
    expect(res.exit).toBe(-1);
    expect(res.pull).toBeNull();
  });

  it('on Level 1, a white brick dragged up next to the white door stays there until it is dragged out', () => {
    const l1 = LEVELS[0];
    const topWhite = l1.blocks.findIndex((b) => b.color === 'white' && b.r === 0);
    const lowWhite = l1.blocks.findIndex((b) => b.color === 'white' && b.r === 2);
    let s = initialState(l1);
    // the top-left white brick starts at its door: a small drag toward the edge keeps it in
    expect(dragStep(l1, s, topWhite, [0, 0], [0, -0.4])).toMatchObject({ at: [0, 0], exit: -1 });
    expect(dragStep(l1, s, topWhite, [0, 0], [0, -0.7]).exit).toBeGreaterThanOrEqual(0);
    s = withMove(s, topWhite, null);
    // the lower white brick slides up two squares, right beside its door: it must stay on the board
    const up = dragStep(l1, s, lowWhite, [2, 0], [-2, 0]);
    expect(up).toMatchObject({ at: [0, 0], exit: -1 });
    s = withMove(s, lowWhite, up.at);
    expect(s.pos[lowWhite]).toEqual([0, 0]);
    // a second drag out through the door lets it leave
    expect(dragStep(l1, s, lowWhite, [0, 0], [0, -0.6]).exit).toBeGreaterThanOrEqual(0);
  });
});

describe('Brick Escape keyboard: one more press toward the door lets the brick out', () => {
  it('slides next to the door without leaving, then leaves on the next press toward the door', () => {
    let s = initialState(oneFromDoor);
    const first = keyStep(oneFromDoor, s, 0, [0, -1]);
    expect(first).toEqual({ kind: 'moved', at: [0, 0] });
    if (first.kind !== 'moved') throw new Error('expected a move');
    s = withMove(s, 0, first.at);
    expect(keyStep(oneFromDoor, s, 0, [0, -1])).toEqual({ kind: 'exit', gate: 0 });
  });

  it('pressing along or away from the door just slides, and a press into an icy door is blocked', () => {
    const s = withMove(initialState(oneFromDoor), 0, [0, 0]);
    expect(keyStep(oneFromDoor, s, 0, [1, 0])).toEqual({ kind: 'moved', at: [1, 0] });
    expect(keyStep(oneFromDoor, s, 0, [-1, 0])).toEqual({ kind: 'blocked' });
    const iced = fromSpec({ map: ['A.', '..'], colors: { A: 'red' }, gates: [{ side: 'left', at: 0, len: 1, color: 'red', lock: 1 }] }, 1);
    expect(keyStep(iced, initialState(iced), 0, [0, -1])).toEqual({ kind: 'blocked' });
  });

  it('has nowhere to go once the brick has left', () => {
    expect(keyStep(oneFromDoor, withMove(initialState(oneFromDoor), 0, null), 0, [0, -1])).toEqual({ kind: 'blocked' });
  });
});

/* ---------- the solver's moves, played as drags ---------- */

/** Anchor path for one brick from `from` to `to`, holding the others still (BFS over legal spots). */
function path(level: Level, s: State, block: number, from: Cell, to: Cell): Cell[] {
  const occ = occupancy(level, s);
  const k = (c: Cell) => `${c[0]},${c[1]}`;
  const prev = new Map<string, Cell | null>([[k(from), null]]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (k(cur) === k(to)) break;
    for (const [dr, dc] of Object.values(DIRS)) {
      const n: Cell = [cur[0] + dr, cur[1] + dc];
      if (prev.has(k(n)) || !canPlace(level, occ, block, n[0], n[1])) continue;
      prev.set(k(n), cur);
      queue.push(n);
    }
  }
  const out: Cell[] = [];
  for (let c: Cell | null | undefined = to; c; c = prev.get(k(c))) out.unshift(c);
  return out;
}

/** Plays one drag that follows `cells` square by square, then (if `outSide`) carries on past the door. */
function playDrag(level: Level, s: State, block: number, cells: Cell[], out: Cell | null) {
  const start = s.pos[block]!;
  let cur = s;
  let exit = -1;
  for (const c of cells.slice(1)) {
    const res = dragStep(level, cur, block, start, [c[0] - start[0], c[1] - start[1]]);
    expect(res.exit, `level ${level.id}: brick ${block} stays on the board while it slides`).toBe(-1);
    cur = withMove(cur, block, res.at);
  }
  if (out) {
    const at = cur.pos[block]!;
    const res = dragStep(level, cur, block, start, [at[0] - start[0] + out[0] * (EXIT_PAST + 0.1), at[1] - start[1] + out[1] * (EXIT_PAST + 0.1)]);
    exit = res.exit;
    cur = res.exit >= 0 ? withMove(cur, block, null) : cur;
  }
  return { state: cur, exit };
}

describe('Brick Escape drag agrees with the solver and the hint', () => {
  const chapter = (title: string) => {
    const c = meta.chapters.find((x) => x.title === title)!;
    return LEVELS.slice(c.start, c.start + c.count);
  };

  it('plays every solver move as one drag, so the par stays the number of drags (Getting started and Icy doors)', () => {
    for (const l of [...chapter('Getting started'), ...chapter('Icy doors')]) {
      const sol = solve(l, initialState(l), 2_000_000)!;
      let s = initialState(l);
      let drags = 0;
      for (const m of sol.moves) {
        const from = s.pos[m.block]!;
        if (m.to) {
          ({ state: s } = playDrag(l, s, m.block, path(l, s, m.block, from, m.to), null));
          expect(s.pos[m.block], `level ${l.id}`).toEqual(m.to);
        } else {
          const reach = reachable(l, s, m.block);
          const gate = l.gates[reach.exit!.gate];
          const res = playDrag(l, s, m.block, path(l, s, m.block, from, reach.exit!.at), DIRS[gate.side]);
          expect(res.exit, `level ${l.id}: brick ${m.block} leaves through its door`).toBe(reach.exit!.gate);
          s = res.state;
        }
        drags++;
      }
      expect(isSolved(s), `level ${l.id}`).toBe(true);
      expect(drags, `level ${l.id}`).toBe(l.par);
    }
  }, 60_000);

  it('a brick left beside its door costs one more drag to take out, and the solver from there still finishes', () => {
    let s = initialState(oneFromDoor);
    s = withMove(s, 0, dragStep(oneFromDoor, s, 0, [0, 1], [0, -1]).at);
    expect(s.pos[0]).toEqual([0, 0]);
    const sol = solve(oneFromDoor, s)!;
    expect(sol.moves).toEqual([{ block: 0, to: null }]);
  });
});
