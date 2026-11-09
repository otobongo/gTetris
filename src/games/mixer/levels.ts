/* Color Mixer's level table: 9 levels in 3 chapters of 3 (brief 4.1, 3.4, 7.9). Every level holds 6 puzzles
   in one form, on one shelf and one pool of results. The band changes nothing here: every age band gets the
   same puzzles (set `mixer:1`) and only the stuck limits differ. */
import { MIXES, RESULT_IDS, TINTS, type PaintId, type ResultId } from './colors';

/** The three ways to ask: finish the mix, guess the mix, make it. */
export const FORMS = ['finish', 'guess', 'make'] as const;
export type Form = (typeof FORMS)[number];

export interface LevelDef {
  form: Form;
  /** The paints this level's pairs come from. Finish (minus the given paint) and Make it show them as the shelf; Guess shows no shelf. */
  paints: readonly PaintId[];
  /** The results this level asks about. */
  pool: readonly ResultId[];
  /** Levels 1 to 6 hold each result of the pool twice; Levels 7 to 9 hold each of the six once. */
  twice: boolean;
  /** Guess only: the results the swatches are drawn from. A pool of exactly 3 shows all 3. */
  choicePool?: readonly ResultId[];
}

const THREE: readonly PaintId[] = ['red', 'yellow', 'blue'];
const FOUR: readonly PaintId[] = ['red', 'yellow', 'blue', 'white'];

/** Swatches on a Guess puzzle (brief 4.1). */
export const GUESS_CHOICES = 3;

export const LEVELS: readonly LevelDef[] = [
  // Chapter 1: Mix two paints
  { form: 'finish', paints: THREE, pool: MIXES, twice: true },
  { form: 'guess', paints: THREE, pool: MIXES, twice: true, choicePool: MIXES },
  { form: 'make', paints: THREE, pool: MIXES, twice: true },
  // Chapter 2: Make it lighter
  { form: 'finish', paints: FOUR, pool: TINTS, twice: true },
  { form: 'guess', paints: FOUR, pool: TINTS, twice: true, choicePool: RESULT_IDS },
  { form: 'make', paints: FOUR, pool: TINTS, twice: true },
  // Chapter 3: All six colors
  { form: 'finish', paints: FOUR, pool: RESULT_IDS, twice: false },
  { form: 'guess', paints: FOUR, pool: RESULT_IDS, twice: false, choicePool: RESULT_IDS },
  { form: 'make', paints: FOUR, pool: RESULT_IDS, twice: false },
];

export const LEVEL_COUNT = LEVELS.length;

export interface Chapter {
  title: string;
  /** The picker note after the heading. */
  note: string;
  start: number;
  count: number;
}

export const CHAPTERS: readonly Chapter[] = [
  { title: 'Mix two paints', note: 'red, yellow and blue', start: 0, count: 3 },
  { title: 'Make it lighter', note: 'add white', start: 3, count: 3 },
  { title: 'All six colors', note: 'every mix', start: 6, count: 3 },
];

/** Stars a child can earn in the game: 3 per level (brief 7.9). */
export const GAME_STARS = LEVEL_COUNT * 3;

/** The 0-based level's definition. */
export function levelDef(level: number): LevelDef {
  const def = LEVELS[level];
  if (!def) throw new RangeError(`Color Mixer has no level ${level}`);
  return def;
}
