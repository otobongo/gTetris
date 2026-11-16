/**
 * Round 2 checks for the kit games that need batch ui's pieces, so they pass only once that batch is
 * merged (the orchestrator runs this file after the merge):
 * - Decision 8 (Interface CUE): at ages 3 to 4 the New puzzle button rings and chimes once when it
 *   appears, for 2 s, static, without taking focus; never at the other ages.
 * - Decision 19 (Interface STICKER): finishing a chapter shows the new sticker on the level card, and
 *   Home and the book count it once.
 * - Decision 25 (Interface CAP): after a hint the capped-star mark sits beside the puzzle dots.
 * Every layout check runs with the app's own font (Baloo 2).
 */
import { expect, test, type Page } from '@playwright/test';
import { STICKERS } from '../src/screens/logic/stickers';
import { colorWord } from '../src/games/mixer/colors';
import {
  dots,
  levelCard,
  mixerOnScreen,
  mixerPot,
  mixerSlot,
  numbersBackwardSwap,
  patternCar,
  patternOnScreen,
  seed,
  sortShapes,
  swapTowers,
  type Band,
} from './app';

const offerButton = (page: Page) => page.getByRole('button', { name: 'New puzzle' });

/** The app's own font has loaded (a fallback would measure differently). The app ships 600, 700 and 800 only; the h1 is 800. */
async function realFont(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('800 16px "Baloo 2"')))).toBe(true);
}

/**
 * Starts watching the offer: whether anything ever carries `is-cue`, what had focus when the tap that
 * brought the offer landed, and what has focus the moment the offer is in the page.
 */
async function watchOffer(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __cueEver: boolean; __tapFocus: Element | null; __offerFocus: Element | null; __offered: boolean };
    w.__cueEver = false;
    w.__tapFocus = null;
    w.__offerFocus = null;
    w.__offered = false;
    // capture on window runs before React's handler, so before the offer can render
    window.addEventListener('click', () => (w.__tapFocus = document.activeElement), true);
    new MutationObserver(() => {
      if (document.querySelector('.is-cue')) w.__cueEver = true;
      const offer = document.querySelector('.bw-helprow__offer button');
      if (offer && !w.__offered) {
        w.__offered = true;
        w.__offerFocus = document.activeElement;
      }
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  });
}

const read = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __cueEver: boolean; __tapFocus: Element | null; __offerFocus: Element | null };
    return { cueEver: w.__cueEver, sameFocus: w.__tapFocus === w.__offerFocus, focusNow: w.__offerFocus === document.activeElement };
  });

const STUCK_COUNT: Record<Band, number> = { '3-4': 3, '5-6': 3, '7-8': 4, '9-10': 4 };

/** Pattern Train Level 1: wrong cars until the offer shows. */
async function patternStuck(page: Page, band: Band) {
  const p = await patternOnScreen(page);
  for (let i = 0; i < STUCK_COUNT[band]; i++) {
    await expect(offerButton(page)).toHaveCount(0);
    await patternCar(page, p.wrong[i % p.wrong.length]).click();
  }
  await expect(offerButton(page)).toBeVisible();
}

/** Color Mixer Level 1 (Finish the mix): the same wrong paint until the offer shows. */
async function mixerStuck(page: Page, band: Band) {
  const p = await mixerOnScreen(page);
  if (p.form !== 'finish') throw new Error('Level 1 is Finish the mix');
  for (let i = 0; i < STUCK_COUNT[band]; i++) {
    if (i) {
      await mixerSlot(page, 2).click();
      await expect(mixerSlot(page, 2)).toHaveAccessibleName('Paint 2: empty');
    }
    await expect(offerButton(page)).toHaveCount(0);
    await mixerPot(page, p.wrong[0]).click();
    await expect(mixerSlot(page, 2)).toHaveAccessibleName(`Paint 2: ${colorWord(p.wrong[0])}`);
  }
  await expect(offerButton(page)).toBeVisible();
}

const GAMES = [
  { id: 'pattern', stuck: patternStuck },
  { id: 'mixer', stuck: mixerStuck },
] as const;

/** The cue at ages 3 to 4: there at once, a static 4 px ring, gone 2.1 s later, and focus never moved. */
async function checkCue(page: Page, game: (typeof GAMES)[number]) {
  await seed(page, [{ id: 'leo', name: 'Leo', ageBand: '3-4' }]);
  await page.goto(`/#/game/${game.id}/1`);
  await realFont(page);
  await watchOffer(page);
  await game.stuck(page, '3-4');
  const offer = offerButton(page);
  await expect(offer).toHaveClass(/(^|\s)is-cue(\s|$)/);
  const ringOf = () =>
    offer.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { width: parseFloat(cs.outlineWidth), style: cs.outlineStyle, offset: cs.outlineOffset, color: cs.outlineColor, transition: cs.transitionProperty };
    });
  const ring = await ringOf();
  // 4 px as drawn: in the zoomed tablet frame Chrome snaps an outline to whole screen pixels (5 at zoom 1.4, read back as 3.57)
  expect(Math.abs(ring.width - 4)).toBeLessThanOrEqual(0.5);
  expect(ring).toMatchObject({ style: 'solid', offset: '0px', color: 'rgb(255, 194, 26)' });
  // static: nothing transitions the outline, and it is the same half a second later (the button's own bw-appear fade is opacity only)
  expect(ring.transition).not.toMatch(/outline|all/);
  await page.waitForTimeout(500);
  expect(await ringOf()).toEqual(ring);
  const box = await offer.boundingBox();
  await page.waitForTimeout(2100);
  expect(await offer.evaluate((el) => el.classList.contains('is-cue'))).toBe(false);
  // the button never moved, and focus stayed where the tap left it
  expect(await offer.boundingBox()).toEqual(box);
  await expect(offer).not.toBeFocused();
  expect(await read(page)).toMatchObject({ sameFocus: true, focusNow: true });
}

test.describe('decision 8: one chime and a 2 s ring on the offer at ages 3 to 4', () => {
  for (const game of GAMES) {
    test(`${game.id} Level 1 at 3 to 4: the ring comes with the offer and goes 2 s later (Reduce Motion)`, async ({ page }) => {
      await checkCue(page, game);
    });

    for (const band of ['5-6', '7-8', '9-10'] as const) {
      test(`${game.id} Level 1 at ${band}: never a ring`, async ({ page }) => {
        await seed(page, [{ id: 'maya', name: 'Maya', ageBand: band }]);
        await page.goto(`/#/game/${game.id}/1`);
        await watchOffer(page);
        await game.stuck(page, band);
        await page.waitForTimeout(300);
        expect((await read(page)).cueEver).toBe(false);
      });
    }
  }

  test.describe('with motion allowed', () => {
    test.use({ reducedMotion: 'no-preference' });
    test('pattern Level 1 at 3 to 4: the same static ring', async ({ page }) => {
      await checkCue(page, GAMES[0]);
    });
  });
});

/* ---------- Decision 19: the new sticker on the level card ---------- */

/** Shape Sorter Level 3 with Levels 1 and 2 starred: four puzzles sorted by taps, then the card. */
async function finishSorterChapter(page: Page) {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', games: { sorter: { stars: { 0: 3, 1: 3 } } } }]);
  await page.goto('/#/game/sorter/3');
  await realFont(page);
  for (let n = 0; n < 4; n++) {
    await sortShapes(page, 'tap');
    if (n < 3) await page.getByRole('button', { name: 'Next puzzle' }).click();
  }
  const card = levelCard(page);
  await expect(card).toBeVisible();
  return card;
}

async function checkStickerCard(page: Page) {
  const card = await finishSorterChapter(page);
  const row = card.locator('.bw-levelcard__sticker');
  await expect(row).toContainText('New sticker: Star.');
  // 25 cells, of which Star's 14 are bricks
  const cells = await row.evaluate((el) => {
    const brick = el.querySelector('.bw-brick');
    const grid = brick?.parentElement?.classList.contains('bw-brick') ? brick.parentElement.parentElement : brick?.parentElement;
    return { cells: grid?.children.length ?? 0, bricks: el.querySelectorAll('.bw-brick').length };
  });
  expect(cells.bricks).toBe(STICKERS.find((s) => s.id === 's1')!.art.join('').replace(/\./g, '').length);
  expect(cells.cells).toBe(25);
  const describedBy = (await card.getAttribute('aria-describedby')) ?? '';
  expect(describedBy.split(' ')).toContain(await row.getAttribute('id'));
  // Play Level 4 fully on screen
  const play = card.getByRole('button', { name: 'Play Level 4' });
  await expect(play).toBeVisible();
  const box = (await play.boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
}

test.describe('decision 19: the new sticker on the kit level card', () => {
  test('Shape Sorter Level 3 ends the chapter: the card shows Star, then Home counts 1 and the book shows it as new', async ({ page }) => {
    await checkStickerCard(page);
    await page.goto('/#/');
    await expect(page.getByRole('link', { name: new RegExp(`and 1 of ${STICKERS.length} stickers`) })).toBeVisible();
    await page.goto('/#/stickers');
    await expect(page.getByLabel('Star, new sticker', { exact: true })).toBeVisible();
  });

  test.describe('at 375 x 667', () => {
    test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
    test('the sticker row fits and Play Level 4 stays on screen', { tag: '@phone-only' }, async ({ page }) => {
      await checkStickerCard(page);
    });
  });
});

/* ---------- Decision 25: the capped-star mark beside the dots ---------- */

test('Number Line-up Level 1: after Hint the capped-star mark sits beside the dots, whose name is unchanged', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
  await page.goto('/#/game/numbers/1');
  await realFont(page);
  const [a, b] = await numbersBackwardSwap(page);
  await swapTowers(page, a, b);
  const label = await dots(page).getAttribute('aria-label');
  await expect(page.locator('.bw-dots__cap')).toHaveCount(0);
  await page.getByRole('button', { name: /^Hint, \d left$/ }).click();
  const cap = page.locator('.bw-dots__cap');
  await expect(cap).toBeVisible();
  await expect(cap).toHaveAttribute('role', 'img');
  await expect(cap).toHaveAccessibleName('Hint used. Up to 2 stars.');
  await expect(dots(page)).toHaveAttribute('aria-label', label!);
  const d = (await dots(page).boundingBox())!;
  const c = (await cap.boundingBox())!;
  expect(c.x).toBeGreaterThan(d.x + d.width);
  expect(Math.abs(c.y + c.height / 2 - (d.y + d.height / 2))).toBeLessThanOrEqual(2);
});
