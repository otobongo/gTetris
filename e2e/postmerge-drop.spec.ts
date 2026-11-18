/**
 * Brick Drop checks that need batch ui's LevelCard sticker row (decision 19, interface STICKER). They fail
 * before the merge only because LevelCard has no sticker prop yet; the orchestrator runs them after it. The phone held
 * sideways needs batch ui's short frame: before the merge the tiles have no room for the speaker at that height.
 */
import { expect, test } from '@playwright/test';
import { dots, levelCard, planDropPuzzle, playDropPuzzle, recordSpeech, savedRun, seed, starsUpTo } from './app';

test.describe('a phone held sideways (844 x 390)', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test('the speaker sits under Rows, clear of the well and the pad, and the paused line stays over the well @phone-only', async ({ page }) => {
    const spoken = await recordSpeech(page);
    await seed(page, [{ id: 'kai', name: 'Kai', ageBand: '7-8', games: { drop: { stars: starsUpTo(2) } } }]);
    await page.goto('/#/game/drop/3');
    await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();
    await expect(page.locator('.drop-say')).toContainText('Press any button to start.');

    const help = page.getByRole('button', { name: 'Hear the help line', exact: true });
    const board = page.getByRole('group', { name: /^Board\./ });
    const pad = page.getByRole('group', { name: 'Controls' });
    const [h, rows, well, controls, tiles] = await Promise.all(
      [help, page.locator('.drop-tile').filter({ hasText: 'Rows' }), board, pad, page.locator('.drop-tiles')].map(async (l) => (await l.boundingBox())!),
    );
    expect(Math.round(h.width)).toBe(54);
    expect(Math.round(h.height)).toBe(54);
    expect(Math.round(tiles.width)).toBe(88);
    expect(h.y).toBeGreaterThanOrEqual(rows.y + rows.height);
    expect(h.y + h.height).toBeLessThanOrEqual(controls.y);
    expect(h.x).toBeGreaterThanOrEqual(well.x + well.width);

    // The screen scrolls at this height: a tap on the speaker reads the line and leaves the scroll where it is.
    await help.scrollIntoViewIfNeeded();
    const scroller = page.locator('.bw-screen');
    const top = await scroller.evaluate((el) => el.scrollTop);
    await help.tap();
    await expect.poll(spoken).toEqual(['Press any button to start. New brick: Corner.']);
    expect(await scroller.evaluate((el) => el.scrollTop)).toBe(top);

    await pad.getByRole('button', { name: 'Down', exact: true }).tap();
    await page.getByRole('button', { name: 'Pause', exact: true }).tap();
    const line = page.locator('.drop-say__line').first();
    await expect(line).toHaveText('Paused. Press any button to play.');
    const text = (await line.boundingBox())!;
    const wellNow = (await board.boundingBox())!;
    expect(Math.abs(text.x + text.width / 2 - (wellNow.x + wellNow.width / 2))).toBeLessThanOrEqual(1);

    await pad.getByRole('button', { name: 'Left', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect(page.locator('.drop-say')).toHaveText('');
  });
});

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
