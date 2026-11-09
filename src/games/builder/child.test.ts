/**
 * A simulated child plays every one of Picture Builder's 72 puzzle slots (six-games brief 4.6 "Content checks",
 * 3.1, 10.2): some wrong strokes first (drags and taps, wrong colours on brick squares and on squares that must stay
 * empty, erasing, laying an old wrong brick again), then every square in random order, by taps and drags. The
 * puzzle must solve on the last right brick and never before. Memory puzzles start behind the first look and get a
 * Peek on the way, with the board locked and the kit held for both.
 *
 * The test keeps its own count of what the brief says (a stroke with a wrong brick is one slip for the stuck offer;
 * it is a star slip only when it lays a wrong colour on a square that this puzzle has not seen before) and checks
 * the kit's level reducer, fed the way the Play screen feeds it, against that count.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, type AgeBand } from '../../shared/progress';
import { rng, shuffle } from '../../shared/rng';
import { initLevelRun, isTicking, levelRunReducer, type LevelRunState } from '../kit/levelRun';
import { endStroke, matchCount, newBoard, paintSquare, setLocked, startStroke, wrongCount, type Board, type Paint } from './board';
import { GAME } from './game';
import { BUILDER_COLORS, type BuilderColor } from './pictures';
import { LEVEL_COUNT, lookSeconds, makePuzzles, type BuilderPuzzle } from './puzzles';

const NOW = new Date(2026, 10, 9, 12, 0).getTime();
const RUNS_PER_PUZZLE = 24;

interface Outcome {
  problems: string[];
  /** How many paint steps solved the puzzle (must be 1). */
  solves: number;
  /** Strokes that laid a wrong brick, and the star slips the brief allows for them. */
  wrongStrokes: number;
  starSlips: number;
  /** What the kit holds at the end. */
  run: LevelRunState;
  board: Board;
}

/** Plays one puzzle as a child might, with the clock and the look handled as the Play screen handles them. */
function playLikeAChild(p: BuilderPuzzle, seed: number, band: AgeBand): Outcome {
  const rand = rng(seed);
  const pickOf = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const problems: string[] = [];
  const where = `Level ${p.level + 1} puzzle ${p.n + 1} (${p.picture.name}) seed ${seed}`;
  const squares = p.target.map((_, i) => i);
  const mismatches = (b: Board) => b.cells.filter((c, i) => c !== p.target[i]).length;

  let board = newBoard(p.target, p.mode === 'memory');
  let run = initLevelRun({ game: GAME, level: p.level, band, stored: null, now: NOW });
  let solves = 0;
  let wrongStrokes = 0;
  let starSlips = 0;
  /** Wrong bricks laid on this puzzle so far, as "square:colour". */
  const laid = new Set<string>();

  function stroke(paint: Paint, over: number[], expectSlipFree = false): void {
    board = startStroke(board, paint);
    let wrong = false;
    let fresh = false;
    for (const i of over) {
      const before = board.cells[i];
      const pending = mismatches(board);
      const wasSolved = board.solved;
      const lays: BuilderColor | null = paint === 'eraser' ? null : paint;
      const step = paintSquare(board, i);
      board = step.board;
      // The brief's count, kept apart from the module: a new wrong colour on a square is a star slip, once per stroke.
      if (!wasSolved && !board.locked && lays !== null && lays !== before && lays !== p.target[i]) {
        wrong = true;
        const key = `${i}:${lays}`;
        if (!laid.has(key)) fresh = true;
        laid.add(key);
      }
      const nowMatches = mismatches(board) === 0;
      // Solved on exactly the step that makes every square match, never before and never twice.
      if (step.result === 'solved') {
        solves++;
        if (wasSolved || pending !== 1 || !nowMatches) problems.push(`${where}: solved with ${pending} squares to go`);
        if (wrong) problems.push(`${where}: a stroke both slipped and solved`);
        run = levelRunReducer(run, { type: 'solve', outcome: { kind: 'ignored' } });
      } else if (!wasSolved && nowMatches) problems.push(`${where}: every square matches but no solve`);
      if (step.result === 'right') run = levelRunReducer(run, { type: 'progress' });
      // The match bar and the wrong line agree with the board at every step.
      const right = p.target.filter((t, j) => t !== null && board.cells[j] === t).length;
      const bad = board.cells.filter((c, j) => c !== null && c !== p.target[j]).length;
      if (matchCount(board).right !== right || matchCount(board).total !== p.bricks) problems.push(`${where}: match count off`);
      if (wrongCount(board) !== bad) problems.push(`${where}: wrong count off`);
    }
    const end = endStroke(board);
    board = end.board;
    if (wrong) wrongStrokes++;
    if (fresh) starSlips++;
    if ((end.slip !== null) !== wrong) problems.push(`${where}: stroke ${wrong ? 'laid a wrong brick but gave no slip' : 'gave a slip with no wrong brick'}`);
    if (expectSlipFree && end.slip !== null) problems.push(`${where}: a stroke of right bricks slipped`);
    if (end.slip !== null) run = levelRunReducer(run, { type: 'slip', key: end.slip });
  }

  /** A look (the first one or a Peek): the board locks, the kit holds, a tap on the board does nothing. */
  function look(seconds: number): void {
    board = setLocked(board, true);
    run = levelRunReducer(run, { type: 'hold', on: true });
    const counted = run.stuck.seconds;
    const cells = board.cells;
    stroke(pickOf(BUILDER_COLORS), [pickOf(squares), pickOf(squares)]);
    if (board.cells !== cells && board.cells.some((c, i) => c !== cells[i])) problems.push(`${where}: painted during a look`);
    if (isTicking(run)) problems.push(`${where}: the clock runs during a look`);
    run = levelRunReducer(run, { type: 'tick', seconds: seconds + 30 });
    if (run.stuck.seconds !== counted || run.stuck.offer) problems.push(`${where}: a look counted toward the offer`);
    board = setLocked(board, false);
    run = levelRunReducer(run, { type: 'hold', on: false });
  }

  if (p.mode === 'memory') {
    if (!board.locked) problems.push(`${where}: a memory puzzle starts unlocked`);
    look(lookSeconds(band, 'first'));
  }

  // Some wrong strokes first: wrong colours (on brick squares and on squares that stay empty), the eraser, old wrong bricks again.
  const tries = 1 + Math.floor(rand() * 5);
  for (let t = 0; t < tries; t++) {
    const kind = rand();
    if (kind < 0.55) {
      const paint = pickOf(BUILDER_COLORS);
      const wrongFor = squares.filter((i) => p.target[i] !== paint);
      const length = 1 + Math.floor(rand() * 3);
      stroke(paint, Array.from({ length }, () => pickOf(wrongFor)));
    } else if (kind < 0.75) {
      stroke('eraser', Array.from({ length: 1 + Math.floor(rand() * 3) }, () => pickOf(squares)));
    } else if (laid.size > 0) {
      const [i, color] = pickOf([...laid]).split(':');
      const at = Number(i);
      if (board.cells[at] === color) stroke('eraser', [at]);
      stroke(color as BuilderColor, [at]);
    }
    if (p.mode === 'memory' && t === 0) look(lookSeconds(band, 'peek'));
  }
  if (board.solved || solves > 0) problems.push(`${where}: solved by wrong strokes alone`);

  // Then every square in random order: taps, or drags over the next squares that need the same paint.
  const order = shuffle(squares, rand);
  const need = (i: number): Paint => p.target[i] ?? 'eraser';
  for (let k = 0; k < order.length; ) {
    const paint = need(order[k]);
    const over = [order[k++]];
    if (rand() < 0.5) while (k < order.length && need(order[k]) === paint && rand() < 0.8) over.push(order[k++]);
    stroke(paint, over, true);
  }

  if (!board.solved) problems.push(`${where}: not solved after every square`);
  if (run.phase !== 'solved') problems.push(`${where}: the kit is in ${run.phase}, not solved`);
  return { problems, solves, wrongStrokes, starSlips, run, board };
}

const LEVEL_IDS = Array.from({ length: LEVEL_COUNT }, (_, l) => l);

describe('a simulated child solves every puzzle on the last right brick and never before (4.6)', () => {
  LEVEL_IDS.forEach((l) => {
    it(`Level ${l + 1}, every puzzle over ${RUNS_PER_PUZZLE} plays across the four age bands`, () => {
      const problems: string[] = [];
      for (const p of makePuzzles(l))
        for (let r = 0; r < RUNS_PER_PUZZLE; r++) {
          const seed = l * 1000 + p.n * 100 + r;
          const out = playLikeAChild(p, seed, AGE_BANDS[r % AGE_BANDS.length]);
          problems.push(...out.problems);
          if (out.solves !== 1) problems.push(`Level ${l + 1} puzzle ${p.n + 1} seed ${seed}: solved ${out.solves} times`);
        }
      expect(problems.slice(0, 10)).toEqual([]);
    });
  });

  it('counts one slip per wrong stroke for the stuck offer, and star slips only for new wrong bricks', () => {
    const problems: string[] = [];
    let wrongStrokes = 0;
    let repeats = 0;
    for (const l of LEVEL_IDS)
      for (const p of makePuzzles(l))
        for (let r = 0; r < RUNS_PER_PUZZLE; r++) {
          const out = playLikeAChild(p, 7 + l * 1000 + p.n * 100 + r, AGE_BANDS[(r + 1) % AGE_BANDS.length]);
          const where = `Level ${l + 1} puzzle ${p.n + 1} run ${r}`;
          if (out.run.stuck.count !== out.wrongStrokes) problems.push(`${where}: stuck count ${out.run.stuck.count}, want ${out.wrongStrokes}`);
          if (out.run.slips !== out.starSlips) problems.push(`${where}: star slips ${out.run.slips}, want ${out.starSlips}`);
          if (out.run.run.solved[0]?.count !== out.starSlips) problems.push(`${where}: recorded ${out.run.run.solved[0]?.count} slips, want ${out.starSlips}`);
          wrongStrokes += out.wrongStrokes;
          repeats += out.wrongStrokes - out.starSlips;
        }
    expect(problems.slice(0, 10)).toEqual([]);
    // The plays did lay wrong bricks, and laid some of them again, so both rules were really exercised.
    expect(wrongStrokes).toBeGreaterThan(1000);
    expect(repeats).toBeGreaterThan(100);
  });

  it('plays the same way for the same seed: the board and the kit end up the same', () => {
    const p = makePuzzles(11)[2];
    const a = playLikeAChild(p, 99, '7-8');
    const b = playLikeAChild(p, 99, '7-8');
    expect(a.board).toEqual(b.board);
    expect(a.run.slips).toBe(b.run.slips);
    expect(a.run.stuck.count).toBe(b.run.stuck.count);
  });
});
