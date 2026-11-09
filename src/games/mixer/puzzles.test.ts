/** Color Mixer content checks (brief 4.1, 10.2): every level's 6 puzzles over 200 seeds and every age band. */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, PUZZLES_PER_LEVEL } from '../../shared/progress';
import { rng } from '../../shared/rng';
import { MIXES, PAINT_IDS, RESULT_IDS, TINTS, mixOf, recipeFor, type PaintId, type ResultId } from './colors';
import { GUESS_CHOICES, LEVELS, type LevelDef } from './levels';
import {
  makePuzzles,
  puzzle,
  puzzleKey,
  resultOf,
  type FinishPuzzle,
  type GuessPuzzle,
  type MakePuzzle,
  type Puzzle,
} from './puzzles';

/** Seeds at the edges of what a stored run can hold, then random ones: 200 in all. */
const EDGE_SEEDS = [0, 1, 2, 2 ** 31 - 1, 2 ** 32 - 1, 2 ** 32, Number.MAX_SAFE_INTEGER];
const pick = rng(20261106);
const SEEDS = [...EDGE_SEEDS, ...Array.from({ length: 200 - EDGE_SEEDS.length }, () => Math.floor(pick() * 2 ** 31))];

const TWIN_LEVELS = [1, 2, 4, 5]; // Levels 2, 3, 5 and 6, 0-based
const DIFFERENT_LEVELS = [0, 3, 6, 7, 8]; // Levels 1, 4 and 7 to 9, 0-based

/** Every unordered pair of two different paints from a shelf. */
const pairsOf = (paints: readonly PaintId[]): [PaintId, PaintId][] =>
  paints.flatMap((a, i) => paints.slice(i + 1).map((b): [PaintId, PaintId] => [a, b]));

const sorted = <T extends string>(xs: readonly T[]): T[] => [...xs].sort();

const countOf = (xs: readonly string[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
};

/** The two puzzles of each result on a level that holds each result twice. */
const twinsOf = <P extends Puzzle>(ps: readonly P[]): [P, P][] => {
  const by = new Map<ResultId, P[]>();
  for (const p of ps) by.set(resultOf(p), [...(by.get(resultOf(p)) ?? []), p]);
  return [...by.values()].map((pair) => {
    expect(pair).toHaveLength(2);
    return [pair[0], pair[1]];
  });
};

const levels = (seed: number): Puzzle[][] => LEVELS.map((_, level) => makePuzzles(level, seed));
const ALL = SEEDS.map((seed) => ({ seed, levels: levels(seed) }));

/** Checks one puzzle against its level row and the one-right-answer rule. */
function checkPuzzle(def: LevelDef, p: Puzzle, where: string): void {
  expect(p.form, where).toBe(def.form);
  if (p.form === 'finish') {
    expect(def.pool, where).toContain(p.goal);
    expect(def.paints, where).toContain(p.given);
    expect(recipeFor(p.goal).pair, where).toContain(p.given);
    // the shelf is the level's paints without the given one, each once
    expect(sorted(p.shelf), where).toEqual(sorted(def.paints.filter((x) => x !== p.given)));
    const right = p.shelf.filter((x) => mixOf(p.given, x) === p.goal);
    expect(right, where).toEqual([p.answer]);
  } else if (p.form === 'make') {
    expect(def.pool, where).toContain(p.goal);
    expect(sorted(p.shelf), where).toEqual(sorted(def.paints));
    const right = pairsOf(p.shelf).filter(([a, b]) => mixOf(a, b) === p.goal);
    expect(right, where).toHaveLength(1);
    expect(sorted(right[0]), where).toEqual(sorted(p.answer));
    expect(p.answer[0], where).not.toBe(p.answer[1]);
  } else {
    const [a, b] = p.paints;
    expect(a, where).not.toBe(b);
    expect(def.paints, where).toContain(a);
    expect(def.paints, where).toContain(b);
    expect(p.answer, where).toBe(mixOf(a, b));
    expect(def.pool, where).toContain(p.answer);
    expect(p.choices, where).toHaveLength(GUESS_CHOICES);
    expect(new Set(p.choices).size, where).toBe(GUESS_CHOICES);
    expect(p.choices.filter((c) => c === p.answer), where).toHaveLength(1);
    for (const c of p.choices) expect(def.choicePool, where).toContain(c);
  }
}

describe('content checks: every level, every puzzle, 200 seeds (4.1)', () => {
  LEVELS.forEach((def, level) => {
    it(`Level ${level + 1} (${def.form}) holds 6 puzzles, each with exactly one right answer from its shelf and pool`, () => {
      for (const { seed, levels: ls } of ALL) {
        const ps = ls[level];
        expect(ps).toHaveLength(PUZZLES_PER_LEVEL);
        ps.forEach((p, n) => checkPuzzle(def, p, `level ${level + 1} puzzle ${n} seed ${seed}`));
      }
    });

    it(`Level ${level + 1} asks about each result of its pool ${def.twice ? 'twice' : 'once'}`, () => {
      for (const { seed, levels: ls } of ALL) {
        const counts = countOf(ls[level].map(resultOf));
        expect(sorted([...counts.keys()]), `seed ${seed}`).toEqual(sorted(def.pool));
        for (const n of counts.values()) expect(n, `seed ${seed}`).toBe(def.twice ? 2 : 1);
      }
    });

    it(`Level ${level + 1} holds 6 puzzles that are all different`, () => {
      for (const { seed, levels: ls } of ALL) expect(new Set(ls[level].map(puzzleKey)).size, `seed ${seed}`).toBe(PUZZLES_PER_LEVEL);
    });
  });

  it('holds 54 puzzles over the 9 levels', () => {
    for (const { levels: ls } of ALL) expect(ls.flat()).toHaveLength(54);
  });

  it('never repeats a question on Levels 1, 4 and 7 to 9 (form, goal, given paint)', () => {
    for (const { seed, levels: ls } of ALL) {
      for (const level of DIFFERENT_LEVELS) {
        const ids = ls[level].map((p) => `${p.form}|${resultOf(p)}|${p.form === 'finish' ? p.given : ''}`);
        expect(new Set(ids).size, `level ${level + 1} seed ${seed}`).toBe(PUZZLES_PER_LEVEL);
      }
    }
  });

  it('gives each result once with either paint on Levels 1 and 4, white given or the colour given', () => {
    for (const { seed, levels: ls } of ALL) {
      for (const level of [0, 3]) {
        for (const [a, b] of twinsOf(ls[level] as FinishPuzzle[])) {
          expect(sorted([a.given, b.given]), `level ${level + 1} seed ${seed}`).toEqual(sorted(recipeFor(a.goal).pair));
        }
      }
      // Level 4: of each tint's two puzzles, one gives white and one gives the colour
      for (const [a, b] of twinsOf(ls[3] as FinishPuzzle[])) expect([a.given, b.given].filter((g) => g === 'white')).toHaveLength(1);
    }
  });

  it('changes slot order and choice order between Guess twins on Levels 2 and 5', () => {
    for (const { seed, levels: ls } of ALL) {
      for (const level of [1, 4]) {
        for (const [a, b] of twinsOf(ls[level] as GuessPuzzle[])) {
          const where = `level ${level + 1} seed ${seed} ${a.answer}`;
          expect(b.paints, where).toEqual([a.paints[1], a.paints[0]]);
          expect(b.choices.join(), where).not.toBe(a.choices.join());
        }
      }
    }
  });

  it('shows the same 3 colours on both Guess twins, differing only in slot order and choice order (4.1)', () => {
    for (const { seed, levels: ls } of ALL) {
      for (const level of TWIN_LEVELS.filter((l) => LEVELS[l].form === 'guess')) {
        for (const [a, b] of twinsOf(ls[level] as GuessPuzzle[])) {
          const where = `level ${level + 1} seed ${seed} ${a.answer}`;
          expect(b.answer, where).toBe(a.answer);
          expect(sorted(b.choices), where).toEqual(sorted(a.choices));
          expect(b.choices.join(), where).not.toBe(a.choices.join());
          expect(sorted(b.paints), where).toEqual(sorted(a.paints));
          expect(b.paints, where).toEqual([a.paints[1], a.paints[0]]);
        }
      }
    }
  });

  it('shows the 3 mixes as the choices on every Level 2 puzzle', () => {
    for (const { levels: ls } of ALL) for (const p of ls[1] as GuessPuzzle[]) expect(sorted(p.choices)).toEqual(sorted(MIXES));
  });

  it('changes shelf order between Make it twins on Levels 3 and 6, with the same goal and the same paints', () => {
    for (const { seed, levels: ls } of ALL) {
      for (const level of [2, 5]) {
        for (const [a, b] of twinsOf(ls[level] as MakePuzzle[])) {
          const where = `level ${level + 1} seed ${seed} ${a.goal}`;
          expect(b.goal, where).toBe(a.goal);
          expect(sorted(b.shelf), where).toEqual(sorted(a.shelf));
          expect(b.shelf.join(), where).not.toBe(a.shelf.join());
        }
      }
    }
  });

  it('never puts twins next to each other in the starting queue on Levels 2, 3, 5 and 6, first and last included', () => {
    for (const { seed, levels: ls } of ALL) {
      for (const level of TWIN_LEVELS) {
        const order = ls[level].map(resultOf);
        order.forEach((r, i) => expect(order[(i + 1) % order.length], `level ${level + 1} seed ${seed}: ${order.join(',')}`).not.toBe(r));
      }
    }
  });

  it('picks Guess wrong choices that share a paint with the pair whenever one exists', () => {
    for (const { seed, levels: ls } of ALL) {
      for (const level of [1, 4, 7]) {
        const pool = LEVELS[level].choicePool ?? [];
        for (const p of ls[level] as GuessPuzzle[]) {
          const shares = (r: ResultId) => recipeFor(r).pair.some((x) => p.paints.includes(x));
          const wrong = p.choices.filter((c) => c !== p.answer);
          const available = pool.filter((r) => r !== p.answer && shares(r)).length;
          expect(wrong.filter(shares).length, `level ${level + 1} seed ${seed} ${p.paints.join('+')}`).toBe(Math.min(wrong.length, available));
        }
      }
    }
  });

  it('never offers the colour of the two other paints as a wrong choice on Levels 5 and 8', () => {
    // Of the 5 wrong colours, 4 share a paint with the pair; the fifth is made of the other two paints.
    for (const { levels: ls } of ALL) {
      for (const level of [4, 7]) {
        for (const p of ls[level] as GuessPuzzle[]) {
          const other = PAINT_IDS.filter((x) => !p.paints.includes(x)) as PaintId[];
          expect(p.choices).not.toContain(mixOf(other[0], other[1]));
        }
      }
    }
  });
});

describe('difficulty: one form, one shelf and one choice count per level (4.1)', () => {
  const SHELF = [2, 0, 3, 3, 0, 4, 3, 0, 4]; // pots a child can tap, by level
  LEVELS.forEach((def, level) => {
    it(`Level ${level + 1}: ${def.form}, ${SHELF[level]} pots${def.form === 'guess' ? ', 3 named swatches' : ''}`, () => {
      for (const { levels: ls } of ALL) {
        const ps = ls[level];
        expect(new Set(ps.map((p) => p.form)).size).toBe(1);
        for (const p of ps) {
          if (p.form === 'guess') {
            expect(SHELF[level]).toBe(0);
            expect(p.choices).toHaveLength(3);
          } else {
            expect(p.shelf).toHaveLength(SHELF[level]);
          }
        }
        if (def.form === 'make') expect(new Set(ps.map((p) => sorted((p as MakePuzzle).shelf).join())).size).toBe(1);
      }
    });
  });

  it('grows by pool: the 3 mixes, then the 3 tints, then all 6', () => {
    const seed = SEEDS[10];
    const asked = (level: number) => sorted([...new Set(makePuzzles(level, seed).map(resultOf))]);
    for (const level of [0, 1, 2]) expect(asked(level)).toEqual(sorted(MIXES));
    for (const level of [3, 4, 5]) expect(asked(level)).toEqual(sorted(TINTS));
    for (const level of [6, 7, 8]) expect(asked(level)).toEqual(sorted(RESULT_IDS));
  });

  it('keeps white off every chapter 1 puzzle and on every later Finish and Make it shelf but the given one', () => {
    for (const { levels: ls } of ALL) {
      for (const level of [0, 1, 2]) {
        for (const p of ls[level]) {
          const paints = p.form === 'guess' ? p.paints : p.form === 'finish' ? [p.given, ...p.shelf] : p.shelf;
          expect(paints).not.toContain('white');
        }
      }
      for (const level of [3, 5, 6, 8]) {
        for (const p of ls[level] as (FinishPuzzle | MakePuzzle)[]) {
          if (p.form === 'finish' && p.given === 'white') expect(p.shelf).not.toContain('white');
          else expect(p.shelf).toContain('white');
        }
      }
    }
  });
});

describe('the run seed: same seed, same puzzles; a new seed, a new order (4.1)', () => {
  it('gives the same 6 puzzles for the same level and seed', () => {
    for (const seed of SEEDS) for (let level = 0; level < LEVELS.length; level++) expect(makePuzzles(level, seed)).toEqual(makePuzzles(level, seed));
  });

  it('keeps no state between calls: levels made in any order come out the same', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const backwards = LEVELS.map((_, i) => LEVELS.length - 1 - i).map((level) => makePuzzles(level, seed)).reverse();
      expect(backwards).toEqual(levels(seed));
    }
  });

  it('gives puzzle n as the level makes it, for every puzzle number', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      for (let level = 0; level < LEVELS.length; level++) {
        const ps = makePuzzles(level, seed);
        for (let n = 0; n < PUZZLES_PER_LEVEL; n++) expect(puzzle(level, n, { seed, band: '5-6' })).toEqual(ps[n]);
      }
    }
  });

  it('gives every age band the same puzzles, at the band boundaries too', () => {
    for (const seed of SEEDS.slice(0, 40)) {
      for (let level = 0; level < LEVELS.length; level++) {
        for (let n = 0; n < PUZZLES_PER_LEVEL; n++) {
          const keys = AGE_BANDS.map((band) => puzzleKey(puzzle(level, n, { seed, band })));
          expect(new Set(keys).size, `level ${level + 1} puzzle ${n} seed ${seed}`).toBe(1);
        }
      }
    }
  });

  it('shows a replay the level in a new order with new choices', () => {
    LEVELS.forEach((def, level) => {
      const orders = new Set(ALL.map(({ levels: ls }) => ls[level].map(resultOf).join()));
      // 24 orders exist for a pool held twice with no twins side by side; 720 for six results once
      expect(orders.size, `level ${level + 1}`).toBeGreaterThan(def.twice ? 12 : 100);
      const looks = new Set(ALL.map(({ levels: ls }) => ls[level].map(puzzleKey).join(';')));
      expect(looks.size, `level ${level + 1}`).toBeGreaterThan(100);
    });
    for (const level of [1, 4, 7]) {
      const firstChoices = new Set(ALL.map(({ levels: ls }) => (ls[level][0] as GuessPuzzle).choices.join()));
      expect(firstChoices.size, `level ${level + 1}`).toBeGreaterThan(1);
    }
  });

  it('builds the first puzzle of Level 1 and the last puzzle of Level 9 for the edge seeds', () => {
    for (const seed of EDGE_SEEDS) {
      checkPuzzle(LEVELS[0], puzzle(0, 0, { seed, band: '3-4' }), `first, seed ${seed}`);
      checkPuzzle(LEVELS[8], puzzle(8, 5, { seed, band: '9-10' }), `last, seed ${seed}`);
    }
  });

  it('names the colour a puzzle is about: the goal, or the Guess answer', () => {
    const [finish] = makePuzzles(0, 7) as FinishPuzzle[];
    const [guess] = makePuzzles(1, 7) as GuessPuzzle[];
    const [make] = makePuzzles(2, 7) as MakePuzzle[];
    expect(resultOf(finish)).toBe(finish.goal);
    expect(resultOf(guess)).toBe(guess.answer);
    expect(resultOf(make)).toBe(make.goal);
  });

  it('keys two equal puzzles the same and two different puzzles apart', () => {
    for (const { seed, levels: ls } of ALL.slice(0, 20)) {
      ls.forEach((ps, level) => ps.forEach((p, n) => expect(puzzleKey(p)).toBe(puzzleKey(makePuzzles(level, seed)[n]))));
      // Level 5 and Level 8 may ask the same Guess question; different forms never share a key
      const forms = new Map<string, string>();
      for (const p of ls.flat()) {
        const k = puzzleKey(p);
        expect(forms.get(k) ?? p.form).toBe(p.form);
        forms.set(k, p.form);
      }
    }
    // twins on Levels 2, 3, 5 and 6 are different puzzles
    for (const level of TWIN_LEVELS) {
      for (const [a, b] of twinsOf(makePuzzles(level, 99))) expect(puzzleKey(a)).not.toBe(puzzleKey(b));
    }
  });
});

describe('error paths: a level or puzzle number outside the game (10.2)', () => {
  const ctx = { seed: 1, band: '7-8' as const };

  it('throws a RangeError for a level outside the game', () => {
    for (const bad of [-1, 9, 100, 0.5, Number.NaN]) {
      expect(() => puzzle(bad, 0, ctx)).toThrow(RangeError);
      expect(() => makePuzzles(bad, 0)).toThrow(RangeError);
    }
  });

  it('throws a RangeError for a puzzle number outside the level', () => {
    for (const bad of [-1, 6, 7, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => puzzle(0, bad, ctx)).toThrow(RangeError);
  });

  it('accepts puzzle numbers 0 to 5 on the first and the last level', () => {
    for (const level of [0, 8]) for (let n = 0; n < 6; n++) expect(() => puzzle(level, n, ctx)).not.toThrow();
  });
});
