/**
 * Shape Sorter copy (six-games brief 8.3, 8.9, 9.2, 7.2, 10.2): every line word for word, the 44-character limit of
 * the prompt-style help row with the longest names filled in, no em or en dash, no exclamation mark, and none of
 * the board's lines that go.
 */
import { describe, expect, it } from 'vitest';
import {
  HELP_MAX_CHARS,
  HELP_SOLVED,
  HOLES_LABEL,
  SPEAKER_NAME,
  TRAY_LABEL,
  factFor,
  factStart,
  filledHoleLabel,
  helpDragging,
  helpLines,
  helpPicked,
  helpStart,
  helpWrong,
  holeLabel,
  pieceLabel,
  spokenOnPlace,
} from './copy';
import { LEVEL_COUNT, compare, makePuzzles, pieceName, pieceOf, type Match, type SorterPuzzle } from './puzzles';
import { SHAPES, SORTER_COLORS } from './shapes';

const ALL: SorterPuzzle[] = Array.from({ length: LEVEL_COUNT }, (_, l) => makePuzzles(l)).flat();
const name = (p: SorterPuzzle) => `level ${p.level + 1} puzzle ${p.n + 1}`;
const EVERY_PIECE = SHAPES.flatMap((s) => SORTER_COLORS.map((c) => pieceOf(s, c)));
const MATCHES: Match[] = ['same-shape', 'same-color', 'neither'];

/** Every help-row line any piece and hole can produce, on both kinds of level. */
const EVERY_HELP_LINE: string[] = [
  helpStart(false),
  helpStart(true),
  HELP_SOLVED,
  ...EVERY_PIECE.flatMap((p) =>
    [false, true].flatMap((cm) => [helpPicked(pieceName(p, cm)), helpDragging(pieceName(p, cm)), ...MATCHES.map((m) => helpWrong(p, m, cm))]),
  ),
];
/** Every other line the game shows or says: the fact bar, the badge names, speech and accessible names. */
const EVERY_OTHER_LINE: string[] = [
  factStart(false),
  factStart(true),
  SPEAKER_NAME,
  TRAY_LABEL,
  HOLES_LABEL,
  ...EVERY_PIECE.flatMap((p) => [factFor(p).text, factFor(p).badgeName]),
  ...EVERY_PIECE.flatMap((p) =>
    [false, true].flatMap((cm) => [spokenOnPlace(p, cm), pieceLabel(p, cm), holeLabel(p, cm), filledHoleLabel(p, cm)]),
  ),
];
const EVERY_LINE = [...EVERY_HELP_LINE, ...EVERY_OTHER_LINE];

describe('help row lines, word for word (8.3)', () => {
  it('starts a shape level and a colour level with their own line', () => {
    expect(helpStart(false)).toBe('Drag each shape into its hole.');
    expect(helpStart(true)).toBe('Match the shape and the color.');
  });

  it('names the picked piece’s hole and the dragged piece', () => {
    expect(helpPicked('red circle')).toBe('Now tap the red circle hole.');
    expect(helpPicked(pieceName(pieceOf('circle', 'yellow'), false))).toBe('Now tap the circle hole.');
    expect(helpDragging('red circle')).toBe('Drop the red circle in its hole.');
    expect(helpDragging(pieceName(pieceOf('star', 'yellow'), false))).toBe('Drop the star in its hole.');
  });

  it('says every shape is home once the board is sorted', () => {
    expect(HELP_SOLVED).toBe('Every shape is home.');
  });
});

describe('which wrong line shows (8.3, 10.2)', () => {
  it('names the hole’s shape on shape levels, whatever matched', () => {
    const hole = pieceOf('square', 'yellow');
    for (const m of MATCHES) expect(helpWrong(hole, m, false)).toBe('That hole is for the square.');
  });

  it('says the hole’s colour when only the shape matched', () => {
    const piece = pieceOf('circle', 'blue');
    const hole = pieceOf('circle', 'red');
    expect(compare(piece, hole)).toBe('same-shape');
    expect(helpWrong(hole, compare(piece, hole), true)).toBe('Same shape, but this hole is red.');
  });

  it('says the hole’s shape when only the colour matched', () => {
    const piece = pieceOf('circle', 'red');
    const hole = pieceOf('square', 'red');
    expect(helpWrong(hole, compare(piece, hole), true)).toBe('Same color, but this hole is a square.');
  });

  it('names the whole hole when neither matched', () => {
    const piece = pieceOf('circle', 'red');
    const hole = pieceOf('square', 'blue');
    expect(helpWrong(hole, compare(piece, hole), true)).toBe('That hole is for the blue square.');
  });

  it('describes the hole, never the piece that was dropped', () => {
    const hole = pieceOf('hexagon', 'pink');
    for (const m of MATCHES) {
      const line = helpWrong(hole, m, true);
      expect(line.includes('pink') || line.includes('hexagon'), line).toBe(true);
    }
    expect(helpWrong(hole, 'same-shape', true)).not.toContain('hexagon');
    expect(helpWrong(hole, 'same-color', true)).not.toContain('pink');
  });
});

describe('the fact bar (8.3, 9.2)', () => {
  it('opens a board with its level’s line', () => {
    expect(factStart(false)).toBe('Every shape has a home. Look at the corners.');
    expect(factStart(true)).toBe('Look closely: each hole has a color too.');
  });

  const FACTS: Record<string, string> = {
    circle: 'A circle is round. It has no corners.',
    square: 'A square has 4 sides, all the same length.',
    triangle: 'A triangle has 3 sides and 3 corners.',
    star: 'A star has 5 points.',
    hexagon: 'A hexagon has 6 sides, like a honeycomb cell.',
    rectangle: 'A rectangle has 4 sides. Two are long, two are short.',
    diamond: 'A diamond has 4 sides of the same length.',
    pentagon: 'A pentagon has 5 sides and 5 corners.',
  };
  const BADGE_NAMES: Record<string, string> = {
    circle: 'no corners',
    star: '5 points',
    triangle: '3 sides',
    hexagon: '6 sides',
    pentagon: '5 sides',
    square: '4 sides',
    rectangle: '4 sides',
    diamond: '4 sides',
  };

  it('has a fact and a badge name for every shape, word for word', () => {
    expect(Object.keys(FACTS).sort()).toEqual([...SHAPES].sort());
    for (const s of SHAPES) {
      const f = factFor(pieceOf(s, 'yellow'));
      expect(f.text, s).toBe(FACTS[s]);
      expect(f.badgeName, s).toBe(BADGE_NAMES[s]);
    }
  });

  it('shows the same fact whatever the piece’s colour', () => {
    for (const s of SHAPES) for (const c of SORTER_COLORS) expect(factFor(pieceOf(s, c))).toEqual(factFor(pieceOf(s, 'yellow')));
  });

  it('shows on the badge the number its name says (no corners is 0)', () => {
    for (const s of SHAPES) {
      const f = factFor(pieceOf(s, 'yellow'));
      const said = f.badgeName === 'no corners' ? '0' : f.badgeName.split(' ')[0];
      expect(f.badge, s).toBe(said);
      expect(f.badge, s).toMatch(/^\d$/);
    }
  });
});

describe('speech and accessible names (8.3, 9.2)', () => {
  it('names the speaker "Hear the help line"', () => {
    expect(SPEAKER_NAME).toBe('Hear the help line');
  });

  it('says the placed piece’s name: "circle" or "red circle"', () => {
    expect(spokenOnPlace(pieceOf('circle', 'yellow'), false)).toBe('circle');
    expect(spokenOnPlace(pieceOf('circle', 'red'), true)).toBe('red circle');
  });

  it('labels the tray, the holes, each piece and each hole', () => {
    expect(TRAY_LABEL).toBe('Shapes to place');
    expect(HOLES_LABEL).toBe('Holes');
    expect(pieceLabel(pieceOf('circle', 'yellow'), false)).toBe('circle');
    expect(pieceLabel(pieceOf('circle', 'red'), true)).toBe('red circle');
    expect(holeLabel(pieceOf('circle', 'red'), true)).toBe('red circle hole');
    expect(holeLabel(pieceOf('circle', 'yellow'), false)).toBe('circle hole');
    expect(filledHoleLabel(pieceOf('circle', 'red'), true)).toBe('Filled red circle hole');
    expect(filledHoleLabel(pieceOf('star', 'yellow'), false)).toBe('Filled star hole');
  });

  it('carries the colour in every piece and hole name on colour levels, so colour is never the only signal', () => {
    for (const p of EVERY_PIECE) {
      expect(pieceLabel(p, true)).toContain(p.color);
      expect(holeLabel(p, true)).toContain(p.color);
      expect(filledHoleLabel(p, true)).toContain(p.color);
    }
  });

  it('gives each piece and each hole on a board its own name', () => {
    for (const p of ALL) {
      const pieces = p.pieces.map((x) => pieceLabel(x, p.colorMatters));
      const holes = p.holes.map((x) => holeLabel(x, p.colorMatters));
      expect(new Set(pieces).size, name(p)).toBe(pieces.length);
      expect(new Set(holes).size, name(p)).toBe(holes.length);
    }
  });
});

describe('help row length (7.2, 10.2): 44 characters at most', () => {
  it('sets the limit at 44, the prompt style', () => {
    expect(HELP_MAX_CHARS).toBe(44);
  });

  it('keeps every line within 44 characters with the longest names filled in', () => {
    for (const line of EVERY_HELP_LINE) expect(line.length, line).toBeLessThanOrEqual(44);
  });

  it('keeps every line each board can show within 44 characters', () => {
    for (const p of ALL) for (const line of helpLines(p)) expect(line.length, `${name(p)}: ${line}`).toBeLessThanOrEqual(HELP_MAX_CHARS);
  });

  it('lists in helpLines every line the board can show: start, solved, picked and dragging, and each wrong pair', () => {
    for (const p of ALL) {
      const cm = p.colorMatters;
      const want = new Set([
        helpStart(cm),
        HELP_SOLVED,
        ...p.pieces.flatMap((x) => [helpPicked(pieceName(x, cm)), helpDragging(pieceName(x, cm))]),
        ...p.pieces.flatMap((x) => p.holes.filter((h) => h.id !== x.id).map((h) => helpWrong(h, compare(x, h), cm))),
      ]);
      expect(new Set(helpLines(p)), name(p)).toEqual(want);
    }
  });
});

describe('copy rules (8, 8.9, 10.2)', () => {
  it('has no em dash and no en dash', () => {
    for (const line of EVERY_LINE) expect(/[–—]/.test(line), line).toBe(false);
  });

  it('has no exclamation mark: the one exclamation belongs to the shared game-finished line', () => {
    for (const line of EVERY_LINE) expect(line, line).not.toContain('!');
  });

  it('has no straight apostrophe (rendered copy uses ’)', () => {
    for (const line of EVERY_LINE) expect(line, line).not.toContain("'");
  });

  it('starts each sentence with a capital and ends it with a full stop', () => {
    for (const line of [...EVERY_HELP_LINE, factStart(false), factStart(true), ...SHAPES.map((s) => factFor(pieceOf(s, 'yellow')).text)]) {
      expect(line, line).toMatch(/^[A-Z]/);
      expect(line, line).toMatch(/\.$/);
    }
  });

  it('writes colour and shape names in lower case inside a sentence', () => {
    for (const line of EVERY_HELP_LINE) {
      const rest = line.slice(1);
      for (const word of [...SHAPES, ...SORTER_COLORS]) {
        const cap = word[0].toUpperCase() + word.slice(1);
        expect(rest, line).not.toContain(cap);
      }
    }
  });

  it('drops the board’s lines that go (8.9)', () => {
    const GONE = [
      ' of 5',
      'Two shapes',
      'Three shapes',
      'Five shapes',
      'Mix it up',
      'Start over',
      'Oops',
      'Right shape',
      'Right color',
      'Find the',
      'AND',
      'You sorted every shape',
      'All sorted',
      'Next level',
      'Play again',
      'Count them',
      'at all',
    ];
    for (const line of EVERY_LINE) for (const gone of GONE) expect(line, `"${line}" holds "${gone}"`).not.toContain(gone);
  });
});
