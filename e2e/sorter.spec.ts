/**
 * Shape Sorter journeys (six-games brief 10.4): a new child sorts Level 1 into Level 2 by dragging, with real
 * pointer drags on the phone and on the zoomed tablet frame; on a colour level a wrong hole names what matched,
 * the tap path works, and a child who leaves mid-level resumes at the next unsolved board. The boards are read
 * from their accessible names (brief 9.2).
 */
import { expect, test, type Page } from '@playwright/test';
import { puzzle } from '../src/games/sorter/puzzles';
import {
  dots,
  homeCard,
  levelCard,
  pointerDrag,
  savedGame,
  savedRun,
  seed,
  sortShapes,
  sorterHole,
  sorterHoles,
  sorterPiece,
  sorterPieces,
  sorterTray,
  starsUpTo,
} from './app';

const help = (page: Page) => page.locator('.bw-helprow__line');
const title = (page: Page) => page.getByRole('heading', { level: 1 });

/** Sort the board on screen, then tap Next puzzle unless it was the fourth. */
async function sortAndGoOn(page: Page, solvedBefore: number, how: 'drag' | 'tap') {
  await sortShapes(page, how);
  await expect(help(page)).toHaveText('Every shape is home.');
  if (solvedBefore + 1 >= 4) return;
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 1} of 4. ${solvedBefore + 1} solved.`);
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await expect(next).toBeFocused();
  await next.click();
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 2} of 4. ${solvedBefore + 1} solved.`);
  // After Next, focus is on the first piece in the tray.
  await expect(sorterTray(page).getByRole('button').first()).toBeFocused();
}

test('a new child drags every shape home on Level 1 and goes straight into Level 2', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/');
  const card = homeCard(page, 'Shape Sorter');
  await expect(card).toContainText('Level 1');
  await card.click();
  await expect(page).toHaveURL(/#\/game\/sorter\/1$/);
  await expect(title(page)).toHaveText('Level 1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  await expect(help(page)).toHaveText('Drag each shape into its hole.');
  expect(await sorterPieces(page)).toEqual(puzzle(0, 0).pieces.map((p) => p.shape));

  // One drag let go over no hole: the piece goes back, nothing counts, and the next tap still picks it.
  const [first] = await sorterPieces(page);
  const box = await page.locator('.sort-fact').boundingBox();
  await pointerDrag(page, sorterPiece(page, first), { x: box!.x + 8, y: box!.y + box!.height / 2 });
  await expect(sorterPiece(page, first)).toBeVisible();
  await expect(sorterPiece(page, first)).toHaveAttribute('aria-pressed', 'false');
  await expect(help(page)).toHaveText('Drag each shape into its hole.');

  // A drag into its own hole: the hole fills, the fact bar names the shape, a ghost keeps its place.
  await pointerDrag(page, sorterPiece(page, first), sorterHole(page, first));
  await expect(page.getByRole('img', { name: `Filled ${first} hole`, exact: true })).toBeVisible();
  await expect(sorterPiece(page, first)).toHaveCount(0);
  await expect(page.locator('.sort-tray .sort-ghost')).toHaveCount(1);
  await expect(sorterHoles(page).getByRole('button', { name: `${first} hole`, exact: true })).toHaveCount(0);

  await sortAndGoOn(page, 0, 'drag');
  for (let n = 1; n < 4; n++) await sortAndGoOn(page, n, 'drag');

  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog).toContainText('4 puzzles, no slips.');
  await expect(dialog.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  expect((await savedGame(page, 'sorter'))?.stars['0']).toBe(3);

  await dialog.getByRole('button', { name: 'Play Level 2' }).click();
  await expect(page).toHaveURL(/#\/game\/sorter\/2$/);
  await expect(title(page)).toHaveText('Level 2');
  expect(await sorterPieces(page)).toEqual(puzzle(1, 0).pieces.map((p) => p.shape));
  await sortShapes(page, 'drag');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
});

test('on a colour level a wrong hole names what matched, the tap path works, and leaving mid-level resumes at the next board', { tag: '@phone-only' }, async ({ page }) => {
  // Levels 1 to 4 finished: Level 5, the first board with three colours.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8', games: { sorter: { stars: starsUpTo(4) } } }]);
  await page.goto('/#/game/sorter');
  await expect(page).toHaveURL(/#\/game\/sorter\/5$/);
  await expect(help(page)).toHaveText('Match the shape and the color.');
  await expect(page.locator('.sort-fact__text')).toHaveText('Look closely: each hole has a color too.');

  const board = puzzle(4, 0);
  expect(await sorterPieces(page)).toEqual(board.pieces.map((p) => `${p.color} ${p.shape}`));
  // A piece and a hole with the same shape in another colour.
  const piece = board.pieces.find((p) => board.holes.some((h) => h.shape === p.shape && h.color !== p.color))!;
  const sameShape = board.holes.find((h) => h.shape === piece.shape && h.color !== piece.color)!;
  const name = `${piece.color} ${piece.shape}`;

  await sorterPiece(page, name).click();
  await expect(sorterPiece(page, name)).toHaveAttribute('aria-pressed', 'true');
  await expect(help(page)).toHaveText(`Now tap the ${name} hole.`);
  await sorterHole(page, `${sameShape.color} ${sameShape.shape}`).click();
  await expect(help(page)).toHaveText(`Same shape, but this hole is ${sameShape.color}.`);
  await expect(help(page)).toHaveClass(/is-wrong/);
  // The piece is back in the tray, unpicked, with focus, so the child can try again.
  await expect(sorterPiece(page, name)).toHaveAttribute('aria-pressed', 'false');
  await expect(sorterPiece(page, name)).toBeFocused();

  // A piece and a hole with the same colour and another shape.
  const other = board.pieces.find((p) => board.holes.some((h) => h.color === p.color && h.shape !== p.shape))!;
  const sameColor = board.holes.find((h) => h.color === other.color && h.shape !== other.shape)!;
  await sorterPiece(page, `${other.color} ${other.shape}`).click();
  await sorterHole(page, `${sameColor.color} ${sameColor.shape}`).click();
  await expect(help(page)).toHaveText(`Same color, but this hole is a ${sameColor.shape}.`);

  // The tap path sorts the board; the two wrong holes are two slips.
  await sortShapes(page, 'tap');
  await expect(help(page)).toHaveText('Every shape is home.');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  expect((await savedRun(page, 'sorter', 4)).solved).toEqual([{ puzzle: 0, count: 2, usedHint: false, outOfTime: false }]);
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');

  // One piece home on the second board, then Back: the board starts again and the solved one stays solved.
  const second = puzzle(4, 1);
  const firstOfSecond = `${second.pieces[0].color} ${second.pieces[0].shape}`;
  await sorterPiece(page, firstOfSecond).click();
  await sorterHole(page, firstOfSecond).click();
  await expect(page.getByRole('img', { name: `Filled ${firstOfSecond} hole`, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL(/#\/$/);
  const card = homeCard(page, 'Shape Sorter');
  await expect(card).toHaveAccessibleName(/Level 5, 1 of 4 puzzles solved\.$/);

  await card.click();
  await expect(page).toHaveURL(/#\/game\/sorter\/5$/);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  expect(await sorterPieces(page)).toEqual(second.pieces.map((p) => `${p.color} ${p.shape}`));
  await expect(page.getByRole('img', { name: /^Filled / })).toHaveCount(0);

  // Closing the app works the same way.
  await page.reload();
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await sortAndGoOn(page, 1, 'tap');
});
