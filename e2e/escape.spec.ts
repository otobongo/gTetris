/**
 * Brick Escape journeys (four-puzzle brief 12): a new child from Level 1 into Level 2, leaving mid-level and
 * coming back, a grown-up's replay of Level 3 that returns the child to their frontier, and the hint rules over
 * a level (a hint on a board swapped away is forgotten, one on a solved board caps the level).
 */
import { expect, test, type Page } from '@playwright/test';
import { escapeLevelStars } from '../src/games/run';
import { keyStep } from '../src/games/slide/drag';
import { DIRS, initialState, type State } from '../src/games/slide/engine';
import type { PuzzleResult } from '../src/shared/progress';
import {
  dots,
  escapeBoard,
  escapePuzzleOnScreen,
  hashOf,
  homeCard,
  levelCard,
  openSettings,
  playEscapeBoard,
  pressEscapeBrick,
  savedGame,
  savedRun,
  seed,
  solveEscapeBoard,
  starsUpTo,
} from './app';

test('a new child goes from Level 1 into Level 2', async ({ page }) => {
  // First run on this device: nobody is set up, so Who's playing asks for the first child.
  await page.goto('/');
  await expect(page).toHaveURL(/#\/players$/);
  await page.getByLabel("Child's first name").fill('Maya');
  await page.getByRole('button', { name: 'Ages 5 to 6' }).click();
  await page.getByRole('button', { name: 'Add child' }).click();

  await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
  const card = homeCard(page, 'Brick Escape');
  await expect(card).toContainText('Level 1');
  // No level grid for children: the card opens the current level straight away.
  await card.click();
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 1');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  await expect(page.getByRole('button', { name: 'Restart puzzle' })).toBeVisible();

  let total = 0;
  const results: PuzzleResult[] = [];
  for (let n = 1; n <= 4; n++) {
    const puzzle = await escapePuzzleOnScreen(page, 0);
    const moves = await solveEscapeBoard(page, 0, puzzle);
    total += moves;
    results.push({ puzzle, count: moves, par: escapeBoard(0, puzzle).par, usedHint: false, outOfTime: false });
    if (n < 4) {
      // The dot fills, the help line states the result and Next puzzle takes the tools' place, with focus.
      await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${n} of 4. ${n} solved.`);
      await expect(page.locator('.esc-help')).toHaveText(`Solved in ${moves} moves.`);
      const next = page.getByRole('button', { name: 'Next puzzle' });
      await expect(next).toBeFocused();
      await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
      await next.click();
      // Same screen, same route, the next unsolved puzzle.
      await expect(page).toHaveURL(/#\/game\/escape\/1$/);
      await expect(dots(page)).toHaveAttribute('aria-label', `Puzzle ${n + 1} of 4. ${n} solved.`);
      await expect(page.locator('.esc-status__moves')).toHaveText('Moves 0');
    }
  }

  // The fourth solve: the last dot fills, then the level card opens over the board.
  await expect(dots(page)).toHaveAttribute('aria-label', '4 of 4 solved.');
  const dialog = levelCard(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(dialog).toContainText(`4 puzzles in ${total} moves.`);
  await expect(dialog.getByRole('img', { name: /of 3 stars$/ })).toBeVisible();
  // The rule over the four Bests, and the stars worked out here from the moves and the Bests (section 5).
  const pars = results.reduce((s, r) => s + r.par!, 0);
  await expect(dialog).toContainText(`3 stars: ${pars + 4} moves or fewer. 2 stars: ${pars + 12} or fewer.`);
  const stars = escapeLevelStars(results);
  await expect(dialog.getByRole('img', { name: `${stars} of 3 stars` })).toBeVisible();
  // No hint, and the clock (30 s x 2) never ran out: no cap line.
  await expect(dialog).not.toContainText('caps the level');
  const play = dialog.getByRole('button', { name: 'Play Level 2' });
  await expect(play).toBeFocused();
  await expect(dialog.getByRole('link', { name: 'Back to games' })).toBeVisible();

  const saved = await savedGame(page, 'escape');
  expect(saved?.stars['0']).toBeGreaterThanOrEqual(1);
  expect(saved?.stars['0']).toBe(stars);
  expect(saved?.runs?.['0']).toBeUndefined();

  // One tap to the next level, at its first puzzle, with no sheet in between.
  await play.click();
  await expect(page).toHaveURL(/#\/game\/escape\/2$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 2');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  await expect(levelCard(page)).toHaveCount(0);

  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(homeCard(page, 'Brick Escape')).toContainText('Level 2');
});

test('a child leaves mid-level and resumes at the next unsolved puzzle', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);

  const first = await escapePuzzleOnScreen(page, 0);
  await solveEscapeBoard(page, 0, first);
  await page.getByRole('button', { name: 'Next puzzle' }).click();
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  const second = await escapePuzzleOnScreen(page, 0);
  expect(second).not.toBe(first);

  // One move on the second board (a brick leaves), then Back: the unfinished board is dropped with its moves.
  const count = escapeBoard(0, second).blocks.length;
  await solveEscapeBoard(page, 0, second, 1);
  await expect(page.locator('.esc-brick')).toHaveCount(count - 1);
  await expect(page.locator('.esc-status__moves')).toHaveText('Moves 1');

  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL(/#\/$/);
  const card = homeCard(page, 'Brick Escape');
  await expect(card).toContainText('Level 1');
  await expect(card).toHaveAccessibleName(/Level 1, 1 of 4 puzzles solved\.$/);

  // Back in: the same level, the solved puzzle stays solved, the second board starts from its first position.
  await card.click();
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  await expect(page.locator('.esc-status__moves')).toHaveText('Moves 0');
  await expect(page.locator('.esc-brick')).toHaveCount(count);
  expect(await escapePuzzleOnScreen(page, 0)).toBe(second);

  // Closing the app works the same way.
  await page.reload();
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 2 of 4. 1 solved.');
  const run = await savedRun(page, 'escape', 0);
  expect(run.solved.map((r) => r.puzzle)).toEqual([first]);
  expect(run.queue[0]).toBe(second);
});

test('a grown-up picks Level 3, the child finishes it and returns to the frontier', async ({ page }) => {
  // Maya has finished Levels 1 to 5, with 2 stars on Level 3; her frontier is Level 6.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8', games: { escape: { stars: { ...starsUpTo(5), 2: 2 } } } }]);
  await page.goto('/');
  await expect(homeCard(page, 'Brick Escape')).toContainText('Level 6');

  await openSettings(page);
  const row = page.getByRole('link', { name: 'Brick Escape for Maya: Level 6. Pick a level' });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page).toHaveURL(/#\/settings\/levels\/escape\/maya$/);
  const status = page.getByRole('status');
  await expect(status).toHaveText('Maya is on Level 6.');
  await expect(page.locator('[aria-current="step"]')).toHaveAccessibleName('Level 6, Maya’s current level');

  await page.getByRole('button', { name: 'Level 3, 2 stars' }).click();
  await expect(status).toHaveText('Level 3 picked. Maya plays it again from puzzle 1.');
  await page.getByRole('button', { name: 'Play Level 3' }).click();

  await expect(page).toHaveURL(/#\/game\/escape\/3$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 3');
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
  expect((await savedGame(page, 'escape'))?.current).toBe(2);

  for (let n = 1; n <= 4; n++) {
    await solveEscapeBoard(page, 2, await escapePuzzleOnScreen(page, 2));
    if (n < 4) await page.getByRole('button', { name: 'Next puzzle' }).click();
  }

  // Finishing the replay sends the child back to the frontier, not to Level 4.
  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 3');
  const saved = await savedGame(page, 'escape');
  expect(saved?.current).toBe(5);
  // A replay keeps the higher stars.
  expect(saved?.stars['2']).toBeGreaterThanOrEqual(2);
  await dialog.getByRole('button', { name: 'Play Level 6' }).click();
  await expect(page).toHaveURL(/#\/game\/escape\/6$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 6');

  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(homeCard(page, 'Brick Escape')).toContainText('Level 6');
  expect(hashOf(page)).toBe('#/');
});

test('a hint on a board swapped away is forgotten; one on a solved board caps the level at 2 stars', async ({ page }) => {
  // Ages 5 to 6: two Restarts bring the offer.
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6' }]);
  await page.goto('/#/game/escape');
  await expect(page).toHaveURL(/#\/game\/escape\/1$/);
  const hint = page.getByRole('button', { name: 'Hint' });
  const help = page.locator('.esc-help');

  // The offer first (a Restart clears a hint, as it always has), then a hint on the board, then the swap.
  await page.getByRole('button', { name: 'Restart puzzle' }).click();
  await page.getByRole('button', { name: 'Restart puzzle' }).click();
  await expect(page.getByRole('button', { name: 'New puzzle' })).toBeVisible();
  await hint.click();
  await expect(page.locator('.esc-brick.is-hinted')).toHaveCount(1);
  await page.getByRole('button', { name: 'New puzzle' }).click();
  await expect(help).toHaveText('Here is a different puzzle.');
  await expect(page.locator('.esc-brick.is-hinted')).toHaveCount(0);

  const results: PuzzleResult[] = [];
  for (let n = 1; n <= 4; n++) {
    const puzzle = await escapePuzzleOnScreen(page, 0);
    // A hint on the third board, which the child then solves.
    const hinted = n === 3;
    if (hinted) {
      await hint.click();
      await expect(help).toHaveText('Try the glowing brick first.');
    }
    const moves = await solveEscapeBoard(page, 0, puzzle);
    results.push({ puzzle, count: moves, par: escapeBoard(0, puzzle).par, usedHint: hinted, outOfTime: false });
    if (n < 4) {
      // Each saved result carries its own hint: none on the board after the swap, one on the third.
      const run = await savedRun(page, 'escape', 0);
      expect(run.solved.map((r) => r.usedHint)).toEqual(results.map((r) => r.usedHint));
      await page.getByRole('button', { name: 'Next puzzle' }).click();
      // After Next, focus goes to a brick of the new board (brief 10).
      await expect(page.locator('.esc-brick').first()).toBeFocused();
    }
  }

  const dialog = levelCard(page);
  await expect(dialog.getByRole('heading')).toHaveText('You finished Level 1');
  const total = results.reduce((s, r) => s + r.count, 0);
  const pars = results.reduce((s, r) => s + r.par!, 0);
  await expect(dialog).toContainText(`4 puzzles in ${total} moves.`);
  await expect(dialog).toContainText(`3 stars: ${pars + 4} moves or fewer. 2 stars: ${pars + 12} or fewer.`);
  await expect(dialog).toContainText('Using a hint caps the level at 2 stars.');
  // The solver's moves earn the base 3 stars here; the hint takes the third.
  expect(escapeLevelStars(results.map((r) => ({ ...r, usedHint: false })))).toBe(3);
  await expect(dialog.getByRole('img', { name: '2 of 3 stars' })).toBeVisible();
  expect((await savedGame(page, 'escape'))?.stars['0']).toBe(2);

  // Focus stays inside the card: Tab goes round its two buttons.
  const play = dialog.getByRole('button', { name: 'Play Level 2' });
  await expect(play).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('link', { name: 'Back to games' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(play).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link', { name: 'Back to games' })).toBeFocused();

  // Escape closes the card; the tools row then holds the same Play button, with focus (brief 10).
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const again = page.getByRole('button', { name: 'Play Level 2' });
  await expect(again).toBeFocused();
  await again.click();
  await expect(page).toHaveURL(/#\/game\/escape\/2$/);
  await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
});

/* ---------- Restart can be undone, and the board names every brick and door (usability pass, batch G) ---------- */

/** Where each brick on the board is drawn, in board order. */
const brickSpots = (page: Page) => page.locator('.esc-brick').evaluateAll((els) => els.map((el) => (el as HTMLElement).style.transform));

test('Restart puzzle can be undone: one Undo brings back the board and the moves', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '5-6', games: { escape: { stars: starsUpTo(4) } } }]);
  await page.goto('/#/game/escape/5');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 5');
  const moves = page.locator('.esc-status__moves');
  const undo = page.getByRole('button', { name: 'Undo' });

  // Three moves with the keys, then Restart puzzle.
  const played = await playEscapeBoard(page, 4, await escapePuzzleOnScreen(page, 4), { stopAfter: 3 });
  expect(played.moves).toBe(3);
  await expect(moves).toHaveText('Moves 3');
  const before = await brickSpots(page);

  await page.getByRole('button', { name: 'Restart puzzle' }).click();
  await expect(moves).toHaveText('Moves 0');
  await expect(page.locator('.esc-brick')).toHaveCount(escapeBoard(4, await escapePuzzleOnScreen(page, 4)).blocks.length);
  expect(await brickSpots(page)).not.toEqual(before);
  await expect(undo).toBeEnabled();

  // One Undo: every brick back where it was before Restart, and the count with it.
  await undo.click();
  await expect(moves).toHaveText('Moves 3');
  await expect(page.locator('.esc-brick')).toHaveCount(before.length);
  expect(await brickSpots(page)).toEqual(before);
});

test('ages 3 to 4: two Restarts still bring New puzzle', async ({ page }) => {
  await seed(page, [{ id: 'leo', name: 'Leo', ageBand: '3-4' }]);
  await page.goto('/#/game/escape/1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 1');
  const offer = page.getByRole('button', { name: 'New puzzle' });
  const restart = page.getByRole('button', { name: 'Restart puzzle' });

  // A move first, so the first Restart has something to put back (and Undo keeps it).
  await playEscapeBoard(page, 0, await escapePuzzleOnScreen(page, 0), { stopAfter: 1 });
  await restart.click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeEnabled();
  await expect(offer).toHaveCount(0);
  await restart.click();
  await expect(offer).toBeVisible();
});

test('every brick and door has its own name, and each move is read out', async ({ page }) => {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8', games: { escape: { stars: starsUpTo(1) } } }]);
  await page.goto('/#/game/escape/2');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Level 2');
  const puzzle = await escapePuzzleOnScreen(page, 1);
  const board = escapeBoard(1, puzzle);

  // Two bricks of one colour have different names, and every name says where the brick is.
  const bricks = page.locator('.esc-brick');
  await expect(bricks).toHaveCount(board.blocks.length);
  const names = await bricks.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  const twin = board.blocks.findIndex((b, i) => board.blocks.some((o, j) => j > i && o.color === b.color));
  expect(twin, 'Level 2 has two bricks of one colour').toBeGreaterThanOrEqual(0);
  const other = board.blocks.findIndex((o, j) => j > twin && o.color === board.blocks[twin].color);
  expect(names[twin]).not.toBe(names[other]);
  expect(names[twin].startsWith(names[other].split(',')[0])).toBe(true);
  for (const name of names) {
    expect(name).toContain('row');
    expect(name).toContain('column');
  }

  // Every door says which side of the tray it is on.
  const doors = await page.locator('.esc-door').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? ''));
  expect(doors).toHaveLength(board.gates.length);
  for (const door of doors) expect(door).toContain('side');

  // The hidden status line starts empty.
  const status = page.locator('.esc-sr[role="status"]');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).toHaveText('');

  // A one-square slide that keeps the brick on the board; a tight board may first need the solver's drags
  // (each brick that leaves is read out too).
  const slide = (state: State) =>
    board.blocks
      .flatMap((_, block) => Object.values(DIRS).map((dir) => ({ block, dir })))
      .find(({ block, dir }) => state.pos[block] && keyStep(board, state, block, dir).kind === 'moved');
  let state = initialState(board);
  for (let drags = 0; !slide(state); drags++) {
    expect(drags, 'a brick can slide one square').toBeLessThan(board.par);
    const left = state.pos.filter(Boolean).length;
    state = (await playEscapeBoard(page, 1, puzzle, { stopAfter: 1, from: state })).state;
    if (state.pos.filter(Boolean).length < left) await expect(status).toHaveText(/^\w+ brick is out\.\s?$/);
  }

  // After one key press it says where the brick slid; the help line on screen does not change.
  const help = await page.locator('.esc-help').textContent();
  const move = slide(state)!;
  await pressEscapeBrick(page, board, state, move.block, move.dir);
  await expect(status).toHaveText(/slid to (row|column) \d+\./);
  await expect(page.locator('.esc-help')).toHaveText(help ?? '');
});
