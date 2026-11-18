/**
 * Shape Sorter, usability round 2: short phones get 76 px holes and the 8-piece boards hide the fact bar,
 * which the speaker still reads (sorter-numbers-1); at ages 3 to 6, after a second slip with the same piece,
 * its own hole rings when that piece is picked or dragged again (sorter-numbers-7); and the hole's 150 ms
 * fade under Reduce Motion (a11y-cross-10).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { pieceName, puzzle } from '../src/games/sorter/puzzles';
import { seed, sorterHole, sorterHoles, sorterPiece, sorterTray, starsUpTo, type Band } from './app';

const help = (page: Page) => page.locator('.bw-helprow__line');

/** A child of this band on this level (1-based), with the tray on screen. */
async function openLevel(page: Page, level: number, ageBand: Band = '5-6') {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand, games: level > 1 ? { sorter: { stars: starsUpTo(level - 1) } } : {} }]);
  await page.goto(`/#/game/sorter/${level}`);
  await expect(sorterTray(page).getByRole('button').first()).toBeVisible();
}

/** Record what the app asks the browser's voice to say, instead of saying it. */
async function recordSpeech(page: Page) {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as { __spoken: string[] }).__spoken = spoken;
    const voice = { speak: (u: { text: string }) => spoken.push(u.text), cancel: () => {}, getVoices: () => [], addEventListener: () => {} };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => voice });
  });
  return () => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.slice());
}

const box = async (el: Locator) => {
  const b = await el.boundingBox();
  if (!b) throw new Error('Not on screen');
  return b;
};

/* ---------- sorter-numbers-1: short phones ---------- */

const SHORT = [
  { width: 375, height: 667 },
  { width: 390, height: 664 },
];

for (const viewport of SHORT) {
  test.describe(`short phone ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });
    for (let level = 3; level <= 9; level++) {
      const count = puzzle(level - 1, 0).pieces.length;
      test(`Level ${level} (${count} pieces): every hole is inside the panel, above the tray, and takes a finger anywhere on it`, { tag: '@phone-only' }, async ({ page }) => {
        const spoken = await recordSpeech(page);
        await openLevel(page, level);
        // Measured with the real font (Baloo 2), never a fallback.
        await expect.poll(() => page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('800 16px "Baloo 2"')))).toBe(true);
        const holes = sorterHoles(page).getByRole('button');
        await expect(holes).toHaveCount(count);
        const panel = await box(page.locator('.sort-holes'));
        const well = await box(page.locator('.sort-well'));
        expect(panel.y + panel.height, 'holes panel bottom at or above the tray well').toBeLessThanOrEqual(well.y + 0.5);
        for (let i = 0; i < count; i++) {
          const hole = holes.nth(i);
          const b = await box(hole);
          expect(b.height, 'a hole is a finger wide').toBeGreaterThanOrEqual(54);
          expect(b.y + b.height, 'hole inside the panel').toBeLessThanOrEqual(panel.y + panel.height + 0.5);
          for (const at of [0.15, 0.5, 0.85]) {
            const hit = await hole.evaluate((el, at) => {
              const r = el.getBoundingClientRect();
              return document.elementFromPoint(r.x + r.width / 2, r.y + r.height * at)?.closest('.sort-hole') === el;
            }, at);
            expect(hit, `hole ${i + 1} takes a finger at ${at * 100}% of its height`).toBe(true);
          }
        }
        const fact = page.locator('.sort-fact');
        if (count === 8) {
          // No room for the fact bar: it goes, and the speaker still reads the fact after the help line.
          await expect(fact).toBeHidden();
          const factText = (await fact.locator('.sort-fact__text').textContent()) ?? '';
          await page.getByRole('button', { name: 'Hear the help line' }).click();
          await expect.poll(spoken).toEqual([`${(await help(page).textContent())!.trim()} ${factText}`]);
          expect(factText).not.toBe('');
        } else {
          // The fact bar is whole, between the panel and the tray well, with nothing over it.
          await expect(fact).toBeVisible();
          const f = await box(fact);
          expect(f.y, 'fact bar under the holes panel').toBeGreaterThanOrEqual(panel.y + panel.height - 0.5);
          expect(f.y + f.height, 'fact bar above the tray well').toBeLessThanOrEqual(well.y + 0.5);
          const clear = await fact.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return [0.1, 0.5, 0.9].every((x) => [0.2, 0.8].every((y) => el.contains(document.elementFromPoint(r.x + r.width * x, r.y + r.height * y))));
          });
          expect(clear, 'nothing lies over the fact bar').toBe(true);
        }
      });
    }
  });
}

/** Every hole of the board on screen is whole, inside the panel, above the tray, and takes a finger anywhere on it. */
async function expectHolesFit(page: Page, count: number) {
  const holes = sorterHoles(page).getByRole('button');
  await expect(holes).toHaveCount(count);
  const panel = await box(page.locator('.sort-holes'));
  const well = await box(page.locator('.sort-well'));
  expect(panel.y + panel.height, 'holes panel bottom at or above the tray well').toBeLessThanOrEqual(well.y + 0.5);
  for (let i = 0; i < count; i++) {
    const hole = holes.nth(i);
    const b = await box(hole);
    expect(b.height, 'a hole is a finger wide').toBeGreaterThanOrEqual(54);
    expect(b.y + b.height, 'hole inside the panel').toBeLessThanOrEqual(panel.y + panel.height + 0.5);
    for (const at of [0.15, 0.5, 0.85]) {
      const hit = await hole.evaluate((el, at) => {
        const r = el.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height * at)?.closest('.sort-hole') === el;
      }, at);
      expect(hit, `hole ${i + 1} takes a finger at ${at * 100}% of its height`).toBe(true);
    }
  }
}

/** The fact bar is whole, between the holes panel and the tray well, with nothing over it. */
async function expectFactWhole(page: Page) {
  const fact = page.locator('.sort-fact');
  await expect(fact).toBeVisible();
  const panel = await box(page.locator('.sort-holes'));
  const well = await box(page.locator('.sort-well'));
  const f = await box(fact);
  expect(f.y, 'fact bar under the holes panel').toBeGreaterThanOrEqual(panel.y + panel.height - 0.5);
  expect(f.y + f.height, 'fact bar above the tray well').toBeLessThanOrEqual(well.y + 0.5);
  const clear = await fact.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return [0.1, 0.5, 0.9].every((x) => [0.2, 0.8].every((y) => el.contains(document.elementFromPoint(r.x + r.width * x, r.y + r.height * y))));
  });
  expect(clear, 'nothing lies over the fact bar').toBe(true);
}

/* An 8-piece board on a phone needs 794 px at the full 92 px holes, so the short-phone sizes reach past 700 px
   for that board alone: 76 px holes up to 793 px, and the fact bar goes only under 726 px, where it has no room. */
const TALLER_PHONES = [
  { width: 390, height: 701, fact: false },
  { width: 390, height: 725, fact: false },
  { width: 390, height: 726, fact: true },
  { width: 414, height: 736, fact: true },
  { width: 360, height: 740, fact: true },
  { width: 390, height: 793, fact: true },
];

for (const { fact, ...viewport } of TALLER_PHONES) {
  test.describe(`taller phone ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });
    test(`Level 7 (8 pieces): the holes fit above the tray and the fact bar is ${fact ? 'whole' : 'hidden'}`, { tag: '@phone-only' }, async ({ page }) => {
      await openLevel(page, 7);
      await expect.poll(() => page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('800 16px "Baloo 2"')))).toBe(true);
      await expectHolesFit(page, 8);
      expect((await box(sorterHoles(page).getByRole('button').first())).width).toBe(76);
      if (fact) await expectFactWhole(page);
      else await expect(page.locator('.sort-fact')).toBeHidden();
    });
  });
}

test.describe('phone 390x701', () => {
  test.use({ viewport: { width: 390, height: 701 }, isMobile: true, hasTouch: true });
  test('a 6-piece board has the room: its holes stay 92 px with the fact bar whole', { tag: '@phone-only' }, async ({ page }) => {
    await openLevel(page, 5);
    await expectHolesFit(page, 6);
    expect((await box(sorterHoles(page).getByRole('button').first())).width).toBe(92);
    await expectFactWhole(page);
  });
});

test.describe('phone 390x794', () => {
  test.use({ viewport: { width: 390, height: 794 }, isMobile: true, hasTouch: true });
  test('Level 7 (8 pieces) has the room for 92 px holes and the fact bar', { tag: '@phone-only' }, async ({ page }) => {
    await openLevel(page, 7);
    await expectHolesFit(page, 8);
    expect((await box(sorterHoles(page).getByRole('button').first())).width).toBe(92);
    await expectFactWhole(page);
  });
});

/* A short wide screen (iPad mini sideways in Safari) has one tray row, so the biggest board keeps its fact bar
   while there is room for it. */
for (const { fact, ...viewport } of [
  { width: 1133, height: 670, fact: true },
  { width: 1024, height: 642, fact: true },
  { width: 1024, height: 641, fact: false },
]) {
  test.describe(`wide short screen ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, isMobile: false, hasTouch: true });
    test(`Level 7 (8 pieces): the holes fit and the fact bar is ${fact ? 'whole' : 'hidden'}`, { tag: '@phone-only' }, async ({ page }) => {
      await openLevel(page, 7);
      await expectHolesFit(page, 8);
      if (fact) await expectFactWhole(page);
      else await expect(page.locator('.sort-fact')).toBeHidden();
    });
  });
}

test('at full height the holes stay 92 px and the biggest board keeps its fact bar', async ({ page }) => {
  await openLevel(page, 9);
  const zoom = page.viewportSize()!.width > 600 ? 1.4 : 1;
  const hole = await box(sorterHoles(page).getByRole('button').first());
  expect(Math.abs(hole.width - 92 * zoom)).toBeLessThanOrEqual(0.5);
  await expect(page.locator('.sort-fact')).toBeVisible();
});

/* ---------- sorter-numbers-7: a ring on the right hole after a second slip with the same piece ---------- */

/** Level 1 board 1: two shapes, each with its own hole, so the other hole is always wrong. */
async function level1(page: Page, ageBand: Band) {
  await openLevel(page, 1, ageBand);
  const [a, b] = puzzle(0, 0).pieces.map((p) => pieceName(p, false));
  return { a, b };
}

const targets = (page: Page) => page.locator('.sort-hole.is-target');

/** Tap a piece, then a hole that is not its own: one slip. */
async function slip(page: Page, piece: string, wrongHole: string) {
  await sorterPiece(page, piece).click();
  await sorterHole(page, wrongHole).click();
  await expect(help(page)).toHaveClass(/is-wrong/);
}

for (const ageBand of ['3-4', '5-6'] as Band[]) {
  test(`ages ${ageBand}: after two slips with one piece, picking it rings its own hole until it goes home`, async ({ page }) => {
    const { a, b } = await level1(page, ageBand);
    await slip(page, a, b);
    // One slip: no ring when the piece is picked again.
    await sorterPiece(page, a).click();
    await expect(sorterPiece(page, a)).toHaveAttribute('aria-pressed', 'true');
    await expect(targets(page)).toHaveCount(0);
    await sorterHole(page, b).click();
    await expect(help(page)).toHaveClass(/is-wrong/);
    // Two slips: picking it rings exactly its own hole, with a still ring and no words.
    await expect(targets(page)).toHaveCount(0);
    const line = await help(page).textContent();
    await sorterPiece(page, a).click();
    await expect(targets(page)).toHaveCount(1);
    await expect(sorterHole(page, a)).toHaveClass(/is-target/);
    expect(await sorterHole(page, a).evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
    expect(await help(page).textContent()).not.toBe(line);
    await expect(help(page)).toHaveText(`Now tap the ${a} hole.`);
    // Picking the other piece takes the ring away.
    await sorterPiece(page, b).click();
    await expect(targets(page)).toHaveCount(0);
    // Back on the piece: the ring again; putting it down takes it away.
    await sorterPiece(page, a).click();
    await expect(targets(page)).toHaveCount(1);
    await sorterPiece(page, a).click();
    await expect(sorterPiece(page, a)).toHaveAttribute('aria-pressed', 'false');
    await expect(targets(page)).toHaveCount(0);
    // Placing it takes the ring away.
    await sorterPiece(page, a).click();
    await expect(targets(page)).toHaveCount(1);
    await sorterHole(page, a).click();
    await expect(page.getByRole('img', { name: `Filled ${a} hole`, exact: true })).toBeVisible();
    await expect(targets(page)).toHaveCount(0);
  });

  test(`ages ${ageBand}: after two slips with one piece, dragging it rings its own hole for the drag`, async ({ page }) => {
    const { a, b } = await level1(page, ageBand);
    await slip(page, a, b);
    await slip(page, a, b);
    const from = await box(sorterPiece(page, a));
    const to = await box(sorterHole(page, a));
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 - 10, { steps: 3 });
    await expect(help(page)).toHaveText(`Drop the ${a} in its hole.`);
    await expect(targets(page)).toHaveCount(1);
    await expect(sorterHole(page, a)).toHaveClass(/is-target/);
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByRole('img', { name: `Filled ${a} hole`, exact: true })).toBeVisible();
    await expect(targets(page)).toHaveCount(0);
  });
}

test.describe('with motion on', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('ages 3 to 4: the same still ring on the right hole after two slips, gone when the piece goes home', async ({ page }) => {
    const { a, b } = await level1(page, '3-4');
    await slip(page, a, b);
    await slip(page, a, b);
    await sorterPiece(page, a).click();
    await expect(targets(page)).toHaveCount(1);
    await expect(sorterHole(page, a)).toHaveClass(/is-target/);
    // A ring, not a movement: the hole does not animate.
    expect(await sorterHole(page, a).evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    await sorterHole(page, a).click();
    await expect(page.getByRole('img', { name: `Filled ${a} hole`, exact: true })).toBeVisible();
    await expect(targets(page)).toHaveCount(0);
  });
});

test('the count is per piece: one slip each with two pieces rings nothing', async ({ page }) => {
  const { a, b } = await level1(page, '3-4');
  await slip(page, a, b);
  await slip(page, b, a);
  await sorterPiece(page, a).click();
  await expect(sorterPiece(page, a)).toHaveAttribute('aria-pressed', 'true');
  await expect(targets(page)).toHaveCount(0);
  await sorterPiece(page, b).click();
  await expect(sorterPiece(page, b)).toHaveAttribute('aria-pressed', 'true');
  await expect(targets(page)).toHaveCount(0);
});

for (const ageBand of ['7-8', '9-10'] as Band[]) {
  test(`ages ${ageBand}: never a ring, however many slips`, { tag: '@phone-only' }, async ({ page }) => {
    const { a, b } = await level1(page, ageBand);
    for (let i = 0; i < 2; i++) await slip(page, a, b);
    await sorterPiece(page, a).click();
    await expect(sorterPiece(page, a)).toHaveAttribute('aria-pressed', 'true');
    await expect(targets(page)).toHaveCount(0);
  });
}

test('a new puzzle starts the count again', { tag: '@phone-only' }, async ({ page }) => {
  const { a, b } = await level1(page, '5-6');
  await slip(page, a, b);
  await slip(page, a, b);
  // Solve this board, then the next one starts with no slips counted.
  await sorterPiece(page, a).click();
  await sorterHole(page, a).click();
  await sorterPiece(page, b).click();
  await sorterHole(page, b).click();
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  const [c, d] = puzzle(0, 1).pieces.map((p) => pieceName(p, false));
  await slip(page, c, d);
  await sorterPiece(page, c).click();
  await expect(sorterPiece(page, c)).toHaveAttribute('aria-pressed', 'true');
  await expect(targets(page)).toHaveCount(0);
});

test('a piece that comes back on the next board starts from no slips', { tag: '@phone-only' }, async ({ page }) => {
  // Level 3's first two boards share the star, so a count carried over would ring its hole after one slip.
  await openLevel(page, 3, '5-6');
  const first = puzzle(2, 0).pieces.map((p) => pieceName(p, false));
  const second = puzzle(2, 1).pieces.map((p) => pieceName(p, false));
  const shared = 'star';
  expect(first).toContain(shared);
  expect(second).toContain(shared);
  const wrong = (board: string[]) => board.find((name) => name !== shared)!;
  await slip(page, shared, wrong(first));
  await slip(page, shared, wrong(first));
  await sorterPiece(page, shared).click();
  await expect(targets(page)).toHaveCount(1);
  for (const name of [shared, ...first.filter((n) => n !== shared)]) {
    if ((await sorterPiece(page, name).getAttribute('aria-pressed')) !== 'true') await sorterPiece(page, name).click();
    await sorterHole(page, name).click();
  }
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(sorterPiece(page, second[0])).toBeVisible();
  await slip(page, shared, wrong(second));
  await sorterPiece(page, shared).click();
  await expect(sorterPiece(page, shared)).toHaveAttribute('aria-pressed', 'true');
  await expect(targets(page)).toHaveCount(0);
});

/* ---------- sorter-numbers-9: what counts as a hole tapped with nothing picked ---------- */

const PICK_FIRST = 'First pick a shape in the tray.';

test('a double tap on a wrong hole keeps the wrong line up while the hole is red; a later tap asks for a shape', { tag: '@phone-only' }, async ({ page }) => {
  // The ring lasts 660 ms; a paused clock keeps it on screen until the test moves time on.
  await page.clock.install();
  const { a, b } = await level1(page, '3-4');
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
  await slip(page, a, b);
  const wrongLine = await help(page).textContent();
  await sorterHole(page, b).click();
  await expect(help(page)).toHaveText(wrongLine!);
  await expect(help(page)).toHaveClass(/is-wrong/);
  await expect(sorterTray(page)).not.toHaveClass(/is-nudge/);
  await expect(page.locator('.sort-well')).not.toHaveClass(/is-pick-first/);
  // The ring has faded: the same hole tapped again is a hole with nothing picked.
  await page.clock.runFor(700);
  await expect(page.locator('.sort-hole.is-wrong')).toHaveCount(0);
  await sorterHole(page, b).click();
  await expect(help(page)).toHaveText(PICK_FIRST);
});

test('another hole tapped while the wrong hole is still red asks for a shape', { tag: '@phone-only' }, async ({ page }) => {
  await page.clock.install();
  await openLevel(page, 2, '3-4');
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
  const [a, b, c] = puzzle(1, 0).pieces.map((p) => pieceName(p, false));
  await slip(page, a, b);
  await sorterHole(page, c).click();
  await expect(help(page)).toHaveText(PICK_FIRST);
});

test('the click a browser sends after a drag is no tap on the hole under it', { tag: '@phone-only' }, async ({ page }) => {
  const { a } = await level1(page, '3-4');
  const line = await help(page).textContent();
  // detail 1 with no press on the hole: what a pointer release over a hole can leave behind.
  await sorterHole(page, a).evaluate((el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })));
  await expect(help(page)).toHaveText(line!);
  await expect(page.locator('.sort-well')).not.toHaveClass(/is-pick-first/);
});

test('a hole clicked by keyboard during a drag asks for nothing: the line stays on the drag', { tag: '@phone-only' }, async ({ page }) => {
  const { a, b } = await level1(page, '3-4');
  const from = await box(sorterPiece(page, a));
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 - 10, { steps: 3 });
  await expect(help(page)).toHaveText(`Drop the ${a} in its hole.`);
  await sorterHole(page, b).evaluate((el) => (el as HTMLElement).click());
  await expect(help(page)).toHaveText(`Drop the ${a} in its hole.`);
  await expect(page.locator('.sort-well')).not.toHaveClass(/is-pick-first/);
  await page.mouse.up();
});

/* ---------- a11y-cross-10: the hole's fade keeps its 150 ms under Reduce Motion ---------- */

test('with Reduce Motion a hole still fades over 150 ms, and the wrong shake stays off', async ({ page }) => {
  const { a, b } = await level1(page, '5-6');
  const hole = sorterHole(page, b);
  expect(await hole.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0.15s');
  await slip(page, a, b);
  expect(await hole.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
});
