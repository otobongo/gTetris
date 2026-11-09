/** Brick Calculator content (brief 4.5 content checks, 7.7, 7.9, 10.2 "Calculator"): every level x age band over 200 seeds.
    Each level deals 6 sums by the 4.5 rules: one operation (plus, minus, or both taking turns), inside the level's `top`
    and `maxB`, both numbers 1 or more, answers 0 to 20 (0 only from Level 9), no pair twice, no twin pair unless the
    pool is short, no two equal answers in a row. Pool sizes per level and band, the bricks drawn for each sum, the
    age bands, same seed same puzzles, the first and last level, and the error paths. */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, PUZZLES_PER_LEVEL, type AgeBand } from '../../shared/progress';
import {
  CEILINGS,
  CHAPTERS,
  LEVELS,
  MAX_BRICKS,
  MAX_B_STEPS,
  MIN_TOP,
  TOP_PERCENT,
  answerOf,
  bricksOf,
  chapterOf,
  distinctPoolSize,
  levelLimits,
  makePuzzles,
  pairPool,
  puzzle,
  signOf,
  type MathPuzzle,
  type Op,
  type Pair,
} from './puzzles';

/* ---------- The brief's tables, written out here so the checks never read them back from the code ---------- */

type Kind = Op | 'mixed';

/** 4.5 "Content": Levels 1 to 4 plus only, 5 to 8 minus only, 9 to 12 plus and minus. */
const KINDS: readonly Kind[] = [...Array<Kind>(4).fill('plus'), ...Array<Kind>(4).fill('minus'), ...Array<Kind>(4).fill('mixed')];

/** 4.5 "Ceiling: adding / taking away / both". */
const CEILING: Readonly<Record<AgeBand, Readonly<Record<Kind, number>>>> = {
  '3-4': { plus: 5, minus: 5, mixed: 6 },
  '5-6': { plus: 8, minus: 10, mixed: 10 },
  '7-8': { plus: 10, minus: 15, mixed: 20 },
  '9-10': { plus: 15, minus: 20, mixed: 20 },
};

/** 4.5: in each group of 4 levels `top` is 60, 75, 90, then 100 % of the ceiling, and `maxB` is 2, 3, 5, then `top - 1`. */
const SHARE = [60, 75, 90, 100] as const;
const B_STEP = [2, 3, 5, null] as const;

/** `top` rounded up and never under 5, `maxB` never more than `top - 1`: the 4.5 rule, worked out here. */
function limits(level: number, band: AgeBand): { top: number; maxB: number } {
  const step = level % 4;
  const top = Math.max(5, Math.ceil((CEILING[band][KINDS[level]] * SHARE[step]) / 100));
  return { top, maxB: Math.min(B_STEP[step] ?? top - 1, top - 1) };
}

/** The same numbers by hand, Levels 1 to 12 as [top, maxB]: a second check of the rule above. */
const BY_HAND: Readonly<Record<AgeBand, readonly (readonly [number, number])[]>> = {
  '3-4': [[5, 2], [5, 3], [5, 4], [5, 4], [5, 2], [5, 3], [5, 4], [5, 4], [5, 2], [5, 3], [6, 5], [6, 5]],
  '5-6': [[5, 2], [6, 3], [8, 5], [8, 7], [6, 2], [8, 3], [9, 5], [10, 9], [6, 2], [8, 3], [9, 5], [10, 9]],
  '7-8': [[6, 2], [8, 3], [9, 5], [10, 9], [9, 2], [12, 3], [14, 5], [15, 14], [12, 2], [15, 3], [18, 5], [20, 19]],
  '9-10': [[9, 2], [12, 3], [14, 5], [15, 14], [12, 2], [15, 3], [18, 5], [20, 19], [12, 2], [15, 3], [18, 5], [20, 19]],
};

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

const key = (p: Pair) => `${p.op}:${p.a}:${p.b}`;
/** 3 + 4 and 4 + 3 are twins; a take away has none. */
const twin = (p: Pair) => (p.op === 'plus' ? `plus:${Math.min(p.a, p.b)}:${Math.max(p.a, p.b)}` : key(p));
const sumOf = (p: Pair) => (p.op === 'plus' ? p.a + p.b : p.a - p.b);
const show = (p: Pair) => `${p.a} ${p.op === 'plus' ? '+' : '-'} ${p.b}`;

/** Every ordered pair a level may use, by the 4.5 rules: plus totals up to `top`, minus starts up to `top`, b up to `maxB`. */
function poolOf(level: number, band: AgeBand): Pair[] {
  const kind = KINDS[level];
  const { top, maxB } = limits(level, band);
  const out: Pair[] = [];
  for (let a = 1; a <= MAX_BRICKS; a++)
    for (let b = 1; b <= maxB; b++) {
      if (kind !== 'minus' && a + b <= top) out.push({ op: 'plus', a, b });
      // minus only: answer 1 or more; mixed levels: answer 0 allowed
      if (kind !== 'plus' && a <= top && a - b >= (kind === 'mixed' ? 0 : 1)) out.push({ op: 'minus', a, b });
    }
  return out;
}

const twinFree = (pool: readonly Pair[]) => new Set(pool.map(twin)).size;
const byOp = <T extends Pair>(pool: readonly T[], op: Op) => pool.filter((p) => p.op === op);

/** The level has room for 6 sums with no twin: 6 twin-free pairs, or 3 of each operation on a mixed level. */
function roomWithoutTwins(level: number, band: AgeBand): boolean {
  const pool = poolOf(level, band);
  if (KINDS[level] !== 'mixed') return twinFree(pool) >= PUZZLES_PER_LEVEL;
  return twinFree(byOp(pool, 'plus')) >= 3 && twinFree(byOp(pool, 'minus')) >= 3;
}

/** Every way a level's puzzles can break the brief's rules, as readable lines (empty when all is well). */
function problems(level: number, band: AgeBand, seed: number, ps: readonly MathPuzzle[]): string[] {
  const kind = KINDS[level];
  const { top, maxB } = limits(level, band);
  const at = `Level ${level + 1}, band ${band}, seed ${seed}`;
  const out: string[] = [];
  if (ps.length !== PUZZLES_PER_LEVEL) return [`${at}: ${ps.length} puzzles, not ${PUZZLES_PER_LEVEL}`];

  ps.forEach((p, n) => {
    const where = `${at}, puzzle ${n}: ${show(p)}`;
    if (p.level !== level || p.n !== n) out.push(`${where}: labelled level ${p.level} puzzle ${p.n}`);
    // the level's operation
    if (p.op !== 'plus' && p.op !== 'minus') out.push(`${where}: unknown operation ${String(p.op)}`);
    else if (kind !== 'mixed' && p.op !== kind) out.push(`${where}: a ${p.op} sum on a ${kind} level`);
    // both numbers 1 or more, inside top and maxB
    if (!Number.isInteger(p.a) || !Number.isInteger(p.b) || p.a < 1 || p.b < 1) out.push(`${where}: a number under 1`);
    if (p.b > maxB) out.push(`${where}: second number above maxB ${maxB}`);
    if (p.op === 'plus' && p.a + p.b > top) out.push(`${where}: total above top ${top}`);
    if (p.op === 'minus' && p.a > top) out.push(`${where}: start above top ${top}`);
    // the answer: right, 0 to 20, 0 only on mixed levels, typeable in 2 digits
    if (p.answer !== sumOf(p)) out.push(`${where}: answer ${p.answer}, not ${sumOf(p)}`);
    if (!Number.isInteger(p.answer) || p.answer < 0 || p.answer > 20) out.push(`${where}: answer ${p.answer} outside 0 to 20`);
    if (p.answer === 0 && kind !== 'mixed') out.push(`${where}: answer 0 before Level 9`);
    if (String(p.answer).length > 2) out.push(`${where}: answer needs more than 2 digits`);
    // the bricks drawn match the sum and fit the two ten-frames
    const bricks = bricksOf(p);
    const want = p.op === 'plus' ? { blue: p.a, orange: p.b, taken: 0 } : { blue: p.a, orange: 0, taken: p.b };
    if (bricks.blue !== want.blue || bricks.orange !== want.orange || bricks.taken !== want.taken) out.push(`${where}: bricks ${JSON.stringify(bricks)}`);
    if (bricks.blue + bricks.orange > MAX_BRICKS) out.push(`${where}: ${bricks.blue + bricks.orange} bricks do not fit two ten-frames`);
    if (bricks.blue + bricks.orange - bricks.taken !== p.answer) out.push(`${where}: the bricks left do not count to the answer`);
  });

  // no pair twice; no twin unless the pool is short; no two equal answers in a row
  if (new Set(ps.map(key)).size !== PUZZLES_PER_LEVEL) out.push(`${at}: a pair twice (${ps.map(show).join(', ')})`);
  if (roomWithoutTwins(level, band) && new Set(ps.map(twin)).size !== PUZZLES_PER_LEVEL) out.push(`${at}: a twin pair (${ps.map(show).join(', ')})`);
  ps.forEach((p, n) => {
    if (n > 0 && p.answer === ps[n - 1].answer) out.push(`${at}: puzzles ${n - 1} and ${n} both make ${p.answer}`);
  });
  // plus and minus take turns on mixed levels, so about half each
  if (kind === 'mixed') {
    ps.forEach((p, n) => {
      if (n > 0 && p.op === ps[n - 1].op) out.push(`${at}: puzzles ${n - 1} and ${n} are both ${p.op}`);
    });
    if (byOp(ps, 'plus').length !== 3) out.push(`${at}: ${byOp(ps, 'plus').length} plus sums, not 3`);
  }
  return out;
}

const sorted = (pool: readonly Pair[]) => pool.map(key).sort();

/* ---------- The level table ---------- */

describe('the level table matches the brief (4.5, 7.9)', () => {
  it('holds 12 levels of 6 puzzles, 72 in all', () => {
    expect(LEVELS).toHaveLength(12);
    expect(LEVELS.length * PUZZLES_PER_LEVEL).toBe(72);
  });

  it('plays plus on Levels 1 to 4, minus on 5 to 8 and both on 9 to 12, each group stepping 0 to 3', () => {
    expect(LEVELS.map((d) => d.kind)).toEqual(KINDS);
    expect(LEVELS.map((d) => d.step)).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]);
  });

  it('holds the ceilings of every age band, the top shares and the maxB steps', () => {
    expect(CEILINGS).toEqual(CEILING);
    expect(Object.keys(CEILINGS).sort()).toEqual([...AGE_BANDS].sort());
    expect(TOP_PERCENT).toEqual(SHARE);
    expect(MAX_B_STEPS).toEqual(B_STEP);
  });

  it('keeps every brick count to the two ten-frames and every top to 5 or more', () => {
    expect(MAX_BRICKS).toBe(20);
    expect(MIN_TOP).toBe(5);
  });

  it('gives each level and band the top and maxB of the 4.5 rule', () => {
    for (const band of AGE_BANDS)
      LEVELS.forEach((_, level) => {
        expect(levelLimits(level, band), `Level ${level + 1}, ${band}`).toEqual(limits(level, band));
        const [top, maxB] = BY_HAND[band][level];
        expect(levelLimits(level, band), `Level ${level + 1}, ${band}, by hand`).toEqual({ top, maxB });
      });
  });

  it('gives ages 3 to 4 the same numbers on Levels 3 and 4, 7 and 8, and 11 and 12, as 4.5 says', () => {
    expect([levelLimits(2, '3-4'), levelLimits(3, '3-4')]).toEqual([{ top: 5, maxB: 4 }, { top: 5, maxB: 4 }]);
    expect([levelLimits(6, '3-4'), levelLimits(7, '3-4')]).toEqual([{ top: 5, maxB: 4 }, { top: 5, maxB: 4 }]);
    expect([levelLimits(10, '3-4'), levelLimits(11, '3-4')]).toEqual([{ top: 6, maxB: 5 }, { top: 6, maxB: 5 }]);
  });

  it('never sets maxB above top - 1, nor top under 5 or above 20', () => {
    for (const band of AGE_BANDS)
      LEVELS.forEach((_, level) => {
        const { top, maxB } = levelLimits(level, band);
        expect(maxB, `Level ${level + 1}, ${band}`).toBeLessThanOrEqual(top - 1);
        expect(maxB).toBeGreaterThanOrEqual(1);
        expect(top).toBeGreaterThanOrEqual(5);
        expect(top).toBeLessThanOrEqual(20);
      });
  });

  it('never gets easier inside a group of 4 levels, nor for an older band', () => {
    for (const band of AGE_BANDS)
      for (let level = 0; level < 12; level++) {
        const now = levelLimits(level, band);
        if (level % 4 > 0) {
          const before = levelLimits(level - 1, band);
          expect(now.top, `Level ${level + 1}, ${band}`).toBeGreaterThanOrEqual(before.top);
          expect(now.maxB, `Level ${level + 1}, ${band}`).toBeGreaterThanOrEqual(before.maxB);
        }
        const older = AGE_BANDS[AGE_BANDS.indexOf(band) + 1];
        if (older) {
          expect(levelLimits(level, older).top, `Level ${level + 1}, ${older}`).toBeGreaterThanOrEqual(now.top);
          expect(levelLimits(level, older).maxB, `Level ${level + 1}, ${older}`).toBeGreaterThanOrEqual(now.maxB);
        }
      }
  });

  it('holds the two chapters that match the game’s two stickers: Adding, then Taking away (3.4)', () => {
    expect(CHAPTERS).toEqual([
      { title: 'Adding', note: 'plus', start: 0, count: 4 },
      { title: 'Taking away', note: 'then plus and minus', start: 4, count: 8 },
    ]);
    expect(LEVELS.map((_, level) => chapterOf(level).title)).toEqual([...Array(4).fill('Adding'), ...Array(8).fill('Taking away')]);
    expect(chapterOf(3).title).toBe('Adding');
    expect(chapterOf(4).title).toBe('Taking away');
    expect(chapterOf(11).title).toBe('Taking away');
  });
});

/* ---------- Pools ---------- */

describe('pool sizes per level and band (4.5 content checks)', () => {
  it('offers exactly the pairs the 4.5 rules allow, each once', () => {
    for (const band of AGE_BANDS)
      LEVELS.forEach((_, level) => {
        expect(sorted(pairPool(level, band)), `Level ${level + 1}, ${band}`).toEqual(sorted(poolOf(level, band)));
        expect(new Set(pairPool(level, band).map(key)).size).toBe(pairPool(level, band).length);
      });
  });

  it('holds at least 6 pairs, and 6 with twins counted once, for every level and band (3 of each operation on mixed levels)', () => {
    for (const band of AGE_BANDS)
      LEVELS.forEach((_, level) => {
        const pool = poolOf(level, band);
        const at = `Level ${level + 1}, ${band}`;
        expect(pool.length, at).toBeGreaterThanOrEqual(PUZZLES_PER_LEVEL);
        expect(twinFree(pool), at).toBeGreaterThanOrEqual(PUZZLES_PER_LEVEL);
        expect(distinctPoolSize(level, band), at).toBe(twinFree(pool));
        if (KINDS[level] === 'mixed')
          for (const op of ['plus', 'minus'] as const) expect(twinFree(byOp(pool, op)), `${at}, ${op}`).toBeGreaterThanOrEqual(3);
      });
  });

  it('lists the pools under 8: three of 7 pairs, and six under 8 once twins count once', () => {
    const under = (size: (level: number, band: AgeBand) => number) =>
      AGE_BANDS.flatMap((band) => LEVELS.map((_, level) => ({ level: level + 1, band, size: size(level, band) }))).filter((x) => x.size < 8);
    expect(under((level, band) => poolOf(level, band).length)).toEqual([
      { level: 1, band: '3-4', size: 7 },
      { level: 5, band: '3-4', size: 7 },
      { level: 1, band: '5-6', size: 7 },
    ]);
    expect(under((level, band) => twinFree(poolOf(level, band)))).toEqual([
      { level: 1, band: '3-4', size: 6 },
      { level: 2, band: '3-4', size: 6 },
      { level: 3, band: '3-4', size: 6 },
      { level: 4, band: '3-4', size: 6 },
      { level: 5, band: '3-4', size: 7 },
      { level: 1, band: '5-6', size: 6 },
    ]);
  });

  it('has room for a level with no twin everywhere, so no level counts as short', () => {
    for (const band of AGE_BANDS) LEVELS.forEach((_, level) => expect(roomWithoutTwins(level, band), `Level ${level + 1}, ${band}`).toBe(true));
  });

  it('puts plus pairs first on a mixed level and only the level’s operation elsewhere', () => {
    for (const band of AGE_BANDS)
      LEVELS.forEach((_, level) => {
        const ops = pairPool(level, band).map((p) => p.op);
        const kind = KINDS[level];
        if (kind === 'mixed') expect(ops.indexOf('minus'), `Level ${level + 1}, ${band}`).toBe(ops.lastIndexOf('plus') + 1);
        else expect(new Set(ops), `Level ${level + 1}, ${band}`).toEqual(new Set([kind]));
      });
  });
});

/* ---------- The content checks, every level x band over 200 seeds ---------- */

describe('every level x age band over 200 seeds passes the content checks (4.5)', () => {
  for (const band of AGE_BANDS)
    LEVELS.forEach((_, level) => {
      const { top, maxB } = limits(level, band);
      it(`Level ${level + 1} (${KINDS[level]}, top ${top}, maxB ${maxB}) at ages ${band}`, () => {
        const found: string[] = [];
        for (const seed of SEEDS) found.push(...problems(level, band, seed, makePuzzles(level, seed, band)));
        expect(found.slice(0, 10)).toEqual([]);
      });
    });
});

describe('the content checks catch a broken level', () => {
  const real = (level: number, band: AgeBand) => structuredClone(makePuzzles(level, 2024, band));
  const caught = (level: number, band: AgeBand, ps: MathPuzzle[], text: string) =>
    expect(problems(level, band, 2024, ps).some((line) => line.includes(text)), text).toBe(true);
  const set = (p: MathPuzzle, pair: Pair): MathPuzzle => ({ ...p, ...pair, answer: sumOf(pair) });

  it('passes the real levels it is shown', () => {
    for (const band of AGE_BANDS) for (let level = 0; level < 12; level++) expect(problems(level, band, 2024, real(level, band))).toEqual([]);
  });

  it('flags a pair twice, a twin pair and two equal answers in a row', () => {
    const twice = real(5, '9-10');
    twice[4] = { ...twice[1], n: 4 };
    caught(5, '9-10', twice, 'a pair twice');
    const twins = real(3, '9-10');
    twins[0] = set(twins[0], { op: 'plus', a: 2, b: 9 });
    twins[3] = set(twins[3], { op: 'plus', a: 9, b: 2 });
    caught(3, '9-10', twins, 'a twin pair');
    const row = real(4, '7-8');
    row[2] = set(row[2], { op: 'minus', a: 9, b: 2 });
    row[3] = set(row[3], { op: 'minus', a: 8, b: 1 });
    caught(4, '7-8', row, 'both make 7');
  });

  it('flags a sum outside top or maxB, the wrong operation and a wrong answer', () => {
    const big = real(0, '5-6');
    big[1] = set(big[1], { op: 'plus', a: 2, b: 3 });
    caught(0, '5-6', big, 'above maxB 2');
    big[2] = set(big[2], { op: 'plus', a: 5, b: 1 });
    caught(0, '5-6', big, 'total above top 5');
    const op = real(6, '5-6');
    op[0] = set(op[0], { op: 'plus', a: 2, b: 2 });
    caught(6, '5-6', op, 'a plus sum on a minus level');
    const wrong = real(2, '3-4');
    wrong[5] = { ...wrong[5], answer: wrong[5].answer + 1 };
    caught(2, '3-4', wrong, `answer ${wrong[5].answer}, not`);
  });

  it('flags answer 0 before Level 9 and two plus sums in a row on a mixed level', () => {
    const zero = real(7, '7-8');
    zero[0] = set(zero[0], { op: 'minus', a: 4, b: 4 });
    caught(7, '7-8', zero, 'answer 0 before Level 9');
    const turns = real(8, '7-8');
    const next = turns.findIndex((p) => p.op === 'plus') + 1;
    turns[next] = set(turns[next], { op: 'plus', a: 1, b: 1 });
    caught(8, '7-8', turns, 'are both plus');
  });
});

/* ---------- Over the seeds ---------- */

describe('what the seeds deal (4.5)', () => {
  const dealt = (level: number, band: AgeBand) => SEEDS.flatMap((seed) => makePuzzles(level, seed, band));

  it('reaches each level’s maxB and top somewhere over the seeds, so the level is as hard as its numbers say', () => {
    for (const band of AGE_BANDS)
      LEVELS.forEach((_, level) => {
        const { top, maxB } = limits(level, band);
        const ps = dealt(level, band);
        const at = `Level ${level + 1}, ${band}`;
        expect(Math.max(...ps.map((p) => p.b)), at).toBe(maxB);
        for (const op of KINDS[level] === 'mixed' ? (['plus', 'minus'] as const) : [KINDS[level] as Op]) {
          const reach = byOp(ps, op).map((p) => (op === 'plus' ? p.a + p.b : p.a));
          expect(Math.max(...reach), `${at}, ${op}`).toBe(top);
        }
      });
  });

  it('asks for 0 on every mixed level of every band, and never before Level 9', () => {
    for (const band of AGE_BANDS)
      LEVELS.forEach((_, level) => {
        const zeros = dealt(level, band).filter((p) => p.answer === 0).length;
        if (KINDS[level] === 'mixed') expect(zeros, `Level ${level + 1}, ${band}`).toBeGreaterThan(0);
        else expect(zeros, `Level ${level + 1}, ${band}`).toBe(0);
      });
  });

  it('keeps answers to 1 or more on minus levels and 2 or more on every plus sum', () => {
    for (const band of AGE_BANDS)
      LEVELS.forEach((_, level) => {
        for (const p of dealt(level, band)) {
          if (KINDS[level] === 'minus') expect(p.answer, show(p)).toBeGreaterThanOrEqual(1);
          if (p.op === 'plus') expect(p.answer, show(p)).toBeGreaterThanOrEqual(2);
        }
      });
  });

  it('starts a mixed level with plus for some seeds and minus for others', () => {
    for (const band of AGE_BANDS)
      for (let level = 8; level < 12; level++) {
        const firsts = new Set(SEEDS.map((seed) => makePuzzles(level, seed, band)[0].op));
        expect(firsts, `Level ${level + 1}, ${band}`).toEqual(new Set(['plus', 'minus']));
      }
  });

  it('uses every twin-free sum of a pool of exactly 6, as ages 3 to 4 have on Levels 1 to 4', () => {
    for (let level = 0; level < 4; level++)
      for (const seed of SEEDS.slice(0, 50)) {
        const ps = makePuzzles(level, seed, '3-4');
        expect(new Set(ps.map(twin)), `Level ${level + 1}, seed ${seed}`).toEqual(new Set(poolOf(level, '3-4').map(twin)));
      }
  });

  it('lets ages 3 to 4 meet a sum again on a later level, but never twice in one level', () => {
    const seen = LEVELS.map((_, level) => makePuzzles(level, 99, '3-4').map(key));
    for (const keys of seen) expect(new Set(keys).size).toBe(PUZZLES_PER_LEVEL);
    const again = seen.some((keys, level) => level > 0 && keys.some((k) => seen.slice(0, level).flat().includes(k)));
    expect(again).toBe(true);
  });
});

/* ---------- Age bands ---------- */

describe('age bands (4.5 "Age bands")', () => {
  it('plays the same 12 levels for every band: the level sets the operation, the band the numbers', () => {
    for (const band of AGE_BANDS)
      LEVELS.forEach((_, level) => {
        const ops = new Set(makePuzzles(level, 5, band).map((p) => p.op));
        expect(ops, `Level ${level + 1}, ${band}`).toEqual(KINDS[level] === 'mixed' ? new Set(['plus', 'minus']) : new Set([KINDS[level]]));
      });
  });

  it('deals from the new band’s numbers after a band change, with the same seed', () => {
    for (const seed of SEEDS.slice(0, 50))
      for (const level of [0, 4, 8, 11]) {
        const young = makePuzzles(level, seed, '3-4');
        const old = makePuzzles(level, seed, '9-10');
        expect(problems(level, '9-10', seed, old)).toEqual([]);
        expect(old.map(key), `Level ${level + 1}, seed ${seed}`).not.toEqual(young.map(key));
      }
  });

  it('shows ages 9 to 10 numbers that ages 3 to 4 never meet, on every level', () => {
    for (let level = 0; level < 12; level++) {
      const young = limits(level, '3-4');
      const beyond = SEEDS.flatMap((seed) => makePuzzles(level, seed, '9-10')).filter((p) => p.b > young.maxB || p.a > young.top || p.answer > young.top);
      expect(beyond.length, `Level ${level + 1}`).toBeGreaterThan(0);
    }
  });

  it('fills both ten-frames (20 bricks) only where top is 20: Level 12 at ages 7 to 10 and Level 8 at ages 9 to 10', () => {
    const full = new Set<string>();
    for (const band of AGE_BANDS)
      LEVELS.forEach((_, level) => {
        const twenty = SEEDS.some((seed) => makePuzzles(level, seed, band).some((p) => bricksOf(p).blue + bricksOf(p).orange === 20));
        if (twenty) full.add(`Level ${level + 1}, ${band}`);
      });
    expect([...full].sort()).toEqual(['Level 12, 7-8', 'Level 12, 9-10', 'Level 8, 9-10']);
  });
});

/* ---------- The bricks (7.7) ---------- */

describe('the bricks drawn (4.5, 7.7)', () => {
  it('shows a blue and b orange for a plus sum, nothing taken', () => {
    expect(bricksOf({ op: 'plus', a: 3, b: 4 })).toEqual({ blue: 3, orange: 4, taken: 0 });
    expect(bricksOf({ op: 'plus', a: 1, b: 19 })).toEqual({ blue: 1, orange: 19, taken: 0 });
  });

  it('shows a blue for a take away with the last b of them taken away, and no orange', () => {
    expect(bricksOf({ op: 'minus', a: 7, b: 3 })).toEqual({ blue: 7, orange: 0, taken: 3 });
    expect(bricksOf({ op: 'minus', a: 20, b: 19 })).toEqual({ blue: 20, orange: 0, taken: 19 });
  });

  it('takes every brick away when the answer is 0', () => {
    expect(bricksOf({ op: 'minus', a: 4, b: 4 })).toEqual({ blue: 4, orange: 0, taken: 4 });
  });

  it('works out each answer from its pair', () => {
    expect(answerOf({ op: 'plus', a: 3, b: 4 })).toBe(7);
    expect(answerOf({ op: 'minus', a: 7, b: 3 })).toBe(4);
    expect(answerOf({ op: 'minus', a: 5, b: 5 })).toBe(0);
  });

  it('draws plus as + and minus as the minus sign U+2212, not a hyphen or a dash', () => {
    expect(signOf('plus')).toBe('+');
    expect(signOf('minus')).toBe('−');
    expect(signOf('minus')).not.toMatch(/[-–—]/);
  });
});

/* ---------- Determinism ---------- */

describe('same seed, same puzzles (4.5)', () => {
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
    ps[0].a = 99;
    ps[1].answer = -1;
    ps.reverse();
    expect(makePuzzles(9, 31, '7-8')).toEqual(copy);
  });

  it('deals a different level for most seeds, even from the smallest pools', () => {
    for (const band of AGE_BANDS)
      for (let level = 0; level < 12; level++) {
        const levels = new Set(SEEDS.map((seed) => makePuzzles(level, seed, band).map(key).join('|')));
        expect(levels.size, `Level ${level + 1}, ${band}`).toBeGreaterThan(SEEDS.length / 2);
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
  it('starts Level 1 for ages 3 to 4 with plus sums up to 5 and a second number of 1 or 2', () => {
    for (const seed of SEEDS)
      for (const p of makePuzzles(0, seed, '3-4')) {
        expect(p).toMatchObject({ level: 0, op: 'plus' });
        expect(p.a + p.b).toBeLessThanOrEqual(5);
        expect([1, 2]).toContain(p.b);
      }
  });

  it('ends on Level 12 for ages 9 to 10 with plus and minus up to 20, the second number up to 19', () => {
    for (const seed of SEEDS)
      for (const p of makePuzzles(11, seed, '9-10')) {
        expect(p.level).toBe(11);
        expect(p.b).toBeLessThanOrEqual(19);
        expect(p.op === 'plus' ? p.a + p.b : p.a).toBeLessThanOrEqual(20);
        expect(p.answer).toBeLessThanOrEqual(20);
      }
  });

  it('keeps the youngest band’s last level to 6 and its second number to 5', () => {
    for (const seed of SEEDS)
      for (const p of makePuzzles(11, seed, '3-4')) {
        expect(p.op === 'plus' ? p.a + p.b : p.a).toBeLessThanOrEqual(6);
        expect(p.b).toBeLessThanOrEqual(5);
      }
  });

  it('hands out puzzle 0 and puzzle 5, the first and last of a level', () => {
    expect(puzzle(0, 0, { seed: 1, band: '3-4' })).toMatchObject({ level: 0, n: 0 });
    expect(puzzle(11, 5, { seed: 1, band: '9-10' })).toMatchObject({ level: 11, n: 5 });
  });
});

/* ---------- Error paths ---------- */

describe('error paths (10.2): a level, puzzle or band out of range throws', () => {
  const ctx = { seed: 1, band: '5-6' as AgeBand };

  it('throws a RangeError for a level that does not exist', () => {
    for (const level of [-1, 12, 13, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => makePuzzles(level, 1, '5-6'), `makePuzzles(${level})`).toThrow(RangeError);
      expect(() => puzzle(level, 0, ctx), `puzzle(${level}, 0)`).toThrow(RangeError);
      expect(() => levelLimits(level, '5-6'), `levelLimits(${level})`).toThrow(RangeError);
      expect(() => pairPool(level, '5-6'), `pairPool(${level})`).toThrow(RangeError);
      expect(() => distinctPoolSize(level, '5-6'), `distinctPoolSize(${level})`).toThrow(RangeError);
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
      for (const level of [0, 4, 8, 11]) {
        expect(() => makePuzzles(level, 1, band as AgeBand), `Level ${level + 1}, band ${band}`).toThrow(RangeError);
        expect(() => puzzle(level, 0, { seed: 1, band: band as AgeBand })).toThrow(RangeError);
        expect(() => levelLimits(level, band as AgeBand)).toThrow(RangeError);
        expect(() => pairPool(level, band as AgeBand)).toThrow(RangeError);
      }
  });

  it('accepts every real level, puzzle number and band', () => {
    for (const band of AGE_BANDS)
      for (let level = 0; level < 12; level++) for (let n = 0; n < PUZZLES_PER_LEVEL; n++) expect(() => puzzle(level, n, { seed: 9, band })).not.toThrow();
  });
});
