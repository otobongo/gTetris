/**
 * Brick Calculator, usability round 2. Decision 7: the speaker reads the sum, then the help line on screen in spoken
 * form (the = key is "the green key"); speech comes only after a tap, and the visible lines do not change.
 * Decision 28: in a take-away sum the second number is --brick-blue-light, like the bricks it takes away; plus sums
 * keep it orange. Checked at 390x844, 375x667, 834x1194, 1194x834 and 844x390, ages 3 to 4 and 5 to 6, with the
 * sentences and the colour also checked at ages 7 to 8 and 9 to 10.
 */
import { expect, test, type Page } from '@playwright/test';
import { mathKey, mathOnScreen, recordSpeech, seed, sendMathAnswer, starsUpTo, type Band } from './app';

const help = (page: Page) => page.locator('.bw-helprow__line');
const speaker = (page: Page) => page.getByRole('button', { name: 'Hear the sum', exact: true });
const second = (page: Page) => page.locator('.calc-eq__b');

const SIZES = [
  { name: 'phone 390x844', width: 390, height: 844 },
  { name: 'small phone 375x667', width: 375, height: 667 },
  { name: 'tablet 834x1194', width: 834, height: 1194 },
  { name: 'tablet landscape 1194x834', width: 1194, height: 834 },
  { name: 'phone landscape 844x390', width: 844, height: 390 },
] as const;
const BANDS: readonly Band[] = ['3-4', '5-6'];
const ALL_BANDS: readonly Band[] = ['3-4', '5-6', '7-8', '9-10'];

const SLIP = 'Not quite. Count the bricks again.';
const FULL = 'Press = to check, or C to clear.';
const START = 'Count the bricks. Type the answer, then press =.';

async function openLevel(page: Page, band: Band, level: number) {
  await seed(page, [{ id: 'ada', name: 'Ada', ageBand: band, games: { math: { stars: starsUpTo(level - 1) } } }]);
  await page.goto(`/#/game/math/${level}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Level ${level}`);
  return mathOnScreen(page);
}

test.describe('decision 7: the speaker reads the help line on screen', () => {
  for (const size of SIZES)
    for (const band of BANDS) {
      test(`${size.name}, ages ${band}: slip, then a third digit, then solved`, { tag: '@phone-only' }, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        const spoken = await recordSpeech(page);
        const p = await openLevel(page, band, 1);
        await expect(help(page)).toHaveText(START);

        // A wrong answer: the slip line shows, and nothing more is said until the speaker is tapped.
        const wrong = (p.answer + 1) % 10;
        await sendMathAnswer(page, wrong, 'taps');
        await expect(help(page)).toHaveText(SLIP);
        const afterSlip = await spoken();
        expect(afterSlip).toEqual([String(wrong)]);
        await speaker(page).click();
        await expect.poll(spoken).toEqual([...afterSlip, `${SLIP} ${p.words}. How many?`]);
        await expect(help(page)).toHaveText(SLIP);

        // A third digit is ignored: the third-digit line shows, and the speaker reads it with the green key.
        await mathKey(page, '1').click();
        await mathKey(page, '2').click();
        await mathKey(page, '3').click();
        await expect(help(page)).toHaveText(FULL);
        const afterFull = await spoken();
        // The ignored third digit says nothing.
        expect(afterFull.slice(-2)).toEqual(['1', '12']);
        await speaker(page).click();
        await expect.poll(spoken).toEqual([...afterFull, `${p.words}. How many? Press the green key to check, or C to clear.`]);
        await expect(help(page)).toHaveText(FULL);

        // C, then the right answer: the speaker reads the solved line.
        await mathKey(page, 'Clear').click();
        await expect(help(page)).toHaveText(START);
        await sendMathAnswer(page, p.answer, 'taps');
        const solved = `${p.words} makes ${p.answer}.`;
        await expect(help(page)).toHaveText(solved);
        const afterSolve = await spoken();
        expect(afterSolve.at(-1)).toBe(solved);
        await speaker(page).click();
        await expect.poll(spoken).toEqual([...afterSolve, solved]);
      });
    }

  test('a take-away sum reads its slip sentence in the same words', { tag: '@phone-only' }, async ({ page }) => {
    const spoken = await recordSpeech(page);
    const p = await openLevel(page, '5-6', 5);
    expect(p.op).toBe('minus');
    await sendMathAnswer(page, (p.answer + 1) % 10, 'taps');
    await expect(help(page)).toHaveText(SLIP);
    await speaker(page).click();
    await expect.poll(async () => (await spoken()).at(-1)).toBe(`${SLIP} ${p.a} take away ${p.b}. How many?`);
  });

  /** Tap the speaker and return the one sentence that tap said. */
  async function heard(page: Page, spoken: () => Promise<string[]>, name = 'Hear the sum') {
    const before = (await spoken()).length;
    await page.getByRole('button', { name, exact: true }).click();
    await expect.poll(async () => (await spoken()).length).toBe(before + 1);
    return (await spoken()).at(-1);
  }

  for (const band of ['7-8', '9-10'] as const)
    test(`ages ${band}: the slip and third-digit sentences on a two-digit take away`, { tag: '@phone-only' }, async ({ page }) => {
      const spoken = await recordSpeech(page);
      const p = await openLevel(page, band, 8);
      await sendMathAnswer(page, (p.answer + 1) % 10, 'taps');
      await expect(help(page)).toHaveText(SLIP);
      expect(await heard(page, spoken)).toBe(`${SLIP} ${p.words}. How many?`);
      for (const d of ['1', '2', '3']) await mathKey(page, d).click();
      await expect(help(page)).toHaveText(FULL);
      expect(await heard(page, spoken)).toBe(`${p.words}. How many? Press the green key to check, or C to clear.`);
    });

  test('the speaker follows the line: a digit or C goes back to the sum, = with nothing typed keeps the slip', { tag: '@phone-only' }, async ({ page }) => {
    const spoken = await recordSpeech(page);
    const p = await openLevel(page, '5-6', 1);
    const question = `${p.words}. How many?`;
    expect(await heard(page, spoken)).toBe(question);

    await sendMathAnswer(page, (p.answer + 1) % 10, 'taps');
    await expect(help(page)).toHaveText(SLIP);
    // = with nothing typed changes nothing on screen, so the sentence stays too.
    await mathKey(page, 'Equals').click();
    await expect(help(page)).toHaveText(SLIP);
    expect(await heard(page, spoken)).toBe(`${SLIP} ${question}`);

    await mathKey(page, '1').click();
    await expect(help(page)).toHaveText(START);
    expect(await heard(page, spoken)).toBe(question);

    await mathKey(page, '2').click();
    await mathKey(page, '3').click();
    await expect(help(page)).toHaveText(FULL);
    await mathKey(page, 'Clear').click();
    await expect(help(page)).toHaveText(START);
    expect(await heard(page, spoken)).toBe(question);
  });

  test('C straight after a slip goes back to the sum as well', { tag: '@phone-only' }, async ({ page }) => {
    const spoken = await recordSpeech(page);
    const p = await openLevel(page, '5-6', 1);
    await sendMathAnswer(page, (p.answer + 1) % 10, 'taps');
    await expect(help(page)).toHaveText(SLIP);
    await mathKey(page, 'Clear').click();
    await expect(help(page)).toHaveText(START);
    expect(await heard(page, spoken)).toBe(`${p.words}. How many?`);
  });

  test('the physical keyboard gets the same sentences', { tag: '@phone-only' }, async ({ page }) => {
    const spoken = await recordSpeech(page);
    const p = await openLevel(page, '5-6', 1);
    await sendMathAnswer(page, (p.answer + 1) % 10, 'keys');
    await expect(help(page)).toHaveText(SLIP);
    expect(await heard(page, spoken)).toBe(`${SLIP} ${p.words}. How many?`);
    // The speaker keeps focus after the tap, and digits still reach the keypad from there.
    for (const d of ['1', '2', '3']) await page.keyboard.press(d);
    await expect(help(page)).toHaveText(FULL);
    expect(await heard(page, spoken)).toBe(`${p.words}. How many? Press the green key to check, or C to clear.`);
  });

  test('a slip stays with its own puzzle: after Next the speaker reads only the new sum', { tag: '@phone-only' }, async ({ page }) => {
    const spoken = await recordSpeech(page);
    const p = await openLevel(page, '5-6', 1);
    await sendMathAnswer(page, (p.answer + 1) % 10, 'taps');
    await expect(help(page)).toHaveText(SLIP);
    await sendMathAnswer(page, p.answer, 'taps');
    await expect(help(page)).toHaveText(`${p.words} makes ${p.answer}.`);
    expect(await heard(page, spoken)).toBe(`${p.words} makes ${p.answer}.`);
    await page.getByRole('button', { name: 'Next puzzle' }).click();
    const next = await mathOnScreen(page);
    await expect(help(page)).toHaveText(START);
    expect(await heard(page, spoken)).toBe(`${next.words}. How many?`);
  });

  test('the offer keeps its own line, and after New puzzle the speaker reads only the new sum', { tag: '@phone-only' }, async ({ page }) => {
    const spoken = await recordSpeech(page);
    const p = await openLevel(page, '3-4', 1);
    await sendMathAnswer(page, (p.answer + 1) % 10, 'taps');
    await expect(help(page)).toHaveText(SLIP);
    await sendMathAnswer(page, (p.answer + 2) % 10, 'taps');
    const offer = page.getByRole('button', { name: 'New puzzle' });
    await expect(offer).toBeVisible();
    const line = await help(page).innerText();
    expect(line).not.toBe(SLIP);
    expect(await heard(page, spoken, 'Read the help line aloud')).toBe(line);

    await offer.click();
    const swapped = await mathOnScreen(page);
    expect(await heard(page, spoken)).toBe(`${swapped.words}. How many?`);
  });

  test('the key the sentence names is the green one', { tag: '@phone-only' }, async ({ page }) => {
    await openLevel(page, '5-6', 1);
    await expect(mathKey(page, 'Equals')).toHaveCSS('background-image', 'linear-gradient(rgb(95, 224, 110), rgb(31, 181, 60))');
    await expect(mathKey(page, 'Clear')).toHaveText('C');
  });
});

test.describe('decision 28: the take-away number is blue', () => {
  // A child opens the level after their last finished one: Level 5 takes away, Level 1 adds, Level 9 mixes both.
  const CASES = [
    { level: 5, op: 'minus', colour: 'rgb(124, 192, 255)', what: 'blue on a take-away sum' },
    { level: 1, op: 'plus', colour: 'rgb(255, 171, 94)', what: 'orange on a plus sum' },
  ] as const;
  for (const size of SIZES)
    for (const c of CASES) {
      test(`${size.name}: ${c.what}`, { tag: '@phone-only' }, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        const p = await openLevel(page, '5-6', c.level);
        expect(p.op).toBe(c.op);
        // Measured with the real font.
        expect(await page.evaluate(async () => (await document.fonts.ready, document.fonts.check('800 46px "Baloo 2"')))).toBe(true);
        await expect(page.locator('.calc-eq')).toHaveAttribute('data-op', c.op);
        await expect(second(page)).toHaveCSS('color', c.colour);
        // The first number keeps its blue.
        await expect(page.locator('.calc-eq__a')).toHaveCSS('color', 'rgb(124, 192, 255)');
      });
    }

  for (const band of ALL_BANDS)
    for (const c of CASES)
      test(`ages ${band}: ${c.what}`, { tag: '@phone-only' }, async ({ page }) => {
        const p = await openLevel(page, band, c.level);
        expect(p.op).toBe(c.op);
        await expect(second(page)).toHaveCSS('color', c.colour);
      });

  test('on a mixed level each sum takes the colour of its own operation, solved or not', async ({ page }) => {
    await openLevel(page, '5-6', 9);
    const seen = new Set<string>();
    for (let n = 0; n < 2; n++) {
      const p = await mathOnScreen(page);
      seen.add(p.op);
      const colour = p.op === 'minus' ? 'rgb(124, 192, 255)' : 'rgb(255, 171, 94)';
      await expect(page.locator('.calc-eq')).toHaveAttribute('data-op', p.op);
      await expect(second(page)).toHaveCSS('color', colour);
      await sendMathAnswer(page, p.answer, 'taps');
      await expect(page.getByRole('img', { name: `${p.words} equals ${p.answer}`, exact: true })).toBeVisible();
      await expect(second(page)).toHaveCSS('color', colour);
      await page.getByRole('button', { name: 'Next puzzle' }).click();
    }
    // Plus and minus take turns there, so both colours were checked.
    expect([...seen].sort()).toEqual(['minus', 'plus']);
  });
});
