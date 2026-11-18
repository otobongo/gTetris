/**
 * Brick Drop, round 2 of the usability pass:
 * - decision 9: bricks fall 1.6 times slower at ages 3 to 4 (and 1.3 at 5 to 6), from the next puzzle;
 * - decision 11: while paused, any pad press, board tap or game key resumes, and the help line says so;
 * - decisions 17 and 20: a speaker on the intro card and one beside Next and Rows, both gone while Voice is off;
 * - decision 19: finishing the last stage of a chapter gives that chapter's Drop sticker (the card's sticker row
 *   is the shared LevelCard's, checked in postmerge-drop.spec.ts);
 * - decision 38: under Reduce Motion the row flash, the help line and the scrim fade over 150 ms, and nothing moves.
 * The fall speed is read from the board with the page's clock paused, so each step of time is exact.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { STAGES } from '../src/games/drop/stages';
import { STORAGE_KEY, dots, editSavedInAnotherTab, levelCard, planDropPuzzle, playDropPuzzle, recordSpeech, savedRun, savedState, seed, starsUpTo, type Band } from './app';

const PAUSED = 'Paused. Press any button to play.';
const TOUCH_LINE = 'Tap the board to turn. Swipe down to drop.';

const board = (page: Page): Locator => page.getByRole('group', { name: /^Board\./ });
const pad = (page: Page): Locator => page.getByRole('group', { name: 'Controls' });
const say = (page: Page): Locator => page.locator('.drop-say');
const padButton = (page: Page, name: 'Left' | 'Turn' | 'Down' | 'Right'): Locator => pad(page).getByRole('button', { name, exact: true });

/** Open Stage `stage` (1-based) for a child of `band`, with the stages before it finished. The intro sheet is up. */
async function openStage(page: Page, stage: number, band: Band, opts: { clock?: boolean } = {}) {
  if (opts.clock) await page.clock.install();
  await seed(page, [{ id: 'kai', name: 'Kai', ageBand: band, games: { drop: { stars: starsUpTo(stage - 1) } } }]);
  await page.goto(`/#/game/drop/${stage}`);
  await expect(page.getByRole('dialog')).toBeVisible();
  // Bricks fall only when the test moves the clock on.
  if (opts.clock) await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
}

/** Close the intro: the first brick waits at the top and the board has focus. */
async function start(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();
  await expect(say(page)).toContainText('Press any button to start.');
}

/** The falling brick on screen: its leftmost column and top row, and its cells (in board cells). */
async function brick(page: Page, stage: number): Promise<{ x: number; y: number; cells: string }> {
  return board(page).evaluate((el, cols) => {
    const grid = el.querySelector<HTMLElement>('.drop-grid')!;
    const cell = grid.clientWidth / cols;
    const at = [...grid.querySelectorAll<HTMLElement>('.drop-cell.is-active')].map((c) => {
      const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(c.style.transform)!;
      return [Math.round(Number(m[1]) / cell), Math.round(Number(m[2]) / cell)];
    });
    return { x: Math.min(...at.map((p) => p[0])), y: Math.min(...at.map((p) => p[1])), cells: at.map((p) => p.join(',')).sort().join(' ') };
  }, STAGES[stage - 1].cols);
}

/**
 * Move the paused clock on to the next animation frame. Fake frames fire every 16 ms of the page's
 * performance clock, so a press made right on a frame starts its fall time at exactly 0.
 */
async function toFrame(page: Page) {
  const t = await page.evaluate(() => performance.now());
  const rest = Math.round((16 - (t % 16)) % 16);
  if (rest) await page.clock.runFor(rest);
}

/** Press Down on a frame (a soft drop, which starts the fall time again) and return the brick's top row then. */
async function downOnFrame(page: Page, stage: number): Promise<number> {
  await toFrame(page);
  const before = (await brick(page, stage)).y;
  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await brick(page, stage)).y).toBe(before + 1);
  return before + 1;
}

/**
 * After a fresh Down, the brick holds its row for `ms - 10` and falls one row on the first frame at or after `ms`
 * (frames are 16 ms apart, so 1600 ms is a frame and 1000 ms falls on the frame at 1008).
 */
async function fallsAfter(page: Page, stage: number, ms: number) {
  const y = await downOnFrame(page, stage);
  await page.clock.runFor(ms - 10);
  expect((await brick(page, stage)).y, `still at row ${y} after ${ms - 10} ms`).toBe(y);
  await page.clock.runFor(Math.ceil(ms / 16) * 16 - (ms - 10));
  await expect.poll(async () => (await brick(page, stage)).y, { message: `one row down after ${ms} ms` }).toBe(y + 1);
}

/* ---------- decision 9: the fall speed by age band ---------- */

test.describe('decision 9: the fall speed by age band', () => {
  test('ages 3 to 4: on Stage 1 a started brick falls its next row after 1600 ms, not after 1590 ms @phone-only', async ({ page }) => {
    await openStage(page, 1, '3-4', { clock: true });
    await start(page);
    await fallsAfter(page, 1, 1600);
  });

  test('ages 5 to 6: on Stage 1 it falls after 1300 ms @phone-only', async ({ page }) => {
    await openStage(page, 1, '5-6', { clock: true });
    await start(page);
    await fallsAfter(page, 1, 1300);
  });

  test('ages 7 to 8: on Stage 1 it falls after 1000 ms, as before @phone-only', async ({ page }) => {
    await openStage(page, 1, '7-8', { clock: true });
    await start(page);
    await fallsAfter(page, 1, 1000);
  });

  test('a band changed in Settings mid-puzzle leaves this puzzle’s speed and changes the next one’s @phone-only', async ({ page }) => {
    await openStage(page, 1, '7-8', { clock: true });
    await start(page);
    await fallsAfter(page, 1, 1000);

    // A grown-up changes the band in another tab while the puzzle is being played.
    await editSavedInAnotherTab(page, (s) => {
      (s as unknown as { players: { ageBand: Band }[] }).players[0].ageBand = '3-4';
    });
    const keep = page.getByRole('button', { name: 'Keep playing' });
    if (await keep.isVisible()) await keep.click();
    await fallsAfter(page, 1, 1000);

    // Finish this puzzle: the next one falls at the new band's speed.
    const puzzle = (await savedRun(page, 'drop', 0)).queue[0];
    await playDropPuzzle(page, planDropPuzzle(0, puzzle));
    await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
    await page.getByRole('button', { name: 'Next puzzle' }).click();
    await expect(say(page)).toContainText('Press any button to start.');
    await fallsAfter(page, 1, 1600);
  });
});

/* ---------- decision 11: paused, any press resumes ---------- */

async function pausedChecks(page: Page) {
  await openStage(page, 1, '7-8', { clock: true });
  await start(page);
  await padButton(page, 'Down').tap();
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  const keep = page.getByRole('button', { name: 'Keep playing', exact: true });
  const line = say(page);
  await expect(line).toHaveAttribute('role', 'status');

  // Paused by the button: the line says how to carry on, as a help line message.
  await pause.click();
  await expect(line).toHaveText(PAUSED);
  await expect(line).toHaveClass(/is-message/);

  // A Left press only resumes: the brick stays in its column, and the clock runs again.
  const before = await brick(page, 1);
  await padButton(page, 'Left').tap();
  await expect(pause).toBeVisible();
  await expect(line).toHaveText('');
  expect((await brick(page, 1)).x).toBe(before.x);
  await page.clock.runFor(1100);
  await expect.poll(async () => (await brick(page, 1)).y).toBeGreaterThan(before.y);
  // The next Left moves it.
  await padButton(page, 'Left').tap();
  await expect.poll(async () => (await brick(page, 1)).x).toBe(before.x - 1);

  // Paused by a window blur: a board tap resumes, with no turn.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(line).toHaveText(PAUSED);
  const still = await brick(page, 1);
  await board(page).tap();
  await expect(pause).toBeVisible();
  await expect(line).toHaveText('');
  expect((await brick(page, 1)).cells).toBe(still.cells);

  // P pauses; an arrow key while paused resumes without moving the brick.
  await page.keyboard.press('p');
  await expect(line).toHaveText(PAUSED);
  const keyed = await brick(page, 1);
  await page.keyboard.press('ArrowRight');
  await expect(pause).toBeVisible();
  expect((await brick(page, 1)).cells).toBe(keyed.cells);

  // Keep playing still resumes.
  await pause.click();
  await expect(line).toHaveText(PAUSED);
  await keep.click();
  await expect(pause).toBeVisible();
  await expect(line).toHaveText('');
}

test('decision 11: while paused any pad press, board tap or game key resumes, and the line says so', async ({ page }) => {
  await pausedChecks(page);
});

test.describe('decision 11 on a short phone (375 x 667)', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

  test('the paused line resumes the same way and stays centred over the well, clear of the tiles @phone-only', async ({ page }) => {
    await pausedChecks(page);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const text = page.locator('.drop-say__line').first();
    await expect(text).toHaveText(PAUSED);
    const box = (await text.boundingBox())!;
    const well = (await board(page).boundingBox())!;
    const tiles = (await page.locator('.drop-tiles').boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - (well.x + well.width / 2))).toBeLessThanOrEqual(1);
    expect(box.x + box.width).toBeLessThanOrEqual(tiles.x);
  });
});

test.describe('decision 11 on an iPad in landscape (1194 x 834)', () => {
  test.use({ viewport: { width: 1194, height: 834 }, isMobile: true, hasTouch: true });

  test('any press resumes there too @phone-only', async ({ page }) => {
    await pausedChecks(page);
  });
});

/* ---------- decisions 17 and 20: the speakers ---------- */

async function zoomOf(page: Page): Promise<number> {
  return page.locator('.bw-screen__frame').first().evaluate((el) => Number(getComputedStyle(el).getPropertyValue('--bw-zoom')) || 1);
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

async function speakerChecks(page: Page, label: string) {
  const spoken = await recordSpeech(page);
  await openStage(page, 3, '7-8');
  const zoom = await zoomOf(page);
  const sheet = page.getByRole('dialog');
  // Layout is measured with the real font (Baloo 2), never a fallback.
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('800 16px "Baloo 2"'))).toBe(true);

  // The intro card: a speaker at the end of the title row, 54 pt.
  const goal = sheet.getByRole('button', { name: 'Hear the goal', exact: true });
  await expect(goal).toBeVisible();
  const gb = (await goal.boundingBox())!;
  const title = (await sheet.getByRole('heading').boundingBox())!;
  const card = (await sheet.boundingBox())!;
  expect(gb.width).toBeGreaterThanOrEqual(54 * zoom - 0.5);
  expect(gb.height).toBeGreaterThanOrEqual(54 * zoom - 0.5);
  expect(gb.x).toBeGreaterThanOrEqual(title.x + title.width - 0.5);
  expect(gb.x + gb.width).toBeLessThanOrEqual(card.x + card.width);
  expect(gb.y).toBeLessThan(title.y + title.height);
  expect(gb.y + gb.height).toBeGreaterThan(title.y);

  // Nothing is said before a tap; the tap reads the card's lines and its controls line, as the card shows them.
  expect(await spoken()).toEqual([]);
  const lines = await sheet.locator('p').allInnerTexts();
  expect(lines.at(-1)).toBe(TOUCH_LINE);
  await goal.tap();
  await expect.poll(spoken).toEqual([lines.join(' ')]);
  await sheet.getByRole('button', { name: 'Start' }).click();

  // The play screen: a third cell after Next and Rows, 54 pt, inside the tiles row.
  const help = page.getByRole('button', { name: 'Hear the help line', exact: true });
  await expect(help).toBeVisible();
  const hb = (await help.boundingBox())!;
  const tiles = (await page.locator('.drop-tiles').boundingBox())!;
  expect(hb.width).toBeGreaterThanOrEqual(54 * zoom - 0.5);
  expect(hb.height).toBeGreaterThanOrEqual(54 * zoom - 0.5);
  expect(hb.x).toBeGreaterThanOrEqual(tiles.x - 0.5);
  expect(hb.x + hb.width).toBeLessThanOrEqual(tiles.x + tiles.width + 0.5);
  expect(hb.y + hb.height).toBeLessThanOrEqual(tiles.y + tiles.height + 0.5);
  for (const name of ['Next', 'Rows']) {
    const tile = (await page.locator('.drop-tile').filter({ hasText: name }).boundingBox())!;
    expect(overlaps(hb, tile), `speaker over the ${name} tile`).toBe(false);
  }
  const rows = (await page.locator('.drop-tile').filter({ hasText: 'Rows' }).boundingBox())!;
  const short = rows.x === tiles.x;
  // in a row after Rows, or under it in the short phone's column beside the well
  if (short) expect(hb.y).toBeGreaterThanOrEqual(rows.y + rows.height);
  else expect(hb.x).toBeGreaterThanOrEqual(rows.x + rows.width);
  expect(overlaps(hb, (await board(page).boundingBox())!)).toBe(false);
  console.log(`[drop-r2] ${label}: speakers ${gb.width.toFixed(1)} and ${hb.width.toFixed(1)} px (zoom ${zoom}), tiles ${tiles.width.toFixed(1)} x ${tiles.height.toFixed(1)}`);

  // The waiting lines, read as they show.
  const waiting = (await page.locator('.drop-say__line').allInnerTexts()).join(' ');
  expect(waiting).toBe('Press any button to start. New brick: Corner.');
  await help.tap();
  await expect.poll(spoken).toEqual([lines.join(' '), waiting]);

  // Playing with no line on screen: the goal, then the controls line.
  await padButton(page, 'Down').tap();
  await expect(say(page)).toHaveText('');
  await help.tap();
  await expect.poll(async () => (await spoken()).at(-1)).toBe(`Clear 5 rows. ${TOUCH_LINE}`);

  // Paused: the paused line.
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await help.tap();
  await expect.poll(async () => (await spoken()).at(-1)).toBe(PAUSED);
  // The speaker is not a pad press: the game stays paused.
  await expect(say(page)).toHaveText(PAUSED);

  // Voice off (a grown-up, in another tab): no speaker, and the tiles row is two cells again.
  await editSavedInAnotherTab(page, (s) => {
    (s as unknown as { settings: { voice: boolean } }).settings.voice = false;
  });
  await expect(help).toHaveCount(0);
  const next = (await page.locator('.drop-tile').filter({ hasText: 'Next' }).boundingBox())!;
  const after = (await page.locator('.drop-tiles').boundingBox())!;
  if (!short) expect(next.width).toBeGreaterThan(after.width / 2 - 10 * zoom);
}

test('decisions 17 and 20: a speaker on the intro card and one beside Next and Rows read what is shown', async ({ page }, info) => {
  await speakerChecks(page, info.project.name);
});

test.describe('the speakers on a short phone (375 x 667)', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  test('the speaker sits under Rows in the 88 px tile column @phone-only', async ({ page }) => {
    await speakerChecks(page, '375x667');
  });

  test('the tile column stays 88 px wide with the speaker in it @phone-only', async ({ page }) => {
    await openStage(page, 9, '5-6');
    await expect(page.getByRole('button', { name: 'Hear the help line', exact: true })).toHaveCount(1);
    expect(Math.round((await page.locator('.drop-tiles').boundingBox())!.width)).toBe(88);
  });
});

test.describe('the speakers on an iPad in landscape (1194 x 834)', () => {
  test.use({ viewport: { width: 1194, height: 834 }, isMobile: true, hasTouch: true });
  test('the speakers there @phone-only', async ({ page }) => {
    await speakerChecks(page, '1194x834');
  });
});

test('with Voice off there is no speaker on the intro card or by the tiles', async ({ page }) => {
  await openStage(page, 3, '7-8');
  await expect(page.getByRole('button', { name: 'Hear the goal' })).toBeVisible();
  await editSavedInAnotherTab(page, (s) => {
    (s as unknown as { settings: { voice: boolean } }).settings.voice = false;
  });
  await expect(page.getByRole('button', { name: 'Hear the goal' })).toHaveCount(0);
  await start(page);
  await expect(page.getByRole('button', { name: 'Hear the help line' })).toHaveCount(0);
  const tiles = page.locator('.drop-tiles > *');
  await expect(tiles).toHaveCount(2);
});

/* ---------- decision 19: the chapter sticker is given when the stage finishes ---------- */

test('decision 19: finishing Stage 3, the last of chapter 1, gives Tiny tower once @phone-only', async ({ page }) => {
  await openStage(page, 3, '7-8', { clock: true });
  await start(page);
  for (let n = 1; n <= 4; n++) {
    if (n > 1) {
      await page.getByRole('button', { name: 'Next puzzle' }).click();
      await expect(say(page)).toContainText('Press any button to start.');
    }
    const puzzle = (await savedRun(page, 'drop', 2)).queue[0];
    await playDropPuzzle(page, planDropPuzzle(2, puzzle));
  }
  await expect(dots(page)).toHaveAttribute('aria-label', '4 of 4 solved.');
  await page.clock.runFor(700);
  await expect(levelCard(page).getByRole('heading')).toHaveText('You finished Stage 3');
  const saved = await savedState(page);
  expect(Object.keys((saved.players[0] as unknown as { stickers: Record<string, unknown> }).stickers)).toEqual(['d1']);
});

/* ---------- decision 38: 150 ms fades under Reduce Motion ---------- */

async function fade(el: Locator) {
  return el.evaluate((node) => {
    const s = getComputedStyle(node);
    return { name: s.animationName, duration: s.animationDuration, transform: s.transform };
  });
}

test('decision 38: under Reduce Motion the scrim, the help line and the row flash fade over 150 ms, and nothing moves @phone-only', async ({ page }) => {
  await openStage(page, 1, '7-8', { clock: true });
  expect(await fade(page.locator('.drop-scrim'))).toEqual({ name: 'drop-fade', duration: '0.15s', transform: 'none' });
  await start(page);
  expect(await fade(say(page))).toEqual({ name: 'drop-fade', duration: '0.15s', transform: 'none' });

  // Play the planned bricks until a row clears, and read the flash before the clock moves on.
  const puzzle = (await savedRun(page, 'drop', 0)).queue[0];
  const plan = planDropPuzzle(0, puzzle);
  let seen = false;
  for (const { turns, shift } of plan.placements) {
    for (let i = 0; i < turns; i++) await page.keyboard.press('ArrowUp');
    for (let i = 0; i < Math.abs(shift); i++) await page.keyboard.press(shift < 0 ? 'ArrowLeft' : 'ArrowRight');
    await page.keyboard.press(' ');
    const flash = page.locator('.drop-flash').first();
    if (await flash.count()) {
      expect(await fade(flash)).toEqual({ name: 'drop-fade', duration: '0.15s', transform: 'none' });
      seen = true;
      break;
    }
    await page.clock.runFor(400);
  }
  expect(seen, 'a row cleared').toBe(true);
});

/* ---------- independent review: keys, VoiceOver and Switch Control ---------- */

const helpSpeaker = (page: Page): Locator => page.getByRole('button', { name: 'Hear the help line', exact: true });
const focusName = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName);
const settledBricks = (page: Page) => page.locator('.drop-grid .drop-cell:not(.is-active)').count();

test.describe('the speaker from the keyboard', () => {
  test('Space on the focused speaker reads the line, and the waiting brick keeps waiting @phone-only', async ({ page }) => {
    const spoken = await recordSpeech(page);
    await openStage(page, 3, '7-8', { clock: true });
    await start(page);
    const waiting = (await say(page).textContent())!;
    const before = await brick(page, 3);
    const settled = await settledBricks(page);

    await helpSpeaker(page).focus();
    await page.keyboard.press(' ');
    await expect.poll(spoken).toEqual(['Press any button to start. New brick: Corner.']);
    await page.clock.runFor(2000);
    await expect(say(page)).toHaveText(waiting);
    expect(await brick(page, 3)).toEqual(before);
    expect(await settledBricks(page)).toBe(settled);
    expect(await focusName(page)).toBe('Hear the help line');
  });

  test('while playing, Space and Enter on it read the line and never drop the brick; arrow keys still play @phone-only', async ({ page }) => {
    const spoken = await recordSpeech(page);
    await openStage(page, 3, '7-8', { clock: true });
    await start(page);
    await page.keyboard.press('ArrowDown');
    const before = await brick(page, 3);
    const settled = await settledBricks(page);

    await helpSpeaker(page).focus();
    await page.keyboard.press(' ');
    await expect.poll(async () => (await spoken()).length).toBe(1);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await spoken()).length).toBe(2);
    expect(await settledBricks(page)).toBe(settled);
    expect((await brick(page, 3)).y).toBe(before.y);

    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await brick(page, 3)).x).toBe(before.x - 1);
  });

  test('while paused, Space on it reads the paused line and the game stays paused @phone-only', async ({ page }) => {
    const spoken = await recordSpeech(page);
    await openStage(page, 3, '7-8', { clock: true });
    await start(page);
    await page.keyboard.press('ArrowDown');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await helpSpeaker(page).focus();
    await page.keyboard.press(' ');
    await expect.poll(spoken).toEqual([PAUSED]);
    await expect(say(page)).toHaveText(PAUSED);
    await expect(page.getByRole('button', { name: 'Keep playing', exact: true })).toBeVisible();
  });

  test('a mouse press on it hands the keys back to the board, so Space drops the brick at once @phone-only', async ({ page }) => {
    const spoken = await recordSpeech(page);
    await openStage(page, 3, '7-8', { clock: true });
    await start(page);
    await page.keyboard.press('ArrowDown');
    const settled = await settledBricks(page);

    await helpSpeaker(page).click();
    await expect.poll(async () => (await spoken()).length).toBe(1);
    await page.keyboard.press(' ');
    await expect.poll(() => settledBricks(page)).toBeGreaterThan(settled);
    expect((await spoken()).length).toBe(1);
  });

  test('a mouse press after a solve does not pull the focus onto the finished board @phone-only', async ({ page }) => {
    await recordSpeech(page);
    await openStage(page, 1, '7-8', { clock: true });
    await start(page);
    const puzzle = (await savedRun(page, 'drop', 0)).queue[0];
    await playDropPuzzle(page, planDropPuzzle(0, puzzle));
    await expect(page.getByRole('button', { name: 'Next puzzle' })).toBeFocused();
    await helpSpeaker(page).click();
    await expect(board(page)).not.toBeFocused();
  });
});

test.describe('a pad press from VoiceOver or Switch Control (a click with no pointer)', () => {
  const assistivePress = (page: Page, name: 'Left' | 'Right') => padButton(page, name).evaluate((b: HTMLElement) => b.click());

  test('while paused it only carries on, and the next one moves the brick by one column @phone-only', async ({ page }) => {
    await openStage(page, 1, '7-8', { clock: true });
    await start(page);
    await page.keyboard.press('ArrowDown');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(say(page)).toHaveText(PAUSED);
    const before = await brick(page, 1);

    await assistivePress(page, 'Left');
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect(say(page)).toHaveText('');
    expect((await brick(page, 1)).x).toBe(before.x);

    await assistivePress(page, 'Left');
    await expect.poll(async () => (await brick(page, 1)).x).toBe(before.x - 1);
  });

  test('a finger, a mouse and the Enter key each still move the brick by exactly one column', async ({ page }) => {
    await openStage(page, 1, '7-8', { clock: true });
    await start(page);
    await page.keyboard.press('ArrowDown');
    const from = (await brick(page, 1)).x;

    await padButton(page, 'Left').tap();
    await expect.poll(async () => (await brick(page, 1)).x).toBe(from - 1);
    await padButton(page, 'Right').click();
    await expect.poll(async () => (await brick(page, 1)).x).toBe(from);

    // Holding Enter is one press: the key's repeats do nothing.
    await padButton(page, 'Left').focus();
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expect.poll(async () => (await brick(page, 1)).x).toBe(from - 1);
    await page.clock.runFor(16);
    expect((await brick(page, 1)).x).toBe(from - 1);
  });
});

/* ---------- independent review: every band, and the puzzle boundaries of decision 9 ---------- */

test('decision 9: ages 9 to 10 fall at the stage’s own speed @phone-only', async ({ page }) => {
  await openStage(page, 1, '9-10', { clock: true });
  await start(page);
  await fallsAfter(page, 1, 1000);
});

/** Stack bricks in the middle until the Out of room sheet is up. */
async function fillToTheTop(page: Page) {
  const sheet = page.getByRole('dialog');
  for (let n = 0; n < 80 && !(await sheet.isVisible()); n++) {
    await page.keyboard.press(' ');
    await page.clock.runFor(800);
  }
  await expect(sheet.getByRole('heading')).toHaveText('Out of room');
}

test('decision 9: Try again keeps the puzzle’s speed after a band change, and New puzzle takes the new band @phone-only', async ({ page }) => {
  await openStage(page, 1, '7-8', { clock: true });
  await start(page);
  await page.keyboard.press('ArrowDown');
  await editSavedInAnotherTab(page, (s) => {
    (s as unknown as { players: { ageBand: Band }[] }).players[0].ageBand = '3-4';
  });
  const keep = page.getByRole('button', { name: 'Keep playing' });
  if (await keep.isVisible()) await keep.click();

  // The band of the puzzle holds through every retry of that puzzle.
  await fillToTheTop(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Try again' }).click();
  await expect(say(page)).toContainText('Press any button to start.');
  await fallsAfter(page, 1, 1000);

  // Enough failed tries bring the offer: a new puzzle is the next puzzle, so it falls at the new band's speed.
  const offer = page.getByRole('dialog').getByRole('button', { name: 'New puzzle' });
  for (let n = 0; n < 12; n++) {
    await fillToTheTop(page);
    if (await offer.isVisible()) break;
    await page.getByRole('dialog').getByRole('button', { name: 'Try again' }).click();
    await expect(say(page)).toContainText('Press any button to start.');
  }
  await offer.click();
  await expect(say(page)).toContainText('Press any button to start.');
  await fallsAfter(page, 1, 1600);
});

test('decision 9: Play Stage 2 from the level card falls at the child’s speed, also when that stage’s saved run moves to a new set @phone-only', async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'kai', name: 'Kai', ageBand: '3-4' }]);
  // Stage 2 was left on an older puzzle set, so the screen swaps its first puzzle as it opens.
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('old-run')) return;
    sessionStorage.setItem('old-run', '1');
    const state = JSON.parse(localStorage.getItem(key)!);
    state.players[0].games.drop = { unlocked: 1, stars: {}, best: {}, runs: { 1: { set: 'drop-old', seed: 0, queue: [2, 3, 0, 1, 4, 5], solved: [], updatedAt: 1 } } };
    localStorage.setItem(key, JSON.stringify(state));
  }, STORAGE_KEY);
  await page.goto('/#/game/drop/1');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
  await start(page);
  for (let n = 1; n <= 4; n++) {
    if (n > 1) {
      await page.getByRole('button', { name: 'Next puzzle' }).click();
      await expect(say(page)).toContainText('Press any button to start.');
    }
    await playDropPuzzle(page, planDropPuzzle(0, (await savedRun(page, 'drop', 0)).queue[0]));
  }
  await expect(dots(page)).toHaveAttribute('aria-label', '4 of 4 solved.');
  await page.clock.runFor(700);
  await levelCard(page).getByRole('button', { name: 'Play Stage 2' }).click();

  await expect(page.getByRole('heading', { name: 'Stage 2' })).toBeVisible();
  await expect(say(page)).toContainText('Press any button to start.');
  expect((await savedRun(page, 'drop', 1)).queue[0]).toBe(0);
  // Stage 2 falls a row every 950 ms: 1520 ms at ages 3 to 4.
  await fallsAfter(page, 2, 1520);
});

test('decision 11: a board tap while paused never turns the brick, and the next tap does', async ({ page }) => {
  await openStage(page, 3, '7-8', { clock: true });
  await start(page);
  await padButton(page, 'Down').tap();
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  await pause.click();
  await expect(say(page)).toHaveText(PAUSED);
  const still = await brick(page, 3);

  await board(page).tap();
  await expect(pause).toBeVisible();
  await page.clock.runFor(16);
  expect((await brick(page, 3)).cells).toBe(still.cells);

  await board(page).tap();
  await expect.poll(async () => (await brick(page, 3)).cells).not.toBe(still.cells);
});

/* ---------- independent review: the intro card's title row ---------- */

for (const [stage, name] of [[4, 'Squares and Sticks'], [6, 'Hooks and Boots'], [12, 'Master Builder']] as const) {
  test(`the long name "${name}" stays centred on the intro card, in two lines at most, with both speakers exactly 54 pt`, async ({ page }) => {
    await openStage(page, stage, '7-8');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('800 16px "Baloo 2"'))).toBe(true);
    const zoom = await zoomOf(page);
    const sheet = page.getByRole('dialog');
    const heading = sheet.getByRole('heading');
    await expect(heading).toHaveText(name);

    const title = (await heading.boundingBox())!;
    const card = (await sheet.boundingBox())!;
    expect(Math.abs(title.x + title.width / 2 - (card.x + card.width / 2))).toBeLessThanOrEqual(1);
    const line = await heading.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect(title.height).toBeLessThanOrEqual(2 * line * zoom + 1);
    expect(await heading.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

    const goal = (await sheet.getByRole('button', { name: 'Hear the goal', exact: true }).boundingBox())!;
    expect(Math.abs(goal.width - 54 * zoom)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(goal.height - 54 * zoom)).toBeLessThanOrEqual(0.5);
    await start(page);
    const help = (await helpSpeaker(page).boundingBox())!;
    expect(Math.abs(help.width - 54 * zoom)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(help.height - 54 * zoom)).toBeLessThanOrEqual(0.5);
  });
}
