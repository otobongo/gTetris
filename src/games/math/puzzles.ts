/* Brick Calculator content (brief 4.5): 12 levels in 2 chapters, 6 puzzles each, 4 solved finish a level.
   Every puzzle is one fixed sum, "3 + 4 = ?", shown as bricks and typed on the keypad. Puzzles are made
   from the run's seed and the child's age band (set 'math:1:<band>', keepSolved), so a resumed level
   shows the same puzzles. Pure: no React, no DOM. */
import { AGE_BANDS, PUZZLES_PER_LEVEL, type AgeBand } from '../../shared/progress';
import { rng, shuffle } from '../../shared/rng';

export type Op = 'plus' | 'minus';

/** The most bricks the two ten-frames hold, so no total, start or answer is above it (4.5). */
export const MAX_BRICKS = 20;
/** `top` is never under this, so the smallest bands still get a real sum (4.5). */
export const MIN_TOP = 5;

/** What a level asks for: plus only, minus only (answer 1 or more), or both in turn (answer 0 allowed). */
export type LevelKind = Op | 'mixed';

/**
 * Largest total for plus, largest start for minus, by band and kind (4.5): the one table of ceilings.
 * Starting values; the board sets none of them, so tuning is one edit here.
 */
export const CEILINGS: Readonly<Record<AgeBand, Readonly<Record<LevelKind, number>>>> = {
  '3-4': { plus: 5, minus: 5, mixed: 6 },
  '5-6': { plus: 8, minus: 10, mixed: 10 },
  '7-8': { plus: 10, minus: 15, mixed: 20 },
  '9-10': { plus: 15, minus: 20, mixed: 20 },
};

/** `top` as a share of the band's ceiling, for the 4 levels of a group (4.5): 60, 75, 90, then 100 %. */
export const TOP_PERCENT: readonly number[] = [60, 75, 90, 100];
/** `maxB` for the 4 levels of a group: 2, 3, 5, then `top - 1` (null). Never more than `top - 1`. */
export const MAX_B_STEPS: readonly (number | null)[] = [2, 3, 5, null];

/** One level's idea. All 6 puzzles of a level share the operation, `top` and `maxB` (4.5 "Difficulty"). */
export interface LevelDef {
  kind: LevelKind;
  /** Position inside its group of 4 levels, 0 to 3: picks the `top` share and the `maxB` step. */
  step: number;
}

/** The level table (4.5). Level 1 is index 0: Levels 1 to 4 plus, 5 to 8 minus, 9 to 12 both. */
export const LEVELS: readonly LevelDef[] = (['plus', 'minus', 'mixed'] as const).flatMap((kind) =>
  TOP_PERCENT.map((_, step) => ({ kind, step })),
);

export interface Chapter {
  title: string;
  /** Picker note after the heading. */
  note: string;
  start: number;
  count: number;
}

/** Chapters match the game's two stickers (3.4): 4 levels, then 8. */
export const CHAPTERS: readonly Chapter[] = [
  { title: 'Adding', note: 'plus', start: 0, count: 4 },
  { title: 'Taking away', note: 'then plus and minus', start: 4, count: 8 },
];

export function chapterOf(level: number): Chapter {
  return CHAPTERS.find((c) => level >= c.start && level < c.start + c.count) ?? CHAPTERS[0];
}

function checkLevel(level: number): LevelDef {
  const def = LEVELS[level];
  if (!Number.isInteger(level) || !def) throw new RangeError(`Brick Calculator has no level ${level}`);
  return def;
}

function checkBand(band: AgeBand): void {
  if (!AGE_BANDS.includes(band)) throw new RangeError(`Brick Calculator has no age band ${String(band)}`);
}

/** The level's largest total or start (`top`) and largest second number (`maxB`) for this band (4.5). */
export function levelLimits(level: number, band: AgeBand): { top: number; maxB: number } {
  const def = checkLevel(level);
  checkBand(band);
  const share = TOP_PERCENT[def.step];
  // Rounded up, in whole numbers so no float can tip it.
  const top = Math.min(MAX_BRICKS, Math.max(MIN_TOP, Math.floor((CEILINGS[band][def.kind] * share + 99) / 100)));
  const step = MAX_B_STEPS[def.step];
  return { top, maxB: Math.min(step ?? top - 1, top - 1) };
}

/* ---------- Pairs and puzzles ---------- */

export interface Pair {
  op: Op;
  /** First number: the first addend, or the start of a take away. 1 or more. */
  a: number;
  /** Second number: the second addend, or how many are taken away. 1 or more. */
  b: number;
}

export interface MathPuzzle extends Pair {
  /** Level index, 0-based (Level 1 is 0). */
  level: number;
  /** Puzzle number, 0 to 5. */
  n: number;
  /** The right answer, 0 to 20; 0 only on a mixed level. */
  answer: number;
}

export const answerOf = (p: Pair): number => (p.op === 'plus' ? p.a + p.b : p.a - p.b);

/** Ordered pairs a level may use, in a fixed order: every sum within `top` and `maxB` (4.5). */
function pairsFor(op: Op, top: number, maxB: number, zeroOk: boolean): Pair[] {
  const out: Pair[] = [];
  for (let b = 1; b <= maxB; b++) {
    if (op === 'plus') for (let a = 1; a + b <= top; a++) out.push({ op, a, b });
    else for (let a = zeroOk ? b : b + 1; a <= top; a++) out.push({ op, a, b });
  }
  return out;
}

/**
 * Every pair a level and band can deal from, plus first, as ordered pairs: 3 + 4 and 4 + 3 are two
 * pairs here (the dealer prefers one of them, see `twinKey`). The content test reads pool sizes from this.
 */
export function pairPool(level: number, band: AgeBand): Pair[] {
  const def = checkLevel(level);
  const { top, maxB } = levelLimits(level, band);
  const zeroOk = def.kind === 'mixed';
  const ops: Op[] = def.kind === 'mixed' ? ['plus', 'minus'] : [def.kind];
  return ops.flatMap((op) => pairsFor(op, top, maxB, zeroOk));
}

/** A pair's identity in a level: no pair twice. */
export const pairKey = (p: Pair): string => `${p.op}:${p.a}:${p.b}`;
/** Twins share this key: 3 + 4 and 4 + 3 do; a take away has no twin. */
export const twinKey = (p: Pair): string => (p.op === 'plus' ? `plus:${Math.min(p.a, p.b)}:${Math.max(p.a, p.b)}` : pairKey(p));

/** How many pairs a level and band has once twins count as one: the pool the dealer prefers (4.5). */
export function distinctPoolSize(level: number, band: AgeBand): number {
  return new Set(pairPool(level, band).map(twinKey)).size;
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

const stream = (...parts: (string | number)[]) => rng(hashString(['math', ...parts].join('|')));

/** What the dealer asks for, from strict to relaxed; the first level of strictness that deals wins. */
interface Rules {
  /** The first and last sums of the level have different answers too. */
  ring: boolean;
  /** No twin pair: 3 + 4 and 4 + 3 are not both in a level. */
  noTwins: boolean;
  /** At least two sums use a second number above half of `maxB`, so `maxB` shows in play. */
  spread: boolean;
}

const TIERS: readonly Rules[] = [
  { ring: true, noTwins: true, spread: true },
  { ring: false, noTwins: true, spread: true },
  { ring: false, noTwins: true, spread: false },
  { ring: false, noTwins: false, spread: false },
];

/** Most nodes one search may visit before the next, more relaxed tier is tried. */
const NODE_BUDGET = 4000;

/**
 * Picks 6 pairs and puts them in order: no pair twice, no equal answers in a row, `ops` (when given)
 * taking turns, and whatever else `rules` ask. A depth-first search over a seeded shuffle of the pool,
 * so it finds an arrangement whenever one exists inside the budget, and the seed decides which.
 */
function deal(pool: Pair[], ops: Op[] | null, maxB: number, rules: Rules, rand: () => number): Pair[] | null {
  const order = shuffle(pool, rand);
  const isBig = (p: Pair) => p.b * 2 > maxB;
  const bigNeeded = rules.spread ? Math.min(2, new Set(order.filter(isBig).map(twinKey)).size) : 0;
  const seq: Pair[] = [];
  const usedPairs = new Set<string>();
  const usedTwins = new Set<string>();
  let nodes = 0;
  const walk = (big: number): boolean => {
    const at = seq.length;
    if (at === PUZZLES_PER_LEVEL) return true;
    if (big + (PUZZLES_PER_LEVEL - at) < bigNeeded) return false;
    for (const cand of order) {
      if (ops && cand.op !== ops[at]) continue;
      if (usedPairs.has(pairKey(cand))) continue;
      if (rules.noTwins && usedTwins.has(twinKey(cand))) continue;
      const answer = answerOf(cand);
      if (at > 0 && answerOf(seq[at - 1]) === answer) continue;
      if (rules.ring && at === PUZZLES_PER_LEVEL - 1 && answerOf(seq[0]) === answer) continue;
      if (++nodes > NODE_BUDGET) return false;
      seq.push(cand);
      usedPairs.add(pairKey(cand));
      usedTwins.add(twinKey(cand));
      if (walk(big + (isBig(cand) ? 1 : 0))) return true;
      seq.pop();
      usedPairs.delete(pairKey(cand));
      usedTwins.delete(twinKey(cand));
    }
    return false;
  };
  return walk(0) ? seq : null;
}

/**
 * The level's 6 puzzles, by puzzle number (4.5). `level` is 0-based. The same level, seed and band
 * always give the same puzzles. Throws a RangeError for a level or band that does not exist.
 * Rules: 6 different pairs, answers 0 to 20 (0 only on a mixed level), no twin pair unless the pool
 * is short, no two equal answers in a row, and plus and minus taking turns on a mixed level.
 */
export function makePuzzles(level: number, seed: number, band: AgeBand): MathPuzzle[] {
  const def = checkLevel(level);
  checkBand(band);
  const { maxB } = levelLimits(level, band);
  const pool = pairPool(level, band);
  const rand = stream('puzzles', level, band, seed);
  let ops: Op[] | null = null;
  if (def.kind === 'mixed') {
    const first: Op = rand() < 0.5 ? 'plus' : 'minus';
    const second: Op = first === 'plus' ? 'minus' : 'plus';
    ops = Array.from({ length: PUZZLES_PER_LEVEL }, (_, i) => (i % 2 === 0 ? first : second));
  }
  for (const rules of TIERS) {
    const pairs = deal(pool, ops, maxB, rules, rand);
    if (pairs) return pairs.map((p, n) => ({ ...p, level, n, answer: answerOf(p) }));
  }
  throw new RangeError(`Brick Calculator cannot deal 6 sums for level ${level + 1}, band ${band}`);
}

/**
 * The kit's `puzzle(level, n, ctx)` (3.1): puzzle `n` (0 to 5) of a level (0-based). Throws a
 * RangeError when the level, band or puzzle number is out of range.
 */
export function puzzle(level: number, n: number, ctx: { seed: number; band: AgeBand }): MathPuzzle {
  checkLevel(level);
  if (!Number.isInteger(n) || n < 0 || n >= PUZZLES_PER_LEVEL) throw new RangeError(`Brick Calculator has no puzzle ${n}`);
  return makePuzzles(level, ctx.seed, ctx.band)[n];
}

/* ---------- The bricks (7.7) ---------- */

/** What the two ten-frames show: `blue` bricks, `orange` added after them, the last `taken` blue ones faded. */
export interface Bricks {
  blue: number;
  orange: number;
  taken: number;
}

/** The bricks drawn for a sum: plus shows a blue and b orange; minus shows a blue with the last b faded. */
export function bricksOf(p: Pair): Bricks {
  return p.op === 'plus' ? { blue: p.a, orange: p.b, taken: 0 } : { blue: p.a, orange: 0, taken: p.b };
}

/** The sign as drawn in the equation: U+2212 for minus, as on the board (7.7). */
export const signOf = (op: Op): string => (op === 'plus' ? '+' : '−');
