/**
 * Shape Sorter rules (six-games brief 4.2, 3.1, 10.2): the match rule on shape and colour levels, what a wrong
 * placement has in common with its hole, the slip keys that make a repeated wrong pair count once for stars, and
 * the names a piece goes by.
 */
import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT, compare, fits, makePuzzles, pieceName, pieceOf, slipKey, type SorterPuzzle } from './puzzles';
import { SHAPES, SORTER_COLORS } from './shapes';

const ALL: SorterPuzzle[] = Array.from({ length: LEVEL_COUNT }, (_, l) => makePuzzles(l)).flat();
const name = (p: SorterPuzzle) => `level ${p.level + 1} puzzle ${p.n + 1}`;

const yellowCircle = pieceOf('circle', 'yellow');
const yellowSquare = pieceOf('square', 'yellow');
const redCircle = pieceOf('circle', 'red');
const blueCircle = pieceOf('circle', 'blue');
const redSquare = pieceOf('square', 'red');
const blueSquare = pieceOf('square', 'blue');

describe('pieceOf builds a piece and its hole', () => {
  it('names the piece `<color>-<shape>`, the id its hole shares', () => {
    expect(redCircle).toEqual({ id: 'red-circle', shape: 'circle', color: 'red' });
    expect(pieceOf('pentagon', 'purple').id).toBe('purple-pentagon');
  });

  it('gives every shape and colour its own id', () => {
    const ids = SHAPES.flatMap((s) => SORTER_COLORS.map((c) => pieceOf(s, c).id));
    expect(new Set(ids).size).toBe(SHAPES.length * SORTER_COLORS.length);
  });
});

describe('compare says what a piece has in common with a hole', () => {
  it('is right when shape and colour both match', () => {
    expect(compare(redCircle, pieceOf('circle', 'red'))).toBe('right');
  });

  it('is same-shape when only the shape matches', () => {
    expect(compare(redCircle, blueCircle)).toBe('same-shape');
  });

  it('is same-color when only the colour matches', () => {
    expect(compare(redCircle, redSquare)).toBe('same-color');
  });

  it('is neither when nothing matches', () => {
    expect(compare(redCircle, blueSquare)).toBe('neither');
  });

  it('gives the same answer whichever way round the two are asked', () => {
    for (const a of [redCircle, blueCircle, redSquare, blueSquare]) for (const b of [redCircle, blueCircle, redSquare, blueSquare]) expect(compare(a, b)).toBe(compare(b, a));
  });
});

describe('the match rule (4.2): a piece fits only its own hole', () => {
  it('on shape levels lets the shape alone decide', () => {
    expect(fits(yellowCircle, pieceOf('circle', 'yellow'), false)).toBe(true);
    expect(fits(yellowCircle, yellowSquare, false)).toBe(false);
    expect(fits(redCircle, blueCircle, false)).toBe(true);
  });

  it('on colour levels needs the shape and the colour', () => {
    expect(fits(redCircle, pieceOf('circle', 'red'), true)).toBe(true);
    expect(fits(redCircle, blueCircle, true)).toBe(false);
    expect(fits(redCircle, redSquare, true)).toBe(false);
    expect(fits(redCircle, blueSquare, true)).toBe(false);
  });

  it('on every board, gives each wrong pair the kind of near miss its level teaches', () => {
    for (const p of ALL) {
      const matches = new Set(p.pieces.flatMap((x) => p.holes.filter((h) => h.id !== x.id).map((h) => compare(x, h))));
      expect(matches.has('right'), name(p)).toBe(false);
      if (p.colorMatters) {
        // Both near misses happen on every colour board, so neither the shape nor the colour alone solves it.
        expect(matches.has('same-shape'), name(p)).toBe(true);
        expect(matches.has('same-color'), name(p)).toBe(true);
      } else {
        // One colour, so every wrong hole is a different shape.
        expect([...matches], name(p)).toEqual(['same-color']);
      }
    }
  });
});

describe('slip keys (3.1): the same wrong pair counts once for stars', () => {
  it('gives the same key for the same piece on the same hole', () => {
    expect(slipKey('red-circle', 'blue-circle')).toBe(slipKey('red-circle', 'blue-circle'));
  });

  it('tells apart a piece on a hole from that hole’s piece on the first piece’s hole', () => {
    expect(slipKey('red-circle', 'blue-circle')).not.toBe(slipKey('blue-circle', 'red-circle'));
  });

  it('gives every pair of different pieces and holes its own key', () => {
    const ids = SHAPES.flatMap((s) => SORTER_COLORS.map((c) => pieceOf(s, c).id));
    const keys = ids.flatMap((a) => ids.filter((b) => b !== a).map((b) => slipKey(a, b)));
    expect(new Set(keys).size).toBe(ids.length * (ids.length - 1));
  });
});

describe('a piece’s name (8.3, 9.2)', () => {
  it('is the shape on shape levels and colour plus shape on colour levels', () => {
    expect(pieceName(yellowCircle, false)).toBe('circle');
    expect(pieceName(redCircle, true)).toBe('red circle');
    expect(pieceName(pieceOf('rectangle', 'purple'), true)).toBe('purple rectangle');
  });

  it('stays lower case for every shape and colour, since it sits inside a sentence', () => {
    for (const s of SHAPES)
      for (const c of SORTER_COLORS)
        for (const cm of [false, true]) {
          const n = pieceName(pieceOf(s, c), cm);
          expect(n).toBe(n.toLowerCase());
          expect(n).toBe(cm ? `${c} ${s}` : s);
        }
  });

  it('is unique on every board, so a child can tell each piece apart by name', () => {
    for (const p of ALL) {
      const names = p.pieces.map((x) => pieceName(x, p.colorMatters));
      expect(new Set(names).size, name(p)).toBe(names.length);
    }
  });
});
