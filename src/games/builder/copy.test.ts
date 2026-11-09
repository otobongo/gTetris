/**
 * Picture Builder copy (six-games brief 8.7, 8.9, 8, 9.2, 7.2, 10.2): every line word for word, which line shows when,
 * the 54-character limit of the help-style help row with the longest names filled in, the accessible names, no em
 * or en dash, no exclamation mark, no straight apostrophe, and none of the board's lines that go.
 */
import { describe, expect, it } from 'vitest';
import { BUILDER_COLORS, NAME_MAX_CHARS, PICTURES, cellsOf, type Picture } from './pictures';
import { LEVEL_COUNT, makePuzzles, type BuilderPuzzle } from './puzzles';
import {
  HELP_MAX_CHARS,
  MODEL_HIDDEN,
  PEEK_LABEL,
  PEEK_NAME,
  PEEK_SHOWN,
  SPEAKER_NAME,
  TITLE,
  helpLine,
  helpLines,
  helpSolved,
  helpStart,
  helpWrong,
  matchText,
  modelName,
  paletteName,
  speechOf,
  squareName,
  titleLine,
  withArticle,
} from './copy';

/* ---------- Helpers ---------- */

const ALL: BuilderPuzzle[] = Array.from({ length: LEVEL_COUNT }, (_, l) => makePuzzles(l)).flat();
const at = (p: BuilderPuzzle) => `Level ${p.level + 1} puzzle ${p.n + 1} (${p.picture.name})`;
const COPY = ALL.find((p) => p.mode === 'copy' && p.picture.name === 'house')!;
const MEMORY = ALL.find((p) => p.mode === 'memory' && p.picture.name === 'house')!;
/** A stand-in with the longest name the rules allow, 12 letters, so the limits hold for any future picture. */
const longest = (mode: 'copy' | 'memory') => ({ mode, picture: { ...COPY.picture, name: 'x'.repeat(NAME_MAX_CHARS) } as Picture });
const PAINTS = [...BUILDER_COLORS, 'eraser'] as const;

/** Every help-row line any puzzle can show, plus the longest-name stand-ins. */
const EVERY_HELP_LINE: string[] = [
  ...ALL.flatMap((p) => helpLines(p)),
  helpSolved(longest('copy')),
  helpSolved(longest('memory')),
  ...Array.from({ length: 25 }, (_, i) => helpWrong(i + 1)),
];
/** Every title line any puzzle can show. */
const EVERY_TITLE: string[] = [...ALL.flatMap((p) => [titleLine(p), titleLine(p, 'look'), titleLine(p, 'hidden')]), titleLine(longest('copy'))];
/** Every other line the game shows or says: match text, Peek, speech and accessible names. */
const EVERY_OTHER_LINE: string[] = [
  TITLE,
  SPEAKER_NAME,
  PEEK_LABEL,
  PEEK_NAME,
  PEEK_SHOWN,
  MODEL_HIDDEN,
  ...ALL.flatMap((p) => [matchText(0, p.bricks), matchText(p.bricks, p.bricks), modelName(p.picture)]),
  ...PAINTS.map((c) => paletteName(c)),
  ...[3, 4, 5].flatMap((size) => Array.from({ length: size * size }, (_, i) => [squareName(size, i, null), ...BUILDER_COLORS.map((c) => squareName(size, i, c))]).flat()),
  ...ALL.map((p) => speechOf(titleLine(p), helpStart(p))),
];
const EVERY_LINE = [...EVERY_HELP_LINE, ...EVERY_TITLE, ...EVERY_OTHER_LINE];

/* ---------- Word for word (8.7) ---------- */

describe('the title line, word for word (8.7)', () => {
  it('asks for the picture by name on copy levels', () => {
    expect(titleLine(COPY)).toBe('Build the house.');
    expect(titleLine({ ...COPY, picture: { ...COPY.picture, name: 'ice cream' } })).toBe('Build the ice cream.');
  });

  it('says "Look closely." while a memory picture shows, and "Build it from memory." once it hides', () => {
    expect(titleLine(MEMORY, 'look')).toBe('Look closely.');
    expect(titleLine(MEMORY, 'hidden')).toBe('Build it from memory.');
    expect(titleLine(MEMORY)).toBe('Build it from memory.');
  });

  it('never names the picture on a memory level, so the title gives nothing away', () => {
    for (const p of ALL.filter((x) => x.mode === 'memory')) for (const view of ['look', 'hidden'] as const) expect(titleLine(p, view), at(p)).not.toContain(p.picture.name);
  });

  it('keeps the copy title the same whatever the view', () => {
    for (const p of ALL.filter((x) => x.mode === 'copy')) expect(titleLine(p, 'look'), at(p)).toBe(titleLine(p, 'hidden'));
  });
});

describe('the help line, word for word (8.7)', () => {
  it('starts each kind of puzzle with its own line', () => {
    expect(helpStart(COPY)).toBe('Pick a color, then tap or drag over the squares.');
    expect(helpStart(MEMORY, 'look')).toBe('Remember the colors and where they go.');
    expect(helpStart(MEMORY, 'hidden')).toBe('Tap Peek if you need another look.');
    expect(helpStart(MEMORY)).toBe('Tap Peek if you need another look.');
  });

  it('names the wrong bricks: one, then a number', () => {
    expect(helpWrong(1)).toBe('One brick is not quite right.');
    expect(helpWrong(2)).toBe('2 bricks are not quite right.');
    expect(helpWrong(3)).toBe('3 bricks are not quite right.');
    expect(helpWrong(25)).toBe('25 bricks are not quite right.');
  });

  it('names the picture once it is built, and says from memory on memory levels', () => {
    expect(helpSolved(COPY)).toBe('You built the house.');
    expect(helpSolved(MEMORY)).toBe('You built the house from memory.');
  });

  it('shows the match text in copy levels as "{5} of {10} bricks right"', () => {
    expect(matchText(5, 10)).toBe('5 of 10 bricks right');
    expect(matchText(0, 14)).toBe('0 of 14 bricks right');
    expect(matchText(14, 14)).toBe('14 of 14 bricks right');
  });

  it('labels Peek "Peek", names it "Peek at the picture" and announces "Picture shown." (8.7, 9.2)', () => {
    expect(PEEK_LABEL).toBe('Peek');
    expect(PEEK_NAME).toBe('Peek at the picture');
    expect(PEEK_SHOWN).toBe('Picture shown.');
  });

  it('names the speaker "Hear the help line" and the game Picture Builder', () => {
    expect(SPEAKER_NAME).toBe('Hear the help line');
    expect(TITLE).toBe('Picture Builder');
  });
});

describe('which help line shows (4.6, 8.7)', () => {
  it('copy levels: the start line, then the wrong line while a brick is wrong, then the solved line', () => {
    expect(helpLine(COPY, { wrong: 0, solved: false })).toBe(helpStart(COPY));
    expect(helpLine(COPY, { wrong: 1, solved: false })).toBe('One brick is not quite right.');
    expect(helpLine(COPY, { wrong: 4, solved: false })).toBe('4 bricks are not quite right.');
    expect(helpLine(COPY, { wrong: 0, solved: true })).toBe('You built the house.');
  });

  it('memory levels: the look line while the picture shows, the Peek line once it hides, never a wrong line', () => {
    expect(helpLine(MEMORY, { view: 'look', wrong: 0, solved: false })).toBe('Remember the colors and where they go.');
    expect(helpLine(MEMORY, { view: 'hidden', wrong: 0, solved: false })).toBe('Tap Peek if you need another look.');
    for (const wrong of [1, 2, 9]) {
      expect(helpLine(MEMORY, { view: 'hidden', wrong, solved: false })).toBe('Tap Peek if you need another look.');
      expect(helpLine(MEMORY, { view: 'look', wrong, solved: false })).toBe('Remember the colors and where they go.');
    }
    expect(helpLine(MEMORY, { wrong: 0, solved: true })).toBe('You built the house from memory.');
  });

  it('lets the solved line win over everything else', () => {
    for (const p of [COPY, MEMORY]) for (const view of ['look', 'hidden'] as const) expect(helpLine(p, { view, wrong: 3, solved: true })).toBe(helpSolved(p));
  });

  it('lists in helpLines every line a puzzle can show, and no wrong line on memory levels', () => {
    for (const p of ALL) {
      const want =
        p.mode === 'copy'
          ? new Set([helpStart(p), helpSolved(p), ...Array.from({ length: p.target.length }, (_, i) => helpWrong(i + 1))])
          : new Set([helpStart(p, 'look'), helpStart(p, 'hidden'), helpSolved(p)]);
      expect(new Set(helpLines(p)), at(p)).toEqual(want);
    }
  });

  it('reads the title line, then the help line, on the speaker (4.6)', () => {
    expect(speechOf(titleLine(COPY), helpStart(COPY))).toBe('Build the house. Pick a color, then tap or drag over the squares.');
    expect(speechOf(titleLine(MEMORY, 'look'), helpStart(MEMORY, 'look'))).toBe('Look closely. Remember the colors and where they go.');
  });
});

/* ---------- Accessible names (9.2) ---------- */

describe('accessible names (9.2)', () => {
  it('names a square by row and column, counted from 1, then its colour or "empty"', () => {
    expect(squareName(4, 6, 'red')).toBe('Row 2, column 3, red');
    expect(squareName(4, 6, null)).toBe('Row 2, column 3, empty');
    expect(squareName(3, 0, 'blue')).toBe('Row 1, column 1, blue');
    expect(squareName(5, 24, 'white')).toBe('Row 5, column 5, white');
    expect(squareName(3, 8, null)).toBe('Row 3, column 3, empty');
  });

  it('gives every square of a board its own name, so colour is never the only signal', () => {
    for (const size of [3, 4, 5]) {
      const names = Array.from({ length: size * size }, (_, i) => squareName(size, i, null));
      expect(new Set(names).size).toBe(size * size);
      for (const c of BUILDER_COLORS) expect(squareName(size, 0, c)).toContain(c);
    }
  });

  it('names the palette buttons by colour, and the eraser "Eraser"', () => {
    expect(PAINTS.map((c) => paletteName(c))).toEqual(['Red', 'Yellow', 'Green', 'Blue', 'Orange', 'White', 'Eraser']);
  });

  it('reads the house as the brief writes it: "Picture of a house. Row 1: empty, red, red, empty. Row 2: ..."', () => {
    expect(modelName(COPY.picture)).toBe(
      'Picture of a house. Row 1: empty, red, red, empty. Row 2: red, red, red, red. Row 3: yellow, yellow, blue, yellow. Row 4: yellow, yellow, blue, yellow.',
    );
  });

  it('reads every picture row by row, square by square, with its name after "a" or "an"', () => {
    for (const pic of PICTURES) {
      const size = pic.art.split('/').length;
      const cells = cellsOf(pic.art);
      const rows = Array.from({ length: size }, (_, r) => `Row ${r + 1}: ${cells.slice(r * size, r * size + size).map((c) => c ?? 'empty').join(', ')}.`);
      expect(modelName(pic), pic.name).toBe([`Picture of ${withArticle(pic.name)}.`, ...rows].join(' '));
    }
  });

  it('puts "an" before a vowel and "a" before anything else', () => {
    expect(withArticle('apple')).toBe('an apple');
    expect(withArticle('ice cream')).toBe('an ice cream');
    expect(withArticle('owl')).toBe('an owl');
    expect(withArticle('umbrella')).toBe('an umbrella');
    expect(withArticle('house')).toBe('a house');
    expect(withArticle('tree')).toBe('a tree');
    expect(withArticle('flower pot')).toBe('a flower pot');
  });

  it('names the hidden model "Picture hidden. Tap Peek to look again."', () => {
    expect(MODEL_HIDDEN).toBe('Picture hidden. Tap Peek to look again.');
  });
});

/* ---------- Length (7.2, 10.2) ---------- */

describe('help row length (7.2, 10.2): 54 characters at most, the help style', () => {
  it('sets the limit at 54', () => {
    expect(HELP_MAX_CHARS).toBe(54);
  });

  it('keeps every help line of every puzzle within 54 characters', () => {
    for (const p of ALL) for (const line of helpLines(p)) expect(line.length, `${at(p)}: ${line}`).toBeLessThanOrEqual(54);
  });

  it('stays within 54 with the longest name the rules allow (12 letters) and the most wrong bricks (25)', () => {
    for (const line of EVERY_HELP_LINE) expect(line.length, line).toBeLessThanOrEqual(HELP_MAX_CHARS);
    expect(helpSolved(longest('memory')).length).toBeLessThanOrEqual(54);
  });
});

/* ---------- Copy rules (8, 8.9, 10.2) ---------- */

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

  it('starts every help and title line with a capital and ends it with a full stop', () => {
    for (const line of [...EVERY_HELP_LINE, ...EVERY_TITLE, PEEK_SHOWN, MODEL_HIDDEN]) {
      expect(line, line).toMatch(/^[A-Z0-9]/);
      expect(line, line).toMatch(/\.$/);
    }
  });

  it('writes colour and picture names in lower case inside a sentence', () => {
    for (const line of [...EVERY_HELP_LINE, ...EVERY_TITLE, ...ALL.map((p) => modelName(p.picture))]) {
      const rest = line.slice(1);
      for (const word of [...BUILDER_COLORS, ...PICTURES.map((p) => p.name)]) {
        const cap = word[0].toUpperCase() + word.slice(1);
        expect(rest.includes(` ${cap}`), `"${line}" holds "${cap}"`).toBe(false);
      }
    }
  });

  it('drops the board’s lines that go (8.9)', () => {
    const GONE = [
      'Look, then build it',
      'Clear my board',
      'Copy it',
      'From memory',
      'Build it from memory!',
      'Look closely...',
      '...',
      'Look again',
      'squares match',
      'You built a ',
      'Every brick in the right spot',
      'Try it from memory next',
      'no peeks',
      'Amazing',
      'Great remembering',
      'Next picture',
      'Square ',
    ];
    for (const line of EVERY_LINE) for (const gone of GONE) expect(line.includes(gone), `"${line}" holds "${gone}"`).toBe(false);
  });

  it('keeps the full stop the board’s "Build the {name}" lacked', () => {
    for (const p of ALL.filter((x) => x.mode === 'copy')) expect(titleLine(p), at(p)).toBe(`Build the ${p.picture.name}.`);
  });
});
