/**
 * Picture Builder, usability round 2: the board's reduced-motion fade (decision 38), the ring on empty squares
 * (decision 27) and the half-built board kept for the session (decision 13, the board half). Every layout check
 * waits for the real font (Baloo 2) first, so nothing is measured with a fallback.
 */
import { expect, test, type Page } from '@playwright/test';
import { LEVELS } from '../src/games/builder/puzzles';
import {
  type Band,
  builderBoard,
  builderBoardCells,
  builderPicture,
  builderSquare,
  builderSwatch,
  BUILDER_COLORS,
  type BuilderCell,
  dots,
  homeCard,
  seed,
  starsUpTo,
} from './app';

const help = (page: Page) => page.locator('.bw-helprow__line');
const matchBar = (page: Page) => page.getByRole('progressbar');
const pictureTitle = (page: Page) => page.getByRole('heading', { level: 2 });

/** Open Picture Builder on `level` (1-based) for a child who has every level before it. */
async function openBuilderLevel(page: Page, level: number, band: Band = '5-6') {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: band, games: level > 1 ? { builder: { stars: starsUpTo(level - 1) } } : undefined }]);
  await page.goto('/#/game/builder');
  await expect(page).toHaveURL(new RegExp(`#/game/builder/${level}$`));
  await expect(builderBoard(page).locator('[data-cell]').first()).toBeVisible();
}

/** The real font is loaded, so every measurement is the one a child sees. */
async function expectRealFont(page: Page) {
  // The app loads weights 600 to 800; loading one from the page resolves only when the file is served.
  expect(await page.evaluate(async () => (await document.fonts.load('800 16px "Baloo 2"')).length), 'the real font').toBeGreaterThan(0);
  expect(await page.evaluate(() => document.fonts.check('800 16px "Baloo 2"')), 'the real font').toBe(true);
}

/* ---------- Decision 38: the board's fade keeps its 150 ms under Reduce Motion ---------- */

test('under Reduce Motion the board fades its opacity over 150 ms and nothing else', async ({ page }) => {
  await openBuilderLevel(page, 6);
  await expectRealFont(page);
  const t = await page.locator('.pb-board').evaluate((el) => {
    const s = getComputedStyle(el);
    return { property: s.transitionProperty, duration: s.transitionDuration, timing: s.transitionTimingFunction };
  });
  expect(t).toEqual({ property: 'opacity', duration: '0.15s', timing: 'linear' });
});

/* ---------- Decision 27: an empty square shows a 2 px --bw-decor ring ---------- */

const RING = 'rgb(142, 133, 214) 0px 0px 0px 2px inset';
const BRICK_FACE = 'rgba(255, 255, 255, 0.35) 0px 2px 0px 0px inset, rgba(0, 0, 0, 0.22) 0px -4px 0px 0px inset';

/** sRGB relative luminance and contrast, WCAG 2. */
function luminance([r, g, b]: number[]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const rgbOf = (css: string): number[] => (/rgba?\(([^)]+)\)/.exec(css)?.[1] ?? '').split(',').map((v) => Number(v.trim()));

async function checkRings(page: Page) {
  await expectRealFont(page);
  const size = (await builderPicture(page)).size;
  await builderSwatch(page, 'blue').click();
  await builderSquare(page, size, 0).click();
  await expect(builderSquare(page, size, 0)).toHaveAccessibleName(/, blue/);
  // Let the brick's 0.01 ms shadow change settle before reading it.
  await expect.poll(() => builderSquare(page, size, 0).evaluate((el) => getComputedStyle(el).boxShadow)).toBe(BRICK_FACE);
  const shadows = await builderBoard(page)
    .locator('[data-cell]')
    .evaluateAll((els) => els.map((el) => ({ brick: el.getAttribute('data-brick'), shadow: getComputedStyle(el).boxShadow, fill: getComputedStyle(el).backgroundColor })));
  expect(shadows).toHaveLength(size * size);
  expect(shadows[0]).toMatchObject({ brick: 'blue', shadow: BRICK_FACE });
  for (const s of shadows.slice(1)) {
    expect(s.brick).toBeNull();
    expect(s.shadow).toBe(RING);
    expect(s.fill).toBe('rgba(255, 255, 255, 0.05)');
  }
  // The ring against the empty square's fill (white at 5 % over the well), at least 3:1.
  const well = rgbOf(await page.locator('.pb-board').evaluate((el) => getComputedStyle(el).backgroundColor));
  const fill = well.map((v) => v + (255 - v) * 0.05);
  expect(contrast(rgbOf(RING), fill)).toBeGreaterThanOrEqual(3);
}

for (const level of [1, 10]) {
  test(`Level ${level}: every empty square has the ring, a brick keeps its own face`, async ({ page }) => {
    await openBuilderLevel(page, level);
    await checkRings(page);
  });
}

for (const viewport of [
  { width: 375, height: 667 },
  { width: 1194, height: 834 },
  { width: 375, height: 548 },
]) {
  test.describe(`empty squares at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });
    test('every empty square has the ring, a brick keeps its own face', { tag: '@phone-only' }, async ({ page }) => {
      await openBuilderLevel(page, 4);
      await checkRings(page);
    });
  });
}

/* ---------- Decision 13: the half-built board stays for the session ---------- */

/** Lay `count` bricks on the picture's bricks, the first one in a wrong colour. Returns what the board then holds. */
async function layBricks(page: Page, count: number): Promise<{ cells: BuilderCell[]; size: number; name: string }> {
  const picture = await builderPicture(page);
  const { size, cells } = picture;
  const spots = cells.map((c, i) => (c ? i : -1)).filter((i) => i >= 0).slice(0, count);
  expect(spots).toHaveLength(count);
  const [first, ...rest] = spots;
  const wrong = BUILDER_COLORS.find((c) => c !== cells[first])!;
  await builderSwatch(page, wrong).click();
  await builderSquare(page, size, first).click();
  for (const i of rest) {
    await builderSwatch(page, cells[i]!).click();
    await builderSquare(page, size, i).click();
  }
  const now = await builderBoardCells(page);
  expect(now.filter(Boolean)).toHaveLength(count);
  return { cells: now, size, name: picture.name };
}

async function backHome(page: Page) {
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(homeCard(page, 'Picture Builder')).toBeVisible();
}

for (const [level, band] of [
  [1, '3-4'],
  [10, '9-10'],
] as const) {
  test(`Level ${level} (ages ${band}): the board comes back after Back and after a reload`, async ({ page }) => {
    await openBuilderLevel(page, level, band);
    await expectRealFont(page);
    const built = await layBricks(page, 5);
    const total = (await builderPicture(page)).cells.filter(Boolean).length;
    expect(LEVELS[level - 1].size).toBe(built.size);
    const bar = `4 of ${total} bricks right`;
    await expect(matchBar(page)).toHaveAttribute('aria-label', bar);
    const line = await help(page).textContent();

    await backHome(page);
    await homeCard(page, 'Picture Builder').click();
    await expect(page).toHaveURL(new RegExp(`#/game/builder/${level}$`));
    await expect(pictureTitle(page)).toHaveText(`Build the ${built.name}.`);
    await expect.poll(() => builderBoardCells(page)).toEqual(built.cells);
    await expect(matchBar(page)).toHaveAttribute('aria-label', bar);
    await expect(help(page)).toHaveText(line!);

    await page.reload();
    await expect(pictureTitle(page)).toHaveText(`Build the ${built.name}.`);
    await expect.poll(() => builderBoardCells(page)).toEqual(built.cells);
    await expect(matchBar(page)).toHaveAttribute('aria-label', bar);
  });
}

test('a new tab starts the puzzle empty', async ({ page, context }) => {
  await openBuilderLevel(page, 1);
  const built = await layBricks(page, 3);
  const other = await context.newPage();
  await other.goto('/#/game/builder');
  await expect(other).toHaveURL(/#\/game\/builder\/1$/);
  await expect(pictureTitle(other)).toHaveText(`Build the ${built.name}.`);
  expect((await builderBoardCells(other)).every((c) => c === null)).toBe(true);
  await other.close();
});

test('another child on the same device does not see the draft', async ({ page }) => {
  await seed(page, [
    { id: 'maya', name: 'Maya', ageBand: '5-6' },
    { id: 'sam', name: 'Sam', ageBand: '5-6' },
  ]);
  await page.goto('/#/game/builder');
  await expect(page).toHaveURL(/#\/game\/builder\/1$/);
  const built = await layBricks(page, 3);
  // Sam becomes the active player (as Who's playing would make him) and opens the same puzzle.
  await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key)!);
    s.activePlayerId = 'sam';
    localStorage.setItem(key, JSON.stringify(s));
  }, 'brickwise:v2');
  await page.reload();
  await expect(pictureTitle(page)).toHaveText(`Build the ${built.name}.`);
  expect((await builderBoardCells(page)).every((c) => c === null)).toBe(true);
});

test('solved, the next puzzle starts empty; a swap starts empty, and the swapped-away puzzle is empty when it comes back', { tag: '@phone-only' }, async ({ page }) => {
  await openBuilderLevel(page, 1, '3-4');
  const picture = await builderPicture(page);
  // Solve the first puzzle: its draft goes, and the next puzzle starts empty, after a reload too.
  const spots = picture.cells.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  for (const i of spots) {
    await builderSwatch(page, picture.cells[i]!).click();
    await builderSquare(page, picture.size, i).click();
  }
  await expect(help(page)).toHaveText(`You built the ${picture.name}.`);
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  expect((await builderBoardCells(page)).every((c) => c === null)).toBe(true);
  await page.reload();
  expect((await builderBoardCells(page)).every((c) => c === null)).toBe(true);

  // Wrong bricks until New puzzle is offered (ages 3 to 4), then a swap.
  const second = await builderPicture(page);
  const wrongAt = (i: number) => BUILDER_COLORS.find((c) => c !== second.cells[i])!;
  for (let i = 0; i < second.cells.length && (await page.getByRole('button', { name: 'New puzzle' }).count()) === 0; i++) {
    await builderSwatch(page, wrongAt(i)).click();
    await builderSquare(page, second.size, i).click();
  }
  await page.getByRole('button', { name: 'New puzzle' }).click();
  const third = await builderPicture(page);
  expect(third.name).not.toBe(second.name);
  expect((await builderBoardCells(page)).every((c) => c === null)).toBe(true);
  await page.reload();
  await expect(pictureTitle(page)).toHaveText(`Build the ${third.name}.`);
  expect((await builderBoardCells(page)).every((c) => c === null)).toBe(true);
  // Swapping away the rest of the queue brings the second picture back, empty.
  for (let n = 0; n < 6 && (await builderPicture(page)).name !== second.name; n++) {
    const now = await builderPicture(page);
    const wrong = (i: number) => BUILDER_COLORS.find((c) => c !== now.cells[i])!;
    for (let i = 0; i < now.cells.length && (await page.getByRole('button', { name: 'New puzzle' }).count()) === 0; i++) {
      await builderSwatch(page, wrong(i)).click();
      await builderSquare(page, now.size, i).click();
    }
    await page.getByRole('button', { name: 'New puzzle' }).click();
  }
  await expect(pictureTitle(page)).toHaveText(`Build the ${second.name}.`);
  expect((await builderBoardCells(page)).every((c) => c === null)).toBe(true);
});

test('a memory level restores the board and runs its first look over it, locked', { tag: '@phone-only' }, async ({ page }) => {
  await page.clock.install();
  await openBuilderLevel(page, 6, '9-10');
  await expect(pictureTitle(page)).toHaveText('Look closely.');
  const picture = await builderPicture(page);
  await page.clock.runFor(3_000);
  await expect(pictureTitle(page)).toHaveText('Build it from memory.');
  const i = picture.cells.findIndex(Boolean);
  await builderSwatch(page, picture.cells[i]!).click();
  await builderSquare(page, picture.size, i).click();
  const want = await builderBoardCells(page);
  expect(want.filter(Boolean)).toHaveLength(1);

  await page.reload();
  await expect(pictureTitle(page)).toHaveText('Look closely.');
  await expect.poll(() => builderBoardCells(page)).toEqual(want);
  await expect(builderSquare(page, picture.size, i)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.pb-board')).toHaveClass(/is-looking/);
  await page.clock.runFor(3_000);
  await expect(pictureTitle(page)).toHaveText('Build it from memory.');
  await expect(builderSquare(page, picture.size, i)).not.toHaveAttribute('aria-disabled', 'true');
  expect(await builderBoardCells(page)).toEqual(want);
});
