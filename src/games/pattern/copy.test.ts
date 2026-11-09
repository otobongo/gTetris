/** Pattern Train copy (brief 8, 8.5, 8.9, 9.2, 7.2, 10.2 "Copy"): every line word for word, the help lines within the
    help style's 54 characters with the longest car names filled in, and no dashes, exclamations or straight quotes. */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OFFER_LINE, SWAPPED_LINE } from '../kit/copy';
import { ALL_CARS, carName, type Car } from './cars';
import * as copy from './copy';
import {
  HELP_MAX_CHARS,
  HELP_START,
  HELP_WRONG,
  PROMPT,
  PROMPT_SOLVED,
  SPEAKER_NAME,
  TITLE,
  TRAY_LABEL,
  choiceName,
  helpLines,
  helpSolved,
  speech,
  trainName,
} from './copy';
import { CHAPTERS, LEVELS } from './levels';
import { FIXTURES, makePuzzles, type PatternPuzzle } from './puzzles';

/** 7.2: help-style lines (Mixer, Pattern, Calculator, Builder) hold 54 characters at most. */
const HELP_LIMIT = 54;

const car = (color: Car['color'], shape: Car['shape']): Car => ({ color, shape });
const rc = car('red', 'circle');
const bs = car('blue', 'square');
const yt = car('yellow', 'triangle');

/** Every puzzle the game can deal over a spread of seeds. */
const PUZZLES: PatternPuzzle[] = Array.from({ length: 40 }, (_, i) => i * 104729 + 3).flatMap((seed) => LEVELS.flatMap((_, level) => makePuzzles(level, seed)));

/** The car with the longest name, so a line with it in is the longest that line gets. */
const LONGEST = ALL_CARS.reduce((a, b) => (carName(b).length > carName(a).length ? b : a));

/** Every child-facing line and accessible name the game's copy module can produce. */
function everyLine(): string[] {
  const lines = new Set<string>();
  for (const value of Object.values(copy)) if (typeof value === 'string') lines.add(value);
  for (const p of PUZZLES) {
    for (const l of helpLines(p)) lines.add(l);
    lines.add(speech(p.cars));
    lines.add(trainName(p.cars, null));
    lines.add(trainName(p.cars, p.answer));
  }
  for (const c of ALL_CARS) {
    lines.add(helpSolved(c));
    lines.add(choiceName(c));
  }
  for (const c of CHAPTERS) {
    lines.add(c.title);
    lines.add(c.note);
  }
  return [...lines];
}

describe('Pattern Train lines, word for word (8.5)', () => {
  it('names the game and the speaker', () => {
    expect(TITLE).toBe('Pattern Train');
    expect(SPEAKER_NAME).toBe('Hear the pattern');
  });

  it('asks the prompt, and says the pattern is complete once solved', () => {
    expect(PROMPT).toBe('Look at the train. What is the pattern?');
    expect(PROMPT_SOLVED).toBe('Pattern complete.');
  });

  it('labels the tray', () => {
    expect(TRAY_LABEL).toBe('Which car comes next?');
  });

  it('gives the start and wrong help lines', () => {
    expect(HELP_START).toBe('Say the cars out loud, then pick the next one.');
    expect(HELP_WRONG).toBe('Say the pattern out loud and try again.');
  });

  it('says "{Yellow triangle} comes next." once solved, the name capitalised at the start of the line', () => {
    expect(helpSolved(yt)).toBe('Yellow triangle comes next.');
    expect(helpSolved(rc)).toBe('Red circle comes next.');
    expect(helpSolved(car('pink', 'star'))).toBe('Pink star comes next.');
    for (const c of ALL_CARS) {
      const name = carName(c);
      expect(helpSolved(c)).toBe(`${name[0].toUpperCase()}${name.slice(1)} comes next.`);
    }
  });

  it('reads the train aloud: "Red circle, blue square, red circle, blue square. What comes next?"', () => {
    expect(speech([rc, bs, rc, bs])).toBe('Red circle, blue square, red circle, blue square. What comes next?');
    expect(speech([rc, bs, yt, rc, bs])).toBe('Red circle, blue square, yellow triangle, red circle, blue square. What comes next?');
  });

  it('reads every dealt train car by car, in order, the first name capitalised and the rest in lower case', () => {
    for (const p of PUZZLES) {
      const names = p.cars.map(carName);
      names[0] = `${names[0][0].toUpperCase()}${names[0].slice(1)}`;
      expect(speech(p.cars)).toBe(`${names.join(', ')}. What comes next?`);
    }
  });

  it('gives the help row the start, wrong and solved lines of a puzzle, in that order', () => {
    for (const p of PUZZLES.slice(0, 50)) expect(helpLines(p)).toEqual([HELP_START, HELP_WRONG, helpSolved(p.answer)]);
  });
});

describe('accessible names (9.2)', () => {
  it('names the train as one image, with "empty car" at the end until it is solved', () => {
    expect(trainName([rc, bs, rc, bs], null)).toBe('Train: red circle, blue square, red circle, blue square, empty car.');
  });

  it('puts the answer in place of "empty car" once solved', () => {
    expect(trainName([rc, bs, rc, bs], rc)).toBe('Train: red circle, blue square, red circle, blue square, red circle.');
    expect(trainName([rc, bs, yt, rc, bs], yt)).toBe('Train: red circle, blue square, yellow triangle, red circle, blue square, yellow triangle.');
  });

  it('names every dealt train car by car, the shown cars plus one place at the end', () => {
    for (const p of PUZZLES) {
      const names = p.cars.map(carName);
      expect(trainName(p.cars, null)).toBe(`Train: ${[...names, 'empty car'].join(', ')}.`);
      expect(trainName(p.cars, p.answer)).toBe(`Train: ${[...names, carName(p.answer)].join(', ')}.`);
    }
  });

  it('names each choice by its car, so colour is never the only signal', () => {
    expect(choiceName(rc)).toBe('red circle');
    expect(choiceName(yt)).toBe('yellow triangle');
    for (const c of ALL_CARS) expect(choiceName(c)).toBe(carName(c));
    expect(new Set(ALL_CARS.map(choiceName)).size).toBe(20);
  });

  it('names the board’s fixtures’ choices apart within each tray', () => {
    for (const f of FIXTURES) expect(new Set(f.options.map(choiceName)).size, `round ${f.round}`).toBe(3);
  });
});

describe('copy rules (8, 7.2, 10.2)', () => {
  it(`holds the help style’s limit of ${HELP_LIMIT} characters`, () => {
    expect(HELP_MAX_CHARS).toBe(HELP_LIMIT);
  });

  it(`keeps every help row line within ${HELP_LIMIT} characters, with the longest car name filled in`, () => {
    expect(carName(LONGEST)).toBe('yellow triangle');
    const all = [...PUZZLES.flatMap(helpLines), ...ALL_CARS.map(helpSolved), helpSolved(LONGEST), OFFER_LINE, SWAPPED_LINE];
    expect(all.filter((l) => l.length > HELP_LIMIT)).toEqual([]);
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

  it('starts every line with a capital and writes colour and shape names inside a sentence in lower case', () => {
    const lowerOk = new Set([...ALL_CARS.map(choiceName), 'four cars']);
    const capitalInside = /(?<!^)\b(Red|Blue|Yellow|Green|Pink|Circle|Square|Triangle|Star)\b/;
    for (const line of everyLine()) {
      if (!lowerOk.has(line)) expect(line[0], line).toBe(line[0].toUpperCase());
      expect(line, line).not.toMatch(capitalInside);
    }
  });

  it('ends every sentence-length line with a full stop or a question mark', () => {
    const sentences = [PROMPT, PROMPT_SOLVED, TRAY_LABEL, HELP_START, HELP_WRONG, ...ALL_CARS.map(helpSolved), ...PUZZLES.slice(0, 60).flatMap((p) => [speech(p.cars), trainName(p.cars, null)])];
    for (const line of sentences) expect(line, line).toMatch(/[.?]$/);
    for (const p of PUZZLES.slice(0, 60)) expect(speech(p.cars)).toMatch(/\. What comes next\?$/);
  });

  it('keeps none of the board lines that go (8.9, open question 4)', () => {
    const gone = [
      /Round \d+ of 4/,
      /\bAB patterns\b/,
      /\bABC patterns\b/,
      /Same shape, new color/,
      /All aboard/,
      /The pattern is complete/,
      /Tip: say it out loud/,
      /\bHmm\b/,
      /Choo choo/,
      /Next train coming/,
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
      expect(src, file).not.toMatch(/All aboard|Choo choo|Next train coming|Round \{|Tip: say it|Hmm, say/);
    }
  });
});
