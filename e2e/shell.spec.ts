/**
 * The shared frame on every screen: the zoom it hands to its safe-area padding, the 150ms crossfades that
 * survive Reduce Motion, touch-action on the whole page, and the Sign up checkbox row. Chromium reports
 * env(safe-area-inset-*) as 0, so the padding is checked for "nothing moved" here, and the env() maths is
 * guarded in the source by src/shared/ui/frameCss.test.ts.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { dots, levelCard, passGrownUpCheck, seed, solvePatternPuzzle } from './app';

const frame = (page: Page) => page.locator('.bw-screen__frame');
const style = (el: Locator, prop: string) => el.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);
const inlineZoom = (el: Locator) => el.evaluate((e) => (e as HTMLElement).style.getPropertyValue('--bw-zoom'));

test('the frame hands its zoom to the CSS and its padding stays 20/16/18', async ({ page }, info) => {
  const zoom = info.project.name === 'tablet' ? '1.4' : '1';
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
  await expect.poll(() => inlineZoom(frame(page))).toBe(zoom);

  await page.goto('/#/game/pattern/1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  expect(await inlineZoom(frame(page))).toBe(zoom);
  // The standard frame: no inset in a browser, so the padding is the design's own 20/16/18/16.
  expect(await style(frame(page), 'padding-top')).toBe('20px');
  expect(await style(frame(page), 'padding-right')).toBe('16px');
  expect(await style(frame(page), 'padding-bottom')).toBe('18px');
  expect(await style(frame(page), 'padding-left')).toBe('16px');
});

test('with Reduce Motion on, Next, the level card and a sticker card still crossfade over 150ms', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/pattern/1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');

  for (let n = 1; n <= 4; n++) {
    await solvePatternPuzzle(page);
    if (n === 4) break;
    const next = page.getByRole('button', { name: 'Next puzzle' });
    await expect(next).toBeVisible();
    expect(await style(next, 'animation-name')).toBe('bw-fade-in');
    expect(await style(next, 'animation-duration')).toBe('0.15s');
    // Everything without a designed fade still stops at once: the safety net in global.css stays.
    expect(await style(next, 'transition-duration')).toBe('1e-05s');
    await next.click();
    await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${n + 1} of 4. ${n} solved.`);
  }

  const card = page.locator('.bw-levelcard');
  await expect(levelCard(page)).toBeVisible();
  expect(await style(card, 'animation-name')).toBe('bw-fade-in');
  expect(await style(card, 'animation-duration')).toBe('0.15s');

  await page.goto('/#/stickers');
  await page.getByRole('button', { name: /^Sticker not found yet/ }).first().click();
  const sticker = page.locator('.sc-overlay__card');
  await expect(sticker).toBeVisible();
  expect(await style(sticker, 'animation-name')).toBe('sc-fade');
  expect(await style(sticker, 'animation-duration')).toBe('0.15s');
});

test('a double tap is a tap on the whole page, and boards still own their touches', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).touchAction)).toBe('manipulation');

  await page.goto('/#/game/builder/1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  expect(await style(page.locator('.pb-board'), 'touch-action')).toBe('none');
  // Pinch zoom stays on: the viewport meta never locks the scale.
  const viewport = (await page.locator('meta[name="viewport"]').getAttribute('content')) ?? '';
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/);
});

test('the Sign up checkbox row is a full 44px target with clear space above the links @phone-only', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  for (const size of [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/#/signup');
    if (await page.locator('.sc-gate__sum').isVisible()) await passGrownUpCheck(page);
    const row = page.locator('label.sc-check');
    await expect(row).toBeVisible();
    const box = (await row.boundingBox())!;
    const links = (await page.locator('.sc-check__links').boundingBox())!;
    expect(box.height, `${size.width}x${size.height}`).toBeGreaterThanOrEqual(44);
    expect(links.y - (box.y + box.height), `${size.width}x${size.height}`).toBeGreaterThanOrEqual(8);
    // No link's box reaches up into the row.
    for (const link of await page.locator('.sc-check__links a').all()) {
      const b = (await link.boundingBox())!;
      expect(b.y, `${size.width}x${size.height}`).toBeGreaterThanOrEqual(box.y + box.height);
    }
    // The taller row does not push Create account below the fold on a 390x844 phone.
    if (size.height === 844) await expect(page.getByRole('button', { name: 'Create account' })).toBeInViewport({ ratio: 1 });
    // The box itself sits inside the row, so a tap anywhere on the row ticks it.
    const tick = page.getByRole('checkbox', { name: /I am a parent or guardian/ });
    const was = await tick.isChecked();
    await row.click({ position: { x: box.width - 4, y: box.height - 2 } });
    await expect(tick).toBeChecked({ checked: !was });
  }
});
