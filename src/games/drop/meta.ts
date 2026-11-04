import type { GameMeta } from '../meta';
import { STAGES } from './stages';

/**
 * Brick Drop stage groups for the Levels screen (Brick Drop calls levels "Stage"). Owned by the Brick Drop game.
 * Chapters follow the bricks: stages 1 to 3 use bricks of 1 to 3 squares; stage 4 brings in the first
 * four-square bricks (Square, Long Stick); stage 10 brings in the first five-square brick (Flag).
 */
export const meta: GameMeta = {
  levelCount: STAGES.length,
  chapters: [
    { title: 'Small bricks', note: '1 to 3 squares', start: 0, count: 3 },
    { title: 'Four-square bricks', note: 'up to 4 squares', start: 3, count: 6 },
    { title: 'Big bricks', note: 'up to 5 squares', start: 9, count: STAGES.length - 9 },
  ],
};
