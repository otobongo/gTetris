/**
 * Shape Sorter journeys (six-games brief 10.4): a new child sorts Level 1 into Level 2 by dragging, with real
 * pointer drags on the phone and on the zoomed tablet frame; on a colour level a wrong hole names what matched,
 * the tap path works, and a child who leaves mid-level resumes at the next unsolved board. The boards are read
 * from their accessible names (brief 9.2).
 *
 * After the user's feedback that the drag was too far for a child: the holes panel and the fact bar sit just
 * above the tray well, so every drag is short, and a piece let go within 24 px (the frame's px) of a hole's edge
 * counts as dropped on it, a right hole or a wrong one; 40 px away it still goes back.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { puzzle } from '../src/games/sorter/puzzles';
import { computeLayout } from '../src/shared/ui/layout';
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

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** An element's box on screen, in viewport px (the tablet zoom is in the box already). */
async function boxOf(el: Locator): Promise<Box> {
  const box = await el.boundingBox();
  if (!box) throw new Error('Not on screen');
  return box;
}

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/** From the bottom of one box to the top of the box under it. */
const gapUnder = (above: Box, below: Box) => below.y - (above.y + above.height);

/** The tablet frame's zoom on this screen: 1 on phone, 1.4 at 834 x 1194. The frame's px times this are screen px. */
function zoomOf(page: Page): number {
  const size = page.viewportSize();
  if (!size) throw new Error('No viewport');
  return computeLayout(size.width, size.height).zoom;
}

/** A new child on Level 1, with the tray on screen. */
async function openLevel1(page: Page) {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/sorter');
  await expect(page).toHaveURL(/#\/game\/sorter\/1$/);
  await expect(sorterTray(page).getByRole('button').first()).toBeVisible();
}

/** The holes panel, the fact bar and the tray well, top to bottom: the panel right on the fact bar, the fact bar right on the well. */
async function expectHolesOnTheTray(page: Page) {
  const helpRow = await boxOf(page.locator('.bw-helprow'));
  const panel = await boxOf(page.locator('.sort-holes'));
  const fact = await boxOf(page.locator('.sort-fact'));
  const well = await boxOf(page.locator('.sort-well'));
  // The empty space is above the holes now: the panel never goes up under the help row.
  expect(panel.y, 'holes panel below the help row').toBeGreaterThanOrEqual(helpRow.y + helpRow.height);
  expect(gapUnder(panel, fact), 'holes panel to fact bar').toBeGreaterThanOrEqual(0);
  expect(gapUnder(panel, fact), 'holes panel to fact bar').toBeLessThanOrEqual(40);
  expect(gapUnder(fact, well), 'fact bar to tray well').toBeGreaterThanOrEqual(0);
  expect(gapUnder(fact, well), 'fact bar to tray well').toBeLessThanOrEqual(40);
  // The tray well stays at the bottom, in the kit's controls slot, as in every other game.
  expect(page.viewportSize()!.height - (well.y + well.height), 'tray well to the bottom of the screen').toBeLessThanOrEqual(40);
}

/** Wait for the board's result to be saved, then check its slips. */
async function expectSlips(page: Page, level: number, count: number) {
  await expect.poll(async () => (await savedRun(page, 'sorter', level)).solved).toEqual([{ puzzle: 0, count, usedHint: false, outOfTime: false }]);
}

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

/* ---------- A short drag: the holes sit just above the tray (the user's sorter-drag feedback) ---------- */

test('on Level 1 the holes sit just above the tray, so every drag from the tray to a hole is short', async ({ page }) => {
  await openLevel1(page);
  const zoom = zoomOf(page);
  const holes = await sorterHoles(page).getByRole('button').all();
  expect(holes).toHaveLength(puzzle(0, 0).holes.length);
  // Every piece to every open hole, centre to centre, in the frame's px (screen px on phone, divided by 1.4 on the tablet).
  for (const name of await sorterPieces(page)) {
    const from = centre(await boxOf(sorterPiece(page, name)));
    for (const hole of holes) {
      const to = centre(await boxOf(hole));
      const reach = Math.hypot(to.x - from.x, to.y - from.y) / zoom;
      expect(reach, `${name} to the ${await hole.getAttribute('aria-label')}`).toBeLessThanOrEqual(320);
    }
  }
  await expectHolesOnTheTray(page);
});

test('on Level 1 the two holes sit centred over the tray, so no drag from the tray is long', async ({ page }) => {
  await openLevel1(page);
  const zoom = zoomOf(page);
  const holes = await sorterHoles(page).getByRole('button').all();
  expect(holes).toHaveLength(2);
  const boxes = await Promise.all(holes.map(boxOf));
  const well = await boxOf(page.locator('.sort-well'));
  // The holes' midpoint, from the left edge of the first to the right edge of the last, is over the tray's centre.
  const left = Math.min(...boxes.map((b) => b.x));
  const right = Math.max(...boxes.map((b) => b.x + b.width));
  expect(Math.abs((left + right) / 2 - centre(well).x), 'holes midpoint to the tray centre').toBeLessThanOrEqual(4);
  // Every piece to every hole, centre to centre, in the frame's px.
  for (const name of await sorterPieces(page)) {
    const from = centre(await boxOf(sorterPiece(page, name)));
    for (const [i, box] of boxes.entries()) {
      const to = centre(box);
      const reach = Math.hypot(to.x - from.x, to.y - from.y) / zoom;
      expect(reach, `${name} to the ${await holes[i].getAttribute('aria-label')}`).toBeLessThanOrEqual(260);
    }
  }
});

test('boards with three or more holes keep three equal columns across the panel', async ({ page }) => {
  // Level 3's first board: square, hexagon and star in the top row, circle and triangle under the first two.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', games: { sorter: { stars: starsUpTo(2) } } }]);
  await page.goto('/#/game/sorter');
  await expect(page).toHaveURL(/#\/game\/sorter\/3$/);
  await expect(sorterHoles(page).getByRole('button')).toHaveCount(5);
  const grid = page.locator('.sort-holes__grid');
  // In the frame's px: three equal tracks and two 14 px gaps fill the grid's width.
  const { tracks, width } = await grid.evaluate((el) => ({
    tracks: getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat),
    width: el.clientWidth,
  }));
  expect(tracks).toHaveLength(3);
  for (const t of tracks) expect(Math.abs(t - tracks[0]), 'equal columns').toBeLessThanOrEqual(1);
  expect(Math.abs(tracks[0] * 3 + 28 - width), 'the columns fill the panel').toBeLessThanOrEqual(1);
  // Each hole is centred in its column, and the second row starts in the first column, as before.
  const zoom = zoomOf(page);
  const g = await boxOf(grid);
  const col = (n: number) => g.x + (n * (tracks[0] + 14) + tracks[0] / 2) * zoom;
  const expected: [string, number][] = [['square', 0], ['hexagon', 1], ['star', 2], ['circle', 0], ['triangle', 1]];
  for (const [shape, n] of expected) {
    expect(Math.abs(centre(await boxOf(sorterHole(page, shape))).x - col(n)), `${shape} hole in column ${n + 1}`).toBeLessThanOrEqual(1);
  }
});

test('on the biggest board (Level 9) the holes and the fact bar still sit just above the tray, below the help row', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10', games: { sorter: { stars: starsUpTo(8) } } }]);
  await page.goto('/#/game/sorter');
  await expect(page).toHaveURL(/#\/game\/sorter\/9$/);
  await expect(sorterHoles(page).getByRole('button')).toHaveCount(puzzle(8, 0).holes.length);
  await expectHolesOnTheTray(page);
});

/* ---------- The catch area: a piece let go near a hole counts as dropped on it ---------- */

test('a piece let go just outside its own hole goes in, from the side or from below, and nothing counts as a slip', async ({ page }) => {
  await openLevel1(page);
  const zoom = zoomOf(page);
  const [left, right] = puzzle(0, 0).holes;

  // 16 px (the frame's px) left of the first hole, level with its middle: only the panel's edge is there.
  const leftBox = await boxOf(sorterHole(page, left.shape));
  await pointerDrag(page, sorterPiece(page, left.shape), { x: leftBox.x - 16 * zoom, y: leftBox.y + leftBox.height / 2 });
  await expect(page.getByRole('img', { name: `Filled ${left.shape} hole`, exact: true })).toBeVisible();
  await expect(sorterPiece(page, left.shape)).toHaveCount(0);
  await expect(help(page)).toHaveText('Drag each shape into its hole.');
  await expect(help(page)).not.toHaveClass(/is-wrong/);

  // 16 px below the second hole, in the panel's padding.
  const rightBox = await boxOf(sorterHole(page, right.shape));
  await pointerDrag(page, sorterPiece(page, right.shape), { x: rightBox.x + rightBox.width / 2, y: rightBox.y + rightBox.height + 16 * zoom });
  await expect(page.getByRole('img', { name: `Filled ${right.shape} hole`, exact: true })).toBeVisible();
  await expect(help(page)).toHaveText('Every shape is home.');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  await expectSlips(page, 0, 0);
});

test('a piece let go just outside the wrong hole is a wrong placement, as if dropped on it', async ({ page }) => {
  await openLevel1(page);
  const zoom = zoomOf(page);
  const board = puzzle(0, 0);
  const hole = board.holes[0];
  const other = board.pieces.find((p) => p.id !== hole.id)!;

  const box = await boxOf(sorterHole(page, hole.shape));
  await pointerDrag(page, sorterPiece(page, other.shape), { x: box.x - 16 * zoom, y: box.y + box.height / 2 });
  await expect(help(page)).toHaveText(`That hole is for the ${hole.shape}.`);
  await expect(help(page)).toHaveClass(/is-wrong/);
  // The piece is back in the tray, unpicked, and no hole filled.
  await expect(sorterPiece(page, other.shape)).toBeVisible();
  await expect(sorterPiece(page, other.shape)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('img', { name: /^Filled / })).toHaveCount(0);

  // The wrong placement is one slip on the board.
  await sortShapes(page, 'drag');
  await expect(help(page)).toHaveText('Every shape is home.');
  await expectSlips(page, 0, 1);
});

test('a piece let go 40 px from every hole goes back, and nothing counts', async ({ page }) => {
  await openLevel1(page);
  const zoom = zoomOf(page);
  const hole = puzzle(0, 0).holes[0];

  // 40 px (the frame's px) straight below the first hole: past the 24 px catch area of every hole.
  const box = await boxOf(sorterHole(page, hole.shape));
  await pointerDrag(page, sorterPiece(page, hole.shape), { x: box.x + box.width / 2, y: box.y + box.height + 40 * zoom });
  await expect(sorterPiece(page, hole.shape)).toBeVisible();
  await expect(sorterPiece(page, hole.shape)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('img', { name: /^Filled / })).toHaveCount(0);
  await expect(help(page)).toHaveText('Drag each shape into its hole.');
  await expect(help(page)).not.toHaveClass(/is-wrong/);

  await sortShapes(page, 'drag');
  await expect(help(page)).toHaveText('Every shape is home.');
  await expectSlips(page, 0, 0);
});

test('a piece let go on a filled hole goes back and is no slip, even beside an open hole', async ({ page }) => {
  // Level 3's first board: square, hexagon and star in the top row, circle and triangle under them.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', games: { sorter: { stars: starsUpTo(2) } } }]);
  await page.goto('/#/game/sorter');
  await expect(page).toHaveURL(/#\/game\/sorter\/3$/);
  const zoom = zoomOf(page);

  await pointerDrag(page, sorterPiece(page, 'hexagon'), sorterHole(page, 'hexagon'));
  const filled = page.getByRole('img', { name: 'Filled hexagon hole', exact: true });
  await expect(filled).toBeVisible();

  // 3 px (the frame's px) inside the filled hexagon hole's bottom edge, right over the open triangle hole.
  const box = await boxOf(filled);
  const release = { x: box.x + box.width / 2, y: box.y + box.height - 3 * zoom };
  const triangle = await boxOf(sorterHole(page, 'triangle'));
  const gap = (triangle.y - release.y) / zoom;
  expect(release.x, 'the triangle hole is under the hexagon').toBeGreaterThan(triangle.x);
  expect(release.x, 'the triangle hole is under the hexagon').toBeLessThan(triangle.x + triangle.width);
  expect(gap, 'the release is within the triangle hole’s catch area').toBeLessThanOrEqual(24);

  // The square let go there was dropped on a filled hole: it goes back, and the triangle hole does not count it.
  await pointerDrag(page, sorterPiece(page, 'square'), release);
  await expect(sorterPiece(page, 'square')).toBeVisible();
  await expect(sorterPiece(page, 'square')).toHaveAttribute('aria-pressed', 'false');
  await expect(help(page)).toHaveText('Drag each shape into its hole.');
  await expect(help(page)).not.toHaveClass(/is-wrong/);
  await expect(page.locator('.sort-hole.is-wrong')).toHaveCount(0);

  await sortShapes(page, 'drag');
  await expect(help(page)).toHaveText('Every shape is home.');
  await expectSlips(page, 2, 0);
});
