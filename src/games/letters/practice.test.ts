/**
 * Letter Builder's practice Level 1 for ages 3 to 4: the child first learns to move and drop the letters.
 * Any tray letter dropped on the row goes into its own cell, whatever the order, so the finished row is
 * always in order and nothing is ever wrong. Every other band and level keeps the order rule (tapFill).
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, type AgeBand } from '../../shared/progress';
import { rng, shuffle } from '../../shared/rng';
import { LEVELS, makePuzzles, type FillPrompt, type Tile } from './levels';
import { fillDone, isPracticeLevel, newFill, nextCell, placeOwn, tapFill, type FillState } from './logic';

const SEEDS = Array.from({ length: 25 }, (_, i) => i * 7919 + 5);

/** Level 1 (index 0) as a 3 to 4 child gets it: the train A to E with guide ghosts, runs of 4. */
const levelOne = (seed: number) => makePuzzles(0, seed, '3-4') as FillPrompt[];

const tileOf = (p: FillPrompt, ch: string): Tile => {
  const t = p.tray.find((x) => x.ch === ch);
  if (!t) throw new Error(`No ${ch} in the tray`);
  return t;
};

/** The letters the row shows: a placed tile's letter, or null for a cell still empty (given cells stay null). */
const rowOf = (p: FillPrompt, s: FillState) => s.placed.map((id) => (id === null ? null : p.tray.find((t) => t.id === id)!.ch));

/** Drop every tile in `order` with placeOwn; each one must go in. Returns the final state. */
function dropAll(p: FillPrompt, order: Tile[]): FillState {
  let s = newFill(p);
  for (const t of order) {
    const r = placeOwn(p, s, t.id);
    expect(r.result, `${t.ch} into ${p.cells.join('')}`).toBe('correct');
    expect(p.cells[r.cell], `${t.ch} lands on its own letter`).toBe(t.ch);
    expect(p.given[r.cell]).toBe(false);
    expect(s.placed[r.cell], 'the cell was empty').toBe(null);
    expect(r.state.placed[r.cell]).toBe(t.id);
    s = r.state;
  }
  return s;
}

/** A few orders for a tray: as it lies, reversed, and some seeded shuffles. */
function orders(tray: Tile[], seed: number): Tile[][] {
  const rand = rng(seed);
  return [tray, [...tray].reverse(), ...Array.from({ length: 5 }, () => shuffle(tray, rand))];
}

/* ---------- Who gets the practice rule ---------- */

describe('isPracticeLevel: only Level 1 for ages 3 to 4', () => {
  it('is true for ages 3 to 4 on Level 1, and false for every other band and level', () => {
    for (const band of AGE_BANDS) {
      for (const level of [0, 1, 2, 24]) {
        expect(isPracticeLevel(band, level), `${band}, level ${level}`).toBe(band === '3-4' && level === 1);
      }
    }
  });

  it('takes the 1-based level number: Level 1 is 1, so 0 is not a level and is not practice', () => {
    expect(isPracticeLevel('3-4', 1)).toBe(true);
    expect(isPracticeLevel('3-4', 0)).toBe(false);
    expect(isPracticeLevel('3-4', 2)).toBe(false);
    // The last level, and one past it.
    expect(isPracticeLevel('3-4', LEVELS.length)).toBe(false);
    expect(isPracticeLevel('3-4', LEVELS.length + 1)).toBe(false);
  });

  it('keeps ages 5 and up on the order rule even on Level 1', () => {
    for (const band of ['5-6', '7-8', '9-10'] as AgeBand[]) expect(isPracticeLevel(band, 1), band).toBe(false);
  });
});

/* ---------- Where a dropped letter goes ---------- */

describe('placeOwn: a dropped letter goes into its own cell', () => {
  it('puts the last letter of a Level 1 run, dropped first, into the last cell and says which cell', () => {
    for (const seed of SEEDS) {
      for (const p of levelOne(seed)) {
        const last = p.cells.length - 1;
        const t = tileOf(p, p.cells[last]);
        const r = placeOwn(p, newFill(p), t.id);
        expect(r.result).toBe('correct');
        expect(r.cell).toBe(last);
        expect(r.state.placed).toEqual(p.cells.map((_, i) => (i === last ? t.id : null)));
        // The first cell is still the one the order rule would want next.
        expect(nextCell(p, r.state)).toBe(0);
      }
    }
  });

  it('puts a middle letter into its own cell, not the next empty one', () => {
    const p = levelOne(1)[0];
    expect(p.cells).toEqual(['A', 'B', 'C', 'D']);
    const r = placeOwn(p, newFill(p), tileOf(p, 'C').id);
    expect(r).toMatchObject({ result: 'correct', cell: 2 });
    expect(rowOf(p, r.state)).toEqual([null, null, 'C', null]);
  });

  it('fills every Level 1 row in the right order, whatever order the letters are dropped in', () => {
    for (const seed of SEEDS) {
      for (const p of levelOne(seed)) {
        for (const order of orders(p.tray, seed)) {
          const s = dropAll(p, order);
          expect(fillDone(p, s)).toBe(true);
          expect(rowOf(p, s)).toEqual(p.cells);
        }
      }
    }
  });

  it('is never wrong: every tray letter of every fill level either goes in or is ignored', () => {
    for (let level = 0; level < LEVELS.length; level++) {
      const kind = LEVELS[level].kind;
      if (kind !== 'train' && kind !== 'missing' && kind !== 'spell') continue;
      for (const band of AGE_BANDS) {
        for (const seed of SEEDS.slice(0, 4)) {
          for (const p of makePuzzles(level, seed, band) as FillPrompt[]) {
            const needed = p.cells.filter((_, i) => !p.given[i]);
            for (const t of p.tray) {
              const r = placeOwn(p, newFill(p), t.id);
              expect(['correct', 'ignored'], `level ${level + 1} ${t.ch}`).toContain(r.result);
              // A decoy has no cell of its own, so it is ignored; every needed letter goes in.
              expect(r.result).toBe(needed.includes(t.ch) ? 'correct' : 'ignored');
            }
          }
        }
      }
    }
  });

  it('agrees with the order rule when the dropped letter is the next one', () => {
    for (const seed of SEEDS.slice(0, 5)) {
      for (const p of levelOne(seed)) {
        let s = newFill(p);
        for (const ch of p.cells) {
          const id = tileOf(p, ch).id;
          const own = placeOwn(p, s, id);
          const order = tapFill(p, s, id);
          expect(order.result).toBe('correct');
          expect(own.result).toBe('correct');
          expect(own.state).toEqual(order.state);
          s = own.state;
        }
      }
    }
  });
});

/* ---------- What it ignores ---------- */

describe('placeOwn: what it ignores', () => {
  const egg: FillPrompt = {
    kind: 'spell',
    cells: ['E', 'G', 'G'],
    given: [false, false, false],
    tray: [
      { id: 'a', ch: 'G' },
      { id: 'b', ch: 'E' },
      { id: 'c', ch: 'G' },
      { id: 'd', ch: 'M' },
      { id: 'e', ch: 'G' },
    ],
    word: { word: 'egg', emoji: '🥚' },
  };

  it('ignores a tile already placed, and leaves the state as it was', () => {
    const p = levelOne(3)[1];
    const id = tileOf(p, p.cells[2]).id;
    const once = placeOwn(p, newFill(p), id);
    expect(once.result).toBe('correct');
    const again = placeOwn(p, once.state, id);
    expect(again.result).toBe('ignored');
    expect(again.cell).toBe(-1);
    expect(again.state).toEqual(once.state);
  });

  it('ignores a tile id that is not in the tray', () => {
    const p = levelOne(3)[0];
    const s = newFill(p);
    for (const id of ['nope', '', 'w0-0', p.tray[0].id + 'x']) {
      const r = placeOwn(p, s, id);
      expect(r.result, id).toBe('ignored');
      expect(r.cell).toBe(-1);
      expect(r.state).toEqual(s);
    }
  });

  it('ignores a letter with no cell of its own, and one whose cells are all full', () => {
    let s = newFill(egg);
    // M is in no cell.
    expect(placeOwn(egg, s, 'd')).toMatchObject({ result: 'ignored', cell: -1 });
    s = placeOwn(egg, s, 'a').state;
    s = placeOwn(egg, s, 'c').state;
    // Both G cells are full now: a third G has nowhere to go.
    const r = placeOwn(egg, s, 'e');
    expect(r).toMatchObject({ result: 'ignored', cell: -1 });
    expect(r.state).toEqual(s);
  });

  it('ignores everything once the row is complete', () => {
    const p = levelOne(9)[2];
    const full = dropAll(p, [...p.tray].reverse());
    expect(fillDone(p, full)).toBe(true);
    for (const t of p.tray) expect(placeOwn(p, full, t.id)).toMatchObject({ result: 'ignored', cell: -1 });
  });

  it('never answers wrong, even for a decoy dropped first', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e']) expect(placeOwn(egg, newFill(egg), id).result).not.toBe('wrong');
  });
});

/* ---------- Given cells and repeated letters ---------- */

describe('placeOwn: given cells and repeated letters', () => {
  it('skips given cells and puts a missing letter into its own gap, out of order', () => {
    const p: FillPrompt = {
      kind: 'missing',
      cells: ['A', 'B', 'C', 'D'],
      given: [true, false, true, false],
      tray: [
        { id: 'x', ch: 'D' },
        { id: 'y', ch: 'B' },
      ],
    };
    const r = placeOwn(p, newFill(p), 'x');
    expect(r).toMatchObject({ result: 'correct', cell: 3 });
    const done = placeOwn(p, r.state, 'y');
    expect(done).toMatchObject({ result: 'correct', cell: 1 });
    expect(done.state.placed).toEqual([null, 'y', null, 'x']);
    expect(fillDone(p, done.state)).toBe(true);
  });

  it('never puts a letter on a given cell with the same letter, and ignores it when that is its only cell', () => {
    const p: FillPrompt = {
      kind: 'missing',
      cells: ['B', 'A', 'B', 'C'],
      given: [true, false, false, true],
      tray: [
        { id: 'b', ch: 'B' },
        { id: 'a', ch: 'A' },
        { id: 'c', ch: 'C' },
      ],
    };
    expect(placeOwn(p, newFill(p), 'b')).toMatchObject({ result: 'correct', cell: 2 });
    // C's only cell is given.
    expect(placeOwn(p, newFill(p), 'c')).toMatchObject({ result: 'ignored', cell: -1 });
  });

  it('fills the gaps of every missing-letters puzzle in any order, and leaves the given cells alone', () => {
    const level = LEVELS.findIndex((d) => d.kind === 'missing');
    for (const seed of SEEDS) {
      for (const p of makePuzzles(level, seed) as FillPrompt[]) {
        const needed = p.tray.filter((t) => p.cells.some((c, i) => !p.given[i] && c === t.ch));
        for (const order of orders(needed, seed)) {
          const s = dropAll(p, order);
          expect(fillDone(p, s)).toBe(true);
          p.given.forEach((g, i) => {
            if (g) expect(s.placed[i]).toBe(null);
            else expect(p.tray.find((t) => t.id === s.placed[i])!.ch).toBe(p.cells[i]);
          });
        }
      }
    }
  });

  it('puts a repeated letter into the first empty cell with that letter', () => {
    const p: FillPrompt = {
      kind: 'spell',
      cells: ['E', 'G', 'G'],
      given: [false, false, false],
      tray: [
        { id: 'a', ch: 'G' },
        { id: 'b', ch: 'E' },
        { id: 'c', ch: 'G' },
      ],
      word: { word: 'egg', emoji: '🥚' },
    };
    let r = placeOwn(p, newFill(p), 'c');
    expect(r).toMatchObject({ result: 'correct', cell: 1 });
    r = placeOwn(p, r.state, 'a');
    expect(r).toMatchObject({ result: 'correct', cell: 2 });
    r = placeOwn(p, r.state, 'b');
    expect(r).toMatchObject({ result: 'correct', cell: 0 });
    expect(r.state.placed).toEqual(['b', 'c', 'a']);
    expect(fillDone(p, r.state)).toBe(true);
    // The other G first takes the first G cell just the same.
    expect(placeOwn(p, newFill(p), 'a')).toMatchObject({ result: 'correct', cell: 1 });
  });

  it('builds every spelling word in the right order from any drop order, doubled letters too', () => {
    const spell = LEVELS.map((d, i) => ({ d, i })).filter((x) => x.d.kind === 'spell');
    let doubled = 0;
    for (const { i } of spell) {
      for (const band of AGE_BANDS) {
        for (const seed of SEEDS.slice(0, 3)) {
          for (const p of makePuzzles(i, seed, band) as FillPrompt[]) {
            if (new Set(p.cells).size < p.cells.length) doubled++;
            for (const order of orders(p.tray, seed).slice(0, 3)) {
              const s = dropAll(p, order);
              expect(fillDone(p, s)).toBe(true);
              expect(rowOf(p, s).join('')).toBe(p.cells.join(''));
            }
          }
        }
      }
    }
    // The words include some with a doubled letter, so the first-empty rule is really exercised.
    expect(doubled).toBeGreaterThan(0);
  });
});

/* ---------- Purity ---------- */

describe('placeOwn: pure', () => {
  it('does not change the state or the prompt it is given', () => {
    const p = levelOne(11)[0];
    const start = newFill(p);
    const mid = placeOwn(p, start, tileOf(p, p.cells[3]).id).state;
    for (const s of [start, mid]) {
      Object.freeze(s.placed);
      Object.freeze(s);
      const before = JSON.stringify(s);
      const prompt = JSON.stringify(p);
      for (const t of p.tray) {
        const r = placeOwn(p, s, t.id);
        if (r.result === 'correct') {
          expect(r.state).not.toBe(s);
          expect(r.state.placed).not.toBe(s.placed);
        }
      }
      expect(JSON.stringify(s)).toBe(before);
      expect(JSON.stringify(p)).toBe(prompt);
    }
  });
});
