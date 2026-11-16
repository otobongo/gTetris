/**
 * Routes in the real router (four-puzzle brief 7.4): old paths, the old level grid and any level number other
 * than the current one all land on the child's current level; the grown-up picker sends an unknown game or
 * child back to Settings. The rules are unit-tested in src/screens/logic/routes.test.ts; this checks that the
 * app follows them in a browser, with one replace each (the history does not grow).
 */
import { expect, test, type Page } from '@playwright/test';
import { hashOf, homeCard, seed, starsUpTo } from './app';

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
  for (const hash of ['#/settings/levels/escape/nobody', '#/settings/levels/chess/maya']) {
    await page.goto(`/${hash}`);
    await expect(page, hash).toHaveURL(/#\/settings$/);
    // Settings itself still asks for the grown-up check first.
    await expect(page.locator('.sc-gate__sum'), hash).toBeVisible();
  }
});

/* ---------- Page titles, focus on a new screen, and a double tap through Back (usability batch C) ---------- */

/** Where focus sits: BODY, or the h1 or a control inside the screen's main. */
async function focusPlace(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return 'BODY';
    const main = document.querySelector('main');
    if (!main?.contains(el)) return `outside main: ${el.tagName}`;
    return el.tagName === 'H1' ? 'h1' : 'control in main';
  });
}

test('the page title names the screen (app-core-10)', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
  await expect(page).toHaveTitle('Brickwise');
  await page.goto('/#/game/sorter/1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 1');
  await expect(page).toHaveTitle('Shape Sorter, Level 1 · Brickwise');
  await page.evaluate(() => (location.hash = '#/stickers'));
  await expect(page).toHaveTitle('Sticker book · Brickwise');
  await page.evaluate(() => (location.hash = '#/'));
  await expect(page).toHaveTitle('Brickwise');
});

test('Enter on a Home card opens the game with focus on the new screen, not the page (a11y-cross-6)', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/');
  const card = homeCard(page, 'Shape Sorter');
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/game\/sorter\/1$/);
  await expect.poll(() => focusPlace(page)).toMatch(/^(h1|control in main)$/);
});

test('tapping the sticker line opens the Sticker book with focus on the new screen (a11y-cross-6)', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/');
  await page.getByRole('link', { name: /Open the sticker book$/ }).tap();
  await expect(page).toHaveURL(/#\/stickers$/);
  await expect.poll(() => focusPlace(page)).toMatch(/^(h1|control in main)$/);
});

test('two quick taps on a game’s Back stay on Home (app-core-2)', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/sorter/1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 1');
  const box = await page.getByRole('link', { name: 'Back to home' }).boundingBox();
  if (!box) throw new Error('No Back button on the play screen');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(250);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(1000);
  expect(hashOf(page)).toBe('#/');
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
});

test('a deliberate tap on Home’s avatar still opens Who’s playing (app-core-2)', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
  await page.waitForTimeout(1000);
  await page.getByRole('link', { name: 'Switch player' }).tap();
  await expect(page).toHaveURL(/#\/players$/);
});
