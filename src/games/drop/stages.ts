import { activePlayer, gameOf, progressStore } from '../../shared/progress';
import { firstOpenLevel, type GameMeta } from '../meta';
import { PIECES, type PieceId } from './pieces';

export interface Stage {
  name: string;
  cols: number;
  rows: number;
  pieces: PieceId[];
  goalRows: number;
  /** Milliseconds for a brick to fall one row on its own. */
  gravityMs: number;
  /** How long a landed brick waits before it locks, so kids can still slide it. */
  lockDelayMs: number;
  /** Explicit speed stage: the only kind of stage that is meant to feel quick. */
  speedy?: boolean;
  tip: string;
}

const FOUR: PieceId[] = ['long', 'square', 'tee', 'zig', 'zag', 'hook', 'boot'];

export const STAGES: Stage[] = [
  {
    name: 'First Bricks',
    cols: 7, rows: 14, pieces: ['dot', 'pair'], goalRows: 3, gravityMs: 1000, lockDelayMs: 1000,
    tip: 'The see-through shadow shows where your brick will land.',
  },
  {
    name: 'Short Sticks',
    cols: 7, rows: 14, pieces: ['dot', 'pair', 'stick3'], goalRows: 4, gravityMs: 950, lockDelayMs: 1000,
    tip: 'Turn a stick on its end to fill a narrow gap.',
  },
  {
    name: 'Corners',
    cols: 7, rows: 14, pieces: ['pair', 'stick3', 'corner'], goalRows: 5, gravityMs: 900, lockDelayMs: 1000,
    tip: 'A Corner fits snugly into a step. Turn it to match the spot.',
  },
  {
    name: 'Squares and Sticks',
    cols: 8, rows: 16, pieces: ['pair', 'stick3', 'corner', 'square', 'long'], goalRows: 6, gravityMs: 850, lockDelayMs: 950,
    tip: 'Keep your stack flat so every brick has a good home.',
  },
  {
    name: 'Tee Time',
    cols: 10, rows: 18, pieces: ['square', 'long', 'tee', 'stick3', 'corner'], goalRows: 6, gravityMs: 800, lockDelayMs: 900,
    tip: 'Not a good fit? Turn the brick or slide it to another spot.',
  },
  {
    name: 'Hooks and Boots',
    cols: 10, rows: 18, pieces: ['square', 'long', 'tee', 'hook', 'boot'], goalRows: 8, gravityMs: 750, lockDelayMs: 850,
    tip: 'Leave one column open, then drop a Long Stick in to clear lots of rows at once.',
  },
  {
    name: 'Zig and Zag',
    cols: 10, rows: 18, pieces: FOUR, goalRows: 8, gravityMs: 700, lockDelayMs: 800,
    tip: 'Zig and Zag love to sit on bumpy steps.',
  },
  {
    name: 'Plan Ahead',
    cols: 10, rows: 18, pieces: FOUR, goalRows: 10, gravityMs: 600, lockDelayMs: 750,
    tip: 'Peek at the Next box and plan where the next brick will go.',
  },
  {
    name: 'Speedy',
    cols: 10, rows: 18, pieces: FOUR, goalRows: 10, gravityMs: 420, lockDelayMs: 700, speedy: true,
    tip: 'Speed stage! Bricks fall faster. Use the shadow and take your time to think.',
  },
  {
    name: 'Big Flag',
    cols: 10, rows: 18, pieces: [...FOUR, 'flag'], goalRows: 10, gravityMs: 560, lockDelayMs: 800,
    tip: 'The Flag has 5 bricks. Look for a wide, flat spot to put it.',
  },
  {
    name: 'Cup Stack',
    cols: 10, rows: 18, pieces: [...FOUR, 'flag', 'cup'], goalRows: 12, gravityMs: 500, lockDelayMs: 750,
    tip: 'Turn the Cup upside down to cover a bump.',
  },
  {
    name: 'Master Builder',
    cols: 10, rows: 18, pieces: [...FOUR, 'flag', 'cup', 'bigboot'], goalRows: 15, gravityMs: 440, lockDelayMs: 700,
    tip: 'Every brick at once! Keep it flat and plan ahead.',
  },
];

/** Average number of cells per brick in a stage's set (every kind is equally likely). */
export function averageCells(stage: Stage): number {
  return stage.pieces.reduce((s, id) => s + PIECES[id].cells.length, 0) / stage.pieces.length;
}

/**
 * Star rule: fewer bricks used to reach the goal means a tidier, better-planned stack.
 * The perfect count is goalRows * cols / averageCells; 3 stars allows about 2.5 rows of
 * leftovers, 2 stars about 6 rows. Finishing at all is always worth 1 star.
 */
export function starRule(stage: Stage): { three: number; two: number } {
  const per = stage.cols / averageCells(stage);
  const ideal = stage.goalRows * per;
  return { three: Math.ceil(ideal + 2.5 * per), two: Math.ceil(ideal + 6 * per) };
}

export function starsEarned(stage: Stage, bricksUsed: number): number {
  const { three, two } = starRule(stage);
  return bricksUsed <= three ? 3 : bricksUsed <= two ? 2 : 1;
}

/** Bricks that appear for the first time in this stage (shown with a "New" tag). */
export function newPieces(index: number): PieceId[] {
  const seen = new Set(STAGES.slice(0, index).flatMap((s) => s.pieces));
  return STAGES[index].pieces.filter((id) => !seen.has(id));
}

/**
 * Brick Drop stage groups for the Levels screen (Brick Drop calls levels "Stage"); meta.ts publishes
 * this. Chapters follow the bricks: stages 1 to 3 use bricks of 1 to 3 squares; stage 4 brings in the
 * first four-square bricks (Square, Long Stick); stage 10 brings in the first five-square brick (Flag).
 * It lives here, next to STAGES, so currentStage can use it without an import cycle.
 */
export const dropMeta: GameMeta = {
  levelCount: STAGES.length,
  chapters: [
    { title: 'Small bricks', note: '1 to 3 squares', start: 0, count: 3 },
    { title: 'Four-square bricks', note: 'up to 4 squares', start: 3, count: 6 },
    { title: 'Big bricks', note: 'up to 5 squares', start: 9, count: STAGES.length - 9 },
  ],
};

/** The stage to open when the player taps Play: the shared rule (games/meta.ts), the first open stage with no stars yet, else the last one. */
export function currentStage(): number {
  const player = activePlayer(progressStore.getState());
  return firstOpenLevel(dropMeta, gameOf(player, 'drop'), player?.ageBand) ?? 0;
}
