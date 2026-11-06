/**
 * The game kit's level reducer (six-games brief 3.1): one level of a kit game, from its start to the
 * level card. The puzzle on screen, the band frozen for it (D2), slips and their keys, the stuck
 * signals (run.ts stuckStep and STUCK), solve, swap, next, the hint budget and the level's end.
 *
 * Pure: no React, no DOM and no store writes, so Vitest runs it in node. The hook (useLevelRun.ts)
 * talks to the progress store and passes what the store answered into the actions here; a null
 * answer (no player to save to) makes the reducer carry on in memory, as the built games do.
 * Time comes in as `tick` actions and `now` values, so tests drive the clock.
 */
import {
  HINTS_PER_RUN,
  SOLVES_PER_LEVEL,
  resolveRun,
  type AgeBand,
  type LevelRun,
  type PuzzleOutcome,
  type PuzzleResult,
  type RunInit,
} from '../../shared/progress';
import type { LevelCardProps } from '../../shared/ui/LevelCard';
import type { GameMeta } from '../meta';
import { STUCK, STUCK_START, levelStars, puzzleOnScreen, rotateQueue, stuckStep, type RunGame, type StuckLimit, type StuckState } from '../run';

/* ---------- The fixed API (brief 3.1): games build against these two ---------- */

/** What a kit game hands the kit: its id, registry meta, title, puzzle set and puzzle maker. */
export interface KitGame<P> {
  id: RunGame;
  meta: GameMeta;
  title: string;
  /** 'mixer:1', or 'numbers:1:5-6' when content depends on the band. */
  set: (band: AgeBand) => string;
  /** 'run': a new random seed per run, stored in it; 'fixed': 0. */
  seed: 'run' | 'fixed';
  /** numbers and math: a band change keeps solved puzzles. */
  keepSolved?: boolean;
  /** numbers only: 3 per level through spendHint. */
  hints?: boolean;
  /** Puzzle `n` (0 to 5) of 0-based `level`. Throws when either is out of range. */
  puzzle: (level: number, n: number, ctx: { seed: number; band: AgeBand }) => P;
}

/** What useLevelRun gives a game's Play screen. */
export interface LevelRunApi<P> {
  phase: 'play' | 'solved' | 'done';
  /** 0-based level; the title reads "Level {level + 1}". */
  level: number;
  /** The puzzle on screen, 0 to 5. It stays the solved one until Next. */
  puzzleNo: number;
  puzzle: P;
  /** Frozen for the puzzle on screen: a band changed in Settings applies from the next puzzle. */
  band: AgeBand;
  /** For PuzzleDots: `solved` is its `solved`, `at` its `puzzle` (1 to 4). */
  dots: { solved: number; at: number };
  offer: boolean;
  /** Which shared line the help row shows instead of the game's own. */
  shared: 'offer' | 'swapped' | null;
  /** Always feeds the stuck count; a key seen before on this puzzle adds no star slip. */
  slip(key?: string): void;
  /** Resets the time signal. */
  progress(): void;
  /** No time counts while on: Picture Builder's first look and each Peek. */
  hold(on: boolean): void;
  /** PuzzleResult { count: slips, usedHint, outOfTime: false }; ignored unless phase is 'play'. */
  solve(): void;
  /** Each ignored outside its phase, so a double tap acts once. */
  swap(): void;
  next(): void;
  hint: { left: number; use(): void } | null;
  card: LevelCardProps | null;
  /*
   * Additions beyond the brief's block (nothing in it changed):
   * `round` goes up whenever a new puzzle starts (Next, a swap), so a Play screen can key its body on it.
   * `finish` is the level's result once the fourth puzzle is solved.
   * `slot` says what the controls slot holds: the game's controls, Next puzzle, the level card's Play
   * Level button (after the card is closed with Escape or the scrim), Back to games, or nothing.
   */
  round: number;
  finish: LevelFinish | null;
  slot: ControlsSlot;
}

/* ---------- State ---------- */

/** The level's result after its fourth solve. `next` is the level Play Level opens, null when the game is finished. */
export interface LevelFinish {
  stars: number;
  next: number | null;
  results: PuzzleResult[];
}

/**
 * What the controls slot holds (four-puzzle 2.1, 10):
 * 'controls' the game's own; 'next' Next puzzle; 'empty' nothing (the 600 ms before the level card,
 * and behind it); 'play' the Play Level button, once the card was closed; 'home' Back to games.
 */
export type ControlsSlot = 'controls' | 'next' | 'empty' | 'play' | 'home';

/** The level card: waiting out LEVEL_CARD_DELAY_MS, open, or closed with Escape or the scrim. */
export type CardState = 'waiting' | 'open' | 'closed';

/** The parts of a KitGame the reducer needs, plus the level. */
export interface LevelRunConfig {
  game: RunGame;
  level: number;
  levelCount: number;
  set: (band: AgeBand) => string;
  seed: 'run' | 'fixed';
  keepSolved: boolean;
  hints: boolean;
}

export interface LevelRunState {
  cfg: LevelRunConfig;
  /** The run as the kit knows it: the stored one, or the one kept in memory when nothing is saved. */
  run: LevelRun;
  /** The band the puzzle on screen started with. */
  band: AgeBand;
  /** The puzzle on screen. After a solve it stays, while run.queue already points at the next one. */
  puzzleNo: number;
  phase: 'play' | 'solved' | 'done';
  /** Goes up on every new puzzle (Next, a swap, a stored run that moved the puzzle). */
  round: number;
  /** Star slips on this puzzle: each key counts once. */
  slips: number;
  /** Wrong keys already given on this puzzle. */
  wrongKeys: readonly string[];
  /** A hint used on this puzzle (caps the level only if this puzzle is solved). */
  usedHint: boolean;
  /** The level's hint budget; 0 for games without hints. */
  hintsLeft: number;
  stuck: StuckState;
  /** "Here is a different puzzle." shows until the next slip, progress, hint or solve. */
  swapped: boolean;
  /** hold(true): Picture Builder's look or Peek. */
  held: boolean;
  /** The page is visible. */
  visible: boolean;
  finish: LevelFinish | null;
  card: CardState | null;
  /** Play Level was tapped: the level is on its way out and takes no more actions. */
  leaving: boolean;
}

export type LevelRunAction =
  /** A wrong answer. `key` names it (the pair, the hole, the car) so a repeat adds no star slip. */
  | { type: 'slip'; key?: string }
  /** The game's progress (3.3): resets the time signal and hides the offer. */
  | { type: 'progress' }
  | { type: 'hold'; on: boolean }
  /** The page became visible or hidden. */
  | { type: 'visible'; on: boolean }
  /** Seconds on screen since the last tick. Counted only while isTicking(state). */
  | { type: 'tick'; seconds: number }
  /** A hint spent: what spendHint answered (the hints left), or null to count down in memory. */
  | { type: 'hint'; left: number | null }
  /** The puzzle on screen is solved: what recordPuzzle answered for solveResult(state). */
  | { type: 'solve'; outcome: PuzzleOutcome }
  /** Next puzzle, from 'solved'. `band` when the band changed since the puzzle started (bandInit). */
  | { type: 'next'; band?: BandChange }
  /** A different puzzle, from 'play': what swapPuzzle answered, or null to rotate in memory. */
  | { type: 'swap'; run: LevelRun | null; band?: BandChange }
  /** The store's copy of the run once the level opened (startRun), when it differs from the one shown. */
  | { type: 'stored'; run: LevelRun }
  | { type: 'card'; to: 'open' | 'closed' }
  /** Play Level or Back to games was tapped. */
  | { type: 'leave' };

/** A band change at a puzzle boundary: the new band and the run startRun saved for it (null: resolve in memory). */
export interface BandChange {
  band: AgeBand;
  run: LevelRun | null;
  now: number;
}

/* ---------- Building blocks ---------- */

export function configFor(game: KitGame<unknown>, level: number): LevelRunConfig {
  return {
    game: game.id,
    level,
    levelCount: game.meta.levelCount,
    set: game.set,
    seed: game.seed,
    keepSolved: game.keepSolved === true,
    hints: game.hints === true,
  };
}

/** A fresh run seed: a non-negative 31-bit integer, as sanitize accepts. */
export const randomSeed = (): number => (Math.random() * 2 ** 31) | 0;

/** What the kit passes to startRun and recordPuzzle for a band: the set, the seed, the hint budget, keepSolved. */
export function runInit(cfg: LevelRunConfig, band: AgeBand, seed: number): RunInit {
  const init: RunInit = { set: cfg.set(band), seed: cfg.seed === 'fixed' ? 0 : seed };
  if (cfg.hints) init.hintsLeft = HINTS_PER_RUN;
  if (cfg.keepSolved) init.keepSolved = true;
  return init;
}

/**
 * The seed a level opens with: 0 for fixed sets; for run-seeded games the stored run's seed when that
 * run continues (same set, or a keepSolved band move), otherwise a new one.
 */
export function openingSeed(cfg: LevelRunConfig, band: AgeBand, stored: LevelRun | null, newSeed: () => number = randomSeed): number {
  if (cfg.seed === 'fixed') return 0;
  if (stored && (stored.set === cfg.set(band) || cfg.keepSolved)) return stored.seed;
  return newSeed();
}

/** The stuck limits for the band on screen. */
export const stuckLimit = (s: Pick<LevelRunState, 'cfg' | 'band'>): StuckLimit => STUCK[s.cfg.game][s.band];

const freshPuzzle = (s: LevelRunState, run: LevelRun, band: AgeBand): LevelRunState => ({
  ...s,
  run,
  band,
  puzzleNo: puzzleOnScreen(run),
  phase: 'play',
  round: s.round + 1,
  slips: 0,
  wrongKeys: [],
  usedHint: false,
  stuck: STUCK_START,
});

export interface OpenLevel {
  game: KitGame<unknown>;
  level: number;
  /** The child's band now (Letter Builder's default '5-6' when there is no player). */
  band: AgeBand;
  /** The stored run for this level, or null. */
  stored: LevelRun | null;
  now: number;
  newSeed?: () => number;
  /** Whether the page is visible now; defaults to true. */
  visible?: boolean;
}

/** A level opens: a stored run resumes at its next unsolved puzzle, otherwise a new run starts at puzzle 1. */
export function initLevelRun({ game, level, band, stored, now, newSeed = randomSeed, visible = true }: OpenLevel): LevelRunState {
  const cfg = configFor(game, level);
  const run = resolveRun(stored, runInit(cfg, band, openingSeed(cfg, band, stored, newSeed)), now);
  return {
    cfg,
    run,
    band,
    puzzleNo: puzzleOnScreen(run),
    phase: 'play',
    round: 0,
    slips: 0,
    wrongKeys: [],
    usedHint: false,
    hintsLeft: cfg.hints ? (run.hintsLeft ?? HINTS_PER_RUN) : 0,
    stuck: STUCK_START,
    swapped: false,
    held: false,
    visible,
    finish: null,
    card: null,
    leaving: false,
  };
}

/* ---------- Selectors ---------- */

/** The result the solve records: slips in `count`, the hint on this puzzle, never out of time. */
export function solveResult(s: LevelRunState): PuzzleResult {
  return { puzzle: s.puzzleNo, count: s.slips, usedHint: s.usedHint, outOfTime: false };
}

/** The time signal runs only while a puzzle is in play, the page is visible, no card is open and nothing holds it. */
export function isTicking(s: LevelRunState): boolean {
  return s.phase === 'play' && !s.leaving && s.visible && !s.held && s.card !== 'open' && stuckLimit(s).seconds !== null;
}

export const offerShows = (s: LevelRunState): boolean => s.phase === 'play' && !s.leaving && s.stuck.offer;

export function sharedLine(s: LevelRunState): 'offer' | 'swapped' | null {
  if (offerShows(s)) return 'offer';
  return s.phase === 'play' && s.swapped ? 'swapped' : null;
}

/** The dots: a swap leaves them alone; right after a solve the solved dot stays the wide one. */
export function dotsOf(s: LevelRunState): { solved: number; at: number } {
  if (s.phase === 'done') return { solved: SOLVES_PER_LEVEL, at: SOLVES_PER_LEVEL };
  const solved = s.run.solved.length;
  return { solved, at: s.phase === 'solved' ? Math.max(1, solved) : Math.min(SOLVES_PER_LEVEL, solved + 1) };
}

export function slotOf(s: LevelRunState): ControlsSlot {
  if (s.phase === 'play') return 'controls';
  if (s.phase === 'solved') return 'next';
  if (s.card !== 'closed' || !s.finish) return 'empty';
  return s.finish.next === null ? 'home' : 'play';
}

/**
 * When the child's band (`live`) differs from the one on screen: the RunInit to pass to startRun for the
 * new band at the next puzzle boundary. Null when nothing changed.
 */
export function bandInit(s: LevelRunState, live: AgeBand | null | undefined): RunInit | null {
  if (!live || live === s.band) return null;
  return runInit(s.cfg, live, s.run.seed);
}

/* ---------- The reducer ---------- */

const moveBand = (s: LevelRunState, run: LevelRun, change: BandChange | undefined): { run: LevelRun; band: AgeBand } => {
  if (!change || change.band === s.band) return { run, band: s.band };
  // keepSolved keeps the solved puzzles and re-fills the rest from the new band; otherwise a set change restarts the level
  const moved = change.run ?? resolveRun(run, runInit(s.cfg, change.band, run.seed), change.now);
  return { run: moved, band: change.band };
};

function solved(s: LevelRunState, outcome: PuzzleOutcome): LevelRunState {
  const result = solveResult(s);
  const inMemory = (): LevelRun => ({ ...s.run, queue: s.run.queue.filter((n) => n !== result.puzzle), solved: [...s.run.solved, result] });
  let finish: LevelFinish | null = null;
  let run: LevelRun;
  if (outcome.kind === 'finished') {
    finish = { stars: outcome.stars, next: outcome.next, results: outcome.results };
    run = inMemory();
  } else if (outcome.kind === 'saved') {
    run = outcome.run;
  } else {
    // 'ignored' (no player to save to): the level goes on in memory and nothing is saved
    run = inMemory();
    if (run.solved.length >= SOLVES_PER_LEVEL) {
      const next = s.cfg.level + 1 < s.cfg.levelCount ? s.cfg.level + 1 : null;
      finish = { stars: levelStars(s.cfg.game, run.solved), next, results: run.solved };
    }
  }
  const base = { ...s, run, swapped: false, stuck: { ...s.stuck, offer: false } };
  return finish ? { ...base, phase: 'done', finish, card: 'waiting' } : { ...base, phase: 'solved' };
}

export function levelRunReducer(s: LevelRunState, a: LevelRunAction): LevelRunState {
  const playing = s.phase === 'play' && !s.leaving;
  switch (a.type) {
    case 'slip': {
      if (!playing) return s;
      const stuck = stuckStep(s.stuck, { type: 'fail' }, stuckLimit(s));
      const seen = a.key !== undefined && s.wrongKeys.includes(a.key);
      return {
        ...s,
        stuck,
        swapped: false,
        slips: seen ? s.slips : s.slips + 1,
        wrongKeys: a.key === undefined || seen ? s.wrongKeys : [...s.wrongKeys, a.key],
      };
    }
    case 'progress': {
      if (!playing) return s;
      const stuck = stuckStep(s.stuck, { type: 'progress' }, stuckLimit(s));
      return stuck === s.stuck && !s.swapped ? s : { ...s, stuck, swapped: false };
    }
    case 'hold':
      return s.held === a.on ? s : { ...s, held: a.on };
    case 'visible':
      return s.visible === a.on ? s : { ...s, visible: a.on };
    case 'tick': {
      if (!isTicking(s)) return s;
      const stuck = stuckStep(s.stuck, { type: 'tick', seconds: a.seconds }, stuckLimit(s));
      return stuck === s.stuck ? s : { ...s, stuck };
    }
    case 'hint': {
      if (!playing || !s.cfg.hints || s.hintsLeft <= 0) return s;
      const left = a.left === null ? s.hintsLeft - 1 : a.left;
      return { ...s, hintsLeft: Math.max(0, Math.min(s.hintsLeft - 1, left)), usedHint: true, swapped: false };
    }
    case 'solve':
      return playing ? solved(s, a.outcome) : s;
    case 'next': {
      if (s.phase !== 'solved' || s.leaving) return s;
      const moved = moveBand(s, s.run, a.band);
      return { ...freshPuzzle(s, moved.run, moved.band), swapped: false };
    }
    case 'swap': {
      if (!playing) return s;
      const rotated = a.run ?? { ...s.run, queue: rotateQueue(s.run.queue) };
      const moved = moveBand(s, rotated, a.band);
      return { ...freshPuzzle(s, moved.run, moved.band), stuck: stuckStep(s.stuck, { type: 'swap' }, stuckLimit(s)), swapped: true };
    }
    case 'stored': {
      if (!playing) return s;
      const same = a.run.set === s.run.set && a.run.seed === s.run.seed && a.run.queue.join() === s.run.queue.join() && a.run.solved.length === s.run.solved.length;
      if (same) return a.run === s.run ? s : { ...s, run: a.run };
      const hintsLeft = s.cfg.hints ? (a.run.hintsLeft ?? s.hintsLeft) : 0;
      if (puzzleOnScreen(a.run) === s.puzzleNo && a.run.seed === s.run.seed) return { ...s, run: a.run, hintsLeft };
      return { ...freshPuzzle(s, a.run, s.band), hintsLeft, swapped: false };
    }
    case 'card': {
      if (s.phase !== 'done' || s.card === null || s.card === a.to) return s;
      if (a.to === 'closed' && s.card === 'waiting') return s;
      return { ...s, card: a.to };
    }
    case 'leave':
      return s.leaving ? s : { ...s, leaving: true };
  }
}
