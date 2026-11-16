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

/* ---------- Review cases: first load, keyboard, redirects, every age band and the other sizes ---------- */

/** Waits two frames, so App's one-frame focus move has run. */
const afterFrames = (page: Page) => page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

/** Taps the centre of the `name` link, then the same spot again after each gap (ms), as a child does. */
async function tapAgain(page: Page, name: string, gaps: number[]) {
  const box = await page.getByRole('link', { name, exact: true }).first().boundingBox();
  if (!box) throw new Error(`No ${name} link`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
  for (const gap of gaps) {
    await page.waitForTimeout(gap);
    await page.touchscreen.tap(x, y);
  }
}

test('the first screen keeps focus where the browser left it (a11y-cross-6)', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/stickers');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sticker book');
  await afterFrames(page);
  expect(await focusPlace(page)).toBe('BODY');
});

test('the first screen keeps focus where the browser left it after the first load’s redirect (a11y-cross-6)', async ({ page }) => {
  // Nobody set up yet: Home goes on to Who's playing, which is still the first screen.
  await seed(page, []);
  await page.goto('/#/');
  await expect(page).toHaveURL(/#\/players$/);
  await expect(page.getByRole('heading', { name: "Who's playing?" })).toBeVisible();
  await afterFrames(page);
  expect(await focusPlace(page)).toBe('BODY');
  await expect(page).toHaveTitle("Who's playing · Brickwise");
});

test('Enter on a game’s Back puts focus on Home’s heading (a11y-cross-6)', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/pattern/1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 1');
  await page.getByRole('link', { name: 'Back to home' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeFocused();
  await expect(page).toHaveTitle('Brickwise');
});

test('a new screen that places focus itself keeps it: the grown-up check keeps its answer field (a11y-cross-6)', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/');
  await page.getByRole('link', { name: 'Settings for grown-ups' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.locator('.sc-gate__sum')).toBeVisible();
  await afterFrames(page);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('INPUT');
  await expect(page).toHaveTitle('Settings · Brickwise');
});

test('a screen drawn again after a redirect back to its own path still gets focus (a11y-cross-6)', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/sorter/1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 1');
  // The game's own address opens its current level: App draws nothing for a moment, then Level 1 again.
  await page.evaluate(() => (location.hash = '#/game/sorter'));
  await expect(page).toHaveURL(/#\/game\/sorter\/1$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 1');
  await expect.poll(() => focusPlace(page)).toMatch(/^(h1|control in main)$/);
});

test('the page title follows each redirect: a game’s address, an old path and Break (app-core-10)', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
  await page.evaluate(() => (location.hash = '#/game/sorter'));
  await expect(page).toHaveURL(/#\/game\/sorter\/1$/);
  await expect(page).toHaveTitle('Shape Sorter, Level 1 · Brickwise');
  await page.evaluate(() => (location.hash = '#/drop'));
  await expect(page).toHaveURL(/#\/game\/drop\/1$/);
  await expect(page).toHaveTitle('Brick Drop, Stage 1 · Brickwise');

  const tired = await page.context().newPage();
  await seed(tired, [{ id: 'maya', name: 'Maya', ageBand: '7-8', dailyLimit: 20, minutesToday: 20 }]);
  await tired.goto('/#/game/pattern/1');
  await expect(tired).toHaveURL(/#\/break$/);
  await expect(tired.getByRole('heading', { name: 'Time for a break, Maya' })).toBeVisible();
  await expect(tired).toHaveTitle('Break time · Brickwise');
});

test('a 3 to 4 year old tapping a game’s Back three times stays on Home (app-core-2)', async ({ page }) => {
  await seed(page, [{ id: 'kai', name: 'Kai', ageBand: '3-4' }]);
  await page.goto('/#/game/pattern/1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 1');
  // Taps about 200 ms apart: the third lands well inside the 700 ms after Home opened.
  await tapAgain(page, 'Back to home', [200, 200]);
  await page.waitForTimeout(1000);
  expect(hashOf(page)).toBe('#/');
  await expect(page.getByRole('heading', { name: 'Hi Kai!' })).toBeVisible();
});

test('two quick taps on the Sticker book’s Back stay on Home (app-core-2)', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/stickers');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sticker book');
  await tapAgain(page, 'Back to home', [250]);
  await page.waitForTimeout(1000);
  expect(hashOf(page)).toBe('#/');
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
});

// The two projects are phone 390x844 and tablet 834x1194; these are the audit's other two sizes.
for (const size of [
  { width: 375, height: 667 },
  { width: 1194, height: 834 },
]) {
  test.describe(`at ${size.width}x${size.height}`, () => {
    test.use({ viewport: size, isMobile: true, hasTouch: true });

    test('two quick taps on a game’s Back stay on Home, and a later tap on the avatar opens Who’s playing (app-core-2)', { tag: '@phone-only' }, async ({ page }) => {
      await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10' }]);
      await page.goto('/#/game/sorter/1');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 1');
      await tapAgain(page, 'Back to home', [250]);
      await page.waitForTimeout(1000);
      expect(hashOf(page)).toBe('#/');
      await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
      await expect(page).toHaveTitle('Brickwise');
      await page.getByRole('link', { name: 'Switch player' }).tap();
      await expect(page).toHaveURL(/#\/players$/);
      await expect(page).toHaveTitle("Who's playing · Brickwise");
    });
  });
}
