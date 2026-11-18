/**
 * Number Line-up, usability round 2 (decisions 23, 37 and 38):
 * - at ages 3 to 4, Level 1 puzzle 1 shows a static double arrow over the first swap (the two towers the hint
 *   would name) and a ring on both, until the first pick, drag, hint or swap; nowhere else, and never moving;
 * - a still touch (a resting palm) on one tower no longer blocks a finger dragging another (drag takeover);
 * - under Reduce Motion a moved tower's stack still fades over 150 ms, and never slides.
 * Measurements are printed (console) so the run's log carries them per size.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { type Band, dots, numbersNextSwap, numbersRow, numbersTower, numbersTowers, pointerDrag, savedRun, seed, solveNumbersPuzzle, starsUpTo, swapTowers } from './app';

/* ---------- helpers ---------- */

const help = (page: Page) => page.locator('.bw-helprow__line');
const hint = (page: Page) => page.getByRole('button', { name: /^Hint, \d left$/ });
const cue = (page: Page) => page.locator('.num-swapcue');
const cued = (page: Page) => page.locator('.num-stack.is-cued');
const START = 'Drag or tap two towers to swap them.';

/** Open a 0-based level as the child's frontier. The seed is written once per tab: one child per tab. */
async function openLevel(page: Page, band: Band, level = 0) {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: band, games: { numbers: { stars: starsUpTo(level) } } }]);
  await page.goto(`/#/game/numbers/${level + 1}`);
  await expect(page).toHaveURL(new RegExp(`#/game/numbers/${level + 1}$`));
  await expect(numbersTowers(page)).toHaveCount(6);
}

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(el: Locator): Promise<Box> {
  const box = await el.boundingBox();
  if (!box) throw new Error('Not on screen');
  return box;
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const centreX = (b: Box) => b.x + b.width / 2;

/** What the cue looks like on screen: its box, the two ringed towers' spots, their faces' boxes and the well's box. */
async function cueLayout(page: Page) {
  return page.evaluate(() => {
    const rect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const towers = [...document.querySelectorAll('.num-tower')];
    const arrow = document.querySelector('.num-swapcue');
    return {
      arrow: rect(arrow),
      hidden: arrow?.getAttribute('aria-hidden') ?? null,
      motion: arrow ? { animation: getComputedStyle(arrow).animationName, transition: getComputedStyle(arrow).transitionDuration } : null,
      rings: towers.flatMap((t, i) => (t.querySelector('.num-stack.is-cued') ? [i] : [])),
      ringShadow: towers.map((t) => getComputedStyle(t.querySelector('.num-stack')!).boxShadow),
      faces: towers.map((t) => rect(t.querySelector('.num-face'))),
      stacks: towers.map((t) => rect(t.querySelector('.num-stack'))),
      towers: towers.map((t) => rect(t)),
      well: rect(document.querySelector('.num-well')),
      wide: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}

/** --bw-ring as the browser computes it for a box-shadow. */
async function ringValue(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.boxShadow = 'var(--bw-ring)';
    document.body.append(probe);
    const v = getComputedStyle(probe).boxShadow;
    probe.remove();
    return v;
  });
}

/** Check the cue for the row on screen: the arrow spans the two towers of the next swap, rings both, covers no face. */
async function expectCueOnRow(page: Page, label: string) {
  const step = (await numbersNextSwap(page))!;
  const [lo, hi] = [Math.min(...step), Math.max(...step)];
  await expect(cue(page)).toHaveCount(1);
  await expect(cue(page)).toBeVisible();
  const at = await cueLayout(page);
  const arrow = at.arrow!;
  expect(at.hidden, label).toBe('true');
  expect(at.rings, label).toEqual([lo, hi]);
  const ring = await ringValue(page);
  expect(at.ringShadow[lo], label).toBe(ring);
  expect(at.ringShadow[hi], label).toBe(ring);
  // the arrow runs from the middle of one tower to the middle of the other, so it points at both
  const zoom = await page.evaluate(() => Number(getComputedStyle(document.querySelector('.bw-play')!).zoom) || 1);
  expect(Math.abs(arrow.x - centreX(at.towers[lo]!)), label).toBeLessThanOrEqual(2 * zoom);
  expect(Math.abs(arrow.x + arrow.width - centreX(at.towers[hi]!)), label).toBeLessThanOrEqual(2 * zoom);
  // 34 px high (the hint arrow's size), inside the well, and clear of both towers' number faces
  expect(Math.abs(arrow.height - 34 * zoom), label).toBeLessThanOrEqual(1);
  expect(arrow.y, label).toBeGreaterThanOrEqual(at.well!.y);
  expect(arrow.y + arrow.height, label).toBeLessThanOrEqual(at.well!.y + at.well!.height);
  expect(overlaps(arrow, at.faces[lo]!), `${label}: arrow over the face of tower ${lo}`).toBe(false);
  expect(overlaps(arrow, at.faces[hi]!), `${label}: arrow over the face of tower ${hi}`).toBe(false);
  // static: nothing animates or transitions on it
  expect(at.motion!.animation, label).toBe('none');
  expect(at.wide, label).toBe(false);
  return { at, step: [lo, hi] as const };
}

/* ---------- Decision 23: the swap cue on Level 1 puzzle 1, ages 3 to 4 ---------- */

/** The four screens the finding names: both phones and the iPad both ways (834 x 1194 draws the frame at zoom 1.4). */
const SIZES = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 834, height: 1194 },
  { width: 1194, height: 834 },
] as const;

test('at ages 3 to 4 Level 1 puzzle 1 shows a still double arrow and two rings over the first swap, on both phones and the iPad both ways', { tag: '@phone-only' }, async ({ page }) => {
  await openLevel(page, '3-4');
  // the real Baloo 2, not a fallback, so the measurements below are the ones a child's iPad shows
  expect(await page.evaluate(async () => (await document.fonts.ready, document.fonts.check('800 16px "Baloo 2"')))).toBe(true);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.reload();
    await expect(numbersTowers(page)).toHaveCount(6);
    await page.evaluate(() => document.fonts.ready);
    const label = `${size.width} x ${size.height}`;
    const { at, step } = await expectCueOnRow(page, label);
    const a = at.arrow!;
    const faces = step.map((s) => at.faces[s]!);
    console.log(
      `[numbers cue] ${label}: arrow ${a.width.toFixed(1)} x ${a.height.toFixed(1)} at (${a.x.toFixed(1)}, ${a.y.toFixed(1)}), spots ${step.join(' and ')}, ` +
        `clear of the faces by ${Math.min(...faces.map((f) => f.y - (a.y + a.height))).toFixed(1)} px, well top ${at.well!.y.toFixed(1)}`,
    );
    // not a hint: the help line and the badge stay as they are, and nothing is spent
    await expect(help(page)).toHaveText(START);
    await expect(hint(page)).toHaveAccessibleName('Hint, 3 left');
    await expect(page.locator('.num-stack.is-lit')).toHaveCount(0);
    await expect(page.locator('.num-arrow')).toHaveCount(0);
  }
  expect((await savedRun(page, 'numbers', 0)).hintsLeft).toBe(3);
});

test('the cue is the same with Reduce Motion on and off, and never moves', { tag: '@phone-only' }, async ({ page }) => {
  await openLevel(page, '3-4');
  const still = await cueLayout(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.reload();
  await expect(cue(page)).toBeVisible();
  // sampled over 700 ms, every frame: the arrow and the rings stay exactly where they are
  const frames = await page.evaluate(
    () =>
      new Promise<string[]>((done) => {
        const seen: string[] = [];
        const start = performance.now();
        const tick = () => {
          const r = document.querySelector('.num-swapcue')!.getBoundingClientRect();
          const op = getComputedStyle(document.querySelector('.num-swapcue')!).opacity;
          seen.push(`${r.x},${r.y},${r.width},${r.height},${op}`);
          if (performance.now() - start < 700) requestAnimationFrame(tick);
          else done(seen);
        };
        requestAnimationFrame(tick);
      }),
  );
  expect(new Set(frames).size).toBe(1);
  const moving = await cueLayout(page);
  expect(moving.arrow).toEqual(still.arrow);
  expect(moving.rings).toEqual(still.rings);
  expect(moving.ringShadow).toEqual(still.ringShadow);
  expect(moving.motion!.animation).toBe('none');
});

test('a first pick takes the cue away for the visit, and a reload with nothing picked shows it again', async ({ page }) => {
  await openLevel(page, '3-4');
  await expectCueOnRow(page, 'before the pick');
  const row = await numbersRow(page);
  await numbersTower(page, 0).click();
  await expect(numbersTower(page, 0)).toHaveAttribute('aria-pressed', 'true');
  await expect(cue(page)).toHaveCount(0);
  await expect(cued(page)).toHaveCount(0);
  // putting the tower down again does not bring it back
  await numbersTower(page, 0).click();
  await expect(numbersTower(page, 0)).toHaveAttribute('aria-pressed', 'false');
  await expect(help(page)).toHaveText(START);
  await expect(cue(page)).toHaveCount(0);
  await expect(cued(page)).toHaveCount(0);

  // a new visit to the same puzzle, still with nothing picked: the cue is back on the same row
  await page.reload();
  expect(await numbersRow(page)).toEqual(row);
  await expectCueOnRow(page, 'after a reload');
});

test('a drag start, or a hint, takes the cue away too; the hint counts as a hint, the cue never did', async ({ page }) => {
  await openLevel(page, '3-4');
  await expectCueOnRow(page, 'before the drag');
  // a drag let go over the goal strip: the tower goes back, the row is the same, and the cue is gone
  const before = await numbersRow(page);
  const goal = await boxOf(page.locator('.num-goal'));
  await pointerDrag(page, numbersTower(page, 0), { x: goal.x + 6, y: goal.y + goal.height / 2 });
  await expect.poll(() => numbersRow(page)).toEqual(before);
  await expect(cue(page)).toHaveCount(0);
  await expect(cued(page)).toHaveCount(0);

  await page.reload();
  await expectCueOnRow(page, 'before the hint');
  await expect(hint(page)).toHaveAccessibleName('Hint, 3 left');
  await hint(page).click();
  await expect(hint(page)).toHaveAccessibleName('Hint, 2 left');
  await expect(cue(page)).toHaveCount(0);
  await expect(cued(page)).toHaveCount(0);
  // the hint's own ring and arrow show, as before
  await expect(page.locator('.num-stack.is-lit')).toHaveCount(2);
  await expect(page.locator('.num-arrow')).toHaveCount(1);
});

test('the cue never shows on puzzle 2, even after a reload there', { tag: '@phone-only' }, async ({ page }) => {
  await openLevel(page, '3-4');
  await expect(cue(page)).toHaveCount(1);
  await solveNumbersPuzzle(page);
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await expect(help(page)).toHaveText(START);
  await expect(cue(page)).toHaveCount(0);
  await expect(cued(page)).toHaveCount(0);
  await page.reload();
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await expect(numbersTowers(page)).toHaveCount(6);
  await page.waitForTimeout(200);
  await expect(cue(page)).toHaveCount(0);
  await expect(cued(page)).toHaveCount(0);
});

test('the cue never shows on Level 2 at ages 3 to 4', { tag: '@phone-only' }, async ({ page }) => {
  await openLevel(page, '3-4', 1);
  await expect(help(page)).toHaveText(START);
  await page.waitForTimeout(200);
  await expect(cue(page)).toHaveCount(0);
  await expect(cued(page)).toHaveCount(0);
});

for (const band of ['5-6', '7-8', '9-10'] as const) {
  test(`the cue never shows at ages ${band}, even on Level 1 puzzle 1`, { tag: '@phone-only' }, async ({ page }) => {
    await openLevel(page, band);
    await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
    await expect(help(page)).toHaveText(START);
    await page.waitForTimeout(200);
    await expect(cue(page)).toHaveCount(0);
    await expect(cued(page)).toHaveCount(0);
  });
}

test('a tap swap takes the cue away and it does not come back on that puzzle', { tag: '@phone-only' }, async ({ page }) => {
  await openLevel(page, '3-4');
  const step = (await numbersNextSwap(page))!;
  await swapTowers(page, step[0], step[1]);
  await expect(cue(page)).toHaveCount(0);
  await expect(cued(page)).toHaveCount(0);
  await page.waitForTimeout(400);
  await expect(cue(page)).toHaveCount(0);
});

/* ---------- The cue on short screens, and the ways a child can reach it ---------- */

test('on a phone held sideways there is no room for the arrow: the two rings show alone and every number stays clear', { tag: '@phone-only' }, async ({ page }) => {
  await openLevel(page, '3-4');
  for (const size of [{ width: 844, height: 390 }, { width: 667, height: 375 }]) {
    await page.setViewportSize(size);
    await page.reload();
    await expect(numbersTowers(page)).toHaveCount(6);
    const label = `${size.width} x ${size.height}`;
    const step = (await numbersNextSwap(page))!;
    await expect(cue(page), label).toBeHidden();
    expect((await cueLayout(page)).rings, label).toEqual([Math.min(...step), Math.max(...step)]);
  }
  // turned upright with nothing picked, the arrow is there
  await page.setViewportSize({ width: 390, height: 844 });
  await expectCueOnRow(page, 'upright again');
});

test('the arrow covers no number and no brick of any tower, on both phones and the iPad both ways', { tag: '@phone-only' }, async ({ page }) => {
  await openLevel(page, '3-4');
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.reload();
    await expect(cue(page)).toBeVisible();
    const at = await cueLayout(page);
    const label = `${size.width} x ${size.height}`;
    at.faces.forEach((face, spot) => expect(overlaps(at.arrow!, face!), `${label}: face ${spot}`).toBe(false));
    at.stacks.forEach((stack, spot) => expect(overlaps(at.arrow!, stack!), `${label}: stack ${spot}`).toBe(false));
  }
});

test('a tap on the arrow reaches the tower under it', async ({ page }) => {
  await openLevel(page, '3-4');
  const step = (await numbersNextSwap(page))!;
  const lo = Math.min(...step);
  const at = await cueLayout(page);
  await page.touchscreen.tap(centreX(at.towers[lo]!) + 12, at.arrow!.y + at.arrow!.height / 2);
  await expect(numbersTower(page, lo)).toHaveAttribute('aria-pressed', 'true');
  await expect(cue(page)).toHaveCount(0);
});

test('a keyboard pick takes the cue away; moving focus or hearing the help line does not', { tag: '@phone-only' }, async ({ page }) => {
  await openLevel(page, '3-4');
  await numbersTower(page, 0).focus();
  await page.getByRole('button', { name: 'Hear the help line' }).click();
  await expect(cue(page)).toHaveCount(1);
  await expect(cued(page)).toHaveCount(2);
  await expect(hint(page)).toHaveAccessibleName('Hint, 3 left');

  await numbersTower(page, 0).focus();
  await page.keyboard.press('Enter');
  await expect(numbersTower(page, 0)).toHaveAttribute('aria-pressed', 'true');
  await expect(cue(page)).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(numbersTower(page, 0)).toHaveAttribute('aria-pressed', 'false');
  await expect(cue(page)).toHaveCount(0);
  await expect(cued(page)).toHaveCount(0);
});

test('New puzzle from the still-child offer takes the cue away, and the new puzzle never shows it', { tag: '@phone-only' }, async ({ page }) => {
  await page.clock.install();
  await openLevel(page, '3-4');
  await expect(cue(page)).toHaveCount(1);
  // ages 3 to 4: the offer comes after 45 still seconds (run.ts STUCK)
  await page.clock.runFor(46_000);
  const offer = page.getByRole('button', { name: 'New puzzle' });
  await expect(offer).toBeVisible();
  await offer.click();
  await expect(help(page)).toHaveText('Here is a different puzzle.');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  await expect(cue(page)).toHaveCount(0);
  await expect(cued(page)).toHaveCount(0);
  await page.clock.runFor(2_000);
  await expect(cue(page)).toHaveCount(0);
  await expect(cued(page)).toHaveCount(0);
});

/* ---------- Decision 37: a resting palm does not block a drag (takeover) ---------- */

async function middleOf(el: Locator) {
  const b = await boxOf(el);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

type TouchPoint = { x: number; y: number; id: number };

/** Raw multi-touch, as on an iPad. Chromium turns these touches into pointer events. */
async function touches(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  return {
    send: (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: TouchPoint[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints }),
    done: () => cdp.detach(),
  };
}

test('a still touch on one tower does not block a finger dragging another onto a third; those two swap, and the resting touch picks nothing', async ({ page }) => {
  await openLevel(page, '5-6');
  const before = await numbersRow(page);
  const t = await touches(page);
  const palm = { ...(await middleOf(numbersTower(page, 5))), id: 1 };
  const a = await middleOf(numbersTower(page, 0));
  const b = await middleOf(numbersTower(page, 2));
  await t.send('touchStart', [palm]);
  await t.send('touchStart', [palm, { ...a, id: 2 }]);
  for (let i = 1; i <= 10; i++) await t.send('touchMove', [palm, { x: a.x + ((b.x - a.x) * i) / 10, y: a.y + ((b.y - a.y) * i) / 10, id: 2 }]);
  // the dragging finger lifts; the palm stays down
  await t.send('touchEnd', [{ ...b, id: 2 }]);
  const after = [...before];
  [after[0], after[2]] = [after[2], after[0]];
  await expect.poll(() => numbersRow(page)).toEqual(after);

  await t.send('touchEnd', [palm]);
  await t.done();
  // the resting tower was never picked, before or after the palm lifted
  await page.waitForTimeout(300);
  await expect(numbersTower(page, 5)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.num-tower[aria-pressed="true"]')).toHaveCount(0);
  await expect(help(page)).not.toHaveText('Now tap where it should go.');
  expect(await numbersRow(page)).toEqual(after);

  // and a real tap on it still picks it
  await numbersTower(page, 5).tap();
  await expect(numbersTower(page, 5)).toHaveAttribute('aria-pressed', 'true');
});

test('a palm that lands on a tower after the finger pressed another does not stop that drag, and its lift picks nothing', async ({ page }) => {
  await openLevel(page, '5-6');
  const before = await numbersRow(page);
  const t = await touches(page);
  const a = await middleOf(numbersTower(page, 0));
  const palm = { ...(await middleOf(numbersTower(page, 5))), id: 2 };
  const b = await middleOf(numbersTower(page, 2));
  await t.send('touchStart', [{ ...a, id: 1 }]);
  await t.send('touchStart', [{ ...a, id: 1 }, palm]);
  for (let i = 1; i <= 10; i++) await t.send('touchMove', [{ x: a.x + ((b.x - a.x) * i) / 10, y: a.y + ((b.y - a.y) * i) / 10, id: 1 }, palm]);
  await t.send('touchEnd', [{ ...b, id: 1 }]);
  const after = [...before];
  [after[0], after[2]] = [after[2], after[0]];
  await expect.poll(() => numbersRow(page)).toEqual(after);
  await t.send('touchEnd', [palm]);
  await t.done();
  await page.waitForTimeout(300);
  await expect(page.locator('.num-tower[aria-pressed="true"]')).toHaveCount(0);
  await expect(help(page)).not.toHaveText('Now tap where it should go.');
});

/**
 * Two fingers press two towers and lift without moving. Chromium makes no click from overlapping touches, but
 * iPad Safari can, so the events the hook sees are sent as the browser sends them for each finger: pointerdown on
 * each tower, then for each finger its pointerup and the click on its tower, in the order given.
 */
async function twoStillPresses(page: Page, a: number, b: number, order: 'second-first' | 'first-first') {
  await page.evaluate(
    ({ a, b, order }) => {
      const towers = [...document.querySelectorAll<HTMLElement>('.num-tower')];
      const at = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
      };
      const pointer = (type: string, el: HTMLElement, pointerId: number) =>
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId, pointerType: 'touch', isPrimary: pointerId === 1, button: 0, buttons: type === 'pointerup' ? 0 : 1, ...at(el) }));
      const click = (el: HTMLElement) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, detail: 1, ...at(el) }));
      const [first, second] = [towers[a], towers[b]];
      pointer('pointerdown', first, 1);
      pointer('pointerdown', second, 2);
      const lifts: [HTMLElement, number][] = order === 'second-first' ? [[second, 2], [first, 1]] : [[first, 1], [second, 2]];
      for (const [el, id] of lifts) {
        pointer('pointerup', el, id);
        click(el);
      }
    },
    { a, b, order },
  );
}

for (const order of ['second-first', 'first-first'] as const) {
  test(`two still presses on two towers, neither moving, act as one tap (${order === 'second-first' ? 'the second lifts first' : 'the first lifts first'})`, async ({ page }) => {
    await openLevel(page, '5-6');
    const before = await numbersRow(page);
    await twoStillPresses(page, 1, 4, order);
    await page.waitForTimeout(300);
    // no swap: the two presses are one tap, on the tower the second finger pressed (the press still tracked)
    expect(await numbersRow(page)).toEqual(before);
    await expect(numbersTower(page, 4)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.num-tower[aria-pressed="true"]')).toHaveCount(1);
    await expect(help(page)).toHaveText('Now tap where it should go.');
  });
}

/* ---------- Decision 38: the reduced-motion fade gets past the 0.01 ms safety net ---------- */

test('under Reduce Motion a moved tower fades in over 150 ms and never slides; the slip ring still goes after 660 ms', async ({ page }) => {
  await openLevel(page, '7-8');
  await page.evaluate(() => {
    const w = window as unknown as { __moved: { anim: string; dur: string; transform: string }[] };
    w.__moved = [];
    const tick = () => {
      for (const t of document.querySelectorAll('.num-tower.is-moved')) {
        const s = getComputedStyle(t.querySelector('.num-stack')!);
        w.__moved.push({ anim: s.animationName, dur: s.animationDuration, transform: getComputedStyle(t).transform });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  expect(await page.locator('.num-stack').first().evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0.15s');

  // a swap that makes the row worse: both towers move, and both ring
  const row = await numbersRow(page);
  let pair: [number, number] | null = null;
  for (let i = 0; i + 1 < row.length && !pair; i++) if (row[i] < row[i + 1]) pair = [i, i + 1];
  await swapTowers(page, pair![0], pair![1]);
  await expect(page.locator('.num-tower.is-wrong')).toHaveCount(2);
  await page.waitForTimeout(500);
  const moved = await page.evaluate(() => (window as unknown as { __moved: { anim: string; dur: string; transform: string }[] }).__moved);
  expect(moved.length).toBeGreaterThan(0);
  for (const m of moved) {
    expect(m.anim).toBe('num-fade');
    expect(m.dur).toBe('0.15s');
    expect(m.transform).toBe('none');
  }
  // the ring goes after about 660 ms, its fade included
  await expect(page.locator('.num-tower.is-wrong')).toHaveCount(0, { timeout: 1500 });
  await page.waitForTimeout(250);
  const shadows = await page.locator('.num-stack').evaluateAll((els) => els.map((el) => getComputedStyle(el).boxShadow));
  expect(shadows.every((s) => s === 'none')).toBe(true);
});
