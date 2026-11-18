/**
 * A phone held sideways (usability round 2, decision 4). Safari ignores the manifest's portrait lock in a tab,
 * so an iPhone turned to 844x390 or 667x375 must still play every game. Under 500px tall the screen uses the
 * phone column laid out at a 667px floor and the page scrolls: every control, brick, tile, square and hole
 * can be scrolled to and tapped, nothing scrolls sideways, and no text asks to rotate (WCAG 1.3.4).
 * A stroke or drag on a board never scrolls the page, and turning the phone mid-puzzle keeps the puzzle.
 *
 * Each journey sets its own screen size, so it runs once (the tag keeps the tablet project out). Measured with
 * the real font (Baloo 2).
 */
import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';
import {
  type Band,
  builderBoardCells,
  builderPicture,
  builderSquare,
  builderSwatch,
  dots,
  passGrownUpCheck,
  seed,
  starsUpTo,
} from './app';

const SIZES = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
];

interface Place {
  name: string;
  band?: Band;
  /** Levels already finished in this game, so the level opens. */
  game?: [string, number];
  open: (page: Page) => Promise<void>;
  /** The controls and the play area that must never overlap: [controls, body]. */
  apart?: [string, string];
}

const level = (game: string, n: number, band: Band = '5-6', apart: [string, string] = ['.bw-play__slot', '.bw-play__body']): Place => ({
  name: `${game} L${n} at ${band}`,
  band,
  game: [game, n - 1],
  apart,
  open: async (page) => {
    await page.goto(`/#/game/${game}/${n}`);
    await expect(dots(page)).toBeVisible();
  },
});

const PLACES: Place[] = [
  level('escape', 1, '5-6', ['.esc-tools', '.esc-stage']),
  level('escape', 9, '5-6', ['.esc-tools', '.esc-stage']),
  {
    name: 'drop Stage 1',
    band: '5-6',
    apart: ['.drop-pad', '.drop-main'],
    open: async (page) => {
      await page.goto('/#/game/drop/1');
      const start = page.getByRole('dialog').getByRole('button', { name: 'Start' });
      await start.scrollIntoViewIfNeeded();
      await start.click();
      await expect(page.getByRole('group', { name: 'Controls' })).toBeVisible();
    },
  },
  level('letters', 1, '3-4', ['.lb-player', '.lb-body']),
  level('letters', 12, '5-6', ['.lb-player', '.lb-body']),
  level('mixer', 3),
  level('sorter', 7),
  level('pattern', 4),
  level('numbers', 1),
  level('builder', 1),
  level('builder', 10),
  level('math', 1),
  {
    name: 'Home',
    open: async (page) => {
      await page.goto('/#/');
      await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
    },
  },
  {
    name: "Who's playing",
    open: async (page) => {
      await page.goto('/#/players');
      await expect(page.locator('.sc-player').first()).toBeVisible();
    },
  },
  {
    name: 'Settings',
    open: async (page) => {
      await page.goto('/#/');
      await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
      const sum = page.locator('.sc-gate__sum');
      await expect(sum).toBeVisible();
      await sum.scrollIntoViewIfNeeded();
      await passGrownUpCheck(page);
      await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeAttached();
    },
  },
  {
    name: 'the sticker book',
    open: async (page) => {
      await page.goto('/#/stickers');
      await expect(page.getByRole('button', { name: /^Sticker/ }).first()).toBeVisible();
    },
  },
];

/**
 * Every control on screen (buttons, links and the role=button bricks, tiles, squares and holes), each scrolled
 * into view as a finger would scroll to it: the ones whose centre is covered by something else, or that sit
 * outside the screen even after scrolling.
 */
const unreachable = (page: Page) =>
  page.evaluate(async () => {
    const sel = 'button, a[href], [role="button"], [role="checkbox"], [role="switch"], [role="radio"], [role="slider"], input, select';
    const shown = (e: Element) => {
      if (e.closest('[inert], [aria-hidden="true"]')) return false;
      const cs = getComputedStyle(e);
      if (cs.visibility !== 'visible' || cs.pointerEvents === 'none') return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const found = [...document.querySelectorAll(sel)].filter(shown);
    const bad: string[] = [];
    for (const e of found) {
      e.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      await frame();
      const r = e.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const name = `${e.tagName.toLowerCase()}.${String((e as HTMLElement).className).split(' ')[0]} "${e.getAttribute('aria-label') ?? (e.textContent ?? '').trim().slice(0, 30)}" at ${Math.round(x)},${Math.round(y)}`;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) {
        bad.push(`${name}: off screen`);
        continue;
      }
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === e || e.contains(hit))) bad.push(`${name}: covered by ${hit ? `${hit.tagName.toLowerCase()}.${String((hit as HTMLElement).className).split(' ')[0]}` : 'nothing'}`);
    }
    return { count: found.length, bad };
  });

/** Buttons, bricks, tiles and squares that are drawn but too small for a finger. */
const squashed = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('main button, main [role="button"]')]
      .filter((e) => e.checkVisibility() && !e.closest('[inert], [aria-hidden="true"]'))
      .flatMap((e) => {
        const r = e.getBoundingClientRect();
        return r.width < 24 || r.height < 24 ? [`${e.getAttribute('aria-label') ?? e.className} ${Math.round(r.width)}x${Math.round(r.height)}`] : [];
      }),
  );

const boxOf = async (el: Locator) => {
  const b = await el.boundingBox();
  if (!b) throw new Error('Not on screen');
  return b;
};
const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/**
 * Every line of words on screen, each scrolled into view: the ones something else is drawn over (a keypad
 * over the help line). The boxes of a shrunken play area can stay apart while its content runs under the
 * controls, so this looks at what is painted.
 */
const coveredWords = (page: Page) =>
  page.evaluate(async () => {
    const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
    const main = document.querySelector('main.bw-screen')!;
    const walk = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const bad: string[] = [];
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const words = (n.textContent ?? '').trim();
      const el = n.parentElement;
      if (!words || !el || el.closest('[inert]')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility !== 'visible' || cs.pointerEvents === 'none' || Number(cs.opacity) === 0) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      if (el.getBoundingClientRect().height < 4) continue; // read aloud only: a 1px visually hidden line
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      await frame();
      for (const r of range.getClientRects()) {
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        // Its own widget (a tile's label beside its value) is not something drawn over it.
        if (!hit || hit === el || hit.contains(el) || el.parentElement?.contains(hit)) continue;
        bad.push(`"${words.slice(0, 30)}" under ${hit.tagName.toLowerCase()}.${String((hit as HTMLElement).className).split(' ')[0]}`);
        break;
      }
    }
    return bad;
  });

/* ---------- Touch input ---------- */

/** A one-finger drag through `points`, as real touch input (so the browser may scroll with it). */
async function fingerDrag(cdp: CDPSession, points: { x: number; y: number }[]) {
  const [first, ...rest] = points;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: first.x, y: first.y }] });
  for (const p of rest) {
    for (let k = 1; k <= 4; k++) {
      const prev = points[points.indexOf(p) - 1];
      const x = prev.x + ((p.x - prev.x) * k) / 4;
      const y = prev.y + ((p.y - prev.y) * k) / 4;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    }
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** A one-finger swipe by `dy` px through the browser's own gesture pipeline, which honours touch-action. */
const swipe = (cdp: CDPSession, from: { x: number; y: number }, dy: number) =>
  cdp.send('Input.synthesizeScrollGesture', { x: Math.round(from.x), y: Math.round(from.y), yDistance: dy, gestureSourceType: 'touch', speed: 800 });

const scrolled = (page: Page) => page.evaluate(() => (document.querySelector('main.bw-screen')?.scrollTop ?? 0) + (document.scrollingElement?.scrollTop ?? 0));
/** Where the screen comes to rest: a finger lifted mid-swipe leaves it gliding for a moment. */
async function settled(page: Page): Promise<number> {
  let was = await scrolled(page);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150);
    const now = await scrolled(page);
    if (now === was) return now;
    was = now;
  }
  throw new Error('The screen never came to rest');
}
/** A swipe that can move the screen from scroll position `top`: down from the top, up otherwise. */
const dy0 = (top: number) => (top > 0 ? 100 : -100);
const centre = async (el: Locator) => {
  const b = await boxOf(el);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

for (const size of SIZES) {
  const at = `${size.width}x${size.height}`;

  test.describe(`a phone held sideways at ${at} @phone-only`, () => {
    test.use({ viewport: size, isMobile: true, hasTouch: true });

    for (const place of PLACES) {
      test(`${place.name}: every control can be scrolled to and tapped, nothing scrolls sideways, nothing asks to rotate`, async ({ page }) => {
        const games = place.game ? { [place.game[0]]: { stars: starsUpTo(place.game[1]) } } : undefined;
        await seed(page, [{ id: 'maya', name: 'Maya', ageBand: place.band ?? '5-6', games }]);
        await place.open(page);
        // The app's own font, served (not a fallback): loading it from the page resolves and it is ready.
        expect(await page.evaluate(async () => (await document.fonts.load('800 16px "Baloo 2"')).length), 'the real font').toBeGreaterThan(0);
        expect(await page.evaluate(() => document.fonts.check('800 16px "Baloo 2"')), 'the real font').toBe(true);

        // The phone frame at its 667px floor, not the tablet board.
        const main = page.locator('main.bw-screen');
        await expect(main).toHaveClass(/bw-screen--phone/);
        await expect(main).toHaveClass(/bw-screen--short/);

        const { count, bad } = await unreachable(page);
        expect(count, 'controls found').toBeGreaterThan(0);
        expect(bad, at).toEqual([]);
        // A board that lost its height still has its squares in the page: none may be squashed to nothing.
        expect(await squashed(page), 'controls too small to press').toEqual([]);

        expect(await page.evaluate(() => document.documentElement.scrollWidth), 'no sideways scroll').toBeLessThanOrEqual(size.width);
        expect(await main.evaluate((m) => m.scrollWidth - m.clientWidth), 'nothing cut off at the sides').toBeLessThanOrEqual(0);
        expect(await page.evaluate(() => document.body.innerText)).not.toMatch(/\brotat|turn (your|the) (phone|device|ipad)|landscape|portrait/i);

        if (place.apart) {
          const [controls, body] = place.apart;
          const a = await boxOf(page.locator(controls).first());
          const b = await boxOf(page.locator(body).first());
          expect(overlap(a, b), `${controls} and ${body}`).toBe(false);
          // The play area holds all it draws: nothing of it runs on under the controls.
          expect(await page.locator(body).first().evaluate((e) => e.scrollHeight - e.clientHeight), `${body} holds its content`).toBeLessThanOrEqual(1);
        }
        expect(await coveredWords(page), 'words something is drawn over').toEqual([]);
        // The frame grows with what it holds, so its bottom padding (and a phone's home bar) stays under the last control.
        expect(await page.locator('.bw-screen__frame').evaluate((f) => f.scrollHeight - f.clientHeight), 'the frame holds its content').toBeLessThanOrEqual(1);

        // One scroller: the page behind the screen has nothing to scroll (a read-aloud line must not stretch it).
        expect(await page.evaluate(() => document.scrollingElement!.scrollHeight - innerHeight), 'the page itself never scrolls').toBeLessThanOrEqual(0);

        // Where the screen is taller than the phone, a finger swipe off the boards (on the heading) scrolls it.
        const scroller = await main.evaluate((m) => ({ scrolls: m.scrollHeight > m.clientHeight, top: m.scrollTop }));
        if (scroller.scrolls) {
          await main.evaluate((m) => m.scrollTo(0, 0));
          const cdp = await page.context().newCDPSession(page);
          await swipe(cdp, await centre(page.locator('h1').first()), -150);
          await expect.poll(() => scrolled(page), 'a swipe scrolls the screen').toBeGreaterThan(0);
        }
      });
    }
  });
}

/* ---------- A finger in a list reaches the end of the screen ---------- */

/** The screen's last control, and whether it is fully on the phone now. */
const lastControl = (page: Page) =>
  page.evaluate(() => {
    const all = [...document.querySelectorAll<HTMLElement>('main button, main a[href], main input')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !e.closest('[inert]');
    });
    const e = all[all.length - 1];
    const r = e.getBoundingClientRect();
    return { name: e.getAttribute('aria-label') ?? (e.textContent ?? '').trim(), seen: r.top >= 0 && r.bottom <= innerHeight };
  });

const LISTS: { name: string; open: (page: Page) => Promise<void> }[] = [
  { name: "Who's playing with six children", open: async (page) => { await page.goto('/#/players'); await expect(page.locator('.sc-player').first()).toBeVisible(); } },
  {
    name: 'Settings',
    open: async (page) => {
      await page.goto('/#/');
      await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
      await page.locator('.sc-gate__sum').scrollIntoViewIfNeeded();
      await passGrownUpCheck(page);
      await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeAttached();
    },
  },
  { name: 'Help', open: async (page) => { await page.goto('/#/help'); await expect(page.locator('.sc-help')).toBeVisible(); } },
  { name: 'the terms', open: async (page) => { await page.goto('/#/help/terms'); await expect(page.locator('.sc-doc')).toBeVisible(); } },
  { name: 'the sticker book', open: async (page) => { await page.goto('/#/stickers'); await expect(page.getByRole('button', { name: /^Sticker/ }).first()).toBeVisible(); } },
];

for (const size of SIZES) {
  test.describe(`a finger on a list at ${size.width}x${size.height} @phone-only`, () => {
    test.use({ viewport: size, isMobile: true, hasTouch: true });

    for (const list of LISTS) {
      test(`${list.name}: swiping in the middle of the column reaches the last control and comes back`, async ({ page }) => {
        const kids = Array.from({ length: 6 }, (_, i) => ({ id: `kid${i}`, name: `Kid ${i + 1}`, ageBand: '5-6' as const }));
        await seed(page, kids);
        await list.open(page);
        const cdp = await page.context().newCDPSession(page);
        const finger = { x: Math.round(size.width / 2), y: Math.round(size.height * 0.75) };
        for (let i = 0; i < 16 && !(await lastControl(page)).seen; i++) await swipe(cdp, finger, -220);
        expect(await lastControl(page), 'the last control is on the phone').toMatchObject({ seen: true });

        for (let i = 0; i < 16 && (await scrolled(page)) > 0; i++) await swipe(cdp, { x: finger.x, y: Math.round(size.height * 0.25) }, 220);
        expect(await scrolled(page), 'back at the top').toBe(0);
      });
    }
  });
}

/* ---------- A level card taller than the phone ---------- */

test.describe('a level card taller than the phone @phone-only', () => {
  test.use({ viewport: { width: 568, height: 320 }, isMobile: true, hasTouch: true });

  test('scrolls inside its backdrop: the title and the button can both be reached, and nothing is cut off', async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', games: { escape: { stars: starsUpTo(999) } } }]);
    await page.goto('/#/game/escape');
    const card = page.getByRole('dialog');
    await expect(card).toBeVisible();
    const scrim = page.locator('.bw-levelcard-scrim');
    expect(await scrim.evaluate((e) => e.scrollHeight - e.clientHeight), 'the card is taller than the phone').toBeGreaterThan(0);

    // Focus starts on the green button, so it is on the phone from the first moment.
    const primary = card.getByRole('link', { name: 'Back to games' });
    await expect(primary).toBeFocused();
    const onPhone = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    };
    expect(await primary.evaluate(onPhone), 'the button').toBe(true);

    // A finger on the card brings the title back, whole.
    const cdp = await page.context().newCDPSession(page);
    const box = await boxOf(card);
    await swipe(cdp, { x: box.x + box.width / 2, y: 160 }, 400);
    await expect.poll(() => scrim.evaluate((e) => e.scrollTop)).toBe(0);
    expect(await card.getByRole('heading').evaluate(onPhone), 'the title').toBe(true);
  });
});

/* ---------- Touches on a board never scroll the page ---------- */

test.describe('at 844x390 a stroke or a drag on a board never scrolls the page @phone-only', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test('a finger stroke on the Picture Builder board paints and leaves the page where it was', async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
    await page.goto('/#/game/builder/1');
    await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
    const picture = await builderPicture(page);
    const color = picture.cells.find(Boolean)!;
    await builderSwatch(page, color).scrollIntoViewIfNeeded();
    await builderSwatch(page, color).tap();
    const top = builderSquare(page, picture.size, 0);
    const bottom = builderSquare(page, picture.size, picture.size * (picture.size - 1));
    await top.scrollIntoViewIfNeeded();
    const cdp = await page.context().newCDPSession(page);

    // A control check first: the same finger drag beside the board, on the picture, does scroll the page.
    await page.evaluate(() => document.querySelector('main.bw-screen')?.scrollTo(0, 0));
    const before = await scrolled(page);
    const model = await centre(page.locator('.pb-model-row'));
    await fingerDrag(cdp, [model, { x: model.x, y: model.y - 120 }]);
    await expect.poll(() => scrolled(page)).toBeGreaterThan(before);

    await settled(page);
    await top.scrollIntoViewIfNeeded();
    const still = await settled(page);
    await fingerDrag(cdp, [await centre(top), await centre(bottom)]);
    await page.waitForTimeout(300);
    expect(await scrolled(page)).toBe(still);
    expect((await builderBoardCells(page)).filter(Boolean).length, 'the stroke painted').toBeGreaterThan(0);
    // A swipe that starts on the board, up or down, is the board's too.
    for (const dy of [-120, 120]) {
      await swipe(cdp, await centre(page.locator('.pb-board')), dy);
      expect(await scrolled(page), `a ${dy}px swipe on the board`).toBe(still);
    }
  });

  test('a finger drag of a Brick Escape brick moves it and leaves the page where it was', async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
    await page.goto('/#/game/escape/1');
    await expect(dots(page)).toBeVisible();
    const stage = page.locator('.esc-stage');
    await stage.scrollIntoViewIfNeeded();
    const cdp = await page.context().newCDPSession(page);
    const still = await scrolled(page);
    const names = async () => page.locator('.esc-brick').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')).join('|'));
    const was = await names();
    // Drag each brick up and down the board in turn until one moves; none may scroll the page.
    for (const brick of await page.locator('.esc-brick').all()) {
      const c = await centre(brick);
      const s = await boxOf(stage);
      for (const to of [{ x: c.x, y: s.y + 4 }, { x: c.x, y: s.y + s.height - 4 }, { x: s.x + 4, y: c.y }, { x: s.x + s.width - 4, y: c.y }]) {
        await fingerDrag(cdp, [c, to]);
        await page.waitForTimeout(250);
        expect(await scrolled(page), 'the page did not scroll').toBe(still);
        if ((await names()) !== was) break;
      }
      if ((await names()) !== was) break;
    }
    expect(await names(), 'a brick moved').not.toBe(was);
    for (const dy of [-120, 120]) {
      await swipe(cdp, await centre(page.locator('.esc-brick').first()), dy);
      expect(await scrolled(page), `a ${dy}px swipe on a brick`).toBe(still);
    }
    // Off the board, on the help line, the same swipe scrolls the screen.
    await page.locator('.esc-help').scrollIntoViewIfNeeded();
    const here = await scrolled(page);
    await swipe(cdp, await centre(page.locator('.esc-help')), dy0(here));
    await expect.poll(() => scrolled(page)).not.toBe(here);
  });
});

/* ---------- Turning the phone mid-puzzle ---------- */

test.describe('turning the phone mid-puzzle keeps the puzzle @phone-only', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('Picture Builder with 2 bricks painted still shows them sideways and back upright', async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
    await page.goto('/#/game/builder/1');
    await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
    const picture = await builderPicture(page);
    const color = picture.cells.find(Boolean)!;
    const wanted = picture.cells.flatMap((c, i) => (c === color ? [i] : [])).slice(0, 2);
    expect(wanted).toHaveLength(2);
    await builderSwatch(page, color).tap();
    for (const i of wanted) await builderSquare(page, picture.size, i).tap();
    const painted = await builderBoardCells(page);
    expect(painted.filter(Boolean)).toHaveLength(2);
    const dotsLabel = await dots(page).getAttribute('aria-label');

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('main.bw-screen')).toHaveClass(/bw-screen--short/);
    expect(await builderBoardCells(page)).toEqual(painted);
    await expect(dots(page)).toHaveAttribute('aria-label', dotsLabel!);
    expect((await builderPicture(page)).cells).toEqual(picture.cells);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('main.bw-screen')).not.toHaveClass(/bw-screen--short/);
    expect(await builderBoardCells(page)).toEqual(painted);
    await expect(dots(page)).toHaveAttribute('aria-label', dotsLabel!);
  });
});
