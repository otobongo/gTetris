/**
 * Usability round 2, app screens: Home holds a game-card tap that follows Play as (decision 35), the
 * speakers Voice off hides (decision 20), the Discoveries copy (decision 29), the 54 pt sticker book link
 * (decision 30) and the coming-soon notice at the top of Sign in and Sign up (decision 31).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { STORAGE_KEY, hashOf, homeCard, passGrownUpCheck, recordSpeech, seed, starsUpTo, type PlayerSeed } from './app';

const SOON = 'Family accounts are coming soon.';
const DISCOVERY = 'Discovery stickers are coming soon.';

/** Voice off in the saved settings, before the app reads them. Call after seed. */
async function voiceOff(page: Page) {
  await page.addInitScript((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (state.settings.voice === false) return;
    state.settings.voice = false;
    localStorage.setItem(key, JSON.stringify(state));
  }, STORAGE_KEY);
}

/** Measure with the real font: Baloo 2 has loaded (the app ships weights 600, 700 and 800 only). */
const fontReady = async (page: Page) => {
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Baloo 2' && f.status === 'loaded'));
  expect(loaded, 'Baloo 2 loaded').toBe(true);
  expect(await page.evaluate(() => document.fonts.check('800 16px "Baloo 2"'))).toBe(true);
};

const middle = async (el: Locator) => {
  const b = await el.boundingBox();
  if (!b) throw new Error('Not on screen');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

/* ---------- Decision 35: a game card holds a finger tap just after Play as ---------- */

const MAYA: PlayerSeed[] = [{ id: 'maya', name: 'Maya', ageBand: '7-8' }];

/** Who's playing, ready to tap Play as Maya; returns the middle of that button. */
async function atPlayAs(page: Page) {
  await seed(page, MAYA);
  await page.goto('/#/players');
  const play = page.getByRole('link', { name: 'Play as Maya' });
  await expect(play).toBeVisible();
  await fontReady(page);
  return middle(play);
}

/** The Home card or discovery link under a screen point, or null. */
const cardAt = (page: Page, x: number, y: number) =>
  page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py)?.closest('.sc-gamecard, .sc-discovery');
    return el ? (el.getAttribute('aria-label') ?? el.textContent) : null;
  }, [x, y] as const);

/** The middle of the Home card under a screen point, or null. */
const cardMiddleAt = (page: Page, x: number, y: number) =>
  page.evaluate(([px, py]) => {
    const r = document.elementFromPoint(px, py)?.closest('.sc-gamecard')?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  }, [x, y] as const);

function doubleTapCases() {
  test('a second finger tap 250 ms after Play as, at the same spot, stays on Home', async ({ page }) => {
    const { x, y } = await atPlayAs(page);
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(250);
    expect(hashOf(page)).toBe('#/');
    // At 390x844 the spot lands on a game card, so without the hold this tap would open a game. At
    // 375x667 it sits a fraction of a pixel above a card and on the tablet between cards; the next case
    // taps the middle of a card there.
    if (page.viewportSize()!.width < 768) expect(await cardAt(page, x, y)).not.toBeNull();
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(1000);
    expect(hashOf(page)).toBe('#/');
    await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
  });

  test('a finger tap on any card or Today’s discovery 250 ms after Play as stays on Home', async ({ page }) => {
    for (const target of ['card', 'discovery'] as const) {
      const at = await atPlayAs(page);
      await page.touchscreen.tap(at.x, at.y);
      await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
      const link = target === 'card' ? homeCard(page, 'Brick Escape') : page.locator('.sc-discovery');
      const { x, y } = await middle(link);
      await page.waitForTimeout(150);
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(1000);
      expect(hashOf(page), target).toBe('#/');
    }
  });

  test('a finger tap 800 ms after Play as opens the game', async ({ page }) => {
    const at = await atPlayAs(page);
    await page.touchscreen.tap(at.x, at.y);
    await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
    await page.waitForTimeout(800);
    // The middle of the card under the Play as spot (phones), else of Brick Escape's card. The middle,
    // because at 375x667 the spot sits a fraction of a pixel above a card's top edge.
    const { x, y } = (await cardMiddleAt(page, at.x, at.y)) ?? (await middle(homeCard(page, 'Brick Escape')));
    await page.touchscreen.tap(x, y);
    await expect(page).toHaveURL(/#\/game\//);
  });

  test('arriving at Home from Settings or a game, a finger tap at 250 ms opens the game', async ({ page }) => {
    await seed(page, MAYA);
    for (const from of ['/#/settings', '/#/game/sorter/1']) {
      await page.goto(from);
      await expect(page.locator('main')).toBeVisible();
      await page.evaluate(() => (location.hash = '#/'));
      await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
      const { x, y } = await middle(homeCard(page, 'Brick Escape'));
      await page.waitForTimeout(250);
      await page.touchscreen.tap(x, y);
      await expect(page, from).toHaveURL(/#\/game\/escape\/1$/);
    }
  });

  test('a mouse click 100 ms after Play as opens the game', async ({ page }) => {
    const at = await atPlayAs(page);
    await page.mouse.click(at.x, at.y);
    await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
    const { x, y } = await middle(homeCard(page, 'Brick Escape'));
    await page.waitForTimeout(100);
    await page.mouse.click(x, y);
    await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  });

  test('Enter on a focused card straight after Play as opens it at once', async ({ page }) => {
    const { x, y } = await atPlayAs(page);
    await page.touchscreen.tap(x, y);
    await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
    await homeCard(page, 'Shape Sorter').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/game\/sorter\/1$/);
  });
}

test.describe('decision 35 at the project size', () => {
  doubleTapCases();
});

test.describe('decision 35 at 375x667', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  doubleTapCases();
});

/* ---------- Decision 20: speakers are hidden while Voice is off ---------- */

const LEO: PlayerSeed[] = [{ id: 'leo', name: 'Leo', ageBand: '5-6', games: { escape: { stars: starsUpTo(9) } } }];

/** The sticker book's title middle and the speaker count, with Voice on or off. */
async function stickerBook(page: Page) {
  await page.goto('/#/stickers');
  const title = page.getByRole('heading', { level: 1, name: 'Sticker book' });
  await expect(title).toBeVisible();
  await fontReady(page);
  return { centre: (await middle(title)).x, speakers: await page.getByRole('button', { name: 'Read this page aloud' }).count() };
}

test('with Voice on, the sticker book, its cards and Break have their speakers', async ({ page }) => {
  await seed(page, LEO);
  const book = await stickerBook(page);
  expect(book.speakers).toBe(1);
  await page.getByRole('button', { name: /^Sticker not found yet/ }).first().click();
  await expect(page.getByRole('button', { name: 'Hear how to get it' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Open door' }).click();
  await expect(page.getByRole('button', { name: 'Say the name' })).toBeVisible();
});

test('with Voice off, the sticker book has no speakers and its title stays in the middle', async ({ page, browser }) => {
  // Voice on first, for the title's place.
  const ctx = await browser.newContext({ viewport: page.viewportSize()!, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const on = await ctx.newPage();
  await seed(on, LEO);
  const withVoice = await stickerBook(on);
  await ctx.close();

  await seed(page, LEO);
  await voiceOff(page);
  const book = await stickerBook(page);
  expect(book.speakers).toBe(0);
  expect(Math.abs(book.centre - withVoice.centre)).toBeLessThanOrEqual(1);

  await page.getByRole('button', { name: /^Sticker not found yet/ }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Hear how to get it' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: 'Open door' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Say the name' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
});

test('with Voice off, Break has no Read it aloud and its heading stays in place', async ({ page, browser }) => {
  const TIRED: PlayerSeed[] = [{ id: 'leo', name: 'Leo', ageBand: '5-6', dailyLimit: 20, minutesToday: 20 }];
  const headingTop = async (p: Page) => {
    await p.goto('/#/break');
    const h = p.getByRole('heading', { name: 'Time for a break, Leo' });
    await expect(h).toBeVisible();
    await fontReady(p);
    return (await h.boundingBox())!.y;
  };
  const ctx = await browser.newContext({ viewport: page.viewportSize()!, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const on = await ctx.newPage();
  await seed(on, TIRED);
  const withVoice = await headingTop(on);
  expect(await on.getByRole('button', { name: 'Read it aloud' }).count()).toBe(1);
  await ctx.close();

  await seed(page, TIRED);
  await voiceOff(page);
  const top = await headingTop(page);
  await expect(page.getByRole('button', { name: 'Read it aloud' })).toHaveCount(0);
  expect(Math.abs(top - withVoice)).toBeLessThanOrEqual(2);
});

/* ---------- Decision 29: Discoveries say Discovery stickers are coming soon. ---------- */

function discoveryCases() {
  test('every Discoveries slot opens a card with the coming-soon line and only Close', async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
    await page.goto('/#/stickers');
    await page.getByRole('tab', { name: 'Discoveries' }).click();
    // The empty book's page line says the same.
    await expect(page.locator('.sc-album__line')).toHaveText(DISCOVERY);
    const slots = page.getByRole('button', { name: /^Sticker not found yet, from Today's discovery/ });
    await expect(slots).toHaveCount(12);
    for (const i of [0, 11]) {
      await slots.nth(i).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText(DISCOVERY);
      await expect(dialog.getByRole('button')).toHaveText(['Close']);
      await expect(dialog.getByRole('link')).toHaveCount(0);
      await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
      await dialog.getByRole('button', { name: 'Close' }).click();
    }
    await expect(page.getByText('Go to Home')).toHaveCount(0);
  });
}

discoveryCases();

test.describe('decision 29 at 375x667 and 1194x834', () => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1194, height: 834 },
  ]) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport, isMobile: true, hasTouch: true });
      discoveryCases();
    });
  }
});

test('at ages 3 to 4, Hear how to get it on a Discoveries slot says Discovery stickers are coming soon.', async ({ page }) => {
  const spoken = await recordSpeech(page);
  await seed(page, [{ id: 'kai', name: 'Kai', ageBand: '3-4' }]);
  await page.goto('/#/stickers');
  await page.getByRole('tab', { name: 'Discoveries' }).click();
  await page.getByRole('button', { name: /^Sticker not found yet, from Today's discovery/ }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button')).toHaveText(['', 'Close']);
  await dialog.getByRole('button', { name: 'Hear how to get it' }).click();
  expect(await spoken()).toEqual([DISCOVERY]);
});

/* ---------- Decision 30: the sticker book link is at least 54 pt tall ---------- */

test('the sticker book link is a kid-sized target and stays clear of Today’s discovery @phone-only', async ({ page }) => {
  await seed(page, MAYA);
  for (const size of [
    { width: 390, height: 844, min: 54 },
    { width: 375, height: 667, min: 54 },
    { width: 1194, height: 834, min: 54 },
    { width: 834, height: 1194, min: 75 },
  ]) {
    const at = `${size.width}x${size.height}`;
    await page.setViewportSize(size);
    await page.goto('/#/');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
    await fontReady(page);
    const stats = (await page.locator('.sc-stats').boundingBox())!;
    const discovery = (await page.locator('.sc-discovery').boundingBox())!;
    const head = (await page.locator('.sc-home__head').boundingBox())!;
    const zoom = size.width === 834 ? 1.4 : 1;
    expect(stats.height, at).toBeGreaterThanOrEqual(size.min);
    // No overlap with the card below.
    expect(stats.y + stats.height, at).toBeLessThanOrEqual(discovery.y);
    // The header grew by 10 pt at most: with the 44 pt link it measured 58.4 pt at every size (frame px).
    expect(head.height / zoom, at).toBeLessThanOrEqual(58.4 + 10 + 0.5);
  }
});

/* ---------- Decision 31: Sign in and Sign up open with the coming-soon notice ---------- */

async function openAccountScreen(page: Page, path: '/signin' | '/signup') {
  await page.goto(`/#${path}`);
  if (await page.locator('.sc-gate__sum').isVisible()) await passGrownUpCheck(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await fontReady(page);
}

/** The coming-soon notices on screen, and whether the first sits under the heading before any field. */
async function noticePlace(page: Page) {
  return page.evaluate((soon) => {
    const all = [...document.querySelectorAll('.sc-notice')].filter((n) => n.textContent?.includes(soon));
    const h1 = document.querySelector('main h1');
    const first = all[0];
    const field = document.querySelector('main input, main .sc-provider');
    const follows = (a: Element | null | undefined, b: Element | null | undefined) => !!a && !!b && !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { count: all.length, afterHeading: follows(h1, first), beforeFields: follows(first, field), compact: !!first?.classList.contains('sc-notice--compact') };
  }, SOON);
}

function accountCases() {
  test('Sign in opens with one compact coming-soon notice under the heading, and a provider or Sign in adds no second', async ({ page }) => {
    await seed(page, MAYA);
    await openAccountScreen(page, '/signin');
    expect(await noticePlace(page)).toEqual({ count: 1, afterHeading: true, beforeFields: true, compact: true });
    const top = page.locator('.sc-notice').first();
    await expect(top).toBeInViewport();
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await page.waitForTimeout(300);
    expect((await noticePlace(page)).count).toBe(1);
    await page.getByLabel('Email').fill('sam@example.com');
    await page.getByLabel('Password', { exact: true }).fill('a-long-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForTimeout(300);
    expect((await noticePlace(page)).count).toBe(1);
    // The answer points at the notice that is already there.
    await expect(top).toBeInViewport();
  });

  test('Sign up opens with one compact coming-soon notice under the heading, and Create account adds no second', async ({ page }) => {
    await seed(page, MAYA);
    await openAccountScreen(page, '/signup');
    expect(await noticePlace(page)).toEqual({ count: 1, afterHeading: true, beforeFields: true, compact: true });
    // Without the box ticked, the box's own error still shows.
    await page.getByRole('button', { name: 'Continue with Apple' }).click();
    await expect(page.getByText('Tick the box above to create the account.')).toBeVisible();
    await page.getByRole('checkbox', { name: /I am a parent or guardian/ }).check();
    await page.getByRole('button', { name: 'Continue with Apple' }).click();
    await page.waitForTimeout(300);
    expect((await noticePlace(page)).count).toBe(1);
    await page.getByLabel('Email').fill('sam@example.com');
    await page.getByLabel('Password').fill('a-long-password');
    await page.locator('.sc-auth__body').evaluate((e) => e.scrollTo(0, e.scrollHeight));
    const create = page.getByRole('button', { name: 'Create account' });
    await expect(create).toBeInViewport({ ratio: 1 });
    await create.click();
    await page.waitForTimeout(300);
    expect((await noticePlace(page)).count).toBe(1);
    await expect(page.locator('.sc-notice').first()).toBeInViewport();
    await expect(page.getByRole('heading', { name: 'Create your family account' })).toBeVisible();
  });
}

accountCases();

test.describe('decision 31 at 375x667 and 1194x834', () => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1194, height: 834 },
  ]) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport, isMobile: true, hasTouch: true });
      accountCases();
    });
  }
});
