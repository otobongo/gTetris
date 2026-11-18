/**
 * Usability round 2, decision 10 (older-bands-start): a child of an older band who has never played a game
 * starts at that game's band start level. Home's pills and the levels they open, the Settings row and the
 * level picker all name the same level (four-puzzle brief 2.6). The rules are unit-tested in
 * src/games/startLevel.r2.test.ts and src/screens/logic/startLevel.r2.test.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import { dots, homeCard, levelCard, openSettings, savedGame, seed, sortShapes, sorterPieces, sorterTray, starsUpTo, type Band } from './app';

const title = (page: Page) => page.getByRole('heading', { level: 1 });

/** The games on Home, by title, with the level a new child of each band starts at. */
const START: [string, string, Record<Band, number>][] = [
  ['Brick Escape', 'escape', { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 1 }],
  ['Brick Drop', 'drop', { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 1 }],
  ['Letter Builder', 'letters', { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 1 }],
  ['Color Mixer', 'mixer', { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 4 }],
  ['Shape Sorter', 'sorter', { '3-4': 1, '5-6': 1, '7-8': 4, '9-10': 7 }],
  ['Pattern Train', 'pattern', { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 4 }],
  ['Number Line-up', 'numbers', { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 9 }],
  ['Picture Builder', 'builder', { '3-4': 1, '5-6': 1, '7-8': 3, '9-10': 3 }],
  ['Brick Calculator', 'math', { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 1 }],
];

const noun = (id: string) => (id === 'drop' ? 'Stage' : 'Level');

async function goHome(page: Page) {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
}

for (const band of ['9-10', '7-8'] as const) {
  test(`a new ${band} child: each Home card names its start level and opens it`, async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: band }]);
    await goHome(page);
    await expect.poll(() => page.evaluate(() => document.fonts.check('16px "Baloo 2"')), { message: 'Baloo 2 loaded' }).toBe(true);
    for (const [name, id, want] of START) {
      const level = `${noun(id)} ${want[band]}`;
      await expect(homeCard(page, name).locator('.bw-pill'), name).toHaveText(level);
      await expect(homeCard(page, name), name).toHaveAccessibleName(new RegExp(` ${level}\\.$`));
    }
    for (const [name, id, want] of START) {
      await goHome(page);
      await homeCard(page, name).click();
      await expect(page, name).toHaveURL(new RegExp(`#/game/${id}/${want[band]}$`));
      await expect(title(page), name).toHaveText(`${noun(id)} ${want[band]}`);
    }
  });
}

/* The sizes the two projects do not cover: a small phone, a tablet held sideways and a phone held sideways. */
for (const size of [
  { name: 'small phone 375x667', width: 375, height: 667 },
  { name: 'tablet sideways 1194x834', width: 1194, height: 834 },
  { name: 'phone sideways 844x390', width: 844, height: 390 },
]) {
  test.describe(size.name, () => {
    test.use({ viewport: { width: size.width, height: size.height }, isMobile: true, hasTouch: true });

    for (const band of ['9-10', '7-8'] as const) {
      test(`a new ${band} child: Home names each start level, and a tap opens it with no sideways scroll`, { tag: '@phone-only' }, async ({ page }) => {
        await seed(page, [{ id: 'maya', name: 'Maya', ageBand: band }]);
        await goHome(page);
        await expect.poll(() => page.evaluate(() => document.fonts.check('16px "Baloo 2"')), { message: 'Baloo 2 loaded' }).toBe(true);
        for (const [name, id, want] of START) {
          if (want[band] === 1) continue;
          await goHome(page);
          await expect(homeCard(page, name).locator('.bw-pill'), name).toHaveText(`Level ${want[band]}`);
          await homeCard(page, name).click();
          await expect(page, name).toHaveURL(new RegExp(`#/game/${id}/${want[band]}$`));
          await expect(title(page), name).toHaveText(`Level ${want[band]}`);
          const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          expect(sideways, name).toBeLessThanOrEqual(0);
        }
      });
    }
  });
}

test.describe('with motion on', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('a new 9-10 child still lands on the start level', { tag: '@phone-only' }, async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10' }]);
    await goHome(page);
    await homeCard(page, 'Shape Sorter').click();
    await expect(page).toHaveURL(/#\/game\/sorter\/7$/);
    await expect(title(page)).toHaveText('Level 7');
  });
});

test('Enter on a Home card opens the start level, and the keyboard lands on the new screen', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10' }]);
  await goHome(page);
  await homeCard(page, 'Number Line-up').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/game\/numbers\/9$/);
  await expect(title(page)).toHaveText('Level 9');
  await expect.poll(() => page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null)).toBe(true);
});

test('new 3-4 and 5-6 children start every game at Level 1', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [
    { id: 'maya', name: 'Maya', ageBand: '3-4' },
    { id: 'leo', name: 'Leo', ageBand: '5-6' },
  ]);
  await goHome(page);
  for (const [name, id] of START) await expect(homeCard(page, name), name).toHaveAccessibleName(new RegExp(` ${noun(id)} 1\\.$`));
  await page.goto('/#/players');
  await page.getByRole('button', { name: /^Leo/ }).click();
  await page.getByRole('link', { name: 'Play as Leo' }).click();
  await expect(page.getByRole('heading', { name: 'Hi Leo!' })).toBeVisible();
  for (const [name, id] of START) await expect(homeCard(page, name), name).toHaveAccessibleName(new RegExp(` ${noun(id)} 1\\.$`));
});

test('a new 9-10 child opens Shape Sorter at Level 7, a big board of eight pieces', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10' }]);
  await goHome(page);
  await homeCard(page, 'Shape Sorter').click();
  await expect(page).toHaveURL(/#\/game\/sorter\/7$/);
  await expect(title(page)).toHaveText('Level 7');
  await expect(sorterTray(page).getByRole('button').first()).toBeVisible();
  expect(await sorterPieces(page)).toHaveLength(8);
  // An old link to Level 1 lands on the start level too.
  await page.goto('/#/game/sorter/1');
  await expect(page).toHaveURL(/#\/game\/sorter\/7$/);
});

test('the Settings row and the level picker name the same start level as Home', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10' }]);
  await openSettings(page);
  for (const [name, id, want] of START) {
    const level = `${noun(id)} ${want['9-10']}`;
    await expect(page.getByRole('link', { name: `${name} for Maya: ${level}. Pick a ${noun(id).toLowerCase()}` }), name).toBeVisible();
  }
  await page.getByRole('link', { name: 'Shape Sorter for Maya: Level 7. Pick a level' }).click();
  await expect(page).toHaveURL(/#\/settings\/levels\/sorter\/maya$/);
  await expect(page.getByRole('status')).toHaveText('Maya is on Level 7.');
  await expect(page.getByRole('button', { name: 'Level 7, Maya’s current level' })).toBeVisible();
  // Earlier levels stay with the grown-up: Level 2 is locked, and can still be picked. Maya skipped it, so it is
  // one she has not played, while Level 8 is still ahead of her.
  await page.getByRole('button', { name: 'Level 2, locked' }).click();
  await expect(page.getByRole('status')).toHaveText('Level 2 picked. Maya hasn’t played it yet.');
  await page.getByRole('button', { name: 'Level 8, locked' }).click();
  await expect(page.getByRole('status')).toHaveText('Level 8 picked. Maya hasn’t reached it yet.');
});

test('starting Shape Sorter over for a 9-10 child names Level 7, and Level 7 is where it starts again', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10', games: { sorter: { stars: { 6: 3 }, current: 7 } } }]);
  await openSettings(page);
  await page.getByRole('link', { name: 'Shape Sorter for Maya: Level 8. Pick a level' }).click();
  await expect(page.getByText('Maya’s levels and stars in Shape Sorter go back to Level 7 on this device. Stickers stay in the sticker book.')).toBeVisible();
  await page.getByRole('button', { name: 'Reset Shape Sorter for Maya' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Reset Shape Sorter for Maya?' });
  await expect(confirm).toContainText('Levels and stars in Shape Sorter go back to Level 7 on this device. Stickers stay. This can’t be undone.');
  await confirm.getByRole('button', { name: 'Reset Shape Sorter' }).click();
  await expect(page.getByRole('status')).toHaveText('Shape Sorter starts again at Level 7 for Maya.');
  expect((await savedGame(page, 'sorter'))?.stars ?? {}).toEqual({});
  await page.getByRole('link', { name: 'Back to settings' }).click();
  await expect(page.getByRole('link', { name: 'Shape Sorter for Maya: Level 7. Pick a level' })).toBeVisible();
  await goHome(page);
  await expect(homeCard(page, 'Shape Sorter')).toHaveAccessibleName(/ Level 7\.$/);
});

test('a 9-10 child who leaves Shape Sorter Level 7 part way comes back to it, and goes on to Level 8 after it', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10' }]);
  await page.goto('/#/game/sorter');
  await expect(page).toHaveURL(/#\/game\/sorter\/7$/);
  await sortShapes(page, 'tap');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  await expect.poll(async () => (await savedGame(page, 'sorter'))?.runs?.['6']?.solved.length).toBe(1);

  await goHome(page);
  await expect(homeCard(page, 'Shape Sorter')).toHaveAccessibleName(/ Level 7, 1 of 4 puzzles solved\.$/);
  await homeCard(page, 'Shape Sorter').click();
  await expect(page).toHaveURL(/#\/game\/sorter\/7$/);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');

  for (let n = 1; n < 4; n++) {
    await sortShapes(page, 'tap');
    if (n < 3) await page.getByRole('button', { name: 'Next puzzle' }).click();
  }
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 7');
  expect((await savedGame(page, 'sorter'))?.current).toBe(7);
  await goHome(page);
  await expect(homeCard(page, 'Shape Sorter')).toHaveAccessibleName(/ Level 8\.$/);
});

test('a 9-10 child with a star on Shape Sorter Level 1 keeps the first level with no stars', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '9-10', games: { sorter: { stars: starsUpTo(1) } } }]);
  await goHome(page);
  await expect(homeCard(page, 'Shape Sorter')).toHaveAccessibleName(/ Level 2\.$/);
  await homeCard(page, 'Shape Sorter').click();
  await expect(page).toHaveURL(/#\/game\/sorter\/2$/);
});

test('a child part way through Shape Sorter Level 1 who is moved to 9-10 stays on Level 1', { tag: '@phone-only' }, async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/sorter');
  await expect(page).toHaveURL(/#\/game\/sorter\/1$/);
  await sortShapes(page, 'tap');
  await expect.poll(async () => (await savedGame(page, 'sorter'))?.runs?.['0']?.solved.length).toBe(1);

  await openSettings(page);
  const ages = page.getByRole('group', { name: "Maya's age" });
  await ages.getByRole('button', { name: 'Ages 9 to 10' }).click();
  await expect(ages.getByRole('button', { name: 'Ages 9 to 10' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: 'Shape Sorter for Maya: Level 1, 1 of 4 puzzles. Pick a level' })).toBeVisible();
  await goHome(page);
  await expect(homeCard(page, 'Shape Sorter')).toHaveAccessibleName(/ Level 1, 1 of 4 puzzles solved\.$/);
  // A game Maya has not played starts at the 9-10 start level.
  await expect(homeCard(page, 'Number Line-up')).toHaveAccessibleName(/ Level 9\.$/);
});
