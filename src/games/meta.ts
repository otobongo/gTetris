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
}

/**
 * The one unlock rule, shared by the Levels screen and the games so a tile that shows open also opens:
 * linear (a level opens once the one before has a star), plus anything the store already marks open.
 * Ages 9 to 10 also start the first level of every chapter open (user decision 7).
 */
export function isLevelOpen(meta: GameMeta, game: GameProgress, band: AgeBand | null | undefined, index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= meta.levelCount) return false;
  if (index === 0 || index <= game.unlocked || (game.stars[index - 1] ?? 0) > 0) return true;
  return band === '9-10' && meta.chapters.some((c) => c.count > 0 && c.start === index);
}
