/**
 * Pattern Train journeys (six-games brief 10.4): a new child plays Level 1 into Level 2, with a wrong car on the
 * way; and the last level ends on the finished card, a later visit shows the finished state, and the Escape key
 * goes Home from there. The train and the tray are read from their accessible names (brief 9.2) and the next
 * car is tapped.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  PATTERN_TRAY,
  dots,
  hashOf,
  homeCard,
  levelCard,
  patternCar,
  patternOnScreen,
  patternTrain,
  patternTray,
  recordSpeech,
  savedGame,
  savedRun,
  seed,
  solvePatternPuzzle,
  starsUpTo,
} from './app';

const help = (page: Page) => page.locator('.bw-helprow__line');
const title = (page: Page) => page.getByRole('heading', { level: 1 });
const prompt = (page: Page) => page.locator('.pat-prompt');
const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Solve the train on screen, then tap Next puzzle unless it was the fourth; focus lands on the first car. */
async function solveAndGoOn(page: Page, solvedBefore: number) {
  await solvePatternPuzzle(page);
  if (solvedBefore + 1 >= 4) return;
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 1} of 4. ${solvedBefore + 1} solved.`);
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await expect(next).toBeFocused();
  await next.click();
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 2} of 4. ${solvedBefore + 1} solved.`);
  await expect(patternTray(page).getByRole('button').first()).toBeFocused();
}

test('a new child plays Pattern Train Level 1 and goes straight into Level 2', async ({ page }) => {
  const spoken = await recordSpeech(page);
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/');
  const card = homeCard(page, 'Pattern Train');
  await expect(card).toContainText('Level 1');
  await expect(card).not.toContainText('Coming soon');
  await card.click();
  await expect(page).toHaveURL(/#\/game\/pattern\/1$/);
  await expect(title(page)).toHaveText('Level 1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');

  // The train is one image; the tray holds three cars named by car.
  await expect(prompt(page)).toHaveText('Look at the train. What is the pattern?');
  await expect(help(page)).toHaveText('Say the cars out loud, then pick the next one.');
  const p = await patternOnScreen(page);
  expect(p.cars).toHaveLength(4);
  expect(new Set(p.choices).size).toBe(3);
  await expect(patternTray(page)).toHaveAccessibleName(PATTERN_TRAY);

  // A wrong car first: it dims and comes back, the line asks to try again, and nothing is said.
  await patternCar(page, p.wrong[0]).click();
  await expect(help(page)).toHaveText('Say the pattern out loud and try again.');
  await expect(patternTrain(page)).toHaveAccessibleName(p.train);

  // Then the right one: the empty car fills, the lines say so, and Next puzzle takes the tray's place with focus.
  await patternCar(page, p.answer).click();
  await expect(patternTrain(page)).toHaveAccessibleName(`Train: ${[...p.cars, p.answer].join(', ')}.`);
  await expect(prompt(page)).toHaveText('Pattern complete.');
  await expect(help(page)).toHaveText(`${capital(p.answer)} comes next.`);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  await expect(patternTray(page)).toHaveCount(0);
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await expect(next).toBeFocused();
  // The speaker reads the whole train and the solved line.
  await page.getByRole('button', { name: 'Hear the pattern' }).click();
  await expect.poll(spoken).toEqual([`${capital([...p.cars, p.answer].join(', '))}. ${capital(p.answer)} comes next.`]);
  await next.click();

  // The next train's cars take taps at once, while the old train leaves.
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await expect(patternTray(page).getByRole('button').first()).toBeFocused();
  for (let n = 1; n < 4; n++) await solveAndGoOn(page, n);

  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog).toContainText('4 puzzles, 1 slip.');
  await expect(dialog.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(dialog).toContainText('3 stars: 1 slip or none. 2 stars: 4 slips or fewer.');
  await expect(dialog.getByRole('button', { name: 'Play Level 2' })).toBeFocused();
  expect((await savedGame(page, 'pattern'))?.stars['0']).toBe(3);
  // Only the speaker tap spoke.
  expect(await spoken()).toHaveLength(1);

  await dialog.getByRole('button', { name: 'Play Level 2' }).click();
  await expect(page).toHaveURL(/#\/game\/pattern\/2$/);
  await expect(title(page)).toHaveText('Level 2');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  // Level 2 changes only the colour: every car has the same shape.
  const level2 = await patternOnScreen(page);
  const shapes = new Set([...level2.cars, ...level2.choices].map((c) => c.split(' ')[1]));
  expect(shapes.size).toBe(1);
  expect((await savedRun(page, 'pattern', 1)).set).toBe('pattern:1');

  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(homeCard(page, 'Pattern Train')).toContainText('Level 2');
});

test('the last Pattern Train level ends on the finished card, and the finished state goes Home on Escape', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10', games: { pattern: { stars: starsUpTo(11, 2) } } }]);
  await page.goto('/');
  await expect(homeCard(page, 'Pattern Train')).toContainText('Level 12');
  await homeCard(page, 'Pattern Train').click();
  await expect(page).toHaveURL(/#\/game\/pattern\/12$/);

  // Level 12 mixes the two four-car patterns: five cars, then the empty one.
  const p = await patternOnScreen(page);
  expect(p.cars).toHaveLength(5);
  for (let n = 0; n < 4; n++) await solveAndGoOn(page, n);

  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished every level!');
  await expect(dialog).toContainText('12 levels, 25 of 36 stars.');
  await expect(dialog.getByRole('button')).toHaveCount(0);
  await expect(dialog.getByRole('link', { name: 'Back to games' })).toBeFocused();
  await dialog.getByRole('link', { name: 'Back to games' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(homeCard(page, 'Pattern Train')).toContainText('All done');

  // A later visit: the finished state, with the locomotive on an empty rail behind the card.
  await homeCard(page, 'Pattern Train').click();
  await expect(page).toHaveURL(/#\/game\/pattern$/);
  await expect(title(page)).toHaveText('Pattern Train');
  await expect(dots(page)).toHaveCount(0);
  const finished = levelCard(page);
  await expect(finished.getByRole('heading')).toHaveText('You finished every level!');
  await expect(finished.getByRole('img', { name: '25 of 36 stars' })).toBeVisible();
  await expect(finished).toContainText('A grown-up can pick a level to play again.');
  await expect(finished.getByRole('link', { name: 'Back to games' })).toBeFocused();
  await expect(page.locator('.pat-loco')).toBeAttached();
  await expect(page.locator('.pat-car')).toHaveCount(0);
  await expect(patternTray(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/$/);
  expect(hashOf(page)).toBe('#/');
});
