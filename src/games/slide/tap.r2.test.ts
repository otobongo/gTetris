/**
 * Decision 1 (escape-tap-path): tap a brick, then tap where it should slide. tap.ts lists every place the
 * selected brick can reach in a straight line, and its own open door, step by step with the same keyStep the
 * arrow keys use, so a tap is never a move a drag or a key could not make.
 */
import { describe, expect, it } from 'vitest';
import { keyStep } from './drag';
import { type Cell, type Level, type State, fromSpec, initialState, isSolved, occupancy, withMove } from './engine';
import { TUTORIAL } from './levels.hand';
import { PUZZLE_LEVELS } from './puzzles';
import { NO_MOVE_LINE, SELECT_LINE, type TapTarget, tapButtons, tapMove, tapTargets } from './tap';
import { solve } from './solver';

/** A red 1 x 1 brick in row 1, column 2 of a 3 x 4 tray, with its red door on the left of row 1. */
const open = fromSpec({ map: ['.A..', '....', '....'], colors: { A: 'red' }, gates: [{ side: 'left', at: 0, len: 1, color: 'red' }] }, 1);

const slides = (ts: TapTarget[]) => ts.filter((t) => t.kind === 'slide').map((t) => (t.kind === 'slide' ? { at: t.at, steps: t.steps, dir: t.dir } : null));
const exits = (ts: TapTarget[]) => ts.filter((t) => t.kind === 'exit');
const key = (c: Cell) => `${c[0]},${c[1]}`;

describe('tapTargets: every straight-line spot and the brick’s own open door', () => {
  it('lists the row and column spots, nearest first in each direction, with the steps to each', () => {
    const ts = tapTargets(open, initialState(open), 0);
    expect(slides(ts)).toEqual([
      { at: [1, 1], steps: 1, dir: [1, 0] },
      { at: [2, 1], steps: 2, dir: [1, 0] },
      { at: [0, 0], steps: 1, dir: [0, -1] },
      { at: [0, 2], steps: 1, dir: [0, 1] },
      { at: [0, 3], steps: 2, dir: [0, 1] },
    ]);
  });

  it('adds the door as an exit target at the end of the slide toward it, counting the step out', () => {
    const ts = exits(tapTargets(open, initialState(open), 0));
    expect(ts).toEqual([{ kind: 'exit', gate: 0, dir: [0, -1], steps: 2, from: [0, 0], reach: [[0, 0]] }]);
  });

  it('gives a brick already at its door an exit target that reaches into no cell', () => {
    const s = withMove(initialState(open), 0, [0, 0]);
    expect(exits(tapTargets(open, s, 0))).toEqual([{ kind: 'exit', gate: 0, dir: [0, -1], steps: 1, from: [0, 0], reach: [] }]);
  });

  it('marks the free cell at the leading edge of each spot, where the ring is drawn', () => {
    const ts = tapTargets(open, initialState(open), 0);
    const right = ts.filter((t) => t.kind === 'slide' && t.dir[1] === 1);
    expect(right.map((t) => (t.kind === 'slide' ? [t.cell, t.cells] : null))).toEqual([
      [[0, 2], [[0, 2]]],
      [[0, 3], [[0, 3]]],
    ]);
  });

  it('gives a 3 wide, 2 tall brick a whole leading edge, two cells, for each spot', () => {
    const big = fromSpec({ map: ['AAA..', 'AAA..', '.....'], colors: { A: 'blue' }, gates: [{ side: 'bottom', at: 0, len: 3, color: 'blue' }] }, 1);
    const ts = tapTargets(big, initialState(big), 0);
    const right = ts.filter((t) => t.kind === 'slide' && t.dir[1] === 1);
    expect(right.map((t) => (t.kind === 'slide' ? { at: t.at, cells: t.cells, steps: t.steps } : null))).toEqual([
      { at: [0, 1], cells: [[0, 3], [1, 3]], steps: 1 },
      { at: [0, 2], cells: [[0, 4], [1, 4]], steps: 2 },
    ]);
    const down = ts.filter((t) => t.kind === 'slide' && t.dir[0] === 1);
    expect(down.map((t) => (t.kind === 'slide' ? { at: t.at, cells: t.cells } : null))).toEqual([{ at: [1, 0], cells: [[2, 0], [2, 1], [2, 2]] }]);
    // the bottom door takes it out from there: two steps, reaching into the three cells below it
    expect(exits(ts)).toEqual([{ kind: 'exit', gate: 0, dir: [1, 0], steps: 2, from: [1, 0], reach: [[2, 0], [2, 1], [2, 2]] }]);
  });

  it('stops at a stone, a wall and another brick', () => {
    const lvl = fromSpec({ map: ['A.*.', '#...', 'B...'], colors: { A: 'red', B: 'green' }, gates: [{ side: 'top', at: 3, len: 1, color: 'red' }, { side: 'bottom', at: 3, len: 1, color: 'green' }] }, 1);
    const ts = tapTargets(lvl, initialState(lvl), 0);
    // right: one square, then the stone; down: the wall (a void square) at once; up and left: the tray edge
    expect(slides(ts)).toEqual([{ at: [0, 1], steps: 1, dir: [0, 1] }]);
    expect(exits(ts)).toEqual([]);
    const b = tapTargets(lvl, initialState(lvl), 1);
    // B: the wall right above it, so only right, to the tray edge; its door is not in that line
    expect(slides(b)).toEqual([
      { at: [2, 1], steps: 1, dir: [0, 1] },
      { at: [2, 2], steps: 2, dir: [0, 1] },
      { at: [2, 3], steps: 3, dir: [0, 1] },
    ]);
  });

  it('never gives an exit through an iced door, but still lets the brick slide up to it', () => {
    const iced = fromSpec({ map: ['.A..', 'B...'], colors: { A: 'red', B: 'blue' }, gates: [{ side: 'left', at: 0, len: 1, color: 'red', lock: 1 }, { side: 'left', at: 1, len: 1, color: 'blue' }] }, 1);
    const ts = tapTargets(iced, initialState(iced), 0);
    expect(exits(ts)).toEqual([]);
    expect(slides(ts)).toContainEqual({ at: [0, 0], steps: 1, dir: [0, -1] });
    // once one brick is out, the ice melts and the door is a target again
    const melted = withMove(initialState(iced), 1, null);
    expect(exits(tapTargets(iced, melted, 0))).toHaveLength(1);
  });

  it('never gives an exit through a door of another colour', () => {
    const wrong = fromSpec({ map: ['.A.'], colors: { A: 'red' }, gates: [{ side: 'left', at: 0, len: 1, color: 'blue' }, { side: 'right', at: 0, len: 1, color: 'red' }] }, 1);
    const ts = tapTargets(wrong, initialState(wrong), 0);
    expect(exits(ts).map((t) => (t.kind === 'exit' ? t.gate : -1))).toEqual([1]);
    expect(slides(ts)).toContainEqual({ at: [0, 0], steps: 1, dir: [0, -1] });
  });

  it('gives an exit only through the brick’s own door, and none sideways out of a door it does not fit', () => {
    // a 2 long brick crossing a 1 long door of its colour does not fit through it
    const tight = fromSpec({ map: ['AA..', '....'], colors: { A: 'red' }, gates: [{ side: 'top', at: 0, len: 1, color: 'red' }, { side: 'right', at: 0, len: 1, color: 'red' }] }, 1);
    const ts = tapTargets(tight, initialState(tight), 0);
    expect(exits(ts).map((t) => (t.kind === 'exit' ? t.gate : -1))).toEqual([1]);
  });

  it('gives nothing for a brick that is already out', () => {
    expect(tapTargets(open, withMove(initialState(open), 0, null), 0)).toEqual([]);
  });

  it('matches what the arrow keys do, press for press, on every board of Level 1 and Level 31', () => {
    for (const lvl of [...PUZZLE_LEVELS[0].puzzles, ...PUZZLE_LEVELS[PUZZLE_LEVELS.length - 1].puzzles]) {
      const s = initialState(lvl);
      lvl.blocks.forEach((_, b) => {
        for (const t of tapTargets(lvl, s, b)) {
          let state: State = s;
          for (let i = 0; i < t.steps; i++) {
            const step = keyStep(lvl, state, b, t.dir);
            if (i < t.steps - 1 || t.kind === 'slide') {
              expect(step.kind).toBe('moved');
              if (step.kind === 'moved') state = withMove(state, b, step.at);
            } else expect(step).toEqual({ kind: 'exit', gate: t.kind === 'exit' ? t.gate : -1 });
          }
          if (t.kind === 'slide') expect(state.pos[b]).toEqual(t.at);
        }
      });
    }
  });
});

describe('tapButtons: what the board draws, no button over a brick or over another button', () => {
  it('leaves out the spot beside the door when the door’s button reaches into it', () => {
    const bs = tapButtons(open, initialState(open), 0);
    expect(bs.some((t) => t.kind === 'slide' && key(t.at) === '0,0')).toBe(false);
    expect(bs.filter((t) => t.kind === 'exit')).toHaveLength(1);
    expect(bs).toHaveLength(tapTargets(open, initialState(open), 0).length - 1);
  });

  it('never puts two buttons, or a button and a brick, on one square, on any board of Levels 1, 4, 9, 20 and 31', () => {
    for (const n of [1, 4, 9, 20, PUZZLE_LEVELS.length]) {
      for (const lvl of PUZZLE_LEVELS[n - 1].puzzles) {
        const s = initialState(lvl);
        const occ = occupancy(lvl, s);
        lvl.blocks.forEach((_, b) => {
          const used = new Set<string>();
          for (const t of tapButtons(lvl, s, b)) {
            const cells = t.kind === 'slide' ? t.cells : t.reach;
            for (const c of cells) {
              expect(used.has(key(c)), `level ${n} brick ${b} ${key(c)}`).toBe(false);
              used.add(key(c));
              expect(occ[c[0] * lvl.cols + c[1]], `level ${n} brick ${b} ${key(c)} is free`).toBe(0);
            }
          }
        });
      }
    }
  });
});

describe('tapMove: one tap, one move', () => {
  it('slides the brick two squares for a target two squares away', () => {
    const t = tapTargets(open, initialState(open), 0).find((x) => x.kind === 'slide' && x.steps === 2 && x.dir[0] === 1)!;
    const res = tapMove(open, initialState(open), 0, t);
    expect(res).toEqual({ kind: 'moved', at: [2, 1], state: withMove(initialState(open), 0, [2, 1]) });
  });

  it('slides the brick to its door and says which door it leaves by, leaving the removal to the screen', () => {
    const t = exits(tapTargets(open, initialState(open), 0))[0];
    const res = tapMove(open, initialState(open), 0, t);
    expect(res).toEqual({ kind: 'exit', gate: 0, from: [0, 0], state: withMove(initialState(open), 0, [0, 0]) });
  });

  it('refuses a target that is no longer reachable', () => {
    const t = tapTargets(open, initialState(open), 0).find((x) => x.kind === 'slide' && x.steps === 2 && x.dir[1] === 1)!;
    const blocked = fromSpec({ map: ['.AB.'], colors: { A: 'red', B: 'blue' }, gates: [{ side: 'left', at: 0, len: 1, color: 'red' }, { side: 'right', at: 0, len: 1, color: 'blue' }] }, 1);
    expect(tapMove(blocked, initialState(blocked), 0, t)).toBeNull();
  });

  /** The fewest taps that solve `lvl` from its start, searching every tap the board draws; null if taps alone cannot. */
  function fewestTaps(lvl: Level, limit = 200_000): number | null {
    const start = initialState(lvl);
    const seen = new Set([JSON.stringify(start.pos)]);
    let frontier: State[] = [start];
    for (let taps = 0; frontier.length && seen.size < limit; taps++) {
      const next: State[] = [];
      for (const s of frontier) {
        if (isSolved(s)) return taps;
        lvl.blocks.forEach((_, b) => {
          for (const t of tapButtons(lvl, s, b)) {
            const res = tapMove(lvl, s, b, t)!;
            const after = res.kind === 'exit' ? withMove(res.state, b, null) : res.state;
            const k = JSON.stringify(after.pos);
            if (!seen.has(k)) {
              seen.add(k);
              next.push(after);
            }
          }
        });
      }
      frontier = next;
    }
    return null;
  }

  it('solves every board of Levels 1 and 2 with taps alone', () => {
    for (const lvl of [...PUZZLE_LEVELS[0].puzzles, ...PUZZLE_LEVELS[1].puzzles]) {
      const taps = fewestTaps(lvl);
      expect(taps, `level ${lvl.id} ${lvl.name ?? ''}`).not.toBeNull();
      // a drag can turn a corner in one move; taps go straight, so they never need fewer moves than the Best
      expect(taps!).toBeGreaterThanOrEqual(lvl.par);
    }
  });

  it('takes the first teaching board\u2019s brick out in one tap on its door, as one drag would', () => {
    const lvl: Level = fromSpec(TUTORIAL[0], 1, 1);
    expect(solve(lvl, initialState(lvl), 10_000)!.moves).toHaveLength(1);
    expect(fewestTaps(lvl)).toBe(1);
  });
});

describe('the help line while a brick is picked', () => {
  it('says what to do next, or that the brick cannot move yet, in short plain words', () => {
    expect(SELECT_LINE).toBe('Now tap where it should slide.');
    expect(NO_MOVE_LINE).toBe('This brick cannot move yet.');
    for (const line of [SELECT_LINE, NO_MOVE_LINE]) {
      expect(line.length).toBeLessThanOrEqual(44);
      expect(line).not.toMatch(/[–—]/);
    }
  });
});
