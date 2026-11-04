import { describe, expect, it } from 'vitest';
import { AGE_BANDS, type AgeBand } from '../../shared/progress';
import { rng } from '../../shared/rng';
import { ALL_WORDS, EIGHT, SEVEN } from './data';
import { LEVELS, makeRound, type FillPrompt } from './levels';
import { fillDone, hintFill, newFill, tapFill } from './logic';
import { WORD_LENGTHS, scramble, spellWords, type SpellTier } from './spelling';

const SEEDS = Array.from({ length: 30 }, (_, i) => i * 104729 + 3);
const SPELL_LEVELS = LEVELS.map((def, i) => ({ def, i })).filter((x) => x.def.kind === 'spell');
const TIERS: SpellTier[] = [0, 1, 2, 3];
const sorted = (s: string[]) => [...s].sort().join('');

describe('scramble: the tray rule', () => {
  it('keeps exactly the letters of the word, and never the spelling order', () => {
    for (const w of [...ALL_WORDS, ...SEVEN, ...EIGHT]) {
      const letters = w.word.toUpperCase().split('');
      for (const seed of SEEDS) {
        const tray = scramble(letters, rng(seed));
        expect(tray.length, w.word).toBe(letters.length);
        expect(sorted(tray), w.word).toBe(sorted(letters));
        expect(tray.join(''), `${w.word} seed ${seed}`).not.toBe(letters.join(''));
      }
    }
  });

  it('keeps repeated letters as separate tiles', () => {
    const tray = scramble(['B', 'A', 'L', 'L', 'O', 'O', 'N'], rng(1));
    expect(tray.filter((c) => c === 'L')).toHaveLength(2);
    expect(tray.filter((c) => c === 'O')).toHaveLength(2);
    expect(tray).toHaveLength(7);
  });

  it('breaks the order even when a shuffle lands on it', () => {
    // A random source that always returns 0 turns Fisher-Yates into a fixed rotation, which for a 2-letter word is the original order.
    const tray = scramble(['A', 'B'], () => 0.99);
    expect(tray.join('')).not.toBe('AB');
  });

  it('leaves a word of one repeated letter alone instead of looping', () => {
    expect(scramble(['A', 'A'], rng(1))).toEqual(['A', 'A']);
    expect(scramble(['Z'], rng(1))).toEqual(['Z']);
  });
});

describe('word length by age band', () => {
  it('says three letters for 3 to 4, four to five for 5 to 6, six to eight for 7 and up', () => {
    expect(WORD_LENGTHS['3-4']).toEqual({ min: 3, max: 3 });
    expect(WORD_LENGTHS['5-6']).toEqual({ min: 4, max: 5 });
    expect(WORD_LENGTHS['7-8']).toEqual({ min: 6, max: 8 });
    expect(WORD_LENGTHS['9-10']).toEqual({ min: 6, max: 8 });
  });

  it('every pool word fits its band, at every tier', () => {
    for (const band of AGE_BANDS) {
      const { min, max } = WORD_LENGTHS[band];
      for (const tier of TIERS) {
        const pool = spellWords(band, tier);
        expect(pool.length, `${band} tier ${tier}`).toBeGreaterThanOrEqual(4);
        for (const w of pool) expect(w.word.length, `${band}: ${w.word}`).toBeGreaterThanOrEqual(min);
        for (const w of pool) expect(w.word.length, `${band}: ${w.word}`).toBeLessThanOrEqual(max);
      }
    }
  });

  it('uses the board words for each age', () => {
    const has = (band: AgeBand, ...words: string[]) => {
      const all = new Set(spellWords(band, 3).map((w) => w.word));
      for (const w of words) expect(all.has(w), `${band}: ${w}`).toBe(true);
    };
    has('3-4', 'sun', 'bus', 'box');
    has('5-6', 'fish', 'frog', 'house');
    has('7-8', 'rocket', 'rainbow', 'umbrella');
    has('9-10', 'rocket', 'rainbow', 'umbrella');
  });

  it('every extra word has a picture, only letters, and no blocked word', () => {
    const blocked = ['poo', 'butt', 'fart', 'kill', 'dead', 'gun', 'die', 'sex', 'ass', 'hell', 'damn', 'beer', 'wine'];
    const extra = [...SEVEN, ...EIGHT];
    expect(new Set(extra.map((w) => w.word)).size).toBe(extra.length);
    expect(new Set(extra.map((w) => w.emoji)).size).toBe(extra.length);
    for (const w of SEVEN) expect(w.word).toMatch(/^[a-z]{7}$/);
    for (const w of EIGHT) expect(w.word).toMatch(/^[a-z]{8}$/);
    for (const w of extra) {
      expect(w.emoji.length, w.word).toBeGreaterThan(0);
      expect(blocked.includes(w.word), w.word).toBe(false);
    }
  });
});

describe('spelling rounds follow both rules', () => {
  for (const band of AGE_BANDS) {
    for (const { def, i } of SPELL_LEVELS) {
      it(`${band}, level ${i + 1} (${def.name}): one tile per letter, shuffled, right length`, () => {
        const { min, max } = WORD_LENGTHS[band];
        for (const seed of SEEDS) {
          const round = makeRound(i, seed, band);
          const words = round.prompts.map((p) => (p as FillPrompt).word!.word);
          expect(new Set(words).size, 'a round never repeats a word').toBe(words.length);
          for (const prompt of round.prompts as FillPrompt[]) {
            const word = prompt.word!.word.toUpperCase();
            expect(word.length).toBeGreaterThanOrEqual(min);
            expect(word.length).toBeLessThanOrEqual(max);
            // exactly one tile per letter: no extras, none missing
            expect(prompt.tray).toHaveLength(word.length);
            expect(sorted(prompt.tray.map((t) => t.ch))).toBe(sorted(word.split('')));
            expect(new Set(prompt.tray.map((t) => t.id)).size).toBe(word.length);
            // never in spelling order
            expect(prompt.tray.map((t) => t.ch).join('')).not.toBe(word);
            expect(prompt.given.some(Boolean)).toBe(false);
          }
        }
      });
    }
  }

  it('can always be finished by tapping tiles', () => {
    for (const band of AGE_BANDS) {
      for (const { i } of SPELL_LEVELS) {
        for (const prompt of makeRound(i, 11, band).prompts as FillPrompt[]) {
          let s = newFill(prompt);
          for (let guard = 0; guard < 20 && !fillDone(prompt, s); guard++) {
            const id = hintFill(prompt, s)!;
            s = tapFill(prompt, s, id).state;
          }
          expect(fillDone(prompt, s)).toBe(true);
        }
      }
    }
  });

  it('gives a 3 to 4 year old three-letter words on every spelling level', () => {
    for (const { i } of SPELL_LEVELS) {
      for (const p of makeRound(i, 5, '3-4').prompts as FillPrompt[]) expect(p.cells).toHaveLength(3);
    }
  });

  it('gives a 7 and up player six to eight letters, growing to eight on the harder levels', () => {
    const lengths = (level: number) => (makeRound(level, 5, '7-8').prompts as FillPrompt[]).map((p) => p.cells.length);
    expect(lengths(15).every((n) => n === 6)).toBe(true);
    expect(lengths(18).every((n) => n === 7)).toBe(true);
    expect(lengths(21).every((n) => n === 8)).toBe(true);
    expect(lengths(23).every((n) => n >= 6 && n <= 8)).toBe(true);
  });

  it('never puts a decoy on any spelling level', () => {
    for (const { def } of SPELL_LEVELS) expect(def.kind === 'spell' && def.decoys).toBe(0);
  });

  it('is deterministic for a seed and band, and differs between bands', () => {
    expect(JSON.stringify(makeRound(16, 9, '5-6'))).toBe(JSON.stringify(makeRound(16, 9, '5-6')));
    expect(JSON.stringify(makeRound(16, 9, '5-6'))).not.toBe(JSON.stringify(makeRound(16, 9, '3-4')));
  });

  it('falls back to the 5 to 6 words when no band is given', () => {
    for (const p of makeRound(16, 3).prompts as FillPrompt[]) expect([4, 5]).toContain(p.cells.length);
  });
});
