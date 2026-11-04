/**
 * The full Brick Escape solver check (brief 12), shared by the per-chapter *.solver.ts files that
 * `npm run test:solver` runs in parallel: every stored par is the solver's best for that board.
 * Kept out of `npm test` and the commit gate because it takes about 90 seconds.
 */
import { expect, it } from 'vitest';
import { solveSpec } from '../../../scripts/generate-slide-levels';
import { meta } from './meta';
import { PUZZLE_DATA } from './puzzles.data';

export function checkChapter(title: string): void {
  const chapter = meta.chapters.find((c) => c.title === title);
  if (!chapter) throw new Error(`no chapter named ${title}`);
  for (let i = chapter.start; i < chapter.start + chapter.count; i++) {
    it(`Level ${i + 1}: every stored par is the solver’s best`, () => {
      for (const [k, p] of PUZZLE_DATA[i].puzzles.entries()) {
        const s = solveSpec(p.spec, 2_000_000);
        expect(s, `level ${i + 1} puzzle ${k + 1} is solvable`).not.toBeNull();
        expect(s!.par, `level ${i + 1} puzzle ${k + 1} par`).toBe(p.par);
      }
    }, 300_000);
  }
}
