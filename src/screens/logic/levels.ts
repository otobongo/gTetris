/**
 * Level select rules (design/canvas/Levels.dc.html, brief 3.2), as pure functions so they can
 * be tested without a browser. Level indexes are 0-based; the numbers a child sees are 1-based.
 */
import { isLevelOpen, type GameMeta } from '../../games/meta';
import type { AgeBand, GameProgress } from '../../shared/progress';

export type TileState = 'done' | 'current' | 'open' | 'locked';

export interface LevelTile {
  /** 0-based level index. */
  index: number;
  /** The number on the tile (1-based). */
  n: number;
  state: TileState;
  /** Stars earned, 0 to 3. */
  stars: number;
}

export interface LevelChapter {
  title: string;
  note: string;
  tiles: LevelTile[];
  /** Open-ended chapter: a "More soon" tile follows its levels. */
  more: boolean;
}

export interface LevelPlan {
  chapters: LevelChapter[];
  /** The level Play opens (0-based), or null when every level is done. */
  current: number | null;
  complete: boolean;
  stars: number;
  maxStars: number;
  levelCount: number;
}

/**
 * Unlock rule: linear, as the games use it (a level opens once the one before has a star),
 * plus anything the store already marks open. Ages 9 to 10 also start the first level of every
 * chapter open (user decision 7).
 */
export function planLevels(meta: GameMeta, game: GameProgress, band: AgeBand): LevelPlan {
  const count = meta.levelCount;
  const starsOf = (i: number) => Math.max(0, Math.min(3, game.stars[i] ?? 0));
  const isOpen = (i: number) => isLevelOpen(meta, game, band, i);

  let current: number | null = null;
  for (let i = 0; i < count; i++) {
    if (starsOf(i) === 0 && isOpen(i)) {
      current = i;
      break;
    }
  }

  let stars = 0;
  const chapters = meta.chapters.map((c) => {
    const tiles: LevelTile[] = [];
    const end = Math.min(c.start + c.count, count);
    for (let i = c.start; i < end; i++) {
      const s = starsOf(i);
      stars += s;
      const state: TileState = s > 0 ? 'done' : i === current ? 'current' : isOpen(i) ? 'open' : 'locked';
      tiles.push({ index: i, n: i + 1, state, stars: s });
    }
    return { title: c.title, note: c.note, tiles, more: !!c.more };
  });

  const complete = count > 0 && current === null && Array.from({ length: count }, (_, i) => starsOf(i) > 0).every(Boolean);
  return { chapters, current, complete, stars, maxStars: count * 3, levelCount: count };
}

/** Status line for a tap on a locked tile: "Finish Level 9 to open Level 10." */
export function lockMessage(plan: LevelPlan, index: number, noun: string): string {
  const stateOf = (i: number) => plan.chapters.flatMap((c) => c.tiles).find((t) => t.index === i)?.state ?? 'locked';
  let q = index - 1;
  while (q > 0 && stateOf(q) === 'locked') q--;
  if (q === index - 1) return `Finish ${noun} ${q + 1} to open ${noun} ${index + 1}.`;
  return `Finish ${noun} ${q + 1} first. ${noun}s open one at a time.`;
}

/** Accessible name of a tile, as the board writes it. */
export function tileLabel(tile: LevelTile, noun: string): string {
  switch (tile.state) {
    case 'done':
      return `${noun} ${tile.n}, ${tile.stars} ${tile.stars === 1 ? 'star' : 'stars'}`;
    case 'current':
      return `${noun} ${tile.n}, play next`;
    case 'open':
      return `${noun} ${tile.n}, not played`;
    default:
      return `${noun} ${tile.n}, locked`;
  }
}

/** Home card pill: "Level 9", "Stage 4", or "All done" once every level has a star. */
export function homePill(meta: GameMeta | null, game: GameProgress, band: AgeBand, noun: string): string {
  if (!meta) return 'Coming soon';
  const plan = planLevels(meta, game, band);
  if (plan.complete) return 'All done';
  return `${noun} ${(plan.current ?? 0) + 1}`;
}
