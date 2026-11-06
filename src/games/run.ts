/**
 * Four-puzzle levels, the rules every game shares (brief sections 3 and 5): which puzzle comes next,
 * what a swap does, when a child counts as stuck, and the level's stars over its 4 solved puzzles.
 * Pure functions only; the progress store (src/shared/progress) saves the runs.
 */
import { PUZZLES_PER_LEVEL, SOLVES_PER_LEVEL, type AgeBand, type LevelRun, type PuzzleResult } from '../shared/progress';
import { capStars, levelCaps } from './stars';

export { PUZZLES_PER_LEVEL, SOLVES_PER_LEVEL };

/** The six games built on the shared kit (src/games/kit, six-games brief 3.1). Each counts slips for its stars. */
export const SLIP_GAMES = ['mixer', 'sorter', 'numbers', 'pattern', 'math', 'builder'] as const;
export type SlipGame = (typeof SLIP_GAMES)[number];

export type RunGame = 'escape' | 'drop' | 'letters' | SlipGame;

/* ---------- Puzzle sets (6.1): a stored run on another set starts again ---------- */

/** Brick Escape: one set per level, named by the level's id (it changes by itself when the boards do). */
export const escapeSet = (levelId: string): string => `escape:${levelId}`;
/** Brick Drop: raise `version` whenever the puzzle rules change. */
export const dropSet = (version = 1): string => `drop:${version}`;
/** Letter Builder: words depend on the age band; raise `version` whenever the puzzle rules change. */
export const lettersSet = (band: AgeBand, version = 1): string => `letters:${version}:${band}`;

/*
 * The six kit games (six-games brief 3.2, 6). Raise `version` whenever a game's puzzle rules change, so
 * stored runs restart at puzzle 1. Number Line-up and Brick Calculator change their numbers by age band.
 */
export const mixerSet = (version = 1): string => `mixer:${version}`;
export const sorterSet = (version = 1): string => `sorter:${version}`;
export const patternSet = (version = 1): string => `pattern:${version}`;
export const builderSet = (version = 1): string => `builder:${version}`;
export const numbersSet = (band: AgeBand, version = 1): string => `numbers:${version}:${band}`;
export const mathSet = (band: AgeBand, version = 1): string => `math:${version}:${band}`;

/* ---------- Queue (3.3) ---------- */

/** A new level's queue: every puzzle in order, so puzzle 0 (the level's original board) comes first. */
export function firstQueue(): number[] {
  return Array.from({ length: PUZZLES_PER_LEVEL }, (_, i) => i);
}

/** The puzzle on screen: queue[0]. */
export function puzzleOnScreen(run: Pick<LevelRun, 'queue'>): number {
  return run.queue[0] ?? 0;
}

/** A swap: queue[0] moves to the end, so after all six are seen the one swapped away longest ago comes back. */
export function rotateQueue(queue: readonly number[]): number[] {
  return queue.length < 2 ? queue.slice() : [...queue.slice(1), queue[0]];
}

/** Which of the 4 dots is on screen, 1 to 4. A swap leaves it alone; only a solve moves it on. */
export function dotPosition(run: Pick<LevelRun, 'solved'>): number {
  return Math.min(SOLVES_PER_LEVEL, run.solved.length + 1);
}

/* ---------- Stuck (3.1, 3.2) ---------- */

export interface StuckLimit {
  /** Count signal: Escape failed tries, Drop failed tries (the stack reaches the top), Letter Builder wrong taps. */
  count: number;
  /** Time signal: seconds with no progress; null when the game has none (Brick Drop). */
  seconds: number | null;
}

/** The one table of stuck limits (3.1), so tuning after watching children play is one edit. */
export const STUCK: Readonly<Record<RunGame, Readonly<Record<AgeBand, StuckLimit>>>> = {
  escape: {
    '3-4': { count: 2, seconds: 60 },
    '5-6': { count: 2, seconds: 90 },
    '7-8': { count: 3, seconds: 120 },
    '9-10': { count: 3, seconds: 150 },
  },
  drop: {
    '3-4': { count: 2, seconds: null },
    '5-6': { count: 2, seconds: null },
    '7-8': { count: 3, seconds: null },
    '9-10': { count: 3, seconds: null },
  },
  letters: {
    '3-4': { count: 3, seconds: 30 },
    '5-6': { count: 3, seconds: 40 },
    '7-8': { count: 4, seconds: 50 },
    '9-10': { count: 4, seconds: 60 },
  },
  // The six kit games (six-games brief 3.3): the count signal is slips. Mixer, Sorter, Pattern and Builder
  // copy Letter Builder's row; Number Line-up gets longer (one swap is two taps among six towers);
  // Brick Calculator counts typed answers, so its count is lower and its seconds longer.
  mixer: {
    '3-4': { count: 3, seconds: 30 },
    '5-6': { count: 3, seconds: 40 },
    '7-8': { count: 4, seconds: 50 },
    '9-10': { count: 4, seconds: 60 },
  },
  sorter: {
    '3-4': { count: 3, seconds: 30 },
    '5-6': { count: 3, seconds: 40 },
    '7-8': { count: 4, seconds: 50 },
    '9-10': { count: 4, seconds: 60 },
  },
  numbers: {
    '3-4': { count: 3, seconds: 45 },
    '5-6': { count: 3, seconds: 60 },
    '7-8': { count: 4, seconds: 75 },
    '9-10': { count: 4, seconds: 90 },
  },
  pattern: {
    '3-4': { count: 3, seconds: 30 },
    '5-6': { count: 3, seconds: 40 },
    '7-8': { count: 4, seconds: 50 },
    '9-10': { count: 4, seconds: 60 },
  },
  math: {
    '3-4': { count: 2, seconds: 45 },
    '5-6': { count: 2, seconds: 45 },
    '7-8': { count: 3, seconds: 60 },
    '9-10': { count: 3, seconds: 60 },
  },
  builder: {
    '3-4': { count: 3, seconds: 30 },
    '5-6': { count: 3, seconds: 40 },
    '7-8': { count: 4, seconds: 50 },
    '9-10': { count: 4, seconds: 60 },
  },
};

/** Brick Escape: a try fails once the moves since the last Restart reach this many times Best. */
export const TRY_OVER_FACTOR = 3;

export interface StuckState {
  /** Count signal: resets only when a puzzle starts and after a swap. */
  count: number;
  /** Time signal in seconds: resets when a puzzle starts, after a swap and on progress. */
  seconds: number;
  /** The different-puzzle offer is showing. */
  offer: boolean;
  /** Brick Escape: this try already counted its 3 times Best (once per try). */
  tryCounted: boolean;
}

export const STUCK_START: StuckState = Object.freeze({ count: 0, seconds: 0, offer: false, tryCounted: false });

export type StuckEvent =
  /** A puzzle starts (the level opens, or Next loads one). */
  | { type: 'start' }
  /** The child took a different puzzle. */
  | { type: 'swap' }
  /** One failed try or wrong tap: Brick Drop's stack reached the top, a Letter Builder wrong tap. */
  | { type: 'fail' }
  /** Brick Escape Restart: a failed try, and the next try starts. */
  | { type: 'restart' }
  /** Brick Escape: the move counter as shown (after any Undo) since the last Restart, and the board's Best. */
  | { type: 'moves'; moves: number; best: number }
  /** Progress: a brick left the board, a right tap. */
  | { type: 'progress' }
  /** Seconds on screen since the last tick. Send only while the puzzle is on screen, the page is visible and no card or sheet is open. */
  | { type: 'tick'; seconds: number };

function bump(s: StuckState, limit: StuckLimit, tryCounted: boolean): StuckState {
  const count = s.count + 1;
  // Reaching the limit shows the offer; so does each further increase once at or over it (a fresh event).
  return { ...s, count, tryCounted, offer: s.offer || count >= limit.count };
}

/**
 * The stuck signals after one event (3.1, 3.2). The offer shows when a signal reaches its limit,
 * hides on the next progress, and shows again only on a fresh event: another increase of a count
 * already at or over its limit, or the time signal reaching its limit again from 0. Once up, it stays
 * up until progress, a swap or a new puzzle.
 */
export function stuckStep(s: StuckState, e: StuckEvent, limit: StuckLimit): StuckState {
  switch (e.type) {
    case 'start':
    case 'swap':
      return STUCK_START;
    case 'fail':
      return bump(s, limit, s.tryCounted);
    case 'restart':
      return bump(s, limit, false);
    case 'moves':
      if (s.tryCounted || !(e.best > 0) || !(e.moves >= TRY_OVER_FACTOR * e.best)) return s;
      return bump(s, limit, true);
    case 'progress':
      return s.seconds === 0 && !s.offer ? s : { ...s, seconds: 0, offer: false };
    case 'tick': {
      if (!Number.isFinite(e.seconds) || e.seconds <= 0) return s;
      const seconds = s.seconds + e.seconds;
      const reached = limit.seconds !== null && s.seconds < limit.seconds && seconds >= limit.seconds;
      return { ...s, seconds, offer: s.offer || reached };
    }
  }
}

/* ---------- Stars over 4 puzzles (section 5) ---------- */

/**
 * The base thresholds: Escape on extra moves E, Letter Builder and the six kit games on slips S
 * (3 stars at or under `three`, 2 at or under `two`; six-games brief 3.2).
 */
export const LEVEL_STAR_RULES = {
  escape: { three: 4, two: 12 },
  letters: { three: 1, two: 4 },
  mixer: { three: 1, two: 4 },
  sorter: { three: 1, two: 4 },
  numbers: { three: 1, two: 4 },
  pattern: { three: 1, two: 4 },
  math: { three: 1, two: 4 },
  builder: { three: 1, two: 4 },
} as const;

export interface LevelTotals {
  /** Sum of `count`: Escape moves, Drop bricks, Letter Builder slips. */
  count: number;
  /** Sum of `par` (Escape: the four Bests). */
  par: number;
  /** Sum of `three` and `two` (Drop: T3 and T2). */
  three: number;
  two: number;
  /** Sum of `score` (Drop: the level score). */
  score: number;
  usedHint: boolean;
  outOfTime: boolean;
}

const sum = (results: readonly PuzzleResult[], k: 'count' | 'par' | 'three' | 'two' | 'score') =>
  results.reduce((t, r) => t + (Number.isFinite(r[k]) ? (r[k] as number) : 0), 0);

/** The level's totals over its solved puzzles, for its star rule and its level card. */
export function levelTotals(results: readonly PuzzleResult[]): LevelTotals {
  return {
    count: sum(results, 'count'),
    par: sum(results, 'par'),
    three: sum(results, 'three'),
    two: sum(results, 'two'),
    score: sum(results, 'score'),
    ...levelCaps(results),
  };
}

const base = (value: number, three: number, two: number) => (value <= three ? 3 : value <= two ? 2 : 1);

/** Brick Escape: extra moves E = moves minus the four Bests; E ≤ 4 is 3 stars, E ≤ 12 is 2; a hint or a counted clock caps at 2. */
export function escapeLevelStars(results: readonly PuzzleResult[]): number {
  const t = levelTotals(results);
  return capStars(base(t.count - t.par, LEVEL_STAR_RULES.escape.three, LEVEL_STAR_RULES.escape.two), t);
}

/** Brick Drop: bricks B against the sums of T3 and T2; a counted clock caps at 2. */
export function dropLevelStars(results: readonly PuzzleResult[]): number {
  const t = levelTotals(results);
  return capStars(base(t.count, t.three, t.two), t);
}

/** Letter Builder: slips S ≤ 1 is 3 stars, S ≤ 4 is 2; a hint caps at 2. */
export function lettersLevelStars(results: readonly PuzzleResult[]): number {
  const t = levelTotals(results);
  return capStars(base(t.count, LEVEL_STAR_RULES.letters.three, LEVEL_STAR_RULES.letters.two), t);
}

/**
 * The six kit games' star rule (six-games brief 3.2): Letter Builder's rule on slips, through capStars.
 * Slips S <= 1 is 3 stars, S <= 4 is 2, more is 1; a hint (Number Line-up) caps at 2.
 * slipLevelStars('mixer') is the function to pass as `stars` in recordPuzzle's rules.
 */
export function slipLevelStars(game: SlipGame): (results: readonly PuzzleResult[]) => number {
  const rule = LEVEL_STAR_RULES[game];
  return (results) => {
    const t = levelTotals(results);
    return capStars(base(t.count, rule.three, rule.two), t);
  };
}

const LEVEL_STARS: Record<RunGame, (results: readonly PuzzleResult[]) => number> = {
  escape: escapeLevelStars,
  drop: dropLevelStars,
  letters: lettersLevelStars,
  mixer: slipLevelStars('mixer'),
  sorter: slipLevelStars('sorter'),
  numbers: slipLevelStars('numbers'),
  pattern: slipLevelStars('pattern'),
  math: slipLevelStars('math'),
  builder: slipLevelStars('builder'),
};

/** A game's level stars, 1 to 3, caps included. Pass it as `stars` in the store's recordPuzzle rules. */
export function levelStars(game: RunGame, results: readonly PuzzleResult[]): number {
  return LEVEL_STARS[game](results);
}

/** Brick Drop's level score: the sum of its 4 puzzle scores. Pass it as `score` in recordPuzzle's rules. */
export function levelScore(results: readonly PuzzleResult[]): number {
  return sum(results, 'score');
}

/**
 * Brick Drop's per-puzzle brick targets (section 5): ideal = (G x C - K) / A,
 * T3 = ceil(ideal + 2.5 x C / A), T2 = ceil(ideal + 6 x C / A). With no stack (K = 0) and the stage's
 * full goal rows this is today's starRule.
 */
export function dropTargets({ goalRows, cols, filled = 0, avgCells }: { goalRows: number; cols: number; filled?: number; avgCells: number }): {
  three: number;
  two: number;
} {
  const per = cols / avgCells;
  // goalRows x per first, so with no stack the sum is today's starRule to the last bit
  const ideal = goalRows * per - filled / avgCells;
  return { three: Math.ceil(ideal + 2.5 * per), two: Math.ceil(ideal + 6 * per) };
}
