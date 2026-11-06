import { defineConfig } from 'vitest/config';

/**
 * The full Brick Escape solver check (brief 12): `npm run test:solver`. One file per chapter, so the files run
 * in parallel. It stays out of `npm test` and the commit gate (about 90 s on an 8-core Mac); run it whenever
 * src/games/slide/puzzles.data.ts changes and before the PR is marked ready.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.solver.ts'],
    testTimeout: 300_000,
  },
});
