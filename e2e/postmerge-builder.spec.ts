/**
 * Picture Builder after the round 2 merge (decision 13): the board half (this batch) and the kit half (batch kit,
 * `keepDraft`) together. Leaving a puzzle with one wrong brick and coming back keeps that brick and its star slip,
 * so solving the puzzle saves a count of 1, after Back and after a reload. Before the kit half is merged, the board
 * comes back but the slip does not, and these fail on the saved count only.
 */
import { expect, test, type Page } from '@playwright/test';
import { builderBoardCells, builderPicture, builderSquare, builderSwatch, BUILDER_COLORS, homeCard, savedRun, seed } from './app';

const help = (page: Page) => page.locator('.bw-helprow__line');

for (const how of ['back', 'reload'] as const) {
  test(`one wrong brick, then ${how === 'back' ? 'Back to home and in again' : 'a reload'}: the solve saves 1 slip`, async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
    await page.goto('/#/game/builder');
    await expect(page).toHaveURL(/#\/game\/builder\/1$/);
    const picture = await builderPicture(page);
    const { size, cells } = picture;

    // One wrong brick on a square of the picture.
    const at = cells.findIndex(Boolean);
    const wrong = BUILDER_COLORS.find((c) => c !== cells[at])!;
    await builderSwatch(page, wrong).click();
    await builderSquare(page, size, at).click();
    await expect(help(page)).toHaveText('One brick is not quite right.');
    const kept = await builderBoardCells(page);

    if (how === 'back') {
      await page.getByRole('link', { name: 'Back to home' }).click();
      await homeCard(page, 'Picture Builder').click();
    } else await page.reload();
    await expect(page).toHaveURL(/#\/game\/builder\/1$/);
    await expect.poll(() => builderBoardCells(page)).toEqual(kept);

    // Build the picture over it: the wrong brick is replaced by the right one.
    for (const color of BUILDER_COLORS) {
      if (!cells.includes(color)) continue;
      await builderSwatch(page, color).click();
      for (let i = 0; i < cells.length; i++) if (cells[i] === color) await builderSquare(page, size, i).click();
    }
    await expect(help(page)).toHaveText(`You built the ${picture.name}.`);
    const run = await savedRun(page, 'builder', 0);
    expect(run.solved).toEqual([{ puzzle: 0, count: 1, usedHint: false, outOfTime: false }]);
  });
}
