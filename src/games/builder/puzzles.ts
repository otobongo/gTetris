/**
 * Picture Builder content (six-games brief 4.6): 12 levels x 6 puzzles = 72 slots from the 42 pictures in
 * pictures.ts, in 3 chapters (5, 4, 3). Fixed content (set `builder:1`, seed 0): `puzzle(level, n)` always gives
 * the same picture, so nothing is stored and a resumed level shows the same pictures. No React and no DOM.
 *
 * Levels and puzzle numbers are 0-based, as in the progress store; level numbers (Level 1 is 1) appear only in
 * SET_RULES.levels and in copy. Raise BUILDER_SET_VERSION whenever a rule or a picture here changes, so stored
 * runs restart at puzzle 1 (brief 6).
 */
import { PUZZLES_PER_LEVEL, type AgeBand } from '../../shared/progress';
import type { Chapter } from '../meta';
import { LEVEL_STAR_RULES, STUCK } from '../run';
import { PICTURES_PER_SET, SET_RULES, cellsOf, picturesOf, type BuilderColor, type Picture, type PictureSet } from './pictures';

export const BUILDER_TITLE = 'Picture Builder';
export const BUILDER_SET_VERSION = 1;
/** Builder content is fixed: the run seed is always 0 (4.6). */
export const BUILDER_SEED = 0;

/* ---------- Stuck and stars (brief 3.2, 3.3) ---------- */

/** Stuck limits: the `STUCK.builder` row of src/games/run.ts, the one table (3.3). Count is slips; seconds is time with no new right brick. */
export const BUILDER_STUCK = STUCK.builder;

/** The star rule on slips (3.2): 3 stars at 1 slip or none, 2 stars at 4 or fewer. No hint, no clock. It is `LEVEL_STAR_RULES.builder` of run.ts. */
export const BUILDER_STAR_RULE = LEVEL_STAR_RULES.builder;

/* ---------- The level table (4.6) ---------- */

/** 'copy': the picture stays beside the board. 'memory': it shows for a look, then hides behind Peek. */
export type Mode = 'copy' | 'memory';

export interface LevelDef {
  mode: Mode;
  /** The picture set the level's 6 puzzles come from. */
  set: PictureSet;
  /** Squares per side. */
  size: 3 | 4 | 5;
  /** Different colours in every picture. */
  colors: 2 | 3 | 4;
  /** Filled squares, inclusive. */
  fill: { min: number; max: number };
}

const level = (mode: Mode, set: PictureSet): LevelDef => {
  const { size, colors, fill } = SET_RULES[set];
  return { mode, set, size, colors, fill };
};

/** Level 1 is index 0. Difficulty: grid size, colour count, then memory. */
export const LEVELS: readonly LevelDef[] = [
  // Chapter 1: Copy it
  level('copy', 'A'),
  level('copy', 'B'),
  level('copy', 'C'),
  level('copy', 'D'),
  level('copy', 'E'),
  // Chapter 2: From memory, on the copy levels' pictures in a new order
  level('memory', 'A'),
  level('memory', 'B'),
  level('memory', 'D'),
  level('memory', 'E'),
  // Chapter 3: Big pictures
  level('copy', 'F'),
  level('copy', 'G'),
  level('memory', 'G'),
];

export const LEVEL_COUNT = LEVELS.length;

/** Chapters match the game's three stickers (3.4): 5, 4 and 3 levels. Titles and picker notes from 4.6. */
export const CHAPTERS: readonly Chapter[] = [
  { title: 'Copy it', note: 'the picture stays', start: 0, count: 5 },
  { title: 'From memory', note: 'look, then build', start: 5, count: 4 },
  { title: 'Big pictures', note: '5 by 5', start: 9, count: 3 },
];

/** Stars a child can earn in the game: 3 per level (7.9). */
export const GAME_STARS = LEVEL_COUNT * 3;

/** The 0-based level's definition. Throws when there is no such level. */
export function levelDef(lv: number): LevelDef {
  const def = Number.isInteger(lv) ? LEVELS[lv] : undefined;
  if (!def) throw new RangeError(`Picture Builder has no level ${lv}`);
  return def;
}

/** The chapter a 0-based level sits in. Throws when there is no such level. */
export function chapterOf(lv: number): Chapter {
  levelDef(lv);
  return CHAPTERS.find((c) => lv >= c.start && lv < c.start + c.count)!;
}

/* ---------- Which picture each puzzle shows ---------- */

/** Memory levels shift the copy level's order by this much: puzzle n shows picture (n + 3) mod 6 (4.6). */
export const MEMORY_SHIFT = 3;

/** The index into the level's set that puzzle `n` shows: n on copy levels, (n + 3) mod 6 on memory levels. */
export function pictureIndex(lv: number, n: number): number {
  const def = levelDef(lv);
  checkPuzzle(n);
  return def.mode === 'memory' ? (n + MEMORY_SHIFT) % PICTURES_PER_SET : n;
}

function checkPuzzle(n: number): void {
  if (!Number.isInteger(n) || n < 0 || n >= PUZZLES_PER_LEVEL) throw new RangeError(`Picture Builder has no puzzle ${n}`);
}

/* ---------- Look times (4.6, 7.8) ---------- */

export interface LookTimes {
  /** Seconds the picture shows when a memory puzzle starts. */
  first: number;
  /** Seconds each Peek shows it. */
  peek: number;
}

/** The one table of look times by age band (7.8). The board has 4 s and 2 s; the other values are starting points. */
export const LOOK_SECONDS: Readonly<Record<AgeBand, LookTimes>> = {
  '3-4': { first: 6, peek: 3 },
  '5-6': { first: 5, peek: 2 },
  '7-8': { first: 4, peek: 2 },
  '9-10': { first: 3, peek: 2 },
};

/** Look seconds for a band; an unknown band falls back to 5 to 6, the store's default band. */
export function lookSeconds(band: AgeBand, kind: keyof LookTimes): number {
  return (LOOK_SECONDS[band] ?? LOOK_SECONDS['5-6'])[kind];
}

/** The two looks: the first look when a memory puzzle starts, and each Peek. */
export type LookKind = keyof LookTimes;

/** The look a puzzle opens with: a memory puzzle starts on its own first look; a copy puzzle has none. */
export const firstLook = (mode: Mode): LookKind | null => (mode === 'memory' ? 'first' : null);

/** How long a look lasts, in milliseconds, for the Play screen's timer. */
export const lookMs = (band: AgeBand, kind: LookKind): number => lookSeconds(band, kind) * 1000;

/** Peek is offered on a memory puzzle in play once its picture is hidden. It is free and unlimited. */
export const canPeek = (mode: Mode, look: LookKind | null, playing: boolean): boolean => mode === 'memory' && look === null && playing;

/** The model panel shows the picture on copy levels, during a look, and once the puzzle is solved. */
export const pictureShows = (mode: Mode, look: LookKind | null, playing: boolean): boolean => mode === 'copy' || look !== null || !playing;

/* ---------- Puzzles ---------- */

export interface BuilderPuzzle {
  /** Level index, 0-based (Level 1 is 0). */
  level: number;
  /** Puzzle number inside the level, 0 to 5. */
  n: number;
  mode: Mode;
  /** Squares per side. */
  size: number;
  picture: Picture;
  /** The picture's squares row by row: the colour each square must hold, or null for one that stays empty. */
  target: readonly (BuilderColor | null)[];
  /** Filled squares in the picture: the match bar's total. */
  bricks: number;
}

function build(lv: number, n: number): BuilderPuzzle {
  const def = levelDef(lv);
  const picture = picturesOf(def.set)[pictureIndex(lv, n)];
  const target = Object.freeze(cellsOf(picture.art));
  return { level: lv, n, mode: def.mode, size: def.size, picture, target, bricks: target.filter((c) => c !== null).length };
}

/**
 * The level's 6 puzzles in order. Builder content is fixed (seed 0, the same for every band), so this takes the
 * level only. Throws when there is no such level.
 */
export function makePuzzles(lv: number): BuilderPuzzle[] {
  levelDef(lv);
  return Array.from({ length: PUZZLES_PER_LEVEL }, (_, n) => build(lv, n));
}

/**
 * Puzzle `n` (0 to 5) of 0-based level `lv`: KitGame.puzzle. `ctx` is accepted for the kit's signature; the
 * seed and band change nothing here. Throws when the level or the puzzle number is out of range.
 */
export function puzzle(lv: number, n: number, _ctx?: { seed: number; band: AgeBand }): BuilderPuzzle {
  levelDef(lv);
  checkPuzzle(n);
  return build(lv, n);
}
