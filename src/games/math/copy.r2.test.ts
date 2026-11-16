/** Brick Calculator speaker, usability round 2 (decision 7): the speaker reads the sum, then the help line on screen
    in spoken form, where the = key is "the green key". `spokenText` stays as copy.test.ts pins it; `spokenHelp` is
    what the speaker button reads. Every new sentence follows copy.test.ts's line rules. */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS } from '../../shared/progress';
import { questionText, solvedLine, spokenHelp, spokenText } from './copy';
import type { HelpKind } from './entry';
import { LEVELS, makePuzzles, type MathPuzzle, type Pair } from './puzzles';

const SEEDS = [0, 7, 2024, 104729];
const ALL: readonly MathPuzzle[] = AGE_BANDS.flatMap((band) => SEEDS.flatMap((seed) => LEVELS.flatMap((_, level) => makePuzzles(level, seed, band))));
const LONGEST: readonly (Pair & { answer: number })[] = [
  { op: 'minus', a: 20, b: 10, answer: 10 },
  { op: 'plus', a: 10, b: 10, answer: 20 },
];
const KINDS: readonly HelpKind[] = ['start', 'slip', 'full'];

const plus = { op: 'plus' as const, a: 1, b: 1, answer: 2 };
const minus = { op: 'minus' as const, a: 9, b: 7, answer: 2 };

describe('spokenHelp: what the speaker reads (decision 7)', () => {
  it('after a wrong answer reads the slip line, then the sum and the question', () => {
    expect(spokenHelp(plus, false, 'slip')).toBe('Not quite. Count the bricks again. 1 plus 1. How many?');
    expect(spokenHelp(minus, false, 'slip')).toBe('Not quite. Count the bricks again. 9 take away 7. How many?');
  });

  it('after an ignored third digit reads the sum, the question and the third-digit line with the green key', () => {
    expect(spokenHelp(plus, false, 'full')).toBe('1 plus 1. How many? Press the green key to check, or C to clear.');
    expect(spokenHelp(minus, false, 'full')).toBe('9 take away 7. How many? Press the green key to check, or C to clear.');
  });

  it('on the start state still reads the sum and the question only, until the owner approves the start sentence', () => {
    for (const p of [plus, minus, ...ALL.slice(0, 300)]) expect(spokenHelp(p, false, 'start')).toBe(questionText(p));
  });

  it('once solved reads the solved line whatever help was showing, as spokenText does', () => {
    for (const p of [plus, minus, ...ALL.slice(0, 300)])
      for (const help of KINDS) {
        expect(spokenHelp(p, true, help)).toBe(solvedLine(p));
        expect(spokenHelp(p, true, help)).toBe(spokenText(p, true));
      }
  });

  it('never says the answer before the solve', () => {
    for (const p of ALL)
      for (const help of KINDS) {
        const line = spokenHelp(p, false, help);
        expect(line, line).not.toContain('makes');
        expect(line.startsWith(`${p.a} `) || line.startsWith('Not quite.'), line).toBe(true);
        expect(line, line).toContain(questionText(p));
      }
  });

  it('keeps every new sentence to the copy rules: no dashes, no minus sign, no exclamation, no straight apostrophe, no doubled space', () => {
    for (const p of [...ALL, ...LONGEST])
      for (const help of KINDS)
        for (const solved of [false, true]) {
          const line = spokenHelp(p, solved, help);
          expect(line, line).not.toMatch(/[–—\-−]/);
          expect(line, line).not.toContain('!');
          expect(line, line).not.toContain("'");
          expect(line, line).not.toContain('=');
          expect(line.trim(), line).toBe(line);
          expect(line, line).not.toMatch(/\s{2}/);
          expect(line, line).not.toMatch(/\b(leverage|spearhead|orchestrate|foster|empower|transformative|cutting-edge|seamless(ly)?|deep dive)\b/i);
        }
  });
});
