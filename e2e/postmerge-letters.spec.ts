/**
 * Letter Builder checks that need batch ui's shared pieces (run after the round 2 merge):
 * - decision 8: the stuck offer's New puzzle button rings for its first 2 s at ages 3 to 4 (IconButton `cue`);
 * - decision 19: the level card shows the sticker a finished chapter earns (LevelCard `sticker`);
 * - decision 25: the capped-star mark sits beside the dots once a counted hint is used (PuzzleDots `capped`).
 */
import { expect, test, type Page } from '@playwright/test';
import { dots, levelCard, lettersWrongTap, savedState, seed, solveLettersPuzzle, starsUpTo, type Band } from './app';

const offer = (page: Page) => page.getByRole('button', { name: 'New puzzle' });
const hint = (page: Page, left: number) => page.getByRole('button', { name: `Hint (${left})` });
const capMark = (page: Page) => page.getByRole('img', { name: 'Hint used. Up to 2 stars.' });

async function open(page: Page, ageBand: Band, level = 0) {
  await seed(page, [{ id: 'leo', name: 'Leo', ageBand, games: level ? { letters: { stars: starsUpTo(level) } } : undefined }]);
  await page.goto('/#/game/letters');
  await expect(page).toHaveURL(new RegExp(`#/game/letters/${level + 1}$`));
  await expect(page.locator('.lb-tray button').first()).toBeVisible();
}

/* ---------- Decision 8: the offer cue ---------- */

test('ages 3 to 4 on Level 2: the offer button rings for its first 2 s and then goes plain', async ({ page }) => {
  await open(page, '3-4', 1);
  for (let i = 0; i < 3; i++) await lettersWrongTap(page);
  await expect(offer(page)).toBeVisible();
  await expect(offer(page)).toHaveClass(/is-cue/);
  await expect(offer(page)).not.toBeFocused();
  await expect(offer(page)).not.toHaveClass(/is-cue/, { timeout: 4_000 });
});

test('ages 5 to 6 on Level 1: the offer button has no ring', async ({ page }) => {
  await open(page, '5-6');
  for (let i = 0; i < 3; i++) await lettersWrongTap(page);
  await expect(offer(page)).toBeVisible();
  await expect(offer(page)).not.toHaveClass(/is-cue/);
});

/* ---------- Decision 19: the new sticker on the level card ---------- */

test('finishing the last level of the first chapter shows Big A on the card and awards it once', async ({ page }) => {
  await open(page, '5-6', 6);
  for (let n = 0; n < 4; n++) {
    await solveLettersPuzzle(page);
    if (n === 3) break;
    const next = page.getByRole('button', { name: 'Next puzzle' });
    await expect(next).toBeFocused();
    await next.click();
  }
  const card = levelCard(page);
  await expect(card.getByRole('heading')).toHaveText('You finished Level 7');
  await expect(card).toContainText('New sticker: Big A.');
  // VoiceOver reads the sticker with the fact line.
  const described = (await card.getAttribute('aria-describedby')) ?? '';
  expect(described.split(' ')).toHaveLength(2);
  const state = await savedState(page);
  expect(Object.keys(state.players[0].stickers)).toEqual(['l1']);
});

test('a level that finishes no chapter shows no sticker', async ({ page }) => {
  await open(page, '5-6');
  for (let n = 0; n < 4; n++) {
    await solveLettersPuzzle(page);
    if (n === 3) break;
    await page.getByRole('button', { name: 'Next puzzle' }).click();
  }
  await expect(levelCard(page).getByRole('heading')).toHaveText('You finished Level 1');
  await expect(levelCard(page)).not.toContainText('New sticker');
});

/* ---------- Decision 25: the capped-star mark ---------- */

test('ages 5 to 6 on Level 2: a hint brings the capped-star mark, and a swap takes it away', async ({ page }) => {
  await open(page, '5-6', 1);
  await expect(capMark(page)).toHaveCount(0);
  await hint(page, 3).click();
  await expect(capMark(page)).toBeVisible();
  // The dots keep their own name.
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  for (let i = 0; i < 3; i++) await lettersWrongTap(page);
  await offer(page).click();
  await expect(capMark(page)).toHaveCount(0);
  // A hint on a puzzle that is then solved keeps the mark for the rest of the level.
  await hint(page, 2).click();
  await solveLettersPuzzle(page);
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(capMark(page)).toBeVisible();
});

test('practice Level 1 at ages 3 to 4: a hint never brings the capped-star mark', async ({ page }) => {
  await open(page, '3-4');
  await hint(page, 3).click();
  await expect(hint(page, 2)).toBeVisible();
  await expect(capMark(page)).toHaveCount(0);
  await solveLettersPuzzle(page);
  await expect(capMark(page)).toHaveCount(0);
});
