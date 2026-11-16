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

    // Spaces only count as empty too.
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
});
