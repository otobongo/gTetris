/**
 * The shared frame on every screen: the zoom it hands to its safe-area padding, the 150ms crossfades that
 * survive Reduce Motion, touch-action on the whole page, and the Sign up checkbox row. A browser on a
 * desktop reports env(safe-area-inset-*) as 0, so the safe-area journeys set the insets an iPhone or iPad
 * reports through Chromium's own override, and measure where the content lands on the screen.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { computeLayout } from '../src/shared/ui/layout';
import { type Band, dots, levelCard, passGrownUpCheck, patternCar, patternOnScreen, seed, solvePatternPuzzle } from './app';

const frame = (page: Page) => page.locator('.bw-screen__frame');
const style = (el: Locator, prop: string) => el.evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop);
const inlineZoom = (el: Locator) => el.evaluate((e) => (e as HTMLElement).style.getPropertyValue('--bw-zoom'));

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** The safe-area insets a device reports, so env() in the page is what that device would give it. */
async function emulateInsets(page: Page, insets: Insets) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
}

/** The edges of what the frame lays out, in screen px, looking through display: contents wrappers. */
const contentEdges = (page: Page) =>
  frame(page).evaluate((f) => {
    const boxes: DOMRect[] = [];
    const walk = (el: Element) => {
      for (const child of el.children) {
        if (getComputedStyle(child).display === 'contents') walk(child);
        else {
          const b = child.getBoundingClientRect();
          if (b.width && b.height) boxes.push(b);
        }
      }
    };
    walk(f);
    return {
      top: Math.min(...boxes.map((b) => b.top)),
      right: Math.max(...boxes.map((b) => b.right)),
      bottom: Math.max(...boxes.map((b) => b.bottom)),
      left: Math.min(...boxes.map((b) => b.left)),
    };
  });

/**
 * Devices and the insets they report with viewport-fit=cover (a Home Screen app, or Safari with its bars
 * collapsed). `fits` is false where the screen is shorter than the design, so only the sides are checked.
 */
const DEVICES: { name: string; viewport: { width: number; height: number }; insets: Insets; fits: boolean }[] = [
  { name: 'iPhone 390x844', viewport: { width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 }, fits: true },
  { name: 'iPhone SE 375x667', viewport: { width: 375, height: 667 }, insets: { top: 0, right: 0, bottom: 0, left: 0 }, fits: true },
  { name: 'iPad 834x1194', viewport: { width: 834, height: 1194 }, insets: { top: 0, right: 0, bottom: 20, left: 0 }, fits: true },
  // Larger than the frame's own 18px at zoom 1.4 (25.2px on screen), so only the division by the zoom keeps it clear.
  { name: 'iPad 834x1194, a 40px inset', viewport: { width: 834, height: 1194 }, insets: { top: 0, right: 0, bottom: 40, left: 0 }, fits: true },
  { name: 'iPad 1194x834', viewport: { width: 1194, height: 834 }, insets: { top: 0, right: 0, bottom: 20, left: 0 }, fits: true },
  { name: 'iPhone sideways 844x390', viewport: { width: 844, height: 390 }, insets: { top: 0, right: 47, bottom: 21, left: 47 }, fits: false },
];

const BANDS: Band[] = ['3-4', '5-6', '7-8', '9-10'];

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

/**
 * Under Reduce Motion, each element that still changes over time for longer than the 0.01ms safety net,
 * with the properties it changes (a transition's property, or every property its keyframes set).
 */
const stillChanging = (page: Page) =>
  page.evaluate(() => {
    const keyframes: Record<string, string[]> = {};
    const collect = (list: CSSRuleList) => {
      for (const r of list) {
        if (r instanceof CSSKeyframesRule) {
          const props = new Set<string>();
          for (const k of r.cssRules) for (const p of (k as CSSKeyframeRule).style) props.add(p);
          keyframes[r.name] = [...props];
        } else if ('cssRules' in r) collect((r as CSSGroupingRule).cssRules);
      }
    };
    for (const sheet of document.styleSheets) collect(sheet.cssRules);
    const seconds = (v: string) => v.split(',').map((x) => parseFloat(x) * (x.trim().endsWith('ms') ? 0.001 : 1));
    const out: { el: string; changes: string[] }[] = [];
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      const ad = seconds(cs.animationDuration);
      cs.animationName.split(',').forEach((n, i) => {
        if (n.trim() !== 'none' && ad[i % ad.length] > 0.001) out.push({ el: String(el.className), changes: keyframes[n.trim()] ?? [`unknown ${n}`] });
      });
      const td = seconds(cs.transitionDuration);
      cs.transitionProperty.split(',').forEach((p, i) => {
        if (p.trim() !== 'none' && td[i % td.length] > 0.001) out.push({ el: String(el.className), changes: [p.trim()] });
      });
    }
    return out;
  });

test('with Reduce Motion on, what still changes over time only fades: nothing slides, tilts or grows', async ({ page }) => {
  // The 150ms fades get past the safety net with !important durations; a game rule that set a transform
  // transition on the same element would ride along, so each state a child reaches is checked.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  const onlyFades = async (where: string) => {
    for (const { el, changes } of await stillChanging(page)) expect(changes, `${where}: ${el}`).toEqual(['opacity']);
  };

  await page.goto('/#/game/pattern/1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  await onlyFades('Pattern Train');
  const shown = await patternOnScreen(page);
  await patternCar(page, shown.wrong[0]).click();
  await onlyFades('Pattern Train, a wrong car');
  for (let n = 1; n <= 4; n++) {
    await solvePatternPuzzle(page);
    if (n === 4) break;
    await expect(page.getByRole('button', { name: 'Next puzzle' })).toBeVisible();
    await onlyFades('Pattern Train, solved');
    await page.getByRole('button', { name: 'Next puzzle' }).click();
    await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${n + 1} of 4. ${n} solved.`);
  }
  await expect(levelCard(page)).toBeVisible();
  await onlyFades('the level card');

  await page.goto('/#/game/sorter/1');
  await expect(page.locator('.bw-drag').first()).toBeVisible();
  await onlyFades('Shape Sorter');
  await page.goto('/#/game/numbers/1');
  await page.locator('.bw-drag').first().click();
  await onlyFades('Number Line-up, a tower picked');

  await page.goto('/#/stickers');
  await page.getByRole('button', { name: /^Sticker not found yet/ }).first().click();
  await expect(page.locator('.sc-overlay__card')).toBeVisible();
  await onlyFades('a sticker card');
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

test('inside a scrolling list or play area a double tap is still a tap, and drag pieces still own their touches', async ({ page }) => {
  // A scroller starts its own touch-action chain (Pointer Events, as Safari follows it), so html's value
  // does not reach what sits inside one: each element has to say manipulation itself.
  await seed(page, [{ id: 'kit', name: 'Kit', ageBand: '3-4' }]);
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Hi Kit!' })).toBeVisible();
  /** The touch-action of a scroller and of everything in it, counted by value. */
  const inside = (el: Locator) =>
    el.evaluate((root) => {
      const count: Record<string, number> = {};
      for (const e of [root, ...root.querySelectorAll('*')]) {
        const v = getComputedStyle(e).touchAction;
        count[v] = (count[v] ?? 0) + 1;
      }
      return count;
    });
  const list = page.locator('.sc-home__scroll');
  expect(await style(list, 'overflow-y')).toBe('auto');
  // The game cards and the gaps between them: no element in the list is left at auto.
  expect(Object.keys(await inside(list))).toEqual(['manipulation']);

  // Letter Builder, ages 3 to 4: its whole play area is a scroller. Only its drag bricks say none.
  await page.goto('/#/game/letters');
  const body = page.locator('.lb-body');
  await expect(body).toBeVisible();
  expect(await style(body, 'overflow-y')).toBe('auto');
  const counts = await inside(body);
  expect(counts.manipulation).toBeGreaterThan(0);
  expect(Object.keys(counts).filter((v) => v !== 'manipulation' && v !== 'none')).toEqual([]);

  // Shape Sorter's pieces are drag items: they still take every touch for the drag.
  await page.goto('/#/game/sorter/1');
  const piece = page.locator('.bw-drag').first();
  await expect(piece).toBeVisible();
  expect(await style(piece, 'touch-action')).toBe('none');
});

test('the Sign up checkbox row is a full 44px target with clear space above the links @phone-only', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  for (const size of [
    { width: 390, height: 844 },
    { width: 375, height: 667 },
    { width: 834, height: 1194 },
    { width: 1194, height: 834 },
  ]) {
    const at = `${size.width}x${size.height}`;
    await page.setViewportSize(size);
    // A fresh load at each size, so the form starts unscrolled and the frame has its new zoom.
    await page.goto('/#/signup');
    await page.reload();
    if (await page.locator('.sc-gate__sum').isVisible()) await passGrownUpCheck(page);
    const row = page.locator('label.sc-check');
    await expect(row).toBeVisible();
    await expect.poll(() => inlineZoom(frame(page))).toBe(String(computeLayout(size.width, size.height).zoom));
    await page.evaluate(() => document.fonts.ready);
    const box = (await row.boundingBox())!;
    const links = (await page.locator('.sc-check__links').boundingBox())!;
    // Screen px: on a tablet the frame is zoomed, so the row is larger still.
    expect(box.height, at).toBeGreaterThanOrEqual(44);
    // 8 to 12px (in the frame's own px) between the row and the links: clear of each other, and the links
    // still read as part of the sentence above them.
    const zoom = Number((await inlineZoom(frame(page))) || 1);
    const gap = (links.y - (box.y + box.height)) / zoom;
    expect(gap, at).toBeGreaterThanOrEqual(8);
    expect(gap, at).toBeLessThanOrEqual(12);
    // No link's box reaches up into the row.
    for (const link of await page.locator('.sc-check__links a').all()) {
      const b = (await link.boundingBox())!;
      expect(b.y, at).toBeGreaterThanOrEqual(box.y + box.height);
    }
    // The box sits in the middle of the row's height, beside the two lines of text.
    const tick = page.getByRole('checkbox', { name: /I am a parent or guardian/ });
    const t = (await tick.boundingBox())!;
    expect(Math.abs(t.y + t.height / 2 - (box.y + box.height / 2)), at).toBeLessThanOrEqual(1);
    // A tap at the row's far corner ticks it.
    const was = await tick.isChecked();
    await row.click({ position: { x: box.width - 4, y: box.height - 2 } });
    await expect(tick).toBeChecked({ checked: !was });
    // The form scrolls, so Create account below the taller row is still reached in full at its end.
    await page.locator('.sc-auth__body').evaluate((e) => e.scrollTo(0, e.scrollHeight));
    await expect(page.getByRole('button', { name: 'Create account' }), at).toBeInViewport({ ratio: 1 });
  }
});

for (const device of DEVICES) {
  // Each journey sets its own screen size, so it runs once (the tag keeps the tablet project out).
  test(`on ${device.name} a game's content stays clear of the safe areas and keeps its width @phone-only`, async ({ page }) => {
    const { width, height } = device.viewport;
    const { insets } = device;
    await page.setViewportSize(device.viewport);
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
    await page.goto('/#/game/pattern/1');
    await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
    const before = await contentEdges(page);

    await emulateInsets(page, insets);
    await page.reload();
    await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
    const after = await contentEdges(page);
    expect(after.top, 'top').toBeGreaterThanOrEqual(insets.top);
    expect(after.left, 'left').toBeGreaterThanOrEqual(insets.left);
    expect(after.right, 'right').toBeLessThanOrEqual(width - insets.right);
    if (device.fits) {
      expect(after.bottom, 'bottom').toBeLessThanOrEqual(height - insets.bottom);
      // The controls slot (Next puzzle's place) is the lowest thing a child taps.
      const slot = (await page.locator('.bw-play__slot').boundingBox())!;
      expect(slot.y + slot.height, 'controls slot').toBeLessThanOrEqual(height - insets.bottom);
    }
    // Insets the frame's margins already clear cost the board no width.
    expect(after.right - after.left, 'content width').toBeCloseTo(before.right - before.left, 0);
  });

  test(`on ${device.name} Home's last card scrolls clear of the home indicator for every age band @phone-only`, async ({ page }) => {
    const { height } = device.viewport;
    await page.setViewportSize(device.viewport);
    await emulateInsets(page, device.insets);
    await seed(
      page,
      BANDS.map((ageBand, i) => ({ id: `p${i}`, name: `Kid${i}`, ageBand })),
    );
    for (const [i, ageBand] of BANDS.entries()) {
      await page.goto('/#/players');
      await page.locator('.sc-player', { hasText: `Kid${i}` }).click();
      await page.getByRole('link', { name: `Play as Kid${i}` }).click();
      await expect(page.getByRole('heading', { name: `Hi Kid${i}!` })).toBeVisible();
      const list = page.locator('.sc-home__scroll');
      await list.evaluate((e) => e.scrollTo(0, e.scrollHeight));
      const last = (await list.locator('a, button').last().boundingBox())!;
      expect(last.y + last.height, `${ageBand} last card`).toBeLessThanOrEqual(height - device.insets.bottom);
    }
  });
}

test.describe('iPad in landscape: the Brick Escape and Brick Drop controls clear the home indicator @phone-only', () => {
  const insets = { top: 0, right: 0, bottom: 20, left: 0 };
  test.use({ viewport: { width: 1194, height: 834 } });

  test('Brick Escape, ages 7 to 8', async ({ page }) => {
    await emulateInsets(page, insets);
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
    await page.goto('/#/game/escape');
    await expect(page.locator('.esc-tools')).toBeVisible();
    const tools = (await page.locator('.esc-tools').boundingBox())!;
    expect(tools.y + tools.height).toBeLessThanOrEqual(834 - insets.bottom);
    expect((await contentEdges(page)).bottom).toBeLessThanOrEqual(834 - insets.bottom);
  });

  test('Brick Drop, ages 9 to 10', async ({ page }) => {
    await emulateInsets(page, insets);
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10' }]);
    await page.goto('/#/game/drop');
    await page.getByRole('dialog').getByRole('button', { name: 'Start' }).click();
    const pad = page.getByRole('group', { name: 'Controls' });
    await expect(pad).toBeVisible();
    const box = (await pad.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(834 - insets.bottom);
  });
});
