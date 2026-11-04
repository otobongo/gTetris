/* Letter Builder progression: 24 levels in 4 chapters, from simple (tap A to E) to hard
   (spell six-letter words with decoy bricks). Round generation is pure and seeded. */
import type { AgeBand } from '../../shared/progress';
import { rng, shuffle } from '../../shared/rng';
import {
  ALPHABET,
  CVC,
  FIVE,
  FOUR,
  LOOK_ALIKE,
  SIX,
  THREE,
  TRICKY,
  hasClearFirstSound,
  letterColor,
  soundsAlike,
  type Word,
} from './data';
import { scramble, spellWords, type SpellTier } from './spelling';

export type LevelDef =
  | { kind: 'train'; name: string; from: string; to: string; lower?: boolean; guide?: boolean }
  | { kind: 'missing'; name: string; prompts: number; window: number; gaps: number; decoys: number }
  | { kind: 'match'; name: string; prompts: number; pairs: number; pool: 'lookalike' | 'all' | 'tricky' }
  | { kind: 'sound'; name: string; prompts: number; choices: number; words: Word[]; lower?: boolean }
  /** Words come from the player's age band (see spelling.ts). The tray never holds an extra letter, so decoys is always 0. */
  | { kind: 'spell'; name: string; prompts: number; tier: SpellTier; guide: boolean; decoys: 0 };

export interface Chapter {
  title: string;
  /** Short note after the heading on the Levels screen. */
  note: string;
  start: number;
  count: number;
}

const ANY_THREE = [...CVC, ...THREE];

export const LEVELS: LevelDef[] = [
  // Chapter 1: Alphabet Train
  { kind: 'train', name: 'A to E', from: 'A', to: 'E', guide: true },
  { kind: 'train', name: 'A to J', from: 'A', to: 'J' },
  { kind: 'train', name: 'A to O', from: 'A', to: 'O' },
  { kind: 'train', name: 'A to Z', from: 'A', to: 'Z' },
  { kind: 'train', name: 'a to m', from: 'A', to: 'M', lower: true },
  { kind: 'train', name: 'n to z', from: 'N', to: 'Z', lower: true },
  { kind: 'missing', name: 'Missing letters', prompts: 5, window: 6, gaps: 2, decoys: 1 },
  // Chapter 2: Big & small
  { kind: 'match', name: '3 pairs', prompts: 4, pairs: 3, pool: 'lookalike' },
  { kind: 'match', name: '4 pairs', prompts: 4, pairs: 4, pool: 'all' },
  { kind: 'match', name: '6 pairs', prompts: 3, pairs: 6, pool: 'all' },
  { kind: 'match', name: 'b d p q', prompts: 3, pairs: 8, pool: 'tricky' },
  // Chapter 3: First sounds
  { kind: 'sound', name: 'Pick of 3', prompts: 5, choices: 3, words: ANY_THREE },
  { kind: 'sound', name: 'More words', prompts: 5, choices: 3, words: FOUR },
  { kind: 'sound', name: 'Pick of 4', prompts: 5, choices: 4, words: [...ANY_THREE, ...FOUR, ...FIVE] },
  { kind: 'sound', name: 'Small letters', prompts: 6, choices: 4, words: [...FOUR, ...FIVE, ...SIX], lower: true },
  // Chapter 4: Spell it. Word length comes from the player's age; the levels step up through easier and harder words.
  { kind: 'spell', name: 'Easy words, with help', prompts: 3, tier: 0, guide: true, decoys: 0 },
  { kind: 'spell', name: 'Easy words', prompts: 3, tier: 0, guide: false, decoys: 0 },
  { kind: 'spell', name: 'More easy words', prompts: 4, tier: 0, guide: false, decoys: 0 },
  { kind: 'spell', name: 'Next words, with help', prompts: 3, tier: 1, guide: true, decoys: 0 },
  { kind: 'spell', name: 'Next words', prompts: 3, tier: 1, guide: false, decoys: 0 },
  { kind: 'spell', name: 'More next words', prompts: 4, tier: 1, guide: false, decoys: 0 },
  { kind: 'spell', name: 'Longer words, with help', prompts: 3, tier: 2, guide: true, decoys: 0 },
  { kind: 'spell', name: 'Longer words', prompts: 4, tier: 2, guide: false, decoys: 0 },
  { kind: 'spell', name: 'Master builder', prompts: 4, tier: 3, guide: false, decoys: 0 },
];

export const CHAPTERS: Chapter[] = [
  { title: 'Alphabet Train', note: 'tap the letters in order', start: 0, count: 7 },
  { title: 'Big and small', note: 'match A with a', start: 7, count: 4 },
  { title: 'First sounds', note: 'what does it start with?', start: 11, count: 4 },
  { title: 'Spell it', note: 'build the word', start: 15, count: 9 },
];

/* ---------- Rounds ---------- */

export interface Tile {
  id: string;
  /** the character exactly as printed on the brick (upper or lower case) */
  ch: string;
}

/** A row of slots to fill left to right. `given` cells are already in place (missing-letter puzzles). */
export interface FillPrompt {
  kind: 'train' | 'missing' | 'spell';
  /** expected character per cell */
  cells: string[];
  given: boolean[];
  tray: Tile[];
  /** spell only */
  word?: Word;
  guide?: boolean;
  /** train/missing: label like "A to G" */
  label?: string;
}

export interface MatchPrompt {
  kind: 'match';
  /** uppercase letters to pair */
  letters: string[];
  upper: Tile[];
  lower: Tile[];
}

export interface SoundPrompt {
  kind: 'sound';
  word: Word;
  /** printed choices, exactly one is correct */
  options: Tile[];
  answer: string;
}

export type Prompt = FillPrompt | MatchPrompt | SoundPrompt;

export interface Round {
  level: number;
  def: LevelDef;
  prompts: Prompt[];
}

const tiles = (chars: string[], prefix: string): Tile[] => chars.map((ch, i) => ({ id: `${prefix}${i}`, ch }));

/** Split n items into chunks of at most `max`, as evenly as possible (26 -> 7,7,6,6). */
export function chunkSizes(n: number, max: number): number[] {
  const parts = Math.ceil(n / max);
  const base = Math.floor(n / parts);
  const extra = n % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Pick `count` distinct items; reshuffles the pool if it is smaller than count (never in practice). */
function pick<T>(pool: T[], count: number, rand: () => number): T[] {
  const out: T[] = [];
  while (out.length < count) out.push(...shuffle(pool, rand));
  return out.slice(0, count);
}

const MAX_TRAIN = 7;

function trainPrompts(def: Extract<LevelDef, { kind: 'train' }>, rand: () => number): FillPrompt[] {
  const all = ALPHABET.slice(ALPHABET.indexOf(def.from), ALPHABET.indexOf(def.to) + 1).map((c) =>
    def.lower ? c.toLowerCase() : c,
  );
  const out: FillPrompt[] = [];
  let at = 0;
  chunkSizes(all.length, MAX_TRAIN).forEach((size, k) => {
    const cells = all.slice(at, at + size);
    at += size;
    out.push({
      kind: 'train',
      cells,
      given: cells.map(() => false),
      tray: shuffle(tiles(cells, `t${k}-`), rand),
      guide: !!def.guide,
      label: `${cells[0]} to ${cells[cells.length - 1]}`,
    });
  });
  return out;
}

function missingPrompts(def: Extract<LevelDef, { kind: 'missing' }>, rand: () => number): FillPrompt[] {
  const starts = shuffle(
    Array.from({ length: ALPHABET.length - def.window + 1 }, (_, i) => i),
    rand,
  ).slice(0, def.prompts);
  return starts.map((s, k) => {
    const cells = ALPHABET.slice(s, s + def.window);
    // Later prompts hide one more letter. Never hide the first cell, so there is always a place to start from.
    const gaps = Math.min(def.window - 1, def.gaps + (k >= Math.ceil(def.prompts / 2) ? 1 : 0));
    const hidden = new Set(shuffle(Array.from({ length: def.window - 1 }, (_, i) => i + 1), rand).slice(0, gaps));
    const given = cells.map((_, i) => !hidden.has(i));
    const missing = cells.filter((_, i) => hidden.has(i));
    const decoys = shuffle(
      ALPHABET.filter((c) => !cells.includes(c)),
      rand,
    ).slice(0, def.decoys);
    return {
      kind: 'missing' as const,
      cells,
      given,
      tray: shuffle(tiles([...missing, ...decoys], `m${k}-`), rand),
      label: `${cells[0]} to ${cells[cells.length - 1]}`,
    };
  });
}

function matchPrompts(def: Extract<LevelDef, { kind: 'match' }>, rand: () => number): MatchPrompt[] {
  return Array.from({ length: def.prompts }, (_, k) => {
    let letters: string[];
    if (def.pool === 'lookalike') letters = shuffle(LOOK_ALIKE, rand).slice(0, def.pairs);
    else if (def.pool === 'tricky') {
      const rest = shuffle(
        ALPHABET.filter((c) => !TRICKY.includes(c)),
        rand,
      ).slice(0, def.pairs - TRICKY.length);
      letters = [...TRICKY, ...rest];
    } else letters = shuffle(ALPHABET, rand).slice(0, def.pairs);
    return {
      kind: 'match',
      letters,
      upper: shuffle(tiles(letters, `u${k}-`), rand),
      lower: shuffle(
        tiles(
          letters.map((c) => c.toLowerCase()),
          `l${k}-`,
        ),
        rand,
      ),
    };
  });
}

function soundPrompts(def: Extract<LevelDef, { kind: 'sound' }>, rand: () => number): SoundPrompt[] {
  const pool = def.words.filter((w) => hasClearFirstSound(w.word));
  return pick(pool, def.prompts, rand).map((word, k) => {
    const first = word.word[0].toUpperCase();
    // Wrong choices never sound like the answer, and every choice is a different brick color.
    const chosen = [first];
    for (const c of shuffle(ALPHABET, rand)) {
      if (chosen.length >= def.choices) break;
      if (soundsAlike(c, first) || chosen.some((x) => letterColor(x) === letterColor(c))) continue;
      chosen.push(c);
    }
    const others = chosen.slice(1);
    const chars = shuffle([first, ...others], rand).map((c) => (def.lower ? c.toLowerCase() : c));
    return {
      kind: 'sound',
      word,
      options: tiles(chars, `s${k}-`),
      answer: def.lower ? first.toLowerCase() : first,
    };
  });
}

function spellPrompts(def: Extract<LevelDef, { kind: 'spell' }>, band: AgeBand, rand: () => number): FillPrompt[] {
  const words = spellWords(band, def.tier);
  return shuffle(words, rand)
    .slice(0, def.prompts)
    .map((word, k) => {
      const cells = word.word.toUpperCase().split('');
      return {
        kind: 'spell',
        cells,
        given: cells.map(() => false),
        // One tile per letter of the word, shuffled, never in spelling order. No extra letters.
        tray: tiles(scramble(cells, rand), `w${k}-`),
        word,
        guide: def.guide,
      };
    });
}

/** `band` is the player's age band; it sets how long the spelling words are. */
export function makeRound(level: number, seed: number, band: AgeBand = '5-6'): Round {
  const def = LEVELS[level];
  const rand = rng(seed);
  let prompts: Prompt[];
  switch (def.kind) {
    case 'train':
      prompts = trainPrompts(def, rand);
      break;
    case 'missing':
      prompts = missingPrompts(def, rand);
      break;
    case 'match':
      prompts = matchPrompts(def, rand);
      break;
    case 'sound':
      prompts = soundPrompts(def, rand);
      break;
    case 'spell':
      prompts = spellPrompts(def, band, rand);
      break;
  }
  return { level, def, prompts };
}

export function chapterOf(level: number): Chapter {
  return CHAPTERS.find((c) => level >= c.start && level < c.start + c.count) ?? CHAPTERS[0];
}
