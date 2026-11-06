import type { GameMeta } from '../meta';
import { LEVEL_DATA } from './levels.data';

/**
 * Brick Escape chapters for the Levels screen, from design/canvas/Levels.dc.html. The level list is built by
 * scripts/generate-slide-levels.ts in this order (31 levels when every tier is generated).
 */
const CHAPTERS = [
  { title: 'Getting started', note: 'one idea at a time', count: 8 },
  { title: 'Think first', note: 'some bricks block others', count: 5 },
  { title: 'Icy doors', note: 'wait for the ice to melt', count: 6 },
  // Formerly "Frozen bricks", a mechanic that was removed. These levels teach grey stones and shaped trays
  // (the canvas "Stone blocks" board opens the chapter).
  { title: 'Stone blocks', note: '', count: 6 },
  { title: 'Big bricks', note: 'tight squeeze', count: 5 },
  // Open-ended: the canvas Master mix board, then the Levels screen's "More soon" tile.
  { title: 'Master', note: 'for real brick experts', count: 1, more: true },
];

const levelCount = LEVEL_DATA.length;

export const meta: GameMeta = {
  levelCount,
  chapters: CHAPTERS.map((c, i) => {
    const start = CHAPTERS.slice(0, i).reduce((sum, x) => sum + x.count, 0);
    // clamp to the levels that exist, so a partly generated set still lines up
    return { ...c, start, count: Math.max(0, Math.min(c.count, levelCount - start)) };
  }),
};
