/**
 * Brick Drop's four-puzzle stages (brief 4.2, 5, 9): what one puzzle is, its goal and brick targets,
 * the round state machine (the first brick waits for the first press, and the clock with it), and the
 * lines the play screen shows. Pure, except stageSticker, which writes through the store it is handed;
 * Play.tsx wires it to the screen and the progress store.
 */
import { STICKERS, stickerCells, stickersDue } from '../../screens/logic/stickers';
import type { AgeBand, ProgressStore, PuzzleResult, PuzzleRules } from '../../shared/progress';
import type { BrickColor } from '../../shared/ui/palette';
import { capRule } from '../stars';
import { dropLevelStars, dropSet, dropTargets, levelScore, levelTotals } from '../run';
import { applyAction, type Action } from './controls';
import { newGame, step, type GameState, type Rules } from './engine';
import { PIECES } from './pieces';
import { STAGES, averageCells, newPieces } from './stages';
import { starterBoard, starterFor } from './starters';

/** From Stage 6 (index 5) each puzzle clears half the stage's goal rows, rounded up (decision 9). */
export const HALF_GOAL_FROM = 5;

/** Rows one puzzle clears: 3, 4, 5, 6, 6, then 4, 4, 5, 5, 5, 6, 8. Starter rows count when they clear. */
export function puzzleGoalRows(index: number): number {
  const g = STAGES[index].goalRows;
  return index < HALF_GOAL_FROM ? g : Math.ceil(g / 2);
}

/**
 * How much slower bricks fall and lock at each age band (decision 9): 1.6 times at ages 3 to 4, 1.3 at 5 to 6,
 * and the stage's own speed from 7. Star targets count bricks, so the stars and the set stay as they are.
 */
export const BAND_SPEED: Readonly<Record<AgeBand, number>> = { '3-4': 1.6, '5-6': 1.3, '7-8': 1, '9-10': 1 };

/**
 * The engine rules of one puzzle: the stage's board and bricks, its speed and lock delay slowed for the band
 * (whole ms), and the per-puzzle goal. With no band, ages 7 to 8, which is the stage as set.
 */
export function puzzleRules(index: number, band: AgeBand = '7-8'): Rules {
  const { cols, rows, pieces, gravityMs, lockDelayMs } = STAGES[index];
  const k = BAND_SPEED[band];
  return { cols, rows, pieces, gravityMs: Math.round(gravityMs * k), lockDelayMs: Math.round(lockDelayMs * k), goalRows: puzzleGoalRows(index) };
}

/** One puzzle's 3-star and 2-star brick counts T3 and T2 (section 5), with its starter stack. */
export function puzzleTargets(index: number, puzzle: number): { three: number; two: number } {
  const stage = STAGES[index];
  return dropTargets({ goalRows: puzzleGoalRows(index), cols: stage.cols, filled: starterFor(index, puzzle).filled, avgCells: averageCells(stage) });
}

/** A puzzle's game at its start: the starter stack drawn and the first brick at the top, in its fixed brick order. */
export function puzzleGame(index: number, puzzle: number, band: AgeBand = '7-8'): GameState {
  const s = starterFor(index, puzzle);
  return newGame(puzzleRules(index, band), s.bagSeed, starterBoard(s));
}

/** The run a stage keeps in the progress store. Raise `dropSet`'s version whenever the puzzle rules change. */
export const RUN_INIT = { set: dropSet(), seed: 0 } as const;

/** Store rules for recordPuzzle: the level's stars over its 4 puzzles and its score (the sum of 4). */
export function runRules(): PuzzleRules {
  return { ...RUN_INIT, levelCount: STAGES.length, stars: dropLevelStars, score: levelScore };
}

/** What one solved puzzle stores: bricks used, its targets, its score and whether a counted clock ran out. */
export function puzzleResult(index: number, puzzle: number, game: Pick<GameState, 'placed' | 'score'>, outOfTime: boolean): PuzzleResult {
  const t = puzzleTargets(index, puzzle);
  return { puzzle, count: game.placed, three: t.three, two: t.two, score: game.score, usedHint: false, outOfTime };
}

/* ---------- The round: waiting, playing, paused, solved, out of room ---------- */

export type Phase = 'intro' | 'ready' | 'playing' | 'paused' | 'solved' | 'over';

export interface Round {
  index: number;
  puzzle: number;
  phase: Phase;
  /** The age band the puzzle started with: it sets the fall speed until the next puzzle (decision 9). */
  band: AgeBand;
  game: GameState;
  /** Time on the puzzle's clock, counted only while it is being played. */
  elapsedMs: number;
}

/** A puzzle's start (brief 4.2): stack drawn, first brick hanging at the top, nothing falling, clock at 0. */
export function newRound(index: number, puzzle: number, phase: 'intro' | 'ready' = 'ready', band: AgeBand = '7-8'): Round {
  return { index, puzzle, phase, band, game: puzzleGame(index, puzzle, band), elapsedMs: 0 };
}

/**
 * Try again (user decision D1): the same puzzle from its first stack with its first brick waiting, and the
 * clock where it was. Only the bricks go back, so a counted clock that ran out still caps the stage. The
 * band stays too, so the bricks fall at the speed the puzzle started with.
 */
export function retryRound(r: Round): Round {
  return { ...newRound(r.index, r.puzzle, 'ready', r.band), elapsedMs: r.elapsedMs };
}

/** Time passes: only a round being played falls, locks and counts time. A waiting, paused or ended round stays as it is. */
export function tickRound(r: Round, dt: number): Round {
  if (r.phase !== 'playing' || !(dt > 0)) return r;
  return { ...r, game: step(r.game, dt), elapsedMs: r.elapsedMs + dt };
}

/** A press of a control (or a tap on the board). The first press starts a waiting round and also does its own action. */
export function pressRound(r: Round, a: Action): Round {
  if (r.phase !== 'ready' && r.phase !== 'playing') return r;
  const game = applyAction(r.game, a);
  if (r.phase === 'ready') return { ...r, phase: 'playing', game };
  return game === r.game ? r : { ...r, game };
}

/* ---------- Lines (brief 9.1) ---------- */

/** "A", "A and B", "A, B and C". */
function names(list: string[]): string {
  return list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** The line under "Press any button to start." when the stage adds a brick: "New brick: Zig." */
export function newBrickLine(index: number): string {
  const added = newPieces(index).map((id) => PIECES[id].name);
  if (!added.length) return '';
  return `${added.length === 1 ? 'New brick' : 'New bricks'}: ${names(added)}.`;
}

/** The help lines while the first brick waits: the swap line once after a swap, the start line, the new brick. */
export function readyLines(index: number, swapped: boolean): string[] {
  return [swapped ? 'Here is a different puzzle.' : '', 'Press any button to start.', newBrickLine(index)].filter(Boolean);
}

export const solvedLine = (bricks: number) => `Cleared with ${bricks} ${bricks === 1 ? 'brick' : 'bricks'}.`;

export const overLine = (cleared: number, goal: number) => `The bricks reached the top. You cleared ${cleared} of ${goal} rows.`;

export const STUCK_LINE = 'This one is tricky. You can try a different puzzle.';

/** The help line while paused (decision 11): any pad press, board tap or game key carries on. */
export const PAUSED_LINE = 'Paused. Press any button to play.';

/** The help line's message for a phase: the waiting brick, paused, or the result. Row-clear words come on top of these. */
export function helpLines(phase: Phase, index: number, swapped: boolean, placed: number): string[] {
  if (phase === 'ready') return readyLines(index, swapped);
  if (phase === 'paused') return [PAUSED_LINE];
  if (phase === 'solved') return [solvedLine(placed)];
  return [];
}

/** What the play screen's speaker says (decision 17): the lines on screen, or with none, the goal and the controls. */
export function playSpoken(lines: readonly string[], goal: number, controls: string): string {
  if (lines.length) return lines.join(' ');
  return `Clear ${goal} ${goal === 1 ? 'row' : 'rows'}. ${controls}`;
}

/** The intro sheet (brief 9.1): the per-puzzle goal, the level's 3-star rule over 4 puzzles, the clock cap when it counts. */
export function introLines(index: number, clock: boolean): string[] {
  const three = 4 * puzzleTargets(index, 0).three;
  return [
    `Clear ${puzzleGoalRows(index)} rows in each puzzle. Solve 4 to finish the stage.`,
    `3 stars: ${three} bricks or fewer over the 4 puzzles.`,
    clock ? capRule({ clock: true }, 'stage') : '',
  ].filter(Boolean);
}

/** What the intro card's speaker says (decision 17): the card's lines, then its controls line. */
export function introSpoken(index: number, clock: boolean, controls: string): string {
  return [...introLines(index, clock), controls].join(' ');
}

export interface CardText {
  title: string;
  fact: string;
  rule?: string;
  cap?: string;
}

/** The level card after a stage's fourth puzzle (brief 9.1). */
export function stageCard(index: number, results: readonly PuzzleResult[]): CardText {
  const t = levelTotals(results);
  return {
    title: `You finished Stage ${index + 1}`,
    fact: `4 puzzles with ${t.count} bricks. Score ${t.score}.`,
    rule: `3 stars: ${t.three} bricks or fewer. 2 stars: ${t.two} or fewer.`,
    cap: t.outOfTime ? capRule({ clock: true }, 'stage') : undefined,
  };
}

/** The card once every stage has stars (brief 2.5, 9.1). */
export function gameDoneCard(stars: number): CardText {
  return { title: 'You finished every stage!', fact: `${STAGES.length} stages, ${stars} of ${STAGES.length * 3} stars.` };
}

export const GAME_DONE_NOTE = 'A grown-up can pick a stage to play again.';

/* ---------- The stage card's sticker (decision 19) ---------- */

/** The new sticker on the stage card: its name and its 25 mosaic squares, row by row. */
export interface CardSticker {
  name: string;
  cells: (BrickColor | null)[];
}

/**
 * When a stage finishes: give Brick Drop's stickers that are now due to `playerId`, and return the first one
 * for the stage card. Run it once, after the fourth solve is saved; afterwards stickersDue no longer lists
 * them, so keep what it returns. Other games' stickers stay for Home and the sticker book to give.
 */
export function stageSticker(store: Pick<ProgressStore, 'getState' | 'awardSticker'>, playerId: string | null | undefined): CardSticker | undefined {
  const player = playerId ? (store.getState().players.find((p) => p.id === playerId) ?? null) : null;
  if (!player) return undefined;
  const mine = stickersDue(player).filter((id) => STICKERS.find((s) => s.id === id)?.game === 'drop');
  for (const id of mine) store.awardSticker(id, player.id);
  const first = STICKERS.find((s) => s.id === mine[0]);
  return first ? { name: first.name, cells: stickerCells(first) } : undefined;
}
