/** Color Mixer paints, results and recipes (brief 4.1, 7.3, 8.2): the board's 4 paints and 6 recipes, as data. */
import { describe, expect, it } from 'vitest';
import {
  MIXES,
  PAINTS,
  PAINT_IDS,
  RECIPES,
  RESULTS,
  RESULT_IDS,
  SAME_TEXT,
  TINTS,
  colorInfo,
  colorWord,
  isPaint,
  mixOf,
  pairKey,
  recipeFor,
  recipeOf,
  type PaintId,
} from './colors';

/** Every unordered pair of two different paints, in board order. */
const PAIRS: [PaintId, PaintId][] = PAINT_IDS.flatMap((a, i) => PAINT_IDS.slice(i + 1).map((b): [PaintId, PaintId] => [a, b]));

describe('the four paints and six results (4.1, 7.3)', () => {
  it('keeps the board paints in board order with their hex values', () => {
    expect(PAINT_IDS).toEqual(['red', 'yellow', 'blue', 'white']);
    expect(Object.fromEntries(PAINT_IDS.map((id) => [id, PAINTS[id].hex]))).toEqual({
      red: '#f03a3a',
      yellow: '#ffc21a',
      blue: '#2f8cff',
      white: '#f6f3ff',
    });
  });

  it('keeps the six results with the board hex values', () => {
    expect(RESULT_IDS).toHaveLength(6);
    expect(Object.fromEntries(RESULT_IDS.map((id) => [id, RESULTS[id].hex]))).toEqual({
      orange: '#ff8a1f',
      green: '#2fb84a',
      purple: '#8f4ae0',
      pink: '#ff8fb0',
      sky: '#8cc8ff',
      cream: '#ffe9a6',
    });
  });

  it('gives all ten colours different hex values', () => {
    const hexes = [...PAINT_IDS, ...RESULT_IDS].map((id) => colorInfo(id).hex);
    expect(new Set(hexes).size).toBe(10);
    for (const h of hexes) expect(h).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('names every colour as a line starts it, and in lower case inside a sentence (8)', () => {
    expect([...PAINT_IDS, ...RESULT_IDS].map((id) => colorInfo(id).name)).toEqual([
      'Red',
      'Yellow',
      'Blue',
      'White',
      'Orange',
      'Green',
      'Purple',
      'Pink',
      'Sky blue',
      'Cream',
    ]);
    expect([...PAINT_IDS, ...RESULT_IDS].map(colorWord)).toEqual([
      'red',
      'yellow',
      'blue',
      'white',
      'orange',
      'green',
      'purple',
      'pink',
      'sky blue',
      'cream',
    ]);
  });

  it('looks each colour up by its own id', () => {
    for (const id of [...PAINT_IDS, ...RESULT_IDS]) expect(colorInfo(id).id).toBe(id);
  });

  it('tells paints from results', () => {
    for (const id of PAINT_IDS) expect(isPaint(id)).toBe(true);
    for (const id of RESULT_IDS) expect(isPaint(id)).toBe(false);
  });
});

describe('recipes: every unordered pair of the four paints, each a different colour (4.1)', () => {
  it('holds 6 recipes, one per unordered pair', () => {
    expect(RECIPES).toHaveLength(6);
    const keys = RECIPES.map((r) => pairKey(r.pair[0], r.pair[1]));
    expect(new Set(keys).size).toBe(6);
    expect([...keys].sort()).toEqual(PAIRS.map(([a, b]) => `${a}+${b}`).sort());
    for (const r of RECIPES) expect(r.pair[0]).not.toBe(r.pair[1]);
  });

  it('makes six different results, exactly the six on the board', () => {
    const results = RECIPES.map((r) => r.result);
    expect(new Set(results).size).toBe(6);
    expect([...results].sort()).toEqual([...RESULT_IDS].sort());
  });

  it('mixes the board recipes and nothing new', () => {
    expect(Object.fromEntries(PAIRS.map(([a, b]) => [`${a}+${b}`, mixOf(a, b)]))).toEqual({
      'red+yellow': 'orange',
      'yellow+blue': 'green',
      'red+blue': 'purple',
      'red+white': 'pink',
      'blue+white': 'sky',
      'yellow+white': 'cream',
    });
  });

  it('finds a recipe in either paint order', () => {
    for (const [a, b] of PAIRS) {
      expect(recipeOf(a, b)).not.toBeNull();
      expect(recipeOf(b, a)).toBe(recipeOf(a, b));
      expect(mixOf(b, a)).toBe(mixOf(a, b));
    }
  });

  it('makes nothing from the same paint twice', () => {
    for (const p of PAINT_IDS) {
      expect(recipeOf(p, p)).toBeNull();
      expect(mixOf(p, p)).toBeNull();
    }
  });

  it('finds the recipe for every result, and that recipe makes it', () => {
    for (const r of RESULT_IDS) {
      const recipe = recipeFor(r);
      expect(recipe.result).toBe(r);
      expect(mixOf(recipe.pair[0], recipe.pair[1])).toBe(r);
    }
  });

  it('splits the results into three mixes of red, yellow and blue, and three tints with white', () => {
    expect([...MIXES]).toEqual(['orange', 'green', 'purple']);
    expect([...TINTS]).toEqual(['pink', 'sky', 'cream']);
    for (const r of MIXES) expect(recipeFor(r).pair).not.toContain('white');
    for (const r of TINTS) expect(recipeFor(r).pair).toContain('white');
  });

  it('keys a pair the same in either order, in board order', () => {
    expect(pairKey('red', 'yellow')).toBe('red+yellow');
    expect(pairKey('yellow', 'red')).toBe('red+yellow');
    expect(pairKey('white', 'blue')).toBe('blue+white');
    expect(pairKey('blue', 'yellow')).toBe('yellow+blue');
    for (const [a, b] of PAIRS) expect(pairKey(b, a)).toBe(pairKey(a, b));
    expect(new Set(PAIRS.map(([a, b]) => pairKey(a, b))).size).toBe(6);
  });

  it('teaches each recipe with the result text of 8.2, word for word', () => {
    expect(Object.fromEntries(RECIPES.map((r) => [r.result, r.text]))).toEqual({
      orange: 'Red and yellow make orange, like a sunset.',
      green: 'Blue and yellow make green, like grass and leaves.',
      purple: 'Red and blue make purple, like grapes.',
      pink: 'White makes red lighter. Now it is pink.',
      sky: 'White makes blue lighter, like the sky.',
      cream: 'White makes yellow soft, like butter.',
    });
    expect(SAME_TEXT).toBe('Same and same stays the same. Try two different paints.');
  });
});
