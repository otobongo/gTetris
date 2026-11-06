/**
 * Fixes from the stage review (2026-11-05): stored runs keyed past the highest level index are
 * dropped, and an oversized queue or solved list is refused before any of it is read.
 */
import { describe, expect, it } from 'vitest';
import { MAX_LEVEL_INDEX, PUZZLES_PER_LEVEL } from './types';
import { cleanRun, sanitize } from './model';

const NOW = new Date(2026, 10, 5, 12, 0).getTime();

const run = (over: Record<string, unknown> = {}) => ({ set: 'escape:abc', seed: 0, queue: [0, 1, 2, 3, 4, 5], solved: [], updatedAt: NOW, ...over });

const loadRuns = (runs: Record<string, unknown>) =>
  sanitize(JSON.parse(JSON.stringify({ players: [{ id: 'a', games: { escape: { unlocked: 0, stars: {}, best: {}, runs } } }] })), NOW).players[0].games.escape;

/** An array of `length` whose items throw when read, so a test can tell whether cleanRun looked inside. */
function untouchable(length: number): unknown[] {
  const arr: unknown[] = new Array(length);
  for (let i = 0; i < length; i++)
    Object.defineProperty(arr, i, {
      get() {
        throw new Error(`item ${i} was read`);
      },
    });
  return arr;
}

describe('cleanRuns: level keys past MAX_LEVEL_INDEX', () => {
  it('keeps a run at the highest level index and drops one a level above it', () => {
    const g = loadRuns({ [String(MAX_LEVEL_INDEX)]: run(), [String(MAX_LEVEL_INDEX + 1)]: run(), '4': run() });
    expect(Object.keys(g.runs ?? {}).map(Number).sort((a, b) => a - b)).toEqual([4, MAX_LEVEL_INDEX]);
  });

  it('drops a run under a huge level key', () => {
    const g = loadRuns({ '9007199254740991': run() });
    expect(g.runs).toBeUndefined();
  });
});

describe('cleanRun: oversized lists are refused before they are read', () => {
  it('a queue longer than the level’s puzzles is refused without reading any item', () => {
    expect(cleanRun(run({ queue: untouchable(PUZZLES_PER_LEVEL + 1) }))).toBeNull();
    expect(cleanRun(run({ queue: untouchable(100_000) }))).toBeNull();
  });

  it('a solved list longer than the level’s puzzles is refused without reading any item', () => {
    expect(cleanRun(run({ queue: [0], solved: untouchable(PUZZLES_PER_LEVEL + 1) }))).toBeNull();
  });

  it('a full queue of six is still read and kept', () => {
    expect(cleanRun(run())?.queue).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
