/**
 * Round 2 of the usability pass, the kit's shared play frame in a real browser:
 * - Decision 20: with Voice off no kit game shows a speaker (it would say nothing), the title stays
 *   centred, and turning Voice on in Settings brings the speaker back on the next screen.
 * - Decision 38: under Reduce Motion a wrong choice in Pattern Train fades over 150 ms.
 * Every layout check runs with the app's own font (Baloo 2), never a fallback.
 */
import { expect, test, type Page } from '@playwright/test';
import { openSettings, patternCar, patternOnScreen, seed, STORAGE_KEY } from './app';

const KIT_GAMES = ['mixer', 'sorter', 'pattern', 'numbers', 'builder', 'math'] as const;

/** The seed has Voice on; this turns it off once, before the app's first load in this tab. */
async function seedVoiceOff(page: Page) {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.addInitScript((key) => {
    if (sessionStorage.getItem('e2e-voice-off')) return;
    sessionStorage.setItem('e2e-voice-off', '1');
    const state = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!state) return;
    state.settings.voice = false;
    localStorage.setItem(key, JSON.stringify(state));
  }, STORAGE_KEY);
}

const speakers = (page: Page) => page.getByRole('button', { name: /^(Hear the |Read the help line aloud)/ });

/** The h1's centre and the top bar's centre, in CSS px. */
async function titleCentre(page: Page) {
  return page.locator('.bw-topbar').evaluate((bar) => {
    const h1 = bar.querySelector('h1')!.getBoundingClientRect();
    const b = bar.getBoundingClientRect();
    return { title: h1.left + h1.width / 2, bar: b.left + b.width / 2 };
  });
}

/** The app's own font has loaded (a fallback would measure differently). The app ships 600, 700 and 800 only; the h1 is 800. */
async function realFont(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('800 16px "Baloo 2"')))).toBe(true);
}

test.describe('decision 20: no speaker while Voice is off', () => {
  test('Color Mixer Level 1: no speaker, the title stays centred, and Voice on in Settings brings it back', async ({ page }) => {
    await seedVoiceOff(page);
    await page.goto('/#/game/mixer/1');
    await expect(page.getByRole('heading', { level: 1, name: 'Level 1' })).toBeVisible();
    await realFont(page);
    await expect(speakers(page)).toHaveCount(0);
    // the right cell is the empty slot the top bar already draws
    await expect(page.locator('.bw-topbar > :last-child')).toHaveAttribute('aria-hidden', 'true');
    const off = await titleCentre(page);
    expect(Math.abs(off.title - off.bar)).toBeLessThanOrEqual(1);

    await openSettings(page);
    const voice = page.getByRole('switch', { name: /^Voice/ });
    await expect(voice).toHaveAttribute('aria-checked', 'false');
    await voice.click();
    await expect(voice).toHaveAttribute('aria-checked', 'true');

    await page.goto('/#/game/mixer/1');
    await expect(page.getByRole('button', { name: /^Hear the / })).toBeVisible();
    await realFont(page);
    const on = await titleCentre(page);
    expect(Math.abs(on.title - off.title)).toBeLessThanOrEqual(1);
  });

  test('no kit game shows a speaker with Voice off, and the stuck offer brings none either', async ({ page }) => {
    await seedVoiceOff(page);
    for (const id of KIT_GAMES) {
      await page.goto(`/#/game/${id}/1`);
      await expect(page.getByRole('heading', { level: 1, name: 'Level 1' })).toBeVisible();
      await expect(speakers(page), id).toHaveCount(0);
    }
    // Pattern Train at 5 to 6: three wrong cars bring the offer, still with no speaker
    await page.goto('/#/game/pattern/1');
    const p = await patternOnScreen(page);
    for (let i = 0; i < 3; i++) await patternCar(page, p.wrong[i % p.wrong.length]).click();
    await expect(page.getByRole('button', { name: 'New puzzle' })).toBeVisible();
    await expect(speakers(page)).toHaveCount(0);
  });
});

/* The other sizes the games ship at: the small phone, the iPad on its side and the iPhone on its side. */
for (const { width, height } of [
  { width: 375, height: 667 },
  { width: 1194, height: 834 },
  { width: 844, height: 390 },
]) {
  test.describe(`decision 20 at ${width} x ${height}`, () => {
    test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });

    test('Voice off: no kit game shows a speaker, the title stays centred and the page never scrolls sideways', { tag: '@phone-only' }, async ({ page }) => {
      await seedVoiceOff(page);
      for (const id of KIT_GAMES) {
        await page.goto(`/#/game/${id}/1`);
        await expect(page.getByRole('heading', { level: 1, name: 'Level 1' })).toBeVisible();
        await realFont(page);
        await expect(speakers(page), id).toHaveCount(0);
        const { title, bar } = await titleCentre(page);
        expect(Math.abs(title - bar), id).toBeLessThanOrEqual(1);
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        expect(sideways, id).toBeLessThanOrEqual(0);
      }
    });
  });
}

test.describe('decision 38: a wrong choice fades over 150 ms under Reduce Motion', () => {
  test('Pattern Train: the wrong car’s transition is 0.15 s and moves nothing', async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
    await page.goto('/#/game/pattern/1');
    const p = await patternOnScreen(page);
    const wrong = patternCar(page, p.wrong[0]);
    await wrong.click();
    await expect(wrong).toHaveClass(/is-wrong/);
    const style = await wrong.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { duration: cs.transitionDuration, property: cs.transitionProperty, transform: cs.transform };
    });
    expect(style.duration).toBe('0.15s');
    expect(style.property).toBe('opacity');
    expect(style.transform).toBe('none');
  });
});
