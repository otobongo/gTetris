/**
 * Brick Escape's side of three pieces another batch (ui) builds, checked once everything is merged:
 * - decision 8: the stuck offer's New puzzle button wears the 2 s cue ring at ages 3 to 4 only;
 * - decision 19: finishing the last level of chapter 1 shows Escape's new sticker on the level card;
 * - decision 25: after Hint the capped-star mark sits beside the dots, and the dots' own name is unchanged.
 * Before the merge these fail only because IconButton, LevelCard and PuzzleDots do not have the props yet.
 */
import { expect, test, type Page } from '@playwright/test';
import { type Band, dots, escapePuzzleOnScreen, levelCard, savedState, seed, solveEscapeBoard, starsUpTo } from './app';

async function openLevel(page: Page, level: number, band: Band) {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: band, games: { escape: { stars: starsUpTo(level) } } }]);
  await page.goto(`/#/game/escape/${level + 1}`);
  await expect(page.locator('.esc-brick').first()).toBeVisible();
}

/** Restart until the stuck offer shows, at most five times. */
async function bringOffer(page: Page) {
  const offer = page.getByRole('button', { name: 'New puzzle' });
  for (let i = 0; i < 5 && !(await offer.count()); i++) await page.getByRole('button', { name: 'Restart puzzle' }).click();
  await expect(offer).toBeVisible();
  return offer;
}

test.describe('decision 8: the New puzzle cue @phone-only', () => {
  test('ages 3 to 4: the offer appears with the cue ring, and loses it after 2 s', async ({ page }) => {
    await openLevel(page, 0, '3-4');
    const offer = await bringOffer(page);
    await expect(offer).toHaveClass(/\bis-cue\b/);
    await expect(offer).not.toBeFocused();
    await expect(offer).not.toHaveClass(/\bis-cue\b/, { timeout: 4_000 });
  });

  test('ages 5 to 6: the offer appears with no cue ring', async ({ page }) => {
    await openLevel(page, 0, '5-6');
    const offer = await bringOffer(page);
    await expect(offer).not.toHaveClass(/\bis-cue\b/);
  });
});

test('decision 19: finishing the last level of chapter 1 shows the new sticker on the level card', async ({ page }) => {
  // chapter 1 is Levels 1 to 8; the first seven already have stars
  await openLevel(page, 7, '7-8');
  for (let n = 1; n <= 4; n++) {
    await solveEscapeBoard(page, 7, await escapePuzzleOnScreen(page, 7));
    if (n < 4) await page.getByRole('button', { name: 'Next puzzle' }).click();
  }
  const card = levelCard(page);
  await expect(card).toBeVisible();
  // Escape gave its own chapter 1 sticker when the level finished (this part works before the merge too)
  expect(Object.keys((await savedState(page)).players[0].stickers)).toEqual(['e1']);
  await expect(card).toContainText('New sticker: Open door.');
  await expect(card.locator('.bw-levelcard__sticker')).toBeVisible();
});

test('decision 25: after Hint the capped-star mark shows beside the dots, and the dots keep their name', async ({ page }) => {
  await openLevel(page, 0, '7-8');
  const name = await dots(page).getAttribute('aria-label');
  await expect(page.locator('.bw-dots__cap')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hint' }).click();
  await expect(page.locator('.bw-dots__cap')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Hint used. Up to 2 stars.' })).toBeVisible();
  await expect(dots(page)).toHaveAttribute('aria-label', name!);
});
