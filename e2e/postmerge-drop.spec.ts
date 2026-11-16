/**
 * Brick Drop checks that need batch ui's LevelCard sticker row (decision 19, interface STICKER). They fail
 * before the merge only because LevelCard has no sticker prop yet; the orchestrator runs them after it.
 */
import { expect, test } from '@playwright/test';
import { dots, levelCard, planDropPuzzle, playDropPuzzle, savedRun, seed, starsUpTo } from './app';

test('finishing Stage 3, the last of chapter 1, shows the new sticker on the stage card', async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'kai', name: 'Kai', ageBand: '7-8', games: { drop: { stars: starsUpTo(2) } } }]);
  await page.goto('/#/game/drop/3');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
  await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();

  for (let n = 1; n <= 4; n++) {
    if (n > 1) await page.getByRole('button', { name: 'Next puzzle' }).click();
    await expect(page.locator('.drop-say')).toContainText('Press any button to start.');
    const puzzle = (await savedRun(page, 'drop', 2)).queue[0];
    await playDropPuzzle(page, planDropPuzzle(2, puzzle));
  }
  await expect(dots(page)).toHaveAttribute('aria-label', '4 of 4 solved.');
  await page.clock.runFor(700);

  const card = levelCard(page);
  await expect(card.getByRole('heading')).toHaveText('You finished Stage 3');
  const row = card.locator('.bw-levelcard__sticker');
  await expect(row).toBeVisible();
  await expect(row).toContainText('New sticker: Tiny tower.');
  // VoiceOver reads the sticker with the fact line
  const id = await row.getAttribute('id');
  expect(id).toMatch(/-sticker$/);
  expect((await card.getAttribute('aria-describedby'))?.split(' ')).toContain(id);
  // the card's buttons stay on screen
  const size = page.viewportSize()!;
  for (const name of ['Play Stage 4', 'Back to games']) {
    const b = (await card.getByRole(name === 'Back to games' ? 'link' : 'button', { name }).boundingBox())!;
    expect(b.y + b.height).toBeLessThanOrEqual(size.height);
  }
});
