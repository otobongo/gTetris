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

/**
 * The current level (brief 2.6), the one rule every screen uses: the `#/game/<id>` redirect, Home's
 * pill and card name, the Settings row, the picker and Break's line.
 * 1. A stored `current` (a finish or a grown-up pick) when it is a level of this game.
 * 2. Otherwise the first level with no stars (always open: the level before it has stars).
 * 3. Otherwise null: every level is finished.
 */
export function currentLevel(meta: GameMeta, game: GameProgress): number | null {
  const count = meta.levelCount;
  const stored = game.current;
  if (typeof stored === 'number' && Number.isInteger(stored) && stored >= 0 && stored < count) return stored;
  for (let i = 0; i < count; i++) if (!((game.stars[i] ?? 0) > 0)) return i;
  return null;
}
