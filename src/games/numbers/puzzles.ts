/* Number Line-up content (brief 4.3): 12 levels in 2 chapters, 6 puzzles each, 4 solved finish a level.
   Every puzzle is six number towers to put in the level's order by swapping two at a time. Puzzles are
   made from the run's seed, so a resumed level shows the same puzzles; Levels 9 to 12 also take the
   child's age band (set 'numbers:1:<band>', keepSolved). Pure: no React, no DOM. */
import { AGE_BANDS, HINTS_PER_RUN, PUZZLES_PER_LEVEL, type AgeBand } from '../../shared/progress';
import { rng, shuffle } from '../../shared/rng';
import type { Dir } from './order';

export type { Dir } from './order';

/** Towers per puzzle. */
export const TOWERS = 6;
/** Hints per level, spent at once (4.3); the run stores what is left in `hintsLeft`. */
export const HINTS_PER_LEVEL = HINTS_PER_RUN;

/**
 * One level's idea and difficulty. All 6 puzzles of a level share the number rule, the direction and
 * the fewest swaps (4.3 "Difficulty").
 * - 'stairs': the numbers 1 to 6, each tower as many bricks high as its number.
 * - 'big': 6 different numbers from the age band's range (BIG_NUMBERS), one brick high, so the child reads them.
 */
export interface LevelDef {
  kind: 'stairs' | 'big';
  dir: Dir;
  /** Fewest swaps that put every puzzle of the level in order (6 minus the number of cycles). */
  swaps: number;
  /** Levels 11 and 12: count by one even step where the band has steps (ages 7 to 10). */
  counting: boolean;
}

/** The level table (4.3). Level 1 is index 0. The fewest-swaps column is a starting value, tuned here in one edit. */
export const LEVELS: readonly LevelDef[] = [
  // Chapter 1: Stairs, smallest first, then biggest first.
  { kind: 'stairs', dir: 'up', swaps: 2, counting: false },
  { kind: 'stairs', dir: 'up', swaps: 3, counting: false },
  { kind: 'stairs', dir: 'up', swaps: 4, counting: false },
  { kind: 'stairs', dir: 'up', swaps: 5, counting: false },
  { kind: 'stairs', dir: 'down', swaps: 2, counting: false },
  { kind: 'stairs', dir: 'down', swaps: 3, counting: false },
  { kind: 'stairs', dir: 'down', swaps: 4, counting: false },
  { kind: 'stairs', dir: 'down', swaps: 5, counting: false },
  // Chapter 2: Bigger numbers, from the age band.
  { kind: 'big', dir: 'up', swaps: 3, counting: false },
  { kind: 'big', dir: 'down', swaps: 4, counting: false },
  { kind: 'big', dir: 'up', swaps: 5, counting: true },
  { kind: 'big', dir: 'down', swaps: 5, counting: true },
];

export interface Chapter {
  title: string;
  /** Picker note after the heading. */
  note: string;
  start: number;
  count: number;
}

/** Chapters match the game's two stickers (3.4): 8 levels, then 4. */
export const CHAPTERS: readonly Chapter[] = [
  { title: 'Stairs', note: '1 to 6, up and down', start: 0, count: 8 },
  { title: 'Bigger numbers', note: 'read the numbers', start: 8, count: 4 },
];

export function chapterOf(level: number): Chapter {
  return CHAPTERS.find((c) => level >= c.start && level < c.start + c.count) ?? CHAPTERS[0];
}

/**
 * Bigger numbers by age band (4.3), the one table to tune: every number is 1 to `max`, and the
 * counting levels count by one of `steps` (15, 20, 25, 30, 35, 40). A band with no steps plays its
 * counting levels with any 6 different numbers, as on Levels 9 and 10.
 */
export const BIG_NUMBERS: Readonly<Record<AgeBand, { max: number; steps: readonly number[] }>> = {
  '3-4': { max: 10, steps: [] },
  '5-6': { max: 20, steps: [] },
  '7-8': { max: 100, steps: [5, 10] },
  '9-10': { max: 999, steps: [5, 10, 100] },
};

/** Whether the level's numbers depend on the age band: Levels 9 to 12. */
export const usesBand = (level: number): boolean => LEVELS[level]?.kind === 'big';

/** The steps a level counts by for this band; empty when its numbers are any 6 different ones. */
export function levelSteps(level: number, band: AgeBand): readonly number[] {
  const def = LEVELS[level];
  return def?.kind === 'big' && def.counting ? BIG_NUMBERS[band].steps : [];
}

/** The lowest and highest number a level may hold for this band. */
export function numberRange(level: number, band: AgeBand): { min: number; max: number } {
  return LEVELS[level]?.kind === 'big' ? { min: 1, max: BIG_NUMBERS[band].max } : { min: 1, max: TOWERS };
}

/* ---------- Tower colours (7.5) ---------- */

export type TowerColor = 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange';

/** Stairs colours by number: 1 green, 2 yellow, 3 red, 4 blue, 5 purple, 6 orange (the `--brick-*` names). */
export const STAIRS_COLORS: readonly TowerColor[] = ['green', 'yellow', 'red', 'blue', 'purple', 'orange'];

/* ---------- Puzzles ---------- */

export interface NumbersPuzzle {
  /** Level index, 0-based (Level 1 is 0). */
  level: number;
  /** Puzzle number, 0 to 5. */
  n: number;
  kind: LevelDef['kind'];
  dir: Dir;
  /** The six numbers left to right as the puzzle starts. Never already in order. */
  start: number[];
  /** The same numbers in the level's order: the goal strip and the solved line. */
  goal: number[];
  /** Fewest swaps from `start` to `goal`: the level's swaps. */
  fewest: number;
  /** The even step on a counting puzzle (5, 10 or 100); null otherwise. */
  step: number | null;
  /** Each number's tower colour. Stairs colour by number; bigger numbers take the six colours in the seed's order. */
  colors: Record<number, TowerColor>;
}

/** Stud bricks under a tower's number face: stairs towers are as many bricks high as their number, bigger numbers one brick. */
export function studCount(p: Pick<NumbersPuzzle, 'kind'>, value: number): number {
  return p.kind === 'stairs' ? Math.max(0, value - 1) : 0;
}

/** FNV-1a, so each level, band and part of a puzzle draws from its own stream of the run's seed. */
function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const stream = (...parts: (string | number)[]) => rng(hashString(['numbers', ...parts].join('|')));

/* Arrangements are rank orders: spot i holds the tower that belongs in spot order[i]. Inversions and
   cycles of a rank order are those of the row it deals, whatever the numbers and direction. */

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1))
    for (let at = 0; at <= rest.length; at++) out.push([...rest.slice(0, at), n - 1, ...rest.slice(at)]);
  return out;
}

function rankInversions(order: readonly number[]): number {
  let count = 0;
  for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) if (order[i] > order[j]) count++;
  return count;
}

function rankSwaps(order: readonly number[]): number {
  const seen = order.map(() => false);
  let cyc = 0;
  for (let i = 0; i < order.length; i++) {
    if (seen[i]) continue;
    cyc++;
    for (let at = i; !seen[at]; at = order[at]) seen[at] = true;
  }
  return order.length - cyc;
}

/** How far apart a level's inversion counts may be (4.3 "Difficulty"). */
export const INVERSION_SPREAD = 2;

/**
 * The rank orders a level with this many fewest swaps deals from: every order of 6 towers with those
 * swaps whose inversion count falls in the busiest window of INVERSION_SPREAD, so a level's 6 puzzles
 * are alike in difficulty. Ties go to the lower window. Worked out once, from all 720 orders.
 */
export const ORDER_POOLS: ReadonlyMap<number, readonly (readonly number[])[]> = (() => {
  const all = permutations(TOWERS);
  const pools = new Map<number, number[][]>();
  for (const swaps of new Set(LEVELS.map((d) => d.swaps))) {
    const same = all.filter((o) => rankSwaps(o) === swaps);
    let best: number[][] = [];
    const most = Math.max(...same.map(rankInversions));
    for (let low = 0; low <= most; low++) {
      const window = same.filter((o) => {
        const inv = rankInversions(o);
        return inv >= low && inv <= low + INVERSION_SPREAD;
      });
      if (window.length > best.length) best = window;
    }
    pools.set(swaps, best);
  }
  return pools;
})();

function checkLevel(level: number): LevelDef {
  const def = LEVELS[level];
  if (!Number.isInteger(level) || !def) throw new RangeError(`Number Line-up has no level ${level}`);
  return def;
}

/** Six different numbers from 1 to max, by a partial Fisher-Yates draw. */
function drawNumbers(max: number, rand: () => number): number[] {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  for (let i = 0; i < TOWERS; i++) {
    const j = i + Math.floor(rand() * (max - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, TOWERS);
}

/** How many times a draw is repeated to keep a level's number sets different. */
const RETRIES = 40;

/** The number set for each of the level's 6 puzzles, smallest first, with its counting step (or null). */
function levelNumbers(level: number, def: LevelDef, band: AgeBand, seed: number): { numbers: number[]; step: number | null }[] {
  if (def.kind === 'stairs') {
    const stairs = Array.from({ length: TOWERS }, (_, i) => i + 1);
    return Array.from({ length: PUZZLES_PER_LEVEL }, () => ({ numbers: stairs.slice(), step: null }));
  }
  const rand = stream('numbers', level, band, seed);
  const { max } = BIG_NUMBERS[band];
  const steps = levelSteps(level, band);
  if (steps.length > 0) {
    // The steps take turns from a seeded first one; each step's runs start at different multiples.
    const first = Math.floor(rand() * steps.length);
    const starts = new Map(
      steps.map((s) => [s, shuffle(Array.from({ length: Math.floor(max / s) - (TOWERS - 1) }, (_, i) => (i + 1) * s), rand)]),
    );
    return Array.from({ length: PUZZLES_PER_LEVEL }, (_, k) => {
      const step = steps[(first + k) % steps.length];
      const from = starts.get(step)?.shift() ?? step;
      return { numbers: Array.from({ length: TOWERS }, (_, i) => from + i * step), step };
    });
  }
  const seen = new Set<string>();
  return Array.from({ length: PUZZLES_PER_LEVEL }, () => {
    let numbers = drawNumbers(max, rand).sort((a, b) => a - b);
    for (let i = 0; i < RETRIES && seen.has(numbers.join(',')); i++) numbers = drawNumbers(max, rand).sort((a, b) => a - b);
    seen.add(numbers.join(','));
    return { numbers, step: null };
  });
}

/**
 * Bigger numbers' colours: the six stairs colours in a seeded order, given smallest number first.
 * Never the stairs order or its reverse, so a colour never tells where a tower goes (4.3).
 */
function bigColors(numbers: readonly number[], rand: () => number): Record<number, TowerColor> {
  let order = shuffle(STAIRS_COLORS as TowerColor[], rand);
  const same = (a: readonly TowerColor[]) => a.every((c, i) => c === order[i]);
  if (same(STAIRS_COLORS) || same([...STAIRS_COLORS].reverse())) order = [...order.slice(1), order[0]];
  return Object.fromEntries(numbers.map((v, i) => [v, order[i]]));
}

/**
 * The level's 6 puzzles, by puzzle number. `level` is 0-based. The seed fixes the arrangements (the
 * same for every band) and, on Levels 9 to 12, the band's numbers and colours, so the same level,
 * seed and band always give the same puzzles, and a band change keeps each puzzle's arrangement while
 * its numbers come from the new band. Throws a RangeError for a level that does not exist.
 */
export function makePuzzles(level: number, seed: number, band: AgeBand): NumbersPuzzle[] {
  const def = checkLevel(level);
  if (!AGE_BANDS.includes(band)) throw new RangeError(`Number Line-up has no age band ${String(band)}`);
  const pool = ORDER_POOLS.get(def.swaps) ?? [];
  const orders = shuffle(pool as number[][], stream('order', level, seed)).slice(0, PUZZLES_PER_LEVEL);
  const colorRand = stream('color', level, band, seed);
  return levelNumbers(level, def, band, seed).map(({ numbers, step }, n) => {
    const goal = def.dir === 'up' ? numbers.slice() : numbers.slice().reverse();
    const colors =
      def.kind === 'stairs' ? Object.fromEntries(numbers.map((v) => [v, STAIRS_COLORS[v - 1]])) : bigColors(numbers, colorRand);
    return {
      level,
      n,
      kind: def.kind,
      dir: def.dir,
      start: orders[n].map((rank) => goal[rank]),
      goal,
      fewest: def.swaps,
      step,
      colors,
    };
  });
}

/**
 * The kit's `puzzle(level, n, ctx)` (3.1): puzzle `n` (0 to 5) of a level (0-based). Throws a
 * RangeError when the level or puzzle number is out of range.
 */
export function puzzle(level: number, n: number, ctx: { seed: number; band: AgeBand }): NumbersPuzzle {
  checkLevel(level);
  if (!Number.isInteger(n) || n < 0 || n >= PUZZLES_PER_LEVEL) throw new RangeError(`Number Line-up has no puzzle ${n}`);
  return makePuzzles(level, ctx.seed, ctx.band)[n];
}
