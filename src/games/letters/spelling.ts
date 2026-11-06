/* Spelling rules for Letter Builder: which words a player gets, and how the tray is made.
   Pure functions, so both rules can be tested without a browser. */
import type { AgeBand } from '../../shared/progress';
import { shuffle } from '../../shared/rng';
import { CVC, EIGHT, FIVE, FOUR, SEVEN, SIX, THREE, type Word } from './data';

/** How long a word may be at each age. Ages 3 to 4 get three letters, 5 to 6 four or five, 7 and up six to eight. */
export const WORD_LENGTHS: Record<AgeBand, { min: number; max: number }> = {
  '3-4': { min: 3, max: 3 },
  '5-6': { min: 4, max: 5 },
  '7-8': { min: 6, max: 8 },
  '9-10': { min: 6, max: 8 },
};

/** Spelling levels get harder in steps: 0 = the easiest words of the age band, 3 = every word of the band. */
export type SpellTier = 0 | 1 | 2 | 3;

const POOLS: Record<AgeBand, readonly [Word[], Word[], Word[]]> = {
  '3-4': [CVC, THREE, [...CVC, ...THREE]],
  '5-6': [FOUR, FIVE, [...FOUR, ...FIVE]],
  '7-8': [SIX, SEVEN, EIGHT],
  '9-10': [SIX, SEVEN, EIGHT],
};

/** The words a player of this age band can be asked to spell at this tier. Every word is within WORD_LENGTHS. */
export function spellWords(band: AgeBand, tier: SpellTier): Word[] {
  const [easy, middle, hard] = POOLS[band];
  // The whole band. Pools can overlap (the 3-4 and 5-6 hard tier is the other two joined), so each word is listed once.
  if (tier === 3) return [...new Map([...easy, ...middle, ...hard].map((w) => [w.word, w])).values()];
  return [easy, middle, hard][tier];
}

/** A spelling tray: exactly one tile per letter of the word (a repeated letter is two tiles), and never in spelling order. */
export function scramble(letters: string[], rand: () => number): string[] {
  if (new Set(letters).size < 2) return letters.slice();
  const target = letters.join('');
  for (let tries = 0; tries < 20; tries++) {
    const mixed = shuffle(letters, rand);
    if (mixed.join('') !== target) return mixed;
  }
  // 20 shuffles landing on the spelling order is practically impossible; this makes it certain.
  return [...letters.slice(1), letters[0]];
}
