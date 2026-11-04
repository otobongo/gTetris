import { describe, expect, it } from 'vitest';
import { AGE_BANDS } from '../../shared/progress';
import { rng } from '../../shared/rng';
import { CVC, EIGHT, FIVE, FOUR, SEVEN, SIX, THREE } from './data';
import { LEVELS, makeRound, type FillPrompt } from './levels';
import { innerWidth, slotSize, traySize, FRAME_PAD } from './sizing';
import { WORD_LENGTHS, scramble, spellWords, type SpellTier } from './spelling';

const TIERS: SpellTier[] = [0, 1, 2, 3];
const SPELL = LEVELS.map((def, i) => ({ def, i })).filter((x) => x.def.kind === 'spell');
const sorted = (s: string[]) => [...s].sort().join('');
/** A random source that makes every shuffle keep the original order. */
const keepsOrder = () => 0.999999;

describe('Letter Builder tray: edges of the scramble rule', () => {
  it('returns an empty tray for an empty word', () => {
    expect(scramble([], rng(1))).toEqual([]);
  });

  it('breaks the spelling order of a long word with repeated letters even when every shuffle keeps it', () => {
    const letters = 'BALLOON'.split('');
    const tray = scramble(letters, keepsOrder);
    expect(tray.join('')).not.toBe('BALLOON');
    expect(sorted(tray)).toBe(sorted(letters));
  });

  it('breaks the order for a word that is one letter repeated but for one', () => {
    const tray = scramble(['A', 'A', 'B'], keepsOrder);
    expect(tray.join('')).not.toBe('AAB');
    expect(sorted(tray)).toBe('AAB');
  });

  it('does not change the word it was given', () => {
    const letters = ['R', 'O', 'C', 'K', 'E', 'T'];
    scramble(letters, rng(7));
    expect(letters.join('')).toBe('ROCKET');
  });
});

describe('Letter Builder words by age: edges', () => {
  it('lists each word once in the whole-band pool, and only words from the easier tiers', () => {
    for (const band of AGE_BANDS) {
      const all = spellWords(band, 3).map((w) => w.word);
      expect(new Set(all).size, band).toBe(all.length);
      const tiers = new Set([0, 1, 2].flatMap((t) => spellWords(band, t as SpellTier).map((w) => w.word)));
      expect(new Set(all), band).toEqual(tiers);
    }
  });

  it('steps 7 and up through six, seven and eight letters, one length per tier', () => {
    for (const band of ['7-8', '9-10'] as const) {
      expect(spellWords(band, 0).map((w) => w.word.length).every((n) => n === 6)).toBe(true);
      expect(spellWords(band, 1).map((w) => w.word.length).every((n) => n === 7)).toBe(true);
      expect(spellWords(band, 2).map((w) => w.word.length).every((n) => n === 8)).toBe(true);
    }
    expect(spellWords('7-8', 0)).toBe(SIX);
    expect(spellWords('7-8', 1)).toBe(SEVEN);
    expect(spellWords('7-8', 2)).toBe(EIGHT);
  });

  it('starts 3 to 4 on the simplest three-letter words and 5 to 6 on four letters', () => {
    expect(spellWords('3-4', 0)).toBe(CVC);
    expect(spellWords('3-4', 1)).toBe(THREE);
    expect(spellWords('5-6', 0)).toBe(FOUR);
    expect(spellWords('5-6', 1)).toBe(FIVE);
  });

  it('gives ages 9 to 10 the same word lengths as 7 to 8', () => {
    expect(WORD_LENGTHS['9-10']).toEqual(WORD_LENGTHS['7-8']);
    for (const t of TIERS) expect(spellWords('9-10', t).map((w) => w.word)).toEqual(spellWords('7-8', t).map((w) => w.word));
  });

  it('uses only plain lowercase letters in spelling words, so every tile is a letter brick', () => {
    for (const band of AGE_BANDS) for (const w of spellWords(band, 3)) expect(w.word, band).toMatch(/^[a-z]+$/);
  });

  it('never runs a band out of words: every spelling level gets its full number of different words', () => {
    for (const band of AGE_BANDS) {
      for (const { def, i } of SPELL) {
        if (def.kind !== 'spell') continue;
        expect(spellWords(band, def.tier).length, `${band} level ${i + 1}`).toBeGreaterThanOrEqual(def.prompts);
        const round = makeRound(i, 1234, band);
        expect(round.prompts, `${band} level ${i + 1}`).toHaveLength(def.prompts);
      }
    }
  });
});

describe('Letter Builder tray: every age’s words fit every screen', () => {
  const widths = [{ mode: 'phone' as const, w: 280 }, { mode: 'phone' as const, w: 320 }, { mode: 'phone' as const, w: 430 }, { mode: 'tablet' as const, w: 834 }];

  it('fits the longest word of each band on the narrowest phone and the tablet, with tiles you can press', () => {
    for (const band of AGE_BANDS) {
      const longest = Math.max(...spellWords(band, 3).map((w) => w.word.length));
      expect(longest, band).toBe(WORD_LENGTHS[band].max);
      for (const { mode, w } of widths) {
        const inner = innerWidth(mode, w);
        const tray = traySize(longest, inner);
        const slot = slotSize(longest, inner);
        expect(tray.w, `${band} at ${w}`).toBeGreaterThanOrEqual(44);
        expect(tray.rows, `${band} at ${w}`).toBeLessThanOrEqual(2);
        expect(slot.w * longest + slot.gap * (longest - 1), `${band} slots at ${w}`).toBeLessThanOrEqual(inner - FRAME_PAD * 2);
      }
    }
  });

  it('keeps a 3 to 4 year old’s tray on one row of big tiles everywhere', () => {
    for (const { mode, w } of widths) {
      const tray = traySize(3, innerWidth(mode, w));
      expect(tray.rows, `at ${w}`).toBe(1);
      expect(tray.w, `at ${w}`).toBeGreaterThanOrEqual(56);
    }
  });

  it('lays out one tile for every letter of every round word', () => {
    for (const band of AGE_BANDS) {
      for (const { i } of SPELL) {
        for (const p of makeRound(i, 99, band).prompts as FillPrompt[]) {
          const tray = traySize(p.tray.length, 320);
          expect(tray.perRow * tray.rows, `${band} ${p.word!.word}`).toBeGreaterThanOrEqual(p.cells.length);
        }
      }
    }
  });
});
