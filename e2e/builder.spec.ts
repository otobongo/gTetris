/**
 * Picture Builder journeys (six-games brief 10.4): a new child builds Level 1 into Level 2 with real pointer taps
 * and drags, on the phone and on the zoomed tablet frame; a memory level, where the look locks the board, Peek
 * shows the picture, the match bar is hidden and one wrong stroke is one slip; and a grown-up's pick of a locked
 * level that the child then plays. The picture is read from the model panel's accessible name (brief 9.2) while
 * it shows, and the bricks are laid through the palette and the board.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { LEVELS, LOOK_SECONDS } from '../src/games/builder/puzzles';
import {
  type Band,
  builderBoard,
  builderBoardCells,
  builderModel,
  builderPalette,
  builderPicture,
  builderSquare,
  builderSquareMiddle,
  builderStroke,
  builderSwatch,
  buildPicture,
  BUILDER_COLORS,
  type BuilderPicture,
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
 * Focus is on Next puzzle right after every solve (brief 9.1), whether the last right brick was laid by a stroke
 * or by a tap: the tap's own mousedown must not pull focus back onto the square it pressed.
 */
async function buildAndGoOn(page: Page, solvedBefore: number, how: 'drag' | 'tap') {
  const picture = await builderPicture(page);
  await buildPicture(page, picture, how);
  await expect(help(page)).toHaveText(new RegExp(`^You built the ${picture.name}( from memory)?\\.$`));
  if (solvedBefore + 1 >= 4) return;
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 1} of 4. ${solvedBefore + 1} solved.`);
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await expect(next).toBeFocused();
  await next.click();
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 2} of 4. ${solvedBefore + 1} solved.`);
  await expect(builderSquare(page, picture.size, 0)).toBeFocused();
}

/** The board's one tab stop. */
const tabStop = (page: Page) => builderBoard(page).locator('[tabindex="0"]');

/** Move the board's tab stop from one square to another with the arrow keys. */
async function arrowTo(page: Page, size: number, from: number, to: number) {
  const rows = Math.floor(to / size) - Math.floor(from / size);
  const cols = (to % size) - (from % size);
  for (let k = 0; k < Math.abs(rows); k++) await page.keyboard.press(rows > 0 ? 'ArrowDown' : 'ArrowUp');
  for (let k = 0; k < Math.abs(cols); k++) await page.keyboard.press(cols > 0 ? 'ArrowRight' : 'ArrowLeft');
}

/** Build the picture by keyboard only: Tab to a colour and press Space, Shift+Tab back to the board, arrows, then Enter. */
async function buildByKeys(page: Page, picture: BuilderPicture) {
  const { size, cells } = picture;
  let at = 0;
  await expect(tabStop(page)).toBeFocused();
  for (const color of BUILDER_COLORS) {
    if (!cells.includes(color)) continue;
    const steps = BUILDER_COLORS.indexOf(color) + 1;
    for (let k = 0; k < steps; k++) await page.keyboard.press('Tab');
    await expect(builderSwatch(page, color)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(builderSwatch(page, color)).toHaveAttribute('aria-pressed', 'true');
    for (let k = 0; k < steps; k++) await page.keyboard.press('Shift+Tab');
    await expect(builderSquare(page, size, at)).toBeFocused();
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== color) continue;
      await arrowTo(page, size, at, i);
      at = i;
      await expect(builderSquare(page, size, i)).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(builderSquare(page, size, i)).toHaveAccessibleName(new RegExp(`, ${color}$`));
    }
  }
}

test('focus after a solve: Enter on the last square and a finger tap on it both leave focus on Next puzzle', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/');
  await homeCard(page, 'Picture Builder').click();
  await expect(page).toHaveURL(/#\/game\/builder\/1$/);

  // Puzzle 1 by keyboard: the board is one tab stop, the arrows move it, Enter paints, and the solve moves focus.
  const first = await builderPicture(page);
  await builderSquare(page, first.size, 0).focus();
  await buildByKeys(page, first);
  await expect(help(page)).toHaveText(`You built the ${first.name}.`);
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await expect(next).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await expect(builderSquare(page, 3, 0)).toBeFocused();

  // Puzzle 2 by finger: every brick but the last tapped in, then a real touch tap lays the last one.
  const second = await builderPicture(page);
  const last = second.cells.map((c, i) => (c === null ? -1 : i)).reduce((a, b) => Math.max(a, b));
  await buildPicture(page, { ...second, cells: second.cells.map((c, i) => (i === last ? null : c)) }, 'tap');
  await builderSwatch(page, second.cells[last]!).click();
  const middle = await builderSquareMiddle(page, second.size, last);
  await page.touchscreen.tap(middle.x, middle.y);
  await expect(help(page)).toHaveText(`You built the ${second.name}.`);
  await expect(next).toBeFocused();
  // A later tap on the solved board leaves it there too.
  await page.touchscreen.tap(middle.x, middle.y);
  await expect(next).toBeFocused();
});

test('reduced motion: the picked colour keeps its white ring under keyboard focus, with the focus ring outside it', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/');
  await homeCard(page, 'Picture Builder').click();
  await expect(page).toHaveURL(/#\/game\/builder\/1$/);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);

  // Red is picked when the level opens. Tab onto yellow and back, so focus reaches red from the keyboard.
  const red = builderSwatch(page, 'red');
  await expect(red).toHaveAttribute('aria-pressed', 'true');
  await builderSwatch(page, 'yellow').focus();
  await page.keyboard.press('Shift+Tab');
  await expect(red).toBeFocused();
  expect(await red.evaluate((el) => el.matches(':focus-visible'))).toBe(true);

  const rings = (el: Element) => {
    const css = getComputedStyle(el);
    const after = getComputedStyle(el, '::after');
    return {
      outline: `${css.outlineWidth} ${css.outlineStyle} ${css.outlineColor}`,
      offset: css.outlineOffset,
      transform: css.transform,
      focus: `${after.borderTopWidth} ${after.borderTopStyle} ${after.borderTopColor}`,
      focusInset: after.top,
      focusContent: after.content,
    };
  };
  // The selected ring (4 px white, 2 px out) stays; reduced motion has no lift, so it is all that marks the pick.
  const focused = await red.evaluate(rings);
  expect(focused.outline).toBe('4px solid rgb(255, 255, 255)');
  expect(focused.offset).toBe('2px');
  expect(focused.transform).toBe('none');
  // The focus ring is drawn outside it: 3 px yellow, 11 px out, so a 2 px gap shows between the two.
  expect(focused.focusContent).not.toBe('none');
  expect(focused.focus).toBe('3px solid rgb(255, 194, 26)');
  expect(focused.focusInset).toBe('-11px');

  // A colour that is not picked shows the plain focus ring and no second one.
  await page.keyboard.press('Tab');
  const yellow = builderSwatch(page, 'yellow');
  await expect(yellow).toBeFocused();
  const plain = await yellow.evaluate(rings);
  expect(plain.outline).toBe('3px solid rgb(255, 194, 26)');
  expect(plain.focusContent).toBe('none');
  // And red, picked but no longer focused, shows only its white ring.
  const resting = await red.evaluate(rings);
  expect(resting.outline).toBe('4px solid rgb(255, 255, 255)');
  expect(resting.focusContent).toBe('none');
});

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
  await expect(page.getByRole('button', { name: 'Next puzzle' })).toBeFocused();
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

/* ---------- A short phone: the board fits above the palette (usability batch E) ----------
 * At 375x667 (an iPhone SE) and 390x664 (a 390 iPhone in Safari with its toolbars) the board used to run 64 px under
 * the palette, so a tap on a bottom-row square picked a colour instead. The board now takes only the height left
 * between the help row and the palette, its squares never under 44 px; on a shorter screen the play column scrolls. */

/** Open Picture Builder on `level` (1-based) for a child (5 to 6 unless `band` says) who has every level before it. */
async function openBuilderLevel(page: Page, level: number, band: Band = '5-6') {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: band, games: level > 1 ? { builder: { stars: starsUpTo(level - 1) } } : undefined }]);
  await page.goto('/#/game/builder');
  await expect(page).toHaveURL(new RegExp(`#/game/builder/${level}$`));
  await expect(builderSquares(page).first()).toBeVisible();
}

const builderSquares = (page: Page) => builderBoard(page).locator('[data-cell]');
/** The board's well around the squares. */
const boardWell = (page: Page) => page.locator('.pb-board');

interface SquareHit {
  cell: number;
  width: number;
  height: number;
  /** A finger at the square's middle lands on the square, not on the palette or anything else. */
  hits: boolean;
}

/** Where a finger at the middle of each square lands; `only` limits it to some squares. */
async function squareHits(page: Page, only?: number[]): Promise<SquareHit[]> {
  const all = await builderSquares(page).evaluateAll((els) =>
    els.map((el) => {
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return { cell: Number(el.getAttribute('data-cell')), width: b.width, height: b.height, hits: hit !== null && (hit === el || el.contains(hit)) };
    }),
  );
  return only ? all.filter((h) => only.includes(h.cell)) : all;
}

/** The swatches' rows, top to bottom, each a list of their sizes in px. */
async function paletteRows(page: Page): Promise<string[][]> {
  const swatches = await builderPalette(page)
    .getByRole('button')
    .evaluateAll((els) => (els as HTMLElement[]).map((el) => ({ top: el.offsetTop, size: `${el.offsetWidth}x${el.offsetHeight}` })));
  const rows = new Map<number, string[]>();
  for (const s of swatches) rows.set(s.top, [...(rows.get(s.top) ?? []), s.size]);
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, sizes]) => sizes);
}
const PALETTE_ROWS = [Array(4).fill('54x54'), Array(3).fill('54x54')];

/** The board's nearest scrolling ancestor (or the page): how far it is scrolled, and how far it could scroll. */
async function scrollOf(page: Page): Promise<{ top: number; room: number }> {
  return boardWell(page).evaluate((board) => {
    let el: HTMLElement | null = board.parentElement;
    while (el) {
      const y = getComputedStyle(el).overflowY;
      if ((y === 'auto' || y === 'scroll') && el.scrollHeight > el.clientHeight) break;
      el = el.parentElement;
    }
    const scroller = el ?? (document.scrollingElement as HTMLElement);
    return { top: scroller.scrollTop, room: scroller.scrollHeight - scroller.clientHeight };
  });
}

/**
 * A real finger drag through the browser's touch input, so the page scrolls wherever touch-action lets it. With
 * `hold`, the finger rests at the end for 240 ms before it lifts, so a scroll ends with no fling. A fling that runs
 * into the end of the column shows no movement while it lasts, and it would move a scroll the test sets after it.
 */
async function fingerDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, { steps = 8, hold = false } = {}) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let k = 1; k <= steps; k++) {
    const x = from.x + ((to.x - from.x) * k) / steps;
    const y = from.y + ((to.y - from.y) * k) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
  }
  for (let k = 0; hold && k < 6; k++) {
    await page.waitForTimeout(40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: to.x, y: to.y }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

/** The middle of a locator's box, in viewport px. */
async function middleOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Not on screen');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

for (const viewport of [
  { width: 375, height: 667 },
  { width: 390, height: 664 },
]) {
  test.describe(`a short phone, ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    for (const level of [1, 4, 10, 12]) {
      test(`Level ${level}: every square takes its own tap, clear of the palette, and the palette keeps its 54 px rows`, { tag: '@phone-only' }, async ({ page }) => {
        await openBuilderLevel(page, level);
        const hits = await squareHits(page);
        expect(hits).toHaveLength(LEVELS[level - 1].size ** 2);
        expect(hits.filter((h) => !h.hits).map((h) => h.cell)).toEqual([]);

        // Every square is a 44 pt target at least, on the 5 by 5 boards too.
        for (const h of hits) {
          expect(h.width).toBeGreaterThanOrEqual(44);
          expect(h.height).toBeGreaterThanOrEqual(44);
        }

        // The palette starts at or below the board's bottom edge, and the whole screen fits without scrolling.
        const board = (await boardWell(page).boundingBox())!;
        const palette = (await builderPalette(page).boundingBox())!;
        expect(palette.y).toBeGreaterThanOrEqual(board.y + board.height);
        expect(palette.y + palette.height).toBeLessThanOrEqual(viewport.height);
        expect((await scrollOf(page)).room).toBe(0);

        // The swatches stay 54 by 54, in rows of 4 then 3.
        expect(await paletteRows(page)).toEqual(PALETTE_ROWS);
      });
    }
  });
}

test.describe('a short phone, 375x667, by taps alone', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

  test('Level 1 puzzle 1 is built by finger taps alone, bottom row included, and Next puzzle appears', { tag: '@phone-only' }, async ({ page }) => {
    await openBuilderLevel(page, 1);
    const picture = await builderPicture(page);
    expect(picture.cells.slice(-picture.size).some(Boolean)).toBe(true);
    for (const color of BUILDER_COLORS) {
      if (!picture.cells.includes(color)) continue;
      const at = await middleOf(builderSwatch(page, color));
      await page.touchscreen.tap(at.x, at.y);
      await expect(builderSwatch(page, color)).toHaveAttribute('aria-pressed', 'true');
      for (let i = 0; i < picture.cells.length; i++) {
        if (picture.cells[i] !== color) continue;
        const middle = await builderSquareMiddle(page, picture.size, i);
        await page.touchscreen.tap(middle.x, middle.y);
        await expect(builderSquare(page, picture.size, i)).toHaveAccessibleName(new RegExp(`, ${color}$`));
      }
    }
    await expect(help(page)).toHaveText(`You built the ${picture.name}.`);
    expect(await builderBoardCells(page)).toEqual(picture.cells);
    await expect(page.getByRole('button', { name: 'Next puzzle' })).toBeVisible();
    await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  });
});

/* 375x548 is an iPhone SE in Safari with its toolbars; 320x568 is a first iPhone SE, or a phone with Display Zoom,
 * where the board used to run past the right edge too. */
for (const viewport of [
  { width: 375, height: 548 },
  { width: 320, height: 568 },
]) {
  test.describe(`a very short phone, ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    for (const level of [1, 10]) {
      test(`Level ${level}: the play column scrolls, every square takes its own tap, and a stroke never scrolls`, { tag: '@phone-only' }, async ({ page }) => {
        await openBuilderLevel(page, level);
        const size = LEVELS[level - 1].size;

        // The board and its 4 px ring stay inside the 16 px side gutters.
        const well = (await boardWell(page).boundingBox())!;
        expect(well.x - 4).toBeGreaterThanOrEqual(16);
        expect(well.x + well.width + 4).toBeLessThanOrEqual(viewport.width - 16);

        // The screen is too short for the board and the palette, so the play column scrolls: a finger drag up on the
        // picture's title, above the board, scrolls it.
        expect((await scrollOf(page)).room).toBeGreaterThan(0);
        const above = await middleOf(pictureTitle(page));
        await fingerDrag(page, above, { x: above.x, y: above.y - 120 }, { hold: true });
        await expect.poll(async () => (await scrollOf(page)).top).toBeGreaterThan(0);
        // Let the scroll come to rest before measuring.
        let prev = -1;
        await expect
          .poll(async () => {
            const top = (await scrollOf(page)).top;
            const still = top === prev;
            prev = top;
            return still;
          }, { intervals: [150] })
          .toBe(true);

        // Scrolled to each square in turn, a finger at its middle lands on it. Squares stay 44 px or more.
        for (let i = 0; i < size * size; i++) {
          await builderSquare(page, size, i).evaluate((el) => el.scrollIntoView({ block: 'nearest' }));
          const [hit] = await squareHits(page, [i]);
          expect(hit.hits, `square ${i}`).toBe(true);
          expect(hit.width).toBeGreaterThanOrEqual(44);
          expect(hit.height).toBeGreaterThanOrEqual(44);
        }

        // The palette is below the board, never over it, and keeps its 54 px swatches.
        const board = (await boardWell(page).boundingBox())!;
        const palette = (await builderPalette(page).boundingBox())!;
        expect(palette.y).toBeGreaterThanOrEqual(board.y + board.height);
        expect(await paletteRows(page)).toEqual(PALETTE_ROWS);

        // With the whole board in view, a finger stroke down the first column paints it and leaves the scroll alone.
        await boardWell(page).evaluate((el) => el.scrollIntoView({ block: 'center' }));
        const where = async () => ({ ...(await scrollOf(page)), board: (await boardWell(page).boundingBox())!.y });
        const before = await where();
        const first = await builderSquareMiddle(page, size, 0);
        const last = await builderSquareMiddle(page, size, (size - 1) * size);
        await fingerDrag(page, first, last, { steps: 12 });
        await expect.poll(async () => (await builderBoardCells(page)).filter((_, i) => i % size === 0)).toEqual(Array(size).fill('red'));
        // The board stays under the finger, and the column scrolled no further than its own end moved. That end moves
        // only at 320 px, where the first wrong brick shortens the help line from three lines to two: the column
        // gives back those 6 px and, scrolled to its end, follows them, with the board in the same place on screen.
        const after = await where();
        expect(Math.abs(after.board - before.board)).toBeLessThanOrEqual(0.5);
        expect(after.top - before.top).toBe(after.room - before.room);
      });
    }
  });
}

/* Where the board always fitted it keeps its size: 334 px at 390x844, and the same board zoomed on the tablet. */
for (const [level, size, phone, tablet] of [
  [1, 3, 107.3, 150.3],
  [4, 4, 79, 110.6],
  [10, 5, 62, 86.8],
] as const) {
  test(`Level ${level}: ${size} by ${size} squares keep their size on a tall phone and on the tablet`, async ({ page }, info) => {
    await openBuilderLevel(page, level);
    const want = info.project.name === 'tablet' ? tablet : phone;
    const hits = await squareHits(page);
    expect(hits).toHaveLength(size * size);
    for (const h of hits) {
      expect(h.hits).toBe(true);
      expect(Math.abs(h.width - want)).toBeLessThanOrEqual(1);
      expect(Math.abs(h.height - want)).toBeLessThanOrEqual(1);
    }
    expect(await paletteRows(page)).toEqual(PALETTE_ROWS);
  });
}

/* The tablet held sideways is taller than every short-phone query, so its board keeps the 390x844 sizes. */
test.describe('the tablet held sideways, 1194x834', () => {
  test.use({ viewport: { width: 1194, height: 834 }, isMobile: true, hasTouch: true });

  for (const [level, size, want] of [
    [1, 3, 107.3],
    [4, 4, 79],
    [10, 5, 62],
  ] as const) {
    test(`Level ${level}: ${size} by ${size} squares keep their size`, { tag: '@phone-only' }, async ({ page }) => {
      await openBuilderLevel(page, level);
      const hits = await squareHits(page);
      expect(hits).toHaveLength(size * size);
      for (const h of hits) {
        expect(h.hits).toBe(true);
        expect(Math.abs(h.width - want)).toBeLessThanOrEqual(1);
        expect(Math.abs(h.height - want)).toBeLessThanOrEqual(1);
      }
      expect(await paletteRows(page)).toEqual(PALETTE_ROWS);
    });
  }
});

/* The edges of the short-phone sizes on a 5 by 5 board: 781 and 780 px high, where the board starts to fit its
 * stage; 721 and 720, where the picture, the gaps and the well give up more; 657 and 656, around the 44 px floor
 * where the column starts to scroll. At each one every square takes its own tap at 44 px or more, and the whole
 * palette is on screen below the board. */
for (const height of [781, 780, 721, 720, 657, 656]) {
  test.describe(`a 390 px phone, ${height} px high`, () => {
    test.use({ viewport: { width: 390, height }, isMobile: true, hasTouch: true });

    test('Level 10: every square takes its own tap, and the palette is on screen below the board', { tag: '@phone-only' }, async ({ page }) => {
      await openBuilderLevel(page, 10);
      const hits = await squareHits(page);
      expect(hits).toHaveLength(25);
      expect(hits.filter((h) => !h.hits).map((h) => h.cell)).toEqual([]);
      for (const h of hits) {
        expect(h.width).toBeGreaterThanOrEqual(44);
        expect(h.height).toBeGreaterThanOrEqual(44);
      }
      const board = (await boardWell(page).boundingBox())!;
      const palette = (await builderPalette(page).boundingBox())!;
      expect(palette.y).toBeGreaterThanOrEqual(board.y + board.height);
      expect(palette.y + palette.height).toBeLessThanOrEqual(height);
      expect(await paletteRows(page)).toEqual(PALETTE_ROWS);
    });
  });
}

/* A memory level on a short phone, for every age band. Only the picture shrinks there, so once the band's first look
 * ends Peek keeps its full-size cover (54 px or more, its eye 26 px, its label unshrunk), and a finger on it shows the
 * picture for the band's peek time. Throughout, every square takes its own tap, clear of the palette. */
test.describe('a memory level on a short phone, 375x667', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

  for (const band of ['3-4', '5-6', '7-8', '9-10'] as const) {
    test(`ages ${band}: Peek keeps its full size above a board that fits`, { tag: '@phone-only' }, async ({ page }) => {
      await page.clock.install();
      await openBuilderLevel(page, 12, band);
      await expect(pictureTitle(page)).toHaveText('Look closely.');
      await page.clock.runFor(LOOK_SECONDS[band].first * 1000);
      await expect(pictureTitle(page)).toHaveText('Build it from memory.');

      const cover = (await peek(page).boundingBox())!;
      expect(cover.width).toBeGreaterThanOrEqual(54);
      expect(cover.height).toBeGreaterThanOrEqual(54);
      const eye = (await peek(page).locator('svg').boundingBox())!;
      expect(Math.abs(eye.width - 26)).toBeLessThanOrEqual(0.5);

      const hits = await squareHits(page);
      expect(hits).toHaveLength(25);
      expect(hits.filter((h) => !h.hits).map((h) => h.cell)).toEqual([]);
      for (const h of hits) expect(Math.min(h.width, h.height)).toBeGreaterThanOrEqual(44);
      const board = (await boardWell(page).boundingBox())!;
      expect((await builderPalette(page).boundingBox())!.y).toBeGreaterThanOrEqual(board.y + board.height);

      // A finger on Peek shows the picture and locks the board for the band's peek time, then the picture hides.
      const at = await middleOf(peek(page));
      await page.touchscreen.tap(at.x, at.y);
      await expect(builderModel(page)).toHaveAccessibleName(/^Picture of /);
      await expect(builderSquare(page, 5, 0)).toHaveAttribute('aria-disabled', 'true');
      await page.clock.runFor(LOOK_SECONDS[band].peek * 1000);
      await expect(builderModel(page)).toHaveAccessibleName('Picture hidden. Tap Peek to look again.');
      await expect(peek(page)).toBeVisible();
    });
  }
});
