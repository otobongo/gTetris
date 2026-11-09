/**
 * Number Line-up journeys (six-games brief 10.4): a new child lines up Level 1 into Level 2 by taps; a tower
 * dragged onto another swaps them, with real pointer drags on the phone and the zoomed tablet frame; a hint
 * counts down the badge and puts the cap line on the card; and an age change on Level 9 keeps the solved
 * puzzles while the next one takes the new band's numbers. The towers are read from their accessible names
 * (brief 9.2).
 */
import { expect, test, type Page } from '@playwright/test';
import {
  dots,
  editSavedInAnotherTab,
  homeCard,
  levelCard,
  numbersBackwardSwap,
  numbersNextSwap,
  numbersRow,
  numbersTower,
  pointerDrag,
  savedGame,
  savedRun,
  savedState,
  seed,
  solveNumbersPuzzle,
  starsUpTo,
  swapTowers,
} from './app';

const help = (page: Page) => page.locator('.bw-helprow__line');
const title = (page: Page) => page.getByRole('heading', { level: 1 });
const hint = (page: Page) => page.getByRole('button', { name: /^Hint, \d left$/ });
const SPOTS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** Line up the row on screen, then tap Next puzzle unless it was the fourth. */
async function lineUpAndGoOn(page: Page, solvedBefore: number) {
  await solveNumbersPuzzle(page);
  if (solvedBefore + 1 >= 4) return;
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 1} of 4. ${solvedBefore + 1} solved.`);
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await expect(next).toBeFocused();
  await next.click();
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 2} of 4. ${solvedBefore + 1} solved.`);
  // After Next, focus is on the first tower.
  await expect(numbersTower(page, 0)).toBeFocused();
}

test('a new child lines up Level 1 by taps and goes straight into Level 2', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/');
  const card = homeCard(page, 'Number Line-up');
  await expect(card).toContainText('Level 1');
  await card.click();
  await expect(page).toHaveURL(/#\/game\/numbers\/1$/);
  await expect(title(page)).toHaveText('Level 1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  await expect(page.locator('.num-goal__text')).toHaveText('Line up 1 to 6, smallest first, so the towers make stairs going up.');
  await expect(help(page)).toHaveText('Drag or tap two towers to swap them.');
  await expect(page.locator('.num-legend')).toHaveText('A filled green line means that tower is in the right spot.');
  await expect(hint(page)).toHaveAccessibleName('Hint, 3 left');

  // A tap lifts a tower and a second tap on it puts it down.
  const row = await numbersRow(page);
  expect([...row].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  await numbersTower(page, 0).click();
  await expect(numbersTower(page, 0)).toHaveAttribute('aria-pressed', 'true');
  await expect(help(page)).toHaveText('Now tap where it should go.');
  await numbersTower(page, 0).click();
  await expect(numbersTower(page, 0)).toHaveAttribute('aria-pressed', 'false');

  // Level 1 needs two swaps; the solved row locks and the line reads the stairs.
  expect(await solveNumbersPuzzle(page)).toBe(2);
  await expect(help(page)).toHaveText('Stairs going up: 1, 2, 3, 4, 5, 6.');
  for (let spot = 0; spot < 6; spot++) {
    await expect(numbersTower(page, spot)).toHaveAccessibleName(`Tower of ${spot + 1}, spot ${spot + 1} of 6, in the right spot`);
    await expect(numbersTower(page, spot)).toHaveAttribute('aria-disabled', 'true');
  }
  await expect(page.locator('.num-mark.is-right')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Next puzzle' })).toBeFocused();
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(numbersTower(page, 0)).toBeFocused();

  for (let n = 1; n < 4; n++) await lineUpAndGoOn(page, n);
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog).toContainText('4 puzzles, no slips.');
  await expect(dialog.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(dialog).not.toContainText('Using a hint');
  expect((await savedGame(page, 'numbers'))?.stars['0']).toBe(3);

  await dialog.getByRole('button', { name: 'Play Level 2' }).click();
  await expect(page).toHaveURL(/#\/game\/numbers\/2$/);
  await expect(title(page)).toHaveText('Level 2');
  // Each level has its own three hints.
  await expect(hint(page)).toHaveAccessibleName('Hint, 3 left');
  expect(await solveNumbersPuzzle(page)).toBe(3);
});

test('a tower dragged onto another swaps them, and one let go over empty space goes back', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/numbers');
  await expect(page).toHaveURL(/#\/game\/numbers\/1$/);

  const before = await numbersRow(page);
  const goal = page.locator('.num-goal');
  const box = await goal.boundingBox();
  await pointerDrag(page, numbersTower(page, 0), { x: box!.x + 6, y: box!.y + box!.height / 2 });
  await expect.poll(() => numbersRow(page)).toEqual(before);
  await expect(numbersTower(page, 0)).toHaveAttribute('aria-pressed', 'false');

  // Drag the tower that belongs in the first wrong spot onto that spot.
  for (let step = await numbersNextSwap(page); step; step = await numbersNextSwap(page)) {
    const now = await numbersRow(page);
    await pointerDrag(page, numbersTower(page, step[0]), numbersTower(page, step[1]));
    const after = [...now];
    [after[step[0]], after[step[1]]] = [after[step[1]], after[step[0]]];
    await expect.poll(() => numbersRow(page)).toEqual(after);
  }
  await expect(help(page)).toHaveText('Stairs going up: 1, 2, 3, 4, 5, 6.');
  expect((await savedRun(page, 'numbers', 0)).solved).toEqual([{ puzzle: 0, count: 0, usedHint: false, outOfTime: false }]);
});

test('a hint counts down the badge, shows the move, and puts the cap line on the level card', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/numbers');
  await expect(page).toHaveURL(/#\/game\/numbers\/1$/);

  // A backward swap first: a slip that every such swap counts.
  const [a, b] = await numbersBackwardSwap(page);
  await swapTowers(page, a, b);

  const step = (await numbersNextSwap(page))!;
  const row = await numbersRow(page);
  await hint(page).click();
  await expect(hint(page)).toHaveAccessibleName('Hint, 2 left');
  await expect(hint(page).locator('.bw-iconbtn__badge')).toHaveText('2');
  await expect(help(page)).toHaveText(`${row[step[0]]} belongs in the ${SPOTS[step[1]]} spot. Swap them.`);
  await expect(page.locator('.num-stack.is-lit')).toHaveCount(2);
  await expect(numbersTower(page, step[0]).locator('.num-arrow')).toBeVisible();
  expect((await savedRun(page, 'numbers', 0)).hintsLeft).toBe(2);
  // The hint goes with the next swap.
  await swapTowers(page, step[0], step[1]);
  await expect(page.locator('.num-stack.is-lit')).toHaveCount(0);
  await lineUpAndGoOn(page, 0);
  for (let n = 1; n < 4; n++) await lineUpAndGoOn(page, n);

  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog).toContainText('4 puzzles, 1 slip.');
  await expect(dialog).toContainText('Using a hint caps the level at 2 stars.');
  await expect(dialog.getByRole('img', { name: '2 of 3 stars' })).toBeVisible();
  expect((await savedGame(page, 'numbers'))?.stars['0']).toBe(2);
});

test('an age change on Level 9 keeps the solved puzzles, and the next one takes the new band’s numbers', { tag: '@phone-only' }, async ({ page }) => {
  // Levels 1 to 8 finished: Level 9, the first level of bigger numbers. Ages 3 to 4 count to 10.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '3-4', games: { numbers: { stars: starsUpTo(8) } } }]);
  await page.goto('/#/game/numbers');
  await expect(page).toHaveURL(/#\/game\/numbers\/9$/);
  await expect(page.locator('.num-goal__text')).toHaveText('Line up the numbers, smallest first.');

  for (let n = 0; n < 2; n++) {
    for (const v of await numbersRow(page)) expect(v).toBeLessThanOrEqual(10);
    await lineUpAndGoOn(page, n);
  }
  await expect(help(page)).toHaveText('Drag or tap two towers to swap them.');
  expect((await savedRun(page, 'numbers', 8)).set).toBe('numbers:1:3-4');

  // A grown-up moves Maya to ages 9 to 10 from another device while the third puzzle is on screen.
  const onScreen = await numbersRow(page);
  await editSavedInAnotherTab(page, (state) => {
    state.players[0].ageBand = '9-10';
  });
  // The store has read the new band, but the puzzle on screen keeps its numbers until it is solved.
  await expect.poll(async () => (await savedState(page)).players[0].ageBand).toBe('9-10');
  await page.waitForTimeout(300);
  expect(await numbersRow(page)).toEqual(onScreen);
  await lineUpAndGoOn(page, 2);

  // The next puzzle comes from the new band (numbers up to 999); the solved ones still count.
  const run = await savedRun(page, 'numbers', 8);
  expect(run.set).toBe('numbers:1:9-10');
  expect(run.solved).toHaveLength(3);
  const fourth = await numbersRow(page);
  expect(Math.max(...fourth)).toBeGreaterThan(10);
  await solveNumbersPuzzle(page);
  await expect(help(page)).toHaveText(`In order: ${[...fourth].sort((x, y) => x - y).join(', ')}.`);
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 9');
  await expect(dialog).toContainText('4 puzzles, no slips.');
});
