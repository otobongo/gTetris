/**
 * Runs after the merge: needs the ui batch's short frame (decision 4). A phone held sideways scrolls the screen, and
 * the pattern has to stay in sight while the child picks: with the whole tray on screen, the whole train is too.
 */
import { expect, test, type Page } from '@playwright/test';
import { patternCar, patternOnScreen, patternTrain, seed, solvePatternPuzzle, starsUpTo } from './app';

async function openLevel(page: Page, level: number) {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', games: { pattern: { stars: starsUpTo(level - 1) } } }]);
  await page.goto(`/#/game/pattern/${level}`);
  await expect(patternTrain(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

/** Bring the tray's foot to the phone's edge, then read where the train and the tray sit on screen. */
function trayInView(page: Page) {
  return page.evaluate(() => {
    const tray = document.querySelector('.pat-tray')!;
    tray.scrollIntoView({ block: 'end' });
    const box = tray.getBoundingClientRect();
    const train = document.querySelector('.pat-train')!;
    return {
      trainTop: train.getBoundingClientRect().top,
      trayTop: box.top,
      trayBottom: box.bottom,
      height: window.innerHeight,
      zoom: getComputedStyle(train).zoom,
      sideways: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

for (const [width, height] of [
  [844, 390],
  [667, 375],
] as const) {
  test.describe(`a phone held sideways at ${width}x${height}`, () => {
    test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });

    for (const [level, zoom] of [
      [1, '0.95'],
      [4, '0.82'],
    ] as const) {
      test(`Level ${level}: the whole train stays on screen while the child picks a car`, { tag: '@phone-only' }, async ({ page }) => {
        await openLevel(page, level);
        const m = await trayInView(page);
        expect(m.zoom, 'the phone zoom for this many cars').toBe(zoom);
        expect(m.trayBottom).toBeLessThanOrEqual(m.height + 0.5);
        expect(m.trainTop, 'the top of the train is on the phone').toBeGreaterThanOrEqual(0);
        expect(m.sideways).toBeLessThanOrEqual(0);
      });

      test(`Level ${level}: a wrong car and the solve leave the train where it is`, { tag: '@phone-only' }, async ({ page }) => {
        await openLevel(page, level);
        const start = await trayInView(page);
        const p = await patternOnScreen(page);
        await patternCar(page, p.wrong[0]).click();
        await expect(page.locator('.bw-helprow__line')).toHaveText('Say the pattern out loud and try again.');
        expect((await trayInView(page)).trainTop).toBeCloseTo(start.trainTop, 0);
        await solvePatternPuzzle(page);
        expect((await trayInView(page)).trainTop).toBeCloseTo(start.trainTop, 0);
      });
    }
  });
}
