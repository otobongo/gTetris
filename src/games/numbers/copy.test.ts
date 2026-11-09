/** Number Line-up copy (brief 8.4, 8.9, 9.2, 7.2, 10.2 "Copy"): every line word for word, the help lines within the
    prompt style's 44 characters with the longest numbers filled in, and no dashes, exclamations or straight apostrophes. */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS } from '../../shared/progress';
import * as copy from './copy';
import {
  LEGEND,
  PICKED_LINE,
  SPEAKER_NAME,
  SPOTS,
  START_LINE,
  goalLine,
  hintLine,
  hintName,
  solvedLine,
  spokenText,
  towerName,
} from './copy';
import { hintPath, hintStep, rightSpots } from './order';
import { HINTS_PER_LEVEL, makePuzzles, type NumbersPuzzle } from './puzzles';

/** 7.2: prompt-style help lines (Sorter, Numbers) hold 44 characters at most, so they stay within 2 lines at 390 px. */
const HELP_LIMIT = 44;

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 104729 + 3);

/** Every puzzle the game can deal over the seeds above, every level and band. */
const ALL: readonly NumbersPuzzle[] = AGE_BANDS.flatMap((band) => SEEDS.flatMap((seed) => Array.from({ length: 12 }, (_, level) => makePuzzles(level, seed, band)).flat()));

/** Every help line those puzzles show: start, picked, each hint step followed to the end, and the solved line. */
function helpLines(): string[] {
  const out = new Set<string>([START_LINE, PICKED_LINE]);
  for (const p of ALL) {
    for (const s of hintPath(p.start, p.dir)) out.add(hintLine(s.value, s.to));
    out.add(solvedLine(p));
  }
  // the longest numbers in every spot: a three-digit tower at ages 9 to 10
  for (let to = 0; to < SPOTS.length; to++) for (const v of [100, 999]) out.add(hintLine(v, to));
  out.add(solvedLine({ kind: 'big', dir: 'down', goal: [999, 998, 997, 996, 995, 994] }));
  return [...out];
}

/** Every line the game's copy module can render, help lines and the rest. */
function everyLine(): string[] {
  const lines = new Set<string>(helpLines());
  for (const value of Object.values(copy)) if (typeof value === 'string') lines.add(value);
  for (const kind of ['stairs', 'big'] as const) for (const dir of ['up', 'down'] as const) lines.add(goalLine({ kind, dir }));
  for (let left = 0; left <= HINTS_PER_LEVEL; left++) lines.add(hintName(left));
  for (const p of ALL.filter((_, i) => i % 97 === 0)) {
    const right = rightSpots(p.start, p.dir);
    p.start.forEach((v, spot) => lines.add(towerName(v, spot, right[spot])));
    lines.add(spokenText(p, START_LINE, false));
    lines.add(spokenText(p, PICKED_LINE, false));
    lines.add(spokenText(p, solvedLine(p), true));
  }
  return [...lines];
}

describe('lines word for word from 8.4', () => {
  it('gives the goal text for the stairs and the bigger numbers, both ways', () => {
    expect(goalLine({ kind: 'stairs', dir: 'up' })).toBe('Line up 1 to 6, smallest first, so the towers make stairs going up.');
    expect(goalLine({ kind: 'stairs', dir: 'down' })).toBe('Line up 6 to 1, biggest first, so the stairs go down.');
    expect(goalLine({ kind: 'big', dir: 'up' })).toBe('Line up the numbers, smallest first.');
    expect(goalLine({ kind: 'big', dir: 'down' })).toBe('Line up the numbers, biggest first.');
  });

  it('gives the start and picked help lines', () => {
    expect(START_LINE).toBe('Drag or tap two towers to swap them.');
    expect(PICKED_LINE).toBe('Now tap where it should go.');
  });

  it('names the hint’s tower and spot, first to sixth', () => {
    expect(hintLine(4, 1)).toBe('4 belongs in the second spot. Swap them.');
    expect(SPOTS).toEqual(['first', 'second', 'third', 'fourth', 'fifth', 'sixth']);
    expect(SPOTS.map((_, to) => hintLine(25, to))).toEqual([
      '25 belongs in the first spot. Swap them.',
      '25 belongs in the second spot. Swap them.',
      '25 belongs in the third spot. Swap them.',
      '25 belongs in the fourth spot. Swap them.',
      '25 belongs in the fifth spot. Swap them.',
      '25 belongs in the sixth spot. Swap them.',
    ]);
  });

  it('gives the solved line for the stairs and, with its numbers, for the bigger numbers', () => {
    expect(solvedLine({ kind: 'stairs', dir: 'up', goal: [1, 2, 3, 4, 5, 6] })).toBe('Stairs going up: 1, 2, 3, 4, 5, 6.');
    expect(solvedLine({ kind: 'stairs', dir: 'down', goal: [6, 5, 4, 3, 2, 1] })).toBe('Stairs going down: 6, 5, 4, 3, 2, 1.');
    expect(solvedLine({ kind: 'big', dir: 'up', goal: [15, 20, 25, 30, 35, 40] })).toBe('In order: 15, 20, 25, 30, 35, 40.');
  });

  it('reads a biggest-first row of bigger numbers in the order it stands once solved', () => {
    expect(solvedLine({ kind: 'big', dir: 'down', goal: [900, 120, 75, 40, 9, 2] })).toBe('In order: 900, 120, 75, 40, 9, 2.');
  });

  it('gives the legend, the Hint button name and the speaker name', () => {
    expect(LEGEND).toBe('A filled green line means that tower is in the right spot.');
    expect(hintName(2)).toBe('Hint, 2 left');
    expect([3, 1, 0].map(hintName)).toEqual(['Hint, 3 left', 'Hint, 1 left', 'Hint, 0 left']);
    expect(SPEAKER_NAME).toBe('Hear the help line');
  });
});

describe('the lines a real puzzle shows', () => {
  it('fills the solved line with the puzzle’s own numbers in its order', () => {
    for (const p of ALL.filter((q) => q.kind === 'big').slice(0, 200)) expect(solvedLine(p)).toBe(`In order: ${p.goal.join(', ')}.`);
    for (const p of ALL.filter((q) => q.kind === 'stairs').slice(0, 50))
      expect(solvedLine(p)).toBe(p.dir === 'up' ? 'Stairs going up: 1, 2, 3, 4, 5, 6.' : 'Stairs going down: 6, 5, 4, 3, 2, 1.');
  });

  it('puts the hinted tower’s number and the first wrong spot in the hint line', () => {
    for (const p of ALL.slice(0, 500)) {
      const step = hintStep(p.start, p.dir)!;
      expect(hintLine(step.value, step.to)).toBe(`${p.goal[step.to]} belongs in the ${SPOTS[step.to]} spot. Swap them.`);
    }
  });
});

describe('speech and names (4.3 "Speech", 9.2)', () => {
  it('reads the goal and the help line during play', () => {
    const p = makePuzzles(0, 1, '5-6')[0];
    expect(spokenText(p, START_LINE, false)).toBe('Line up 1 to 6, smallest first, so the towers make stairs going up. Drag or tap two towers to swap them.');
    const big = makePuzzles(9, 1, '7-8')[0];
    const hint = hintStep(big.start, big.dir)!;
    expect(spokenText(big, hintLine(hint.value, hint.to), false)).toBe(`Line up the numbers, biggest first. ${hintLine(hint.value, hint.to)}`);
  });

  it('reads the solved line with its numbers once solved', () => {
    const big = makePuzzles(10, 8, '9-10')[3];
    expect(spokenText(big, solvedLine(big), true)).toBe(`In order: ${big.goal.join(', ')}.`);
    expect(spokenText(makePuzzles(7, 8, '3-4')[0], START_LINE, true)).toBe('Stairs going down: 6, 5, 4, 3, 2, 1.');
  });

  it('names a tower by its number, its spot of 6 and whether it is in the right spot', () => {
    expect(towerName(4, 1, true)).toBe('Tower of 4, spot 2 of 6, in the right spot');
    expect(towerName(4, 1, false)).toBe('Tower of 4, spot 2 of 6, not in the right spot');
    expect(towerName(999, 0, false)).toBe('Tower of 999, spot 1 of 6, not in the right spot');
    expect(towerName(40, 5, true)).toBe('Tower of 40, spot 6 of 6, in the right spot');
  });
});

describe('copy rules (7.2, 8, 10.2)', () => {
  it('keeps every help line within the prompt style’s 44 characters, the longest numbers filled in', () => {
    const lines = helpLines();
    const over = lines.filter((line) => line.length > HELP_LIMIT);
    expect(over).toEqual([]);
    // the longest help line is the hint with a three-digit tower
    expect(Math.max(...lines.map((l) => l.length))).toBe('999 belongs in the second spot. Swap them.'.length);
  });

  it('holds no em dash, no en dash and no exclamation mark in any line', () => {
    for (const line of everyLine()) {
      expect(line, line).not.toMatch(/[–—]/);
      expect(line, line).not.toContain('!');
    }
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

  it('keeps out the board lines that 8.9 removes', () => {
    const gone = [
      'Level 3 of 15',
      'Mix them up',
      'Smallest first',
      'Biggest first',
      'Show me how',
      'Watch: I look for',
      'onto the',
      'Perfect',
      'Like stairs',
      'Each tower is one brick taller',
      'Later levels',
      'missing numbers',
    ];
    const lines = everyLine();
    for (const line of lines) for (const old of gone) expect(line, `"${line}" holds "${old}"`).not.toContain(old);
    expect(lines).not.toContain('A green line means that tower is in the right spot.');
  });
});
