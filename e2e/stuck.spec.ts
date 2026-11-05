/**
 * The stuck offer and the clocks in a real browser (brief 3.1, 3.2, 4.2): Brick Escape's Restarts, Letter
 * Builder's time signal (which stops while the page is hidden), and Brick Drop's first waiting brick and its
 * Out of room sheet. The rules themselves are unit-tested in src/games/run.test.ts; this checks the screens.
 */
import { expect, test, type Page } from '@playwright/test';
import { initialState, isSolved } from '../src/games/slide/engine';
import { dots, escapeBoard, escapePuzzleOnScreen, escapeWiggle, homeCard, playEscapeBoard, pressEscapeBrick, savedRun, seed, solveEscapeBoard } from './app';

/** Pretend the tab went to the background, or came back. */
async function setHidden(page: Page, hidden: boolean) {
  await page.evaluate((hide) => {
    if (hide) {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    } else {
      delete (document as { visibilityState?: unknown }).visibilityState;
      delete (document as { hidden?: unknown }).hidden;
    }
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}

/** Stop the clock flowing by itself, so the test moves time on exactly. */
async function pauseClock(page: Page) {
  // A second ahead, so the page's own time never passes it first; due timers fire once on the way.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
}

test('Brick Escape: two Restarts bring New puzzle, and the swap keeps the dots', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  const first = await escapePuzzleOnScreen(page, 0);

  const offer = page.getByRole('button', { name: 'New puzzle' });
  const restart = page.getByRole('button', { name: 'Restart puzzle' });
  await restart.click();
  await expect(offer).toHaveCount(0);
  await restart.click();
  await expect(offer).toBeVisible();
  await expect(page.locator('.esc-help')).toHaveText('This one is tricky. Want a different puzzle?');
  // It sits at the right end of the tools row, after Undo and Hint, and never takes focus.
  await expect(page.locator('.esc-tools__end').getByRole('button', { name: 'New puzzle' })).toBeVisible();
  await expect(offer).not.toBeFocused();

  await offer.click();
  await expect(page.locator('.esc-help')).toHaveText('Here is a different puzzle.');
  await expect(offer).toHaveCount(0);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  const run = await savedRun(page, 'escape', 0);
  expect(run.queue).toEqual([1, 2, 3, 4, 5, first]);
  const swappedTo = run.queue[0];
  await expect(page.locator('.esc-brick')).toHaveCount(escapeBoard(0, swappedTo).blocks.length);

  // The new board counts as the first solved puzzle; the one swapped away is still to come.
  await solveEscapeBoard(page, 0, swappedTo);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  const after = await savedRun(page, 'escape', 0);
  expect(after.solved.map((r) => r.puzzle)).toEqual([swappedTo]);
  expect(after.queue).toContain(first);
});

test('Brick Escape: the clock stops while the page is hidden', async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/escape');
  const clock = page.locator('.esc-status__clock');
  await expect(clock).toBeVisible();
  await pauseClock(page);

  await setHidden(page, true);
  const hiddenAt = await clock.textContent();
  await page.clock.runFor(20_000);
  await expect(clock).toHaveText(hiddenAt!);

  await setHidden(page, false);
  await page.clock.runFor(5_000);
  await expect(clock).not.toHaveText(hiddenAt!);
});

test('Brick Escape: 90 s with no brick leaving brings New puzzle, a brick leaving hides it, and 90 s more bring it back', async ({ page }) => {
  await page.clock.install();
  // Ages 5 to 6: the time signal's limit is 90 s with no brick leaving the board.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  const puzzle = await escapePuzzleOnScreen(page, 0);
  await expect(page.locator('.esc-brick')).toHaveCount(escapeBoard(0, puzzle).blocks.length);
  await pauseClock(page);
  const offer = page.getByRole('button', { name: 'New puzzle' });
  const help = page.locator('.esc-help');

  await page.clock.runFor(75_000);
  await expect(offer).toHaveCount(0);
  // Two minutes in the background count for nothing.
  await setHidden(page, true);
  await page.clock.runFor(120_000);
  await setHidden(page, false);
  await expect(offer).toHaveCount(0);
  // Back on screen, the signal carries on from about 75 s and reaches the limit.
  await page.clock.runFor(20_000);
  await expect(offer).toBeVisible();
  await expect(help).toHaveText('This one is tricky. Want a different puzzle?');
  await expect(offer).not.toBeFocused();
  // It sits last in the tools row's tab order, after Hint.
  await page.getByRole('button', { name: 'Hint' }).focus();
  await page.keyboard.press('Tab');
  await expect(offer).toBeFocused();

  // A brick leaving is progress: the offer hides and the time signal starts again from 0.
  await page.clock.resume();
  const { state } = await playEscapeBoard(page, 0, puzzle, { stopAfter: 1 });
  expect(state.exited).toBe(1);
  await expect(offer).toHaveCount(0);
  await expect(help).not.toHaveText('This one is tricky. Want a different puzzle?');
  await pauseClock(page);
  await page.clock.runFor(80_000);
  await expect(offer).toHaveCount(0);
  await page.clock.runFor(15_000);
  await expect(offer).toBeVisible();
  // The dots never moved: nothing was solved.
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
});

test('Brick Escape: reaching 3 times Best is one failed try, and an Undo does not count it twice', async ({ page }) => {
  // Ages 5 to 6: two failed tries bring the offer.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  const puzzle = await escapePuzzleOnScreen(page, 0);
  const board = escapeBoard(0, puzzle);
  const limit = 3 * board.par;
  const movesShown = page.locator('.esc-status__moves');
  const offer = page.getByRole('button', { name: 'New puzzle' });

  // The board starts packed, so let bricks out with the solver until two bricks can slide to and fro.
  let moves = 0;
  let state = initialState(board);
  let wiggle = escapeWiggle(board, state);
  while (!wiggle) {
    const played = await playEscapeBoard(page, 0, puzzle, { stopAfter: 1, from: state });
    moves += played.moves;
    state = played.state;
    wiggle = escapeWiggle(board, state, played.open);
  }
  expect(isSolved(state)).toBe(false);
  await expect(movesShown).toHaveText(`Moves ${moves}`);

  // Every press moves a different brick from the one before, so each press is one more move.
  const presses = Array.from({ length: limit - moves }, (_, i) => wiggle![i % 4]);
  let beforeLast = state;
  for (const [i, p] of presses.entries()) {
    if (i === presses.length - 1) {
      // One move under 3 times Best: not a failed try yet.
      await expect(movesShown).toHaveText(`Moves ${limit - 1}`);
      await expect(offer).toHaveCount(0);
      beforeLast = state;
    }
    state = await pressEscapeBrick(page, board, state, p.block, p.dir);
  }
  // 3 times Best is one failed try; one is not enough for the offer at ages 5 to 6.
  await expect(movesShown).toHaveText(`Moves ${limit}`);
  await expect(offer).toHaveCount(0);

  // Undo takes the move back; making it again in the same try does not count a second failed try.
  const last = presses[presses.length - 1];
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(movesShown).toHaveText(`Moves ${limit - 1}`);
  await pressEscapeBrick(page, board, beforeLast, last.block, last.dir);
  await expect(movesShown).toHaveText(`Moves ${limit}`);
  await expect(offer).toHaveCount(0);

  // A Restart is the second failed try: now the offer shows.
  await page.getByRole('button', { name: 'Restart puzzle' }).click();
  await expect(movesShown).toHaveText('Moves 0');
  await expect(offer).toBeVisible();
  await expect(page.locator('.esc-help')).toHaveText('This one is tricky. Want a different puzzle?');
});

test('Letter Builder: 40 s with no right tap brings the offer, and hidden time does not count', async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/letters');
  await expect(page.locator('.lb-tray button').first()).toBeVisible();
  await pauseClock(page);
  const offer = page.getByRole('button', { name: 'New puzzle' });

  await page.clock.runFor(30_000);
  await expect(offer).toHaveCount(0);
  // Two minutes in the background count for nothing.
  await setHidden(page, true);
  await page.clock.runFor(120_000);
  await setHidden(page, false);
  await expect(offer).toHaveCount(0);
  // Back on screen, the signal carries on from about 30 s and reaches the limit.
  await page.clock.runFor(15_000);
  await expect(offer).toBeVisible();
  await expect(page.locator('.lb-help')).toHaveText('This one is tricky. Want a different puzzle?');

  // A right tap is progress: the offer hides.
  const first = (await page.locator('.lb-picture--label').textContent())!.trim().charAt(0);
  await page.keyboard.press(first);
  await expect(offer).toHaveCount(0);
  await expect(page.locator('.lb-help')).toHaveText('What comes next?');
});

test('Brick Drop: the first brick waits, and running out of room twice brings New puzzle', async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/');
  await expect(homeCard(page, 'Brick Drop')).toContainText('Stage 1');
  await homeCard(page, 'Brick Drop').click();
  await expect(page).toHaveURL(/#\/game\/drop\/1$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stage 1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');

  // The intro sheet, entered from Home: nothing runs behind it.
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText('Solve 4 to finish the stage.');
  // The board behind the sheet is inert, so the timer is found by its class, not its role.
  const timer = page.locator('.drop-timer__clock');
  const full = await timer.getAttribute('aria-label');
  await pauseClock(page);
  await page.clock.runFor(10_000);
  await expect(timer).toHaveAttribute('aria-label', full!);
  await page.clock.resume();
  await sheet.getByRole('button', { name: 'Start' }).click();

  // The first brick waits at the top: no clock, no falling, until the first press.
  const say = page.locator('.drop-say');
  await expect(say).toContainText('Press any button to start.');
  await pauseClock(page);
  await page.clock.runFor(10_000);
  await expect(timer).toHaveAttribute('aria-label', full!);
  await expect(say).toContainText('Press any button to start.');
  await page.clock.resume();

  /** Drop every brick straight down (Space) until the stack reaches the top. */
  const fillToTop = async () => {
    for (let i = 0; i < 80 && !(await page.getByRole('dialog', { name: 'Out of room' }).isVisible()); i++) {
      await page.keyboard.press(' ');
      await page.clock.runFor(400);
    }
    await expect(page.getByRole('dialog', { name: 'Out of room' })).toBeVisible();
  };

  await fillToTop();
  let over = page.getByRole('dialog', { name: 'Out of room' });
  await expect(over).toContainText(/The bricks reached the top\. You cleared \d+ of \d+ rows\./);
  // One failed try at ages 5 to 6 is not stuck yet: Try again first, Back to games second.
  await expect(over.getByRole('button', { name: 'Try again' })).toBeFocused();
  await expect(over.getByRole('button', { name: 'New puzzle' })).toHaveCount(0);
  await expect(over.getByRole('link', { name: 'Back to games' })).toBeVisible();
  await over.getByRole('button', { name: 'Try again' }).click();
  await expect(say).toContainText('Press any button to start.');

  await fillToTop();
  over = page.getByRole('dialog', { name: 'Out of room' });
  await expect(over).toContainText('This one is tricky. You can try a different puzzle.');
  const swap = over.getByRole('button', { name: 'New puzzle' });
  await expect(swap).toBeFocused();
  await expect(over.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(over.getByRole('link', { name: 'Back to games' })).toBeVisible();

  await swap.click();
  await expect(say).toContainText('Here is a different puzzle.');
  await expect(say).toContainText('Press any button to start.');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  const run = await savedRun(page, 'drop', 0);
  expect(run.queue).toEqual([1, 2, 3, 4, 5, 0]);
  expect(run.solved).toEqual([]);
});
