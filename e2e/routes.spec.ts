/**
 * Routes in the real router (four-puzzle brief 7.4): old paths, the old level grid and any level number other
 * than the current one all land on the child's current level; the grown-up picker sends an unknown game or
 * child back to Settings. The rules are unit-tested in src/screens/logic/routes.test.ts; this checks that the
 * app follows them in a browser, with one replace each (the history does not grow).
 */
import { expect, test } from '@playwright/test';
import { seed, starsUpTo } from './app';

test('old paths, the old level grid and other level numbers all open the current level', async ({ page }) => {
  // Brick Escape Levels 1 and 2 finished: the current level is Level 3. Letter Builder and Brick Drop are new.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8', games: { escape: { stars: starsUpTo(2) } } }]);
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();

  const cases: [string, RegExp, string][] = [
    ['#/slide', /#\/game\/escape\/3$/, 'Level 3'],
    ['#/slide/7', /#\/game\/escape\/3$/, 'Level 3'],
    ['#/game/escape/levels', /#\/game\/escape\/3$/, 'Level 3'],
    // a finished level, and a level past the frontier
    ['#/game/escape/1', /#\/game\/escape\/3$/, 'Level 3'],
    ['#/game/escape/9', /#\/game\/escape\/3$/, 'Level 3'],
    ['#/drop', /#\/game\/drop\/1$/, 'Stage 1'],
    ['#/drop/4', /#\/game\/drop\/1$/, 'Stage 1'],
    ['#/letters/5', /#\/game\/letters\/1$/, 'Level 1'],
    ['#/game/letters/levels', /#\/game\/letters\/1$/, 'Level 1'],
  ];
  for (const [hash, lands, title] of cases) {
    await page.goto('/#/');
    await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
    const before = await page.evaluate(() => history.length);
    // A link a child might still have: one new entry for the hash, and the redirect replaces it.
    await page.evaluate((h) => (location.hash = h), hash);
    await expect(page, hash).toHaveURL(lands);
    await expect(page.getByRole('heading', { level: 1 }), hash).toHaveText(title);
    expect(await page.evaluate(() => history.length), hash).toBe(before + 1);
  }
});

test('the grown-up picker sends an unknown game or child back to Settings', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  for (const hash of ['#/settings/levels/escape/nobody', '#/settings/levels/math/maya', '#/settings/levels/chess/maya']) {
    await page.goto(`/${hash}`);
    await expect(page, hash).toHaveURL(/#\/settings$/);
    // Settings itself still asks for the grown-up check first.
    await expect(page.locator('.sc-gate__sum'), hash).toBeVisible();
  }
});
