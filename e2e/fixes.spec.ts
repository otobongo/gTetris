/**
 * Journeys for the user's decisions of 5 November 2026 and the review fixes that came with them:
 * - D1: a Restart (Brick Escape) or Try again (Brick Drop) only puts the bricks back, so a hint used on the
 *   puzzle and a counted clock that ran out still cap the level.
 * - F1 (brief 2.3): the puzzle on screen keeps the age band it started with; a new band applies from the next puzzle.
 * - F2 (brief 2.4): the daily limit is checked on a swap, a Restart and Try again too, not only on Next and Play.
 * - D2: Settings has an Age row per child.
 * - D6: the finished state shows the game's total stars, not the last level's.
 * - F9: after a solve, Brick Escape's clock panel stays on screen, stopped where it was (EscapeSolved board).
 */
import { expect, test, type Page } from '@playwright/test';
import {
  dots,
  editSavedInAnotherTab,
  escapePuzzleOnScreen,
  homeCard,
  levelCard,
  lettersWord,
  openSettings,
  passGrownUpCheck,
  planDropPuzzle,
  playDropPuzzle,
  savedGame,
  savedRun,
  savedState,
  seed,
  solveEscapeBoard,
  solveLettersPuzzle,
  starsUpTo,
} from './app';

/** Stop the clock flowing by itself, so the test moves time on exactly. */
async function pauseClock(page: Page) {
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
}

const escClock = (page: Page) => page.locator('.esc-status__clock');
const escCaption = (page: Page) => page.locator('.esc-status__caption');

/* ---------- D1: Restart and Try again keep the caps ---------- */

test('Brick Escape: a hint used before a Restart still counts for the puzzle', async ({ page }) => {
  // Ages 7 to 8: three failed tries before the offer, so one Restart changes nothing else.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  const puzzle = await escapePuzzleOnScreen(page, 0);

  await page.getByRole('button', { name: 'Hint' }).click();
  await expect(page.locator('.esc-brick.is-hinted')).toHaveCount(1);
  await page.getByRole('button', { name: 'Restart puzzle' }).click();
  // The glow goes with the bricks; the hint stays used.
  await expect(page.locator('.esc-brick.is-hinted')).toHaveCount(0);
  await expect(page.locator('.esc-status__moves')).toHaveText('Moves 0');

  await solveEscapeBoard(page, 0, puzzle);
  const run = await savedRun(page, 'escape', 0);
  expect(run.solved).toHaveLength(1);
  expect(run.solved[0].usedHint).toBe(true);
});

test('Brick Escape: a Restart does not wind a run-out clock back, so the cap stays', async ({ page }) => {
  await page.clock.install();
  // Ages 7 to 8 on Level 1: 30 s x 1.5 = 0:45 per puzzle.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  const puzzle = await escapePuzzleOnScreen(page, 0);
  await expect(escClock(page)).toContainText('0:45');
  await pauseClock(page);

  await page.clock.runFor(50_000);
  await expect(escClock(page)).toContainText('0:00');
  await page.getByRole('button', { name: 'Restart puzzle' }).click();
  // Only the bricks go back: the clock stays out.
  await expect(page.locator('.esc-status__moves')).toHaveText('Moves 0');
  await expect(escClock(page)).toContainText('0:00');
  await expect(page.locator('.esc-help')).toHaveText('Time’s up! Keep going, you can still finish.');

  await page.clock.resume();
  await solveEscapeBoard(page, 0, puzzle);
  const run = await savedRun(page, 'escape', 0);
  expect(run.solved[0].outOfTime).toBe(true);
});

test('Brick Drop: Try again carries the clock on, so a run-out clock still caps the stage', async ({ page }) => {
  await page.clock.install();
  // Ages 7 to 8 on Stage 1: 3 rows x 15 s x 1.5 = 1:08 per puzzle.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/drop');
  await expect(page).toHaveURL(/#\/game\/drop\/1$/);
  await pauseClock(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();
  const timer = page.locator('.drop-timer__clock');
  await expect(timer).toHaveText('1:08');

  // The first press starts the clock; 70 s later it has run out while the bricks fall on their own.
  await page.keyboard.press('ArrowLeft');
  await page.clock.runFor(70_000);
  await expect(timer).toHaveText('0:00');
  const over = page.getByRole('dialog', { name: 'Out of room' });
  for (let i = 0; i < 80 && !(await over.isVisible()); i++) {
    await page.keyboard.press(' ');
    await page.clock.runFor(400);
  }
  await expect(over).toBeVisible();
  await over.getByRole('button', { name: 'Try again' }).click();

  // The same puzzle from its first stack, with the clock where it was.
  await expect(page.locator('.drop-say')).toContainText('Press any button to start.');
  await expect(page.locator('.drop-timer__clock')).toHaveText('0:00');
  const puzzle = (await savedRun(page, 'drop', 0)).queue[0];
  await playDropPuzzle(page, planDropPuzzle(0, puzzle));
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  const run = await savedRun(page, 'drop', 0);
  expect(run.solved[0].outOfTime).toBe(true);
});

/* ---------- F1: the puzzle on screen keeps its age band ---------- */

test('Brick Escape: a band changed from another tab waits for the next puzzle', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  const puzzle = await escapePuzzleOnScreen(page, 0);
  await expect(escCaption(page)).toHaveText('Maya: each puzzle gets 30s x 1.5 = 0:45');

  await editSavedInAnotherTab(page, (state) => {
    state.players[0].ageBand = '9-10';
  });
  // The store has read the new band (Settings would show it), but this puzzle keeps its clock.
  await expect.poll(async () => (await savedState(page)).players[0].ageBand).toBe('9-10');
  await page.waitForTimeout(300);
  await expect(escCaption(page)).toHaveText('Maya: each puzzle gets 30s x 1.5 = 0:45');

  await solveEscapeBoard(page, 0, puzzle);
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(escCaption(page)).toHaveText('Maya: each puzzle gets 30s x 1 = 0:30');
});

test('Brick Escape: a move to ages 3 to 4 mid-puzzle keeps the counted clock until the next puzzle', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  const puzzle = await escapePuzzleOnScreen(page, 0);
  await expect(escClock(page)).toBeVisible();

  await editSavedInAnotherTab(page, (state) => {
    state.players[0].ageBand = '3-4';
  });
  await expect.poll(async () => (await savedState(page)).players[0].ageBand).toBe('3-4');
  await page.waitForTimeout(300);
  await expect(escClock(page)).toBeVisible();
  await expect(page.locator('.bw-sand')).toHaveCount(0);

  await solveEscapeBoard(page, 0, puzzle);
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(page.locator('.bw-sand')).toBeVisible();
  await expect(escClock(page)).toHaveCount(0);
});

test('Brick Drop: a band changed from another tab keeps the puzzle on screen counted', async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/drop');
  await expect(page).toHaveURL(/#\/game\/drop\/1$/);
  await pauseClock(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.drop-timer__clock')).toHaveText('1:08');

  await editSavedInAnotherTab(page, (state) => {
    state.players[0].ageBand = '3-4';
  });
  await expect.poll(async () => (await savedState(page)).players[0].ageBand).toBe('3-4');
  await page.clock.runFor(300);
  await expect(page.locator('.drop-timer__clock')).toHaveText('1:08');
  await expect(page.locator('.drop-sand')).toHaveCount(0);

  // The next puzzle takes the new band: ages 3 to 4 get the sand timer.
  const puzzle = (await savedRun(page, 'drop', 0)).queue[0];
  await playDropPuzzle(page, planDropPuzzle(0, puzzle));
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(page.locator('.drop-sand')).toBeVisible();
  await expect(page.locator('.drop-timer__clock')).toHaveCount(0);
});

test('Letter Builder: a band changed mid-word keeps the word on screen and changes the next one', async ({ page }) => {
  // Level 16 is the first spelling level. Ages 3 to 4 spell three-letter words.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '3-4', games: { letters: { stars: starsUpTo(15) } } }]);
  await page.goto('/#/game/letters');
  await expect(page).toHaveURL(/#\/game\/letters\/16$/);
  const first = await lettersWord(page);
  expect(first).toHaveLength(3);

  await editSavedInAnotherTab(page, (state) => {
    state.players[0].ageBand = '7-8';
  });
  await expect.poll(async () => (await savedState(page)).players[0].ageBand).toBe('7-8');
  await page.waitForTimeout(300);
  expect(await lettersWord(page)).toBe(first);

  await solveLettersPuzzle(page);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Word 1 of 4. 1 built.');
  await page.getByRole('button', { name: 'Next word' }).click();
  // From the next word on, the new band's longer words; the built word stays built on the new set.
  const second = await lettersWord(page);
  expect(second.length).toBeGreaterThanOrEqual(6);
  await expect.poll(async () => (await savedRun(page, 'letters', 15)).set).toBe('letters:1:7-8');
  const run = await savedRun(page, 'letters', 15);
  expect(run.solved.map((r) => r.word?.toUpperCase())).toEqual([first]);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Word 2 of 4. 1 built.');
});

/* ---------- F2: the daily limit on a swap, a Restart and Try again ---------- */

/** 15 of 20 minutes played: six minutes on a level use the limit up. */
const nearLimit = { id: 'maya', name: 'Maya', dailyLimit: 20, minutesToday: 15 } as const;

async function addTenMinutes(page: Page) {
  await page.getByRole('button', { name: 'Grown-ups: add time' }).click();
  await passGrownUpCheck(page);
  await page.getByRole('button', { name: 'Add 10 minutes' }).click();
}

test('Brick Escape: Restart opens Break once the limit is used up, and the level comes back after', async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ ...nearLimit, ageBand: '7-8' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  await expect(page.locator('.esc-brick').first()).toBeVisible();

  // The limit runs out mid-puzzle: nothing cuts the child off.
  await page.clock.runFor(6 * 60_000);
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  await page.getByRole('button', { name: 'Restart puzzle' }).click();
  await expect(page).toHaveURL(/#\/break$/);

  await addTenMinutes(page);
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
});

test('Brick Escape: New puzzle opens Break once the limit is used up, and the swap waits', async ({ page }) => {
  await page.clock.install();
  // Ages 5 to 6: 90 s with no brick leaving brings the offer.
  await seed(page, [{ ...nearLimit, ageBand: '5-6' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  const before = (await savedRun(page, 'escape', 0)).queue;

  await page.clock.runFor(6 * 60_000);
  const offer = page.getByRole('button', { name: 'New puzzle' });
  await expect(offer).toBeVisible();
  await offer.click();
  await expect(page).toHaveURL(/#\/break$/);
  expect((await savedRun(page, 'escape', 0)).queue).toEqual(before);
});

test('Letter Builder: New puzzle opens Break once the limit is used up', async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ ...nearLimit, ageBand: '5-6' }]);
  await page.goto('/#/game/letters');
  await expect(page).toHaveURL(/#\/game\/letters\/1$/);
  await expect(page.locator('.lb-tray button').first()).toBeVisible();
  const before = (await savedRun(page, 'letters', 0)).queue;

  await page.clock.runFor(6 * 60_000);
  const offer = page.getByRole('button', { name: 'New puzzle' });
  await expect(offer).toBeVisible();
  await offer.click();
  await expect(page).toHaveURL(/#\/break$/);
  expect((await savedRun(page, 'letters', 0)).queue).toEqual(before);

  await addTenMinutes(page);
  await expect(page).toHaveURL(/#\/game\/letters\/1$/);
  await expect(page.locator('.lb-tray button').first()).toBeVisible();
});

test('Brick Drop: Try again opens Break once the limit is used up', async ({ page }) => {
  await page.clock.install();
  // 19 of 20 minutes: a minute on the level uses the limit up (Brick Drop draws every frame, so the clock runs short).
  await seed(page, [{ ...nearLimit, minutesToday: 19, ageBand: '5-6' }]);
  await page.goto('/#/game/drop');
  await expect(page).toHaveURL(/#\/game\/drop\/1$/);
  await pauseClock(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();
  await expect(page.locator('.drop-say')).toContainText('Press any button to start.');

  const over = page.getByRole('dialog', { name: 'Out of room' });
  for (let i = 0; i < 80 && !(await over.isVisible()); i++) {
    await page.keyboard.press(' ');
    await page.clock.runFor(400);
  }
  await expect(over).toBeVisible();
  // The sheet stays up while the limit runs out.
  await page.clock.runFor(65_000);
  await expect(page).toHaveURL(/#\/game\/drop\/1$/);
  await over.getByRole('button', { name: 'Try again' }).click();
  await expect(page).toHaveURL(/#\/break$/);
});

/* ---------- D2: the Age row in Settings ---------- */

test('Settings: a grown-up changes a child’s age band on the Age row', async ({ page }) => {
  await seed(page, [
    { id: 'maya', name: 'Maya', ageBand: '5-6' },
    { id: 'leo', name: 'Leo', ageBand: '3-4' },
  ]);
  await openSettings(page);
  const ages = page.getByRole('group', { name: "Maya's age" });
  await expect(ages.getByRole('button')).toHaveText(['3 to 4', '5 to 6', '7 to 8', '9 to 10']);
  await expect(ages.getByRole('button', { name: 'Ages 5 to 6' })).toHaveAttribute('aria-pressed', 'true');

  await ages.getByRole('button', { name: 'Ages 9 to 10' }).click();
  await expect(ages.getByRole('button', { name: 'Ages 9 to 10' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^Maya/ })).toContainText('Ages 9 to 10');
  await expect.poll(async () => (await savedState(page)).players.find((p) => p.id === 'maya')?.ageBand).toBe('9-10');
  // Leo is left alone; his row shows his own band.
  expect((await savedState(page)).players.find((p) => p.id === 'leo')?.ageBand).toBe('3-4');
  await page.getByRole('button', { name: /^Leo/ }).click();
  await expect(page.getByRole('group', { name: "Leo's age" }).getByRole('button', { name: 'Ages 3 to 4' })).toHaveAttribute('aria-pressed', 'true');
});

/* ---------- D6: the finished state shows the game's total stars ---------- */

test('the finished state shows each game’s total stars, not the last level’s', async ({ page }) => {
  // Every level has 2 stars but the last, which has 3: the last level alone would say 3 of 3.
  const withLast3 = (count: number) => ({ ...starsUpTo(count - 1, 2), [count - 1]: 3 });
  // Six-games brief 10.4: the batch 1 kit games, whose finished state is the kit's.
  await seed(page, [
    {
      id: 'maya',
      name: 'Maya',
      ageBand: '5-6',
      games: {
        escape: { stars: withLast3(31) },
        drop: { stars: withLast3(12) },
        letters: { stars: withLast3(24) },
        mixer: { stars: withLast3(9) },
        sorter: { stars: withLast3(9) },
        numbers: { stars: withLast3(12) },
      },
    },
  ]);
  for (const [game, total] of [
    ['Brick Escape', '63 of 93 stars'],
    ['Brick Drop', '25 of 36 stars'],
    ['Letter Builder', '49 of 72 stars'],
    ['Color Mixer', '19 of 27 stars'],
    ['Shape Sorter', '19 of 27 stars'],
    ['Number Line-up', '25 of 36 stars'],
  ] as const) {
    await page.goto('/#/');
    await homeCard(page, game).click();
    const card = levelCard(page);
    await expect(card.getByRole('heading')).toHaveText(/You finished every (level|stage)!/);
    await expect(card.getByRole('img', { name: total })).toBeVisible();
    await expect(card.getByRole('img', { name: '3 of 3 stars' })).toHaveCount(0);
  }
});

/* ---------- F9: the stopped clock after a solve ---------- */

test('Brick Escape: after a solve the clock panel stays on screen, stopped', async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  const puzzle = await escapePuzzleOnScreen(page, 0);
  await solveEscapeBoard(page, 0, puzzle);
  await expect(page.getByRole('button', { name: 'Next puzzle' })).toBeVisible();

  // As on the EscapeSolved board: the clock, its bar and the caption stay, and nothing counts down.
  const panel = page.getByRole('region', { name: 'Puzzle status' });
  await expect(panel.locator('.esc-status__track')).toBeVisible();
  await expect(escCaption(page)).toBeVisible();
  const shown = await escClock(page).textContent();
  const width = await panel.locator('.esc-status__fill').evaluate((el) => (el as HTMLElement).style.width);
  await pauseClock(page);
  await page.clock.runFor(10_000);
  await expect(escClock(page)).toHaveText(shown!);
  expect(await panel.locator('.esc-status__fill').evaluate((el) => (el as HTMLElement).style.width)).toBe(width);
  expect((await savedGame(page, 'escape'))?.runs?.['0']?.solved).toHaveLength(1);
});
