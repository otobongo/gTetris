import type { GameMeta } from '../meta';
import { LEVEL_DATA } from './levels.data';

/** Brick Escape chapters for the Levels screen. Owned by the Brick Escape game; update as levels change. */
export const meta: GameMeta = {
  levelCount: LEVEL_DATA.length,
  chapters: [
    { title: 'Getting started', note: 'one idea at a time', start: 0, count: 8 },
    { title: 'Think first', note: 'some bricks block others', start: 8, count: 5 },
    { title: 'Icy doors', note: 'wait for the ice to melt', start: 13, count: 6 },
    // levels.ts calls this chapter "Frozen bricks", a mechanic that was removed. Rename before launch.
    { title: '[PLACEHOLDER: chapter name]', note: '', start: 19, count: 6 },
    { title: 'Big bricks', note: 'tight squeeze', start: 25, count: 5 },
    // Open-ended: no master levels exist yet, so Levels shows only the "More soon" tile.
    { title: 'Master', note: 'for real brick experts', start: 30, count: 0, more: true },
  ],
};
