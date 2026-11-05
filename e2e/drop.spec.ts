/**
 * Brick Drop journey (four-puzzle brief 2.1, 4.2, 5, 9.1, 10): a child clears the four puzzles of Stage 1 and
 * goes straight into Stage 2. Each brick is placed with the keys from a plan the game's own engine makes on the
 * puzzle's fixed starter stack and brick order, so the bricks, the score and the stars the screen shows can be
 * checked against numbers worked out here, not read back from the app.
 */
import { expect, test } from '@playwright/test';
import { dropLevelStars } from '../src/games/run';
import { puzzleTargets } from '../src/games/drop/puzzles';
import type { PuzzleResult } from '../src/shared/progress';
import { dots, homeCard, levelCard, planDropPuzzle, playDropPuzzle, savedGame, savedRun, seed } from './app';

test('a child clears the four puzzles of Stage 1 and goes straight into Stage 2', async ({ page }) => {
  await page.clock.install();
  // Ages 7 to 8 have a counted clock (3 rows x 15 s x 1.5 per puzzle); the clock below never comes near it.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/drop');
  await expect(page).toHaveURL(/#\/game\/drop\/1$/);

  // Entered from Home: the intro sheet, with the per-puzzle goal and the 3-star rule over the 4 puzzles.
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('Clear 3 rows in each puzzle. Solve 4 to finish the stage.');
  await expect(sheet).toContainText(`3 stars: ${4 * puzzleTargets(0, 0).three} bricks or fewer over the 4 puzzles.`);
  // Bricks fall only when the test moves the clock on, so each one lands where the plan puts it.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
  await sheet.getByRole('button', { name: 'Start' }).click();

  const say = page.locator('.drop-say');
  const board = page.getByRole('group', { name: /^Board\./ });
  const pad = page.getByRole('group', { name: 'Controls' });
  const results: PuzzleResult[] = [];
  let score = 0;

  for (let n = 1; n <= 4; n++) {
    await expect(say).toContainText('Press any button to start.');
    await expect(board).toBeFocused();
    const puzzle = (await savedRun(page, 'drop', 0)).queue[0];
    const plan = planDropPuzzle(0, puzzle);
    await playDropPuzzle(page, plan);
    const t = puzzleTargets(0, puzzle);
    results.push({ puzzle, count: plan.bricks, three: t.three, two: t.two, score: plan.score, usedHint: false, outOfTime: false });
    score += plan.score;

    if (n < 4) {
      // The dot fills, the help line counts the bricks, and Next puzzle takes the pad's place, with focus.
      await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${n} of 4. ${n} solved.`);
      await expect(say).toContainText(`Cleared with ${plan.bricks} bricks.`);
      await expect(pad).toHaveCount(0);
      const next = page.getByRole('button', { name: 'Next puzzle' });
      await expect(next).toBeFocused();
      const run = await savedRun(page, 'drop', 0);
      expect(run.solved.map((r) => [r.puzzle, r.count])).toEqual(results.map((r) => [r.puzzle, r.count]));
      await next.click();
      // Same screen, same route; the next stack is drawn and its first brick waits for a press.
      await expect(page).toHaveURL(/#\/game\/drop\/1$/);
      await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${n + 1} of 4. ${n} solved.`);
      await expect(pad).toBeVisible();
    }
  }

  // The fourth solve fills the last dot; the level card opens 600 ms later.
  await expect(dots(page)).toHaveAttribute('aria-label', '4 of 4 solved.');
  await page.clock.runFor(700);
  const card = levelCard(page);
  await expect(card.getByRole('heading')).toHaveText('You finished Stage 1');
  const bricks = results.reduce((s, r) => s + r.count, 0);
  await expect(card).toContainText(`4 puzzles with ${bricks} bricks. Score ${score}.`);
  const three = results.reduce((s, r) => s + r.three!, 0);
  const two = results.reduce((s, r) => s + r.two!, 0);
  await expect(card).toContainText(`3 stars: ${three} bricks or fewer. 2 stars: ${two} or fewer.`);
  const stars = dropLevelStars(results);
  await expect(card.getByRole('img', { name: `${stars} of 3 stars` })).toBeVisible();
  // No clock ran out, so there is no cap line.
  await expect(card).not.toContainText('caps the stage');
  const play = card.getByRole('button', { name: 'Play Stage 2' });
  await expect(play).toBeFocused();
  await expect(card.getByRole('link', { name: 'Back to games' })).toBeVisible();

  const saved = await savedGame(page, 'drop');
  expect(saved?.stars['0']).toBe(stars);
  expect(saved?.best['0']).toBe(score);
  expect(saved?.current).toBe(1);
  expect(saved?.runs?.['0']).toBeUndefined();

  // Escape closes the card; the pad's slot then holds the same Play button, with focus (brief 10).
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  const again = page.getByRole('button', { name: 'Play Stage 2' });
  await expect(again).toBeFocused();
  await again.click();

  // Straight into Stage 2: no intro sheet after the card, the first brick waits and the new brick is named.
  await expect(page).toHaveURL(/#\/game\/drop\/2$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stage 2');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(say).toContainText('Press any button to start.');
  await expect(say).toContainText('New brick: Short Stick.');
  await expect(board).toBeFocused();

  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(homeCard(page, 'Brick Drop')).toContainText('Stage 2');
});
