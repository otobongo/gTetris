/* Letter Builder progression: 24 levels in 4 chapters, from simple (tap A to D) to hard
   (spell eight-letter words). Every level holds 6 puzzles on one idea at one difficulty, and 4
   solved finish it (brief 4.3). Puzzle generation is pure and seeded by the level's run. */
import { PUZZLES_PER_LEVEL, type AgeBand } from '../../shared/progress';
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

/**
 * One level's idea and difficulty. Every puzzle of a level shares these values; only the content
 * (which letters, gaps, pictures and words) changes from puzzle to puzzle.
 */
export type LevelDef =
  /** Tap a run of letters in order. `run` fixes the run length (Level 1: 4); otherwise it is the longest piece of chunkSizes(span, 7). */
  | { kind: 'train'; name: string; from: string; to: string; lower?: boolean; guide?: boolean; run?: number }
  /** Fill the gaps in a run of `window` letters: the same gaps and decoys on every puzzle. */
  | { kind: 'missing'; name: string; window: number; gaps: number; decoys: number }
  | { kind: 'match'; name: string; pairs: number; pool: 'lookalike' | 'all' | 'tricky' }
  | { kind: 'sound'; name: string; choices: number; words: Word[]; lower?: boolean }
  /** Words come from the player's age band (see spelling.ts). The tray never holds an extra letter, so decoys is always 0. */
  | { kind: 'spell'; name: string; tier: SpellTier; guide: boolean; decoys: 0 };

export interface Chapter {
  title: string;
  /** Short note after the heading on the level picker. */
  note: string;
  start: number;
  count: number;
}

const ANY_THREE = [...CVC, ...THREE];

export const LEVELS: LevelDef[] = [
  // Chapter 1: Alphabet Train. Level 1 alternates A to D and B to E (decision 11).
  { kind: 'train', name: 'A to E', from: 'A', to: 'E', guide: true, run: 4 },
  { kind: 'train', name: 'A to J', from: 'A', to: 'J' },
  { kind: 'train', name: 'A to O', from: 'A', to: 'O' },
  { kind: 'train', name: 'A to Z', from: 'A', to: 'Z' },
  { kind: 'train', name: 'a to m', from: 'A', to: 'M', lower: true },
  { kind: 'train', name: 'n to z', from: 'N', to: 'Z', lower: true },
  { kind: 'missing', name: 'Missing letters', window: 6, gaps: 2, decoys: 1 },
  // Chapter 2: Big & small
  { kind: 'match', name: '3 pairs', pairs: 3, pool: 'lookalike' },
  { kind: 'match', name: '4 pairs', pairs: 4, pool: 'all' },
  { kind: 'match', name: '6 pairs', pairs: 6, pool: 'all' },
  { kind: 'match', name: 'b d p q', pairs: 8, pool: 'tricky' },
  // Chapter 3: First sounds
  { kind: 'sound', name: 'Pick of 3', choices: 3, words: ANY_THREE },
  { kind: 'sound', name: 'More words', choices: 3, words: FOUR },
  { kind: 'sound', name: 'Pick of 4', choices: 4, words: [...ANY_THREE, ...FOUR, ...FIVE] },
  { kind: 'sound', name: 'Small letters', choices: 4, words: [...FOUR, ...FIVE, ...SIX], lower: true },
  // Chapter 4: Spell it. Word length comes from the player's age; the levels step up through easier and harder words.
  { kind: 'spell', name: 'Easy words, with help', tier: 0, guide: true, decoys: 0 },
  { kind: 'spell', name: 'Easy words', tier: 0, guide: false, decoys: 0 },
  { kind: 'spell', name: 'More easy words', tier: 0, guide: false, decoys: 0 },
  { kind: 'spell', name: 'Next words, with help', tier: 1, guide: true, decoys: 0 },
  { kind: 'spell', name: 'Next words', tier: 1, guide: false, decoys: 0 },
  { kind: 'spell', name: 'More next words', tier: 1, guide: false, decoys: 0 },
  { kind: 'spell', name: 'Longer words, with help', tier: 2, guide: true, decoys: 0 },
  { kind: 'spell', name: 'Longer words', tier: 2, guide: false, decoys: 0 },
  { kind: 'spell', name: 'Master builder', tier: 3, guide: false, decoys: 0 },
];

export const CHAPTERS: Chapter[] = [
  { title: 'Alphabet Train', note: 'tap the letters in order', start: 0, count: 7 },
  { title: 'Big and small', note: 'match A with a', start: 7, count: 4 },
  { title: 'First sounds', note: 'what does it start with?', start: 11, count: 4 },
  { title: 'Spell it', note: 'build the word', start: 15, count: 9 },
];

/** Spelling levels count words built; every other level counts puzzles solved. */
export const isSpelling = (level: number): boolean => LEVELS[level]?.kind === 'spell';

/* ---------- Puzzles ---------- */

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

/** A puzzle already solved in this level's run: its number and, on spelling levels, the word built. */
export interface SolvedPuzzle {
  puzzle: number;
  word?: string;
}

const tiles = (chars: string[], prefix: string): Tile[] => chars.map((ch, i) => ({ id: `${prefix}${i}`, ch }));

/** Split n items into chunks of at most `max`, as evenly as possible (26 -> 7,7,6,6). */
export function chunkSizes(n: number, max: number): number[] {
  const parts = Math.ceil(n / max);
  const base = Math.floor(n / parts);
  const extra = n % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

const MAX_TRAIN = 7;
/** How many times a puzzle is redrawn to keep it different from the level's other puzzles. */
const RETRIES = 40;

const spanOf = (def: Extract<LevelDef, { kind: 'train' }>) =>
  ALPHABET.slice(ALPHABET.indexOf(def.from), ALPHABET.indexOf(def.to) + 1).map((c) => (def.lower ? c.toLowerCase() : c));

/** A train level's run length: Level 1's fixed 4, otherwise the longest piece today's chunks give (5 for A to J, 7 for A to Z). */
export function trainRunLength(def: Extract<LevelDef, { kind: 'train' }>): number {
  const span = spanOf(def).length;
  return Math.min(span, def.run ?? Math.max(...chunkSizes(span, MAX_TRAIN)));
}

/**
 * Where each of the 6 runs starts, as an index into the span. The first runs cover the whole span
 * in order (A to Z: A to G, H to N, O to U, T to Z); the rest start at letters not used yet, picked by
 * the seed. A span with fewer than 6 possible starts cycles them (Level 1: A to D, B to E, A to D...).
 */
export function trainStarts(def: Extract<LevelDef, { kind: 'train' }>, rand: () => number): number[] {
  const span = spanOf(def).length;
  const run = trainRunLength(def);
  const last = span - run;
  const cover: number[] = [];
  for (let at = 0; ; at += run) {
    const s = Math.min(at, last);
    if (!cover.includes(s)) cover.push(s);
    if (s >= last) break;
  }
  const rest = shuffle(
    Array.from({ length: last + 1 }, (_, i) => i).filter((i) => !cover.includes(i)),
    rand,
  );
  const all = [...cover, ...rest];
  return Array.from({ length: PUZZLES_PER_LEVEL }, (_, k) => all[k % all.length]);
}

/** A tray order for these letters that is not the answer order and not one this level already used for the same letters. */
function freshTray(chars: string[], seen: Set<string>, rand: () => number): string[] {
  let order = scramble(chars, rand);
  for (let i = 0; i < RETRIES && seen.has(`${chars.join('')}|${order.join('')}`); i++) order = scramble(chars, rand);
  seen.add(`${chars.join('')}|${order.join('')}`);
  return order;
}

function trainPuzzles(def: Extract<LevelDef, { kind: 'train' }>, rand: () => number): FillPrompt[] {
  const all = spanOf(def);
  const run = trainRunLength(def);
  const seen = new Set<string>();
  return trainStarts(def, rand).map((start, k) => {
    const cells = all.slice(start, start + run);
    return {
      kind: 'train',
      cells,
      given: cells.map(() => false),
      tray: tiles(freshTray(cells, seen, rand), `t${k}-`),
      guide: !!def.guide,
      label: `${cells[0]} to ${cells[cells.length - 1]}`,
    };
  });
}

function missingPuzzles(def: Extract<LevelDef, { kind: 'missing' }>, rand: () => number): FillPrompt[] {
  const starts = shuffle(
    Array.from({ length: ALPHABET.length - def.window + 1 }, (_, i) => i),
    rand,
  ).slice(0, PUZZLES_PER_LEVEL);
  return starts.map((s, k) => {
    const cells = ALPHABET.slice(s, s + def.window);
    // The same number of gaps on every puzzle. Never hide the first cell, so there is always a place to start from.
    const gaps = Math.min(def.window - 1, def.gaps);
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

function matchLetters(def: Extract<LevelDef, { kind: 'match' }>, rand: () => number): string[] {
  if (def.pool === 'lookalike') return shuffle(LOOK_ALIKE, rand).slice(0, def.pairs);
  if (def.pool === 'tricky') {
    const rest = shuffle(
      ALPHABET.filter((c) => !TRICKY.includes(c)),
      rand,
    ).slice(0, def.pairs - TRICKY.length);
    return [...TRICKY, ...rest];
  }
  return shuffle(ALPHABET, rand).slice(0, def.pairs);
}

function matchPuzzles(def: Extract<LevelDef, { kind: 'match' }>, rand: () => number): MatchPrompt[] {
  const seen = new Set<string>();
  return Array.from({ length: PUZZLES_PER_LEVEL }, (_, k) => {
    // Every puzzle of the level matches a different set of letters.
    let letters = matchLetters(def, rand);
    for (let i = 0; i < RETRIES && seen.has([...letters].sort().join('')); i++) letters = matchLetters(def, rand);
    seen.add([...letters].sort().join(''));
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

function soundPuzzles(def: Extract<LevelDef, { kind: 'sound' }>, rand: () => number): SoundPrompt[] {
  const pool = def.words.filter((w) => hasClearFirstSound(w.word));
  // 6 different words: every first-sound pool holds more than 6 clear words.
  return shuffle(pool, rand)
    .slice(0, PUZZLES_PER_LEVEL)
    .map((word, k) => {
      const first = word.word[0].toUpperCase();
      // Wrong choices never sound like the answer, and every choice is a different brick color.
      const chosen = [first];
      for (const c of shuffle(ALPHABET, rand)) {
        if (chosen.length >= def.choices) break;
        if (soundsAlike(c, first) || chosen.some((x) => letterColor(x) === letterColor(c))) continue;
        chosen.push(c);
      }
      const chars = shuffle(chosen, rand).map((c) => (def.lower ? c.toLowerCase() : c));
      return {
        kind: 'sound',
        word,
        options: tiles(chars, `s${k}-`),
        answer: def.lower ? first.toLowerCase() : first,
      };
    });
}

/* ---------- Spelling words (4.3) ---------- */

/** FNV-1a: a stable 32-bit number for a string, so a player's word order never changes between visits. */
function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * One shuffled order of a tier's words for each player, age band and tier, seeded by those three and
 * never by the run, so the levels on a tier share it and a replay gets the same words.
 */
export function spellOrder(player: string, band: AgeBand, tier: SpellTier): Word[] {
  return shuffle(spellWords(band, tier), rng(hashString(`letters|${player}|${band}|${tier}`)));
}

/** Which spelling level on its tier this is (0 for the first): it takes places 6k to 6k + 5 of the tier order. */
export function tierIndex(level: number): number {
  const def = LEVELS[level];
  if (def?.kind !== 'spell') return 0;
  return LEVELS.slice(0, level).filter((d) => d.kind === 'spell' && d.tier === def.tier).length;
}

/**
 * The word for each of the level's 6 puzzle numbers. The run seed orders the level's 6 places; a
 * solved puzzle keeps its place. An unsolved one takes its own place's word unless that word was
 * already built in this run (a band change, 2.3), and then the next free place after the level's
 * six, so a level never holds a word twice.
 */
export function levelWords(level: number, band: AgeBand, rand: () => number, solved: readonly SolvedPuzzle[] = [], player = ''): Word[] {
  const def = LEVELS[level];
  if (def?.kind !== 'spell') return [];
  const order = spellOrder(player, band, def.tier);
  const n = order.length;
  const first = PUZZLES_PER_LEVEL * tierIndex(level);
  const places = shuffle(
    Array.from({ length: PUZZLES_PER_LEVEL }, (_, i) => i),
    rand,
  );
  const own = (p: number) => order[(first + places[p]) % n];
  const solvedSet = new Set(solved.map((s) => s.puzzle));
  const built = new Set(solved.map((s) => s.word?.toLowerCase()).filter((w): w is string => !!w));
  const used = new Set<string>();
  const out: (Word | null)[] = Array.from({ length: PUZZLES_PER_LEVEL }, () => null);

  for (let p = 0; p < PUZZLES_PER_LEVEL; p++) {
    if (solvedSet.has(p)) continue;
    const w = own(p);
    if (!built.has(w.word) && !used.has(w.word)) {
      out[p] = w;
      used.add(w.word);
    }
  }
  let at = first + PUZZLES_PER_LEVEL;
  for (let p = 0; p < PUZZLES_PER_LEVEL; p++) {
    if (solvedSet.has(p) || out[p]) continue;
    // Every pool holds at least 8 words and at most 3 are built, so a free one is always found.
    for (let tries = 0; tries < n && !out[p]; tries++, at++) {
      const w = order[at % n];
      if (!built.has(w.word) && !used.has(w.word)) {
        out[p] = w;
        used.add(w.word);
      }
    }
  }
  // Solved puzzles are never shown again; they keep their own place's word.
  return out.map((w, p) => w ?? own(p));
}

function spellPuzzles(level: number, def: Extract<LevelDef, { kind: 'spell' }>, band: AgeBand, rand: () => number, solved: readonly SolvedPuzzle[], player: string): FillPrompt[] {
  return levelWords(level, band, rand, solved, player).map((word, k) => {
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

/**
 * The level's 6 puzzles, by puzzle number (0 to 5). The run's `seed` fixes everything random about the
 * level (which runs, letters and pictures, gaps and decoys, tray order), so a resumed level shows the
 * same puzzles. `band` sets the spelling words' length; `solved` (spelling) keeps a band change from
 * repeating a built word; `player` seeds the player's own word order.
 */
export function makePuzzles(level: number, seed: number, band: AgeBand = '5-6', solved: readonly SolvedPuzzle[] = [], player = ''): Prompt[] {
  const def = LEVELS[level];
  const rand = rng(seed);
  switch (def.kind) {
    case 'train':
      return trainPuzzles(def, rand);
    case 'missing':
      return missingPuzzles(def, rand);
    case 'match':
      return matchPuzzles(def, rand);
    case 'sound':
      return soundPuzzles(def, rand);
    case 'spell':
      return spellPuzzles(level, def, band, rand, solved, player);
  }
}

/** The level's puzzles as a round, for tests and tools that look at all 6 at once. */
export function makeRound(level: number, seed: number, band: AgeBand = '5-6'): Round {
  return { level, def: LEVELS[level], prompts: makePuzzles(level, seed, band) };
}

export function chapterOf(level: number): Chapter {
  return CHAPTERS.find((c) => level >= c.start && level < c.start + c.count) ?? CHAPTERS[0];
}
