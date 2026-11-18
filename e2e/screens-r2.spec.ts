/**
 * Usability round 2, app screens: Home holds a game-card tap that follows Play as (decision 35), the
 * speakers Voice off hides (decision 20), the Discoveries copy (decision 29), the 54 pt sticker book link
 * (decision 30) and the coming-soon notice at the top of Sign in and Sign up (decision 31).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { STORAGE_KEY, hashOf, homeCard, passGrownUpCheck, recordSpeech, seed, starsUpTo, type PlayerSeed } from './app';

const SOON = 'Family accounts are coming soon.';
const DISCOVERY = 'Discovery stickers are coming soon.';
const DISCOVERY_SLOT = 'Discovery sticker, coming soon';

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

/**
 * The hold reads the page clock, so each case freezes it (page.clock.setFixedTime) before Home opens
 * and moves it on by hand: a tap lands 250 or 800 ms after Home opened however slowly a busy machine
 * draws the screen. Real waits only let the page settle. Returns the setter for "ms after now".
 */
async function freezeClock(page: Page) {
  const t0 = Date.now();
  await page.clock.setFixedTime(t0);
  return (ms: number) => page.clock.setFixedTime(t0 + ms);
}

/** Who's playing, ready to tap Play as Maya: the middle of that button, and the frozen clock's setter. */
async function atPlayAs(page: Page, players = MAYA) {
  await seed(page, players);
  await page.goto('/#/players');
  const play = page.getByRole('link', { name: 'Play as Maya' });
  await expect(play).toBeVisible();
  await play.scrollIntoViewIfNeeded();
  await fontReady(page);
  return { ...(await middle(play)), after: await freezeClock(page) };
}

/** The Home card or discovery link under a screen point, or null (also null off screen). */
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

/** A finger tap on the middle of a Home link, once it is on screen and the spot is on that link. */
async function tapLink(page: Page, link: Locator) {
  await link.scrollIntoViewIfNeeded();
  const { x, y } = await middle(link);
  expect(await cardAt(page, x, y), 'the tap lands on a card').not.toBeNull();
  await page.touchscreen.tap(x, y);
}

const hello = (page: Page) => page.getByRole('heading', { name: 'Hi Maya!' });

function doubleTapCases() {
  test('a second finger tap 250 ms after Play as, at the same spot, stays on Home', async ({ page }) => {
    const { x, y, after } = await atPlayAs(page);
    await page.touchscreen.tap(x, y);
    await expect(hello(page)).toBeVisible();
    await after(250);
    expect(hashOf(page)).toBe('#/');
    // On phones in portrait the spot lands on a game card, so without the hold this tap would open a
    // game. On wider screens it falls between cards; the next case taps the middle of a card there.
    if (page.viewportSize()!.width < 768) expect(await cardAt(page, x, y)).not.toBeNull();
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(1000);
    expect(hashOf(page)).toBe('#/');
    await expect(hello(page)).toBeVisible();
  });

  test('a finger tap on any card or Today’s discovery 250 ms after Play as stays on Home', async ({ page }) => {
    for (const target of ['card', 'discovery'] as const) {
      const at = await atPlayAs(page);
      await page.touchscreen.tap(at.x, at.y);
      await expect(hello(page)).toBeVisible();
      await at.after(250);
      await tapLink(page, target === 'card' ? homeCard(page, 'Brick Escape') : page.locator('.sc-discovery'));
      await page.waitForTimeout(1000);
      expect(hashOf(page), target).toBe('#/');
    }
  });

  test('a finger tap 800 ms after Play as opens the game', async ({ page }) => {
    const at = await atPlayAs(page);
    await page.touchscreen.tap(at.x, at.y);
    await expect(hello(page)).toBeVisible();
    await at.after(800);
    // The middle of the card under the Play as spot (phones), else of Brick Escape's card. The middle,
    // because at 375x667 the spot sits a fraction of a pixel above a card's top edge.
    const under = await cardMiddleAt(page, at.x, at.y);
    if (under) await page.touchscreen.tap(under.x, under.y);
    else await tapLink(page, homeCard(page, 'Brick Escape'));
    await expect(page).toHaveURL(/#\/game\//);
  });

  test('the hold ends at 700 ms: a finger tap at 699 ms stays on Home, the next at 700 ms opens the game', async ({ page }) => {
    const at = await atPlayAs(page);
    await page.touchscreen.tap(at.x, at.y);
    await expect(hello(page)).toBeVisible();
    const card = homeCard(page, 'Brick Escape');
    await at.after(699);
    await tapLink(page, card);
    await page.waitForTimeout(1000);
    expect(hashOf(page)).toBe('#/');
    await at.after(700);
    await tapLink(page, card);
    await expect(page).toHaveURL(/#\/game\/escape\/\d+$/);
  });

  test('arriving at Home from Settings or a game, a finger tap at 250 ms opens the game', async ({ page }) => {
    await seed(page, MAYA);
    for (const from of ['/#/settings', '/#/game/sorter/1']) {
      await page.goto(from);
      await expect(page.locator('main')).toBeVisible();
      const after = await freezeClock(page);
      await page.evaluate(() => (location.hash = '#/'));
      await expect(hello(page)).toBeVisible();
      await after(250);
      await tapLink(page, homeCard(page, 'Brick Escape'));
      await expect(page, from).toHaveURL(/#\/game\/escape\/\d+$/);
    }
  });

  test('a mouse click 100 ms after Play as opens the game', async ({ page }) => {
    const at = await atPlayAs(page);
    await page.mouse.click(at.x, at.y);
    await expect(hello(page)).toBeVisible();
    const card = homeCard(page, 'Brick Escape');
    await card.scrollIntoViewIfNeeded();
    const { x, y } = await middle(card);
    await at.after(100);
    await page.mouse.click(x, y);
    await expect(page).toHaveURL(/#\/game\/escape\/\d+$/);
  });

  test('Enter on a focused card straight after Play as opens it at once', async ({ page }) => {
    const at = await atPlayAs(page);
    await page.touchscreen.tap(at.x, at.y);
    await expect(hello(page)).toBeVisible();
    await at.after(100);
    await homeCard(page, 'Shape Sorter').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/game\/sorter\/\d+$/);
  });

  test('Enter opens a card at once even when a finger tap on it was just held', async ({ page }) => {
    const at = await atPlayAs(page);
    await page.touchscreen.tap(at.x, at.y);
    await expect(hello(page)).toBeVisible();
    await at.after(100);
    const card = homeCard(page, 'Shape Sorter');
    await tapLink(page, card);
    await page.waitForTimeout(500);
    expect(hashOf(page)).toBe('#/');
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/game\/sorter\/\d+$/);
  });
}

test('Enter opens a card at once after a finger touched it and slid away with no tap', async ({ page }) => {
  const at = await atPlayAs(page);
  await page.touchscreen.tap(at.x, at.y);
  await expect(hello(page)).toBeVisible();
  await at.after(100);
  const card = homeCard(page, 'Shape Sorter');
  // A touch that turns into a scroll leaves a pointerdown with no click behind it.
  await card.evaluate((el) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })));
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/game\/sorter\/\d+$/);
});

test('a click with no finger behind it opens a card at once, even just after a finger tap on it was held', async ({ page }) => {
  const at = await atPlayAs(page);
  await page.touchscreen.tap(at.x, at.y);
  await expect(hello(page)).toBeVisible();
  await at.after(100);
  const card = homeCard(page, 'Shape Sorter');
  await tapLink(page, card);
  await page.waitForTimeout(500);
  expect(hashOf(page)).toBe('#/');
  // Assistive tech can send a click with no pointerdown first: the held finger must not count for it.
  await card.evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
  await expect(page).toHaveURL(/#\/game\/sorter\/\d+$/);
});

for (const ageBand of ['3-4', '5-6', '7-8', '9-10'] as const) {
  test(`ages ${ageBand}: a finger tap on a card is held at 250 ms and opens the game at 800 ms`, async ({ page }) => {
    const at = await atPlayAs(page, [{ id: 'maya', name: 'Maya', ageBand }]);
    await page.touchscreen.tap(at.x, at.y);
    await expect(hello(page)).toBeVisible();
    const card = homeCard(page, 'Brick Escape');
    await at.after(250);
    await tapLink(page, card);
    await page.waitForTimeout(1000);
    expect(hashOf(page)).toBe('#/');
    await at.after(800);
    await tapLink(page, card);
    await expect(page).toHaveURL(/#\/game\/escape\/\d+$/);
  });
}

test.describe('decision 35 at the project size', () => {
  doubleTapCases();
});

for (const viewport of [
  { width: 375, height: 667 },
  { width: 1194, height: 834 },
  { width: 844, height: 390 },
]) {
  test.describe(`decision 35 at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });
    doubleTapCases();
  });
}

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

function voiceCases() {
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

  // With Voice off, an earned sticker's card keeps one button, Close, and it sits in the middle of the card, not at its left edge.
  test('with Voice off, an earned sticker’s Close is centred in its card', async ({ page }) => {
    await seed(page, LEO);
    await voiceOff(page);
    await page.goto('/#/stickers');
    await expect(page.getByRole('heading', { level: 1, name: 'Sticker book' })).toBeVisible();
    await fontReady(page);
    await page.getByRole('button', { name: 'Open door' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button')).toHaveText(['Close']);
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    const { close, title } = await dialog.evaluate((d) => {
      const box = (el: Element | null) => el!.getBoundingClientRect();
      const c = box(d.querySelector('.sc-overlay__actions button'));
      const t = box(d.querySelector('.sc-overlay__title'));
      return { close: c.x + c.width / 2, title: t.x + t.width / 2 };
    });
    expect(Math.abs(close - title)).toBeLessThanOrEqual(1);
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
}

voiceCases();

test.describe('decision 20 at 375x667, 1194x834 and 844x390', () => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1194, height: 834 },
    { width: 844, height: 390 },
  ]) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport, isMobile: true, hasTouch: true });
      voiceCases();
    });
  }
});

/* ---------- Decision 29: Discoveries say Discovery stickers are coming soon. ---------- */

function discoveryCases() {
  test('every Discoveries slot opens a card with the coming-soon line and only Close', async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
    await page.goto('/#/stickers');
    await page.getByRole('tab', { name: 'Discoveries' }).click();
    // The empty book's page line says the same.
    await expect(page.locator('.sc-album__line')).toHaveText(DISCOVERY);
    // VoiceOver hears the same promise as the screen: nothing says Today's discovery gives a sticker.
    const slots = page.getByRole('button', { name: DISCOVERY_SLOT, exact: true });
    await expect(slots).toHaveCount(12);
    await expect(page.getByRole('button', { name: /Today's discovery/ })).toHaveCount(0);
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

  test('a child with game stickers reads the coming-soon line on Discoveries, not 0 of 12', async ({ page }) => {
    await seed(page, LEO);
    await page.goto('/#/stickers');
    await expect(page.locator('.sc-album__line')).toHaveText(/^\d+ of 28 on this page$/);
    // A game's missing sticker still names the game that gives it.
    await expect(page.getByRole('button', { name: /^Sticker not found yet, from Brick Escape$/ }).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Discoveries' }).click();
    await expect(page.locator('.sc-album__line')).toHaveText(DISCOVERY);
  });

  test('a discovery sticker in old saved data still counts on its page and opens with where it came from', async ({ page }) => {
    await seed(page, MAYA);
    await page.addInitScript((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const state = JSON.parse(raw);
      state.players[0].stickers.x1 = { earnedAt: 1, seen: true };
      localStorage.setItem(key, JSON.stringify(state));
    }, STORAGE_KEY);
    await page.goto('/#/stickers');
    await page.getByRole('tab', { name: 'Discoveries' }).click();
    await expect(page.locator('.sc-album__line')).toHaveText('1 of 12 on this page');
    await page.locator('.sc-slot').first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText("From Today's discovery");
    await expect(dialog).not.toContainText(DISCOVERY);
  });
}

discoveryCases();

test.describe('decision 29 at 375x667, 1194x834 and 844x390', () => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1194, height: 834 },
    { width: 844, height: 390 },
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
  await page.getByRole('button', { name: DISCOVERY_SLOT, exact: true }).first().click();
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
    { width: 844, height: 390, min: 54 },
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
  test('a provider tapped before the box is ticked brings the answer and the box into view, each time', async ({ page }) => {
    await seed(page, MAYA);
    await openAccountScreen(page, '/signup');
    const answer = page.getByText('Tick the box above to create the account.');
    const box = page.getByRole('checkbox', { name: /I am a parent or guardian/ });
    const heading = page.getByRole('heading', { level: 1 });
    for (const name of ['Continue with Google', 'Continue with Apple']) {
      // The notice pushes the box down, so from the providers the answer starts below the screen.
      await heading.evaluate((e) => e.scrollIntoView({ block: 'start' }));
      await page.getByRole('button', { name }).tap();
      await expect(answer, name).toBeInViewport({ ratio: 1 });
      await expect(box, name).toBeInViewport({ ratio: 1 });
    }
    // Ticking the box takes the answer away, and the screen stays where it is.
    await box.check();
    await expect(answer).toHaveCount(0);
    await expect(box).toBeInViewport({ ratio: 1 });
    // Unticking it is not a new ask: the answer waits until a button asks again.
    await box.uncheck();
    await expect(answer).toHaveCount(0);
  });

  for (const path of ['/signin', '/signup'] as const) {
    test(`${path}: a finger tap on a provider rings the notice at the top, and the ring goes when the grown-up moves on`, async ({ page }) => {
      await seed(page, MAYA);
      await openAccountScreen(page, path);
      if (path === '/signup') await page.getByRole('checkbox', { name: /I am a parent or guardian/ }).check();
      const soon = page.locator('.sc-auth__soon');
      const ring = () => soon.evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(await ring()).toBe('none');
      await page.getByRole('button', { name: 'Continue with Google' }).tap();
      // A finger leaves no focus ring by default and no second notice appears: without this ring the tap looks dead.
      await expect(soon).toBeFocused();
      expect(await ring()).toBe('solid');
      await expect(soon).toBeInViewport();
      await page.getByLabel('Email').tap();
      await expect(soon).not.toBeFocused();
      expect(await ring()).toBe('none');
    });

    test(`${path}: the ring around the notice is whole, inside the form's side gutter`, async ({ page }) => {
      await seed(page, MAYA);
      await openAccountScreen(page, path);
      if (path === '/signup') await page.getByRole('checkbox', { name: /I am a parent or guardian/ }).check();
      await page.getByRole('button', { name: 'Continue with Google' }).tap();
      const soon = page.locator('.sc-auth__soon');
      await expect(soon).toBeFocused();
      // The form scrolls, so it cuts off anything past its own edge. All in the app's own units (the tablet zooms 1.4).
      const fit = await soon.evaluate((el) => {
        const zoom = el.getBoundingClientRect().width / (el as HTMLElement).offsetWidth;
        const form = el.closest('.sc-auth__body')!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          ring: parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset),
          left: (box.left - form.left) / zoom,
          right: (form.right - box.right) / zoom,
        };
      });
      expect(fit.ring).toBeGreaterThan(0);
      expect(fit.ring).toBeLessThanOrEqual(fit.left);
      expect(fit.ring).toBeLessThanOrEqual(fit.right);
    });

    test(`${path}: a finger on the notice itself draws no ring, since the notice is not a control`, async ({ page }) => {
      await seed(page, MAYA);
      await openAccountScreen(page, path);
      const soon = page.locator('.sc-auth__soon');
      await soon.tap();
      await expect(soon).not.toBeFocused();
      expect(await soon.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
    });
  }

  test('Sign in opens with one compact coming-soon notice under the heading, and a provider or Sign in adds no second', async ({ page }) => {
    await seed(page, MAYA);
    await openAccountScreen(page, '/signin');
    expect(await noticePlace(page)).toEqual({ count: 1, afterHeading: true, beforeFields: true, compact: true });
    const top = page.locator('.sc-notice').first();
    const soon = page.locator('.sc-auth__soon');
    await expect(top).toBeInViewport();
    await expect(soon).not.toBeFocused();
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await page.waitForTimeout(300);
    expect((await noticePlace(page)).count).toBe(1);
    // The answer moves focus to the notice already there, so a screen reader reads it out again.
    await expect(soon).toBeFocused();
    await page.getByLabel('Email').fill('sam@example.com');
    await page.getByLabel('Password', { exact: true }).fill('a-long-password');
    await expect(soon).not.toBeFocused();
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForTimeout(300);
    expect((await noticePlace(page)).count).toBe(1);
    // The answer points at the notice that is already there.
    await expect(top).toBeInViewport();
    await expect(soon).toBeFocused();
  });

  test('Sign up opens with one compact coming-soon notice under the heading, and Create account adds no second', async ({ page }) => {
    await seed(page, MAYA);
    await openAccountScreen(page, '/signup');
    expect(await noticePlace(page)).toEqual({ count: 1, afterHeading: true, beforeFields: true, compact: true });
    // Without the box ticked, the box's own error still shows.
    await page.getByRole('button', { name: 'Continue with Apple' }).click();
    await expect(page.getByText('Tick the box above to create the account.')).toBeVisible();
    await page.getByRole('checkbox', { name: /I am a parent or guardian/ }).check();
    const soon = page.locator('.sc-auth__soon');
    await expect(soon).not.toBeFocused();
    await page.getByRole('button', { name: 'Continue with Apple' }).click();
    await page.waitForTimeout(300);
    expect((await noticePlace(page)).count).toBe(1);
    await expect(soon).toBeFocused();
    await page.getByLabel('Email').fill('sam@example.com');
    await page.getByLabel('Password').fill('a-long-password');
    const create = page.getByRole('button', { name: 'Create account' });
    await create.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await expect(create).toBeInViewport({ ratio: 1 });
    await expect(soon).not.toBeFocused();
    await create.click();
    await page.waitForTimeout(300);
    expect((await noticePlace(page)).count).toBe(1);
    // Focus, and the screen, go back up to the notice, even from the bottom of a short screen.
    await expect(soon).toBeFocused();
    await expect(page.locator('.sc-notice').first()).toBeInViewport();
    await expect(page.getByRole('heading', { name: 'Create your family account' })).toBeVisible();
  });
}

accountCases();

test.describe('decision 31 at 375x667, 1194x834 and 844x390', () => {
  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1194, height: 834 },
    { width: 844, height: 390 },
  ]) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
      test.use({ viewport, isMobile: true, hasTouch: true });
      accountCases();
    });
  }
});
