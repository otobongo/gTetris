/**
 * Pattern Train, usability round 2: the shapes drawn as SVG with a --bw-purple-edge outline (decision 3), a bigger
 * shape in the car with the zoom from the car count and zoom 1 on tablet, and the prompt, train and help row
 * grouped in the space above the tray (decision 16), and the arriving train's fade under Reduce Motion
 * (decision 38). Measured with the real font (Baloo 2), in screen px, which are pt on an iPhone or iPad.
 */
import { expect, test, type Page } from '@playwright/test';
import { patternTrain, patternTray, seed, solvePatternPuzzle, starsUpTo } from './app';

/** Open a level (1-based) as a child whose frontier it is, and wait for the real font. */
async function openLevel(page: Page, level: number) {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', games: { pattern: { stars: starsUpTo(level - 1) } } }]);
  await page.goto(`/#/game/pattern/${level}`);
  await expect(patternTrain(page)).toBeVisible();
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    // The app loads weights 600, 700 and 800 only, so the check names one of them.
    return [...document.fonts].some((f) => f.family.includes('Baloo 2') && f.status === 'loaded') && document.fonts.check('800 16px "Baloo 2"');
  });
  expect(font, 'the real Baloo 2 font is loaded').toBe(true);
}

/** Where the board's parts sit on screen. */
function layout(page: Page) {
  return page.evaluate(() => {
    const q = (s: string) => document.querySelector(s)!;
    const box = (s: string) => q(s).getBoundingClientRect();
    const train = q('.pat-train:not(.pat-ghost)');
    const parts = [...train.children].map((k) => k.getBoundingClientRect());
    const wrap = q('.pat-rail-wrap') as HTMLElement;
    const topBar = q('.bw-screen__frame').firstElementChild!.getBoundingClientRect();
    return {
      shape: box('.pat-train:not(.pat-ghost) .pat-shape').width,
      choiceShape: box('.pat-choice .pat-shape').width,
      left: parts[0].left,
      right: parts.at(-1)!.right,
      wrapLeft: wrap.getBoundingClientRect().left,
      wrapRight: wrap.getBoundingClientRect().right,
      scrollWidth: wrap.scrollWidth,
      clientWidth: wrap.clientWidth,
      pageScroll: document.documentElement.scrollWidth - window.innerWidth,
      above: box('.pat-prompt').top - topBar.bottom,
      below: box('.pat-tray').top - box('.bw-helprow').bottom,
      tray: box('.pat-tray').top,
    };
  });
}

/* ---------- Decision 38: the arriving train fades over 150 ms under Reduce Motion ---------- */

test('under Reduce Motion the arriving train fades over 0.15s and the ghost stays hidden', async ({ page }) => {
  await openLevel(page, 1);
  await solvePatternPuzzle(page);
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  const arriving = page.locator('.pat-train.is-arriving');
  await expect(arriving).toHaveCount(1);
  const anim = await arriving.evaluate((el) => {
    const s = getComputedStyle(el);
    return { name: s.animationName, duration: s.animationDuration, delay: s.animationDelay };
  });
  expect(anim).toEqual({ name: 'pat-arrive', duration: '0.15s', delay: '0s' });
  await expect(page.locator('.pat-ghost')).toBeHidden();
});

test.describe('with motion on', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the ghost leaves and the new train arrives inside the rail wrap, which clips them', async ({ page }) => {
    await openLevel(page, 1);
    await solvePatternPuzzle(page);
    await page.getByRole('button', { name: 'Next puzzle' }).click();
    const ghost = page.locator('.pat-rail-wrap > .pat-ghost');
    await expect(ghost).toHaveCount(1);
    expect(await page.locator('.pat-rail-wrap').evaluate((el) => getComputedStyle(el).overflow)).toBe('hidden');
    // The ghost has the same zoom as the train it was, so it leaves from where it stood.
    const zooms = await page.locator('.pat-rail-wrap > .pat-train').evaluateAll((els) => els.map((e) => getComputedStyle(e).zoom));
    expect(new Set(zooms).size).toBe(1);
    await expect(page.locator('.pat-train.is-arriving')).toHaveCSS('animation-duration', '0.15s');
    await expect(ghost).toHaveCount(0);
  });
});

/* ---------- Decision 3: shapes as SVG with a dark edge ---------- */

test('every shape on the rail and in the tray is an SVG with a --bw-purple-edge stroke', async ({ page }) => {
  await openLevel(page, 1);
  const shapes = await page.locator('.pat-shape').evaluateAll((els) =>
    els.map((el) => {
      const drawn = el.firstElementChild;
      const s = drawn ? getComputedStyle(drawn) : null;
      return {
        tag: el.tagName.toLowerCase(),
        color: el.getAttribute('data-color'),
        stroke: s?.stroke,
        strokeWidth: s?.strokeWidth,
        join: s?.strokeLinejoin,
        order: s?.paintOrder,
        fill: s?.fill,
        clip: getComputedStyle(el).clipPath,
      };
    }),
  );
  // Four shown cars on the rail, three in the tray.
  expect(shapes).toHaveLength(7);
  const fills: Record<string, string> = {
    red: 'rgb(240, 58, 58)',
    blue: 'rgb(47, 140, 255)',
    yellow: 'rgb(255, 194, 26)',
    green: 'rgb(31, 181, 60)',
    pink: 'rgb(255, 95, 180)',
  };
  for (const s of shapes) {
    expect(s).toMatchObject({ tag: 'svg', stroke: 'rgb(36, 26, 99)', strokeWidth: '2.5px', join: 'round', order: 'stroke', clip: 'none' });
    expect(s.fill).toBe(fills[s.color!]);
  }
});

test('a choice keeps its 46 px shape and a car its 36 px shape, in the frame px', async ({ page }, info) => {
  await openLevel(page, 1);
  const zoom = info.project.name === 'tablet' ? 1.4 : 1;
  const sizes = await page.evaluate(() => {
    const css = (s: string) => {
      const el = document.querySelector(s)!;
      return [parseFloat(getComputedStyle(el).width), parseFloat(getComputedStyle(el).height)];
    };
    return { car: css('.pat-train .pat-shape'), choice: css('.pat-choice .pat-shape') };
  });
  // Within 0.05 px: the zoomed frame rounds the computed size a hair (35.99 at zoom 1.4).
  for (const v of sizes.car) expect(v).toBeCloseTo(36, 1);
  for (const v of sizes.choice) expect(v).toBeCloseTo(46, 1);
  const m = await layout(page);
  expect(m.choiceShape).toBeCloseTo(46 * zoom, 0);
});

/* ---------- Decision 16: bigger train, zoom from the car count, grouped above the tray ---------- */

/** Where the tray's top sat before this change, in screen px (measured with the real font). It must not move. */
const TRAY_TOP: Record<string, number> = {
  '390x844': 665,
  '375x667': 488,
  '834x1194': 942.22,
  '1194x834': 655,
};

const SIZES = [
  { name: 'iPhone 390x844', width: 390, height: 844, phone: true, four: 33, five: 29 },
  { name: 'iPhone SE 375x667', width: 375, height: 667, phone: true, four: 33, five: 28 },
  { name: 'iPad portrait 834x1194 (zoom 1.4)', width: 834, height: 1194, phone: false, four: 50, five: 50 },
  { name: 'iPad landscape 1194x834', width: 1194, height: 834, phone: false, four: 36, five: 36 },
];

for (const size of SIZES) {
  test.describe(size.name, () => {
    test.use(size.phone ? { viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true } : { viewport: { width: size.width, height: size.height } });

    for (const [level, shown] of [
      [1, 4],
      [4, 5],
    ] as const) {
      test(`Level ${level} (${shown} cars): the shape is big enough, the train fits, the group is centred and the tray stays`, { tag: '@phone-only' }, async ({ page }) => {
        await openLevel(page, level);
        const m = await layout(page);
        const min = shown === 4 ? size.four : size.five;
        expect(m.shape, `rail shape ${m.shape.toFixed(1)} pt`).toBeGreaterThanOrEqual(min);
        // The train never runs past the frame's content width.
        expect(m.left).toBeGreaterThanOrEqual(m.wrapLeft - 0.5);
        expect(m.right).toBeLessThanOrEqual(m.wrapRight + 0.5);
        expect(m.scrollWidth).toBe(m.clientWidth);
        expect(m.pageScroll).toBeLessThanOrEqual(0);
        // Prompt, train and help row sit together in the middle of the space above the tray.
        expect(Math.abs(m.above - m.below), `above ${m.above.toFixed(1)}, below ${m.below.toFixed(1)}`).toBeLessThanOrEqual(8);
        expect(m.above).toBeGreaterThan(20);
        // The tray does not move.
        expect(Math.abs(m.tray - TRAY_TOP[`${size.width}x${size.height}`])).toBeLessThanOrEqual(1);
        await expect(patternTray(page)).toBeVisible();
      });
    }
  });
}
