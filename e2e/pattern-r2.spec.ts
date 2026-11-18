/**
 * Pattern Train, usability round 2: the shapes drawn as SVG with a --bw-purple-edge outline (decision 3), a bigger
 * shape in the car with the zoom from the car count and zoom 1 on tablet, and the prompt, train and help row
 * grouped in the space above the tray (decision 16), and the arriving train's fade under Reduce Motion
 * (decision 38). Measured with the real font (Baloo 2), in screen px, which are pt on an iPhone or iPad.
 */
import { expect, test, type Page } from '@playwright/test';
import { patternCar, patternOnScreen, patternTrain, patternTray, seed, solvePatternPuzzle, starsUpTo } from './app';

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

/** Tap Next and read the rail in the frame the ghost is added, since it is gone 200 ms later. */
async function nextWithGhost(page: Page) {
  const seen = page.evaluate(
    () =>
      new Promise<{ top: number; overflow: string; zooms: string[]; arrival: string }>((done) => {
        const look = new MutationObserver(() => {
          const ghost = document.querySelector('.pat-rail-wrap > .pat-ghost');
          if (!ghost) return;
          look.disconnect();
          const wrap = ghost.parentElement!;
          done({
            top: ghost.getBoundingClientRect().top,
            overflow: getComputedStyle(wrap).overflow,
            zooms: [...wrap.querySelectorAll(':scope > .pat-train')].map((e) => getComputedStyle(e).zoom),
            arrival: getComputedStyle(wrap.querySelector('.pat-train.is-arriving')!).animationDuration,
          });
        });
        look.observe(document.body, { childList: true, subtree: true });
      }),
  );
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  return seen;
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
    const m = await nextWithGhost(page);
    expect(m.overflow).toBe('hidden');
    // The ghost has the same zoom as the train it was, so it leaves from where it stood.
    expect(m.zooms).toHaveLength(2);
    expect(new Set(m.zooms).size).toBe(1);
    expect(m.arrival).toBe('0.15s');
    await expect(page.locator('.pat-rail-wrap > .pat-ghost')).toHaveCount(0);
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

/* ---------- Independent review: the edges the first pass left open ---------- */

/** The solved train's parts: the answer car, its 3 px ring at the train's zoom, and the wrap that clips the row. */
function answerRing(page: Page) {
  return page.evaluate(() => {
    const train = document.querySelector('.pat-train:not(.pat-ghost)')!;
    const body = document.querySelector('.pat-car__body.is-answer')!.getBoundingClientRect();
    const wrap = document.querySelector('.pat-rail-wrap')!.getBoundingClientRect();
    const rail = document.querySelector('.pat-rail')!.getBoundingClientRect();
    const ring = 3 * parseFloat(getComputedStyle(train).zoom);
    return {
      ringRight: body.right + ring,
      ringTop: body.top - ring,
      wrapRight: wrap.right,
      wrapTop: wrap.top,
      railLeft: rail.left,
      railRight: rail.right,
      pageScroll: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
}

for (const [width, height] of [
  [320, 568],
  [360, 740],
  [375, 667],
  [390, 844],
  [430, 932],
] as const) {
  test.describe(`solved at ${width}x${height}`, () => {
    test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });

    for (const level of [1, 4]) {
      test(`Level ${level}: the answer car's ring is whole and the rail keeps to the column`, { tag: '@phone-only' }, async ({ page }) => {
        await openLevel(page, level);
        await solvePatternPuzzle(page);
        const m = await answerRing(page);
        expect(m.ringRight, 'the ring ends inside the clipping wrap').toBeLessThanOrEqual(m.wrapRight);
        expect(m.ringTop).toBeGreaterThanOrEqual(m.wrapTop);
        // The rail stays on the frame's 16 px gutters, and the page gains no sideways scroll.
        expect(m.railLeft).toBeCloseTo(16, 0);
        expect(m.railRight).toBeCloseTo(width - 16, 0);
        expect(m.pageScroll).toBeLessThanOrEqual(0);
      });
    }
  });
}

/* The narrowest phone: the start line takes 3 lines there and the wrong line 2, so it is the hardest case for this check. */
for (const size of [...SIZES, { name: 'iPhone 320x568', width: 320, height: 568, phone: true }]) {
  test.describe(`${size.name}: the board holds still`, () => {
    test.use(size.phone ? { viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true } : { viewport: { width: size.width, height: size.height } });

    for (const level of [1, 4]) {
      test(`Level ${level}: a wrong car and the solve leave the train and the tray where they are`, { tag: '@phone-only' }, async ({ page }) => {
        await openLevel(page, level);
        const at = () =>
          page.evaluate(() => ({
            train: document.querySelector('.pat-train')!.getBoundingClientRect().top,
            tray: document.querySelector('.pat-tray')!.getBoundingClientRect().top,
          }));
        const start = await at();
        const p = await patternOnScreen(page);
        await patternCar(page, p.wrong[0]).click();
        await expect(page.locator('.bw-helprow__line')).toHaveText('Say the pattern out loud and try again.');
        const wrong = await at();
        expect(Math.abs(wrong.train - start.train), 'after a wrong car').toBeLessThanOrEqual(0.5);
        await solvePatternPuzzle(page);
        await expect(page.locator('.pat-prompt')).toHaveText('Pattern complete.');
        const solved = await at();
        expect(Math.abs(solved.train - start.train), 'after the solve').toBeLessThanOrEqual(0.5);
        expect(Math.abs(solved.tray - start.tray)).toBeLessThanOrEqual(0.5);
      });
    }
  });
}

test.describe('with motion on, the leaving train', () => {
  test.use({ reducedMotion: 'no-preference' });

  for (const [width, height, level] of [
    [390, 844, 1],
    [390, 844, 4],
    [375, 667, 4],
    [834, 1194, 4],
  ] as const) {
    test.describe(`${width}x${height}`, () => {
      test.use({ viewport: { width, height } });

      test(`Level ${level}: starts from the height the train stood at, with no hop up`, { tag: '@phone-only' }, async ({ page }) => {
        await openLevel(page, level);
        await solvePatternPuzzle(page);
        const stood = await page.locator('.pat-train').evaluate((el) => el.getBoundingClientRect().top);
        const { top } = await nextWithGhost(page);
        expect(Math.abs(top - stood)).toBeLessThanOrEqual(0.25);
      });
    });
  }
});

test("the kit's empty body keeps its place in the page, with no height, above the tray", async ({ page }) => {
  await openLevel(page, 1);
  // The short frame's journeys measure this box on a phone held sideways (frame-short.spec.ts).
  const body = await page.locator('.bw-play__body').boundingBox();
  const tray = await page.locator('.pat-tray').boundingBox();
  expect(body, 'the body is laid out').not.toBeNull();
  expect(body!.height).toBe(0);
  expect(body!.y).toBeLessThanOrEqual(tray!.y);
});

test('the shape sits on the car face above its 5 px foot, with the whole edge inside the body', async ({ page }) => {
  await openLevel(page, 4);
  const cars = await page.locator('.pat-train .pat-car__body:not(.is-empty)').evaluateAll((els) =>
    els.map((el) => {
      const svg = el.querySelector('.pat-shape')!;
      const body = el.getBoundingClientRect();
      const shape = svg.getBoundingClientRect();
      // On screen px: 36 CSS px of shape, so the scale takes in the train's zoom and the tablet frame's.
      const scale = shape.width / 36;
      // The edge is 2.5 of 30 units wide and half of it shows outside the shape: 1.5 px at 36 px.
      const edge = 1.5 * scale;
      return { top: shape.top - edge - body.top, foot: body.bottom - 5 * scale - (shape.bottom + edge), overflow: getComputedStyle(svg).overflow };
    }),
  );
  expect(cars).toHaveLength(5);
  for (const c of cars) {
    expect(c.top).toBeGreaterThanOrEqual(0);
    expect(c.foot).toBeGreaterThanOrEqual(0);
    // Centred on the face: the same room above the edge as above the foot.
    expect(Math.abs(c.top - c.foot)).toBeLessThanOrEqual(0.75);
    // The outline runs past the 30 unit box, so the box must not cut it off.
    expect(c.overflow).toBe('visible');
  }
});

for (const [level, zoom] of [
  [1, 0.95],
  [3, 0.95],
  [4, 0.82],
  [12, 0.82],
] as const) {
  test(`Level ${level} draws its train at zoom ${zoom} on a 390 phone`, { tag: '@phone-only' }, async ({ page }) => {
    await openLevel(page, level);
    expect(await patternTrain(page).evaluate((el) => getComputedStyle(el).zoom)).toBe(String(zoom));
  });
}

for (const ageBand of ['3-4', '5-6', '7-8', '9-10'] as const) {
  test(`ages ${ageBand} get the same train on Level 4`, { tag: '@phone-only' }, async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand, games: { pattern: { stars: starsUpTo(3) } } }]);
    await page.goto('/#/game/pattern/4');
    await expect(patternTrain(page)).toBeVisible();
    expect(await patternTrain(page).evaluate((el) => getComputedStyle(el).zoom)).toBe('0.82');
    const shape = await page.locator('.pat-train .pat-shape').first().evaluate((el) => el.getBoundingClientRect().width);
    expect(shape).toBeGreaterThanOrEqual(29);
  });
}

test('the zoom follows the screen when it turns or resizes, with no reload', { tag: '@phone-only' }, async ({ page }) => {
  await openLevel(page, 4);
  const zoom = () => patternTrain(page).evaluate((el) => getComputedStyle(el).zoom);
  expect(await zoom()).toBe('0.82');
  await page.setViewportSize({ width: 375, height: 667 });
  await expect.poll(zoom).toBe('0.79');
  await page.setViewportSize({ width: 834, height: 1194 });
  await expect.poll(zoom).toBe('1');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(zoom).toBe('0.82');
});

test('the finished game keeps the locomotive alone at the board zoom', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', games: { pattern: { stars: starsUpTo(12) } } }]);
  await page.goto('/#/game/pattern');
  const train = page.locator('.pat-train');
  await expect(train).toHaveCount(1);
  expect(await train.evaluate((el) => getComputedStyle(el).zoom)).toBe('0.78');
  await expect(page.locator('.pat-car')).toHaveCount(0);
});
