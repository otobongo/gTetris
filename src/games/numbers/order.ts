/* Number Line-up's row rules (brief 4.3): how far a row is from the level's order, what a swap does,
   and the hint's next move. Pure functions over the numbers left to right; no React, no DOM.
   Every row holds different numbers, so the level's order is one sort. */

/** Smallest first ('up') or biggest first ('down'). */
export type Dir = 'up' | 'down';

/** The row in the level's order. */
export function goalOf(row: readonly number[], dir: Dir): number[] {
  return [...row].sort((a, b) => (dir === 'up' ? a - b : b - a));
}

/** True when the row is in the level's order. */
export function inOrder(row: readonly number[], dir: Dir): boolean {
  for (let i = 1; i < row.length; i++) if (dir === 'up' ? row[i] < row[i - 1] : row[i] > row[i - 1]) return false;
  return true;
}

/** Pairs of towers standing the wrong way round for the level's order. 0 means in order. */
export function inversions(row: readonly number[], dir: Dir): number {
  let count = 0;
  for (let i = 0; i < row.length; i++)
    for (let j = i + 1; j < row.length; j++) if (dir === 'up' ? row[i] > row[j] : row[i] < row[j]) count++;
  return count;
}

/** Cycles of the row against the level's order; a tower already in its spot is a cycle of one. */
export function cycles(row: readonly number[], dir: Dir): number {
  const goal = goalOf(row, dir);
  const home = new Map(goal.map((v, i) => [v, i]));
  const seen = row.map(() => false);
  let count = 0;
  for (let i = 0; i < row.length; i++) {
    if (seen[i]) continue;
    count++;
    for (let at = i; !seen[at]; at = home.get(row[at]) ?? at) seen[at] = true;
  }
  return count;
}

/** The fewest swaps that put the row in order: the number of towers minus the cycles (6 minus cycles). */
export function fewestSwaps(row: readonly number[], dir: Dir): number {
  return row.length - cycles(row, dir);
}

/** Which spots already hold the right tower: the filled marks under the well. */
export function rightSpots(row: readonly number[], dir: Dir): boolean[] {
  const goal = goalOf(row, dir);
  return row.map((v, i) => v === goal[i]);
}

/** The row after swapping the towers in spots i and j (0-based). */
export function swapAt(row: readonly number[], i: number, j: number): number[] {
  const next = row.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * What a swap does (4.3 "Stuck, hint, timer, stars"): 'forward' lowers the inversion count and resets
 * the time signal; 'backward' raises it and is a slip. A swap always changes the count by an odd
 * number, so a real swap is never neither. The same spot twice is 'none'.
 */
export type SwapKind = 'forward' | 'backward' | 'none';

export function swapKind(row: readonly number[], i: number, j: number, dir: Dir): SwapKind {
  if (i === j) return 'none';
  const lo = Math.min(i, j);
  const hi = Math.max(i, j);
  const wrongWay = dir === 'up' ? row[lo] > row[hi] : row[lo] < row[hi];
  return wrongWay ? 'forward' : 'backward';
}

/** One hint (4.3): the tower that belongs in the first wrong spot, and that spot. */
export interface HintStep {
  /** Spot (0-based) of the tower that belongs in the first wrong spot: the arrow and a ring go here. */
  from: number;
  /** The first wrong spot (0-based): the second ring goes on the tower standing here. */
  to: number;
  /** The number on the tower at `from`, for the hint line. */
  value: number;
}

/**
 * The hint's next move, the board's "Show me how" demo one step at a time: find the first spot whose
 * tower is wrong and the tower that belongs there. Null once the row is in order. Following it to the
 * end puts the row in order in exactly fewestSwaps moves, and every step lowers the inversion count.
 */
export function hintStep(row: readonly number[], dir: Dir): HintStep | null {
  const goal = goalOf(row, dir);
  const to = row.findIndex((v, i) => v !== goal[i]);
  if (to < 0) return null;
  const from = row.indexOf(goal[to]);
  return { from, to, value: goal[to] };
}

/** Every hint step from this row until it is in order, for checks and tools that follow the hint to the end. */
export function hintPath(row: readonly number[], dir: Dir): HintStep[] {
  const steps: HintStep[] = [];
  let at = row.slice();
  for (let step = hintStep(at, dir); step; step = hintStep(at, dir)) {
    steps.push(step);
    at = swapAt(at, step.from, step.to);
  }
  return steps;
}
