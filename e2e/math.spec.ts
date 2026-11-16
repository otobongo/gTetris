/**
 * Brick Calculator journeys (six-games brief 10.4): a new child plays Level 1 into Level 2 with the physical
 * keyboard; and a wrong answer slips and clears, then Break opens at Next once the daily limit is used up, and
 * the child resumes at the next unsolved puzzle after a grown-up adds time. The sum is read from the equation's
 * accessible name (brief 9.2) and the answer is typed, on the keyboard or the keypad.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  dots,
  homeCard,
  levelCard,
  mathKey,
  mathKeypad,
  mathOnScreen,
  passGrownUpCheck,
  recordSpeech,
  savedGame,
  savedRun,
  seed,
  sendMathAnswer,
  solveMathPuzzle,
} from './app';

const help = (page: Page) => page.locator('.bw-helprow__line');
const title = (page: Page) => page.getByRole('heading', { level: 1 });
const answerPlace = (page: Page) => page.locator('.calc-eq__answer');

/** Solve the sum on screen, then tap Next puzzle unless it was the fourth; focus lands on the 7 key. */
async function solveAndGoOn(page: Page, solvedBefore: number, how: 'keys' | 'taps') {
  await solveMathPuzzle(page, how);
  if (solvedBefore + 1 >= 4) return;
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 1} of 4. ${solvedBefore + 1} solved.`);
  const next = page.getByRole('button', { name: 'Next puzzle' });
  await expect(next).toBeFocused();
  if (how === 'keys') await page.keyboard.press('Enter');
  else await next.click();
  await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${solvedBefore + 2} of 4. ${solvedBefore + 1} solved.`);
  await expect(mathKey(page, '7')).toBeFocused();
}

// The journey in brief 10.4 types every sum on the physical keyboard. After Next, focus is on the 7 key (9.1), and
// Enter there still acts as = (4.5, 9.2): it sends the typed answer and does not press the focused 7.
test('a new child plays Brick Calculator Level 1 on the physical keyboard and goes straight into Level 2', async ({ page }) => {
  const spoken = await recordSpeech(page);
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/');
  const card = homeCard(page, 'Brick Calculator');
  await expect(card).toContainText('Level 1');
  await expect(card).not.toContainText('Coming soon');
  await card.click();
  await expect(page).toHaveURL(/#\/game\/math\/1$/);
  await expect(title(page)).toHaveText('Level 1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  await expect(help(page)).toHaveText('Count the bricks. Type the answer, then press =.');
  await expect(mathKeypad(page).getByRole('button')).toHaveCount(12);

  // The bricks show the sum: a blue bricks and b orange ones.
  const p = await mathOnScreen(page);
  expect(p.op).toBe('plus');
  const bricks = (n: number, c: string) => `${n} ${c} ${n === 1 ? 'brick' : 'bricks'}`;
  await expect(page.getByRole('img', { name: `${bricks(p.a, 'blue')} and ${bricks(p.b, 'orange')}`, exact: true })).toBeVisible();

  // Typed digits show and are said; Backspace clears; Enter sends the answer.
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await expect(answerPlace(page)).toHaveText('12');
  await page.keyboard.press('3');
  await expect(answerPlace(page)).toHaveText('12');
  await expect(help(page)).toHaveText('Press = to check, or C to clear.');
  await page.keyboard.press('Backspace');
  await expect(answerPlace(page)).toHaveText('?');
  await sendMathAnswer(page, p.answer, 'keys');
  const solvedLine = `${p.words} makes ${p.answer}.`;
  await expect(help(page)).toHaveText(solvedLine);
  await expect(answerPlace(page)).toHaveText(String(p.answer));
  await expect(page.locator('.calc-count')).toHaveText(`Count them: ${p.answer}`);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  await expect.poll(spoken).toEqual(['1', '12', ...[...String(p.answer)].map((_, k) => String(Number(String(p.answer).slice(0, k + 1)))), solvedLine]);

  // Enter on the focused Next puzzle presses Next only; focus goes to the 7 key.
  await expect(page.getByRole('button', { name: 'Next puzzle' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await expect(answerPlace(page)).toHaveText('?');
  await expect(mathKey(page, '7')).toBeFocused();
  for (let n = 1; n < 4; n++) await solveAndGoOn(page, n, 'keys');

  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog).toContainText('4 puzzles, no slips.');
  await expect(dialog.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Play Level 2' })).toBeFocused();
  expect((await savedGame(page, 'math'))?.stars['0']).toBe(3);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/#\/game\/math\/2$/);
  await expect(title(page)).toHaveText('Level 2');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  expect((await savedRun(page, 'math', 1)).set).toBe('math:1:5-6');
  const level2 = await mathOnScreen(page);
  expect(level2.op).toBe('plus');
});

test('a wrong answer slips and clears; Break opens at Next once the limit is used up, and the child resumes after extra time', { tag: '@phone-only' }, async ({ page }) => {
  await page.clock.install();
  const spoken = await recordSpeech(page);
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', dailyLimit: 20, minutesToday: 15 }]);
  await page.goto('/#/game/math');
  await expect(page).toHaveURL(/#\/game\/math\/1$/);

  // A wrong answer: the wrong sound, the slip line, the entry cleared, and nothing said or shown of the answer.
  const p = await mathOnScreen(page);
  const wrong = p.answer + 1;
  await sendMathAnswer(page, wrong, 'taps');
  await expect(help(page)).toHaveText('Not quite. Count the bricks again.');
  await expect(answerPlace(page)).toHaveText('?');
  await expect(page.getByRole('img', { name: `${p.words} equals what?`, exact: true })).toBeVisible();
  await expect(page.locator('.calc-count')).toHaveCount(0);
  expect(await spoken()).toEqual([...String(wrong)].map((_, k) => String(Number(String(wrong).slice(0, k + 1)))));
  // = with nothing typed does nothing.
  await mathKey(page, 'Equals').click();
  await expect(help(page)).toHaveText('Not quite. Count the bricks again.');
  // Then the right answer.
  await sendMathAnswer(page, p.answer, 'taps');
  await expect(help(page)).toHaveText(`${p.words} makes ${p.answer}.`);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  const next = page.getByRole('button', { name: 'Next puzzle' });

  // The limit runs out while the child looks at the solved sum: nothing cuts the screen off.
  await page.clock.runFor(6 * 60_000);
  await expect(next).toBeVisible();
  await expect(page).toHaveURL(/#\/game\/math\/1$/);

  await next.click();
  await expect(page).toHaveURL(/#\/break$/);
  await expect(page.getByRole('heading', { name: 'Time for a break, Maya' })).toBeVisible();
  await expect(page.locator('.sc-saved')).toHaveText('Level 1 is saved with 1 of 4 puzzles solved.');

  await page.getByRole('button', { name: 'Grown-ups: add time' }).click();
  await passGrownUpCheck(page);
  await expect(page.getByRole('heading', { name: 'Add time for Maya today' })).toBeVisible();
  await page.getByRole('button', { name: 'Add 10 minutes' }).click();

  // Back on the level, at the next unsolved puzzle, which then plays as usual.
  await expect(page).toHaveURL(/#\/game\/math\/1$/);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await expect(answerPlace(page)).toHaveText('?');
  await solveMathPuzzle(page, 'taps');
  const run = await savedRun(page, 'math', 0);
  expect(run.solved).toHaveLength(2);
  // The wrong answer on puzzle 1 counted as one slip.
  expect(run.solved[0].count).toBe(1);
  expect(run.solved[1].count).toBe(0);
});

test('after tapping keys on the keypad, Enter on the physical keyboard sends the answer, not the tapped key', { tag: '@phone-only' }, async ({ page }) => {
  const spoken = await recordSpeech(page);
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/math/1');
  const p = await mathOnScreen(page);
  const digits = String(p.answer);
  for (const d of digits) await mathKey(page, d).click();
  // The last tapped key keeps focus; Enter there acts as =.
  await expect(mathKey(page, digits[digits.length - 1])).toBeFocused();
  await page.keyboard.press('Enter');
  const solvedLine = `${p.words} makes ${p.answer}.`;
  await expect(help(page)).toHaveText(solvedLine);
  await expect(answerPlace(page)).toHaveText(digits);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  await expect.poll(spoken).toEqual([...[...digits].map((_, k) => String(Number(digits.slice(0, k + 1)))), solvedLine]);
});

/* ---------- A wrong answer stays in view for a moment (usability batch L) ---------- */
// With Sounds off, a wrong = must still be told apart from a missed tap where the child is looking: the sent
// number stays in the answer place in the wrong look for about 500 ms, then the "?" comes back. The entry is
// already cleared underneath, so the next digit replaces the wrong look at once and = during it does nothing.
// The right answer is never shown (brief 4.5).

/** Band 3 to 4 opens Level 1 with the sum on screen. */
async function openLevel1For3To4(page: Page) {
  await seed(page, [{ id: 'ada', name: 'Ada', ageBand: '3-4' }]);
  await page.goto('/#/game/math/1');
  await expect(page).toHaveURL(/#\/game\/math\/1$/);
  return mathOnScreen(page);
}

/** A one-digit wrong answer for a Level 1 sum at 3 to 4 (answers 0 to 5), different for each `step` from 1 to 4. */
const wrongFor = (answer: number, step = 1) => (answer + step) % 10;

test('a wrong answer shows in the wrong look for a moment, then the "?" comes back', async ({ page }) => {
  const p = await openLevel1For3To4(page);
  const wrong = wrongFor(p.answer);
  await sendMathAnswer(page, wrong, 'taps');
  // Within 100 ms: the sent number, in the wrong look. The sum's name still waits for the answer.
  await expect(answerPlace(page)).toHaveAttribute('data-look', 'wrong', { timeout: 100 });
  await expect(answerPlace(page)).toHaveText(String(wrong), { timeout: 100 });
  await expect(page.getByRole('img', { name: `${p.words} equals what?`, exact: true })).toBeVisible();
  // After 700 ms: the start look again.
  await page.waitForTimeout(700);
  await expect(answerPlace(page)).toHaveAttribute('data-look', 'empty', { timeout: 100 });
  await expect(answerPlace(page)).toHaveText('?', { timeout: 100 });
});

test('a digit typed during the wrong look replaces it at once', async ({ page }) => {
  const p = await openLevel1For3To4(page);
  const wrong = wrongFor(p.answer);
  await sendMathAnswer(page, wrong, 'taps');
  await page.waitForTimeout(200);
  await expect(answerPlace(page)).toHaveAttribute('data-look', 'wrong', { timeout: 100 });
  const digit = String((wrong + 1) % 10);
  await mathKey(page, digit).click();
  await expect(answerPlace(page)).toHaveAttribute('data-look', 'typed', { timeout: 100 });
  await expect(answerPlace(page)).toHaveText(digit, { timeout: 100 });
  // The wrong look's timer does not come back over the typed digit.
  await page.waitForTimeout(500);
  await expect(answerPlace(page)).toHaveAttribute('data-look', 'typed', { timeout: 100 });
  await expect(answerPlace(page)).toHaveText(digit, { timeout: 100 });
});

test('= during the wrong look does nothing and adds no slip: two wrong answers still bring New puzzle at 3 to 4', async ({ page }) => {
  const p = await openLevel1For3To4(page);
  const offer = page.getByRole('button', { name: 'New puzzle' });
  const first = wrongFor(p.answer, 1);
  await sendMathAnswer(page, first, 'taps');
  await expect(answerPlace(page)).toHaveAttribute('data-look', 'wrong', { timeout: 100 });
  // = while the sent number still shows: the wrong look stays, and no second slip brings the offer.
  await mathKey(page, 'Equals').click();
  await expect(answerPlace(page)).toHaveAttribute('data-look', 'wrong', { timeout: 100 });
  await expect(answerPlace(page)).toHaveText(String(first), { timeout: 100 });
  await page.waitForTimeout(700);
  await expect(answerPlace(page)).toHaveAttribute('data-look', 'empty', { timeout: 100 });
  await expect(offer).toHaveCount(0);
  // The second wrong answer is the one that reaches the limit of 2.
  await sendMathAnswer(page, wrongFor(p.answer, 2), 'taps');
  await expect(offer).toBeVisible();
  // Two slips on this puzzle, no more.
  await solveMathPuzzle(page, 'taps');
  expect((await savedRun(page, 'math', 0)).solved[0].count).toBe(2);
});

test('with reduced motion the wrong answer only fades, with no shift', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const p = await openLevel1For3To4(page);
  await sendMathAnswer(page, wrongFor(p.answer), 'taps');
  await expect(answerPlace(page)).toHaveAttribute('data-look', 'wrong', { timeout: 100 });
  expect(await answerPlace(page).evaluate((el) => getComputedStyle(el).transform)).toBe('none');
});

test.describe('with motion allowed', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the wrong answer shifts left, dimmed in the error colour, as a Choice row answer does', async ({ page }) => {
    const p = await openLevel1For3To4(page);
    await sendMathAnswer(page, wrongFor(p.answer), 'taps');
    await expect(answerPlace(page)).toHaveAttribute('data-look', 'wrong', { timeout: 100 });
    const look = () =>
      answerPlace(page).evaluate((el) => {
        const s = getComputedStyle(el);
        // --bw-error-text, resolved to rgb by a probe next to the answer.
        const probe = document.createElement('span');
        probe.style.color = 'var(--bw-error-text)';
        el.parentElement!.appendChild(probe);
        const error = getComputedStyle(probe).color;
        probe.remove();
        return { shifted: new DOMMatrixReadOnly(s.transform).m41 < -3, errorColour: s.color === error, dimmed: Number(s.opacity) < 0.75 };
      });
    await expect.poll(look, { intervals: [20], timeout: 450 }).toEqual({ shifted: true, errorColour: true, dimmed: true });
  });
});
