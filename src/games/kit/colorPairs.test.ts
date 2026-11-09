/**
 * The colour avoid list (six-games brief 9.4, user decision 3 A): red with green, blue with purple and
 * red with pink never meet in one generated colour puzzle,
 * and nor do blue with green, added in batch 2 after the Pattern Train canvas check (tritanopia). The checks a generator and its tests use.
 */
import { describe, expect, it } from 'vitest';
import { BRICK_COLORS, type BrickColor } from '../../shared/ui/palette';
import { AVOID_PAIRS, clashes, clashingPairs, colorsFit } from './colorPairs';

const key = ([a, b]: readonly [BrickColor, BrickColor]) => [a, b].sort().join('+');

describe('the avoid list', () => {
  it('holds exactly the three pairs in the brief plus blue with green from the batch 2 check', () => {
    expect(new Set(AVOID_PAIRS.map(key))).toEqual(new Set(['green+red', 'blue+purple', 'pink+red', 'blue+green']));
    expect(AVOID_PAIRS).toHaveLength(4);
  });

  it('only names real brick colours, and never a colour with itself', () => {
    for (const [a, b] of AVOID_PAIRS) {
      expect(BRICK_COLORS).toContain(a);
      expect(BRICK_COLORS).toContain(b);
      expect(a).not.toBe(b);
    }
  });
});

describe('clashes', () => {
  it('is true for each avoided pair, in either order', () => {
    for (const [a, b] of [['red', 'green'], ['blue', 'purple'], ['red', 'pink'], ['blue', 'green']] as const) {
      expect(clashes(a, b), `${a} ${b}`).toBe(true);
      expect(clashes(b, a), `${b} ${a}`).toBe(true);
    }
  });

  it('is false for pairs not on the list, close neighbours included', () => {
    expect(clashes('red', 'blue')).toBe(false);
    expect(clashes('green', 'pink')).toBe(false);
    expect(clashes('purple', 'pink')).toBe(false);
    expect(clashes('green', 'purple')).toBe(false);
    expect(clashes('yellow', 'orange')).toBe(false);
  });

  it('never clashes a colour with itself', () => {
    for (const c of BRICK_COLORS) expect(clashes(c, c), c).toBe(false);
  });

  it('is symmetric over every pair of brick colours and finds exactly four clashing pairs', () => {
    let found = 0;
    for (let i = 0; i < BRICK_COLORS.length; i++) {
      for (let j = i + 1; j < BRICK_COLORS.length; j++) {
        const [a, b] = [BRICK_COLORS[i], BRICK_COLORS[j]];
        expect(clashes(a, b), `${a} ${b}`).toBe(clashes(b, a));
        if (clashes(a, b)) found++;
      }
    }
    expect(found).toBe(4);
  });
});

describe('colorsFit and clashingPairs', () => {
  it('lets an empty set or one colour through', () => {
    expect(colorsFit([])).toBe(true);
    expect(clashingPairs([])).toEqual([]);
    expect(colorsFit(['red'])).toBe(true);
  });

  it('lets repeats of one colour through', () => {
    expect(colorsFit(['red', 'red', 'red'])).toBe(true);
    expect(clashingPairs(['pink', 'pink'])).toEqual([]);
  });

  it('lets a set with no avoided pair through', () => {
    expect(colorsFit(['red', 'blue', 'yellow'])).toBe(true);
    expect(colorsFit(['green', 'purple', 'orange', 'teal'])).toBe(true);
  });

  it('stops a set holding any avoided pair, wherever the two sit in it', () => {
    expect(colorsFit(['red', 'green'])).toBe(false);
    expect(colorsFit(['yellow', 'blue', 'orange', 'purple'])).toBe(false);
    expect(colorsFit(['pink', 'yellow', 'teal', 'red'])).toBe(false);
  });

  it('names each clashing pair once, in the order the colours first appear', () => {
    expect(clashingPairs(['red', 'green', 'pink'])).toEqual([
      ['red', 'green'],
      ['red', 'pink'],
    ]);
    expect(clashingPairs(['green', 'red', 'green', 'red'])).toEqual([['green', 'red']]);
  });

  it('finds all four pairs when all five colours are in one set', () => {
    expect(clashingPairs(['red', 'green', 'blue', 'purple', 'pink']).map(key).sort()).toEqual(['blue+green', 'blue+purple', 'green+red', 'pink+red']);
  });

  it('takes any iterable, a Set or a generator as well as an array', () => {
    expect(colorsFit(new Set<BrickColor>(['blue', 'purple']))).toBe(false);
    function* gen(): Generator<BrickColor> {
      yield 'yellow';
      yield 'teal';
    }
    expect(colorsFit(gen())).toBe(true);
  });
});
