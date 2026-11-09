/**
 * Pattern Train content checks (brief 4.4 "Content checks", 9.4, 10.2): every level's 6 puzzles over 200 seeds and
 * every age band. The checks here read the trains the way a child would (the letters of the pattern, the cars on the
 * rail, the 3 cars in the tray) and do not lean on the module's own `violations`; that function gets its own tests
 * at the end, so the content check it runs at build time is known to catch each broken rule.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, PUZZLES_PER_LEVEL } from '../../shared/progress';
import { rng } from '../../shared/rng';
import { clashingPairs } from '../kit/colorPairs';
import { ALL_CARS, carKey, sameCar, type Car, type CarColor, type ShapeId } from './cars';
import { LEVELS, levelDef, type LevelDef, type PatternId } from './levels';
import {
  FIXTURES,
  OPTION_COUNT,
  carSetKey,
  fixturePuzzle,
  hasOneReading,
  makePuzzles,
  optionsFor,
  predictNext,
  puzzle,
  puzzleColors,
  puzzleKey,
  puzzleShapes,
  smallestRepeat,
  trainOf,
  violations,
  type PatternPuzzle,
} from './puzzles';

/** Seeds at the edges of what a stored run can hold, then random ones: 200 in all. */
const EDGE_SEEDS = [0, 1, 2, 2 ** 31 - 1, 2 ** 32 - 1, 2 ** 32, Number.MAX_SAFE_INTEGER];
const pick = rng(20261109);
const SEEDS = [...EDGE_SEEDS, ...Array.from({ length: 200 - EDGE_SEEDS.length }, () => Math.floor(pick() * 2 ** 31))];

const ALL = SEEDS.map((seed) => ({ seed, levels: LEVELS.map((_, level) => makePuzzles(level, seed)) }));

/** The avoid list as 9.4 words it: red with green, blue with purple, red with pink. */
const BRIEF_AVOID: [CarColor | 'purple', CarColor | 'purple'][] = [
  ['red', 'green'],
  ['blue', 'purple'],
  ['red', 'pink'],
];
const COLOR_ONLY = [1, 4, 8]; // Levels 2, 5 and 9, 0-based
const SHAPE_ONLY = [2, 5]; // Levels 3 and 6

const car = (color: CarColor, shape: ShapeId): Car => ({ color, shape });

/** The letter of the pattern at place i of the train: AAB gives A, A, B, A, A, B, ... */
const letterAt = (pattern: PatternId, i: number): string => pattern[i % pattern.length];

/** The shortest repeat that fits a train, worked out here on its own: the least p where every car equals the car p back. */
function period(cars: readonly Car[]): number {
  for (let p = 1; p < cars.length; p++) if (cars.every((c, i) => i < p || sameCar(c, cars[i - p]))) return p;
  return cars.length;
}

const countOf = <T,>(xs: readonly T[]): Map<T, number> => {
  const m = new Map<T, number>();
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
};

/** Every rule of 4.4 and 9.4 for one puzzle of a level, checked from what is on screen. */
function checkPuzzle(def: LevelDef, p: PatternPuzzle, where: string): void {
  const len = p.pattern.length;
  const { cars, answer, options } = p;

  // The level's pattern, cars shown, at most 5.
  expect(def.patterns, where).toContain(p.pattern);
  expect(cars, where).toHaveLength(def.shown);
  expect(cars.length, where).toBeLessThanOrEqual(5);

  // The cars follow the pattern's letters: same letter, same car; different letter, different car.
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      expect(sameCar(cars[i], cars[j]), `${where}: cars ${i + 1} and ${j + 1}`).toBe(letterAt(p.pattern, i) === letterAt(p.pattern, j));
    }
  }
  expect(new Set(cars.map(carKey)).size, where).toBe(new Set(p.pattern).size);

  // The answer is the next car: the car one repeat back, and the car every same letter shows.
  expect(answer, where).toEqual(cars[cars.length - len]);
  cars.forEach((c, i) => expect(sameCar(c, answer), `${where}: car ${i + 1} against the answer`).toBe(letterAt(p.pattern, i) === letterAt(p.pattern, cars.length)));

  // One reading only: the shortest repeat is the pattern's length, it shows at least once, and it predicts the answer.
  expect(period(cars), where).toBe(len);
  expect(len, where).toBeLessThan(cars.length);
  expect(cars[cars.length - period(cars)], where).toEqual(answer);

  // What changes between the pattern's different cars.
  const distinct = [...new Map(cars.map((c) => [carKey(c), c])).values()];
  for (let a = 0; a < distinct.length; a++) {
    for (let b = a + 1; b < distinct.length; b++) {
      const [x, y] = [distinct[a], distinct[b]];
      const pair = `${where}: ${carKey(x)} and ${carKey(y)}`;
      if (def.change === 'both') {
        expect(x.shape, pair).not.toBe(y.shape);
        expect(x.color, pair).not.toBe(y.color);
      } else if (def.change === 'color') {
        expect(x.shape, pair).toBe(y.shape);
        expect(x.color, pair).not.toBe(y.color);
      } else {
        expect(x.color, pair).toBe(y.color);
        expect(x.shape, pair).not.toBe(y.shape);
      }
    }
  }

  // The tray: 3 different cars of the 20, exactly one of them the answer, where answerAt says.
  expect(options, where).toHaveLength(3);
  expect(new Set(options.map(carKey)).size, where).toBe(3);
  for (const o of options) expect(ALL_CARS.some((c) => sameCar(c, o)), `${where}: ${carKey(o)} is one of the 20 cars`).toBe(true);
  expect(options.filter((o) => sameCar(o, answer)), where).toHaveLength(1);
  expect(options[p.answerAt], where).toEqual(answer);

  // Wrong options: at least one other car of the pattern; for ABCD, the car before the empty one.
  const wrong = options.filter((o) => !sameCar(o, answer));
  expect(wrong, where).toHaveLength(2);
  expect(wrong.some((o) => cars.some((c) => sameCar(c, o))), `${where}: a wrong option from the pattern`).toBe(true);
  if (p.pattern === 'ABCD') expect(options.some((o) => sameCar(o, cars[cars.length - 1])), `${where}: the car before the empty one`).toBe(true);

  // Wrong options differ in the level's attribute: the answer's shape on colour-only levels, its colour on
  // shape-only levels, and both on the levels where both change.
  for (const o of wrong) {
    const w = `${where}: wrong option ${carKey(o)}`;
    if (def.change === 'color') {
      expect(o.shape, w).toBe(answer.shape);
      expect(o.color, w).not.toBe(answer.color);
    } else if (def.change === 'shape') {
      expect(o.color, w).toBe(answer.color);
      expect(o.shape, w).not.toBe(answer.shape);
    } else {
      expect(o.shape, w).not.toBe(answer.shape);
      expect(o.color, w).not.toBe(answer.color);
    }
  }
}

describe('content checks: every level, every puzzle, 200 seeds (4.4)', () => {
  LEVELS.forEach((def, level) => {
    const name = `Level ${level + 1} (${def.patterns.join(' or ')}, ${def.change})`;

    it(`${name} holds 6 puzzles numbered 0 to 5, each with one reading, the next car as its answer and one right option`, () => {
      for (const { seed, levels: ls } of ALL) {
        const ps = ls[level];
        expect(ps).toHaveLength(PUZZLES_PER_LEVEL);
        ps.forEach((p, n) => {
          expect(p.level).toBe(level);
          expect(p.n).toBe(n);
          checkPuzzle(def, p, `level ${level + 1} puzzle ${n} seed ${seed}`);
        });
      }
    });

    it(`${name} holds 6 different puzzles on at least 3 car sets`, () => {
      for (const { seed, levels: ls } of ALL) {
        const ps = ls[level];
        expect(new Set(ps.map(puzzleKey)).size, `seed ${seed}`).toBe(PUZZLES_PER_LEVEL);
        expect(new Set(ps.map((p) => `${p.pattern}|${p.cars.map(carKey).join(',')}`)).size, `seed ${seed}: trains`).toBe(PUZZLES_PER_LEVEL);
        const sets = new Set(ps.map((p) => [...new Set(p.cars.map(carKey))].sort().join('|')));
        expect(sets.size, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      }
    });

    it(`${name} puts the right option in each of the 3 tray places at least once`, () => {
      for (const { seed, levels: ls } of ALL) {
        const places = new Set(ls[level].map((p) => p.options.findIndex((o) => sameCar(o, p.answer))));
        expect([...places].sort(), `seed ${seed}`).toEqual([0, 1, 2]);
      }
    });
  });

  it('spreads the right option evenly: each tray place holds it twice per level', () => {
    for (const { seed, levels: ls } of ALL) {
      ls.forEach((ps, level) => {
        const counts = countOf(ps.map((p) => p.answerAt));
        expect([0, 1, 2].map((at) => counts.get(at) ?? 0), `level ${level + 1} seed ${seed}`).toEqual([2, 2, 2]);
      });
    }
  });

  it('holds 72 puzzles over the 12 levels', () => {
    for (const { levels: ls } of ALL) expect(ls.flat()).toHaveLength(72);
  });

  it('holds AAB and ABB three times each on Level 9', () => {
    for (const { seed, levels: ls } of ALL) {
      const counts = countOf(ls[8].map((p) => p.pattern));
      expect(Object.fromEntries(counts), `seed ${seed}`).toEqual({ AAB: 3, ABB: 3 });
    }
  });

  it('holds only the four-car patterns on Level 12, ABCD and AABB three times each', () => {
    for (const { seed, levels: ls } of ALL) {
      for (const p of ls[11]) expect(p.pattern.length, `seed ${seed}`).toBe(4);
      expect(Object.fromEntries(countOf(ls[11].map((p) => p.pattern))), `seed ${seed}`).toEqual({ ABCD: 3, AABB: 3 });
    }
  });

  it('holds only its own pattern on every one-pattern level', () => {
    for (const { levels: ls } of ALL) {
      ls.forEach((ps, level) => {
        const def = LEVELS[level];
        if (def.patterns.length === 1) for (const p of ps) expect(p.pattern).toBe(def.patterns[0]);
      });
    }
  });

  it('keeps one shape on every colour-only puzzle and one colour on every shape-only puzzle, tray included', () => {
    for (const { seed, levels: ls } of ALL) {
      for (const level of COLOR_ONLY) for (const p of ls[level]) expect(new Set([...p.cars, ...p.options].map((c) => c.shape)).size, `level ${level + 1} seed ${seed}`).toBe(1);
      for (const level of SHAPE_ONLY) for (const p of ls[level]) expect(new Set([...p.cars, ...p.options].map((c) => c.color)).size, `level ${level + 1} seed ${seed}`).toBe(1);
    }
  });

  it('never puts a pair from the avoid list into a colour-only puzzle, the train and the tray together (9.4)', () => {
    for (const { seed, levels: ls } of ALL) {
      for (const level of COLOR_ONLY) {
        for (const p of ls[level]) {
          const colors = new Set<string>([...p.cars, ...p.options].map((c) => c.color));
          for (const [a, b] of BRIEF_AVOID) expect(colors.has(a) && colors.has(b), `level ${level + 1} seed ${seed}: ${a} with ${b}`).toBe(false);
          // and any pair the kit's list holds, should the canvas check add one
          expect(clashingPairs([...colors] as CarColor[]), `level ${level + 1} seed ${seed}`).toEqual([]);
        }
      }
    }
  });

  it('passes the module’s own content check on every puzzle', () => {
    for (const { seed, levels: ls } of ALL) ls.forEach((ps, level) => ps.forEach((p, n) => expect(violations(level, p), `level ${level + 1} puzzle ${n} seed ${seed}`).toEqual([])));
  });
});

describe('the check above is not empty: it rejects a puzzle that breaks a rule', () => {
  const fresh = (level: number, seed = 5, n = 0): PatternPuzzle => structuredClone(makePuzzles(level, seed)[n]);
  const rejects = (level: number, p: PatternPuzzle) => expect(() => checkPuzzle(LEVELS[level], p, 'broken')).toThrow();

  it('accepts the puzzles the mutations start from', () => {
    for (const level of [0, 1, 9]) expect(() => checkPuzzle(LEVELS[level], fresh(level), 'as dealt')).not.toThrow();
  });

  it('rejects an answer that is not the next car', () => {
    const p = fresh(0);
    const other = p.options.find((o) => !sameCar(o, p.answer))!;
    p.answer = { ...other };
    p.answerAt = p.options.findIndex((o) => sameCar(o, other));
    rejects(0, p);
  });

  it('rejects a train of one car repeated, and a train of six cars', () => {
    const r = car('red', 'circle');
    rejects(0, { ...fresh(0), cars: [r, r, r, r], answer: r, options: [r, car('blue', 'square'), car('yellow', 'star')], answerAt: 0 });
    const p = fresh(0);
    const six = trainOf('AB', [p.cars[0], p.cars[1]], 6);
    rejects(0, { ...p, cars: six.cars, answer: six.answer });
  });

  it('rejects two equal options, and a wrong option with the answer’s shape where both must change', () => {
    const p = fresh(0);
    const w = (p.answerAt + 1) % 3;
    rejects(0, { ...p, options: p.options.map((o, i) => (i === (p.answerAt + 2) % 3 ? { ...p.options[w] } : o)) });
    const q = fresh(0);
    const at = q.options.findIndex((o) => !sameCar(o, q.answer) && !q.cars.some((c) => sameCar(c, o)));
    q.options[at] = ALL_CARS.find((c) => c.shape === q.answer.shape && c.color !== q.answer.color && !q.options.some((o) => sameCar(o, c)))!;
    rejects(0, q);
  });

  it('rejects a colour-only tray with another shape in it', () => {
    const p = fresh(1);
    const at = (p.answerAt + 1) % 3;
    p.options[at] = ALL_CARS.find((c) => c.shape !== p.answer.shape && c.color === p.options[at].color)!;
    rejects(1, p);
  });

  it('rejects an ABCD tray without the car before the empty one', () => {
    const p = fresh(9);
    const before = p.cars[p.cars.length - 1];
    const at = p.options.findIndex((o) => sameCar(o, before));
    p.options[at] = p.cars.find((c) => !p.options.some((o) => sameCar(o, c)))!;
    rejects(9, p);
  });
});

describe('one reading only (4.4)', () => {
  const [r, b, y, g] = [car('red', 'circle'), car('blue', 'square'), car('yellow', 'triangle'), car('green', 'star')];

  it('reads red, red, red as a repeat of one car, so it never makes an AB train', () => {
    expect(smallestRepeat([r, r, r, r])).toBe(1);
    expect(hasOneReading('AB', [r, r, r, r], r)).toBe(false);
  });

  it('finds the pattern’s length as the shortest repeat of each pattern’s train', () => {
    expect(smallestRepeat([r, b, r, b])).toBe(2);
    expect(smallestRepeat([r, b, y, r, b])).toBe(3);
    expect(smallestRepeat([r, r, b, r, r])).toBe(3);
    expect(smallestRepeat([r, b, b, r, b])).toBe(3);
    expect(smallestRepeat([r, b, y, g, r])).toBe(4);
    expect(smallestRepeat([r, r, b, b, r])).toBe(4);
  });

  it('accepts each pattern’s train with its next car', () => {
    expect(hasOneReading('AB', [r, b, r, b], r)).toBe(true);
    expect(hasOneReading('ABC', [r, b, y, r, b], y)).toBe(true);
    expect(hasOneReading('AAB', [r, r, b, r, r], b)).toBe(true);
    expect(hasOneReading('ABB', [r, b, b, r, b], b)).toBe(true);
    expect(hasOneReading('ABCD', [r, b, y, g, r], b)).toBe(true);
    expect(hasOneReading('AABB', [r, r, b, b, r], r)).toBe(true);
  });

  it('rejects a train whose answer is not the next car', () => {
    expect(hasOneReading('AB', [r, b, r, b], b)).toBe(false);
    expect(hasOneReading('ABC', [r, b, y, r, b], r)).toBe(false);
    expect(hasOneReading('AABB', [r, r, b, b, r], b)).toBe(false);
  });

  it('rejects a four-car pattern whose cars repeat after two, since it reads as AB', () => {
    // ABCD with C = A and D = B shows red, blue, red, blue, red
    expect(smallestRepeat([r, b, r, b, r])).toBe(2);
    expect(hasOneReading('ABCD', [r, b, r, b, r], b)).toBe(false);
  });

  it('rejects a train too short to show its repeat once: four cars of AABB or ABCD', () => {
    expect(hasOneReading('AABB', [r, r, b, b], r)).toBe(false);
    expect(hasOneReading('ABCD', [r, b, y, g], r)).toBe(false);
  });

  it('rejects an empty train and a train of one car', () => {
    expect(hasOneReading('AB', [], r)).toBe(false);
    expect(smallestRepeat([r])).toBe(1);
    expect(hasOneReading('AB', [r], r)).toBe(false);
  });

  it('predicts the car one repeat back from the empty car', () => {
    expect(predictNext([r, b, r, b])).toEqual(r);
    expect(predictNext([r, b, y, r, b])).toEqual(y);
    expect(predictNext([r, r, b, r, r])).toEqual(b);
    expect(predictNext([r, r, b, b, r])).toEqual(r);
  });

  it('makes a train from the pattern’s cars in A, B, C order, with the next car as its answer', () => {
    expect(trainOf('ABC', [r, b, y], 5)).toEqual({ cars: [r, b, y, r, b], answer: y });
    expect(trainOf('AB', [r, b], 4)).toEqual({ cars: [r, b, r, b], answer: r });
    expect(trainOf('AAB', [r, b], 5)).toEqual({ cars: [r, r, b, r, r], answer: b });
    expect(trainOf('ABB', [r, b], 5)).toEqual({ cars: [r, b, b, r, b], answer: b });
    expect(trainOf('ABCD', [r, b, y, g], 5)).toEqual({ cars: [r, b, y, g, r], answer: b });
    expect(trainOf('AABB', [r, b], 5)).toEqual({ cars: [r, r, b, b, r], answer: r });
  });

  it('gives the train its own cars, so changing one never changes the pattern’s cars', () => {
    const letters = [car('red', 'circle'), car('blue', 'square')];
    const t = trainOf('AB', letters, 4);
    t.cars[0].color = 'pink';
    t.answer.shape = 'star';
    expect(letters).toEqual([car('red', 'circle'), car('blue', 'square')]);
    expect(t.cars[2]).toEqual(car('red', 'circle'));
  });

  it('keys a train’s car set with order and repeats left out', () => {
    expect(carSetKey([r, b, r, b])).toBe(carSetKey([b, r]));
    expect(carSetKey([r, r, b, r, r])).toBe(carSetKey([r, b, b, r, b]));
    expect(carSetKey([r, b, y])).not.toBe(carSetKey([r, b, g]));
  });
});

describe('wrong options, per level kind (4.4)', () => {
  const rands = Array.from({ length: 100 }, (_, i) => rng(i * 7919 + 1));

  it('offers only the red, blue and yellow circles for the Level 5 train of red, blue and yellow circles', () => {
    const letters = [car('red', 'circle'), car('blue', 'circle'), car('yellow', 'circle')];
    for (const rand of rands) {
      for (const at of [0, 1, 2]) {
        const opts = optionsFor(levelDef(4), 'ABC', letters, at, rand);
        expect(opts).not.toBeNull();
        expect(opts!.map(carKey).sort()).toEqual(['blue-circle', 'red-circle', 'yellow-circle']);
        expect(opts![at]).toEqual(car('yellow', 'circle'));
      }
    }
  });

  it('keeps green and pink out of a colour-only tray whose train holds red (9.4)', () => {
    const letters = [car('red', 'square'), car('blue', 'square')];
    for (const rand of rands) {
      const opts = optionsFor(levelDef(1), 'AB', letters, 1, rand)!;
      for (const o of opts) {
        expect(o.shape).toBe('square');
        expect(['red', 'blue', 'yellow']).toContain(o.color);
      }
    }
  });

  it('always offers the car before the empty one on ABCD', () => {
    const letters = [car('red', 'circle'), car('blue', 'square'), car('yellow', 'triangle'), car('green', 'star')];
    for (const rand of rands) {
      const opts = optionsFor(levelDef(9), 'ABCD', letters, 0, rand)!;
      // red, blue, yellow, green, red: the car before the empty one is the red circle, the answer the blue square
      expect(opts.map(carKey)).toContain('red-circle');
      expect(opts[0]).toEqual(car('blue', 'square'));
    }
  });

  it('offers the other car of an AABB pattern, since the car before the empty one is the answer', () => {
    const letters = [car('pink', 'star'), car('blue', 'triangle')];
    for (const rand of rands) {
      const opts = optionsFor(levelDef(10), 'AABB', letters, 2, rand)!;
      expect(opts[2]).toEqual(car('pink', 'star'));
      expect(opts.map(carKey)).toContain('blue-triangle');
    }
  });

  it('keeps the answer’s colour on shape-only levels and changes both on the others', () => {
    for (const rand of rands) {
      const shapeOnly = optionsFor(levelDef(2), 'AB', [car('green', 'circle'), car('green', 'star')], 0, rand)!;
      for (const o of shapeOnly) expect(o.color).toBe('green');
      const both = optionsFor(levelDef(0), 'AB', [car('green', 'circle'), car('pink', 'star')], 0, rand)!;
      for (const o of both.slice(1)) {
        expect(o.shape).not.toBe('circle');
        expect(o.color).not.toBe('green');
      }
    }
  });

  it('puts the answer at the place asked for, 0, 1 or 2', () => {
    const letters = [car('red', 'circle'), car('blue', 'square')];
    for (const at of [0, 1, 2]) expect(optionsFor(levelDef(0), 'AB', letters, at, rng(5))![at]).toEqual(car('red', 'circle'));
  });

  it('returns no options when the pattern has no other car to offer', () => {
    const same = car('red', 'circle');
    expect(optionsFor(levelDef(0), 'AB', [same, { ...same }], 0, rng(1))).toBeNull();
  });

  it('returns new car objects, so the tray never shares a car with the train', () => {
    const letters = [car('red', 'circle'), car('blue', 'square')];
    const opts = optionsFor(levelDef(0), 'AB', letters, 0, rng(3))!;
    for (const o of opts) o.color = 'pink';
    expect(letters).toEqual([car('red', 'circle'), car('blue', 'square')]);
  });
});

describe('the board’s rounds are the generator’s trains (4.4)', () => {
  // design/canvas/Pattern.dc.html, rounds(): rc red circle, bs blue square, yt yellow triangle, gs green star,
  // pc pink circle, bc blue circle.
  const rc = car('red', 'circle');
  const bs = car('blue', 'square');
  const yt = car('yellow', 'triangle');
  const gs = car('green', 'star');
  const pc = car('pink', 'circle');
  const bc = car('blue', 'circle');
  const yc = car('yellow', 'circle');
  const BOARD = [
    { seq: [rc, bs, rc, bs], answer: rc, options: [yt, rc, bs] },
    { seq: [yt, gs, yt, gs], answer: yt, options: [gs, pc, yt] },
    { seq: [rc, bs, yt, rc, bs], answer: yt, options: [rc, yt, gs] },
    { seq: [rc, bc, pc, rc, bc], answer: pc, options: [bc, pc, bs] },
  ];

  it('holds the board’s 4 rounds for Levels 1, 1, 4 and 5', () => {
    expect(FIXTURES.map((f) => [f.round, f.level, f.pattern])).toEqual([
      [1, 0, 'AB'],
      [2, 0, 'AB'],
      [3, 3, 'ABC'],
      [4, 4, 'ABC'],
    ]);
  });

  it('keeps rounds 1 to 3 exactly as the board shows them: cars, answer and options', () => {
    for (const i of [0, 1, 2]) {
      expect(FIXTURES[i].cars, `round ${i + 1}`).toEqual(BOARD[i].seq);
      expect(FIXTURES[i].answer, `round ${i + 1}`).toEqual(BOARD[i].answer);
      expect(FIXTURES[i].options, `round ${i + 1}`).toEqual(BOARD[i].options);
    }
  });

  it('turns round 4’s pink circle yellow and offers the red, blue and yellow circles (9.4)', () => {
    const f = FIXTURES[3];
    expect(f.cars).toEqual(BOARD[3].seq.map((c) => (sameCar(c, pc) ? yc : c)));
    expect(f.answer).toEqual(yc);
    expect(f.options.map(carKey).sort()).toEqual(['blue-circle', 'red-circle', 'yellow-circle']);
    // the board's own round 4 puts red next to pink on a colour-only level
    expect(clashingPairs(BOARD[3].seq.map((c) => c.color))).toEqual([['red', 'pink']]);
    expect(clashingPairs([...f.cars, ...f.options].map((c) => c.color))).toEqual([]);
  });

  it('makes each round’s train and answer from its cars, at its level’s length', () => {
    for (const f of FIXTURES) expect(trainOf(f.pattern, f.letters, levelDef(f.level).shown), `round ${f.round}`).toEqual({ cars: f.cars, answer: f.answer });
  });

  it('passes every content check of its level, Level 5’s avoid list included', () => {
    for (const f of FIXTURES) {
      const p = fixturePuzzle(f);
      checkPuzzle(levelDef(f.level), p, `round ${f.round}`);
      expect(violations(f.level, p), `round ${f.round}`).toEqual([]);
    }
  });

  it('turns a round into a puzzle with its answer where the board puts it', () => {
    expect(FIXTURES.map((f) => fixturePuzzle(f).answerAt)).toEqual([1, 2, 1, 1]);
    for (const f of FIXTURES) {
      const p = fixturePuzzle(f);
      expect(p).toMatchObject({ level: f.level, n: 0, pattern: f.pattern });
      p.cars[0].color = 'pink';
      expect(f.cars[0].color).not.toBe('pink');
    }
  });

  it('flags the board’s own round 4 on Level 5, since red and pink share it', () => {
    const p: PatternPuzzle = { level: 4, n: 0, pattern: 'ABC', cars: BOARD[3].seq, answer: pc, options: [bc, pc, rc], answerAt: 1 };
    expect(violations(4, p).length).toBeGreaterThan(0);
  });

  it('deals each round’s train with its answer for some run seed', () => {
    for (const f of FIXTURES) {
      const want = f.cars.map(carKey).join(',');
      let found: PatternPuzzle | undefined;
      for (let seed = 0; seed < 5000 && !found; seed++) found = makePuzzles(f.level, seed).find((p) => p.cars.map(carKey).join(',') === want);
      expect(found, `round ${f.round}`).toBeDefined();
      expect(found!.answer, `round ${f.round}`).toEqual(f.answer);
      checkPuzzle(levelDef(f.level), found!, `round ${f.round}, dealt`);
      // Level 5's red, blue and yellow circles leave only one tray: those three circles
      if (f.level === 4) expect(found!.options.map(carKey).sort()).toEqual(f.options.map(carKey).sort());
    }
  });
});

describe('violations: the content check catches every broken rule', () => {
  const base = makePuzzles(0, 11)[0];
  const ok = (): PatternPuzzle => ({ ...base, cars: base.cars.map((c) => ({ ...c })), answer: { ...base.answer }, options: base.options.map((c) => ({ ...c })) });
  const flagged = (level: number, p: PatternPuzzle) => expect(violations(level, p).length).toBeGreaterThan(0);
  const other = (c: Car): Car => ALL_CARS.find((x) => x.shape !== c.shape && x.color !== c.color && !base.cars.some((t) => sameCar(t, x)) && !base.options.some((o) => sameCar(o, x)))!;

  it('passes the puzzle it starts from', () => {
    expect(violations(0, ok())).toEqual([]);
  });

  it('flags an answer that is not the next car', () => {
    const p = ok();
    const wrongAt = (p.answerAt + 1) % 3;
    p.answer = { ...p.options[wrongAt] };
    [p.options[p.answerAt], p.options[wrongAt]] = [p.options[wrongAt], p.options[p.answerAt]];
    expect(p.options[p.answerAt]).toEqual(p.answer);
    flagged(0, p);
  });

  it('flags two options that are the same car, and a tray of 2 or 4', () => {
    const p = ok();
    const wrongAt = (p.answerAt + 1) % 3;
    p.options[(p.answerAt + 2) % 3] = { ...p.options[wrongAt] };
    flagged(0, p);
    flagged(0, { ...ok(), options: ok().options.slice(0, 2) });
    flagged(0, { ...ok(), options: [...ok().options, other(base.answer)] });
  });

  it('flags answerAt pointing at a wrong option', () => {
    flagged(0, { ...ok(), answerAt: (base.answerAt + 1) % 3 });
  });

  it('flags a train with the wrong number of cars, or more than 5', () => {
    flagged(0, { ...ok(), cars: ok().cars.slice(0, 3) });
    const six = trainOf('AB', [base.cars[0], base.cars[1]], 6);
    flagged(0, { ...ok(), cars: six.cars, answer: six.answer });
  });

  it('flags a pattern that is not on the level', () => {
    flagged(3, ok());
  });

  it('flags a car that breaks the pattern, and a train with a shorter reading', () => {
    const p = ok();
    p.cars[2] = other(base.answer);
    flagged(0, p);
    const r = car('red', 'circle');
    flagged(0, { ...ok(), cars: [r, r, r, r], answer: r, options: [r, car('blue', 'square'), car('yellow', 'star')], answerAt: 0 });
  });

  it('flags a wrong option that does not differ the way the level needs', () => {
    // Level 1 changes both: a wrong option with the answer's shape breaks it
    // Level 1's tray is the answer, the pattern's other car and one car from outside: swap the outside one
    const p = ok();
    const at = p.options.findIndex((o) => !sameCar(o, p.answer) && !p.cars.some((c) => sameCar(c, o)));
    expect(at).toBeGreaterThanOrEqual(0);
    const sameShape = ALL_CARS.find((c) => c.shape === base.answer.shape && c.color !== base.answer.color && !p.options.some((o) => sameCar(o, c)))!;
    p.options[at] = { ...sameShape };
    flagged(0, p);
  });

  it('flags a tray with no other car of the pattern', () => {
    const p = ok();
    const outside = ALL_CARS.filter((c) => c.shape !== base.answer.shape && c.color !== base.answer.color && !base.cars.some((t) => sameCar(t, c)));
    const wrong = [outside[0], outside.find((c) => !sameCar(c, outside[0]))!];
    p.options = [...wrong.slice(0, p.answerAt), { ...p.answer }, ...wrong.slice(p.answerAt)].map((c) => ({ ...c }));
    expect(new Set(p.options.map(carKey)).size).toBe(3);
    expect(p.options[p.answerAt]).toEqual(p.answer);
    flagged(0, p);
  });

  it('flags an ABCD tray without the car before the empty one', () => {
    const p = makePuzzles(9, 4)[0];
    expect(violations(9, p)).toEqual([]);
    const before = p.cars[p.cars.length - 1];
    const otherPattern = p.cars.find((c) => !sameCar(c, before) && !sameCar(c, p.answer))!;
    const tray = [p.answer, otherPattern, ALL_CARS.find((c) => c.shape !== p.answer.shape && c.color !== p.answer.color && !p.cars.some((t) => sameCar(t, c)))!];
    flagged(9, { ...p, options: tray.map((c) => ({ ...c })), answerAt: 0 });
  });

  it('flags a colour-only puzzle that holds a pair from the avoid list', () => {
    const r = car('red', 'circle');
    const bl = car('blue', 'circle');
    const gr = car('green', 'circle');
    const t = trainOf('AB', [r, bl], 4);
    flagged(1, { level: 1, n: 0, pattern: 'AB', cars: t.cars, answer: t.answer, options: [r, bl, gr], answerAt: 0 });
  });
});

describe('the run seed: same seed, same puzzles (4.4)', () => {
  it('gives the same 6 puzzles for the same level and seed', () => {
    for (const seed of SEEDS) for (let level = 0; level < LEVELS.length; level++) expect(makePuzzles(level, seed)).toEqual(makePuzzles(level, seed));
  });

  it('keeps no state between calls: levels made in any order come out the same', () => {
    for (const { seed, levels: ls } of ALL.slice(0, 20)) {
      const backwards = LEVELS.map((_, i) => LEVELS.length - 1 - i).map((level) => makePuzzles(level, seed)).reverse();
      expect(backwards).toEqual(ls);
    }
  });

  it('gives puzzle n as the level makes it, for every puzzle number', () => {
    for (const { seed, levels: ls } of ALL.slice(0, 40)) {
      for (let level = 0; level < LEVELS.length; level++) {
        for (let n = 0; n < PUZZLES_PER_LEVEL; n++) expect(puzzle(level, n, { seed, band: '5-6' })).toEqual(ls[level][n]);
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

  it('hands out a copy: changing a puzzle on screen never changes the next one dealt', () => {
    const ctx = { seed: 77, band: '7-8' as const };
    const first = puzzle(6, 2, ctx);
    const want = structuredClone(first);
    first.cars[0].color = 'pink';
    first.answer.shape = 'star';
    first.options.reverse();
    first.answerAt = 9;
    expect(puzzle(6, 2, ctx)).toEqual(want);
    expect(puzzle(6, 2, ctx)).toEqual(makePuzzles(6, 77)[2]);
  });

  it('still deals the same puzzle after many other runs were dealt in between', () => {
    const ctx = { seed: 123456, band: '3-4' as const };
    const first = puzzle(3, 4, ctx);
    for (let seed = 0; seed < 60; seed++) puzzle(3, 0, { seed, band: '3-4' });
    expect(puzzle(3, 4, ctx)).toEqual(first);
    expect(first).toEqual(makePuzzles(3, 123456)[4]);
  });

  it('shows a replay the level with new trains', () => {
    LEVELS.forEach((_, level) => {
      const looks = new Set(ALL.map(({ levels: ls }) => ls[level].map(puzzleKey).join(';')));
      expect(looks.size, `level ${level + 1}`).toBeGreaterThan(100);
      const firstTrains = new Set(ALL.map(({ levels: ls }) => ls[level][0].cars.map(carKey).join(',')));
      expect(firstTrains.size, `level ${level + 1}`).toBeGreaterThan(20);
    });
  });

  it('builds the first puzzle of Level 1 and the last puzzle of Level 12 for the edge seeds', () => {
    for (const seed of EDGE_SEEDS) {
      checkPuzzle(LEVELS[0], puzzle(0, 0, { seed, band: '3-4' }), `first, seed ${seed}`);
      checkPuzzle(LEVELS[11], puzzle(11, 5, { seed, band: '9-10' }), `last, seed ${seed}`);
    }
  });

  it('keys two equal puzzles the same and the 6 of a level apart', () => {
    for (const { seed, levels: ls } of ALL.slice(0, 20)) {
      ls.forEach((ps, level) => ps.forEach((p, n) => expect(puzzleKey(p)).toBe(puzzleKey(makePuzzles(level, seed)[n]))));
    }
    const ps = makePuzzles(5, 3);
    const moved = { ...ps[0], options: [...ps[0].options].reverse() };
    expect(puzzleKey(moved)).not.toBe(puzzleKey(ps[0]));
  });

  it('lists the colours and shapes a puzzle shows, train and tray together, each once', () => {
    for (const { levels: ls } of ALL.slice(0, 20)) {
      for (const p of ls.flat()) {
        const all = [...p.cars, ...p.options];
        expect([...puzzleColors(p)].sort()).toEqual([...new Set(all.map((c) => c.color))].sort());
        expect([...puzzleShapes(p)].sort()).toEqual([...new Set(all.map((c) => c.shape))].sort());
      }
    }
    for (const { levels: ls } of ALL) for (const p of ls[4]) expect(puzzleShapes(p)).toHaveLength(1);
  });

  it('deals 3 options, the tray size of 4.4', () => {
    expect(OPTION_COUNT).toBe(3);
  });
});

describe('error paths: a level or puzzle number outside the game (10.2)', () => {
  const ctx = { seed: 1, band: '7-8' as const };

  it('throws a RangeError for a level outside the game', () => {
    for (const bad of [-1, 12, 100, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => puzzle(bad, 0, ctx), String(bad)).toThrow(RangeError);
      expect(() => makePuzzles(bad, 0), String(bad)).toThrow(RangeError);
      expect(() => violations(bad, base()), String(bad)).toThrow(RangeError);
    }
  });

  it('throws a RangeError for a puzzle number outside the level', () => {
    for (const bad of [-1, 6, 7, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => puzzle(0, bad, ctx), String(bad)).toThrow(RangeError);
  });

  it('accepts puzzle numbers 0 to 5 on the first and the last level', () => {
    for (const level of [0, 11]) for (let n = 0; n < 6; n++) expect(() => puzzle(level, n, ctx)).not.toThrow();
  });

  function base(): PatternPuzzle {
    return makePuzzles(0, 1)[0];
  }
});
