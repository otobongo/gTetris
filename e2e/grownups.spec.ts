/**
 * The grown-up side of four-puzzle levels (brief 7.3, 6.2): setting a level for a child who is not playing,
 * and starting one game over from the picker while the other games and the stickers stay.
 */
import { expect, test, type Page } from '@playwright/test';
import { homeCard, openSettings, savedGame, savedState, seed, starsUpTo } from './app';

test('a grown-up sets a level for another child, who then opens it from Home', async ({ page }) => {
  await seed(page, [
    { id: 'maya', name: 'Maya', ageBand: '7-8', games: { escape: { stars: starsUpTo(9) } } },
    { id: 'leo', name: 'Leo', ageBand: '5-6' },
  ]);
  await openSettings(page);
  await page.getByRole('button', { name: /^Leo/ }).click();
  await page.getByRole('link', { name: 'Brick Escape for Leo: Level 1. Pick a level' }).click();
  await expect(page).toHaveURL(/#\/settings\/levels\/escape\/leo$/);
  await expect(page.getByText('Leo · 0 of 93 stars')).toBeVisible();

  await page.getByRole('button', { name: 'Level 5, locked' }).click();
  await expect(page.getByRole('status')).toHaveText('Level 5 picked. Leo hasn’t reached it yet.');
  await page.getByRole('button', { name: 'Set Level 5 for Leo' }).click();

  // Back on Settings, still on Leo, with the toast.
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByText('Leo plays Level 5 next in Brick Escape.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Brick Escape for Leo: Level 5. Pick a level' })).toBeVisible();
  expect((await savedGame(page, 'escape', 'leo'))?.current).toBe(4);
  // Maya's game is untouched.
  expect((await savedGame(page, 'escape', 'maya'))?.current).toBeUndefined();

  // Leo picks his brick and his Home card opens Level 5.
  await page.goto('/#/players');
  await page.getByRole('button', { name: /^Leo/ }).click();
  await page.getByRole('link', { name: 'Play as Leo' }).click();
  await expect(page.getByRole('heading', { name: 'Hi Leo!' })).toBeVisible();
  await expect(homeCard(page, 'Brick Escape')).toContainText('Level 5');
  await homeCard(page, 'Brick Escape').click();
  await expect(page).toHaveURL(/#\/game\/escape\/5$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 5');
});

test('starting one game over keeps the other games and the stickers', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8', games: { escape: { stars: starsUpTo(9) }, letters: { stars: starsUpTo(3) } } }]);
  // Home turns the finished Getting started chapter into a sticker.
  await page.goto('/');
  await expect(homeCard(page, 'Brick Escape')).toContainText('Level 10');
  await expect.poll(async () => Object.keys((await savedState(page)).players[0].stickers).length).toBeGreaterThan(0);
  const stickers = (await savedState(page)).players[0].stickers;

  await openSettings(page);
  await page.getByRole('link', { name: 'Brick Escape for Maya: Level 10. Pick a level' }).click();
  await page.getByRole('button', { name: 'Reset Brick Escape for Maya' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Reset Brick Escape for Maya?' });
  await expect(confirm).toContainText('Levels and stars in Brick Escape go back to Level 1 on this device. Stickers stay. This can’t be undone.');
  // Keep it is the safe default.
  await expect(confirm.getByRole('button', { name: 'Keep it' })).toBeFocused();
  await confirm.getByRole('button', { name: 'Reset Brick Escape' }).click();
  await expect(page.getByRole('status')).toHaveText('Brick Escape starts again at Level 1 for Maya.');

  const state = await savedState(page);
  const maya = state.players[0];
  // The game goes back to empty (the store may drop its record altogether).
  const escape = maya.games.escape;
  expect(escape?.unlocked ?? 0).toBe(0);
  expect(escape?.stars ?? {}).toEqual({});
  expect(escape?.best ?? {}).toEqual({});
  expect(escape?.current).toBeUndefined();
  expect(escape?.runs ?? {}).toEqual({});
  expect(Object.keys(maya.games.letters.stars)).toHaveLength(3);
  expect(maya.stickers).toEqual(stickers);

  await page.getByRole('link', { name: 'Back to settings' }).click();
  await expect(page.getByRole('link', { name: 'Brick Escape for Maya: Level 1. Pick a level' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Letter Builder for Maya: Level 4. Pick a level' })).toBeVisible();
});

/* ---------- Back returns to the screen the grown-up came from (app-grownups-2, app-grownups-8) ---------- */

const legalLink = (page: Page, name: string) => page.getByRole('navigation', { name: 'Help and legal' }).getByRole('link', { name, exact: true });

test('Back on Terms opened from Support goes to Support', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await openSettings(page);
  await legalLink(page, 'Support').click();
  await expect(page).toHaveURL(/#\/help$/);
  await expect(page.getByRole('link', { name: 'Back to settings' })).toBeVisible();
  await page.getByRole('link', { name: 'Terms of use' }).click();
  await expect(page).toHaveURL(/#\/help\/terms$/);
  await expect(page.getByRole('link', { name: 'Back to support' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to support' }).click();
  await expect(page).toHaveURL(/#\/help$/);
});

test('Back on Sign up opened from Sign in goes to Sign in', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await openSettings(page);
  await page.getByRole('link', { name: 'Use email instead' }).click();
  await expect(page).toHaveURL(/#\/signin$/);
  await page.getByRole('link', { name: 'Create a family account' }).click();
  await expect(page).toHaveURL(/#\/signup$/);
  await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await expect(page).toHaveURL(/#\/signin$/);
});

test('Back on Support opened from Sign in goes to Sign in', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await openSettings(page);
  await page.getByRole('link', { name: 'Use email instead' }).click();
  await expect(page).toHaveURL(/#\/signin$/);
  await legalLink(page, 'Support').click();
  await expect(page).toHaveURL(/#\/help$/);
  await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await expect(page).toHaveURL(/#\/signin$/);
});

test('Cancel on the grown-up check reached from Who’s playing goes back to Who’s playing', async ({ page }) => {
  await seed(page, [
    { id: 'maya', name: 'Maya', ageBand: '7-8' },
    { id: 'leo', name: 'Leo', ageBand: '5-6' },
  ]);
  await page.goto('/#/players');
  await expect(page.getByRole('heading', { name: "Who's playing?" })).toBeVisible();
  await page.getByRole('link', { name: /^Add a child/ }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole('link', { name: "Back to Who's playing" })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/#\/players$/);
  await expect(page.getByRole('heading', { name: "Who's playing?" })).toBeVisible();
});

/* ---------- Review cases: the check's Back link, the other ways in, and longer journeys ---------- */

test('a tap on Back on the grown-up check reached from Who’s playing goes back to Who’s playing', async ({ page }) => {
  await seed(page, [
    { id: 'maya', name: 'Maya', ageBand: '7-8' },
    { id: 'leo', name: 'Leo', ageBand: '3-4' },
  ]);
  await page.goto('/#/players');
  await expect(page.getByRole('heading', { name: "Who's playing?" })).toBeVisible();
  await page.getByRole('link', { name: /^Add a child/ }).tap();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.locator('.sc-gate__sum')).toBeVisible();
  await page.getByRole('link', { name: "Back to Who's playing" }).tap();
  await expect(page).toHaveURL(/#\/players$/);
  await expect(page.getByRole('heading', { name: "Who's playing?" })).toBeVisible();
});

test('Cancel and Back on the grown-up check reached from Home go Home', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/');
  await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole('link', { name: "Back to Who's playing" })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '#/');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
});

test('Cancel on the grown-up check when Settings is the first page opened goes Home, inside the app', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10' }]);
  await page.goto('/#/settings');
  await expect(page.locator('.sc-gate__sum')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to home' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
});

test('Back on Privacy opened from Support goes to Support, and Back there goes to Settings', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await openSettings(page);
  await legalLink(page, 'Support').click();
  await expect(page).toHaveURL(/#\/help$/);
  await page.getByRole('link', { name: /Privacy policy/ }).click();
  await expect(page).toHaveURL(/#\/help\/privacy$/);
  await page.getByRole('link', { name: 'Back to support' }).click();
  await expect(page).toHaveURL(/#\/help$/);
  // Support came from Privacy now, which its Back does not return to, so it goes to Settings.
  await page.getByRole('link', { name: 'Back to settings' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
});

test('Back on Terms opened from Sign up goes to Sign up', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await openSettings(page);
  await page.getByRole('link', { name: 'Use email instead' }).click();
  await page.getByRole('link', { name: 'Create a family account' }).click();
  await expect(page).toHaveURL(/#\/signup$/);
  await page.getByRole('link', { name: 'Terms of use', exact: true }).click();
  await expect(page).toHaveURL(/#\/help\/terms$/);
  await page.getByRole('link', { name: 'Back to sign up' }).click();
  await expect(page).toHaveURL(/#\/signup$/);
  await expect(page.getByRole('heading', { name: 'Create your family account' })).toBeVisible();
});
