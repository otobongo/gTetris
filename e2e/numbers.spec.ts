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
  recordSpeech,
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

/* ---------- A slip shows on screen (usability batch J) ---------- */

/** The line a swap that moved the row further from the goal shows (copy.ts SLIP_LINE). */
const SLIP = 'That swap moved them further from the goal.';

/** Pairs of towers standing the wrong way round for the order: a slip raises this count. */
function inversionsOf(row: readonly number[], up: boolean): number {
  let count = 0;
  for (let i = 0; i < row.length; i++) for (let j = i + 1; j < row.length; j++) if (up ? row[i] > row[j] : row[i] < row[j]) count++;
  return count;
}

/** Two spots whose swap raises the inversion count of the row on screen, worked out here from the towers' names. */
async function slipPair(page: Page): Promise<[number, number]> {
  const row = await numbersRow(page);
  const up = /smallest first/.test((await page.locator('.num-goal__text').textContent()) ?? '');
  const now = inversionsOf(row, up);
  for (let a = 0; a < row.length; a++)
    for (let b = a + 1; b < row.length; b++) {
      const after = [...row];
      [after[a], after[b]] = [after[b], after[a]];
      if (inversionsOf(after, up) > now) return [a, b];
    }
  throw new Error(`No swap makes this row worse: ${row.join(',')}`);
}

const ringed = (page: Page) => page.locator('.num-tower.is-wrong');

test('a swap that makes the row worse says so and rings the two towers, with Sound off', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/numbers');
  await expect(page).toHaveURL(/#\/game\/numbers\/1$/);
  // Sound is off in the seed: sfx.wrong says nothing, so the screen has to.
  const saved = (await savedState(page)) as unknown as { settings: { sound: boolean } };
  expect(saved.settings.sound).toBe(false);

  const [a, b] = await slipPair(page);
  await numbersTower(page, a).click();
  await numbersTower(page, b).click();
  const swapped = Date.now();

  // Within 200 ms: the line, in the wrong style, and a ring on both swapped towers (and no others).
  await expect(help(page)).toHaveText(SLIP, { timeout: 200 });
  await expect(help(page)).toHaveClass(/\bis-wrong\b/, { timeout: 200 });
  await expect(numbersTower(page, a)).toHaveClass(/\bis-wrong\b/, { timeout: 200 });
  await expect(numbersTower(page, b)).toHaveClass(/\bis-wrong\b/, { timeout: 200 });
  await expect(ringed(page)).toHaveCount(2);
  // The ring is drawn in the error colour round the tower's stack. Reduced motion is on: the ring stays, nothing shakes.
  const ring = await numbersTower(page, a).locator('.num-stack').evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ring).toContain('rgb(255, 77, 94)');
  expect(await numbersTower(page, a).evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

  // After 900 ms the rings are gone and the line stays.
  await page.waitForTimeout(Math.max(0, 900 - (Date.now() - swapped)));
  await expect(ringed(page)).toHaveCount(0, { timeout: 100 });
  await expect(help(page)).toHaveText(SLIP);
  await expect(help(page)).toHaveClass(/\bis-wrong\b/);

  // The next pick puts the normal line back, out of the wrong style; putting the tower down shows the start line.
  await numbersTower(page, 0).click();
  await expect(help(page)).toHaveText('Now tap where it should go.');
  await expect(help(page)).not.toHaveClass(/\bis-wrong\b/);
  await numbersTower(page, 0).click();
  await expect(help(page)).toHaveText('Drag or tap two towers to swap them.');
  await expect(help(page)).not.toHaveClass(/\bis-wrong\b/);
});

test('a swap that makes the row better shows no slip line and rings nothing', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/numbers');
  await expect(page).toHaveURL(/#\/game\/numbers\/1$/);

  const step = (await numbersNextSwap(page))!;
  await swapTowers(page, step[0], step[1]);
  await page.waitForTimeout(200);
  await expect(help(page)).not.toHaveText(SLIP);
  await expect(help(page)).not.toHaveClass(/\bis-wrong\b/);
  await expect(ringed(page)).toHaveCount(0);

  // A slip, then a good swap: the good swap takes the slip line and the rings away.
  const [a, b] = await slipPair(page);
  await swapTowers(page, a, b);
  await expect(help(page)).toHaveText(SLIP);
  const next = (await numbersNextSwap(page))!;
  await swapTowers(page, next[0], next[1]);
  await expect(help(page)).not.toHaveText(SLIP);
  await expect(help(page)).not.toHaveClass(/\bis-wrong\b/);
  await expect(ringed(page)).toHaveCount(0);
});

test('a hint takes the slip line away, and with motion on the ringed towers do not shake', { tag: '@phone-only' }, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/numbers');
  await expect(page).toHaveURL(/#\/game\/numbers\/1$/);

  const [a, b] = await slipPair(page);
  await swapTowers(page, a, b);
  await expect(help(page)).toHaveText(SLIP);
  await expect(ringed(page)).toHaveCount(2);
  for (const spot of [a, b]) {
    expect(await numbersTower(page, spot).evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    expect(await numbersTower(page, spot).locator('.num-stack').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  }

  await hint(page).click();
  await expect(help(page)).toHaveText(/ belongs in the .* spot\. Swap them\.$/);
  await expect(help(page)).not.toHaveClass(/\bis-wrong\b/);
  await expect(ringed(page)).toHaveCount(0);
});

/* ---------- A slip shows on screen: the review's extra cases (usability batch J) ---------- */

/** The tower row after swapping spots a and b, worked out here. */
const swapped = (row: readonly number[], a: number, b: number): number[] => {
  const out = [...row];
  [out[a], out[b]] = [out[b], out[a]];
  return out;
};

/** The first pair of spots whose swap raises the inversion count of `row` (a slip), for a row the test already knows. */
function slipPairOf(row: readonly number[], up: boolean): [number, number] {
  const now = inversionsOf(row, up);
  for (let a = 0; a < row.length; a++) for (let b = a + 1; b < row.length; b++) if (inversionsOf(swapped(row, a, b), up) > now) return [a, b];
  throw new Error(`No swap makes this row worse: ${row.join(',')}`);
}

/**
 * Record, in the page, every frame's ringed spots and the time of every tap on a tower, so the ring's timing is read
 * from the page's own clock rather than from how fast the test runner gets round to looking.
 */
async function watchRings(page: Page): Promise<() => Promise<{ frames: [number, string][]; taps: number[] }>> {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: [number, string][]; __taps: number[] };
    w.__frames = [];
    w.__taps = [];
    document.addEventListener('click', (e) => (e.target as Element).closest('.num-tower') && w.__taps.push(performance.now()), true);
    const tick = () => {
      const spots = [...document.querySelectorAll('.num-tower')].flatMap((el, i) => (el.classList.contains('is-wrong') ? [i] : []));
      w.__frames.push([performance.now(), spots.join(',')]);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return () =>
    page.evaluate(() => {
      const w = window as unknown as { __frames: [number, string][]; __taps: number[] };
      return { frames: w.__frames.slice(), taps: w.__taps.slice() };
    });
}

/** From `from` on (page clock), when the ring on `spots` first showed and when it last showed before it went. */
function ringSpan(frames: [number, string][], from: number, spots: readonly number[]): { first: number; last: number } {
  const want = [...spots].sort((x, y) => x - y).join(',');
  const after = frames.filter(([t]) => t >= from);
  const start = after.findIndex(([, s]) => s === want);
  if (start < 0) throw new Error(`No ring on ${want} after ${from}`);
  let end = start;
  while (end + 1 < after.length && after[end + 1][1] === want) end++;
  return { first: after[start][0] - from, last: after[end][0] - from };
}

test('a tower dragged onto one it should not swap with is a slip too, a new drag takes the line away, and the slip counts once', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/numbers');
  await expect(page).toHaveURL(/#\/game\/numbers\/1$/);

  // The drag lands on the wrong tower (the finger let go over the neighbour of the one meant): a slip.
  const before = await numbersRow(page);
  const [a, b] = await slipPair(page);
  await pointerDrag(page, numbersTower(page, a), numbersTower(page, b));
  await expect.poll(() => numbersRow(page)).toEqual(swapped(before, a, b));
  await expect(help(page)).toHaveText(SLIP);
  await expect(help(page)).toHaveClass(/\bis-wrong\b/);
  await expect(numbersTower(page, a)).toHaveClass(/\bis-wrong\b/);
  await expect(numbersTower(page, b)).toHaveClass(/\bis-wrong\b/);
  await expect(ringed(page)).toHaveCount(2);

  // Lifting a tower again, by dragging it, puts the normal line back; let go over empty space, nothing swaps.
  const now = await numbersRow(page);
  const box = await page.locator('.num-goal').boundingBox();
  await pointerDrag(page, numbersTower(page, 0), { x: box!.x + 6, y: box!.y + box!.height / 2 });
  await expect.poll(() => numbersRow(page)).toEqual(now);
  await expect(help(page)).toHaveText('Drag or tap two towers to swap them.');
  await expect(help(page)).not.toHaveClass(/\bis-wrong\b/);
  await expect(ringed(page)).toHaveCount(0);

  // The slip counts once toward the stars, as before the fix; the missed drag counts nothing.
  await solveNumbersPuzzle(page);
  expect((await savedRun(page, 'numbers', 0)).solved).toEqual([{ puzzle: 0, count: 1, usedHint: false, outOfTime: false }]);
});

/** One level per age band, so a slip is shown in both orders and with the bands' bigger numbers (up to 999 at ages 9 to 10). */
const BAND_LEVELS = [
  { band: '3-4', level: 5, goal: 'Line up 6 to 1, biggest first, so the stairs go down.' },
  { band: '5-6', level: 9, goal: 'Line up the numbers, smallest first.' },
  { band: '7-8', level: 12, goal: 'Line up the numbers, biggest first.' },
  { band: '9-10', level: 10, goal: 'Line up the numbers, biggest first.' },
] as const;

for (const { band, level, goal } of BAND_LEVELS) {
  test(`at ages ${band} on Level ${level} a slip shows the line and the two rings, and a good swap takes them away`, async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: band, games: { numbers: { stars: starsUpTo(level - 1) } } }]);
    await page.goto(`/#/game/numbers/${level}`);
    await expect(page).toHaveURL(new RegExp(`#/game/numbers/${level}$`));
    await expect(page.locator('.num-goal__text')).toHaveText(goal);
    const before = await numbersRow(page);
    if (band === '9-10') expect(Math.max(...before)).toBeGreaterThan(20);

    const [a, b] = await slipPair(page);
    await swapTowers(page, a, b);
    await expect(help(page)).toHaveText(SLIP);
    await expect(help(page)).toHaveClass(/\bis-wrong\b/);
    await expect(ringed(page)).toHaveCount(2);
    await expect(numbersTower(page, a)).toHaveClass(/\bis-wrong\b/);
    await expect(numbersTower(page, b)).toHaveClass(/\bis-wrong\b/);
    // The towers keep their names (numbersRow reads every one); the ring is drawn, not spoken.
    expect(await numbersRow(page)).toEqual(swapped(before, a, b));

    const step = (await numbersNextSwap(page))!;
    await swapTowers(page, step[0], step[1]);
    await expect(help(page)).not.toHaveText(SLIP);
    await expect(help(page)).not.toHaveClass(/\bis-wrong\b/);
    await expect(ringed(page)).toHaveCount(0);
  });
}

test('the ring stays 660 ms from the swap, a pick takes it away, and a second slip rings only its own two towers for its own 660 ms', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/numbers');
  await expect(page).toHaveURL(/#\/game\/numbers\/1$/);
  const read = await watchRings(page);

  // A slip on its own: the ring shows at once and goes after about 660 ms, with nothing done in between.
  const row = await numbersRow(page);
  const [a, b] = await slipPair(page);
  await swapTowers(page, a, b);
  await page.waitForTimeout(1000);
  let log = await read();
  const one = ringSpan(log.frames, log.taps[1], [a, b]);
  expect(one.first).toBeLessThan(200);
  expect(one.last).toBeGreaterThanOrEqual(600);
  expect(one.last).toBeLessThan(850);
  expect(log.frames.filter(([t, s]) => t > log.taps[1] + 900 && s !== '')).toEqual([]);
  await expect(help(page)).toHaveText(SLIP);

  // Two slips 100 ms apart: the pick takes the first ring away at once, and the second pair keeps its ring 660 ms from its own swap.
  const second = swapped(row, a, b);
  const [c, d] = slipPairOf(second, true);
  const [e, f] = slipPairOf(swapped(second, c, d), true);
  await swapTowers(page, c, d);
  await page.waitForTimeout(100);
  await swapTowers(page, e, f);
  await page.waitForTimeout(1000);
  log = await read();
  const [pickE, slipF] = [log.taps[4], log.taps[5]];
  expect(slipF - log.taps[3]).toBeLessThan(660);
  // The first of the two rang until the pick, not until its timer.
  const mid = ringSpan(log.frames, log.taps[3], [c, d]);
  expect(mid.first).toBeLessThan(200);
  expect(mid.last).toBeLessThan(pickE - log.taps[3] + 50);
  // Between the pick and the second swap no tower is ringed.
  expect(log.frames.filter(([t, s]) => t > pickE + 50 && t < slipF && s !== '')).toEqual([]);
  const two = ringSpan(log.frames, slipF, [e, f]);
  expect(two.first).toBeLessThan(200);
  expect(two.last).toBeGreaterThanOrEqual(600);
  expect(two.last).toBeLessThan(850);
  await expect(help(page)).toHaveText(SLIP);
});

test('a slip made from the keyboard is announced in the status line, and the speaker reads it after the goal', { tag: '@phone-only' }, async ({ page }) => {
  const spoken = await recordSpeech(page);
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/numbers');
  await expect(page).toHaveURL(/#\/game\/numbers\/1$/);
  const goal = (await page.locator('.num-goal__text').textContent())!;

  const [a, b] = await slipPair(page);
  await numbersTower(page, a).focus();
  await page.keyboard.press('Enter');
  await expect(numbersTower(page, a)).toHaveAttribute('aria-pressed', 'true');
  await numbersTower(page, b).focus();
  await page.keyboard.press('Space');
  await expect(help(page)).toHaveAttribute('role', 'status');
  await expect(help(page)).toHaveText(SLIP);
  await expect(help(page)).toHaveClass(/\bis-wrong\b/);
  await expect(ringed(page)).toHaveCount(2);

  await page.getByRole('button', { name: 'Hear the help line' }).click();
  await expect.poll(async () => (await spoken()).at(-1)).toBe(`${goal} ${SLIP}`);
});

test('at ages 3 to 4 the third slip brings the offer: its line is not in the wrong style, and the two towers still ring', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '3-4' }]);
  await page.goto('/#/game/numbers');
  await expect(page).toHaveURL(/#\/game\/numbers\/1$/);

  for (let n = 1; n <= 2; n++) {
    const [a, b] = await slipPair(page);
    await swapTowers(page, a, b);
    await expect(help(page)).toHaveText(SLIP);
    await expect(help(page)).toHaveClass(/\bis-wrong\b/);
  }
  // The stuck limit at ages 3 to 4 is 3 slips (run.ts STUCK): the kit's offer line takes the help row.
  const [a, b] = await slipPair(page);
  await swapTowers(page, a, b);
  await expect(help(page)).toHaveText('This one is tricky. Want a different puzzle?');
  await expect(help(page)).not.toHaveClass(/\bis-wrong\b/);
  await expect(numbersTower(page, a)).toHaveClass(/\bis-wrong\b/);
  await expect(numbersTower(page, b)).toHaveClass(/\bis-wrong\b/);

  // A different puzzle starts clean: no slip line, no rings.
  await page.getByRole('button', { name: 'New puzzle' }).click();
  await expect(help(page)).toHaveText('Here is a different puzzle.');
  await expect(help(page)).not.toHaveClass(/\bis-wrong\b/);
  await expect(ringed(page)).toHaveCount(0);
});

/** The four screens the finding names: both phones and the iPad both ways (834 x 1194 draws the frame at zoom 1.4). */
const SLIP_SIZES = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 834, height: 1194 },
  { width: 1194, height: 834 },
] as const;

test('the slip line keeps to two lines and moves nothing on both phones and the iPad both ways', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  for (const size of SLIP_SIZES) {
    await page.setViewportSize(size);
    await page.goto('/#/game/numbers/1');
    await page.reload();
    await expect(help(page)).toHaveText('Drag or tap two towers to swap them.');
    const place = () =>
      page.evaluate(() => {
        const line = document.querySelector('.bw-helprow__line')!;
        const zoom = Number(getComputedStyle(document.querySelector('.bw-play')!).zoom) || 1;
        return {
          row: document.querySelector('.bw-helprow')!.getBoundingClientRect().height,
          well: document.querySelector('.num-well')!.getBoundingClientRect().top,
          lines: Math.round(line.getBoundingClientRect().height / (parseFloat(getComputedStyle(line).lineHeight) * zoom)),
          wide: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
    const start = await place();
    const [a, b] = await slipPair(page);
    await swapTowers(page, a, b);
    await expect(help(page)).toHaveText(SLIP);
    await expect(ringed(page)).toHaveCount(2);
    const slip = await place();
    expect(slip.lines, `${size.width} x ${size.height}`).toBeLessThanOrEqual(2);
    expect(slip.row, `${size.width} x ${size.height}`).toBe(start.row);
    expect(slip.well, `${size.width} x ${size.height}`).toBe(start.well);
    expect(slip.wide, `${size.width} x ${size.height}`).toBe(false);
  }
});
