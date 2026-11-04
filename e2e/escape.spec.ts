/**
 * Brick Escape journeys (four-puzzle brief 12): a new child from Level 1 into Level 2, leaving mid-level and
 * coming back, and a grown-up's replay of Level 3 that returns the child to their frontier.
 */
import { expect, test } from '@playwright/test';
import {
  dots,
  escapeBoard,
  escapePuzzleOnScreen,
  hashOf,
  homeCard,
  levelCard,
  openSettings,
  savedGame,
  savedRun,
  seed,
  solveEscapeBoard,
  starsUpTo,
} from './app';

test('a new child goes from Level 1 into Level 2', async ({ page }) => {
  // First run on this device: nobody is set up, so Who's playing asks for the first child.
  await page.goto('/');
  await expect(page).toHaveURL(/#\/players$/);
  await page.getByLabel("Child's first name").fill('Maya');
  await page.getByRole('button', { name: 'Ages 5 to 6' }).click();
  await page.getByRole('button', { name: 'Add child' }).click();

  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
  const card = homeCard(page, 'Brick Escape');
  await expect(card).toContainText('Level 1');
  // No level grid for children: the card opens the current level straight away.
  await card.click();
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  await expect(page.getByRole('button', { name: 'Restart puzzle' })).toBeVisible();

  let total = 0;
  for (let n = 1; n <= 4; n++) {
    const puzzle = await escapePuzzleOnScreen(page, 0);
    const moves = await solveEscapeBoard(page, 0, puzzle);
    total += moves;
    if (n < 4) {
      // The dot fills, the help line states the result and Next puzzle takes the tools' place, with focus.
      await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${n} of 4. ${n} solved.`);
      await expect(page.locator('.esc-help')).toHaveText(`Solved in ${moves} moves.`);
      const next = page.getByRole('button', { name: 'Next puzzle' });
      await expect(next).toBeFocused();
      await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
      await next.click();
      // Same screen, same route, the next unsolved puzzle.
      await expect(page).toHaveURL(/#\/game\/escape\/1$/);
      await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${n + 1} of 4. ${n} solved.`);
      await expect(page.locator('.esc-status__moves')).toHaveText('Moves 0');
    }
  }

  // The fourth solve: the last dot fills, then the level card opens over the board.
  await expect(dots(page)).toHaveAttribute('aria-label', '4 of 4 solved.');
  const dialog = levelCard(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog).toContainText(`4 puzzles in ${total} moves.`);
  await expect(dialog.getByRole('img', { name: /of 3 stars$/ })).toBeVisible();
  const play = dialog.getByRole('button', { name: 'Play Level 2' });
  await expect(play).toBeFocused();
  await expect(dialog.getByRole('link', { name: 'Back to games' })).toBeVisible();

  const saved = await savedGame(page, 'escape');
  expect(saved?.stars['0']).toBeGreaterThanOrEqual(1);
  expect(saved?.runs?.['0']).toBeUndefined();

  // One tap to the next level, at its first puzzle, with no sheet in between.
  await play.click();
  await expect(page).toHaveURL(/#\/game\/escape\/2$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 2');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  await expect(levelCard(page)).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(homeCard(page, 'Brick Escape')).toContainText('Level 2');
});

test('a child leaves mid-level and resumes at the next unsolved puzzle', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);

  const first = await escapePuzzleOnScreen(page, 0);
  await solveEscapeBoard(page, 0, first);
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  const second = await escapePuzzleOnScreen(page, 0);
  expect(second).not.toBe(first);

  // One move on the second board (a brick leaves), then Back: the unfinished board is dropped with its moves.
  const count = escapeBoard(0, second).blocks.length;
  await solveEscapeBoard(page, 0, second, 1);
  await expect(page.locator('.esc-brick')).toHaveCount(count - 1);
  await expect(page.locator('.esc-status__moves')).toHaveText('Moves 1');

  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL(/#\/$/);
  const card = homeCard(page, 'Brick Escape');
  await expect(card).toContainText('Level 1');
  await expect(card).toHaveAccessibleName(/Level 1, 1 of 4 puzzles solved\.$/);

  // Back in: the same level, the solved puzzle stays solved, the second board starts from its first position.
  await card.click();
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await expect(page.locator('.esc-status__moves')).toHaveText('Moves 0');
  await expect(page.locator('.esc-brick')).toHaveCount(count);
  expect(await escapePuzzleOnScreen(page, 0)).toBe(second);

  // Closing the app works the same way.
  await page.reload();
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  const run = await savedRun(page, 'escape', 0);
  expect(run.solved.map((r) => r.puzzle)).toEqual([first]);
  expect(run.queue[0]).toBe(second);
});

test('a grown-up picks Level 3, the child finishes it and returns to the frontier', async ({ page }) => {
  // Maya has finished Levels 1 to 5, with 2 stars on Level 3; her frontier is Level 6.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8', games: { escape: { stars: { ...starsUpTo(5), 2: 2 } } } }]);
  await page.goto('/');
  await expect(homeCard(page, 'Brick Escape')).toContainText('Level 6');

  await openSettings(page);
  const row = page.getByRole('link', { name: 'Brick Escape for Maya: Level 6. Pick a level' });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(/#\/settings\/levels\/escape\/maya$/);
  const status = page.getByRole('status');
  await expect(status).toHaveText('Maya is on Level 6.');
  await expect(page.locator('[aria-current="step"]')).toHaveAccessibleName('Level 6, Maya’s current level');

  await page.getByRole('button', { name: 'Level 3, 2 stars' }).click();
  await expect(status).toHaveText('Level 3 picked. Maya plays it again from puzzle 1.');
  await page.getByRole('button', { name: 'Play Level 3' }).click();

  await expect(page).toHaveURL(/#\/game\/escape\/3$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 3');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  expect((await savedGame(page, 'escape'))?.current).toBe(2);

  for (let n = 1; n <= 4; n++) {
    await solveEscapeBoard(page, 2, await escapePuzzleOnScreen(page, 2));
    if (n < 4) await page.getByRole('button', { name: 'Next puzzle' }).click();
  }

  // Finishing the replay sends the child back to the frontier, not to Level 4.
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 3');
  const saved = await savedGame(page, 'escape');
  expect(saved?.current).toBe(5);
  // A replay keeps the higher stars.
  expect(saved?.stars['2']).toBeGreaterThanOrEqual(2);
  await dialog.getByRole('button', { name: 'Play Level 6' }).click();
  await expect(page).toHaveURL(/#\/game\/escape\/6$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 6');

  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(homeCard(page, 'Brick Escape')).toContainText('Level 6');
  expect(hashOf(page)).toBe('#/');
});
