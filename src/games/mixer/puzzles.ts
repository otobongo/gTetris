/* Color Mixer puzzles (brief 4.1): a level's 6 puzzles made from the level table and the run's seed.
   Pure and deterministic: the same (level, n, seed) always gives the same puzzle, so a resumed level shows
   the same puzzles and a grown-up's replay (a new seed) shows them in a new order with new choices.
   The age band changes nothing here. */
import { PUZZLES_PER_LEVEL, type AgeBand } from '../../shared/progress';
import { rng, shuffle } from '../../shared/rng';
import { recipeFor, type PaintId, type ResultId } from './colors';
import { GUESS_CHOICES, levelDef, type LevelDef } from './levels';

/** Finish the mix: the goal and one paint are set; the child taps the paint that makes it. */
export interface FinishPuzzle {
  form: 'finish';
  goal: ResultId;
  /** Paint 1, fixed in its slot. */
  given: PaintId;
  /** The paints the child can tap: the level's paints without the given one. */
  shelf: PaintId[];
  /** The one shelf paint that makes the goal with the given paint. */
  answer: PaintId;
}

/** Guess the mix: both paints are in their slots; the child taps the colour they make. */
export interface GuessPuzzle {
  form: 'guess';
  /** Slot 1 and slot 2. */
  paints: [PaintId, PaintId];
  /** 3 different colours, in the order shown. */
  choices: ResultId[];
  answer: ResultId;
}

/** Make it: the goal is set and both slots are empty; the child taps two paints. */
export interface MakePuzzle {
  form: 'make';
  goal: ResultId;
  /** The level's paints, in the order shown. */
  shelf: PaintId[];
  /** The one pair that makes the goal, in board order; either tap order is right. */
  answer: [PaintId, PaintId];
}

export type Puzzle = FinishPuzzle | GuessPuzzle | MakePuzzle;

/** The colour a puzzle is about: the goal (Finish, Make it) or the answer (Guess). */
export const resultOf = (p: Puzzle): ResultId => (p.form === 'guess' ? p.answer : p.goal);

/** How many times a shuffle is redrawn before a fixed fallback is used. */
const RETRIES = 60;

const sameOrder = <T>(a: readonly T[], b: readonly T[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** True when no result sits next to the same result, last and first included (so a swap, which moves the front to the back, never brings the same question next). */
const noNeighbours = (order: readonly ResultId[]): boolean => order.every((r, i) => r !== order[(i + 1) % order.length]);

/** The order of the level's 6 questions by result. */
function resultOrder(def: LevelDef, rand: () => number): ResultId[] {
  if (!def.twice) return shuffle([...def.pool], rand);
  const both = [...def.pool, ...def.pool];
  for (let i = 0; i < RETRIES; i++) {
    const order = shuffle(both, rand);
    if (noNeighbours(order)) return order;
  }
  const once = shuffle([...def.pool], rand);
  return [...once, ...once];
}

/** A shuffled copy of `items` that differs from `first` when there is a `first` to differ from. */
function shuffleApart<T>(items: readonly T[], first: readonly T[] | undefined, rand: () => number): T[] {
  let out = shuffle([...items], rand);
  for (let i = 0; i < RETRIES && first && sameOrder(out, first); i++) out = shuffle([...items], rand);
  // 2 or more different items always have a different reverse; this only runs on a very unlucky seed.
  if (first && sameOrder(out, first)) out = [...first].reverse();
  return out;
}

/** 2 wrong swatches, preferring colours that share a paint with the pair (brief 4.1). */
function wrongChoices(def: LevelDef, right: ResultId, pair: readonly PaintId[], rand: () => number): ResultId[] {
  const others = (def.choicePool ?? def.pool).filter((r) => r !== right);
  const sharing = others.filter((r) => recipeFor(r).pair.some((p) => pair.includes(p)));
  const rest = others.filter((r) => !sharing.includes(r));
  return [...shuffle(sharing, rand), ...shuffle(rest, rand)].slice(0, GUESS_CHOICES - 1);
}

/**
 * The level's 6 puzzles, by puzzle number (0 to 5). Levels 1 to 6 hold each result of their pool twice,
 * never twice in a row, with the twin changing slot order and choice order (Guess) or shelf order (Make it)
 * or the given paint (Finish). Levels 7 to 9 hold each of the six results once.
 */
export function makePuzzles(level: number, seed: number): Puzzle[] {
  const def = levelDef(level);
  const rand = rng((seed + Math.imul(level + 1, 0x9e3779b1)) >>> 0);
  const order = resultOrder(def, rand);

  // What the first twin of each result used, so the second one differs.
  const givenFirst = new Map<ResultId, PaintId>();
  const slotsFirst = new Map<ResultId, [PaintId, PaintId]>();
  const choicesFirst = new Map<ResultId, ResultId[]>();
  const shelfFirst = new Map<ResultId, PaintId[]>();

  return order.map((result): Puzzle => {
    const pair = recipeFor(result).pair;
    if (def.form === 'finish') {
      const before = givenFirst.get(result);
      const given = before ? (pair[0] === before ? pair[1] : pair[0]) : rand() < 0.5 ? pair[0] : pair[1];
      givenFirst.set(result, given);
      const answer = pair[0] === given ? pair[1] : pair[0];
      return { form: 'finish', goal: result, given, shelf: shuffle(def.paints.filter((p) => p !== given), rand), answer };
    }
    if (def.form === 'make') {
      const shelf = shuffleApart(def.paints, shelfFirst.get(result), rand);
      shelfFirst.set(result, shelf);
      return { form: 'make', goal: result, shelf, answer: [pair[0], pair[1]] };
    }
    const before = slotsFirst.get(result);
    const paints: [PaintId, PaintId] = before ? [before[1], before[0]] : rand() < 0.5 ? [pair[0], pair[1]] : [pair[1], pair[0]];
    slotsFirst.set(result, paints);
    const set = def.choicePool && def.choicePool.length === GUESS_CHOICES ? [...def.choicePool] : [result, ...wrongChoices(def, result, paints, rand)];
    const choices = shuffleApart(set, choicesFirst.get(result), rand);
    choicesFirst.set(result, choices);
    return { form: 'guess', paints, choices, answer: result };
  });
}

/**
 * The puzzle on screen: puzzle `n` (0 to 5) of the 0-based `level`, for the run's `seed`. This is
 * `KitGame.puzzle` for Color Mixer. `band` is accepted and unused: every band gets the same puzzles.
 */
export function puzzle(level: number, n: number, ctx: { seed: number; band: AgeBand }): Puzzle {
  if (!Number.isInteger(n) || n < 0 || n >= PUZZLES_PER_LEVEL) throw new RangeError(`Color Mixer has no puzzle ${n}`);
  return makePuzzles(level, ctx.seed)[n];
}

/** A stable text for a puzzle, so tests and callers can compare two puzzles for equality. */
export function puzzleKey(p: Puzzle): string {
  switch (p.form) {
    case 'finish':
      return `finish|${p.goal}|${p.given}|${p.shelf.join(',')}`;
    case 'guess':
      return `guess|${p.paints.join(',')}|${p.choices.join(',')}`;
    case 'make':
      return `make|${p.goal}|${p.shelf.join(',')}`;
  }
}
