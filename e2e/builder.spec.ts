/**
 * Picture Builder journeys (six-games brief 10.4): a new child builds Level 1 into Level 2 with real pointer taps
 * and drags, on the phone and on the zoomed tablet frame; a memory level, where the look locks the board, Peek
 * shows the picture, the match bar is hidden and one wrong stroke is one slip; and a grown-up's pick of a locked
 * level that the child then plays. The picture is read from the model panel's accessible name (brief 9.2) while
 * it shows, and the bricks are laid through the palette and the board.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  builderBoard,
  builderBoardCells,
  builderModel,
  builderPicture,
  builderSquare,
  builderSquareMiddle,
  builderStroke,
  builderSwatch,
  buildPicture,
  dots,
  homeCard,
  levelCard,
  openSettings,
  savedGame,
  savedRun,
  seed,
  starsUpTo,
} from './app';

const help = (page: Page) => page.locator('.bw-helprow__line');
const title = (page: Page) => page.getByRole('heading', { level: 1 });
const pictureTitle = (page: Page) => page.getByRole('heading', { level: 2 });
const matchBar = (page: Page) => page.getByRole('progressbar');
const peek = (page: Page) => page.getByRole('button', { name: 'Peek at the picture' });

/**
 * Build the picture on screen, then tap Next puzzle unless it was the fourth; focus lands on the top-left square.
 * Where focus is right after the solve is checked in the first journey, for a last brick laid by a stroke.
 */
async function buildAndGoOn(page: Page, solvedBefore: number, how: 'drag' | 'tap') {
  const picture = await builderPicture(page);
  await buildPicture(page, picture, how);
  await expect(help(page)).toHaveText(new RegExp(`^You built the ${picture.name}( from memory)?\\.$`));
  if (solvedBefore + 1 >= 4) return;
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 1} of 4. ${solvedBefore + 1} solved.`);
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await next.click();
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 2} of 4. ${solvedBefore + 1} solved.`);
  await expect(builderSquare(page, picture.size, 0)).toBeFocused();
}

test('a new child builds Picture Builder Level 1 with taps and drags and goes straight into Level 2', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/');
  const card = homeCard(page, 'Picture Builder');
  await expect(card).toContainText('Level 1');
  await expect(card).not.toContainText('Coming soon');
  await card.click();
  await expect(page).toHaveURL(/#\/game\/builder\/1$/);
  await expect(title(page)).toHaveText('Level 1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');

  // A copy level: the picture shows, the title names it, and the bar counts the picture's bricks.
  const picture = await builderPicture(page);
  expect(picture.size).toBe(3);
  const bricks = picture.cells.filter(Boolean).length;
  await expect(pictureTitle(page)).toHaveText(`Build the ${picture.name}.`);
  await expect(help(page)).toHaveText('Pick a color, then tap or drag over the squares.');
  await expect(matchBar(page)).toHaveAccessibleName(`0 of ${bricks} bricks right`);
  await expect(builderBoard(page).getByRole('button')).toHaveCount(9);
  await expect(builderSwatch(page, 'red')).toHaveAttribute('aria-pressed', 'true');

  // A brick on a square that must stay empty is wrong; the eraser takes it away again.
  const empty = picture.cells.findIndex((c) => c === null);
  await builderSwatch(page, 'blue').click();
  await builderSquare(page, 3, empty).click();
  await expect(builderSquare(page, 3, empty)).toHaveAccessibleName(new RegExp(`, blue$`));
  await expect(help(page)).toHaveText('One brick is not quite right.');
  await expect(matchBar(page)).toHaveAccessibleName(`0 of ${bricks} bricks right`);
  await builderSwatch(page, 'eraser').click();
  await builderSquare(page, 3, empty).click();
  await expect(help(page)).toHaveText('Pick a color, then tap or drag over the squares.');

  // Build it, the last bricks in one stroke along a row: the bar fills, and the last right brick solves at once.
  const strokeRow = Array.from({ length: 3 }, (_, r) => r).find((r) => {
    const row = picture.cells.slice(r * 3, r * 3 + 3);
    return row[0] !== null && row.every((c) => c === row[0]);
  });
  if (strokeRow === undefined) throw new Error(`No full row of one colour in the ${picture.name}`);
  const last = [strokeRow * 3, strokeRow * 3 + 2];
  const lastColor = picture.cells[last[0]]!;
  await buildPicture(page, { ...picture, cells: picture.cells.map((c, i) => (Math.floor(i / 3) === strokeRow ? null : c)) }, 'tap');
  await expect(matchBar(page)).toHaveAccessibleName(`${bricks - 3} of ${bricks} bricks right`);
  await builderSwatch(page, lastColor).click();
  await builderStroke(page, 3, last);
  await expect(help(page)).toHaveText(`You built the ${picture.name}.`);
  await expect(matchBar(page)).toHaveAccessibleName(`${bricks} of ${bricks} bricks right`);
  expect(await builderBoardCells(page)).toEqual(picture.cells);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  await expect(builderSwatch(page, 'red')).toHaveCount(0);
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await expect(next).toBeFocused();
  await next.click();
  await expect(builderSquare(page, 3, 0)).toBeFocused();
  await expect(matchBar(page)).toHaveAccessibleName(/^0 of \d+ bricks right$/);

  await buildAndGoOn(page, 1, 'tap');
  await buildAndGoOn(page, 2, 'drag');
  await buildAndGoOn(page, 3, 'tap');

  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog).toContainText('4 puzzles, 1 slip.');
  await expect(dialog.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Play Level 2' })).toBeFocused();
  expect((await savedGame(page, 'builder'))?.stars['0']).toBe(3);

  await dialog.getByRole('button', { name: 'Play Level 2' }).click();
  await expect(page).toHaveURL(/#\/game\/builder\/2$/);
  await expect(title(page)).toHaveText('Level 2');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  const level2 = await builderPicture(page);
  expect(level2.size).toBe(3);
  expect(new Set(level2.cells.filter(Boolean)).size).toBe(3);
  await expect(pictureTitle(page)).toHaveText(`Build the ${level2.name}.`);
});

test('a memory level: the look locks the board, Peek shows the picture, the bar is hidden, one wrong stroke is one slip', { tag: '@phone-only' }, async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', games: { builder: { stars: starsUpTo(5) } } }]);
  await page.goto('/');
  await expect(homeCard(page, 'Picture Builder')).toContainText('Level 6');
  await homeCard(page, 'Picture Builder').click();
  await expect(page).toHaveURL(/#\/game\/builder\/6$/);

  // The first look: the picture shows, the lines say to look, and the board takes no bricks.
  await expect(pictureTitle(page)).toHaveText('Look closely.');
  // Hold the clock still, so the look lasts while the child tries the board.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
  await expect(help(page)).toHaveText('Remember the colors and where they go.');
  const picture = await builderPicture(page);
  await expect(matchBar(page)).toHaveCount(0);
  await expect(peek(page)).toHaveCount(0);
  await expect(builderSquare(page, picture.size, 0)).toHaveAttribute('aria-disabled', 'true');
  const corner = await builderSquareMiddle(page, picture.size, 0);
  await page.mouse.click(corner.x, corner.y);
  expect((await builderBoardCells(page)).every((c) => c === null)).toBe(true);

  // After 5 s (ages 5 to 6) the picture hides behind Peek and the board opens. The bar stays hidden.
  await page.clock.runFor(5_000);
  await expect(pictureTitle(page)).toHaveText('Build it from memory.');
  await expect(help(page)).toHaveText('Tap Peek if you need another look.');
  await expect(builderModel(page)).toHaveAccessibleName('Picture hidden. Tap Peek to look again.');
  await expect(peek(page)).toBeVisible();
  await expect(matchBar(page)).toHaveCount(0);

  // Peek shows the picture for 2 s and locks the board again.
  await peek(page).click();
  await expect(builderModel(page)).toHaveAccessibleName(/^Picture of /);
  await expect(page.locator('.pb-sr')).toHaveText('Picture shown.');
  await expect(pictureTitle(page)).toHaveText('Look closely.');
  await expect(builderSquare(page, picture.size, 0)).toHaveAttribute('aria-disabled', 'true');
  await page.clock.runFor(2_000);
  await expect(builderModel(page)).toHaveAccessibleName('Picture hidden. Tap Peek to look again.');
  await expect(peek(page)).toBeVisible();

  // One stroke over two squares, both wrong: one slip, and memory levels name no wrong bricks.
  const wrongPair = [0, 1].map((i) => picture.cells[i]);
  const color = ['red', 'yellow', 'green', 'blue', 'orange', 'white'].find((c) => !wrongPair.includes(c as never))!;
  await builderSwatch(page, color).click();
  await builderStroke(page, picture.size, [0, 1]);
  expect((await builderBoardCells(page)).slice(0, 2)).toEqual([color, color]);
  await expect(help(page)).toHaveText('Tap Peek if you need another look.');
  await builderSwatch(page, 'eraser').click();
  await builderStroke(page, picture.size, [0, 1]);
  expect((await builderBoardCells(page)).every((c) => c === null)).toBe(true);

  // Built from memory: the picture shows again once solved.
  await buildPicture(page, picture, 'drag');
  await expect(help(page)).toHaveText(`You built the ${picture.name} from memory.`);
  await expect(builderModel(page)).toHaveAccessibleName(/^Picture of /);
  const run = await savedRun(page, 'builder', 5);
  expect(run.solved).toEqual([{ puzzle: 0, count: 1, usedHint: false, outOfTime: false }]);

  // The next picture starts with its own first look.
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(pictureTitle(page)).toHaveText('Look closely.');
  await expect(builderSquare(page, picture.size, 0)).toHaveAttribute('aria-disabled', 'true');
  await page.clock.runFor(5_000);
  await expect(pictureTitle(page)).toHaveText('Build it from memory.');
});

test('a grown-up picks a locked Picture Builder level and the child builds it', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await openSettings(page);
  await page.getByRole('link', { name: 'Picture Builder for Maya: Level 1. Pick a level' }).click();
  await expect(page).toHaveURL(/#\/settings\/levels\/builder\/maya$/);
  await expect(page.getByRole('status')).toHaveText('Maya is on Level 1.');
  // The chapters come from the game.
  for (const chapter of ['Copy it', 'From memory', 'Big pictures']) await expect(page.getByText(chapter, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Level 10, locked' }).click();
  await expect(page.getByRole('status')).toHaveText('Level 10 picked. Maya hasn’t reached it yet.');
  await page.getByRole('button', { name: 'Play Level 10' }).click();

  await expect(page).toHaveURL(/#\/game\/builder\/10$/);
  await expect(title(page)).toHaveText('Level 10');
  // Level 10 is a 5 by 5 copy level in the same board.
  const picture = await builderPicture(page);
  expect(picture.size).toBe(5);
  await expect(builderBoard(page).getByRole('button')).toHaveCount(25);
  for (let n = 0; n < 4; n++) await buildAndGoOn(page, n, n % 2 ? 'tap' : 'drag');

  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 10');
  await expect(dialog.getByRole('button', { name: 'Play Level 11' })).toBeVisible();
  expect((await savedGame(page, 'builder'))?.stars['9']).toBe(3);
  expect((await savedGame(page, 'builder'))?.current).toBe(10);
});
