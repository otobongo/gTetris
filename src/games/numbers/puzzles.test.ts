/** Number Line-up content (brief 4.3 content checks, 7.5, 10.2 "Numbers"): every level x age band over 200 seeds.
    Each puzzle is a permutation of its numbers, not in order, needs the level's fewest swaps by a breadth-first
    search, sits within 2 inversions of its level, differs from the other five, keeps to the band's numbers,
    counts by one even step where it should, and is solved by following the hint. Same seed, same puzzles. */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, PUZZLES_PER_LEVEL, type AgeBand } from '../../shared/progress';
import { hintStep, swapAt } from './order';
import {
  BIG_NUMBERS,
  HINTS_PER_LEVEL,
  INVERSION_SPREAD,
  LEVELS,
  ORDER_POOLS,
  STAIRS_COLORS,
  TOWERS,
  levelSteps,
  makePuzzles,
  numberRange,
  puzzle,
  studCount,
  usesBand,
  type Dir,
  type NumbersPuzzle,
} from './puzzles';

/* ---------- The brief's tables, written out here so the checks never read them back from the code ---------- */

interface Row {
  kind: 'stairs' | 'big';
  dir: Dir;
  swaps: number;
  counting: boolean;
}

/** 4.3 "Content: 12 levels x 6 = 72 puzzles, 2 chapters". */
const TABLE: readonly Row[] = [
  { kind: 'stairs', dir: 'up', swaps: 2, counting: false },
  { kind: 'stairs', dir: 'up', swaps: 3, counting: false },
  { kind: 'stairs', dir: 'up', swaps: 4, counting: false },
  { kind: 'stairs', dir: 'up', swaps: 5, counting: false },
  { kind: 'stairs', dir: 'down', swaps: 2, counting: false },
  { kind: 'stairs', dir: 'down', swaps: 3, counting: false },
  { kind: 'stairs', dir: 'down', swaps: 4, counting: false },
  { kind: 'stairs', dir: 'down', swaps: 5, counting: false },
  { kind: 'big', dir: 'up', swaps: 3, counting: false },
  { kind: 'big', dir: 'down', swaps: 4, counting: false },
  { kind: 'big', dir: 'up', swaps: 5, counting: true },
  { kind: 'big', dir: 'down', swaps: 5, counting: true },
];

/** 4.3 "Bigger numbers, 6 different ones per puzzle". */
const BANDS: Readonly<Record<AgeBand, { max: number; steps: readonly number[] }>> = {
  '3-4': { max: 10, steps: [] },
  '5-6': { max: 20, steps: [] },
  '7-8': { max: 100, steps: [5, 10] },
  '9-10': { max: 999, steps: [5, 10, 100] },
};

/** 7.5 "Number colours": 1 green, 2 yellow, 3 red, 4 blue, 5 purple, 6 orange. */
const COLOURS = ['green', 'yellow', 'red', 'blue', 'purple', 'orange'] as const;

/** 200 seeds: the fixed seed 0, the edges a stored run may hold, and a spread in between. */
const SEEDS: readonly number[] = [
  0,
  1,
  2 ** 31 - 1,
  2 ** 32 - 1,
  Number.MAX_SAFE_INTEGER,
  ...Array.from({ length: 195 }, (_, i) => i * 7919 + 11),
];

/* ---------- Independent reference rules ---------- */

/** Breadth-first search over the 720 orders of six towers, one swap of any two per step. */
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

/** Each tower's spot in the level's order, by counting. */
const ranks = (row: readonly number[], dir: Dir) => row.map((v) => row.filter((w) => (dir === 'up' ? w < v : w > v)).length);
const bfsSwaps = (row: readonly number[], dir: Dir) => DISTANCE.get(ranks(row, dir).join(',')) ?? -1;

function inversionCount(row: readonly number[], dir: Dir): number {
  const r = ranks(row, dir);
  let count = 0;
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (r[i] > r[j]) count++;
  return count;
}

const ascending = (xs: readonly number[]) => xs.slice().sort((a, b) => a - b);
const sameList = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Every way a level's puzzles can break the brief's rules, as readable lines (empty when all is well). */
function problems(level: number, band: AgeBand, seed: number, ps: readonly NumbersPuzzle[]): string[] {
  const row = TABLE[level];
  const at = `Level ${level + 1}, band ${band}, seed ${seed}`;
  const out: string[] = [];
  if (ps.length !== PUZZLES_PER_LEVEL) return [`${at}: ${ps.length} puzzles, not ${PUZZLES_PER_LEVEL}`];
  const counting = row.counting && BANDS[band].steps.length > 0;

  ps.forEach((p, n) => {
    const where = `${at}, puzzle ${n}: ${p.start.join(' ')}`;
    const numbers = ascending(p.start);
    if (p.level !== level || p.n !== n) out.push(`${where}: labelled level ${p.level} puzzle ${p.n}`);
    if (p.kind !== row.kind || p.dir !== row.dir) out.push(`${where}: ${p.kind} ${p.dir}, not ${row.kind} ${row.dir}`);
    if (p.start.length !== TOWERS || new Set(p.start).size !== TOWERS) out.push(`${where}: not six different numbers`);
    // a permutation of its numbers, with the goal in the level's order
    const goal = row.dir === 'up' ? numbers : numbers.slice().reverse();
    if (!sameList(p.goal, goal)) out.push(`${where}: goal ${p.goal.join(' ')} is not its numbers ${row.dir}`);
    if (sameList(p.start, p.goal)) out.push(`${where}: already in order`);
    // fewest swaps, against the search over all 720 orders
    const fewest = bfsSwaps(p.start, row.dir);
    if (fewest !== row.swaps) out.push(`${where}: needs ${fewest} swaps, not ${row.swaps}`);
    if (p.fewest !== row.swaps) out.push(`${where}: says ${p.fewest} fewest swaps, not ${row.swaps}`);
    // numbers: the stairs, or the band's range with at most 3 digits
    for (const v of p.start) if (!Number.isInteger(v) || v < 1 || String(v).length > 3) out.push(`${where}: ${v} is not a 1 to 3 digit number`);
    if (row.kind === 'stairs' && !sameList(numbers, [1, 2, 3, 4, 5, 6])) out.push(`${where}: stairs are not 1 to 6`);
    if (row.kind === 'big' && numbers.some((v) => v > BANDS[band].max)) out.push(`${where}: a number above ${BANDS[band].max}`);
    // counting levels form one even step from the band's steps
    if (counting) {
      const step = numbers[1] - numbers[0];
      if (!BANDS[band].steps.includes(step)) out.push(`${where}: step ${step} is not one of ${BANDS[band].steps.join(', ')}`);
      if (numbers.some((v, i) => i > 0 && v - numbers[i - 1] !== step)) out.push(`${where}: not one even step`);
      if (numbers.some((v) => v % step !== 0)) out.push(`${where}: does not count by ${step}s`);
      if (p.step !== step) out.push(`${where}: step says ${p.step}, the numbers count by ${step}`);
    } else if (p.step !== null) out.push(`${where}: a step of ${p.step} on a level that does not count`);
    // following the hint to the end solves in exactly the fewest swaps, each step lowering the inversions
    let now = p.start.slice();
    let moves = 0;
    for (let step = hintStep(now, row.dir); step && moves <= TOWERS; step = hintStep(now, row.dir)) {
      const next = swapAt(now, step.from, step.to);
      if (inversionCount(next, row.dir) >= inversionCount(now, row.dir)) out.push(`${where}: hint ${moves + 1} does not lower the inversions`);
      now = next;
      moves++;
    }
    if (moves !== row.swaps || !sameList(now, p.goal)) out.push(`${where}: the hint takes ${moves} swaps to ${now.join(' ')}`);
    // colours: by number on the stairs; a seeded order of the six on bigger numbers, never the order itself
    const keys = Object.keys(p.colors).map(Number);
    if (!sameList(ascending(keys), numbers)) out.push(`${where}: colours for ${keys.join(' ')}`);
    const bySize = numbers.map((v) => p.colors[v]);
    if (row.kind === 'stairs' && !sameList(bySize, COLOURS)) out.push(`${where}: stairs colours ${bySize.join(' ')}`);
    if (row.kind === 'big') {
      if (!sameList(ascending(bySize.map((c) => COLOURS.indexOf(c))), [0, 1, 2, 3, 4, 5])) out.push(`${where}: colours are not the six`);
      if (sameList(bySize, COLOURS) || sameList(bySize, [...COLOURS].reverse())) out.push(`${where}: colours give away the order (${bySize.join(' ')})`);
    }
  });

  // one difficulty: inversion counts within 2
  const inv = ps.map((p) => inversionCount(p.start, row.dir));
  if (Math.max(...inv) - Math.min(...inv) > 2) out.push(`${at}: inversions ${inv.join(' ')} spread more than 2`);
  // the 6 differ as orders, and as number sets on Levels 9 to 12
  if (new Set(ps.map((p) => ranks(p.start, row.dir).join(','))).size !== PUZZLES_PER_LEVEL) out.push(`${at}: two puzzles share an order`);
  if (new Set(ps.map((p) => p.start.join(','))).size !== PUZZLES_PER_LEVEL) out.push(`${at}: two puzzles are twins`);
  if (row.kind === 'big' && new Set(ps.map((p) => ascending(p.start).join(','))).size !== PUZZLES_PER_LEVEL)
    out.push(`${at}: two puzzles share a number set`);
  return out;
}

/* ---------- The level table ---------- */

describe('the level table matches the brief (4.3, 7.9)', () => {
  it('holds 12 levels of 6 puzzles, 72 in all, with six towers each', () => {
    expect(LEVELS).toHaveLength(12);
    expect(TOWERS).toBe(6);
    expect(LEVELS.length * PUZZLES_PER_LEVEL).toBe(72);
  });

  it('sets the numbers, order and fewest swaps of every level as the table does', () => {
    expect(LEVELS.map((d) => ({ kind: d.kind, dir: d.dir, swaps: d.swaps, counting: d.counting }))).toEqual(TABLE);
  });

  it('gives 3 hints per level', () => {
    expect(HINTS_PER_LEVEL).toBe(3);
  });

  it('keeps a level’s inversion counts within 2 of each other', () => {
    expect(INVERSION_SPREAD).toBe(2);
  });

  it('holds the bigger-number ranges and counting steps of every age band', () => {
    expect(BIG_NUMBERS).toEqual(BANDS);
    expect(Object.keys(BIG_NUMBERS).sort()).toEqual([...AGE_BANDS].sort());
  });

  it('uses the age band on Levels 9 to 12 only', () => {
    expect(LEVELS.map((_, level) => usesBand(level))).toEqual([...Array(8).fill(false), ...Array(4).fill(true)]);
  });

  it('counts by steps on Levels 11 and 12 at ages 7 to 10 only', () => {
    for (const band of AGE_BANDS)
      LEVELS.forEach((_, level) => {
        expect(levelSteps(level, band), `Level ${level + 1}, ${band}`).toEqual(level >= 10 ? BANDS[band].steps : []);
      });
  });

  it('keeps the stairs to 1 to 6 for every band, and the bigger numbers to the band’s range', () => {
    for (const band of AGE_BANDS)
      LEVELS.forEach((_, level) => {
        expect(numberRange(level, band)).toEqual(level < 8 ? { min: 1, max: 6 } : { min: 1, max: BANDS[band].max });
      });
  });

  it('colours the stairs by number, 1 green to 6 orange', () => {
    expect(STAIRS_COLORS).toEqual(COLOURS);
  });

  it('draws arrangements from pools that hold enough orders, each with its fewest swaps and within the spread', () => {
    for (const swaps of new Set(TABLE.map((r) => r.swaps))) {
      const pool = ORDER_POOLS.get(swaps) ?? [];
      expect(pool.length, `${swaps} swaps`).toBeGreaterThanOrEqual(PUZZLES_PER_LEVEL);
      for (const order of pool) expect(DISTANCE.get(order.join(',')), order.join(',')).toBe(swaps);
      const inv = pool.map((o) => inversionCount(o, 'up'));
      expect(Math.max(...inv) - Math.min(...inv)).toBeLessThanOrEqual(2);
    }
  });
});

/* ---------- The content checks, every level x band over 200 seeds ---------- */

describe('every level x age band over 200 seeds passes the content checks (4.3)', () => {
  for (const band of AGE_BANDS)
    TABLE.forEach((row, level) => {
      it(`Level ${level + 1} (${row.kind} ${row.dir}, ${row.swaps} swaps) at ages ${band}`, () => {
        const found: string[] = [];
        for (const seed of SEEDS) found.push(...problems(level, band, seed, makePuzzles(level, seed, band)));
        expect(found.slice(0, 10)).toEqual([]);
      });
    });
});

describe('the content checks catch a broken level', () => {
  const real = (level: number, band: AgeBand) => structuredClone(makePuzzles(level, 2024, band));
  const caught = (level: number, band: AgeBand, ps: NumbersPuzzle[], text: string) =>
    expect(problems(level, band, 2024, ps).some((line) => line.includes(text)), text).toBe(true);

  it('passes the real levels it is shown', () => {
    for (const band of AGE_BANDS) for (let level = 0; level < 12; level++) expect(problems(level, band, 2024, real(level, band))).toEqual([]);
  });

  it('flags a puzzle already in order, one with the wrong fewest swaps, and twins', () => {
    const solved = real(0, '5-6');
    solved[2].start = solved[2].goal.slice();
    caught(0, '5-6', solved, 'already in order');
    const far = real(0, '5-6');
    far[1].start = [2, 3, 4, 5, 6, 1];
    caught(0, '5-6', far, 'needs 5 swaps, not 2');
    const twins = real(4, '5-6');
    twins[5] = { ...twins[0], n: 5 };
    caught(4, '5-6', twins, 'twins');
  });

  it('flags a level whose inversion counts spread more than 2', () => {
    const ps = real(0, '5-6');
    ps[0].start = [2, 1, 4, 3, 5, 6]; // 2 swaps, 2 inversions
    ps[1].start = [6, 5, 3, 4, 2, 1]; // 2 swaps, 14 inversions
    expect(problems(0, '5-6', 2024, ps).filter((line) => line.includes('swaps, not'))).toEqual([]);
    caught(0, '5-6', ps, 'spread more than 2');
  });

  it('flags numbers outside the band, a broken counting run and colours that give the order away', () => {
    const high = real(8, '3-4');
    high[0].start = high[0].start.map((v) => (v === Math.max(...high[0].start) ? 11 : v));
    high[0].goal = ascending(high[0].goal.map((v) => (v === Math.max(...high[0].goal) ? 11 : v)));
    caught(8, '3-4', high, 'a number above 10');
    const run = real(10, '7-8');
    run[0].start = run[0].start.map((v) => (v === Math.max(...run[0].start) ? v + 1 : v));
    run[0].goal = ascending(run[0].start);
    caught(10, '7-8', run, 'not one even step');
    const told = real(9, '9-10');
    told[3].colors = Object.fromEntries(ascending(told[3].start).map((v, i) => [v, COLOURS[i]]));
    caught(9, '9-10', told, 'give away the order');
  });

  it('flags two bigger-number puzzles that share a number set', () => {
    const ps = real(8, '5-6');
    const order = ranks(ps[0].start, 'up');
    const swapped = ascending(ps[1].start);
    ps[0].goal = swapped.slice();
    ps[0].start = order.map((r) => swapped[r]);
    ps[0].colors = ps[1].colors;
    caught(8, '5-6', ps, 'share a number set');
  });
});

describe('tower heights (4.3, 7.5)', () => {
  it('builds stairs towers as many bricks high as their number and bigger numbers one brick high', () => {
    for (const level of [0, 7]) {
      const p = makePuzzles(level, 5, '5-6')[0];
      for (const v of p.start) expect(studCount(p, v) + 1, `tower of ${v}`).toBe(v);
    }
    for (const level of [8, 11])
      for (const band of AGE_BANDS) {
        const p = makePuzzles(level, 5, band)[0];
        for (const v of p.start) expect(studCount(p, v), `tower of ${v}`).toBe(0);
      }
  });
});

describe('age bands (4.3 "Age bands")', () => {
  it('plays Levels 1 to 8 the same for every band', () => {
    for (let level = 0; level < 8; level++)
      for (const seed of SEEDS.slice(0, 50)) {
        const ps = makePuzzles(level, seed, '3-4');
        for (const band of AGE_BANDS.slice(1)) expect(makePuzzles(level, seed, band), `Level ${level + 1}, ${band}, seed ${seed}`).toEqual(ps);
      }
  });

  it('gives Levels 9 to 12 the band’s numbers, reaching both ends of each range', () => {
    for (const band of AGE_BANDS) {
      const seen = new Set<number>();
      for (const seed of SEEDS) for (const level of [8, 9]) for (const p of makePuzzles(level, seed, band)) for (const v of p.start) seen.add(v);
      expect(Math.min(...seen), band).toBe(1);
      expect(Math.max(...seen), band).toBe(BANDS[band].max);
    }
  });

  it('uses every number 1 to 10 at ages 3 to 4 and every number 1 to 20 at ages 5 to 6', () => {
    for (const band of ['3-4', '5-6'] as const) {
      const seen = new Set<number>();
      for (const seed of SEEDS) for (let level = 8; level < 12; level++) for (const p of makePuzzles(level, seed, band)) for (const v of p.start) seen.add(v);
      expect(ascending([...seen])).toEqual(Array.from({ length: BANDS[band].max }, (_, i) => i + 1));
    }
  });

  it('shows three-digit numbers at ages 9 to 10', () => {
    const big = SEEDS.flatMap((seed) => makePuzzles(8, seed, '9-10')).filter((p) => p.start.some((v) => v >= 100));
    expect(big.length).toBeGreaterThan(0);
  });

  it('plays Levels 11 and 12 with any 6 different numbers at ages 3 to 6, as on Levels 9 and 10', () => {
    for (const band of ['3-4', '5-6'] as const)
      for (const level of [10, 11]) {
        const runs = SEEDS.flatMap((seed) => makePuzzles(level, seed, band)).filter((p) => {
          const n = ascending(p.start);
          return n.every((v, i) => i === 0 || v - n[i - 1] === n[1] - n[0]);
        });
        // a random set can form an even run by chance, but not most of the time
        expect(runs.length, `Level ${level + 1}, ${band}`).toBeLessThan(SEEDS.length);
      }
  });

  it('counts by every step the band offers somewhere in each counting level', () => {
    for (const band of ['7-8', '9-10'] as const)
      for (const level of [10, 11])
        for (const seed of SEEDS) {
          const steps = new Set(makePuzzles(level, seed, band).map((p) => p.step));
          expect([...steps].sort((a, b) => a! - b!), `Level ${level + 1}, ${band}, seed ${seed}`).toEqual(BANDS[band].steps);
        }
  });

  it('keeps each puzzle’s arrangement after a band change and takes the new band’s numbers (Level 9 and on)', () => {
    for (let level = 8; level < 12; level++)
      for (const seed of SEEDS.slice(0, 50)) {
        const shape = (band: AgeBand) => makePuzzles(level, seed, band).map((p) => ranks(p.start, p.dir).join(','));
        const first = shape('3-4');
        for (const band of AGE_BANDS.slice(1)) expect(shape(band), `Level ${level + 1}, ${band}, seed ${seed}`).toEqual(first);
      }
  });

  it('gives a different number set after a band change on Level 9 while the fewest swaps stay', () => {
    const seed = 4242;
    const young = makePuzzles(8, seed, '3-4');
    const old = makePuzzles(8, seed, '9-10');
    for (let n = 0; n < PUZZLES_PER_LEVEL; n++) {
      expect(old[n].fewest).toBe(young[n].fewest);
      expect(Math.max(...young[n].start)).toBeLessThanOrEqual(10);
    }
    expect(old.map((p) => p.start.join(','))).not.toEqual(young.map((p) => p.start.join(',')));
  });
});

describe('tower colours follow the seed, never the order (4.3, 7.5)', () => {
  it('lets every bigger-number spot take each of the six colours over the seeds', () => {
    for (const level of [8, 9, 10, 11]) {
      const seen = Array.from({ length: TOWERS }, () => new Set<string>());
      for (const seed of SEEDS)
        for (const p of makePuzzles(level, seed, '7-8')) ascending(p.start).forEach((v, rank) => seen[rank].add(p.colors[v]));
      expect(seen.map((s) => s.size), `Level ${level + 1}`).toEqual(Array(TOWERS).fill(6));
    }
  });

  it('keeps the stairs colours fixed by number whatever the seed', () => {
    for (const seed of SEEDS.slice(0, 20))
      for (const p of makePuzzles(3, seed, '9-10')) for (const v of p.start) expect(p.colors[v]).toBe(COLOURS[v - 1]);
  });
});

/* ---------- Determinism ---------- */

describe('same seed, same puzzles (4.3)', () => {
  it('gives the same puzzles for the same level, seed and band, whatever ran in between', () => {
    for (const band of AGE_BANDS)
      for (let level = 0; level < 12; level++) {
        const first = makePuzzles(level, 777, band);
        for (const seed of SEEDS.slice(0, 5)) makePuzzles(11 - level, seed, AGE_BANDS[(level + 1) % 4]);
        expect(makePuzzles(level, 777, band)).toEqual(first);
      }
  });

  it('is not changed by a change to a puzzle it handed out', () => {
    const ps = makePuzzles(9, 31, '7-8');
    const copy = structuredClone(ps);
    ps[0].start.reverse();
    ps[0].goal.length = 0;
    ps[1].colors[ps[1].start[0]] = 'green';
    expect(makePuzzles(9, 31, '7-8')).toEqual(copy);
  });

  it('gives a different level for each seed', () => {
    for (const band of AGE_BANDS)
      for (let level = 0; level < 12; level++) {
        const levels = new Set(SEEDS.map((seed) => makePuzzles(level, seed, band).map((p) => p.start.join(',')).join('|')));
        expect(levels.size, `Level ${level + 1}, ${band}`).toBe(SEEDS.length);
      }
  });

  it('returns puzzle n of makePuzzles from the kit’s puzzle(level, n, ctx)', () => {
    for (const band of AGE_BANDS)
      for (let level = 0; level < 12; level++) {
        const ps = makePuzzles(level, 2026, band);
        for (let n = 0; n < PUZZLES_PER_LEVEL; n++) expect(puzzle(level, n, { seed: 2026, band })).toEqual(ps[n]);
      }
  });
});

/* ---------- First and last level, band edges ---------- */

describe('edge cases: the first and last level, the youngest and oldest band', () => {
  it('starts Level 1 with the stairs 1 to 6, smallest first, 2 swaps from done', () => {
    for (const p of makePuzzles(0, 0, '3-4')) {
      expect(p).toMatchObject({ level: 0, kind: 'stairs', dir: 'up', fewest: 2, step: null, goal: [1, 2, 3, 4, 5, 6] });
      expect(bfsSwaps(p.start, 'up')).toBe(2);
    }
  });

  it('ends on Level 12, biggest first, 5 swaps, counting by steps for ages 9 to 10', () => {
    const ps = makePuzzles(11, 0, '9-10');
    for (const p of ps) {
      expect(p).toMatchObject({ level: 11, kind: 'big', dir: 'down', fewest: 5 });
      expect(p.goal).toEqual(ascending(p.goal).reverse());
      expect([5, 10, 100]).toContain(p.step);
      expect(Math.max(...p.goal)).toBeLessThanOrEqual(999);
    }
  });

  it('keeps Level 12 for ages 3 to 4 to six different numbers from 1 to 10', () => {
    for (const seed of SEEDS)
      for (const p of makePuzzles(11, seed, '3-4')) {
        expect(new Set(p.start).size).toBe(6);
        expect(p.start.every((v) => v >= 1 && v <= 10)).toBe(true);
        expect(p.step).toBeNull();
      }
  });

  it('hands out puzzle 0 and puzzle 5, the first and last of a level', () => {
    expect(puzzle(0, 0, { seed: 1, band: '3-4' }).n).toBe(0);
    expect(puzzle(11, 5, { seed: 1, band: '9-10' }).n).toBe(5);
  });
});

/* ---------- Error paths ---------- */

describe('error paths (10.2): a level, puzzle or band out of range throws', () => {
  const ctx = { seed: 1, band: '5-6' as AgeBand };

  it('throws a RangeError for a level that does not exist', () => {
    for (const level of [-1, 12, 13, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => makePuzzles(level, 1, '5-6'), `makePuzzles(${level})`).toThrow(RangeError);
      expect(() => puzzle(level, 0, ctx), `puzzle(${level}, 0)`).toThrow(RangeError);
    }
  });

  it('throws a RangeError for a puzzle number outside 0 to 5', () => {
    for (const n of [-1, 6, 7, 2.5, Number.NaN]) {
      expect(() => puzzle(0, n, ctx), `puzzle(0, ${n})`).toThrow(RangeError);
      expect(() => puzzle(11, n, ctx), `puzzle(11, ${n})`).toThrow(RangeError);
    }
  });

  it('throws a RangeError for an age band that does not exist, on every level', () => {
    for (const band of ['', '11-12', '2-3', 'adult', undefined])
      for (const level of [0, 8, 11]) {
        expect(() => makePuzzles(level, 1, band as AgeBand), `Level ${level + 1}, band ${band}`).toThrow(RangeError);
        expect(() => puzzle(level, 0, { seed: 1, band: band as AgeBand })).toThrow(RangeError);
      }
  });

  it('accepts every real level, puzzle number and band', () => {
    for (const band of AGE_BANDS)
      for (let level = 0; level < 12; level++) for (let n = 0; n < PUZZLES_PER_LEVEL; n++) expect(() => puzzle(level, n, { seed: 9, band })).not.toThrow();
  });
});
