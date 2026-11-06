/** Number Line-up row rules (brief 4.3 "Stuck, hint, timer, stars", 10.2 "Numbers"): inversions and cycles,
    the fewest swaps against a breadth-first search over all 720 orders, the slip and progress rule for a swap,
    the filled marks, and the hint step followed to the end. */
import { describe, expect, it } from 'vitest';
import {
  cycles,
  fewestSwaps,
  goalOf,
  hintPath,
  hintStep,
  inOrder,
  inversions,
  rightSpots,
  swapAt,
  swapKind,
  type Dir,
} from './order';

const DIRS: readonly Dir[] = ['up', 'down'];

/** Every order of 0 to n - 1, written here so the checks do not lean on the generator's own list. */
function allOrders(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of allOrders(n - 1)) for (let at = 0; at <= rest.length; at++) out.push([...rest.slice(0, at), n - 1, ...rest.slice(at)]);
  return out;
}

const ORDERS = allOrders(6);

/** Breadth-first search over the 720 orders of six towers, one swap of any two towers per step. */
const DISTANCE: ReadonlyMap<string, number> = (() => {
  const start = [0, 1, 2, 3, 4, 5];
  const dist = new Map<string, number>([[start.join(','), 0]]);
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    const at = queue[q];
    const d = dist.get(at.join(','))!;
    for (let i = 0; i < 6; i++)
      for (let j = i + 1; j < 6; j++) {
        const next = at.slice();
        [next[i], next[j]] = [next[j], next[i]];
        const key = next.join(',');
        if (!dist.has(key)) {
          dist.set(key, d + 1);
          queue.push(next);
        }
      }
  }
  return dist;
})();

/** Where each tower belongs in the level's order (0 is the first spot), worked out by counting. */
function ranks(row: readonly number[], dir: Dir): number[] {
  return row.map((v) => row.filter((w) => (dir === 'up' ? w < v : w > v)).length);
}

const bfsSwaps = (row: readonly number[], dir: Dir) => DISTANCE.get(ranks(row, dir).join(','))!;

function bruteInversions(row: readonly number[], dir: Dir): number {
  const r = ranks(row, dir);
  let count = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i] > r[j]) count++;
  return count;
}

/** Number sets the game deals: the stairs, a counting run, and six bigger numbers with three digits. */
const NUMBER_SETS: readonly (readonly number[])[] = [
  [1, 2, 3, 4, 5, 6],
  [15, 20, 25, 30, 35, 40],
  [100, 200, 300, 400, 500, 600],
  [3, 17, 42, 256, 731, 999],
];

/** The row that puts tower rank order[i] in spot i, for a number set and direction. */
function deal(order: readonly number[], numbers: readonly number[], dir: Dir): number[] {
  const goal = dir === 'up' ? numbers.slice() : numbers.slice().reverse();
  return order.map((rank) => goal[rank]);
}

describe('the breadth-first search used as the reference', () => {
  it('reaches all 720 orders and needs at most 5 swaps, with the known count at each distance', () => {
    expect(DISTANCE.size).toBe(720);
    const byDistance = [0, 0, 0, 0, 0, 0];
    for (const d of DISTANCE.values()) byDistance[d]++;
    // Stirling numbers of the first kind for 6: orders with 6, 5, 4, 3, 2, 1 cycles.
    expect(byDistance).toEqual([1, 15, 85, 225, 274, 120]);
  });
});

describe('goalOf and inOrder', () => {
  it('gives the stairs up for smallest first and down for biggest first', () => {
    expect(goalOf([3, 1, 6, 2, 5, 4], 'up')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(goalOf([3, 1, 6, 2, 5, 4], 'down')).toEqual([6, 5, 4, 3, 2, 1]);
    expect(goalOf([40, 15, 999, 7, 250, 31], 'up')).toEqual([7, 15, 31, 40, 250, 999]);
  });

  it('sorts numbers by value, not as text (100 comes after 25)', () => {
    expect(goalOf([100, 25, 5, 999, 30, 200], 'up')).toEqual([5, 25, 30, 100, 200, 999]);
    expect(inOrder([5, 25, 30, 100, 200, 999], 'up')).toBe(true);
    expect(inOrder([100, 200, 25, 30, 5, 999], 'up')).toBe(false);
  });

  it('leaves the row it is given untouched', () => {
    const row = [3, 1, 6, 2, 5, 4];
    goalOf(row, 'up');
    goalOf(row, 'down');
    expect(row).toEqual([3, 1, 6, 2, 5, 4]);
  });

  it('calls a row in order exactly when it equals its goal, in both directions', () => {
    for (const numbers of NUMBER_SETS)
      for (const dir of DIRS)
        for (const order of ORDERS) {
          const row = deal(order, numbers, dir);
          expect(inOrder(row, dir)).toBe(row.every((v, i) => v === goalOf(row, dir)[i]));
        }
  });

  it('treats the stairs going up as out of order for biggest first, and the other way round', () => {
    expect(inOrder([1, 2, 3, 4, 5, 6], 'up')).toBe(true);
    expect(inOrder([1, 2, 3, 4, 5, 6], 'down')).toBe(false);
    expect(inOrder([6, 5, 4, 3, 2, 1], 'down')).toBe(true);
    expect(inOrder([6, 5, 4, 3, 2, 1], 'up')).toBe(false);
  });

  it('counts an empty row and a single tower as in order', () => {
    for (const dir of DIRS) {
      expect(inOrder([], dir)).toBe(true);
      expect(inOrder([7], dir)).toBe(true);
    }
  });
});

describe('inversions', () => {
  it('is 0 in order and 15 for six towers the wrong way round', () => {
    expect(inversions([1, 2, 3, 4, 5, 6], 'up')).toBe(0);
    expect(inversions([6, 5, 4, 3, 2, 1], 'up')).toBe(15);
    expect(inversions([6, 5, 4, 3, 2, 1], 'down')).toBe(0);
    expect(inversions([1, 2, 3, 4, 5, 6], 'down')).toBe(15);
  });

  it('counts the pairs standing the wrong way round', () => {
    expect(inversions([2, 1, 3, 4, 5, 6], 'up')).toBe(1);
    expect(inversions([3, 1, 2, 4, 5, 6], 'up')).toBe(2);
    expect(inversions([2, 3, 4, 5, 6, 1], 'up')).toBe(5);
    expect(inversions([40, 15, 20, 25, 30, 35], 'up')).toBe(5);
  });

  it('matches a count by hand for every order, number set and direction', () => {
    for (const numbers of NUMBER_SETS)
      for (const dir of DIRS)
        for (const order of ORDERS) {
          const row = deal(order, numbers, dir);
          expect(inversions(row, dir)).toBe(bruteInversions(row, dir));
        }
  });

  it('adds up to 15 over the two directions, since every pair is wrong one way', () => {
    for (const order of ORDERS) {
      const row = deal(order, [1, 2, 3, 4, 5, 6], 'up');
      expect(inversions(row, 'up') + inversions(row, 'down')).toBe(15);
    }
  });

  it('is 0 for an empty row and a single tower', () => {
    expect(inversions([], 'up')).toBe(0);
    expect(inversions([9], 'down')).toBe(0);
  });
});

describe('cycles and fewestSwaps', () => {
  it('counts a tower already in its spot as a cycle of one', () => {
    expect(cycles([1, 2, 3, 4, 5, 6], 'up')).toBe(6);
    expect(fewestSwaps([1, 2, 3, 4, 5, 6], 'up')).toBe(0);
  });

  it('finds one swap for two towers the wrong way round, wherever they stand', () => {
    expect(cycles([2, 1, 3, 4, 5, 6], 'up')).toBe(5);
    expect(fewestSwaps([2, 1, 3, 4, 5, 6], 'up')).toBe(1);
    expect(fewestSwaps([6, 2, 3, 4, 5, 1], 'up')).toBe(1);
  });

  it('pairs the reversed stairs into three cycles, so 3 swaps', () => {
    expect(cycles([6, 5, 4, 3, 2, 1], 'up')).toBe(3);
    expect(fewestSwaps([6, 5, 4, 3, 2, 1], 'up')).toBe(3);
  });

  it('needs 5 swaps for one cycle through all six towers', () => {
    expect(cycles([2, 3, 4, 5, 6, 1], 'up')).toBe(1);
    expect(fewestSwaps([2, 3, 4, 5, 6, 1], 'up')).toBe(5);
    expect(fewestSwaps([5, 4, 3, 2, 1, 6], 'down')).toBe(5);
  });

  it('is 6 minus the cycles, and equals the breadth-first search, for every order, number set and direction', () => {
    for (const numbers of NUMBER_SETS)
      for (const dir of DIRS)
        for (const order of ORDERS) {
          const row = deal(order, numbers, dir);
          const fewest = fewestSwaps(row, dir);
          expect(fewest).toBe(6 - cycles(row, dir));
          expect(fewest, `${row.join(',')} ${dir}`).toBe(bfsSwaps(row, dir));
        }
  });

  it('is 0 for an empty row', () => {
    expect(cycles([], 'up')).toBe(0);
    expect(fewestSwaps([], 'up')).toBe(0);
  });
});

describe('rightSpots (the filled marks)', () => {
  it('fills only the spots that hold their right tower', () => {
    expect(rightSpots([1, 3, 2, 4, 6, 5], 'up')).toEqual([true, false, false, true, false, false]);
    expect(rightSpots([6, 2, 4, 3, 5, 1], 'down')).toEqual([true, false, true, true, false, true]);
  });

  it('fills every mark once the row is in order and none on a row with no tower in place', () => {
    expect(rightSpots([1, 2, 3, 4, 5, 6], 'up')).toEqual(Array(6).fill(true));
    expect(rightSpots([2, 3, 4, 5, 6, 1], 'up')).toEqual(Array(6).fill(false));
    expect(rightSpots([15, 20, 25, 30, 35, 40], 'up')).toEqual(Array(6).fill(true));
  });

  it('agrees with inOrder: every mark filled exactly when the row is in order', () => {
    for (const dir of DIRS)
      for (const order of ORDERS) {
        const row = deal(order, [3, 17, 42, 256, 731, 999], dir);
        expect(rightSpots(row, dir).every(Boolean)).toBe(inOrder(row, dir));
      }
  });
});

describe('swapAt', () => {
  it('swaps two towers and leaves the rest where they stand', () => {
    expect(swapAt([1, 2, 3, 4, 5, 6], 0, 5)).toEqual([6, 2, 3, 4, 5, 1]);
    expect(swapAt([1, 2, 3, 4, 5, 6], 4, 1)).toEqual([1, 5, 3, 4, 2, 6]);
  });

  it('returns a new row and leaves the old one untouched', () => {
    const row = [3, 1, 2, 4, 5, 6];
    const next = swapAt(row, 0, 1);
    expect(row).toEqual([3, 1, 2, 4, 5, 6]);
    expect(next).not.toBe(row);
  });

  it('gives the same row back when a tower is swapped with itself', () => {
    expect(swapAt([3, 1, 2, 4, 5, 6], 2, 2)).toEqual([3, 1, 2, 4, 5, 6]);
  });
});

describe('swapKind: a backward swap is a slip, a forward one is progress (4.3, 3.3)', () => {
  it('calls a swap forward exactly when it lowers the inversion count and backward when it raises it', () => {
    for (const dir of DIRS)
      for (const order of ORDERS) {
        const row = deal(order, [1, 2, 3, 4, 5, 6], dir);
        const before = inversions(row, dir);
        for (let i = 0; i < 6; i++)
          for (let j = 0; j < 6; j++) {
            if (i === j) continue;
            const after = inversions(swapAt(row, i, j), dir);
            expect(after, 'a swap always changes the count').not.toBe(before);
            expect(swapKind(row, i, j, dir)).toBe(after < before ? 'forward' : 'backward');
          }
      }
  });

  it('does the same with bigger numbers, which are compared by value', () => {
    for (const numbers of NUMBER_SETS.slice(1))
      for (const dir of DIRS)
        for (const order of ORDERS.filter((_, k) => k % 7 === 0)) {
          const row = deal(order, numbers, dir);
          const before = inversions(row, dir);
          for (let i = 0; i < 6; i++)
            for (let j = i + 1; j < 6; j++) {
              const after = inversions(swapAt(row, i, j), dir);
              expect(swapKind(row, i, j, dir)).toBe(after < before ? 'forward' : 'backward');
            }
        }
  });

  it('gives the same answer whichever of the two towers was picked first', () => {
    const row = [4, 1, 6, 2, 5, 3];
    for (const dir of DIRS)
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) expect(swapKind(row, i, j, dir)).toBe(swapKind(row, j, i, dir));
  });

  it('makes no slip for a child who swaps neighbours into place', () => {
    let row = [2, 1, 4, 3, 6, 5];
    for (const [i, j] of [
      [0, 1],
      [2, 3],
      [4, 5],
    ]) {
      expect(swapKind(row, i, j, 'up')).toBe('forward');
      row = swapAt(row, i, j);
    }
    expect(inOrder(row, 'up')).toBe(true);
  });

  it('counts every swap of a row in order as a slip', () => {
    const solved = [1, 2, 3, 4, 5, 6];
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) expect(swapKind(solved, i, j, 'up')).toBe('backward');
    expect(swapKind([6, 5, 4, 3, 2, 1], 0, 5, 'down')).toBe('backward');
  });

  it('reads the direction: the same swap is forward for one order and backward for the other', () => {
    expect(swapKind([2, 1, 3, 4, 5, 6], 0, 1, 'up')).toBe('forward');
    expect(swapKind([2, 1, 3, 4, 5, 6], 0, 1, 'down')).toBe('backward');
  });

  it('calls a tower swapped with itself neither', () => {
    for (let i = 0; i < 6; i++) expect(swapKind([3, 1, 2, 4, 5, 6], i, i, 'up')).toBe('none');
  });
});

describe('hintStep: the tower that belongs in the first wrong spot (4.3)', () => {
  it('names the first wrong spot, where its tower stands, and that tower', () => {
    expect(hintStep([1, 6, 3, 4, 5, 2], 'up')).toEqual({ from: 5, to: 1, value: 2 });
    expect(hintStep([1, 3, 6, 2, 5, 4], 'down')).toEqual({ from: 2, to: 0, value: 6 });
    expect(hintStep([6, 4, 5, 3, 2, 1], 'down')).toEqual({ from: 2, to: 1, value: 5 });
    expect(hintStep([15, 40, 25, 30, 35, 20], 'up')).toEqual({ from: 5, to: 1, value: 20 });
  });

  it('is null once the row is in order', () => {
    expect(hintStep([1, 2, 3, 4, 5, 6], 'up')).toBeNull();
    expect(hintStep([6, 5, 4, 3, 2, 1], 'down')).toBeNull();
    expect(hintStep([100, 200, 300, 400, 500, 600], 'up')).toBeNull();
    expect(hintStep([], 'up')).toBeNull();
  });

  it('agrees with a search by hand for every order, number set and direction', () => {
    for (const numbers of NUMBER_SETS)
      for (const dir of DIRS)
        for (const order of ORDERS) {
          const row = deal(order, numbers, dir);
          const goal = dir === 'up' ? [...numbers] : [...numbers].reverse();
          const to = row.findIndex((v, i) => v !== goal[i]);
          const step = hintStep(row, dir);
          if (to < 0) {
            expect(step).toBeNull();
            continue;
          }
          expect(step).toEqual({ from: row.indexOf(goal[to]), to, value: goal[to] });
          // the arrow and the two rings land on two different towers
          expect(step!.from).not.toBe(step!.to);
          expect(row[step!.from]).toBe(step!.value);
        }
  });

  it('puts the hinted tower in its spot, lowers the inversion count and counts as a forward swap', () => {
    for (const dir of DIRS)
      for (const order of ORDERS) {
        const row = deal(order, [1, 2, 3, 4, 5, 6], dir);
        const step = hintStep(row, dir);
        if (!step) continue;
        const next = swapAt(row, step.from, step.to);
        expect(rightSpots(next, dir)[step.to]).toBe(true);
        expect(inversions(next, dir)).toBeLessThan(inversions(row, dir));
        expect(swapKind(row, step.from, step.to, dir)).toBe('forward');
        expect(fewestSwaps(next, dir)).toBe(fewestSwaps(row, dir) - 1);
      }
  });

  it('leaves the row it is given untouched', () => {
    const row = [1, 6, 3, 4, 5, 2];
    hintStep(row, 'up');
    hintPath(row, 'up');
    expect(row).toEqual([1, 6, 3, 4, 5, 2]);
  });
});

describe('hintPath: following the hint to the end (4.3 content checks)', () => {
  it('solves every order in exactly the fewest swaps, each step lowering the inversion count', () => {
    for (const numbers of NUMBER_SETS)
      for (const dir of DIRS)
        for (const order of ORDERS) {
          const row = deal(order, numbers, dir);
          const path = hintPath(row, dir);
          expect(path).toHaveLength(bfsSwaps(row, dir));
          let at = row;
          for (const step of path) {
            expect(step).toEqual(hintStep(at, dir));
            const next = swapAt(at, step.from, step.to);
            expect(inversions(next, dir)).toBeLessThan(inversions(at, dir));
            at = next;
          }
          expect(inOrder(at, dir)).toBe(true);
        }
  });

  it('fills the spots left to right, one new filled mark per hint', () => {
    const path = hintPath([2, 3, 4, 5, 6, 1], 'up');
    expect(path.map((s) => s.to)).toEqual([0, 1, 2, 3, 4]);
    expect(path.map((s) => s.value)).toEqual([1, 2, 3, 4, 5]);
  });

  it('is empty for a row already in order', () => {
    expect(hintPath([1, 2, 3, 4, 5, 6], 'up')).toEqual([]);
    expect(hintPath([999, 731, 256, 42, 17, 3], 'down')).toEqual([]);
  });
});
