/**
 * Brick Drop journey (four-puzzle brief 2.1, 4.2, 5, 9.1, 10): a child clears the four puzzles of Stage 1 and
 * goes straight into Stage 2. Each brick is placed with the keys from a plan the game's own engine makes on the
 * puzzle's fixed starter stack and brick order, so the bricks, the score and the stars the screen shows can be
 * checked against numbers worked out here, not read back from the app.
 */
import { expect, test, type Page } from '@playwright/test';
import { dropLevelStars } from '../src/games/run';
import { puzzleTargets } from '../src/games/drop/puzzles';
import { STAGES } from '../src/games/drop/stages';
import type { PuzzleResult } from '../src/shared/progress';
import { dots, homeCard, levelCard, planDropPuzzle, playDropPuzzle, savedGame, savedRun, seed, starsUpTo, type Band } from './app';

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

/* ---------- The intro teaches the touch gestures, and short phones get bigger cells (usability pass, batch H) ---------- */

const TOUCH_LINE = 'Tap the board to turn. Swipe down to drop.';
const KEYS_LINE = 'Keys: arrow keys move, Up turns, Space drops, P pauses.';

/** Open Stage `stage` (1-based) from Home for a child of `band`, with the stages before it finished. The intro sheet is up. */
async function openStage(page: Page, stage: number, band: Band) {
  await seed(page, [{ id: 'kai', name: 'Kai', ageBand: band, games: { drop: { stars: starsUpTo(stage - 1) } } }]);
  await page.goto(`/#/game/drop/${stage}`);
  await expect(page.getByRole('dialog')).toBeVisible();
}

/** The board's cell size in px (frame px on a tablet), read from the grid it draws. */
async function cellSize(page: Page, stage: number): Promise<number> {
  const grid = page.getByRole('group', { name: /^Board\./ }).locator('.drop-grid');
  const w = await grid.evaluate((el) => (el as HTMLElement).clientWidth);
  return w / STAGES[stage - 1].cols;
}

test('the intro sheet teaches the board gestures on a touch screen, and the keys once a key is pressed', async ({ page }) => {
  await openStage(page, 9, '7-8');
  const sheet = page.getByRole('dialog');
  await expect(sheet).toContainText(TOUCH_LINE);
  await expect(sheet).not.toContainText('Keys:');

  // A keyboard turns up (an iPad with a keyboard case): the next press shows the keys line on the same sheet.
  await page.keyboard.press('ArrowLeft');
  await expect(sheet).toContainText(KEYS_LINE);
  await expect(sheet).not.toContainText(TOUCH_LINE);
  // The key did nothing else: the sheet is still up and Start still has focus.
  await expect(sheet.getByRole('button', { name: 'Start' })).toBeFocused();
});

/*
 * Cell sizes before this change, measured on the intro sheet (Stage 3 is 7 x 14, Stage 9 is 10 x 18). They are the
 * same on both projects, since the tablet frame is the phone design zoomed: phone 390 x 844, tablet 834 x 1194.
 */
const TODAY: Record<'3-4' | '7-8', Record<3 | 9, number>> = {
  '3-4': { 3: 35, 9: 27 },
  '7-8': { 3: 36, 9: 28 },
};

for (const band of ['3-4', '7-8'] as const) {
  for (const stage of [3, 9] as const) {
    test(`Stage ${stage} at ages ${band} keeps its cell size on the phone and the tablet`, async ({ page }) => {
      await openStage(page, stage, band);
      expect(Math.abs((await cellSize(page, stage)) - TODAY[band][stage])).toBeLessThanOrEqual(1);
    });
  }
}

test.describe('a short phone (375 x 667)', () => {
  test.use({ viewport: { width: 375, height: 667 } });
  const VW = 375;
  const VH = 667;

  /** Stage 3 cells at 375 x 667 before this change: 22px at ages 3 to 4 (the sand timer row is taller), 23px at 7 to 8. */
  const STAGE3_BEFORE: Record<'3-4' | '7-8', number> = { '3-4': 22, '7-8': 23 };

  type Box = { x: number; y: number; width: number; height: number };
  const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  for (const band of ['3-4', '7-8'] as const) {
    test(`ages ${band}: Stage 9 cells are at least 21px, with the Next and Rows tiles beside the well @phone-only`, async ({ page }) => {
      await openStage(page, 9, band);
      expect(await cellSize(page, 9)).toBeGreaterThanOrEqual(21);

      const well = (await page.getByRole('group', { name: /^Board\./ }).boundingBox())!;
      const pad = (await page.getByRole('group', { name: 'Controls' }).boundingBox())!;
      // The well's 4px ring is drawn outside its box.
      const ring = { x: well.x - 4, y: well.y - 4, width: well.width + 8, height: well.height + 8 };
      for (const name of ['Next', 'Rows']) {
        const tile = (await page.locator('.drop-tile').filter({ hasText: name }).boundingBox())!;
        expect(tile.x).toBeGreaterThanOrEqual(0);
        expect(tile.y).toBeGreaterThanOrEqual(0);
        expect(tile.x + tile.width).toBeLessThanOrEqual(VW);
        expect(tile.y + tile.height).toBeLessThanOrEqual(VH);
        expect(overlaps(tile, ring), `${name} tile over the well`).toBe(false);
        expect(overlaps(tile, pad), `${name} tile over the controls`).toBe(false);
        // beside the well, not in a row above it
        expect(tile.y).toBeLessThan(well.y + well.height);
        expect(tile.y + tile.height).toBeGreaterThan(well.y);
      }
      // The well and the controls are on screen too, and nothing makes the page scroll.
      expect(ring.x).toBeGreaterThanOrEqual(0);
      expect(ring.x + ring.width).toBeLessThanOrEqual(VW);
      expect(pad.y + pad.height).toBeLessThanOrEqual(VH);
      expect(overlaps(ring, pad)).toBe(false);
      const scroll = await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight }));
      expect(scroll.w).toBeLessThanOrEqual(VW);
      expect(scroll.h).toBeLessThanOrEqual(VH);
    });

    test(`ages ${band}: Stage 3 cells grow by at least 3px @phone-only`, async ({ page }) => {
      await openStage(page, 3, band);
      expect(await cellSize(page, 3)).toBeGreaterThanOrEqual(STAGE3_BEFORE[band] + 3);
    });
  }
});
