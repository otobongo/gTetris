import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fromCanvas } from '../../../scripts/generate-slide-levels';
import { designProblems, fromSpec, initialState, validate } from './engine';
import { LEVELS } from './levels';
import { meta } from './meta';
import { solve } from './solver';

const canvas = (key: string) => {
  const raw = JSON.parse(readFileSync(new URL(`../../../design/escape-levels/out-${key}.json`, import.meta.url), 'utf8'));
  return { spec: fromCanvas(key, raw[key]), best: raw[key].best as number };
};

describe('shipped Brick Escape levels', () => {
  it('every level is solvable in its par and follows the corner and exact-length door rules', () => {
    for (const lvl of LEVELS) {
      expect(validate(lvl), `level ${lvl.id}`).toEqual([]);
      expect(designProblems(lvl), `level ${lvl.id}`).toEqual([]);
      const sol = solve(lvl, initialState(lvl), 2_000_000);
      expect(sol, `level ${lvl.id} solvable`).not.toBeNull();
      expect(sol!.moves.length, `level ${lvl.id} par`).toBe(lvl.par);
    }
  }, 120_000);

  it('only advanced levels put a door in the middle of an edge', () => {
    const early = LEVELS.slice(0, 25).filter((l) => l.id !== 9);
    for (const lvl of early) {
      expect(lvl.advanced, `level ${lvl.id}`).toBeFalsy();
      for (const g of lvl.gates) {
        const span = g.side === 'left' || g.side === 'right' ? lvl.rows : lvl.cols;
        expect(g.at === 0 || g.at + g.len === span, `level ${lvl.id} ${g.color} door`).toBe(true);
      }
    }
  });

  it('has one door per color, no frozen bricks, and every color lock waits for a color on the board', () => {
    for (const lvl of LEVELS) {
      const colors = lvl.gates.map((g) => g.color);
      expect(new Set(colors).size, `level ${lvl.id}`).toBe(colors.length);
      expect(lvl.blocks.some((b) => b.frozen), `level ${lvl.id}`).toBe(false);
      for (const g of lvl.gates) if (g.lockColor) expect(lvl.blocks.some((b) => b.color === g.lockColor)).toBe(true);
    }
  });

  it('every level has a subtitle, a clock base and a hint order that names each brick once', () => {
    for (const lvl of LEVELS) {
      expect(lvl.name, `level ${lvl.id}`).toBeTruthy();
      expect(lvl.base, `level ${lvl.id}`).toBeGreaterThan(0);
      expect([...(lvl.order ?? [])].sort((a, b) => a - b), `level ${lvl.id}`).toEqual(lvl.blocks.map((_, i) => i));
    }
  });

  it('Level 1 is the fixed 4x4 board from the canvas', () => {
    const l1 = LEVELS[0];
    expect([l1.rows, l1.cols]).toEqual([4, 4]);
    const bricks = l1.blocks.map((b) => [b.color, b.r, b.c, b.cells.length]);
    expect(bricks).toEqual(
      expect.arrayContaining([
        ['white', 0, 0, 4],
        ['black', 0, 2, 4],
        ['white', 2, 0, 4],
        ['black', 2, 2, 4],
      ]),
    );
    expect(l1.blocks).toHaveLength(4);
    expect(l1.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: 'white', side: 'left', at: 0, len: 2 }),
        expect.objectContaining({ color: 'black', side: 'left', at: 2, len: 2 }),
      ]),
    );
    expect(l1.gates).toHaveLength(2);
  });

  it('levels 5 and 9 are the canvas boards out-5.json and out-9.json', () => {
    for (const [n, key] of [
      [5, '5'],
      [9, '9'],
    ] as const) {
      const { spec, best } = canvas(key);
      const want = fromSpec(spec, n, best);
      const got = LEVELS[n - 1];
      expect(got.blocks, `level ${n}`).toEqual(want.blocks);
      expect(got.gates, `level ${n}`).toEqual(want.gates);
      expect(got.par, `level ${n}`).toBe(best);
    }
  });

  it('the canvas teaching boards open their chapters', () => {
    const start = (title: string) => meta.chapters.find((c) => c.title === title)!.start;
    expect(LEVELS[start('Icy doors')].tip).toBe(canvas('ice').spec.tip);
    expect(LEVELS[start('Stone blocks')].tip).toBe(canvas('walls').spec.tip);
    expect(LEVELS[start('Master')].tip).toBe(canvas('master').spec.tip);
  });

  it('chapters cover every level once, in order', () => {
    expect(meta.levelCount).toBe(LEVELS.length);
    let next = 0;
    for (const c of meta.chapters) {
      expect(c.start).toBe(next);
      next += c.count;
    }
    expect(next).toBe(LEVELS.length);
  });

  it('gets harder chapter by chapter', () => {
    const avg = (c: (typeof meta.chapters)[number]) => LEVELS.slice(c.start, c.start + c.count).reduce((s, l) => s + l.par, 0) / c.count;
    const firstFive = meta.chapters.slice(0, 5).map(avg);
    for (let i = 1; i < firstFive.length; i++) expect(firstFive[i], meta.chapters[i].title).toBeGreaterThan(firstFive[i - 1]);
  });
});
