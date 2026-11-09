/**
 * The kit's shared lines (six-games brief 8.1): every line word for word, the slip fact's three
 * forms and its edges, the help-row limit for the lines the help row shows, and the copy rules
 * (no em or en dash, the one exclamation, no straight apostrophe).
 */
import { describe, expect, it } from 'vitest';
import * as letters from '../letters/copy';
import * as escape from '../slide/puzzles';
import * as copy from './copy';
import {
  BACK_TO_GAMES,
  BACK_TO_HOME,
  GAME_DONE_NOTE,
  GAME_DONE_TITLE,
  HINT_CAP,
  LEVEL_RULE,
  NEXT_PUZZLE,
  OFFER_LINE,
  OFFER_NAME,
  READ_HELP_ALOUD,
  SWAPPED_LINE,
  gameDoneFact,
  levelDoneTitle,
  levelName,
  playLabel,
  slipFact,
} from './copy';

/** The help line limits (brief 7.2): prompt style (Sorter, Numbers) and help style (the other four). */
const PROMPT_LIMIT = 44;
const HELP_LIMIT = 54;

/** Every line the module can produce, with the brief's sample values and the longest numbers filled in. */
function everyLine(): string[] {
  const lines: string[] = [];
  for (const value of Object.values(copy)) {
    if (typeof value === 'string') lines.push(value);
  }
  for (const n of [1, 3, 9, 12]) lines.push(levelName(n), levelDoneTitle(n), playLabel(n));
  for (const n of [0, 1, 3, 12]) lines.push(slipFact(n));
  lines.push(gameDoneFact(9, 24), gameDoneFact(12, 36), gameDoneFact(12, 0));
  return lines;
}

describe('the shared lines, word for word (8.1)', () => {
  it('names the level in the title, the level card and the Play button', () => {
    expect(levelName(3)).toBe('Level 3');
    expect(levelName(1)).toBe('Level 1');
    expect(levelName(12)).toBe('Level 12');
    expect(levelDoneTitle(3)).toBe('You finished Level 3');
    expect(playLabel(4)).toBe('Play Level 4');
  });

  it('has the top bar back button, Next puzzle and Back to games', () => {
    expect(BACK_TO_HOME).toBe('Back to home');
    expect(NEXT_PUZZLE).toBe('Next puzzle');
    expect(BACK_TO_GAMES).toBe('Back to games');
  });

  it('has the offer line, its button name, the line after a swap and the speaker name', () => {
    expect(OFFER_LINE).toBe('This one is tricky. Want a different puzzle?');
    expect(OFFER_NAME).toBe('New puzzle');
    expect(SWAPPED_LINE).toBe('Here is a different puzzle.');
    expect(READ_HELP_ALOUD).toBe('Read the help line aloud');
  });

  it('has the level card rule and the hint cap line', () => {
    expect(LEVEL_RULE).toBe('3 stars: 1 slip or none. 2 stars: 4 slips or fewer.');
    expect(HINT_CAP).toBe('Using a hint caps the level at 2 stars.');
  });

  it('has the game finished lines', () => {
    expect(GAME_DONE_TITLE).toBe('You finished every level!');
    expect(gameDoneFact(9, 24)).toBe('9 levels, 24 of 27 stars.');
    expect(gameDoneFact(12, 36)).toBe('12 levels, 36 of 36 stars.');
    expect(GAME_DONE_NOTE).toBe('A grown-up can pick a level to play again.');
  });

  it('reads the same as the lines Brick Escape and Letter Builder already show', () => {
    expect(OFFER_LINE).toBe(escape.OFFER_LINE);
    expect(SWAPPED_LINE).toBe(escape.SWAPPED_LINE);
    expect(GAME_DONE_NOTE).toBe(escape.FINISHED_NOTE);
    expect(OFFER_LINE).toBe(letters.offerLine(false));
    expect(OFFER_NAME).toBe(letters.offerName(false));
    expect(SWAPPED_LINE).toBe(letters.swapLine(false));
    expect(NEXT_PUZZLE).toBe(letters.nextLabel(false));
    expect(GAME_DONE_TITLE).toBe(letters.GAME_DONE_TITLE);
    expect(gameDoneFact(9, 24)).toBe(letters.gameDoneFact(9, 24));
  });
});

describe('the level card fact', () => {
  it('has its three forms: no slips, 1 slip, and a number of slips', () => {
    expect(slipFact(0)).toBe('4 puzzles, no slips.');
    expect(slipFact(1)).toBe('4 puzzles, 1 slip.');
    expect(slipFact(2)).toBe('4 puzzles, 2 slips.');
    expect(slipFact(3)).toBe('4 puzzles, 3 slips.');
    expect(slipFact(12)).toBe('4 puzzles, 12 slips.');
  });

  it('matches Letter Builder’s puzzle fact for every count it can show', () => {
    for (let n = 0; n <= 20; n++) expect(slipFact(n), `${n}`).toBe(letters.levelFact(false, n));
  });

  it('reads a value that is not a count as no slips, never "NaN slips" or a negative', () => {
    for (const bad of [-1, -0.4, Number.NaN, Number.NEGATIVE_INFINITY]) expect(slipFact(bad), `${bad}`).toBe('4 puzzles, no slips.');
  });

  it('rounds a fractional count to a whole number of slips', () => {
    expect(slipFact(1.4)).toBe('4 puzzles, 1 slip.');
    expect(slipFact(2.6)).toBe('4 puzzles, 3 slips.');
  });
});

describe('copy rules (brief 8, 10.2)', () => {
  it('holds no em dash or en dash in any line', () => {
    for (const line of everyLine()) expect(line, line).not.toMatch(/[–—]/);
  });

  it('has one exclamation, "You finished every level!", and nowhere else', () => {
    const withBang = everyLine().filter((l) => l.includes('!'));
    expect(new Set(withBang)).toEqual(new Set(['You finished every level!']));
  });

  it('never uses a straight apostrophe in a rendered line', () => {
    for (const line of everyLine()) expect(line, line).not.toContain("'");
  });

  it('keeps the help-row lines it owns within the prompt style’s 44 characters, so they fit both styles', () => {
    for (const line of [OFFER_LINE, SWAPPED_LINE]) {
      expect(line.length, line).toBeLessThanOrEqual(PROMPT_LIMIT);
      expect(line.length, line).toBeLessThanOrEqual(HELP_LIMIT);
    }
  });

  it('has no empty line', () => {
    for (const line of everyLine()) expect(line.trim(), JSON.stringify(line)).not.toBe('');
  });
});
