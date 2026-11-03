import type { GameMeta } from '../meta';
import { STAGES } from './stages';

/** Brick Drop stage groups for the Levels screen (Brick Drop calls levels "Stage"). Owned by the Brick Drop game. */
export const meta: GameMeta = {
  levelCount: STAGES.length,
  chapters: [
    { title: 'Small bricks', note: '1 to 3 squares', start: 0, count: 4 },
    { title: 'Four-square bricks', note: 'bigger board', start: 4, count: 5 },
    { title: 'Big bricks', note: 'up to 5 squares', start: 9, count: STAGES.length - 9 },
  ],
};
