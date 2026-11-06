/** Color Mixer copy (brief 8, 8.2, 8.9, 9.2, 10.2): every line word for word, within the help-row limit, with no dashes. */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAINT_IDS, RECIPES, RESULT_IDS, SAME_TEXT, type ColorId, type PaintId, type ResultId } from './colors';
import {
  EMPTY_SLOT_LABEL,
  RESULT_NAME_EMPTY,
  SPEAKER_NAME,
  TITLE,
  bowlName,
  chip,
  helpSlip,
  helpSolved,
  helpStart,
  potName,
  resultName,
  slotName,
  swatchName,
} from './copy';
import { CHAPTERS, LEVELS } from './levels';
import { makePuzzles, type FinishPuzzle, type GuessPuzzle, type MakePuzzle, type Puzzle } from './puzzles';

/** The help style's limit (7.2): Color Mixer uses the help style, so 54 characters at most. */
const HELP_MAX = 54;
const COLORS: ColorId[] = [...PAINT_IDS, ...RESULT_IDS];

const finish = (goal: ResultId, given: PaintId): FinishPuzzle => ({ form: 'finish', goal, given, shelf: [], answer: given });
const make = (goal: ResultId): MakePuzzle => ({ form: 'make', goal, shelf: [], answer: ['red', 'yellow'] });
const guess = (a: PaintId, b: PaintId, answer: ResultId): GuessPuzzle => ({ form: 'guess', paints: [a, b], choices: [answer], answer });

/** Every puzzle the game can show, over a spread of seeds. */
const PUZZLES: Puzzle[] = Array.from({ length: 40 }, (_, i) => i * 104729 + 3).flatMap((seed) => LEVELS.flatMap((_, level) => makePuzzles(level, seed)));

const helpLines = (p: Puzzle): string[] => [helpStart(p), helpSlip(p), helpSolved(p)];

/** Every child-facing line and accessible name the game's copy module can produce. */
function everyLine(): string[] {
  const lines = new Set<string>([TITLE, SPEAKER_NAME, ...EMPTY_SLOT_LABEL, ...Object.values(RESULT_NAME_EMPTY), SAME_TEXT, ...RECIPES.map((r) => r.text)]);
  for (const p of PUZZLES) for (const l of [chip(p).text, ...helpLines(p)]) lines.add(l);
  for (const c of COLORS) {
    lines.add(resultName(c));
    lines.add(bowlName(c));
  }
  lines.add(bowlName(null));
  for (const r of RESULT_IDS) lines.add(swatchName(r));
  for (const paint of PAINT_IDS) {
    lines.add(potName(paint));
    for (const slot of [0, 1] as const) for (const given of [false, true]) lines.add(slotName(slot, paint, given));
  }
  for (const slot of [0, 1] as const) lines.add(slotName(slot, null, false));
  for (const c of CHAPTERS) {
    lines.add(c.title);
    lines.add(c.note);
  }
  return [...lines];
}

describe('Color Mixer lines, word for word (8.2)', () => {
  it('names the game, the speaker and the empty slots', () => {
    expect(TITLE).toBe('Color Mixer');
    expect(SPEAKER_NAME).toBe('Hear the question');
    expect([...EMPTY_SLOT_LABEL]).toEqual(['paint 1', 'paint 2']);
  });

  it('asks "Can you make {green}?" on the goal chip, with the goal colour circle before the name', () => {
    for (const p of [finish('green', 'blue'), make('green')]) expect(chip(p)).toEqual({ text: 'Can you make green?', circle: 'green' });
    expect(chip(make('sky')).text).toBe('Can you make sky blue?');
    for (const r of RESULT_IDS) expect(chip(make(r)).circle).toBe(r);
  });

  it('asks "What do {red} and {yellow} make?" on the Guess chip, in slot order', () => {
    expect(chip(guess('red', 'yellow', 'orange'))).toEqual({ text: 'What do red and yellow make?', circle: null });
    expect(chip(guess('yellow', 'red', 'orange')).text).toBe('What do yellow and red make?');
    expect(chip(guess('white', 'blue', 'sky')).text).toBe('What do white and blue make?');
  });

  it('shows the form’s result name before anything is mixed', () => {
    expect(RESULT_NAME_EMPTY).toEqual({ finish: 'Pick one more paint', make: 'Pick two paints', guess: 'Pick a color' });
  });

  it('names a mix by its result, and the same paint twice by that paint', () => {
    expect(RESULT_IDS.map(resultName)).toEqual(['Orange', 'Green', 'Purple', 'Pink', 'Sky blue', 'Cream']);
    expect(PAINT_IDS.map(resultName)).toEqual(['Red', 'Yellow', 'Blue', 'White']);
  });

  it('starts each form with its help line', () => {
    expect(helpStart(finish('green', 'blue'))).toBe('Tap the paint that makes green.');
    expect(helpStart(make('green'))).toBe('Tap two paints to mix them.');
    expect(helpStart(guess('red', 'yellow', 'orange'))).toBe('Tap the color they make.');
  });

  it('says it is not the goal yet after a slip', () => {
    expect(helpSlip(finish('green', 'blue'))).toBe('Not green yet. Try another paint.');
    expect(helpSlip(make('green'))).toBe('Not green yet. Try another pair.');
    expect(helpSlip(guess('red', 'yellow', 'orange'))).toBe('Not that one. Look at the two paints again.');
  });

  it('states the result once solved', () => {
    expect(helpSolved(finish('green', 'blue'))).toBe('You made green.');
    expect(helpSolved(make('green'))).toBe('You made green.');
    expect(helpSolved(guess('red', 'yellow', 'orange'))).toBe('They make orange.');
    expect(helpSolved(make('sky'))).toBe('You made sky blue.');
    expect(helpSolved(guess('blue', 'white', 'sky'))).toBe('They make sky blue.');
  });

  it('names every goal in lower case inside the help lines', () => {
    for (const r of RESULT_IDS) {
      const word = resultName(r).toLowerCase();
      expect(helpStart(finish(r, 'red'))).toBe(`Tap the paint that makes ${word}.`);
      expect(helpSlip(finish(r, 'red'))).toBe(`Not ${word} yet. Try another paint.`);
      expect(helpSlip(make(r))).toBe(`Not ${word} yet. Try another pair.`);
      expect(helpSolved(make(r))).toBe(`You made ${word}.`);
    }
  });
});

describe('accessible names (9.2)', () => {
  it('names pots "Red paint"', () => {
    expect(PAINT_IDS.map(potName)).toEqual(['Red paint', 'Yellow paint', 'Blue paint', 'White paint']);
  });

  it('names slots "Paint 1: red", "Paint 1: empty" and "Paint 1: red, given"', () => {
    expect(slotName(0, 'red', false)).toBe('Paint 1: red');
    expect(slotName(0, null, false)).toBe('Paint 1: empty');
    expect(slotName(0, 'red', true)).toBe('Paint 1: red, given');
    expect(slotName(1, 'white', false)).toBe('Paint 2: white');
    expect(slotName(1, null, false)).toBe('Paint 2: empty');
    expect(slotName(1, 'blue', true)).toBe('Paint 2: blue, given');
  });

  it('names the bowl "Bowl: orange" or "Bowl: empty"', () => {
    expect(bowlName('orange')).toBe('Bowl: orange');
    expect(bowlName(null)).toBe('Bowl: empty');
    expect(bowlName('sky')).toBe('Bowl: sky blue');
    expect(bowlName('red')).toBe('Bowl: red');
  });

  it('names each Guess swatch by its colour', () => {
    expect(RESULT_IDS.map(swatchName)).toEqual(['Orange', 'Green', 'Purple', 'Pink', 'Sky blue', 'Cream']);
  });
});

describe('copy rules (8, 7.2, 10.2)', () => {
  it(`keeps every help line within ${HELP_MAX} characters, with the longest names filled in`, () => {
    const all = PUZZLES.flatMap(helpLines);
    // the longest colour name, in every form
    all.push(...helpLines(finish('sky', 'blue')), ...helpLines(make('sky')), ...helpLines(guess('blue', 'white', 'sky')));
    const over = all.filter((l) => l.length > HELP_MAX);
    expect(over).toEqual([]);
    expect(Math.max(...all.map((l) => l.length))).toBeGreaterThan(30);
  });

  it('writes no em dash, no en dash and no exclamation mark in any line', () => {
    for (const line of everyLine()) {
      expect(line, line).not.toMatch(/[–—]/);
      expect(line, line).not.toContain('!');
    }
  });

  it('uses no straight apostrophe or quote in any line', () => {
    for (const line of everyLine()) expect(line, line).not.toMatch(/['"]/);
  });

  it('starts every line with a capital and writes colour names inside a sentence in lower case', () => {
    const lower = new Set(['paint 1', 'paint 2', 'red, yellow and blue', 'add white', 'every mix']);
    const capitalNames = /(?<!^)\b(Red|Yellow|Blue|White|Orange|Green|Purple|Pink|Sky blue|Cream)\b/;
    for (const line of everyLine()) {
      if (!lower.has(line)) expect(line[0], line).toBe(line[0].toUpperCase());
      expect(line, line).not.toMatch(capitalNames);
    }
  });

  it('ends every sentence-length line with a full stop or a question mark', () => {
    const sentences = [...PUZZLES.flatMap((p) => [chip(p).text, ...helpLines(p)]), SAME_TEXT, ...RECIPES.map((r) => r.text)];
    for (const line of sentences) expect(line, line).toMatch(/[.?]$/);
    for (const p of PUZZLES) expect(chip(p).text).toMatch(/\?$/);
  });

  it('keeps none of the board lines that go (8.9)', () => {
    const gone = [
      /Found \d+ of 6/,
      /\bDiscover\b/,
      /\bChallenge\b/,
      /Empty the bowl/,
      /My color book/,
      /What new color will you discover\?/,
      /Now pick one more/,
      /You made \w+( \w+)?!/,
      /Now it is pink!/,
      /Try two different paints!/,
    ];
    for (const line of everyLine()) for (const g of gone) expect(line, line).not.toMatch(g);
  });

  it('keeps those lines and any dash out of the game’s source files', () => {
    const dir = new URL('./', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const file of files) {
      const src = readFileSync(new URL(file, dir), 'utf8');
      expect(src, file).not.toMatch(/[–—]/);
      expect(src, file).not.toMatch(/Found \{|Empty the bowl|My color book|What new color|Now pick one more|Now it is pink!|different paints!/);
    }
  });
});
