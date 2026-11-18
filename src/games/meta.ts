import type { AgeBand, GameProgress } from '../shared/progress';

/** Level counts and chapters a game publishes for Home and the Levels screen. */
export interface Chapter {
  title: string;
  /** Short inline note after the heading (14/700). Empty when there is none. */
  note: string;
  /** First level of the chapter, as a 0-based index. */
  start: number;
  /** Number of levels in the chapter. */
  count: number;
  /** Open-ended chapter: Levels shows a "More soon" tile after its levels. */
  more?: boolean;
}

export interface GameMeta {
  levelCount: number;
  chapters: Chapter[];
  /**
   * Where a child of an age band who has never played this game starts (0-based level), for the bands
   * that skip the first levels (usability decision 10). Earlier levels stay with the grown-up picker.
   * A value that is not a level of this game is ignored.
   */
  bandStart?: Partial<Record<AgeBand, number>>;
}

/** The game's start level for a band, or null when it has none (or a value that is not one of its levels). */
function startFor(meta: GameMeta, band: AgeBand | null | undefined): number | null {
  if (!band) return null;
  const b = meta.bandStart?.[band];
  return typeof b === 'number' && Number.isInteger(b) && b >= 0 && b < meta.levelCount ? b : null;
}

/**
 * The one unlock rule, shared by the Levels screen and the games so a tile that shows open also opens:
 * linear (a level opens once the one before has a star), plus anything the store already marks open.
 * Ages 9 to 10 also start the first level of every chapter open (user decision 7), and a band's start
 * level is open for that band (usability decision 10).
 */
export function isLevelOpen(meta: GameMeta, game: GameProgress, band: AgeBand | null | undefined, index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= meta.levelCount) return false;
  if (index === 0 || index <= game.unlocked || (game.stars[index - 1] ?? 0) > 0) return true;
  if (index === startFor(meta, band)) return true;
  return band === '9-10' && meta.chapters.some((c) => c.count > 0 && c.start === index);
}

/**
 * The current level (brief 2.6), the one rule every screen uses: the `#/game/<id>` redirect, Home's
 * pill and card name, the Settings row, the picker and Break's line.
 * 1. A stored `current` (a finish or a grown-up pick) when it is a level of this game.
 * 2. Otherwise, for a child of a `band` with a start level (usability decision 10), that level while the
 *    game has no stars and no run on any other level: a game never played, or one part way through its
 *    start level. A star anywhere, or a run on another level (Level 1 started before a band change),
 *    keeps rule 3.
 * 3. Otherwise the first level with no stars (always open: the level before it has stars).
 * 4. Otherwise null: every level is finished.
 * Games with no start level (Brick Escape, Brick Drop, Letter Builder) may leave `band` out.
 */
export function currentLevel(meta: GameMeta, game: GameProgress, band?: AgeBand | null): number | null {
  const count = meta.levelCount;
  const stored = game.current;
  if (typeof stored === 'number' && Number.isInteger(stored) && stored >= 0 && stored < count) return stored;
  const start = startFor(meta, band);
  if (start !== null && neverPlayedBut(meta, game, start)) return start;
  for (let i = 0; i < count; i++) if (!((game.stars[i] ?? 0) > 0)) return i;
  return null;
}

/** True when no level of the game has stars and its runs hold no level other than `level`. */
function neverPlayedBut(meta: GameMeta, game: GameProgress, level: number): boolean {
  for (let i = 0; i < meta.levelCount; i++) if ((game.stars[i] ?? 0) > 0) return false;
  return Object.keys(game.runs ?? {}).every((k) => Number(k) === level);
}
