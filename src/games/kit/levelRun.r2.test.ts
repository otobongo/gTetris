/**
 * Round 2, decision 25 (kit part): once a counted hint caps the level, the Play screen marks it beside
 * the puzzle dots. `hintCappedOf` is the same condition that gives the level card its cap line: a hint
 * on the puzzle on screen, or on any solved puzzle. A hint on a puzzle that is then swapped away does
 * not cap (four-puzzle 3.3). Only Number Line-up has kit hints.
 */
import { describe, expect, it } from 'vitest';
import type { PuzzleOutcome } from '../../shared/progress';
import type { GameMeta } from '../meta';
import { SLIP_GAMES, mixerSet, numbersSet, type SlipGame } from '../run';
import { hintCappedOf, initLevelRun, levelRunReducer, type KitGame, type LevelRunAction, type LevelRunState } from './levelRun';

const NOW = new Date(2026, 10, 16, 9, 0).getTime();
const meta = (levelCount: number): GameMeta => ({ levelCount, chapters: [{ title: 'All levels', note: '', start: 0, count: levelCount }] });
const NUMBERS: KitGame<number> = {
  id: 'numbers',
  meta: meta(12),
  title: 'Number Line-up',
  set: (b) => numbersSet(b),
  seed: 'run',
  keepSolved: true,
  hints: true,
  puzzle: (_l, n) => n,
};

const open = (game: KitGame<number> = NUMBERS): LevelRunState => initLevelRun({ game, level: 0, band: '5-6', stored: null, now: NOW, newSeed: () => 99 });
const act = (s: LevelRunState, ...actions: LevelRunAction[]) => actions.reduce(levelRunReducer, s);
const IGNORED: PuzzleOutcome = { kind: 'ignored' };
const HINT: LevelRunAction = { type: 'hint', left: null };
const SOLVE: LevelRunAction = { type: 'solve', outcome: IGNORED };
const NEXT: LevelRunAction = { type: 'next' };
const SLIP: LevelRunAction = { type: 'slip' };
const SWAP: LevelRunAction = { type: 'swap', run: null };

describe('hintCappedOf (decision 25)', () => {
  it('is false before a hint and true once one is used', () => {
    const s = open();
    expect(hintCappedOf(s)).toBe(false);
    expect(hintCappedOf(act(s, HINT))).toBe(true);
  });

  it('stays true after that puzzle is solved and on the next puzzle, and to the end of the level', () => {
    const solved = act(open(), HINT, SOLVE);
    expect(solved.phase).toBe('solved');
    expect(hintCappedOf(solved)).toBe(true);
    const next = act(solved, NEXT);
    expect(next.usedHint).toBe(false);
    expect(hintCappedOf(next)).toBe(true);
    const done = act(next, SOLVE, NEXT, SOLVE, NEXT, SOLVE);
    expect(done.phase).toBe('done');
    expect(hintCappedOf(done)).toBe(true);
  });

  it('is false again after a swap away from the puzzle whose hint was the only one', () => {
    const hinted = act(open(), HINT, SLIP, SLIP, SLIP);
    expect(hintCappedOf(hinted)).toBe(true);
    expect(hinted.stuck.offer).toBe(true);
    const swapped = act(hinted, SWAP);
    expect(hintCappedOf(swapped)).toBe(false);
  });

  it('stays true after a swap when a solved puzzle used a hint', () => {
    const s = act(open(), HINT, SOLVE, NEXT, SLIP, SLIP, SLIP, SWAP);
    expect(hintCappedOf(s)).toBe(true);
  });

  it('is false for every game without hints, even with a usedHint result in the run', () => {
    for (const id of SLIP_GAMES.filter((g): g is Exclude<SlipGame, 'numbers'> => g !== 'numbers')) {
      const game: KitGame<number> = { id, meta: meta(12), title: id, set: () => mixerSet(), seed: 'fixed', puzzle: (_l, n) => n };
      const s = act(open(game), HINT, SOLVE, NEXT);
      const forged: LevelRunState = { ...s, usedHint: true, run: { ...s.run, solved: s.run.solved.map((r) => ({ ...r, usedHint: true })) } };
      expect(hintCappedOf(forged), id).toBe(false);
    }
  });
});
