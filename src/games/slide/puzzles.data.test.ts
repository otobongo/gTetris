/**
 * Brick Escape puzzle data, the fast check (brief 4.1 and 12). It runs in `npm test`, so at every commit:
 * 31 levels of 6 boards, every board passes validate, designProblems and the door spacing rule, matches its
 * anchor's signature, keeps its par inside the window, and differs from the others; each level's id is the
 * hash of its puzzles; puzzle 1 is the level's original board and the canvas boards keep their places.
 * The solver itself runs in `npm run test:solver` (*.solver.ts), which proves every stored par.
 */
import { describe, expect, it } from 'vitest';
import { CANVAS_LEVELS, boardProblems, canonical, levelId, loadCanvas, signatureProblems } from '../../../scripts/generate-slide-levels';
import { LEVEL_DATA } from './levels.data';
import { meta } from './meta';
import { PUZZLE_DATA } from './puzzles.data';
import { PUZZLE_LEVELS } from './puzzles';

/** Levels that needed fallback 1 (par window widened to Best plus or minus 2). None in the shipped data. */
const WIDENED = new Set<number>();
/** Levels that needed fallback 2 (relaxed variety). None in the shipped data. */
const RELAXED = new Set<number>();

const doorKey = (p: (typeof PUZZLE_DATA)[number]['puzzles'][number]) =>
  p.spec.gates
    .map((g) => `${g.side}${g.at}x${g.len}`)
    .sort()
    .join(' ');
const colorKey = (p: (typeof PUZZLE_DATA)[number]['puzzles'][number]) => [...new Set(Object.values(p.spec.colors))].sort().join(',');

describe('Brick Escape puzzle data (fast check)', () => {
  it('has 31 levels of 6 boards, one level per Levels entry', () => {
    expect(PUZZLE_DATA).toHaveLength(31);
    expect(meta.levelCount).toBe(31);
    for (const [i, l] of PUZZLE_DATA.entries()) expect(l.puzzles, `level ${i + 1}`).toHaveLength(6);
    expect(PUZZLE_LEVELS.map((l) => l.puzzles.length)).toEqual(Array(31).fill(6));
  });

  it('puzzle 1 of every level is the level’s original board, unchanged', () => {
    expect(LEVEL_DATA).toHaveLength(PUZZLE_DATA.length);
    for (const [i, l] of PUZZLE_DATA.entries()) expect(l.puzzles[0], `level ${i + 1}`).toEqual(LEVEL_DATA[i]);
  });

  it('the canvas teaching boards stay first in Levels 1, 5, 9, 14, 20 and 31', () => {
    expect(Object.keys(CANVAS_LEVELS).map(Number)).toEqual([1, 5, 9, 14, 20, 31]);
    for (const [n, key] of Object.entries(CANVAS_LEVELS)) {
      const { spec, best } = loadCanvas(key);
      const first = PUZZLE_DATA[Number(n) - 1].puzzles[0];
      expect(first.spec, `level ${n}`).toEqual(spec);
      expect(first.par, `level ${n}`).toBe(best);
    }
  });

  it('every board passes validate, designProblems and the board rules (anchors skip door spacing)', () => {
    for (const [i, l] of PUZZLE_DATA.entries())
      for (const [k, p] of l.puzzles.entries()) expect(boardProblems(p.spec, k > 0), `level ${i + 1} puzzle ${k + 1}`).toEqual([]);
  });

  it('puzzles 2 to 6 match their anchor’s signature: size, tray, colors, ice, locks, brick sizes and count, name, tip, clock', () => {
    for (const [i, l] of PUZZLE_DATA.entries())
      for (const [k, p] of l.puzzles.entries()) if (k > 0) expect(signatureProblems(l.puzzles[0].spec, p.spec), `level ${i + 1} puzzle ${k + 1}`).toEqual([]);
  });

  it('stored pars sit inside the par window around the anchor’s Best', () => {
    for (const [i, l] of PUZZLE_DATA.entries()) {
      const window = WIDENED.has(i + 1) ? 2 : 1;
      for (const [k, p] of l.puzzles.entries()) {
        expect(Number.isInteger(p.par) && p.par > 0, `level ${i + 1} puzzle ${k + 1}`).toBe(true);
        expect(Math.abs(p.par - l.puzzles[0].par), `level ${i + 1} puzzle ${k + 1}`).toBeLessThanOrEqual(window);
      }
    }
  });

  it('no two boards are equal under the 8 rotations and mirrors with colors renamed, in a level or across levels', () => {
    const seen = new Map<string, string>();
    for (const [i, l] of PUZZLE_DATA.entries())
      for (const [k, p] of l.puzzles.entries()) {
        const key = canonical(p.spec);
        const where = `level ${i + 1} puzzle ${k + 1}`;
        expect(seen.get(key), where).toBeUndefined();
        seen.set(key, where);
      }
    expect(seen.size).toBe(186);
  });

  it('inside a level, each board has its own door layout and its own color set', () => {
    for (const [i, l] of PUZZLE_DATA.entries()) {
      if (RELAXED.has(i + 1)) continue;
      expect(new Set(l.puzzles.map(doorKey)).size, `level ${i + 1} door layouts`).toBe(6);
      expect(new Set(l.puzzles.map(colorKey)).size, `level ${i + 1} color sets`).toBe(6);
    }
  });

  it('every hint order names each brick once', () => {
    for (const [i, l] of PUZZLE_LEVELS.entries())
      for (const [k, b] of l.puzzles.entries())
        expect([...(b.order ?? [])].sort((x, y) => x - y), `level ${i + 1} puzzle ${k + 1}`).toEqual(b.blocks.map((_, j) => j));
  });

  it('each level’s id is the first 12 hex characters of a SHA-256 of its puzzles', () => {
    for (const [i, l] of PUZZLE_DATA.entries()) {
      expect(l.id, `level ${i + 1}`).toMatch(/^[0-9a-f]{12}$/);
      expect(l.id, `level ${i + 1}`).toBe(levelId(l.puzzles));
    }
    expect(new Set(PUZZLE_DATA.map((l) => l.id)).size).toBe(31);
  });
});
