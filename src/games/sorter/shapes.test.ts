/**
 * Shape Sorter shapes and colours (six-games brief 4.2, 7.4, 8.3, 9.4): the eight shapes and their families, how
 * each is cut out, the board's six colours through the brick palette, and the avoid list.
 */
import { describe, expect, it } from 'vitest';
import { BRICK_COLORS, PALETTE } from '../../shared/ui/palette';
import {
  AVOID_PAIRS,
  FAMILIES,
  SHAPES,
  SHAPE_BADGE,
  SHAPE_FACT,
  SHAPE_LEVEL_COLOR,
  SHAPE_NAME,
  SHAPE_STYLE,
  SORTER_COLORS,
  SQUARE_FAMILY,
  colorsClash,
  colorsFit,
  familyOf,
  type SorterColor,
} from './shapes';

const sortSets = (sets: readonly (readonly string[])[]) => sets.map((s) => [...s].sort().join('|')).sort();

describe('the eight shapes and their families (4.2)', () => {
  it('has the board’s five shapes plus rectangle, diamond and pentagon', () => {
    expect([...SHAPES].sort()).toEqual(['circle', 'diamond', 'hexagon', 'pentagon', 'rectangle', 'square', 'star', 'triangle']);
  });

  it('groups them as the brief does', () => {
    expect(sortSets(FAMILIES)).toEqual(sortSets([['square', 'rectangle', 'diamond'], ['pentagon', 'hexagon'], ['circle'], ['triangle'], ['star']]));
    expect([...SQUARE_FAMILY].sort()).toEqual(['diamond', 'rectangle', 'square']);
  });

  it('puts every shape in exactly one family, the one familyOf names', () => {
    for (const s of SHAPES) {
      expect(FAMILIES.filter((f) => f.includes(s)), s).toHaveLength(1);
      expect(FAMILIES[familyOf(s)], s).toContain(s);
    }
    expect(familyOf('square')).toBe(familyOf('diamond'));
    expect(familyOf('pentagon')).toBe(familyOf('hexagon'));
    expect(familyOf('circle')).not.toBe(familyOf('star'));
  });

  it('gives every shape a lower-case name, a fact and a badge with a name', () => {
    for (const s of SHAPES) {
      expect(SHAPE_NAME[s], s).toBe(s);
      expect(SHAPE_FACT[s], s).toMatch(/^A .+\.$/);
      expect(SHAPE_FACT[s], s).toContain(SHAPE_NAME[s]);
      expect(SHAPE_BADGE[s].name, s).not.toBe('');
      expect(SHAPE_BADGE[s].text, s).not.toBe('');
    }
  });

  it('puts the badge’s number in its shape’s fact (the star counts points, the circle has no corners)', () => {
    for (const s of SHAPES) {
      const { text, name } = SHAPE_BADGE[s];
      if (s === 'circle') {
        expect(text).toBe('0');
        expect(SHAPE_FACT[s]).toContain(name);
      } else expect(SHAPE_FACT[s], s).toContain(`${text} ${name.split(' ')[1]}`);
    }
  });
});

describe('how each shape is cut out (7.4)', () => {
  it('keeps the board’s five shapes as the board draws them', () => {
    expect(SHAPE_STYLE.circle).toEqual({ borderRadius: '50%' });
    expect(SHAPE_STYLE.square).toEqual({ borderRadius: '6px' });
    expect(SHAPE_STYLE.triangle).toEqual({ clipPath: 'polygon(50% 4%, 98% 94%, 2% 94%)' });
    expect(SHAPE_STYLE.star).toEqual({ clipPath: 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' });
    expect(SHAPE_STYLE.hexagon).toEqual({ clipPath: 'polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%)' });
  });

  it('cuts the three new shapes with the brief’s clip-paths', () => {
    expect(SHAPE_STYLE.rectangle).toEqual({ clipPath: 'inset(22% 0 round 6px)' });
    expect(SHAPE_STYLE.diamond).toEqual({ clipPath: 'polygon(50% 0, 90% 50%, 50% 100%, 10% 50%)' });
    expect(SHAPE_STYLE.pentagon).toEqual({ clipPath: 'polygon(50% 2%, 98% 38%, 80% 96%, 20% 96%, 2% 38%)' });
  });

  it('gives every shape one cut: a radius or a clip-path, never both, and no two shapes alike', () => {
    for (const s of SHAPES) {
      const st = SHAPE_STYLE[s];
      expect(Number(!!st.borderRadius) + Number(!!st.clipPath), s).toBe(1);
    }
    expect(new Set(SHAPES.map((s) => JSON.stringify(SHAPE_STYLE[s]))).size).toBe(SHAPES.length);
  });
});

describe('colours (4.2, 7.4)', () => {
  /** The board's six colours and their hex values (Sorter.dc.html colors()). */
  const BOARD_HEX: Record<string, string> = {
    yellow: '#ffc21a',
    red: '#f03a3a',
    blue: '#2f8cff',
    green: '#1fb53c',
    pink: '#ff5fb4',
    purple: '#9b4dff',
  };

  it('uses the board’s six colours', () => {
    expect([...SORTER_COLORS].sort()).toEqual(Object.keys(BOARD_HEX).sort());
  });

  it('draws them from the brick tokens, whose base values equal the board’s hex values', () => {
    for (const c of SORTER_COLORS) {
      expect(BRICK_COLORS, c).toContain(c);
      expect(PALETTE[c].base, c).toBe(BOARD_HEX[c]);
    }
  });

  it('uses yellow on the shape levels', () => {
    expect(SHAPE_LEVEL_COLOR).toBe('yellow');
  });
});

describe('the avoid list (9.4)', () => {
  const PAIRS: [SorterColor, SorterColor][] = [
    ['red', 'green'],
    ['blue', 'purple'],
    ['red', 'pink'],
  ];

  it('lists exactly red with green, blue with purple and red with pink', () => {
    expect(sortSets(AVOID_PAIRS)).toEqual(sortSets(PAIRS));
  });

  it('flags each pair in either order', () => {
    for (const [a, b] of PAIRS) {
      expect(colorsClash(a, b), `${a} ${b}`).toBe(true);
      expect(colorsClash(b, a), `${b} ${a}`).toBe(true);
    }
  });

  it('lets every other pair through, a colour with itself included', () => {
    const listed = new Set(PAIRS.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));
    for (const a of SORTER_COLORS) for (const b of SORTER_COLORS) if (!listed.has(`${a}|${b}`)) expect(colorsClash(a, b), `${a} ${b}`).toBe(false);
  });

  it('never flags yellow, so the shape levels always fit', () => {
    for (const c of SORTER_COLORS) expect(colorsClash('yellow', c)).toBe(false);
  });

  it('fits a set of colours only when no two of them clash', () => {
    expect(colorsFit([])).toBe(true);
    expect(colorsFit(['red'])).toBe(true);
    expect(colorsFit(['red', 'blue', 'yellow'])).toBe(true);
    expect(colorsFit(['yellow', 'blue', 'green', 'pink'])).toBe(true);
    expect(colorsFit(['red', 'blue', 'green'])).toBe(false);
    expect(colorsFit(['yellow', 'blue', 'purple'])).toBe(false);
    expect(colorsFit(['pink', 'yellow', 'red'])).toBe(false);
    expect(colorsFit([...SORTER_COLORS])).toBe(false);
  });
});
