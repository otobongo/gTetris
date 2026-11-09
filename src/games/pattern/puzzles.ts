/* Pattern Train puzzles (brief 4.4): a level's 6 trains made from the level table and the run's seed.
   Pure and deterministic: the same (level, seed) always gives the same 6 puzzles, so a resumed level shows the
   same trains and a grown-up's replay (a new seed) shows new ones. The age band changes nothing here. No React,
   no DOM.

   A train is the pattern's cars in a row, the empty car at the end, and 3 cars to choose from. The answer is the
   car the pattern puts next. Raise PATTERN_SET_VERSION (the `pattern:<version>` set in run.ts) whenever a rule
   here changes, so stored runs restart at puzzle 1 (brief 6). */
import { PUZZLES_PER_LEVEL, type AgeBand } from '../../shared/progress';
import { rng, shuffle } from '../../shared/rng';
import { colorsFit } from '../kit/colorPairs';
import { ALL_CARS, CAR_COLORS, SHAPES, carKey, sameCar, type Car, type CarColor, type ShapeId } from './cars';
import { MAX_SHOWN, PATTERN_UNIT, distinctCars, levelDef, type Change, type LevelDef, type PatternId } from './levels';

export const PATTERN_SET_VERSION = 1;

/** Choices under the train (brief 4.4: the tray holds 3 cars). */
export const OPTION_COUNT = 3;

export interface PatternPuzzle {
  level: number;
  /** Puzzle number inside the level, 0 to 5. */
  n: number;
  pattern: PatternId;
  /** The cars shown before the empty one: 4 on Levels 1 to 3, 5 after. */
  cars: Car[];
  /** The car the pattern puts next. */
  answer: Car;
  /** The 3 cars to choose from, in tray order: exactly one is the answer. */
  options: Car[];
  /** Where the answer sits in `options`: 0, 1 or 2. */
  answerAt: number;
}

/* ---------- Trains ---------- */

/**
 * The train a pattern makes from its different cars (`letters`: A, B, C, D in order): `shown` cars, then the car
 * that comes next. ABC with red circle, blue square, yellow triangle and 5 shown gives red circle, blue square,
 * yellow triangle, red circle, blue square, then yellow triangle.
 */
export function trainOf(pattern: PatternId, letters: readonly Car[], shown: number): { cars: Car[]; answer: Car } {
  const unit = PATTERN_UNIT[pattern];
  const at = (i: number): Car => ({ ...letters[unit[i % unit.length]] });
  return { cars: Array.from({ length: shown }, (_, i) => at(i)), answer: at(shown) };
}

/**
 * The smallest repeat length that fits the cars: the least p with car i equal to car i - p all the way along.
 * A train has one reading when this equals the pattern's length (brief 4.4): red, red, red reads as length 1.
 */
export function smallestRepeat(cars: readonly Car[]): number {
  for (let p = 1; p < cars.length; p++) {
    let fits = true;
    for (let i = p; i < cars.length && fits; i++) fits = sameCar(cars[i], cars[i - p]);
    if (fits) return p;
  }
  return cars.length;
}

/** The pattern, from the repeat length of a train: the next car is the one `p` back from the empty car. */
export const predictNext = (cars: readonly Car[]): Car => cars[cars.length - smallestRepeat(cars)];

/** True when the shown cars have one reading, it is the pattern's length and it predicts the answer (4.4). */
export function hasOneReading(pattern: PatternId, cars: readonly Car[], answer: Car): boolean {
  const p = smallestRepeat(cars);
  return p === PATTERN_UNIT[pattern].length && p < cars.length && sameCar(cars[cars.length - p], answer);
}

/** The cars of a train as a set, order and repeats gone: the key the level uses to vary its 6 puzzles. */
export const carSetKey = (cars: readonly Car[]): string => [...new Set(cars.map(carKey))].sort().join('|');

/* ---------- The level's attribute rules ---------- */

/** Does `c` differ from the answer the way the level's wrong options must? Colour-only levels keep the answer's shape, shape-only levels its colour, and both-levels change both. */
function wrongFits(change: Change, answer: Car, c: Car): boolean {
  if (sameCar(c, answer)) return false;
  if (change === 'color') return c.shape === answer.shape;
  if (change === 'shape') return c.color === answer.color;
  return c.shape !== answer.shape && c.color !== answer.color;
}

/** Do two different cars of the pattern differ the way the level says? */
const carsDiffer = wrongFits;

/* ---------- Candidates ---------- */

function perms<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((item, i) => perms([...items.slice(0, i), ...items.slice(i + 1)], k - 1).map((rest) => [item, ...rest]));
}

const candidateCache = new Map<string, Car[][]>();

/**
 * Every set of `k` different cars (in A, B, C order) a level with this `change` can use. Both: `k` shapes and
 * `k` colours, all different. Colour only: one shape, `k` colours that never meet on the avoid list (9.4). Shape
 * only: one colour, `k` shapes.
 */
function candidates(change: Change, k: number): Car[][] {
  const hit = candidateCache.get(`${change}:${k}`);
  if (hit) return hit;
  const out: Car[][] = [];
  if (change === 'both') {
    for (const shapes of perms(SHAPES, k)) for (const colors of perms(CAR_COLORS, k)) out.push(shapes.map((shape, i) => ({ shape, color: colors[i] })));
  } else if (change === 'color') {
    for (const shape of SHAPES) for (const colors of perms(CAR_COLORS, k)) if (colorsFit(colors)) out.push(colors.map((color) => ({ shape, color })));
  } else {
    for (const color of CAR_COLORS) for (const shapes of perms(SHAPES, k)) out.push(shapes.map((shape) => ({ shape, color })));
  }
  candidateCache.set(`${change}:${k}`, out);
  return out;
}

/* ---------- Options ---------- */

/**
 * The 3 cars to choose from for a train, or null when the level's rules leave no valid set (the generator then
 * tries another train). The answer sits at `answerAt`. Wrong options follow brief 4.4: at least one other car of
 * the pattern (for ABCD, the car just before the empty one), the rest from the pattern or from outside it; they
 * keep the answer's shape on colour-only levels, its colour on shape-only levels and differ in both on the rest;
 * on colour-only levels no colour pair on the avoid list shares the puzzle.
 */
export function optionsFor(def: LevelDef, pattern: PatternId, letters: readonly Car[], answerAt: number, rand: () => number): Car[] | null {
  const { cars, answer } = trainOf(pattern, letters, def.shown);
  const colorOnly = def.change === 'color';
  const others = letters.filter((c) => !sameCar(c, answer));
  const outside = ALL_CARS.filter(
    (c) =>
      !letters.some((l) => sameCar(l, c)) &&
      wrongFits(def.change, answer, c) &&
      (!colorOnly || colorsFit([...letters.map((l) => l.color), c.color])),
  );

  const previous = cars[cars.length - 1];
  const first = pattern === 'ABCD' && !sameCar(previous, answer) ? previous : others[Math.floor(rand() * others.length)];
  if (!first) return null;
  const morePattern = others.filter((c) => !sameCar(c, first));
  let second: Car | undefined;
  if (morePattern.length > 0 && (outside.length === 0 || rand() < 0.5)) second = morePattern[Math.floor(rand() * morePattern.length)];
  else second = outside[Math.floor(rand() * outside.length)];
  if (!second) return null;

  const wrong = shuffle([first, second], rand);
  return [...wrong.slice(0, answerAt), answer, ...wrong.slice(answerAt)].map((c) => ({ ...c }));
}

/* ---------- The level's 6 puzzles ---------- */

/** The pattern of each puzzle: a level with two patterns holds each 3 times, in a shuffled order. */
function patternOrder(def: LevelDef, rand: () => number): PatternId[] {
  if (def.patterns.length === 1) return Array<PatternId>(PUZZLES_PER_LEVEL).fill(def.patterns[0]);
  const half = PUZZLES_PER_LEVEL / def.patterns.length;
  return shuffle(def.patterns.flatMap((p) => Array<PatternId>(half).fill(p)), rand);
}

/**
 * The level's 6 puzzles, by puzzle number (0 to 5), for the run's seed. The trains use different car sets where
 * the pool allows, and the answer sits in each of the 3 places twice (spread, then shuffled).
 */
export function makePuzzles(level: number, seed: number): PatternPuzzle[] {
  const def = levelDef(level);
  const rand = rng((seed + Math.imul(level + 1, 0x9e3779b1)) >>> 0);
  const patterns = patternOrder(def, rand);
  const places = shuffle([0, 1, 2, 0, 1, 2], rand);
  const poolFor = new Map<number, Car[][]>();
  const usedSets = new Set<string>();
  const usedTrains = new Set<string>();

  return patterns.map((pattern, n): PatternPuzzle => {
    const k = distinctCars(pattern);
    if (!poolFor.has(k)) poolFor.set(k, shuffle(candidates(def.change, k), rand));
    const pool = poolFor.get(k) as Car[][];
    const answerAt = places[n];

    // First pass wants a car set the level has not used; the second only a train it has not used.
    for (const strict of [true, false]) {
      for (const letters of pool) {
        const { cars, answer } = trainOf(pattern, letters, def.shown);
        if (strict ? usedSets.has(carSetKey(cars)) : usedTrains.has(trainKey(cars))) continue;
        if (!hasOneReading(pattern, cars, answer)) continue;
        const options = optionsFor(def, pattern, letters, answerAt, rand);
        if (!options) continue;
        usedSets.add(carSetKey(cars));
        usedTrains.add(trainKey(cars));
        return { level, n, pattern, cars, answer, options, answerAt };
      }
    }
    throw new Error(`Pattern Train Level ${level + 1} has no train for puzzle ${n + 1}`);
  });
}

const trainKey = (cars: readonly Car[]): string => cars.map(carKey).join(',');

/** A stable text for a puzzle, so tests and callers can compare two puzzles for equality. */
export const puzzleKey = (p: PatternPuzzle): string => `${p.pattern}|${trainKey(p.cars)}|${p.options.map(carKey).join(',')}`;

const MEMO_LIMIT = 24;
const memo = new Map<string, PatternPuzzle[]>();

const copyPuzzle = (p: PatternPuzzle): PatternPuzzle => ({
  ...p,
  cars: p.cars.map((c) => ({ ...c })),
  answer: { ...p.answer },
  options: p.options.map((c) => ({ ...c })),
});

/**
 * The puzzle on screen: puzzle `n` (0 to 5) of the 0-based `level`, for the run's `seed`. This is `KitGame.puzzle`
 * for Pattern Train. `band` is accepted and unused: every band gets the same puzzles. Throws a RangeError for a
 * level or puzzle number out of range. Returns a copy each time.
 */
export function puzzle(level: number, n: number, ctx: { seed: number; band: AgeBand }): PatternPuzzle {
  levelDef(level);
  if (!Number.isInteger(n) || n < 0 || n >= PUZZLES_PER_LEVEL) throw new RangeError(`Pattern Train has no puzzle ${n}`);
  const key = `${level}:${ctx.seed}`;
  let made = memo.get(key);
  if (!made) {
    made = makePuzzles(level, ctx.seed);
    if (memo.size >= MEMO_LIMIT) memo.delete(memo.keys().next().value as string);
    memo.set(key, made);
  }
  return copyPuzzle(made[n]);
}

/* ---------- Content checks ---------- */

/**
 * Every rule of 4.4 for one puzzle of `level`, as plain sentences; an empty list means the puzzle is valid. The
 * automatic content checks call this on every puzzle of every level over 200 seeds.
 */
export function violations(level: number, p: PatternPuzzle): string[] {
  const def = levelDef(level);
  const out: string[] = [];
  const unit = PATTERN_UNIT[p.pattern];
  if (!def.patterns.includes(p.pattern)) out.push(`pattern ${p.pattern} is not on this level`);
  if (p.cars.length !== def.shown) out.push(`${p.cars.length} cars shown, the level shows ${def.shown}`);
  if (p.cars.length > MAX_SHOWN) out.push(`more than ${MAX_SHOWN} cars shown`);

  // The cars follow the pattern, and its different cars differ the way the level says.
  const letters: Car[] = [];
  p.cars.forEach((car, i) => {
    const slot = unit[i % unit.length];
    if (!letters[slot]) letters[slot] = car;
    else if (!sameCar(letters[slot], car)) out.push(`car ${i + 1} breaks the ${p.pattern} pattern`);
  });
  const missing = Array.from({ length: distinctCars(p.pattern) }, (_, i) => i).some((i) => !letters[i]);
  if (missing) out.push('the shown cars do not use every car of the pattern');
  else {
    for (let a = 0; a < letters.length; a++)
      for (let b = a + 1; b < letters.length; b++) if (!carsDiffer(def.change, letters[a], letters[b])) out.push(`pattern cars ${a + 1} and ${b + 1} do not differ by ${def.change}`);
    if (!sameCar(letters[unit[p.cars.length % unit.length]], p.answer)) out.push('the answer is not the next car of the pattern');
  }
  if (!hasOneReading(p.pattern, p.cars, p.answer)) out.push('the train has more than one reading');

  // The options.
  if (p.options.length !== OPTION_COUNT) out.push(`${p.options.length} options, not ${OPTION_COUNT}`);
  if (new Set(p.options.map(carKey)).size !== p.options.length) out.push('two options are the same car');
  const right = p.options.filter((c) => sameCar(c, p.answer));
  if (right.length !== 1) out.push(`${right.length} options are the answer`);
  if (!p.options[p.answerAt] || !sameCar(p.options[p.answerAt], p.answer)) out.push('answerAt does not point at the answer');
  const wrong = p.options.filter((c) => !sameCar(c, p.answer));
  for (const c of wrong) if (!wrongFits(def.change, p.answer, c)) out.push(`wrong option ${carKey(c)} does not differ by ${def.change} the way the level needs`);
  if (!wrong.some((c) => p.cars.some((x) => sameCar(x, c)))) out.push('no wrong option is another car of the pattern');
  if (p.pattern === 'ABCD' && !p.options.some((c) => sameCar(c, p.cars[p.cars.length - 1]))) out.push('ABCD needs the car before the empty one among the options');
  if (def.change === 'color' && !colorsFit([...p.cars, ...p.options].map((c) => c.color))) out.push('a colour pair from the avoid list shares the puzzle');
  return out;
}

/** The colours and shapes in a puzzle's cars and options, for tests that look at the avoid list. */
export function puzzleColors(p: PatternPuzzle): CarColor[] {
  return [...new Set([...p.cars, ...p.options].map((c) => c.color))];
}

export function puzzleShapes(p: PatternPuzzle): ShapeId[] {
  return [...new Set([...p.cars, ...p.options].map((c) => c.shape))];
}

/* ---------- The board's rounds (the test fixtures of 4.4) ---------- */

const car = (color: CarColor, shape: ShapeId): Car => ({ color, shape });

export interface Fixture {
  /** The board's round, 1 to 4. */
  round: number;
  /** The 0-based level whose rules the round follows (Levels 1, 1, 4 and 5). */
  level: number;
  pattern: PatternId;
  /** The pattern's different cars in A, B, C order: `trainOf` makes the round's cars and answer from them. */
  letters: Car[];
  cars: Car[];
  answer: Car;
  /** The board's options, as the level's rules allow them (round 4: the board's pink circle is yellow, its blue square a red circle, 9.4). */
  options: Car[];
}

const redCircle = car('red', 'circle');
const blueSquare = car('blue', 'square');
const yellowTriangle = car('yellow', 'triangle');
const greenStar = car('green', 'star');
const pinkCircle = car('pink', 'circle');
const blueCircle = car('blue', 'circle');
const yellowCircle = car('yellow', 'circle');

/**
 * The board's 4 rounds (design/canvas/Pattern.dc.html). Given their cars, the generator makes the same trains
 * and answers for Levels 1, 4 and 5. Round 4 (red, blue and pink circles) would put red next to pink on a colour-only
 * level, so the Level 5 fixture uses a yellow circle in its place, and its options are the red, blue and yellow
 * circles: the rules leave out the board's blue square, and green and pink cannot join red (9.4).
 */
export const FIXTURES: readonly Fixture[] = [
  {
    round: 1,
    level: 0,
    pattern: 'AB',
    letters: [redCircle, blueSquare],
    cars: [redCircle, blueSquare, redCircle, blueSquare],
    answer: redCircle,
    options: [yellowTriangle, redCircle, blueSquare],
  },
  {
    round: 2,
    level: 0,
    pattern: 'AB',
    letters: [yellowTriangle, greenStar],
    cars: [yellowTriangle, greenStar, yellowTriangle, greenStar],
    answer: yellowTriangle,
    options: [greenStar, pinkCircle, yellowTriangle],
  },
  {
    round: 3,
    level: 3,
    pattern: 'ABC',
    letters: [redCircle, blueSquare, yellowTriangle],
    cars: [redCircle, blueSquare, yellowTriangle, redCircle, blueSquare],
    answer: yellowTriangle,
    options: [redCircle, yellowTriangle, greenStar],
  },
  {
    round: 4,
    level: 4,
    pattern: 'ABC',
    letters: [redCircle, blueCircle, yellowCircle],
    cars: [redCircle, blueCircle, yellowCircle, redCircle, blueCircle],
    answer: yellowCircle,
    options: [blueCircle, yellowCircle, redCircle],
  },
];

/** A fixture as a puzzle, for the content checks (puzzle number 0 of its level). */
export const fixturePuzzle = (f: Fixture): PatternPuzzle => ({
  level: f.level,
  n: 0,
  pattern: f.pattern,
  cars: f.cars.map((c) => ({ ...c })),
  answer: { ...f.answer },
  options: f.options.map((c) => ({ ...c })),
  answerAt: f.options.findIndex((c) => sameCar(c, f.answer)),
});
