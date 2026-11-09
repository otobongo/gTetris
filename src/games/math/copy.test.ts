/** Brick Calculator copy (brief 8.6, 8.9, 9.2, 7.2, 10.2 "Copy"): every line word for word, the help lines within the
    help style's 54 characters with the longest numbers filled in, and no dashes, exclamations or straight apostrophes. */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS } from '../../shared/progress';
import { OFFER_LINE, SWAPPED_LINE } from '../kit/copy';
import * as copy from './copy';
import {
  CAPTION,
  FULL_LINE,
  SLIP_LINE,
  SPEAKER_NAME,
  START_LINE,
  equationName,
  equationSolvedName,
  framesName,
  keyLabel,
  keyName,
  opWords,
  questionText,
  solvedCaption,
  solvedLine,
  spokenEntry,
  spokenSolved,
  spokenText,
  sumWords,
} from './copy';
import { DIGITS, entryValue, type KeyId } from './entry';
import { LEVELS, makePuzzles, type MathPuzzle, type Pair } from './puzzles';

/** 7.2: help-style lines (Mixer, Pattern, Calculator, Builder) hold 54 characters at most. */
const HELP_LIMIT = 54;

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 104729 + 3);
const KEYS: readonly KeyId[] = [...DIGITS, 'clear', 'equals'];

/** Every puzzle the game can deal over the seeds above, every level and band. */
const ALL: readonly MathPuzzle[] = AGE_BANDS.flatMap((band) => SEEDS.flatMap((seed) => LEVELS.flatMap((_, level) => makePuzzles(level, seed, band))));

/** The longest numbers a sum can hold: two-digit numbers and a two-digit answer, both ways. */
const LONGEST: readonly (Pair & { answer: number })[] = [
  { op: 'minus', a: 20, b: 10, answer: 10 },
  { op: 'minus', a: 20, b: 19, answer: 1 },
  { op: 'plus', a: 10, b: 10, answer: 20 },
  { op: 'plus', a: 1, b: 19, answer: 20 },
];

/** Every help line the game shows: start, slip, a third digit, the solved line, and the kit lines it shares. */
function helpLines(): string[] {
  const out = new Set<string>([START_LINE, SLIP_LINE, FULL_LINE, OFFER_LINE, SWAPPED_LINE]);
  for (const p of [...ALL, ...LONGEST]) out.add(solvedLine(p));
  return [...out];
}

/** Every line the game's copy module can render, help lines and the rest. */
function everyLine(): string[] {
  const lines = new Set<string>(helpLines());
  for (const value of Object.values(copy)) if (typeof value === 'string') lines.add(value);
  for (const p of [...ALL.filter((_, i) => i % 13 === 0), ...LONGEST]) {
    lines.add(questionText(p));
    lines.add(spokenText(p, false));
    lines.add(spokenText(p, true));
    lines.add(equationName(p));
    lines.add(equationSolvedName(p));
    lines.add(framesName(p));
    lines.add(solvedCaption(p.answer));
  }
  for (let n = 0; n <= 20; n++) lines.add(spokenEntry(n));
  for (const k of KEYS) {
    lines.add(keyName(k));
    lines.add(keyLabel(k));
  }
  return [...lines];
}

describe('lines word for word from 8.6', () => {
  it('gives the start, slip and third-digit help lines', () => {
    expect(START_LINE).toBe('Count the bricks. Type the answer, then press =.');
    expect(SLIP_LINE).toBe('Not quite. Count the bricks again.');
    expect(FULL_LINE).toBe('Press = to check, or C to clear.');
  });

  it('gives the solved line for a plus and a take away sum', () => {
    expect(solvedLine({ op: 'plus', a: 3, b: 4, answer: 7 })).toBe('3 plus 4 makes 7.');
    expect(solvedLine({ op: 'minus', a: 7, b: 3, answer: 4 })).toBe('7 take away 3 makes 4.');
  });

  it('reads an answer of 0 the same way', () => {
    expect(solvedLine({ op: 'minus', a: 5, b: 5, answer: 0 })).toBe('5 take away 5 makes 0.');
  });

  it('gives the panel caption, and once solved "Count them: 7" with no full stop', () => {
    expect(CAPTION).toBe('Each row holds 5. Two rows make 10.');
    expect(solvedCaption(7)).toBe('Count them: 7');
    expect(solvedCaption(0)).toBe('Count them: 0');
    expect(solvedCaption(20)).toBe('Count them: 20');
  });

  it('names the speaker "Hear the sum"', () => {
    expect(SPEAKER_NAME).toBe('Hear the sum');
  });

  it('says the operation as plus or take away', () => {
    expect(opWords('plus')).toBe('plus');
    expect(opWords('minus')).toBe('take away');
    expect(sumWords({ op: 'plus', a: 3, b: 4 })).toBe('3 plus 4');
    expect(sumWords({ op: 'minus', a: 7, b: 3 })).toBe('7 take away 3');
  });

  it('names keys by their numeral, Clear and Equals, and labels them with the numeral, C and =', () => {
    for (const d of DIGITS) {
      expect(keyName(d)).toBe(String(d));
      expect(keyLabel(d)).toBe(String(d));
    }
    expect(keyName('clear')).toBe('Clear');
    expect(keyName('equals')).toBe('Equals');
    expect(keyLabel('clear')).toBe('C');
    expect(keyLabel('equals')).toBe('=');
  });
});

describe('speech (4.5 "Speech", 8.6)', () => {
  it('reads the sum and asks how many before the answer', () => {
    expect(questionText({ op: 'plus', a: 3, b: 4 })).toBe('3 plus 4. How many?');
    expect(questionText({ op: 'minus', a: 7, b: 3 })).toBe('7 take away 3. How many?');
    expect(spokenText({ op: 'plus', a: 3, b: 4, answer: 7 }, false)).toBe('3 plus 4. How many?');
  });

  it('reads the solved line once solved, and a right = says the same sentence', () => {
    const p = { op: 'plus' as const, a: 3, b: 4, answer: 7 };
    expect(spokenText(p, true)).toBe('3 plus 4 makes 7.');
    expect(spokenSolved(p)).toBe('3 plus 4 makes 7.');
    expect(spokenText({ op: 'minus', a: 7, b: 3, answer: 4 }, true)).toBe('7 take away 3 makes 4.');
  });

  it('never says the answer before the solve', () => {
    for (const p of ALL.slice(0, 2000)) {
      expect(spokenText(p, false)).toBe(`${p.a} ${opWords(p.op)} ${p.b}. How many?`);
      expect(spokenText(p, false)).not.toContain('makes');
    }
  });

  it('says the number now typed after a digit tap: "15", and "07" as 7', () => {
    expect(spokenEntry(15)).toBe('15');
    expect(spokenEntry(1)).toBe('1');
    expect(spokenEntry(0)).toBe('0');
    expect(spokenEntry(entryValue('07')!)).toBe('7');
  });
});

describe('accessible names (9.2)', () => {
  it('names the equation "3 plus 4 equals what?", then "3 plus 4 equals 7"', () => {
    expect(equationName({ op: 'plus', a: 3, b: 4 })).toBe('3 plus 4 equals what?');
    expect(equationSolvedName({ op: 'plus', a: 3, b: 4, answer: 7 })).toBe('3 plus 4 equals 7');
  });

  it('names a take away equation in the same words as its solved line', () => {
    expect(equationName({ op: 'minus', a: 7, b: 3 })).toBe('7 take away 3 equals what?');
    expect(equationSolvedName({ op: 'minus', a: 7, b: 3, answer: 4 })).toBe('7 take away 3 equals 4');
  });

  it('names the ten-frames "3 blue bricks and 4 orange bricks" or "7 blue bricks, 3 taken away"', () => {
    expect(framesName({ op: 'plus', a: 3, b: 4 })).toBe('3 blue bricks and 4 orange bricks');
    expect(framesName({ op: 'minus', a: 7, b: 3 })).toBe('7 blue bricks, 3 taken away');
  });

  it('says one brick in the singular', () => {
    expect(framesName({ op: 'plus', a: 1, b: 1 })).toBe('1 blue brick and 1 orange brick');
    expect(framesName({ op: 'plus', a: 1, b: 4 })).toBe('1 blue brick and 4 orange bricks');
    expect(framesName({ op: 'minus', a: 2, b: 1 })).toBe('2 blue bricks, 1 taken away');
  });

  it('names every dealt sum’s frames with its own numbers', () => {
    for (const p of ALL.slice(0, 2000))
      expect(framesName(p)).toMatch(p.op === 'plus' ? new RegExp(`^${p.a} blue bricks? and ${p.b} orange bricks?$`) : new RegExp(`^${p.a} blue bricks?, ${p.b} taken away$`));
  });
});

describe('copy rules (7.2, 8, 10.2)', () => {
  it('keeps every help line within the help style’s 54 characters, the longest numbers filled in', () => {
    const over = helpLines().filter((line) => line.length > HELP_LIMIT);
    expect(over).toEqual([]);
    expect(Math.max(...[...ALL, ...LONGEST].map((p) => solvedLine(p).length))).toBe('20 take away 10 makes 10.'.length);
  });

  it('holds no em dash, no en dash and no exclamation mark in any line', () => {
    for (const line of everyLine()) {
      expect(line, line).not.toMatch(/[–—]/);
      expect(line, line).not.toContain('!');
    }
  });

  it('writes no minus sign or hyphen in a line: a take away is said in words', () => {
    for (const line of everyLine()) expect(line, line).not.toMatch(/[-−]/);
  });

  it('uses no straight apostrophe, since rendered copy takes the curly one', () => {
    for (const line of everyLine()) expect(line, line).not.toContain("'");
  });

  it('uses none of the AI-signature words', () => {
    const words = /\b(leverage|spearhead|orchestrate|foster|empower|transformative|cutting-edge|seamless(ly)?|deep dive)\b/i;
    for (const line of everyLine()) expect(line, line).not.toMatch(words);
  });

  it('has no doubled spaces, no stray spaces at the ends and no empty lines', () => {
    for (const line of everyLine()) {
      expect(line.trim(), line).toBe(line);
      expect(line, line).not.toMatch(/\s{2}/);
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it('keeps out the board lines and key names that 8.9 removes', () => {
    const gone = ['Say it', 'Pick a number up to 10', 'Numbers up to 10 for now', 'Try taking away a smaller number', 'Count the bricks, then press =', 'Add and take away', 'surprise'];
    const lines = everyLine();
    for (const line of lines) for (const old of gone) expect(line, `"${line}" holds "${old}"`).not.toContain(old);
    for (const k of KEYS) expect(['plus', 'take away', 'ten', 'surprise problem', 'Plus', 'Take away', 'Ten', 'Surprise problem']).not.toContain(keyName(k));
    expect(lines).not.toContain('Brick Calculator');
  });
});
