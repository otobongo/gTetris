/* Pattern Train's level table: 12 levels in 3 chapters of 3, 6 and 3 (brief 4.4, 3.4, 7.9). Every level holds 6
   puzzles at one difficulty: pattern length (2, 3, 4), repeats (AAB), then what changes (both, then one), then a
   mix of the same length. Levels 9 and 12 mix two patterns of equal length, so Level 12 holds only four-car ones.
   The age band changes nothing here: every band gets the same puzzles (set `pattern:1`). */
import type { Chapter } from '../meta';
import { LEVEL_STAR_RULES, STUCK } from '../run';

/** The six patterns: the letters repeat, so ABC is red circle, blue square, yellow triangle, then red circle again. */
export const PATTERN_IDS = ['AB', 'ABC', 'AAB', 'ABB', 'ABCD', 'AABB'] as const;
export type PatternId = (typeof PATTERN_IDS)[number];

/** Each pattern's repeating unit as indexes into its distinct cars: AAB is [0, 0, 1], ABCD is [0, 1, 2, 3]. */
export const PATTERN_UNIT: Record<PatternId, readonly number[]> = {
  AB: [0, 1],
  ABC: [0, 1, 2],
  AAB: [0, 0, 1],
  ABB: [0, 1, 1],
  ABCD: [0, 1, 2, 3],
  AABB: [0, 0, 1, 1],
};

/** How many different cars a pattern uses: 2 for AB, AAB, ABB and AABB, 3 for ABC, 4 for ABCD. */
export const distinctCars = (p: PatternId): number => Math.max(...PATTERN_UNIT[p]) + 1;

/** What differs between the pattern's different cars: shape and colour together, the colour alone, or the shape alone. */
export type Change = 'both' | 'color' | 'shape';

export interface LevelDef {
  /** One pattern, or two of the same length (Levels 9 and 12): each shows 3 times in the level's 6 puzzles. */
  patterns: readonly PatternId[];
  change: Change;
  /** Cars shown before the empty one: 4 on Levels 1 to 3, 5 on the rest (a sixth car does not fit 358 px at the board's 0.78 zoom). */
  shown: number;
}

export const LEVELS: readonly LevelDef[] = [
  // Chapter 1: Two-car patterns
  { patterns: ['AB'], change: 'both', shown: 4 },
  { patterns: ['AB'], change: 'color', shown: 4 },
  { patterns: ['AB'], change: 'shape', shown: 4 },
  // Chapter 2: Three-car patterns
  { patterns: ['ABC'], change: 'both', shown: 5 },
  { patterns: ['ABC'], change: 'color', shown: 5 },
  { patterns: ['ABC'], change: 'shape', shown: 5 },
  { patterns: ['AAB'], change: 'both', shown: 5 },
  { patterns: ['ABB'], change: 'both', shown: 5 },
  { patterns: ['AAB', 'ABB'], change: 'color', shown: 5 },
  // Chapter 3: Longer patterns
  { patterns: ['ABCD'], change: 'both', shown: 5 },
  { patterns: ['AABB'], change: 'both', shown: 5 },
  { patterns: ['ABCD', 'AABB'], change: 'both', shown: 5 },
];

export const LEVEL_COUNT = LEVELS.length;

/** The most cars a train shows before the empty one. */
export const MAX_SHOWN = 5;

/** Chapters match the stickers (3.4): titles and picker notes from 4.4. */
export const CHAPTERS: readonly Chapter[] = [
  { title: 'Two-car patterns', note: 'AB', start: 0, count: 3 },
  { title: 'Three-car patterns', note: 'ABC, AAB, ABB', start: 3, count: 6 },
  { title: 'Longer patterns', note: 'four cars', start: 9, count: 3 },
];

/** Stuck limits for Pattern Train: the `STUCK.pattern` row of src/games/run.ts, the one table (3.3). Count is slips (a new wrong car or a repeat); seconds is time on the puzzle, since nothing counts as progress before the answer. */
export const PATTERN_STUCK = STUCK.pattern;

/** The star rule on slips (3.2): 3 stars at 1 slip or none, 2 stars at 4 or fewer. No hint, no clock. It is `LEVEL_STAR_RULES.pattern` of run.ts. */
export const PATTERN_STAR_RULE = LEVEL_STAR_RULES.pattern;

/** Stars a child can earn in the game: 3 per level (brief 7.9). */
export const GAME_STARS = LEVEL_COUNT * 3;

export function levelDef(level: number): LevelDef {
  if (!Number.isInteger(level) || level < 0 || level >= LEVEL_COUNT) throw new RangeError(`Pattern Train has no level ${level}`);
  return LEVELS[level];
}

export function chapterOf(level: number): Chapter {
  const c = CHAPTERS.find((ch) => level >= ch.start && level < ch.start + ch.count);
  if (!c) throw new RangeError(`Pattern Train has no level ${level}`);
  return c;
}
