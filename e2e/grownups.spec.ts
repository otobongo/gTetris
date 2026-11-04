/**
 * The grown-up side of four-puzzle levels (brief 7.3, 6.2): setting a level for a child who is not playing,
 * and starting one game over from the picker while the other games and the stickers stay.
 */
import { expect, test } from '@playwright/test';
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
