/**
 * Usability batch D: Settings and the grown-up check.
 * - app-grownups-5: Back from a game's level picker, or Set Level N for a child, lands where the grown-up was,
 *   not at the top of Settings two screens above the Progress rows.
 * - app-grownups-6: Add a child scrolls its form into view and puts the cursor in the name field.
 *   Who's playing on the first run keeps its form as it was, with no field focused.
 * - app-grownups-10: Check with an empty field keeps the sum and shows a hint, not an error.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { openSettings, passGrownUpCheck, seed } from './app';

const FAMILY = [
  { id: 'maya', name: 'Maya', ageBand: '7-8' as const },
  { id: 'leo', name: 'Leo', ageBand: '5-6' as const },
];

const scroller = (page: Page): Locator => page.locator('.sc-scroll').first();
const scrollTop = (page: Page): Promise<number> => scroller(page).evaluate((el) => el.scrollTop);
const escapeRow = (page: Page, child: string): Locator => page.getByRole('link', { name: new RegExp(`^Brick Escape for ${child}: Level \\d+\\. Pick a level$`) });

/** Scroll Settings until the row sits near the top of the scroller, as a grown-up would before tapping it. */
async function scrollToRow(page: Page, row: Locator): Promise<number> {
  await row.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await expect(row).toBeInViewport({ ratio: 1 });
  const top = await scrollTop(page);
  // A real scroll, so the check below means something at every size.
  expect(top).toBeGreaterThan(200);
  return top;
}

/** The element's box lies wholly inside the window, and nothing covers its middle. */
async function expectFullyVisible(page: Page, el: Locator) {
  const box = await el.boundingBox();
  const view = page.viewportSize()!;
  expect(box, 'element has a box').not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(view.height);
  expect(box!.x + box!.width).toBeLessThanOrEqual(view.width);
  const onTop = await el.evaluate((node) => {
    const r = node.getBoundingClientRect();
    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === node;
  });
  expect(onTop, 'nothing covers the element').toBe(true);
}

test.describe('Settings keeps its place around the level picker', () => {
  test('Back from the picker returns to the Progress row it was opened from', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    const row = escapeRow(page, 'Maya');
    const before = await scrollToRow(page, row);

    await row.click();
    await expect(page).toHaveURL(/#\/settings\/levels\/escape\/maya$/);
    await page.getByRole('link', { name: 'Back to settings' }).click();

    await expect(page).toHaveURL(/#\/settings$/);
    await expect(escapeRow(page, 'Maya')).toBeVisible();
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(before - 40);
    expect(Math.abs((await scrollTop(page)) - before)).toBeLessThanOrEqual(40);
    await expect(escapeRow(page, 'Maya')).toBeInViewport({ ratio: 1 });
  });

  test('Set Level N for a child who is not playing returns to the same place, with the toast', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    await page.getByRole('button', { name: /^Leo/ }).click();
    const row = escapeRow(page, 'Leo');
    const before = await scrollToRow(page, row);

    await row.click();
    await expect(page).toHaveURL(/#\/settings\/levels\/escape\/leo$/);
    await page.getByRole('button', { name: 'Level 5, locked' }).click();
    await page.getByRole('button', { name: 'Set Level 5 for Leo' }).click();

    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByText('Leo plays Level 5 next in Brick Escape.')).toBeVisible();
    const after = page.getByRole('link', { name: 'Brick Escape for Leo: Level 5. Pick a level' });
    await expect(after).toBeVisible();
    await expect.poll(() => scrollTop(page)).toBeGreaterThan(before - 40);
    expect(Math.abs((await scrollTop(page)) - before)).toBeLessThanOrEqual(40);
    await expect(after).toBeInViewport({ ratio: 1 });
  });

  test('Settings opened from Home still starts at the top', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    await scrollToRow(page, escapeRow(page, 'Maya'));
    // Leave by the top bar, then come back through Home: a fresh visit, not a return from the picker.
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await passGrownUpCheck(page);
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeAttached();
    expect(await scrollTop(page)).toBe(0);
  });

  // Review of batch D: the picker for the child who is playing ends in the game, not Settings, so the
  // place kept for the way back must not wait there for the next, unrelated visit to Settings.
  test('Play Level N for the child who is playing, then a later visit to Settings starts at the top', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    const row = escapeRow(page, 'Maya');
    await scrollToRow(page, row);

    await row.click();
    await expect(page).toHaveURL(/#\/settings\/levels\/escape\/maya$/);
    await page.getByRole('button', { name: 'Level 3, locked' }).click();
    await page.getByRole('button', { name: 'Play Level 3' }).click();
    await expect(page).toHaveURL(/#\/game\/escape\/3$/);

    // Home from the game, then the gear again: the game ended the grown-up pass, so the check opens first.
    await page.getByRole('button', { name: 'Back to home' }).or(page.getByRole('link', { name: 'Back to home' })).first().click();
    await expect(page).toHaveURL(/#\/$/);
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await passGrownUpCheck(page);
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Save your progress' })).toBeInViewport();
    expect(await scrollTop(page)).toBe(0);
  });
});

/* ---------- Review of batch D: the same return by every way back, at every size and age band ---------- */

/** Open Maya's Brick Escape picker from its Progress row and come back by `back`: the row is where it was. */
async function returnKeepsPlace(page: Page, back: (page: Page) => Promise<unknown>) {
  const row = escapeRow(page, 'Maya');
  // Centred, not at the top: on the landscape iPad the list is short enough that Settings scrolls to its end
  // first, and the row then sits a fraction of a pixel under the top bar.
  await row.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await expect(row).toBeInViewport({ ratio: 1 });
  const before = await scrollTop(page);
  expect(before).toBeGreaterThan(200);
  await row.click();
  await expect(page).toHaveURL(/#\/settings\/levels\/escape\/maya$/);
  await expect(page.getByRole('link', { name: 'Back to settings' })).toBeVisible();
  await back(page);

  await expect(page).toHaveURL(/#\/settings$/);
  await expect(escapeRow(page, 'Maya')).toBeVisible();
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(before - 40);
  expect(Math.abs((await scrollTop(page)) - before)).toBeLessThanOrEqual(40);
  await expect(escapeRow(page, 'Maya')).toBeInViewport({ ratio: 1 });
}

const backToSettings = (page: Page) => page.getByRole('link', { name: 'Back to settings' }).click();

test.describe('Settings keeps its place: every way back, size and age', () => {
  test('the device Back gesture from the picker returns to the row too', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    await returnKeepsPlace(page, (p) => p.goBack());
  });

  test('the place is kept once: Back to home and the gear again starts at the top', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    await returnKeepsPlace(page, backToSettings);
    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL(/#\/$/);
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await passGrownUpCheck(page);
    await expect(page.getByRole('heading', { name: 'Save your progress' })).toBeInViewport();
    expect(await scrollTop(page)).toBe(0);
  });

  for (const ageBand of ['3-4', '5-6', '7-8', '9-10'] as const) {
    test(`Back returns to the row for a child aged ${ageBand} @phone-only`, async ({ page }) => {
      await seed(page, [{ id: 'maya', name: 'Maya', ageBand }]);
      await openSettings(page);
      await returnKeepsPlace(page, backToSettings);
    });
  }

  for (const viewport of [
    { width: 375, height: 667 },
    { width: 1194, height: 834 },
  ]) {
    test.describe(`at ${viewport.width}x${viewport.height} @phone-only`, () => {
      test.use({ viewport });

      test('Back from the picker returns to the row', async ({ page }) => {
        await seed(page, FAMILY);
        await openSettings(page);
        await returnKeepsPlace(page, backToSettings);
      });

      test('Add a child puts the cursor in the name field, fully on screen', async ({ page }) => {
        await addChildFocusesName(page);
      });
    });
  }
});

/** Add a child: the cursor goes to the name field, which is fully on screen. */
async function addChildFocusesName(page: Page) {
  await seed(page, FAMILY);
  await openSettings(page);
  await page.getByRole('button', { name: 'Add a child' }).click();
  const name = page.getByLabel("Child's first name");
  await expect(name).toBeFocused();
  await expectFullyVisible(page, name);
  // The grown-up can type straight away.
  await page.keyboard.type('Ada');
  await expect(name).toHaveValue('Ada');
}

test.describe('Add a child', () => {
  test('puts the cursor in the name field, fully on screen', async ({ page }) => {
    await addChildFocusesName(page);
  });

  test.describe('on a small phone @phone-only', () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test('puts the cursor in the name field, fully on screen at 375x667', async ({ page }) => {
      await addChildFocusesName(page);
    });
  });

  test("Who's playing on the first run keeps its form without focusing the name field", async ({ page }) => {
    await seed(page, []);
    await page.goto('/#/players');
    await expect(page.getByRole('heading', { name: 'Add your first child' })).toBeVisible();
    await expect(page.getByLabel("Child's first name")).not.toBeFocused();
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
  });

  // Review of batch D: the form now takes the cursor when it opens, so closing it must not drop the cursor
  // on the page (VoiceOver and the keyboard lose their place): it goes back to Add a child.
  test('Cancel closes the form and puts the cursor back on Add a child', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    const add = page.getByRole('button', { name: 'Add a child' });
    await add.click();
    await expect(page.getByLabel("Child's first name")).toBeFocused();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('form', { name: 'Add a child' })).toHaveCount(0);
    await expect(add).toBeFocused();
    await expect(add).toHaveAttribute('aria-expanded', 'false');
    await expect(add).toBeInViewport({ ratio: 1 });
  });

  test('Add child closes the form, picks the new child and puts the cursor back on Add a child', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    const add = page.getByRole('button', { name: 'Add a child' });
    await add.click();
    await page.keyboard.type('Ada');
    await page.keyboard.press('Enter');
    await expect(page.getByText("Ada was added. They can now pick their brick on Who's playing.")).toBeVisible();
    await expect(page.getByRole('button', { name: /^Ada/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(add).toBeFocused();
  });
});

test.describe('The grown-up check', () => {
  test('Check with an empty field keeps the sum and shows a hint, not an error', async ({ page }) => {
    await seed(page, FAMILY);
    await page.goto('/#/');
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    const sum = page.locator('.sc-gate__sum');
    const field = page.getByLabel(/^Answer for \d+ plus \d+$/);
    const question = (await sum.textContent()) ?? '';
    expect(question).toMatch(/^What is \d+ \+ \d+\?$/);

    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Type the answer, then tap Check' })).toBeVisible();
    await expect(sum).toHaveText(question);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(field).not.toHaveAttribute('aria-invalid', 'true');
    await expect(field).toBeFocused();

    // Spaces only: the field takes digits only (its pattern), so the browser holds the form back before
    // Check runs. Either way it is no wrong answer and the sum stays. (checkGateAnswer calls it empty.)
    await field.fill('   ');
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(sum).toHaveText(question);
    await expect(page.getByRole('alert')).toHaveCount(0);

    // A wrong answer still brings a new sum and the error, as before. Every answer is 22 to 98, so 1 never passes.
    await field.fill('1');
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText("That answer doesn't match. Try this new sum.");
    await expect(sum).not.toHaveText(question);
    await expect(page.getByText('Type the answer, then tap Check')).toHaveCount(0);
    await expect(field).toBeFocused();

    // And the right answer to the new sum still opens Settings.
    await passGrownUpCheck(page);
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeAttached();
  });

  // Review of batch D: a status region that arrives with its text in it is often not read (VoiceOver
  // especially), so the hint's region waits on the page, empty, and takes no room until it speaks.
  test("the hint's status region is there, empty, before the first Check, and takes no room", async ({ page }) => {
    await seed(page, FAMILY);
    await page.goto('/#/');
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    const gate = page.locator('.sc-gate');
    const field = page.getByLabel(/^Answer for \d+ plus \d+$/);
    await expect(field).toBeFocused();

    const status = gate.getByRole('status');
    await expect(status).toHaveCount(1);
    await expect(status).toHaveText('');
    // The field and the buttons are one form gap apart, as before the hint existed.
    const spacing = await gate.locator('.sc-gate__form').evaluate((form) => {
      const field = form.querySelector('.sc-field')!.getBoundingClientRect();
      const row = form.querySelector('.sc-row')!.getBoundingClientRect();
      const zoom = (form as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
      return { between: row.top - field.bottom, gap: parseFloat(getComputedStyle(form).rowGap) * zoom };
    });
    expect(Math.abs(spacing.between - spacing.gap)).toBeLessThan(1);

    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(status).toHaveText('Type the answer, then tap Check.');
    await expect(status).toBeVisible();
    await expect(field).toHaveAttribute('aria-describedby', (await status.getAttribute('id'))!);
  });

  test('Break: Grown-ups: add time treats an empty Check the same way', async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8', dailyLimit: 10, minutesToday: 12 }]);
    await page.goto('/#/break');
    await page.getByRole('button', { name: 'Grown-ups: add time' }).click();
    const sum = page.locator('.sc-gate__sum');
    const question = (await sum.textContent()) ?? '';
    expect(question).toMatch(/^What is \d+ \+ \d+\?$/);

    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Type the answer, then tap Check.' })).toBeVisible();
    await expect(sum).toHaveText(question);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByLabel(/^Answer for \d+ plus \d+$/)).toBeFocused();
    await expect(page.getByRole('button', { name: 'Check', exact: true })).toBeInViewport({ ratio: 1 });
  });
});
