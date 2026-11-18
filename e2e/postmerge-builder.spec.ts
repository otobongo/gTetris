/**
 * Picture Builder after the round 2 merge (decision 13): the board half (this batch) and the kit half (batch kit,
 * `keepDraft`) together. Leaving a puzzle with one wrong brick and coming back keeps that brick and its star slip,
 * so solving the puzzle saves a count of 1, after Back and after a reload. Before the kit half is merged, the board
 * comes back but the slip does not, and these fail on the saved count only.
 */
import { expect, test, type Page } from '@playwright/test';
import { builderBoard, builderPicture, builderSquare, builderStroke, builderSwatch, BUILDER_COLORS, homeCard, savedRun, seed } from './app';

const help = (page: Page) => page.locator('.bw-helprow__line');
/** What the board holds, read from each square's brick (its name can carry ", not right" on a copy level). */
const boardBricks = (page: Page) => builderBoard(page).locator('[data-cell]').evaluateAll((els) => els.map((e) => e.getAttribute('data-brick')));

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
    const kept = await boardBricks(page);

    if (how === 'back') {
      await page.getByRole('link', { name: 'Back to home' }).click();
      await homeCard(page, 'Picture Builder').click();
    } else await page.reload();
    await expect(page).toHaveURL(/#\/game\/builder\/1$/);
    await expect.poll(() => boardBricks(page)).toEqual(kept);

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

/** Lay every brick of the picture over whatever the board holds. */
async function buildOver(page: Page, picture: { size: number; cells: (string | null)[] }) {
  for (const color of BUILDER_COLORS) {
    if (!picture.cells.includes(color)) continue;
    await builderSwatch(page, color).click();
    for (let i = 0; i < picture.cells.length; i++) if (picture.cells[i] === color) await builderSquare(page, picture.size, i).click();
  }
}

/** Two wrong bricks in one drag: one star slip. Returns the picture and the colour laid. */
async function dragTwoWrong(page: Page) {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/builder');
  await expect(page).toHaveURL(/#\/game\/builder\/1$/);
  const picture = await builderPicture(page);
  const wrong = BUILDER_COLORS.find((c) => c !== picture.cells[0] && c !== picture.cells[1])!;
  await builderSwatch(page, wrong).click();
  await builderStroke(page, picture.size, [0, 1]);
  await expect.poll(async () => (await boardBricks(page)).filter(Boolean).length).toBe(2);
  return { picture, wrong };
}

test('a drag with two wrong bricks, a reload, and the second laid again: still 1 slip', async ({ page }) => {
  const { picture, wrong } = await dragTwoWrong(page);
  await page.reload();
  await expect.poll(async () => (await boardBricks(page)).filter(Boolean).length).toBe(2);
  await builderSwatch(page, 'eraser').click();
  await builderSquare(page, picture.size, 1).click();
  await builderSwatch(page, wrong).click();
  await builderSquare(page, picture.size, 1).click();
  await buildOver(page, picture);
  await expect(help(page)).toHaveText(`You built the ${picture.name}.`);
  expect((await savedRun(page, 'builder', 0)).solved[0].count).toBe(1);
});

test('a drag with two wrong bricks, both erased, a reload, and the second laid again: still 1 slip', async ({ page }) => {
  const { picture, wrong } = await dragTwoWrong(page);
  await builderSwatch(page, 'eraser').click();
  await builderSquare(page, picture.size, 0).click();
  await builderSquare(page, picture.size, 1).click();
  await page.reload();
  await expect(builderBoard(page).locator('[data-cell]').first()).toBeVisible();
  await expect.poll(async () => (await boardBricks(page)).filter(Boolean).length).toBe(0);
  await builderSwatch(page, wrong).click();
  await builderSquare(page, picture.size, 1).click();
  await buildOver(page, picture);
  await expect(help(page)).toHaveText(`You built the ${picture.name}.`);
  expect((await savedRun(page, 'builder', 0)).solved[0].count).toBe(1);
});

test('a child with no player yet: one wrong brick and a reload keep the brick and its slip together', async ({ page }) => {
  await page.goto('/#/game/builder');
  await expect(page).toHaveURL(/#\/game\/builder\/1$/);
  const picture = await builderPicture(page);
  const at = picture.cells.findIndex(Boolean);
  const wrong = BUILDER_COLORS.find((c) => c !== picture.cells[at])!;
  await builderSwatch(page, wrong).click();
  await builderSquare(page, picture.size, at).click();
  const kept = await boardBricks(page);
  await page.reload();
  await expect.poll(() => boardBricks(page)).toEqual(kept);
  await buildOver(page, picture);
  await expect(help(page)).toHaveText(`You built the ${picture.name}.`);
  expect((await savedRun(page, 'builder', 0)).solved[0].count).toBe(1);
});
