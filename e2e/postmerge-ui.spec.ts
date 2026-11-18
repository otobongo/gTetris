/**
 * Runs after the merge: needs the kit batch's `cue` on the New puzzle button (decision 8). On a phone held
 * sideways the screen scrolls, so a keypad press can leave the offer above the phone's edge. At ages 3 to 4 the
 * offer comes into view when it appears, so its 2 s ring can be seen, and it still never takes focus.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { type Band, mathOnScreen, seed, sendMathAnswer } from './app';

const onPhone = (el: Locator) =>
  el.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight;
  });

async function stuck(page: Page, band: Band) {
  await seed(page, [{ id: 'ada', name: 'Ada', ageBand: band }]);
  await page.goto('/#/game/math/1');
  const puzzle = await mathOnScreen(page);
  await sendMathAnswer(page, (puzzle.answer + 1) % 10, 'taps');
  await page.waitForTimeout(800);
  await sendMathAnswer(page, (puzzle.answer + 2) % 10, 'taps');
  const offer = page.getByRole('button', { name: 'New puzzle' });
  await expect(offer).toBeAttached();
  return offer;
}

for (const size of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
  test.describe(`the stuck offer on a phone held sideways at ${size.width}x${size.height} @phone-only`, () => {
    test.use({ viewport: size, isMobile: true, hasTouch: true });

    test('ages 3 to 4: the offer comes into view with its ring, and focus stays where it was', async ({ page }) => {
      const offer = await stuck(page, '3-4');
      await expect(offer).toHaveClass(/is-cue/);
      expect(await onPhone(offer), 'the ring is on the phone').toBe(true);
      expect(await offer.evaluate((e) => document.activeElement === e), 'the offer never takes focus').toBe(false);
      await expect(offer).not.toHaveClass(/is-cue/, { timeout: 4_000 });
    });

    test('ages 5 to 6: no ring, and the screen stays on the keypad', async ({ page }) => {
      const offer = await stuck(page, '5-6');
      await expect(offer).not.toHaveClass(/is-cue/);
      expect(await page.locator('main.bw-screen').evaluate((m) => m.scrollTop), 'the keypad stays in view').toBeGreaterThan(0);
    });
  });
}
