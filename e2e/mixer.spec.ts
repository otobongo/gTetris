/**
 * Color Mixer journeys (six-games brief 10.4): a new child plays Level 1 into Level 2; wrong pairs show their
 * colour, count as slips on the card and bring the offer at 3 for ages 3 to 4, and a swap brings a different
 * puzzle; Break at Next once the daily limit is used up, then the next unsolved puzzle after a grown-up adds
 * time; a grown-up's pick of a locked level that the child then plays; and the last level into the finished
 * state. The puzzle on screen is read from its accessible names (brief 9.2) and solved with taps.
 */
import { expect, test, type Page } from '@playwright/test';
import { RECIPES, RESULTS, colorWord, mixOf } from '../src/games/mixer/colors';
import { STUCK } from '../src/games/run';
import {
  dots,
  hashOf,
  homeCard,
  levelCard,
  mixerBowl,
  mixerOnScreen,
  mixerPot,
  mixerSlot,
  mixerSwatches,
  openSettings,
  passGrownUpCheck,
  savedGame,
  savedRun,
  seed,
  solveMixerPuzzle,
  starsUpTo,
} from './app';

const help = (page: Page) => page.locator('.bw-helprow__line');
const title = (page: Page) => page.getByRole('heading', { level: 1 });
const resultName = (page: Page) => page.locator('.mix-result__name');
const resultText = (page: Page) => page.locator('.mix-result__text');

/** Solve the puzzle on screen, then tap Next puzzle unless it was the fourth. */
async function solveAndGoOn(page: Page, solvedBefore: number) {
  await solveMixerPuzzle(page);
  if (solvedBefore + 1 >= 4) return;
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 1} of 4. ${solvedBefore + 1} solved.`);
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await expect(next).toBeFocused();
  await next.click();
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 2} of 4. ${solvedBefore + 1} solved.`);
}

/** Record what the app asks the browser's voice to say, instead of saying it. */
async function recordSpeech(page: Page) {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    const voice = { speak: (u: { text: string }) => spoken.push(u.text), cancel: () => {}, getVoices: () => [], addEventListener: () => {} };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => voice });
  });
  return () => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.slice());
}

test('a new child plays Color Mixer Level 1 and goes straight into Level 2', async ({ page }) => {
  const spoken = await recordSpeech(page);
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/');
  const card = homeCard(page, 'Color Mixer');
  await expect(card).toContainText('Level 1');
  await expect(card).not.toContainText('Coming soon');
  await card.click();
  await expect(page).toHaveURL(/#\/game\/mixer\/1$/);
  await expect(title(page)).toHaveText('Level 1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');

  // Level 1 is Finish the mix: paint 1 is given, the bowl shows it, and the line says what to make.
  const first = await mixerOnScreen(page);
  if (first.form !== 'finish') throw new Error('Level 1 is Finish the mix');
  await expect(mixerSlot(page, 1)).toHaveAccessibleName(`Paint 1: ${colorWord(first.given)}, given`);
  await expect(mixerSlot(page, 2)).toHaveAccessibleName('Paint 2: empty');
  await expect(mixerBowl(page)).toHaveAccessibleName(`Bowl: ${colorWord(first.given)}`);
  await expect(help(page)).toHaveText(`Tap the paint that makes ${colorWord(first.goal)}.`);
  await expect(resultName(page)).toHaveText('Pick one more paint');

  // The right paint: the bowl turns the goal colour and the line says so.
  await mixerPot(page, first.right).click();
  await expect(mixerBowl(page)).toHaveAccessibleName(`Bowl: ${colorWord(first.goal)}`);
  await expect(help(page)).toHaveText(`You made ${colorWord(first.goal)}.`);
  await expect(resultText(page)).toHaveText(RECIPES.find((r) => r.result === first.goal)!.text);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await expect(next).toBeFocused();
  await next.click();
  // After Next, focus is on the first paint.
  await expect(page.getByRole('group', { name: 'Paints' }).getByRole('button').first()).toBeFocused();

  for (let n = 1; n < 4; n++) await solveAndGoOn(page, n);

  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(dialog).toContainText('4 puzzles, no slips.');
  await expect(dialog).toContainText('3 stars: 1 slip or none. 2 stars: 4 slips or fewer.');
  await expect(dialog.getByRole('button', { name: 'Play Level 2' })).toBeFocused();
  expect((await savedGame(page, 'mixer'))?.stars['0']).toBe(3);
  // Nothing is said by itself: not on opening, not on a pot tap, not at the level's end.
  expect(await spoken()).toEqual([]);

  await dialog.getByRole('button', { name: 'Play Level 2' }).click();
  await expect(page).toHaveURL(/#\/game\/mixer\/2$/);
  await expect(title(page)).toHaveText('Level 2');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  // Level 2 is Guess the mix: three named colours, and the bowl stays empty until the right one.
  const guess = await mixerOnScreen(page);
  if (guess.form !== 'guess') throw new Error('Level 2 is Guess the mix');
  expect(guess.choices).toHaveLength(3);
  await expect(mixerBowl(page)).toHaveAccessibleName('Bowl: empty');
  await expect(help(page)).toHaveText('Tap the color they make.');

  // The speaker reads the question.
  await page.getByRole('button', { name: 'Hear the question' }).click();
  expect(await spoken()).toEqual([`What do ${colorWord(guess.paints[0])} and ${colorWord(guess.paints[1])} make?`]);

  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(homeCard(page, 'Color Mixer')).toContainText('Level 2');
});

test('wrong pairs show their colour, count as slips on the card, bring the offer at 3 for ages 3 to 4, and a swap brings a different puzzle', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'leo', name: 'Leo', ageBand: '3-4' }]);
  await page.goto('/#/game/mixer');
  await expect(page).toHaveURL(/#\/game\/mixer\/1$/);

  // Puzzle 1: a wrong paint first. The bowl shows what the pair made and the result text teaches it.
  const p1 = await mixerOnScreen(page);
  if (p1.form !== 'finish') throw new Error('Level 1 is Finish the mix');
  const made = mixOf(p1.given, p1.wrong[0])!;
  await mixerPot(page, p1.wrong[0]).click();
  await expect(mixerBowl(page)).toHaveAccessibleName(`Bowl: ${colorWord(made)}`);
  await expect(resultName(page)).toHaveText(RESULTS[made].name);
  await expect(resultText(page)).toHaveText(RECIPES.find((r) => r.result === made)!.text);
  await expect(help(page)).toHaveText(`Not ${colorWord(p1.goal)} yet. Try another paint.`);
  // Then the right one: a tap on another pot replaces paint 2.
  await mixerPot(page, p1.right).click();
  await expect(help(page)).toHaveText(`You made ${colorWord(p1.goal)}.`);
  await page.getByRole('button', { name: 'Next puzzle' }).click();

  // Puzzle 2: the same wrong pair three times (a filled slot empties on a tap) brings the offer.
  const p2 = await mixerOnScreen(page);
  if (p2.form !== 'finish') throw new Error('Level 1 is Finish the mix');
  const offer = page.getByRole('button', { name: 'New puzzle' });
  for (let i = 0; i < 3; i++) {
    if (i) {
      await mixerSlot(page, 2).click();
      await expect(mixerSlot(page, 2)).toHaveAccessibleName('Paint 2: empty');
    }
    await expect(offer).toHaveCount(0);
    await mixerPot(page, p2.wrong[0]).click();
    await expect(mixerSlot(page, 2)).toHaveAccessibleName(`Paint 2: ${colorWord(p2.wrong[0])}`);
  }
  await expect(offer).toBeVisible();
  await expect(help(page)).toHaveText('This one is tricky. Want a different puzzle?');
  await expect(offer).not.toBeFocused();
  await expect(page.getByRole('button', { name: 'Read the help line aloud' })).toBeVisible();

  await offer.click();
  await expect(help(page)).toHaveText('Here is a different puzzle.');
  await expect(offer).toHaveCount(0);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  // A different puzzle: on Level 1 two puzzles may share a goal, but then the given paint differs.
  const p3 = await mixerOnScreen(page);
  if (p3.form !== 'finish') throw new Error('Level 1 is Finish the mix');
  expect(`${p3.goal}|${p3.given}`).not.toBe(`${p2.goal}|${p2.given}`);
  await expect(mixerSlot(page, 2)).toHaveAccessibleName('Paint 2: empty');
  const run = await savedRun(page, 'mixer', 0);
  expect(run.queue[run.queue.length - 1]).toBe(1);

  for (let n = 1; n < 4; n++) await solveAndGoOn(page, n);

  // The swapped puzzle's slips do not count; puzzle 1's one wrong pair does.
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog).toContainText('4 puzzles, 1 slip.');
  await expect(dialog.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  const saved = await savedGame(page, 'mixer');
  expect(saved?.stars['0']).toBe(3);
});

test('Break opens at Next once the daily limit is used up, and the child resumes at the next unsolved puzzle after extra time', async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', dailyLimit: 20, minutesToday: 15 }]);
  await page.goto('/#/game/mixer');
  await expect(page).toHaveURL(/#\/game\/mixer\/1$/);

  await solveMixerPuzzle(page);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  const next = page.getByRole('button', { name: 'Next puzzle' });

  // The limit runs out while the child looks at the result: nothing cuts the screen off.
  await page.clock.runFor(6 * 60_000);
  await expect(next).toBeVisible();
  await expect(page).toHaveURL(/#\/game\/mixer\/1$/);

  await next.click();
  await expect(page).toHaveURL(/#\/break$/);
  await expect(page.getByRole('heading', { name: 'Time for a break, Maya' })).toBeVisible();
  await expect(page.locator('.sc-saved')).toHaveText('Level 1 is saved with 1 of 4 puzzles solved.');

  await page.getByRole('button', { name: 'Grown-ups: add time' }).click();
  await passGrownUpCheck(page);
  await expect(page.getByRole('heading', { name: 'Add time for Maya today' })).toBeVisible();
  await page.getByRole('button', { name: 'Add 10 minutes' }).click();

  // Back on the level, at the next unsolved puzzle, which then plays as usual.
  await expect(page).toHaveURL(/#\/game\/mixer\/1$/);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await solveAndGoOn(page, 1);
  expect((await savedRun(page, 'mixer', 0)).solved).toHaveLength(2);
});

test('a grown-up picks a locked Color Mixer level and the child plays it', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8', games: { mixer: { stars: starsUpTo(1) } } }]);
  await openSettings(page);
  await page.getByRole('link', { name: 'Color Mixer for Maya: Level 2. Pick a level' }).click();
  await expect(page).toHaveURL(/#\/settings\/levels\/mixer\/maya$/);
  await expect(page.getByRole('status')).toHaveText('Maya is on Level 2.');
  // The chapters come from the game: Make it lighter is Levels 4 to 6.
  await expect(page.getByText('Make it lighter', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Level 4, locked' }).click();
  await expect(page.getByRole('status')).toHaveText('Level 4 picked. Maya hasn’t reached it yet.');
  await page.getByRole('button', { name: 'Play Level 4' }).click();

  await expect(page).toHaveURL(/#\/game\/mixer\/4$/);
  await expect(title(page)).toHaveText('Level 4');
  // Level 4 is Finish the mix with white on the shelf: the given paint is left out of four.
  const p = await mixerOnScreen(page);
  if (p.form !== 'finish') throw new Error('Level 4 is Finish the mix');
  expect(['pink', 'sky', 'cream']).toContain(p.goal);
  await expect(page.getByRole('group', { name: 'Paints' }).getByRole('button')).toHaveCount(3);

  for (let n = 0; n < 4; n++) await solveAndGoOn(page, n);
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 4');
  await expect(dialog.getByRole('button', { name: 'Play Level 5' })).toBeVisible();
  expect((await savedGame(page, 'mixer'))?.stars['3']).toBe(3);
  expect((await savedGame(page, 'mixer'))?.current).toBe(4);
});

test('the last Color Mixer level ends on the finished card, and later visits show the finished state', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10', games: { mixer: { stars: starsUpTo(8, 2) } } }]);
  await page.goto('/');
  await expect(homeCard(page, 'Color Mixer')).toContainText('Level 9');
  await homeCard(page, 'Color Mixer').click();
  await expect(page).toHaveURL(/#\/game\/mixer\/9$/);

  // Level 9 is Make it with all four paints: both slots start empty.
  const p = await mixerOnScreen(page);
  expect(p.form).toBe('make');
  await expect(mixerSlot(page, 1)).toHaveAccessibleName('Paint 1: empty');
  await expect(page.getByRole('group', { name: 'Paints' }).getByRole('button')).toHaveCount(4);
  for (let n = 0; n < 4; n++) await solveAndGoOn(page, n);

  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished every level!');
  await expect(dialog).toContainText('9 levels, 19 of 27 stars.');
  await expect(dialog.getByRole('link')).toHaveCount(1);
  await expect(dialog.getByRole('button')).toHaveCount(0);
  await dialog.getByRole('link', { name: 'Back to games' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(homeCard(page, 'Color Mixer')).toContainText('All done');

  await homeCard(page, 'Color Mixer').click();
  await expect(page).toHaveURL(/#\/game\/mixer$/);
  await expect(title(page)).toHaveText('Color Mixer');
  await expect(dots(page)).toHaveCount(0);
  const finished = levelCard(page);
  await expect(finished.getByRole('heading')).toHaveText('You finished every level!');
  await expect(finished.getByRole('img', { name: '19 of 27 stars' })).toBeVisible();
  await expect(finished).toContainText('A grown-up can pick a level to play again.');
  await expect(finished.getByRole('link', { name: 'Back to games' })).toBeFocused();
  // The empty slots and bowl sit behind the card, out of reach.
  await expect(page.locator('.mix-bowl')).toBeAttached();
  await expect(mixerSwatches(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/#\/$/);
  expect(hashOf(page)).toBe('#/');
});

/* ---------- The wrong mix cue (usability pass, mixer-pattern-3 and mixer-pattern-5) ---------- */

const wrongSlots = (page: Page) => page.locator('.mix-slot.is-wrong');

/** Starts recording whether any slot ever carries the wrong cue; the returned function reads the record. */
async function watchWrongCue(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __mixWrong: boolean; __mixWatch?: MutationObserver };
    w.__mixWrong = !!document.querySelector('.mix-slot.is-wrong');
    w.__mixWatch?.disconnect();
    w.__mixWatch = new MutationObserver(() => {
      if (document.querySelector('.mix-slot.is-wrong')) w.__mixWrong = true;
    });
    w.__mixWatch.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  });
  return () => page.evaluate(() => (window as unknown as { __mixWrong: boolean }).__mixWrong);
}

test('a wrong pair in Make it dims and tilts both slots for half a second, and a right pair never does', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seed(page, [{ id: 'leo', name: 'Leo', ageBand: '3-4', games: { mixer: { stars: starsUpTo(2) } } }]);
  await page.goto('/#/game/mixer/3');
  await expect(page).toHaveURL(/#\/game\/mixer\/3$/);
  const p = await mixerOnScreen(page);
  if (p.form !== 'make') throw new Error('Level 3 is Make it');
  const odd = p.shelf.find((x) => !p.pair.includes(x))!;

  // A wrong pair: both filled slots take the cue at once, tilted, then come back.
  await mixerPot(page, odd).click();
  await expect(wrongSlots(page)).toHaveCount(0);
  await mixerPot(page, p.pair[0]).click();
  await expect(wrongSlots(page)).toHaveCount(2, { timeout: 150 });
  await expect(wrongSlots(page).first()).not.toHaveCSS('transform', 'none');
  await page.waitForTimeout(700);
  await expect(wrongSlots(page)).toHaveCount(0, { timeout: 0 });

  // The right pair: a third tap starts a new pair, and nothing is marked wrong on the way to the solve.
  const sawWrong = await watchWrongCue(page);
  await mixerPot(page, p.pair[0]).click();
  await mixerPot(page, p.pair[1]).click();
  await expect(page.getByRole('button', { name: 'Next puzzle' })).toBeVisible();
  await page.waitForTimeout(600);
  expect(await sawWrong()).toBe(false);
});

test('with reduced motion the wrong cue only dims the slots', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, [{ id: 'leo', name: 'Leo', ageBand: '3-4' }]);
  await page.goto('/#/game/mixer');
  await expect(page).toHaveURL(/#\/game\/mixer\/1$/);
  const p = await mixerOnScreen(page);
  if (p.form !== 'finish') throw new Error('Level 1 is Finish the mix');

  await mixerPot(page, p.wrong[0]).click();
  await expect(wrongSlots(page)).toHaveCount(2);
  for (const slot of [wrongSlots(page).first(), wrongSlots(page).last()]) {
    await expect(slot).toHaveCSS('transform', 'none');
    await expect(slot).toHaveCSS('opacity', '0.5');
  }
});

test('tapping the same wrong pot again replays the wrong cue each time and stays one slip', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'leo', name: 'Leo', ageBand: '3-4' }]);
  await page.goto('/#/game/mixer');
  await expect(page).toHaveURL(/#\/game\/mixer\/1$/);
  const p = await mixerOnScreen(page);
  if (p.form !== 'finish') throw new Error('Level 1 is Finish the mix');
  const offer = page.getByRole('button', { name: 'New puzzle' });

  // Every tap is answered: the slots dim and tilt again. Only the first is a slip, so 3 taps (the offer's
  // count for ages 3 to 4) bring no offer.
  for (let i = 0; i < 3; i++) {
    await expect(wrongSlots(page)).toHaveCount(0);
    await mixerPot(page, p.wrong[0]).click();
    await expect(wrongSlots(page)).toHaveCount(2);
    await expect(mixerSlot(page, 2)).toHaveAccessibleName(`Paint 2: ${colorWord(p.wrong[0])}`);
    await expect(help(page)).toHaveText(`Not ${colorWord(p.goal)} yet. Try another paint.`);
  }
  await expect(wrongSlots(page)).toHaveCount(0);
  await expect(offer).toHaveCount(0);

  // The child finds the right paint after all: the three wrong taps were one slip on the card.
  await mixerPot(page, p.right).click();
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  for (let n = 1; n < 4; n++) await solveAndGoOn(page, n);
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog).toContainText('4 puzzles, 1 slip.');
});

/* ---------- The wrong mix cue: timing, when it goes, every band and the other sizes (review of batch K) ---------- */

/** CHOICE_WRONG_MS in src/games/kit/ChoiceRow.tsx (brief 7.2). That file pulls in kit.css, so the spec keeps its own copy. */
const WRONG_MS = 500;
const BANDS = ['3-4', '5-6', '7-8', '9-10'] as const;

/** Stop the clock flowing by itself, so the test moves time on exactly. */
async function pauseClock(page: Page) {
  // A second ahead, so the page's own time never passes it first; due timers fire once on the way.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
}

/** The cue count after the page has had real time to draw any change the clock's timers made. */
async function wrongSlotsNow(page: Page, n: number) {
  await page.waitForTimeout(100);
  await expect(wrongSlots(page)).toHaveCount(n, { timeout: 0 });
}

test('the wrong cue lasts 500 ms from the last wrong tap, so a repeat tap during it starts it over', { tag: '@phone-only' }, async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'leo', name: 'Leo', ageBand: '3-4' }]);
  await page.goto('/#/game/mixer');
  await expect(page).toHaveURL(/#\/game\/mixer\/1$/);
  const p = await mixerOnScreen(page);
  if (p.form !== 'finish') throw new Error('Level 1 is Finish the mix');
  await pauseClock(page);

  // The boundary: on at 499 ms, gone at 500 ms.
  await mixerPot(page, p.wrong[0]).click();
  await expect(wrongSlots(page)).toHaveCount(2);
  await page.clock.runFor(WRONG_MS - 1);
  await wrongSlotsNow(page, 2);
  await page.clock.runFor(1);
  await expect(wrongSlots(page)).toHaveCount(0);

  // A repeat tap 300 ms into the cue: the first tap's timer does not cut the second cue short.
  await mixerPot(page, p.wrong[0]).click();
  await expect(wrongSlots(page)).toHaveCount(2);
  await page.clock.runFor(300);
  await mixerPot(page, p.wrong[0]).click();
  await page.clock.runFor(WRONG_MS - 1);
  await wrongSlotsNow(page, 2);
  await page.clock.runFor(1);
  await expect(wrongSlots(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New puzzle' })).toHaveCount(0);
});

test('in Make it the cue goes at once when the pair changes, and the same paint twice or the right pair never takes it', { tag: '@phone-only' }, async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', games: { mixer: { stars: starsUpTo(2) } } }]);
  await page.goto('/#/game/mixer/3');
  await expect(page).toHaveURL(/#\/game\/mixer\/3$/);
  const p = await mixerOnScreen(page);
  if (p.form !== 'make') throw new Error('Level 3 is Make it');
  const odd = p.shelf.find((x) => !p.pair.includes(x))!;
  // The clock stands still from here, so a cue that is not taken away stays on screen.
  await pauseClock(page);

  // A wrong pair, then a tap on a filled slot: it empties, and the paint left in the other slot is not dimmed.
  await mixerPot(page, odd).click();
  await mixerPot(page, p.pair[0]).click();
  await expect(wrongSlots(page)).toHaveCount(2);
  await mixerSlot(page, 2).click();
  await expect(mixerSlot(page, 2)).toHaveAccessibleName('Paint 2: empty');
  await expect(wrongSlots(page)).toHaveCount(0);
  await expect(mixerSlot(page, 1)).toHaveAccessibleName(`Paint 1: ${colorWord(odd)}`);

  // The same wrong pair again, then a third paint: a new pair starts, and its first paint is not dimmed.
  await mixerPot(page, p.pair[0]).click();
  await expect(wrongSlots(page)).toHaveCount(2);
  await mixerPot(page, p.pair[1]).click();
  await expect(mixerSlot(page, 1)).toHaveAccessibleName(`Paint 1: ${colorWord(p.pair[1])}`);
  await expect(mixerSlot(page, 2)).toHaveAccessibleName('Paint 2: empty');
  await expect(wrongSlots(page)).toHaveCount(0);

  // The same paint twice is no slip: it teaches, and nothing is marked wrong.
  await mixerPot(page, p.pair[1]).click();
  await expect(resultText(page)).toHaveText('Same and same stays the same. Try two different paints.');
  await wrongSlotsNow(page, 0);

  // The right pair: a new pair, then the solve, with no cue on the way.
  await mixerPot(page, p.pair[0]).click();
  await mixerPot(page, p.pair[1]).click();
  await expect(page.getByRole('button', { name: 'Next puzzle' })).toBeVisible();
  await wrongSlotsNow(page, 0);
});

test('the cue belongs to its puzzle: a swap during it brings a puzzle with no slot marked wrong', { tag: '@phone-only' }, async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'leo', name: 'Leo', ageBand: '3-4' }]);
  await page.goto('/#/game/mixer');
  await expect(page).toHaveURL(/#\/game\/mixer\/1$/);
  const p = await mixerOnScreen(page);
  if (p.form !== 'finish') throw new Error('Level 1 is Finish the mix');
  await pauseClock(page);

  // Three wrong answers (a filled slot empties on a tap) bring the offer for ages 3 to 4, with the cue still on.
  const offer = page.getByRole('button', { name: 'New puzzle' });
  for (let i = 0; i < STUCK.mixer['3-4'].count; i++) {
    if (i) await mixerSlot(page, 2).click();
    await mixerPot(page, p.wrong[0]).click();
  }
  await expect(offer).toBeVisible();
  await expect(wrongSlots(page)).toHaveCount(2);

  // The new puzzle's given paint is a filled slot, and it is not dimmed: the cue stayed with the old puzzle.
  await offer.click();
  await expect(help(page)).toHaveText('Here is a different puzzle.');
  await expect(mixerSlot(page, 1)).toHaveAccessibleName(/^Paint 1: .+, given$/);
  await wrongSlotsNow(page, 0);
});

test('with the keyboard in Finish, a wrong paint takes the cue and the right paint right after it clears it before the next puzzle', { tag: '@phone-only' }, async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'sam', name: 'Sam', ageBand: '7-8' }]);
  await page.goto('/#/game/mixer');
  await expect(page).toHaveURL(/#\/game\/mixer\/1$/);
  const p = await mixerOnScreen(page);
  if (p.form !== 'finish') throw new Error('Level 1 is Finish the mix');
  await pauseClock(page);

  await mixerPot(page, p.wrong[0]).focus();
  await page.keyboard.press('Enter');
  await expect(wrongSlots(page)).toHaveCount(2);
  // Focus stays on the pot, and the names do not change while the slots are dimmed.
  await expect(mixerPot(page, p.wrong[0])).toBeFocused();
  await expect(mixerSlot(page, 1)).toHaveAccessibleName(`Paint 1: ${colorWord(p.given)}, given`);
  await expect(mixerSlot(page, 2)).toHaveAccessibleName(`Paint 2: ${colorWord(p.wrong[0])}`);

  await mixerPot(page, p.right).focus();
  await page.keyboard.press('Enter');
  await expect(help(page)).toHaveText(`You made ${colorWord(p.goal)}.`);
  await expect(wrongSlots(page)).toHaveCount(0);
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await expect(next).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await wrongSlotsNow(page, 0);
});

test('Guess dims the wrong colour, never the two given slots', { tag: '@phone-only' }, async ({ page }) => {
  await page.clock.install();
  await seed(page, [{ id: 'ana', name: 'Ana', ageBand: '9-10', games: { mixer: { stars: starsUpTo(1) } } }]);
  await page.goto('/#/game/mixer/2');
  await expect(page).toHaveURL(/#\/game\/mixer\/2$/);
  const p = await mixerOnScreen(page);
  if (p.form !== 'guess') throw new Error('Level 2 is Guess the mix');
  await pauseClock(page);

  const wrong = p.choices.find((c) => c !== RESULTS[p.answer].name)!;
  await mixerSwatches(page).getByRole('button', { name: wrong, exact: true }).click();
  await expect(page.locator('.bw-choice.is-wrong')).toHaveCount(1);
  await wrongSlotsNow(page, 0);
});

for (const band of BANDS) {
  test(`ages ${band}: every repeat tap on the wrong pot is answered, and repeats never bring the offer`, { tag: '@phone-only' }, async ({ page }) => {
    await page.clock.install();
    await seed(page, [{ id: 'kid', name: 'Kid', ageBand: band }]);
    await page.goto('/#/game/mixer');
    await expect(page).toHaveURL(/#\/game\/mixer\/1$/);
    const p = await mixerOnScreen(page);
    if (p.form !== 'finish') throw new Error('Level 1 is Finish the mix');
    await pauseClock(page);

    // One more tap than the band's offer count: if repeats fed the stuck count, the offer would show.
    for (let i = 0; i <= STUCK.mixer[band].count; i++) {
      await mixerPot(page, p.wrong[0]).click();
      await expect(wrongSlots(page)).toHaveCount(2);
      await expect(help(page)).toHaveText(`Not ${colorWord(p.goal)} yet. Try another paint.`);
      await page.clock.runFor(WRONG_MS);
      await expect(wrongSlots(page)).toHaveCount(0);
    }
    await expect(page.getByRole('button', { name: 'New puzzle' })).toHaveCount(0);
  });
}

const MORE_SIZES = [
  { name: 'iPhone 375 x 667', width: 375, height: 667 },
  { name: 'iPad landscape 1194 x 834', width: 1194, height: 834 },
];
for (const size of MORE_SIZES) {
  for (const reduce of [false, true]) {
    test(`${size.name}, ${reduce ? 'reduced motion: a wrong pair only dims' : 'full motion: a wrong pair dims and tilts'} both slots, inside the screen`, { tag: '@phone-only' }, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
      await page.clock.install();
      await seed(page, [{ id: 'leo', name: 'Leo', ageBand: '3-4', games: { mixer: { stars: starsUpTo(2) } } }]);
      await page.goto('/#/game/mixer/3');
      await expect(page).toHaveURL(/#\/game\/mixer\/3$/);
      const p = await mixerOnScreen(page);
      if (p.form !== 'make') throw new Error('Level 3 is Make it');
      const odd = p.shelf.find((x) => !p.pair.includes(x))!;
      await pauseClock(page);

      await mixerPot(page, odd).click();
      await mixerPot(page, p.pair[0]).click();
      await expect(wrongSlots(page)).toHaveCount(2);
      for (const slot of [wrongSlots(page).first(), wrongSlots(page).last()]) {
        await expect(slot).toHaveCSS('opacity', '0.5');
        if (reduce) await expect(slot).toHaveCSS('transform', 'none');
        else await expect(slot).toHaveCSS('transform', /^matrix\(/);
        await expect(slot).toBeInViewport({ ratio: 1 });
      }
      expect(await page.evaluate(() => document.scrollingElement!.scrollWidth)).toBeLessThanOrEqual(size.width);
      await expect(help(page)).toHaveText(`Not ${colorWord(p.goal)} yet. Try another pair.`);

      await page.clock.runFor(WRONG_MS);
      await expect(wrongSlots(page)).toHaveCount(0);
      await expect(mixerSlot(page, 1)).toHaveCSS('opacity', '1');
      await expect(mixerSlot(page, 1)).toHaveCSS('transform', 'none');
    });
  }
}
