/**
 * Color Mixer, usability round 2: a repeat tap on the same wrong pot plays the wrong sound again and stays one
 * slip (mixer-pattern-5); a quieter result name before a mix, with the help line holding still
 * (mixer-pattern-6); and the 150 ms Reduce Motion fades that the global 0.01 ms rule must not erase
 * (a11y-cross-10).
 */
import { expect, test, type Page } from '@playwright/test';
import { SAME_TEXT, colorWord } from '../src/games/mixer/colors';
import { STORAGE_KEY, mixerOnScreen, mixerPot, seed, solveMixerPuzzle, starsUpTo, type Band } from './app';

const help = (page: Page) => page.locator('.bw-helprow__line');
const resultName = (page: Page) => page.locator('.mix-result__name');
const wrongSlots = (page: Page) => page.locator('.mix-slot.is-wrong');

/** sfx.wrong's first tone (src/shared/sound.ts); no other sound in Color Mixer's play uses it. */
const WRONG_TONE = 330;

/** Turn the sound on (seed turns it off) and record the pitch of every tone the app plays from here on. */
async function recordTones(page: Page): Promise<() => Promise<number[]>> {
  await page.addInitScript((key) => {
    const raw = localStorage.getItem(key);
    if (raw) {
      const state = JSON.parse(raw);
      state.settings.sound = true;
      localStorage.setItem(key, JSON.stringify(state));
    }
    const tones: number[] = [];
    (window as unknown as { __tones: number[] }).__tones = tones;
    const make = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function (this: AudioContext) {
      const o = make.call(this);
      const set = o.frequency.setValueAtTime.bind(o.frequency);
      o.frequency.setValueAtTime = (value: number, time: number) => {
        tones.push(value);
        return set(value, time);
      };
      return o;
    };
  }, STORAGE_KEY);
  return () => page.evaluate(() => (window as unknown as { __tones: number[] }).__tones.slice());
}

async function open(page: Page, level = 1, ageBand: Band = '5-6') {
  await seed(page, [{ id: 'leo', name: 'Leo', ageBand, games: level > 1 ? { mixer: { stars: starsUpTo(level - 1) } } : {} }]);
}

/* ---------- mixer-pattern-5: the same wrong pot again ---------- */

test('ages 3 to 4: three taps on the same wrong pot play three wrong sounds, dim and tilt each time, and bring no offer', async ({ page }) => {
  // The cue lasts 500 ms; a paused clock keeps it on screen until the test moves time on, so a busy machine
  // never misses it.
  await page.clock.install();
  await open(page, 1, '3-4');
  const tones = await recordTones(page);
  await page.goto('/#/game/mixer/1');
  const p = await mixerOnScreen(page);
  if (p.form !== 'finish') throw new Error('Level 1 is Finish the mix');
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1_000);
  const wrongs = async () => (await tones()).filter((f) => f === WRONG_TONE).length;
  for (let i = 1; i <= 3; i++) {
    await expect(wrongSlots(page)).toHaveCount(0);
    await mixerPot(page, p.wrong[0]).click();
    await expect(wrongSlots(page)).toHaveCount(2);
    await expect.poll(wrongs).toBe(i);
    await expect(help(page)).toHaveText(`Not ${colorWord(p.goal)} yet. Try another paint.`);
    await page.clock.runFor(500);
  }
  // One slip, not three: the offer's count for ages 3 to 4 is 3, and it does not come.
  await expect(wrongSlots(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'New puzzle' })).toHaveCount(0);
});

/* ---------- mixer-pattern-6: a quieter empty result name ---------- */

const TEXT = 'rgb(255, 255, 255)';
const TEXT_2 = 'rgb(201, 194, 255)';

// Under Reduce Motion the global 0.01ms rule gives every property a 10 microsecond transition, so a style
// read in the same frame as the change can still see the old value: these reads poll.
const nameStyle = (page: Page) =>
  resultName(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.fontSize} ${s.color}`;
  });
/** The help line by its middle: a line that wraps to two rows grows around it, and that is no move. */
const layoutNow = (page: Page) =>
  page.evaluate(() => {
    const line = document.querySelector('.bw-helprow__line')!.getBoundingClientRect();
    return {
      help: line.y + line.height / 2,
      row: document.querySelector('.bw-helprow')!.getBoundingClientRect().y,
      shelf: document.querySelector('.mix-controls')!.getBoundingClientRect().y,
      result: document.querySelector('.mix-result')!.getBoundingClientRect().height,
    };
  });

/**
 * On Finish (Level 1): the quiet name before a mix, the full name after a wrong mix. Returns how far the help
 * line moved between the two states.
 */
async function quietThenFull(page: Page) {
  await open(page, 1);
  await page.goto('/#/game/mixer/1');
  const p = await mixerOnScreen(page);
  if (p.form !== 'finish') throw new Error('Level 1 is Finish the mix');
  expect(await page.evaluate(() => document.fonts.check('16px "Baloo 2"'))).toBe(true);
  // Before a mix: the name is the quiet help size and colour, so the help line stays the loudest instruction.
  await expect(resultName(page)).toHaveClass(/is-empty/);
  await expect.poll(() => nameStyle(page)).toBe(`18px ${TEXT_2}`);
  const before = await layoutNow(page);
  // The result block keeps its 64px (zoomed on a tablet) with the smaller name.
  const zoom = await page.locator('.mix-result').evaluate((el) => el.getBoundingClientRect().height / (el as HTMLElement).offsetHeight);
  expect(Math.abs(before.result - 64 * zoom)).toBeLessThanOrEqual(0.5);
  // After a mix: the colour's name is as big and white as before.
  await mixerPot(page, p.wrong[0]).click();
  await expect(resultName(page)).not.toHaveClass(/is-empty/);
  await expect.poll(() => nameStyle(page)).toBe(`28px ${TEXT}`);
  const after = await layoutNow(page);
  return { help: after.help - before.help };
}

test('Finish: before a mix the result name is 18px in the second text colour; after a mix 28px white, and the help line holds still', async ({ page }) => {
  const moved = await quietThenFull(page);
  expect(Math.abs(moved.help)).toBeLessThanOrEqual(0.5);
});

test('Make it: the same quiet name before the first paint and after one paint, then the full name after a mix', async ({ page }) => {
  await open(page, 3);
  await page.goto('/#/game/mixer/3');
  const p = await mixerOnScreen(page);
  if (p.form !== 'make') throw new Error('Level 3 is Make it');
  await expect.poll(() => nameStyle(page)).toBe(`18px ${TEXT_2}`);
  await mixerPot(page, p.pair[0]).click();
  // One paint is not a mix yet.
  await expect(resultName(page)).toHaveClass(/is-empty/);
  await expect.poll(() => nameStyle(page)).toBe(`18px ${TEXT_2}`);
  await mixerPot(page, p.pair[1]).click();
  await expect(resultName(page)).not.toHaveClass(/is-empty/);
  await expect.poll(() => nameStyle(page)).toBe(`28px ${TEXT}`);
});

test.describe('tablet landscape 1194x834', () => {
  test.use({ viewport: { width: 1194, height: 834 } });
  test('Finish: the quiet empty name, the full name after a mix, and the help line holds still', { tag: '@phone-only' }, async ({ page }) => {
    const moved = await quietThenFull(page);
    expect(Math.abs(moved.help)).toBeLessThanOrEqual(0.5);
  });
});

test.describe('short phone 375x667', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  test('Finish: the quiet empty name, the full name after a mix, and the help line holds still', { tag: '@phone-only' }, async ({ page }) => {
    const moved = await quietThenFull(page);
    expect(Math.abs(moved.help)).toBeLessThanOrEqual(0.5);
  });
});

test('Guess: the same quiet name until the colour is found, then the full name', async ({ page }) => {
  await open(page, 2);
  await page.goto('/#/game/mixer/2');
  const p = await mixerOnScreen(page);
  if (p.form !== 'guess') throw new Error('Level 2 is Guess');
  await expect(resultName(page)).toHaveText('Pick a color');
  await expect(resultName(page)).toHaveClass(/is-empty/);
  await expect.poll(() => nameStyle(page)).toBe(`18px ${TEXT_2}`);
  await solveMixerPuzzle(page);
  await expect(resultName(page)).not.toHaveClass(/is-empty/);
  await expect.poll(() => nameStyle(page)).toBe(`28px ${TEXT}`);
});

/* The longest result line runs to two rows on a phone. The block keeps its 64px all the same, so the help row
   and the shelf under a child's finger never move, at any size. */
for (const viewport of [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 390, height: 664 },
  { width: 360, height: 740 },
  { width: 834, height: 1194 },
  { width: 1194, height: 834 },
]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    test('the longest result line moves nothing below it and stays clear of the help line', { tag: '@phone-only' }, async ({ page }) => {
      await open(page, 3);
      await page.goto('/#/game/mixer/3');
      const p = await mixerOnScreen(page);
      if (p.form !== 'make') throw new Error('Level 3 is Make it');
      expect(await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('800 16px "Baloo 2"')))).toBe(true);
      const before = await layoutNow(page);
      // The same paint twice: the longest line the block ever shows.
      await mixerPot(page, p.pair[0]).click();
      await mixerPot(page, p.pair[0]).click();
      await expect(page.locator('.mix-result__text')).toHaveText(SAME_TEXT);
      await expect.poll(() => nameStyle(page)).toBe(`28px ${TEXT}`);
      const after = await layoutNow(page);
      expect(Math.abs(after.row - before.row), 'the help row holds still').toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.help - before.help), 'the help line holds still').toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.shelf - before.shelf), 'the shelf holds still').toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.result - before.result), 'the block keeps its height').toBeLessThanOrEqual(0.5);
      const gap = await page.evaluate(() => {
        const text = document.querySelector('.mix-result__text')!.getBoundingClientRect();
        const line = document.querySelector('.bw-helprow__line')!.getBoundingClientRect();
        return line.y - (text.y + text.height);
      });
      expect(gap, 'the result line stays clear of the help line').toBeGreaterThanOrEqual(0);
    });
  });
}

/* ---------- a11y-cross-10: the Reduce Motion fades keep their 150 ms ---------- */

test('with Reduce Motion the bowl and the slots still fade over 150 ms, and the slot tilt stays off', async ({ page }) => {
  await open(page, 1);
  await page.goto('/#/game/mixer/1');
  const p = await mixerOnScreen(page);
  if (p.form !== 'finish') throw new Error('Level 1 is Finish the mix');
  const duration = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(await duration('.mix-bowl__liquid')).toBe('0.15s');
  expect(await duration('.mix-slot')).toBe('0.15s');
  await mixerPot(page, p.wrong[0]).click();
  await expect(wrongSlots(page)).toHaveCount(2);
  expect(await wrongSlots(page).first().evaluate((el) => getComputedStyle(el).transform)).toBe('none');
});
