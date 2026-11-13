/**
 * Letter Builder's practice Level 1 for ages 3 to 4 (user decision of 13 November 2026): the child first
 * learns to move and drop the letters. Any tray letter dragged onto the train goes into its own place, in
 * whatever order and wherever on the row it is let go, so it is never wrong and never a slip. A pointer tap
 * says the letter and asks for a drag instead of placing it; Enter, Space and the letter keys still place
 * one (keyboard and switch users cannot drag). Ages 5 and up, and Level 2 on for 3 to 4, keep the order rule.
 * The rules themselves are unit-tested in src/games/letters/practice.test.ts; these drive the screen.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { letterName } from '../src/shared/speech';
import {
  dots,
  editSavedInAnotherTab,
  levelCard,
  lettersAnswer,
  pointerDrag,
  recordSpeech,
  savedGame,
  savedRun,
  savedState,
  seed,
  solveLettersPuzzle,
  starsUpTo,
  type Band,
  type GameSeed,
} from './app';

const NOT_THAT_ONE = 'Not that one. Try again.';

const help = (page: Page) => page.locator('.lb-help');
const tray = (page: Page) => page.locator('.lb-tray');
const trayTile = (page: Page, ch: string) => tray(page).getByRole('button', { name: ch, exact: true });
/** One place of the answer row, by its position (0 is the first). */
const place = (page: Page, i: number) => page.getByRole('list', { name: 'Your answer' }).getByRole('listitem').nth(i);
const offer = (page: Page) => page.getByRole('button', { name: 'New puzzle' });

/** What the answer row holds, place by place: the letter on a placed brick, or null for a place still empty. */
async function row(page: Page): Promise<(string | null)[]> {
  return page
    .getByRole('list', { name: 'Your answer' })
    .getByRole('listitem')
    .evaluateAll((items) =>
      items.map((li) => (li.querySelector('.lb-slot') ? null : (li.querySelector('.lb-brick__ch')?.textContent ?? '').trim() || null)),
    );
}

const empty = (answer: string[]) => answer.map(() => null);

/** Open Letter Builder for one child at their current level and wait for the tray. */
async function open(page: Page, ageBand: Band, games?: Record<string, GameSeed>) {
  await seed(page, [{ id: 'leo', name: 'Leo', ageBand, games }]);
  await page.goto('/#/game/letters');
  await expect(tray(page).getByRole('button').first()).toBeVisible();
}

/** Drag a tray letter and let go over `over`; then the row should hold `expected`. */
async function dropOn(page: Page, ch: string, over: Locator, expected: (string | null)[]) {
  await pointerDrag(page, trayTile(page, ch), over);
  await expect.poll(() => row(page)).toEqual(expected);
  await expect(trayTile(page, ch)).toHaveCount(0);
  await expect(help(page)).not.toContainText('Not that one');
}

/** Stop the clock flowing by itself, so the test moves time on exactly. */
async function pauseClock(page: Page) {
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
}

test('ages 3 to 4 on Level 1: a letter dragged anywhere on the train goes to its own place, and the level has no slips', async ({ page }) => {
  await open(page, '3-4');
  await expect(page).toHaveURL(/#\/game\/letters\/1$/);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');

  for (let n = 0; n < 4; n++) {
    const instruction = ((await help(page).textContent()) ?? '').trim();
    const answer = await lettersAnswer(page);
    expect(answer).toHaveLength(4);
    const [a, b, c, d] = answer;

    // The last letter first, let go over the first place: it goes to its own place, the last.
    await dropOn(page, d, place(page, 0), [null, null, null, d]);
    // The rest out of order, each let go over some other place, filled or empty.
    await dropOn(page, b, place(page, 3), [null, b, null, d]);
    await dropOn(page, a, place(page, 2), [a, b, null, d]);
    // Three drops out of order are no slips: at ages 3 to 4 three slips would bring the offer.
    await expect(offer(page)).toHaveCount(0);
    await dropOn(page, c, place(page, 0), [a, b, c, d]);
    // The puzzle's help line told the child to drag.
    expect(instruction).toMatch(/drag/i);

    // Solved as today: the row is in order, the solved line shows and Next takes the tray's place.
    await expect(help(page)).toHaveText(`${a} to ${d}, all in order.`);
    if (n === 3) break;
    await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${n + 1} of 4. ${n + 1} solved.`);
    expect((await savedRun(page, 'letters', 0)).solved.map((r) => r.count)).toEqual(Array(n + 1).fill(0));
    const next = page.getByRole('button', { name: 'Next puzzle' });
    await expect(next).toBeFocused();
    await next.click();
    await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${n + 2} of 4. ${n + 1} solved.`);
  }

  // Four puzzles with no slips and no hint: 3 stars, as the usual rule gives.
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog).toContainText('4 puzzles, no slips.');
  await expect(dialog.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  expect((await savedGame(page, 'letters'))?.stars['0']).toBe(3);
});

test('ages 3 to 4 on Level 1: a tap says the letter and asks for a drag, and places nothing', async ({ page }) => {
  const spoken = await recordSpeech(page);
  await open(page, '3-4');
  const answer = await lettersAnswer(page);
  const instruction = ((await help(page).textContent()) ?? '').trim();

  /** The help line swaps the instruction for a short note about dragging. */
  const dragNote = async () => {
    await expect(help(page)).not.toHaveText(instruction);
    await expect(help(page)).toHaveText(/drag/i);
    await expect(help(page)).not.toContainText('Not that one');
  };

  // A tap on the letter that comes first, which the order rule would put in: it stays in the tray.
  await trayTile(page, answer[0]).click();
  await dragNote();
  await expect(trayTile(page, answer[0])).toBeVisible();
  expect(await row(page)).toEqual(empty(answer));
  expect(await spoken()).toContain(letterName(answer[0]));

  // Taps on a letter out of order are not slips either: three would bring the offer at ages 3 to 4.
  const last = answer[answer.length - 1];
  for (let i = 0; i < 3; i++) await trayTile(page, last).click();
  await dragNote();
  await expect(offer(page)).toHaveCount(0);
  expect(await spoken()).toContain(letterName(last));

  // A finger tap does the same.
  await trayTile(page, answer[1]).tap();
  await dragNote();
  await expect(trayTile(page, answer[1])).toBeVisible();
  expect(await row(page)).toEqual(empty(answer));
  await expect(tray(page).getByRole('button')).toHaveCount(answer.length);

  // Built with the letter keys, the puzzle counts no slips: none of the taps was one.
  await solveLettersPuzzle(page);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  expect((await savedRun(page, 'letters', 0)).solved.map((r) => r.count)).toEqual([0]);
  // The puzzle's own help line asks for a drag too.
  expect(instruction).toMatch(/drag/i);
});

test('ages 3 to 4 on Level 1: a tap is not progress, so the time signal still brings the offer', async ({ page }) => {
  await page.clock.install();
  await open(page, '3-4');
  await pauseClock(page);
  const answer = await lettersAnswer(page);

  // 20 s, a tap on the first letter (which places nothing), then 11 s more: 31 s with no progress.
  await page.clock.runFor(20_000);
  await trayTile(page, answer[0]).click();
  await page.clock.runFor(100);
  expect(await row(page)).toEqual(empty(answer));
  await page.clock.runFor(11_000);
  await expect(offer(page)).toBeVisible();
  await expect(help(page)).toHaveText('This one is tricky. Want a different puzzle?');

  // A drop is progress: the offer hides.
  await pointerDrag(page, trayTile(page, answer[2]), place(page, 0));
  await expect(offer(page)).toHaveCount(0);
  expect(await row(page)).toEqual([null, null, answer[2], null]);
});

test('ages 3 to 4 on Level 1: Enter, Space and the letter keys still place a letter, in its own place', async ({ page }) => {
  await open(page, '3-4');
  const answer = await lettersAnswer(page);
  const [a, b, c, d] = answer;

  // Enter on the last letter, out of order: keyboard and switch users cannot drag, so it goes in.
  await trayTile(page, d).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => row(page)).toEqual([null, null, null, d]);
  await expect(help(page)).not.toContainText('Not that one');

  // Space on another one out of order.
  await trayTile(page, c).focus();
  await page.keyboard.press(' ');
  await expect.poll(() => row(page)).toEqual([null, null, c, d]);

  // A letter key out of order, then the first letter: solved.
  await page.keyboard.press(b);
  await expect.poll(() => row(page)).toEqual([null, b, c, d]);
  await expect(help(page)).not.toContainText('Not that one');
  await expect(offer(page)).toHaveCount(0);
  await page.keyboard.press(a);
  await expect.poll(() => row(page)).toEqual(answer);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  await expect(page.getByRole('button', { name: 'Next puzzle' })).toBeFocused();
  expect((await savedRun(page, 'letters', 0)).solved.map((r) => r.count)).toEqual([0]);
});

test('ages 3 to 4 on Level 1: a letter let go off the train goes back to the tray, and nothing counts', async ({ page }) => {
  await open(page, '3-4');
  const answer = await lettersAnswer(page);
  const instruction = ((await help(page).textContent()) ?? '').trim();

  // Let go over the picture: back in the tray, where it was.
  const first = trayTile(page, answer[0]);
  const home = (await first.boundingBox())!;
  await pointerDrag(page, first, page.locator('.lb-picture--label'));
  await expect(first).toBeVisible();
  await expect(first).not.toHaveClass(/is-dragging/);
  const back = (await first.boundingBox())!;
  expect(Math.abs(back.x - home.x)).toBeLessThan(2);
  expect(Math.abs(back.y - home.y)).toBeLessThan(2);

  // Let go over the tray well, on another letter.
  const last = answer[answer.length - 1];
  await pointerDrag(page, trayTile(page, last), trayTile(page, answer[1]));
  await expect(trayTile(page, last)).toBeVisible();

  expect(await row(page)).toEqual(empty(answer));
  await expect(help(page)).toHaveText(instruction);
  await expect(tray(page).getByRole('button')).toHaveCount(answer.length);

  // The hint still points at one letter.
  await page.getByRole('button', { name: 'Hint (3)' }).click();
  await expect(page.getByRole('button', { name: 'Hint (2)' })).toBeVisible();
  await expect(tray(page).locator('button.is-hint')).toHaveCount(1);

  // Dragged onto the train, the letters build the puzzle; the drops that missed were no slips.
  for (let i = 0; i < answer.length; i++) {
    await pointerDrag(page, trayTile(page, answer[i]), place(page, i));
    await expect.poll(async () => (await row(page))[i]).toBe(answer[i]);
  }
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  expect((await savedRun(page, 'letters', 0)).solved.map((r) => r.count)).toEqual([0]);
});

test('ages 3 to 4 on Level 1 with motion on: a dropped letter flies to its own place and the puzzle is solved', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await open(page, '3-4');
  const answer = await lettersAnswer(page);
  const [a, b, c, d] = answer;

  await dropOn(page, d, place(page, 0), [null, null, null, d]);
  await dropOn(page, a, place(page, 3), [a, null, null, d]);
  await dropOn(page, c, place(page, 1), [a, null, c, d]);
  await dropOn(page, b, place(page, 2), answer);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  await expect(page.getByRole('button', { name: 'Next puzzle' })).toBeFocused();
  // Nothing is left mid-flight in the tray well.
  await expect(tray(page)).toHaveCount(0);
});

test('ages 5 to 6 on Level 1 keep the order rule: a letter out of order is not that one', async ({ page }) => {
  await open(page, '5-6');
  await expect(page).toHaveURL(/#\/game\/letters\/1$/);
  const answer = await lettersAnswer(page);
  const last = answer[answer.length - 1];
  await expect(help(page)).toHaveText(`Tap ${answer[0]} to ${last} in order.`);

  // Even let go over its own place, the last letter is out of order.
  await pointerDrag(page, trayTile(page, last), place(page, answer.length - 1));
  await expect(help(page)).toHaveText(NOT_THAT_ONE);
  await expect(trayTile(page, last)).toBeVisible();
  expect(await row(page)).toEqual(empty(answer));

  // A tap on the next letter still puts it in.
  await trayTile(page, answer[0]).click();
  await expect.poll(() => row(page)).toEqual([answer[0], ...empty(answer).slice(1)]);
  await solveLettersPuzzle(page);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  expect((await savedRun(page, 'letters', 0)).solved.map((r) => r.count)).toEqual([1]);
});

test('ages 3 to 4 on Level 2 keep the order rule: a letter out of order is not that one', async ({ page }) => {
  await open(page, '3-4', { letters: { stars: starsUpTo(1) } });
  await expect(page).toHaveURL(/#\/game\/letters\/2$/);
  const answer = await lettersAnswer(page);
  const last = answer[answer.length - 1];
  await expect(help(page)).toHaveText(`Tap ${answer[0]} to ${last} in order.`);

  await pointerDrag(page, trayTile(page, last), place(page, 0));
  await expect(help(page)).toHaveText(NOT_THAT_ONE);
  await expect(trayTile(page, last)).toBeVisible();
  expect(await row(page)).toEqual(empty(answer));

  // A tap on the next letter still puts it in.
  await trayTile(page, answer[0]).click();
  await expect.poll(() => row(page)).toEqual([answer[0], ...empty(answer).slice(1)]);
});

test('a move to ages 3 to 4 mid-puzzle keeps the order rule until the next puzzle, which is practice', async ({ page }) => {
  await open(page, '5-6');
  let answer = await lettersAnswer(page);

  await editSavedInAnotherTab(page, (state) => {
    state.players[0].ageBand = '3-4';
  });
  await expect.poll(async () => (await savedState(page)).players[0].ageBand).toBe('3-4');
  await page.waitForTimeout(300);

  // The puzzle on screen keeps the band it started with.
  await pointerDrag(page, trayTile(page, answer[answer.length - 1]), place(page, 0));
  await expect(help(page)).toHaveText(NOT_THAT_ONE);
  expect(await row(page)).toEqual(empty(answer));
  await solveLettersPuzzle(page);
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');

  // The next puzzle is practice: any letter dragged onto the train goes to its own place.
  answer = await lettersAnswer(page);
  const instruction = ((await help(page).textContent()) ?? '').trim();
  const [a, b, c, d] = answer;
  await dropOn(page, d, place(page, 0), [null, null, null, d]);
  await dropOn(page, b, place(page, 0), [null, b, null, d]);
  await dropOn(page, c, place(page, 0), [null, b, c, d]);
  await dropOn(page, a, place(page, 3), answer);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 2 solved.');
  expect(instruction).toMatch(/drag/i);
});
