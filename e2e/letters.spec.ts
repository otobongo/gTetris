/**
 * Letter Builder journeys (four-puzzle brief 12): stuck, swap and finish; Break between puzzles and back after
 * extra time; a grown-up's jump to Level 20 that every screen names; an age band change mid-level; the last
 * level of the game; the level's hint budget over a swap (3.3); and Break on the level card's Play tap (2.4).
 */
import { expect, test, type Page } from '@playwright/test';
import {
  dots,
  editSavedInAnotherTab,
  hashOf,
  homeCard,
  levelCard,
  lettersAnswer,
  lettersWord,
  lettersWrongTap,
  openSettings,
  passGrownUpCheck,
  savedGame,
  savedRun,
  seed,
  solveLettersPuzzle,
  starsUpTo,
} from './app';

const help = (page: Page) => page.locator('.lb-help');
const title = (page: Page) => page.getByRole('heading', { level: 1 });

/** Build the puzzle on screen, then tap Next (Next puzzle or Next word) unless it was the fourth. */
async function buildAndGoOn(page: Page, solvedBefore: number, noun: 'puzzle' | 'word' = 'puzzle') {
  await solveLettersPuzzle(page);
  if (solvedBefore + 1 >= 4) return;
  const done = noun === 'word' ? 'built' : 'solved';
  const Noun = noun === 'word' ? 'Word' : 'Puzzle';
  await expect(dots(page)).toHaveAttribute('aria-label', `${Noun} ${solvedBefore + 1} of 4. ${solvedBefore + 1} ${done}.`);
  const next = page.getByRole('button', { name: noun === 'word' ? 'Next word' : 'Next puzzle' });
  await expect(next).toBeFocused();
  await next.click();
  await expect(dots(page)).toHaveAttribute('aria-label', `${Noun} ${solvedBefore + 2} of 4. ${solvedBefore + 1} ${done}.`);
}

test('a stuck child takes a different puzzle and still finishes the level', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/');
  await homeCard(page, 'Letter Builder').click();
  await expect(page).toHaveURL(/#\/game\/letters\/1$/);
  await expect(title(page)).toHaveText('Level 1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');

  const stuckOn = (await lettersAnswer(page)).join('');
  const offer = page.getByRole('button', { name: 'New puzzle' });
  // Ages 5 to 6: three wrong taps on one puzzle bring the offer. Two are not enough.
  await lettersWrongTap(page);
  await lettersWrongTap(page);
  await expect(offer).toHaveCount(0);
  await lettersWrongTap(page);
  await expect(offer).toBeVisible();
  await expect(help(page)).toHaveText('This one is tricky. Want a different puzzle?');
  // The offer never takes focus.
  await expect(offer).not.toBeFocused();

  await offer.click();
  await expect(help(page)).toHaveText('Here is a different puzzle.');
  await expect(offer).toHaveCount(0);
  // The dots do not change, and Level 1 alternates its two runs, so the swap brings the other one.
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  const swappedTo = (await lettersAnswer(page)).join('');
  expect(swappedTo).not.toBe(stuckOn);
  const run = await savedRun(page, 'letters', 0);
  expect(run.queue[run.queue.length - 1]).toBe(0);
  expect(run.solved).toEqual([]);

  for (let n = 0; n < 4; n++) await buildAndGoOn(page, n);

  // The swapped puzzle and its three slips do not count: four clean puzzles earn 3 stars.
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog).toContainText('4 puzzles, no slips.');
  await expect(dialog.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(dialog).toContainText('3 stars: 1 slip or none. 2 stars: 4 slips or fewer.');
  const saved = await savedGame(page, 'letters');
  expect(saved?.stars['0']).toBe(3);

  // Escape closes the card; the tray well then holds the same Play button, with focus.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const play = page.getByRole('button', { name: 'Play Level 2' });
  await expect(play).toBeFocused();
  await play.click();
  await expect(page).toHaveURL(/#\/game\/letters\/2$/);
  await expect(title(page)).toHaveText('Level 2');
});

test('Break opens between puzzles and the child resumes on the next puzzle after extra time', async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', dailyLimit: 20, minutesToday: 15 }]);
  await page.goto('/#/game/letters');
  await expect(page).toHaveURL(/#\/game\/letters\/1$/);

  await solveLettersPuzzle(page);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await expect(next).toBeVisible();

  // The limit runs out while the child reads the result: nothing cuts the screen off.
  await page.clock.runFor(6 * 60_000);
  await expect(next).toBeVisible();
  await expect(page).toHaveURL(/#\/game\/letters\/1$/);

  // The next tap opens Break, which names the level and what is saved.
  await next.click();
  await expect(page).toHaveURL(/#\/break$/);
  await expect(page.getByRole('heading', { name: 'Time for a break, Maya' })).toBeVisible();
  await expect(page.locator('.sc-saved')).toHaveText('Level 1 is saved with 1 of 4 puzzles solved.');

  // Home is blocked too while the limit is used up.
  await page.goto('/#/');
  await expect(page).toHaveURL(/#\/break$/);
  // Leaving to Home sets Break's way back to Home, so come back through the game again.
  await page.goto('/#/game/letters/1');
  await expect(page).toHaveURL(/#\/break$/);
  await expect(page.locator('.sc-saved')).toHaveText('Level 1 is saved with 1 of 4 puzzles solved.');

  await page.getByRole('button', { name: 'Grown-ups: add time' }).click();
  await passGrownUpCheck(page);
  await expect(page.getByRole('heading', { name: 'Add time for Maya today' })).toBeVisible();
  await page.getByRole('button', { name: 'Add 10 minutes' }).click();

  // Back on the level, at the next unsolved puzzle.
  await expect(page).toHaveURL(/#\/game\/letters\/1$/);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await expect(page.locator('.lb-tray button').first()).toBeVisible();
  await buildAndGoOn(page, 1);
});

test('a grown-up jumps a child to Level 20 and every screen names it', async ({ page }) => {
  await page.clock.install();
  // Maya's frontier is Level 10 (Levels 1 to 9 finished).
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', games: { letters: { stars: starsUpTo(9) } } }]);
  await page.goto('/');
  await expect(homeCard(page, 'Letter Builder')).toContainText('Level 10');

  await openSettings(page);
  await page.getByRole('link', { name: 'Letter Builder for Maya: Level 10. Pick a level' }).click();
  await expect(page.getByRole('status')).toHaveText('Maya is on Level 10.');
  // Locked levels can be picked too.
  await page.getByRole('button', { name: 'Level 20, locked' }).click();
  await expect(page.getByRole('button', { name: 'Level 20, locked' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status')).toHaveText('Level 20 picked. Maya hasn’t reached it yet.');
  await page.getByRole('button', { name: 'Play Level 20' }).click();

  await expect(page).toHaveURL(/#\/game\/letters\/20$/);
  await expect(title(page)).toHaveText('Level 20');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Word 1 of 4. 0 built.');
  await buildAndGoOn(page, 0, 'word');

  // Home: the pill and the card's name.
  await page.getByRole('link', { name: 'Back to home' }).click();
  const card = homeCard(page, 'Letter Builder');
  await expect(card).toContainText('Level 20');
  await expect(card).toHaveAccessibleName(/Level 20, 1 of 4 words built\.$/);

  // Settings: the row's sub, then the picker's arrival status and current tile.
  await openSettings(page);
  const row = page.getByRole('link', { name: 'Letter Builder for Maya: Level 20, 1 of 4 words. Pick a level' });
  await expect(row).toContainText('Level 20, 1 of 4 words');
  await row.click();
  await expect(page.getByRole('status')).toHaveText('Maya is on Level 20, 1 of 4 words built.');
  await expect(page.locator('[aria-current="step"]')).toHaveAccessibleName('Level 20, Maya’s current level');
  await page.getByRole('link', { name: 'Back to settings' }).click();
  await page.getByRole('link', { name: 'Back to home' }).click();

  // The game itself, and Break's line when the limit runs out between words.
  await homeCard(page, 'Letter Builder').click();
  await expect(page).toHaveURL(/#\/game\/letters\/20$/);
  await expect(title(page)).toHaveText('Level 20');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Word 2 of 4. 1 built.');
  await solveLettersPuzzle(page);
  await page.clock.runFor(21 * 60_000);
  await page.getByRole('button', { name: 'Next word' }).click();
  await expect(page).toHaveURL(/#\/break$/);
  await expect(page.locator('.sc-saved')).toHaveText('Level 20 is saved with 2 of 4 words built.');

  await page.getByRole('button', { name: 'Grown-ups: add time' }).click();
  await passGrownUpCheck(page);
  await page.getByRole('button', { name: '30 minutes', exact: true }).click();
  await page.getByRole('button', { name: 'Add 30 minutes' }).click();
  await expect(page).toHaveURL(/#\/game\/letters\/20$/);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Word 3 of 4. 2 built.');
  await buildAndGoOn(page, 2, 'word');
  await solveLettersPuzzle(page);

  // Finishing the picked level carries on at the next one with no stars: Level 21, not the old frontier.
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 20');
  await expect(dialog.getByRole('button', { name: 'Play Level 21' })).toBeVisible();
  expect((await savedGame(page, 'letters'))?.current).toBe(20);
});

test('an age band change mid-level keeps the built words and gives the rest the new band’s words', async ({ page }) => {
  // Level 16 is the first spelling level. Ages 3 to 4 spell three-letter words.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '3-4', games: { letters: { stars: starsUpTo(15) } } }]);
  await page.goto('/#/game/letters');
  await expect(page).toHaveURL(/#\/game\/letters\/16$/);
  await expect(title(page)).toHaveText('Level 16');

  const built: string[] = [];
  for (let n = 0; n < 2; n++) {
    const word = await lettersWord(page);
    expect(word).toHaveLength(3);
    built.push(word);
    await buildAndGoOn(page, n, 'word');
  }
  expect((await savedRun(page, 'letters', 15)).set).toBe('letters:1:3-4');

  // A grown-up moves Maya to ages 7 to 8 (from another tab or device), and the level opens again.
  await page.getByRole('link', { name: 'Back to home' }).click();
  await editSavedInAnotherTab(page, (state) => {
    state.players[0].ageBand = '7-8';
  });
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
  await homeCard(page, 'Letter Builder').click();
  await expect(page).toHaveURL(/#\/game\/letters\/16$/);

  // The built words stay built and still count; the unsolved puzzles get the new band's longer words.
  await expect(dots(page)).toHaveAttribute('aria-label', 'Word 3 of 4. 2 built.');
  // The level saves its run on the new band's set as it opens.
  await expect.poll(async () => (await savedRun(page, 'letters', 15)).set).toBe('letters:1:7-8');
  const run = await savedRun(page, 'letters', 15);
  expect(run.solved.map((r) => r.word?.toUpperCase())).toEqual(built);

  for (let n = 2; n < 4; n++) {
    const word = await lettersWord(page);
    expect(word.length).toBeGreaterThanOrEqual(6);
    expect(built).not.toContain(word);
    built.push(word);
    await buildAndGoOn(page, n, 'word');
  }
  expect(new Set(built).size).toBe(4);
  await expect(levelCard(page).getByRole('heading')).toHaveText('You finished Level 16');
  await expect(levelCard(page)).toContainText('4 words, no slips.');
});

test('finishing the last level shows the finished card, then the finished state on later visits', async ({ page }) => {
  // Every Letter Builder level but the last has stars; Brick Escape and Brick Drop are already finished.
  await seed(page, [
    {
      id: 'maya',
      name: 'Maya',
      ageBand: '5-6',
      games: { letters: { stars: starsUpTo(23) }, escape: { stars: starsUpTo(31, 2) }, drop: { stars: starsUpTo(12, 2) } },
    },
  ]);
  await page.goto('/');
  await expect(homeCard(page, 'Letter Builder')).toContainText('Level 24');
  await expect(homeCard(page, 'Brick Escape')).toContainText('All done');
  await homeCard(page, 'Letter Builder').click();
  await expect(page).toHaveURL(/#\/game\/letters\/24$/);

  for (let n = 0; n < 4; n++) await buildAndGoOn(page, n, 'word');

  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished every level!');
  await expect(dialog).toContainText(`24 levels, ${23 * 3 + 3} of 72 stars.`);
  // One button only.
  await expect(dialog.getByRole('link')).toHaveCount(1);
  await expect(dialog.getByRole('button')).toHaveCount(0);
  const saved = await savedGame(page, 'letters');
  expect(saved?.current).toBeUndefined();
  await dialog.getByRole('link', { name: 'Back to games' }).click();

  await expect(page).toHaveURL(/#\/$/);
  const card = homeCard(page, 'Letter Builder');
  await expect(card).toContainText('All done');
  await expect(card).toHaveAccessibleName(/All done\.$/);

  // A later visit stays on the game and shows the finished state; the button, Escape and the scrim go Home.
  for (const leave of ['button', 'escape', 'scrim'] as const) {
    await homeCard(page, 'Letter Builder').click();
    await expect(page).toHaveURL(/#\/game\/letters$/);
    await expect(title(page)).toHaveText('Letter Builder');
    await expect(dots(page)).toHaveCount(0);
    const finished = levelCard(page);
    await expect(finished.getByRole('heading')).toHaveText('You finished every level!');
    await expect(finished).toContainText('A grown-up can pick a level to play again.');
    await expect(finished.getByRole('link', { name: 'Back to games' })).toBeFocused();
    if (leave === 'button') await finished.getByRole('link', { name: 'Back to games' }).click();
    if (leave === 'escape') await page.keyboard.press('Escape');
    if (leave === 'scrim') await page.locator('.bw-levelcard-scrim').click({ position: { x: 8, y: 8 } });
    await expect(page).toHaveURL(/#\/$/);
    expect(hashOf(page)).toBe('#/');
  }

  // Brick Escape's finished state works the same way.
  await homeCard(page, 'Brick Escape').click();
  await expect(page).toHaveURL(/#\/game\/escape$/);
  await expect(title(page)).toHaveText('Brick Escape');
  await expect(levelCard(page)).toContainText('31 levels, 62 of 93 stars.');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/$/);

  // And Brick Drop's, which says "stage".
  await expect(homeCard(page, 'Brick Drop')).toContainText('All done');
  await homeCard(page, 'Brick Drop').click();
  await expect(page).toHaveURL(/#\/game\/drop$/);
  await expect(title(page)).toHaveText('Brick Drop');
  await expect(levelCard(page).getByRole('heading')).toHaveText('You finished every stage!');
  await expect(levelCard(page)).toContainText('12 stages, 24 of 36 stars.');
  await expect(levelCard(page)).toContainText('A grown-up can pick a stage to play again.');
  await page.locator('.bw-levelcard-scrim').click({ position: { x: 8, y: 8 } });
  await expect(page).toHaveURL(/#\/$/);
});

test('a hint stays spent after a swap but only caps the level when it helped a solved puzzle', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/letters');
  await expect(page).toHaveURL(/#\/game\/letters\/1$/);
  const hint = (left: number) => page.getByRole('button', { name: `Hint (${left})` });

  // A hint on the first puzzle, then three wrong taps and a swap: the badge does not count back up.
  await hint(3).click();
  await expect(hint(2)).toBeVisible();
  await expect(page.locator('.lb-tray button.is-hint')).toHaveCount(1);
  for (let i = 0; i < 3; i++) await lettersWrongTap(page);
  await page.getByRole('button', { name: 'New puzzle' }).click();
  await expect(help(page)).toHaveText('Here is a different puzzle.');
  await expect(hint(2)).toBeVisible();
  expect((await savedRun(page, 'letters', 0)).hintsLeft).toBe(2);

  // The puzzle after the swap is built with no hint: its result carries none. After Next, the first tile has focus.
  await solveLettersPuzzle(page);
  expect((await savedRun(page, 'letters', 0)).solved.map((r) => r.usedHint)).toEqual([false]);
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(page.locator('.lb-tray button').first()).toBeFocused();
  // Leaving and coming back keeps the spent hint.
  await page.reload();
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await expect(hint(2)).toBeVisible();
  await buildAndGoOn(page, 1);
  await buildAndGoOn(page, 2);

  // A hint on the fourth puzzle, which the child then builds: that one caps the level.
  await hint(2).click();
  await expect(hint(1)).toBeVisible();
  await solveLettersPuzzle(page);
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  // The swapped puzzle's three slips do not count.
  await expect(dialog).toContainText('4 puzzles, no slips.');
  await expect(dialog).toContainText('Using a hint caps the level at 2 stars.');
  await expect(dialog.getByRole('img', { name: '2 of 3 stars' })).toBeVisible();
  expect((await savedGame(page, 'letters'))?.stars['0']).toBe(2);
});

test('Play Level checks the daily limit too: Break opens and the child goes on at the next level', async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', dailyLimit: 20, minutesToday: 15 }]);
  await page.goto('/#/game/letters');
  await expect(page).toHaveURL(/#\/game\/letters\/1$/);
  for (let n = 0; n < 4; n++) await buildAndGoOn(page, n);
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');

  // The limit runs out while the card is up: nothing cuts it off.
  await page.clock.runFor(6 * 60_000);
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/#\/game\/letters\/1$/);

  // The Play tap opens Break. Level 2 has nothing solved yet, so Break has no mid-level line.
  await dialog.getByRole('button', { name: 'Play Level 2' }).click();
  await expect(page).toHaveURL(/#\/break$/);
  await expect(page.getByRole('heading', { name: 'Time for a break, Maya' })).toBeVisible();
  await expect(page.locator('.sc-saved')).not.toContainText('is saved with');

  await page.getByRole('button', { name: 'Grown-ups: add time' }).click();
  await passGrownUpCheck(page);
  await page.getByRole('button', { name: 'Add 10 minutes' }).click();
  // Back at the level the Play button named, at its first puzzle.
  await expect(page).toHaveURL(/#\/game\/letters\/2$/);
  await expect(title(page)).toHaveText('Level 2');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
});
