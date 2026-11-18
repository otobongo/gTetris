/**
 * Usability round 2, decision 10 (older-bands-start), start-level part: a child of an older age band who has
 * never played a game starts at that game's band start level. The rule lives inside currentLevel and
 * isLevelOpen (four-puzzle brief 2.6), so every screen that names the current level agrees.
 */
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, emptyGame, type AgeBand, type GameProgress, type LevelRun } from '../shared/progress';
import { currentLevel, isLevelOpen, type GameMeta } from './meta';
import { getGame } from './registry';

const run = (over: Partial<LevelRun> = {}): LevelRun => ({ set: 'x:1', seed: 0, queue: [1, 2, 3, 4, 5], solved: [], updatedAt: 1, ...over });
const game = (over: Partial<GameProgress> = {}): GameProgress => ({ ...emptyGame(), ...over });
const solvedOne = run({ solved: [{ puzzle: 0, count: 3, usedHint: false, outOfTime: false }] });

/** Ten levels in two chapters, with a start level for 7-8 (Level 4) and 9-10 (Level 7). */
const META: GameMeta = {
  levelCount: 10,
  chapters: [
    { title: 'A', note: '', start: 0, count: 5 },
    { title: 'B', note: '', start: 5, count: 5 },
  ],
  bandStart: { '7-8': 3, '9-10': 6 },
};

describe('currentLevel with a band start', () => {
  it('a child who never played the game starts at the band start', () => {
    expect(currentLevel(META, game(), '9-10')).toBe(6);
    expect(currentLevel(META, game(), '7-8')).toBe(3);
  });

  it('a band with no start, or no band at all, keeps Level 1', () => {
    expect(currentLevel(META, game(), '3-4')).toBe(0);
    expect(currentLevel(META, game(), '5-6')).toBe(0);
    expect(currentLevel(META, game(), null)).toBe(0);
    expect(currentLevel(META, game(), undefined)).toBe(0);
    expect(currentLevel(META, game())).toBe(0);
  });

  it('a child part way through the start level stays on it', () => {
    expect(currentLevel(META, game({ runs: { 6: solvedOne } }), '9-10')).toBe(6);
    expect(currentLevel(META, game({ runs: { 6: run() } }), '9-10')).toBe(6);
  });

  it('a stored current wins: a finish or a grown-up pick', () => {
    // Level 7 finished: recordPuzzle stores Level 8 as current.
    expect(currentLevel(META, game({ stars: { 6: 2 }, unlocked: 7, current: 7 }), '9-10')).toBe(7);
    // A grown-up picked Level 2 before the child played.
    expect(currentLevel(META, game({ current: 1, unlocked: 1 }), '9-10')).toBe(1);
  });

  it('a child with a star anywhere in the game keeps today’s rule', () => {
    expect(currentLevel(META, game({ stars: { 0: 1 }, unlocked: 1 }), '9-10')).toBe(1);
    // A star on the start level itself with no stored current: the first level with no stars.
    expect(currentLevel(META, game({ stars: { 6: 3 }, unlocked: 7 }), '9-10')).toBe(0);
  });

  it('a star on a level the game no longer has is not a star in this game', () => {
    expect(currentLevel(META, game({ stars: { 10: 3 } }), '9-10')).toBe(6);
    expect(currentLevel(META, game({ stars: { 10: 3, 999: 1 } }), '7-8')).toBe(3);
    // The last real level still counts.
    expect(currentLevel(META, game({ stars: { 9: 1 } }), '9-10')).toBe(0);
  });

  it('a run on another level keeps today’s rule: Level 1 started before a move to 9-10 stays Level 1', () => {
    expect(currentLevel(META, game({ runs: { 0: solvedOne } }), '9-10')).toBe(0);
    expect(currentLevel(META, game({ runs: { 0: solvedOne, 6: run() } }), '9-10')).toBe(0);
    expect(currentLevel(META, game({ runs: { 8: run() } }), '9-10')).toBe(0);
  });

  it('ignores a start level that is out of range or not a whole number', () => {
    for (const b of [10, 11, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const meta: GameMeta = { ...META, bandStart: { '9-10': b } };
      expect(currentLevel(meta, game(), '9-10'), String(b)).toBe(0);
      expect(isLevelOpen(meta, game(), '9-10', 9), String(b)).toBe(false);
    }
  });

  it('a game with no levels stays null', () => {
    expect(currentLevel({ levelCount: 0, chapters: [], bandStart: { '9-10': 0 } }, game(), '9-10')).toBeNull();
  });
});

describe('isLevelOpen with a band start', () => {
  it('opens the start level for its band, and the levels before it stay as today', () => {
    expect(isLevelOpen(META, game(), '7-8', 3)).toBe(true);
    expect(isLevelOpen(META, game(), '7-8', 1)).toBe(false);
    expect(isLevelOpen(META, game(), '7-8', 2)).toBe(false);
    expect(isLevelOpen(META, game(), '7-8', 4)).toBe(false);
    expect(isLevelOpen(META, game(), '7-8', 6)).toBe(false);
  });

  it('does not open another band’s start level', () => {
    expect(isLevelOpen(META, game(), '5-6', 3)).toBe(false);
    expect(isLevelOpen(META, game(), null, 3)).toBe(false);
    expect(isLevelOpen(META, game(), undefined, 6)).toBe(false);
  });

  it('stays open once the child has stars elsewhere, as the start level is the band’s, not the run’s', () => {
    expect(isLevelOpen(META, game({ stars: { 0: 2 }, unlocked: 1 }), '9-10', 6)).toBe(true);
  });
});

/* ---------- The real games ---------- */

type Want = Record<AgeBand, number>;
const L1: Want = { '3-4': 0, '5-6': 0, '7-8': 0, '9-10': 0 };
const STARTS: Record<string, Want> = {
  sorter: { ...L1, '7-8': 3, '9-10': 6 },
  numbers: { ...L1, '9-10': 8 },
  mixer: { ...L1, '9-10': 3 },
  pattern: { ...L1, '9-10': 3 },
  builder: { ...L1, '7-8': 2, '9-10': 2 },
  math: L1,
  letters: L1,
  escape: L1,
  drop: L1,
};

describe('where a new child starts in each game', () => {
  for (const [id, want] of Object.entries(STARTS)) {
    it(`${id}: ${AGE_BANDS.map((b) => `${b} Level ${want[b] + 1}`).join(', ')}`, () => {
      const meta = getGame(id)!.meta!;
      for (const band of AGE_BANDS) {
        expect(currentLevel(meta, game(), band), `${id} ${band}`).toBe(want[band]);
        expect(isLevelOpen(meta, game(), band, want[band]), `${id} ${band} open`).toBe(true);
      }
    });
  }

  it('the start levels are the chapter starts the findings name', () => {
    const chapterAt = (id: string, i: number) => getGame(id)!.meta!.chapters.find((c) => c.start === i)?.title;
    expect(chapterAt('sorter', 3)).toBe('Shape and color');
    expect(chapterAt('sorter', 6)).toBe('Big boards');
    expect(chapterAt('numbers', 8)).toBe('Bigger numbers');
    expect(chapterAt('pattern', 3)).toBe('Three-car patterns');
  });

  it('no other game has a band start', () => {
    for (const id of ['math', 'letters', 'escape', 'drop']) expect(getGame(id)!.meta!.bandStart, id).toBeUndefined();
  });
});
