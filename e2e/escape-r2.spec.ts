/**
 * Brick Escape, usability round 2 (decisions 1, 2, 17, 20 and 38):
 * - tap a brick, then tap a ringed square or its own door, and it slides there as one move; synthetic clicks
 *   (what VoiceOver and Switch Control send) do the same;
 * - every brick and open door carries its colour's geometric mark;
 * - a speaker in the tools row reads the help line, and is gone while Voice is off;
 * - under Reduce Motion a leaving brick still fades over 150 ms and never slides.
 * Measurements are printed (console) so the run's log carries them per size.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { escapeLevelStars } from '../src/games/run';
import { type Cell, type Level, type State, initialState, isSolved, withMove } from '../src/games/slide/engine';
import { brickLabel, exitLine, exitTargetLabel, slidLine, slideTargetLabel } from '../src/games/slide/labels';
import { MARKS } from '../src/games/slide/marks';
import { HELP_LINE } from '../src/games/slide/puzzles';
import { NO_MOVE_LINE, SELECT_LINE, type TapTarget, tapButtons, tapMove, tapTargets } from '../src/games/slide/tap';
import type { PuzzleResult } from '../src/shared/progress';
import { type Band, dots, editSavedInAnotherTab, escapeBoard, escapePuzzleOnScreen, levelCard, pointerDrag, recordSpeech, seed, starsUpTo } from './app';

/* ---------- helpers ---------- */

/** Open a 0-based level as the child's frontier. The seed is written once per tab: one level per tab. */
async function openLevel(page: Page, level: number, band: Band = '5-6') {
  await seed(page, [{ id: 'maya', name: 'Maya', ageBand: band, games: { escape: { stars: starsUpTo(level) } } }]);
  await page.goto(`/#/game/escape/${level + 1}`);
  await expect(page.locator('.esc-brick').first()).toBeVisible();
  // the real font (Baloo 2, weights 700 and 800) before any measuring: a late swap would re-wrap the help line
  expect(await page.evaluate(async () => (await document.fonts.ready, document.fonts.check('800 16px "Baloo 2"') && document.fonts.check('700 16px "Baloo 2"')))).toBe(true);
  const puzzle = await escapePuzzleOnScreen(page, level);
  return { puzzle, board: escapeBoard(level, puzzle) };
}

const brick = (page: Page, block: number) => page.locator(`.esc-brick[data-block="${block}"]`);
const brickLabelAt = (board: Level, block: number, at: Cell) => brickLabel(board.blocks[block], at);
const targets = (page: Page) => page.locator('.esc-target');

function targetName(board: Level, block: number, t: TapTarget): string {
  const color = board.blocks[block].color;
  return t.kind === 'exit' ? exitTargetLabel(color) : slideTargetLabel(color, t.at);
}

/** The fewest taps that solve `board` from `from`: each a brick and one of the targets the board draws for it. */
function tapPlan(board: Level, from: State): { block: number; target: TapTarget }[] {
  const key = (s: State) => JSON.stringify(s.pos);
  const back = new Map<string, { prev: string; block: number; target: TapTarget; state: State } | null>([[key(from), null]]);
  let frontier: State[] = [from];
  let goal: State | null = isSolved(from) ? from : null;
  while (frontier.length && !goal && back.size < 300_000) {
    const next: State[] = [];
    for (const s of frontier) {
      for (let b = 0; b < board.blocks.length && !goal; b++)
        for (const target of tapButtons(board, s, b)) {
          const res = tapMove(board, s, b, target)!;
          const after = res.kind === 'exit' ? withMove(res.state, b, null) : res.state;
          if (back.has(key(after))) continue;
          back.set(key(after), { prev: key(s), block: b, target, state: after });
          if (isSolved(after)) {
            goal = after;
            break;
          }
          next.push(after);
        }
      if (goal) break;
    }
    frontier = next;
  }
  if (!goal) throw new Error('No tap plan');
  const plan: { block: number; target: TapTarget }[] = [];
  for (let k = key(goal), step = back.get(k); step; k = step.prev, step = back.get(k)) plan.unshift({ block: step.block, target: step.target });
  return plan;
}

type Tap = { block: number; target: TapTarget };

/**
 * Most boards start packed: the only targets are doors, so a spot to slide to shows up only after some bricks
 * are out. This finds the fewest taps from the start to a board where brick `block` has a target `want`
 * accepts, and that target. Null if no such board is reachable.
 */
function tapsTo(board: Level, want: (t: TapTarget, s: State, b: number) => boolean): { plan: Tap[]; state: State; pick: Tap } | null {
  const key = (s: State) => JSON.stringify(s.pos);
  const start = initialState(board);
  const back = new Map<string, { prev: string; tap: Tap } | null>([[key(start), null]]);
  let frontier: State[] = [start];
  while (frontier.length && back.size < 300_000) {
    const next: State[] = [];
    for (const s of frontier) {
      for (let b = 0; b < board.blocks.length; b++) {
        const hit = tapButtons(board, s, b).find((t) => want(t, s, b));
        if (hit) {
          const plan: Tap[] = [];
          for (let k = key(s), step = back.get(k); step; k = step.prev, step = back.get(k)) plan.unshift(step.tap);
          return { plan, state: s, pick: { block: b, target: hit } };
        }
      }
      for (let b = 0; b < board.blocks.length; b++)
        for (const target of tapButtons(board, s, b)) {
          const res = tapMove(board, s, b, target)!;
          const after = res.kind === 'exit' ? withMove(res.state, b, null) : res.state;
          if (back.has(key(after)) || isSolved(after)) continue;
          back.set(key(after), { prev: key(s), tap: { block: b, target } });
          next.push(after);
        }
    }
    frontier = next;
  }
  return null;
}

/** Carry out `plan` by taps on the board on screen, from its start; returns the board after it. */
async function playTaps(page: Page, board: Level, plan: Tap[]): Promise<State> {
  let state = initialState(board);
  for (const [i, { block, target }] of plan.entries()) {
    await brick(page, block).tap();
    await page.getByRole('button', { name: targetName(board, block, target), exact: true }).tap();
    await expect(page.locator('.esc-status__moves')).toHaveText(`Moves ${i + 1}`);
    const res = tapMove(board, state, block, target)!;
    state = res.kind === 'exit' ? withMove(res.state, block, null) : res.state;
    await expect(page.locator('.esc-brick')).toHaveCount(state.pos.filter(Boolean).length);
  }
  return state;
}

/** Open Level 9 and tap to the first board where a brick has a spot to slide to that `want` accepts. */
async function openWithSlide(page: Page, want: (t: TapTarget) => boolean = (t) => t.kind === 'slide') {
  const { board } = await openLevel(page, 8);
  const found = tapsTo(board, (t) => want(t));
  expect(found, 'a board with such a spot, reachable by taps').not.toBeNull();
  const state = await playTaps(page, board, found!.plan);
  return { board, state, moves: found!.plan.length, pick: found!.pick };
}

type How = 'tap' | 'click';
const press = (l: Locator, how: How) => (how === 'tap' ? l.tap() : l.evaluate((el) => (el as HTMLElement).click()));

/** Solve the board on screen by tapping (or clicking) a brick and then its target; returns the taps on targets. */
async function solveByTaps(page: Page, board: Level, how: How): Promise<number> {
  let state = initialState(board);
  const plan = tapPlan(board, state);
  let n = 0;
  for (const { block, target } of plan) {
    await press(brick(page, block), how);
    await expect(brick(page, block)).toHaveAttribute('aria-pressed', 'true');
    await press(page.getByRole('button', { name: targetName(board, block, target), exact: true }), how);
    n++;
    await expect(page.locator('.esc-status__moves')).toHaveText(`Moves ${n}`);
    const res = tapMove(board, state, block, target)!;
    state = res.kind === 'exit' ? withMove(res.state, block, null) : res.state;
    await expect(page.locator('.esc-brick')).toHaveCount(state.pos.filter(Boolean).length);
  }
  return n;
}

type Box = { x: number; y: number; width: number; height: number };
const overlaps = (a: Box, b: Box, slack = 0.5) =>
  a.x + a.width - slack > b.x && b.x + b.width - slack > a.x && a.y + a.height - slack > b.y && b.y + b.height - slack > a.y;

/** The tools row, the board's cells and the screen zoom (1.4 on iPad, which Screen applies). */
async function zoomOf(page: Page): Promise<number> {
  return page.locator('.esc-tools').evaluate((el) => {
    let z = 1;
    for (let e: Element | null = el; e; e = e.parentElement) z *= Number(getComputedStyle(e).zoom) || 1;
    return z;
  });
}

/* ---------- decision 1: tap to move ---------- */

test.describe('decision 1: tap a brick, then tap where it should slide', () => {
  for (const band of ['3-4', '9-10'] as Band[]) {
    test(`ages ${band}: Level 1 by taps alone, and the level card counts the taps as moves`, async ({ page }) => {
      await openLevel(page, 0, band);
      const results: PuzzleResult[] = [];
      for (let n = 1; n <= 4; n++) {
        const puzzle = await escapePuzzleOnScreen(page, 0);
        const board = escapeBoard(0, puzzle);
        const moves = await solveByTaps(page, board, 'tap');
        results.push({ puzzle, count: moves, par: board.par, usedHint: false, outOfTime: false });
        if (n < 4) {
          await expect(page.locator('.esc-help')).toHaveText(`Solved in ${moves} ${moves === 1 ? 'move' : 'moves'}.`);
          await page.getByRole('button', { name: 'Next puzzle' }).click();
        }
      }
      await expect(dots(page)).toHaveAttribute('aria-label', '4 of 4 solved.');
      const dialog = levelCard(page);
      const total = results.reduce((s, r) => s + r.count, 0);
      await expect(dialog).toContainText(`4 puzzles in ${total} moves.`);
      await expect(dialog.getByRole('img', { name: `${escapeLevelStars(results)} of 3 stars` })).toBeVisible();
    });
  }

  test('a puzzle of Level 1 by synthetic clicks alone, as VoiceOver and Switch Control send them', async ({ page }) => {
    const { board } = await openLevel(page, 0);
    const moves = await solveByTaps(page, board, 'click');
    await expect(page.locator('.esc-help')).toHaveText(`Solved in ${moves} ${moves === 1 ? 'move' : 'moves'}.`);
    await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
  });

  test('a target two squares away slides the brick two squares as one move, and one Undo brings it back', async ({ page }) => {
    // Level 9's boards start packed; a spot two squares away opens up once some bricks are out
    const { board, state: s, moves, pick } = await openWithSlide(page, (t) => t.kind === 'slide' && t.steps === 2);
    const { block, target: t } = pick;
    const name = brick(page, block);
    const before = await name.getAttribute('aria-label');
    await name.tap();
    await page.getByRole('button', { name: targetName(board, block, t), exact: true }).tap();
    await expect(page.locator('.esc-status__moves')).toHaveText(`Moves ${moves + 1}`);
    const at = t.kind === 'slide' ? t.at : ([0, 0] as Cell);
    await expect(name).toHaveAttribute('aria-label', brickLabelAt(board, block, at));
    await expect(page.getByRole('status')).toHaveText(new RegExp(`^${slidLine(board.blocks[block].color, s.pos[block]!, at).replace('.', '\\.')}`));
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.esc-status__moves')).toHaveText(`Moves ${moves}`);
    await expect(name).toHaveAttribute('aria-label', before!);
  });

  test('a press that moves under 8 px selects; a drag never leaves a selection; a second tap on the picked brick clears it', async ({ page }) => {
    const { board, moves, pick } = await openWithSlide(page);
    const movable = pick.block;
    const b = brick(page, movable);
    const box = (await b.boundingBox())!;
    const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    // a 5 px wobble is still a tap
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.down();
    await page.mouse.move(mid.x + 3, mid.y + 4, { steps: 3 });
    await page.mouse.up();
    await expect(b).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.esc-help')).toHaveText(SELECT_LINE);
    await expect(targets(page).first()).toBeVisible();
    // a palm tap: the picked brick again clears it and moves nothing
    await b.tap();
    await expect(b).toHaveAttribute('aria-pressed', 'false');
    await expect(targets(page)).toHaveCount(0);
    await expect(page.locator('.esc-status__moves')).toHaveText(`Moves ${moves}`);
    // a press that went past 8 px and came back is a drag: it never picks the brick
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.down();
    await page.mouse.move(mid.x + 9, mid.y, { steps: 3 });
    await page.mouse.move(mid.x, mid.y, { steps: 3 });
    await page.mouse.up();
    await expect(b).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.esc-status__moves')).toHaveText(`Moves ${moves}`);
    // pick it, then drag it to one of its spots: the drag moves it and no selection is left behind
    await b.tap();
    const spot = (await page.getByRole('button', { name: targetName(board, movable, pick.target), exact: true }).boundingBox())!;
    await pointerDrag(page, b, { x: spot.x + spot.width / 2, y: spot.y + spot.height / 2 });
    await expect(page.locator('.esc-status__moves')).toHaveText(`Moves ${moves + 1}`);
    await expect(page.locator('.esc-brick[aria-pressed="true"]')).toHaveCount(0);
    await expect(targets(page)).toHaveCount(0);
    await expect(page.locator('.esc-help')).not.toHaveText(SELECT_LINE);
  });

  test('a finger that wobbles toward the door still picks a brick that stands beside its own door', async ({ page }) => {
    const { board } = await openLevel(page, 0);
    const s = initialState(board);
    const block = board.blocks.findIndex((_, b) => tapButtons(board, s, b).some((t) => t.kind === 'exit' && t.steps === 1));
    expect(block, 'a brick beside its own door on Level 1').toBeGreaterThanOrEqual(0);
    const { dir } = tapButtons(board, s, block).find((t) => t.kind === 'exit')!;
    const b = brick(page, block);
    const box = (await b.boundingBox())!;
    const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const press = async (px: number) => {
      await page.mouse.move(mid.x, mid.y);
      await page.mouse.down();
      await page.mouse.move(mid.x + dir[1] * px, mid.y + dir[0] * px, { steps: 2 });
      await page.mouse.up();
    };
    // every wobble under the 8 px limit is a tap, the last one right at the edge of it
    for (const px of [1, 3, 7]) {
      await press(px);
      await expect(b, `${px} px toward the door picks the brick`).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.esc-brick.is-pulled')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(b).toHaveAttribute('aria-pressed', 'false');
    }
    // 8 px is a drag: it never picks the brick, and it is too short to take the brick out
    await press(8);
    await expect(b).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.esc-brick')).toHaveCount(board.blocks.length);
    await expect(page.locator('.esc-status__moves')).toHaveText('Moves 0');
  });

  test('after a finger drag, which sends no click, the next Enter or VoiceOver click still picks the brick', async ({ page }) => {
    await openLevel(page, 0);
    const b = brick(page, 0);
    const cdp = await page.context().newCDPSession(page);
    /** A real finger pushing the brick 40 px and lifting: the browser sends no click after it. */
    const fingerDrag = async () => {
      const box = (await b.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (const dy of [14, 28, 40]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + dy }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await fingerDrag();
    await expect(b).toHaveAttribute('aria-pressed', 'false');
    await b.focus();
    await page.keyboard.press('Enter');
    await expect(b, 'Enter after a finger drag').toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');

    await fingerDrag();
    await expect(b).toHaveAttribute('aria-pressed', 'false');
    await b.evaluate((el) => (el as HTMLElement).click());
    await expect(b, 'a synthetic click after a finger drag').toHaveAttribute('aria-pressed', 'true');
  });

  test('keyboard and VoiceOver order: a picked brick’s targets come right after it, and Escape on a target goes back to the brick', async ({ page }) => {
    const { board } = await openLevel(page, 0);
    const s = initialState(board);
    // the first brick in the page with a target, and bricks after it to step over
    const block = board.blocks.findIndex((_, b) => tapButtons(board, s, b).length > 0);
    expect(block).toBeLessThan(board.blocks.length - 1);
    const b = brick(page, block);
    await b.focus();
    await page.keyboard.press('Enter');
    await expect(b).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Tab');
    await expect(targets(page).first(), 'the next stop after the picked brick').toBeFocused();
    await page.keyboard.press('Escape');
    await expect(targets(page)).toHaveCount(0);
    await expect(b, 'focus goes back to the brick when its target goes away').toBeFocused();
  });

  test('Escape, a tap on the empty board, a tap on another brick, Undo, Restart and Hint all change or clear the selection', async ({ page }) => {
    const { board, state: s, moves, pick } = await openWithSlide(page);
    const a = brick(page, pick.block);
    const pressed = page.locator('.esc-brick[aria-pressed="true"]');

    await a.tap();
    await expect(pressed).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(pressed).toHaveCount(0);

    await a.tap();
    const board$ = (await page.locator('.esc-board').boundingBox())!;
    // the frame's top left corner is board, never a brick or a target
    await page.touchscreen.tap(board$.x + 6, board$.y + 6);
    await expect(pressed).toHaveCount(0);

    await a.tap();
    const other = board.blocks.findIndex((_, b) => b !== pick.block && s.pos[b] !== null);
    await brick(page, other).tap();
    await expect(brick(page, other)).toHaveAttribute('aria-pressed', 'true');
    await expect(a).toHaveAttribute('aria-pressed', 'false');

    // one more move, so Undo and Restart have something to do
    await a.tap();
    await page.getByRole('button', { name: targetName(board, pick.block, pick.target), exact: true }).tap();
    await expect(page.locator('.esc-status__moves')).toHaveText(`Moves ${moves + 1}`);
    await brick(page, other).tap();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(pressed).toHaveCount(0);
    await brick(page, other).tap();
    await page.getByRole('button', { name: 'Hint' }).click();
    await expect(pressed).toHaveCount(0);
    await brick(page, other).tap();
    await page.getByRole('button', { name: 'Restart puzzle' }).click();
    await expect(pressed).toHaveCount(0);
    await expect(targets(page)).toHaveCount(0);
  });

  test('a brick with nowhere to go says so, and the help line comes back when it is let go', async ({ page }) => {
    const { board } = await openLevel(page, 8);
    const s = initialState(board);
    const stuck = board.blocks.findIndex((_, b) => tapTargets(board, s, b).length === 0);
    expect(stuck, 'a brick with nowhere to go on this board').toBeGreaterThanOrEqual(0);
    await brick(page, stuck).tap();
    await expect(page.locator('.esc-help')).toHaveText(NO_MOVE_LINE);
    await expect(targets(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.esc-help')).not.toHaveText(NO_MOVE_LINE);
  });

  test('VoiceOver names: bricks keep their names and say pressed, targets are named, the status line reads the move', async ({ page }) => {
    const { board } = await openLevel(page, 0);
    const s = initialState(board);
    await expect(page.locator('.esc-help')).toHaveText(board.tip ?? HELP_LINE);
    for (let i = 0; i < board.blocks.length; i++) await expect(brick(page, i)).toHaveAttribute('aria-pressed', 'false');
    const { block: b, target } = tapPlan(board, s)[0];
    const name = await brick(page, b).getAttribute('aria-label');
    await brick(page, b).tap();
    await expect(brick(page, b)).toHaveAttribute('aria-pressed', 'true');
    await expect(brick(page, b)).toHaveAttribute('aria-label', name!);
    for (const t of tapButtons(board, s, b)) await expect(page.getByRole('button', { name: targetName(board, b, t), exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: targetName(board, b, target), exact: true }).tap();
    const color = board.blocks[b].color;
    const line = target.kind === 'exit' ? exitLine(color) : slidLine(color, s.pos[b]!, target.at);
    await expect(page.getByRole('status')).toHaveText(new RegExp(`^${line.replace('.', '\\.')}`));
  });

  test('under Reduce Motion a tap slide is instant, as a drag is', async ({ page }) => {
    const { board, pick } = await openWithSlide(page);
    const b = brick(page, pick.block);
    // only the opacity can ease, so the brick jumps to its spot
    expect(await b.evaluate((el) => getComputedStyle(el).transitionProperty)).toBe('opacity');
    const from = (await b.boundingBox())!;
    await b.tap();
    await page.getByRole('button', { name: targetName(board, pick.block, pick.target), exact: true }).tap();
    // read in the same task as the tap's effects land: no frame in between, nothing in flight
    const moved = await b.evaluate((el) => {
      const anims = el.getAnimations().filter((x) => (x as CSSTransition).transitionProperty === 'transform');
      return { anims: anims.length, box: el.getBoundingClientRect().toJSON() as Box };
    });
    expect(moved.anims).toBe(0);
    expect(moved.box.x !== from.x || moved.box.y !== from.y).toBe(true);
  });
});

/* ---------- decision 1: target layout, at every size ---------- */

/**
 * On Levels 1, 9, 20 and 31: every brick's targets on the board as it starts (doors only, the boards start
 * packed), then again on the first board taps reach where a brick has a spot to slide to.
 */
async function targetLayout(first: Page, label: string) {
  for (const level of [0, 8, 19, 30]) {
    // a starred level sends the child on to the frontier, so each level opens in its own tab
    const page = await first.context().newPage();
    const { board } = await openLevel(page, level);
    const zoom = await zoomOf(page);
    const cell = (await page.locator('.esc-well').first().boundingBox())!;
    const cellPt = cell.width;
    const small: string[] = [];
    if (cellPt < 44) small.push(`cell ${cellPt.toFixed(1)} pt, under 44`);
    await checkTargets(page, board, initialState(board), `${label} L${level + 1}`);
    const found = tapsTo(board, (t) => t.kind === 'slide');
    let slides = 0;
    if (found) {
      const s = await playTaps(page, board, found.plan);
      slides = board.blocks.reduce((n, _, b) => n + tapButtons(board, s, b).filter((t) => t.kind === 'slide').length, 0);
      await checkTargets(page, board, s, `${label} L${level + 1} after ${found.plan.length} taps`);
    }
    console.log(`[escape-r2] targets ${label} Level ${level + 1}: cell ${cellPt.toFixed(1)} px on screen (zoom ${zoom}), ${slides} slide spots checked ${small.join(', ')}`);
    await page.close();
  }
}

async function checkTargets(page: Page, board: Level, s: State, where: string) {
  for (let b = 0; b < board.blocks.length; b++) {
    if (!s.pos[b]) continue;
    const buttons = tapButtons(board, s, b);
    if (!buttons.length) continue;
    // one square now: the help line above the tools can change its height after a move, and the board with it
    const before = (await page.locator('.esc-board').boundingBox())!;
    const cellPt = (await page.locator('.esc-well').first().boundingBox())!.width;
    await brick(page, b).tap();
    await expect(targets(page)).toHaveCount(buttons.length);
    // picking a brick never resizes or moves the board
    const after = (await page.locator('.esc-board').boundingBox())!;
    for (const k of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(after[k] - before[k]), `${where} board steady (${k})`).toBeLessThan(0.5);
    // the bricks and every target read in one go, from one layout
    const names = buttons.map((t) => targetName(board, b, t));
    const seen = await page.evaluate((names) => {
      const rect = (e: Element) => e.getBoundingClientRect().toJSON() as Box;
      const byName = (n: string) => [...document.querySelectorAll('.esc-target')].find((e) => e.getAttribute('aria-label') === n)!;
      return {
        bricks: [...document.querySelectorAll('.esc-brick')].map(rect),
        targets: names.map((n) => ({ box: rect(byName(n)), reach: [...byName(n).querySelectorAll('.esc-target__reach')].map(rect) })),
      };
    }, names);
    const bricks = seen.bricks;
    const boxes: Box[] = [];
    for (const [i, t] of buttons.entries()) {
      const { box, reach } = seen.targets[i];
      if (t.kind === 'slide') {
        // the button is exactly the free squares at the leading edge
        const rows = new Set(t.cells.map((c) => c[0])).size;
        const cols = new Set(t.cells.map((c) => c[1])).size;
        expect(Math.abs(box.width - cols * cellPt), `${where} width`).toBeLessThan(1);
        expect(Math.abs(box.height - rows * cellPt), `${where} height`).toBeLessThan(1);
        boxes.push(box);
      } else {
        // the door's hit area: the button plus the squares it reaches into, 44 pt both ways at least
        const parts = [box, ...reach];
        const x0 = Math.min(...parts.map((p) => p.x));
        const y0 = Math.min(...parts.map((p) => p.y));
        const x1 = Math.max(...parts.map((p) => p.x + p.width));
        const y1 = Math.max(...parts.map((p) => p.y + p.height));
        expect(x1 - x0, `${where} exit width`).toBeGreaterThanOrEqual(44 - 0.5);
        expect(y1 - y0, `${where} exit height`).toBeGreaterThanOrEqual(44 - 0.5);
        for (const p of reach) boxes.push(p);
        // the part on the door sits outside the tray's squares, so it never covers a brick
        for (const k of bricks) expect(overlaps(box, k), `${where} exit over a brick`).toBe(false);
      }
    }
    for (let i = 0; i < boxes.length; i++) {
      for (const k of bricks) expect(overlaps(boxes[i], k), `${where} target over a brick`).toBe(false);
      for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j]), `${where} targets overlap`).toBe(false);
    }
    await page.keyboard.press('Escape');
  }
}

test('targets never cover a brick or each other, each fills its squares, the door target is 44 by 44', async ({ page }, info) => {
  await targetLayout(page, info.project.name);
});

test.describe('targets on a small phone, 375x667 @phone-only', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  test('targets never cover a brick or each other at 375x667', async ({ page }) => {
    await targetLayout(page, '375x667');
  });
});

test.describe('targets on iPad in landscape, 1194x834 @phone-only', () => {
  test.use({ viewport: { width: 1194, height: 834 }, isMobile: true, hasTouch: true });
  test('targets never cover a brick or each other at 1194x834', async ({ page }) => {
    await targetLayout(page, '1194x834');
  });
});

/* ---------- decision 2: colour marks ---------- */

async function checkMarks(first: Page, level: number, label: string) {
  // a starred level sends the child on to the frontier, so each level opens in its own tab
  const page = await first.context().newPage();
  const { board } = await openLevel(page, level);
  const bricks = page.locator('.esc-brick');
  const n = await bricks.count();
  let smallest = Infinity;
  for (let i = 0; i < n; i++) {
    const b = bricks.nth(i);
    const color = (await b.getAttribute('aria-label'))!.split(' ')[0].toLowerCase() as keyof typeof MARKS;
    const mark = b.locator('.esc-mark');
    await expect(mark).toHaveCount(1);
    await expect(mark).toHaveAttribute('data-shape', MARKS[color].shape);
    await expect(mark).toHaveAttribute('aria-hidden', 'true');
    const mb = (await mark.boundingBox())!;
    const bb = (await b.boundingBox())!;
    smallest = Math.min(smallest, mb.width);
    // inside the face, clear of its lit top edge and shaded bottom edge
    const zoom = await zoomOf(page);
    expect(mb.y, `${label} L${level + 1} mark below the top edge`).toBeGreaterThanOrEqual(bb.y + 2 * zoom - 0.5);
    expect(mb.y + mb.height, `${label} L${level + 1} mark above the bottom edge`).toBeLessThanOrEqual(bb.y + bb.height - 4 * zoom + 0.5);
    expect(mb.x).toBeGreaterThanOrEqual(bb.x);
    expect(mb.x + mb.width).toBeLessThanOrEqual(bb.x + bb.width);
  }
  const doors = page.locator('.esc-door');
  for (let i = 0; i < (await doors.count()); i++) {
    const d = doors.nth(i);
    const iced = await d.evaluate((el) => el.classList.contains('is-iced'));
    if (iced) {
      await expect(d.locator('.esc-mark')).toHaveCount(0);
      continue;
    }
    const color = (await d.getAttribute('aria-label'))!.split(' ')[0].toLowerCase() as keyof typeof MARKS;
    await expect(d.locator('.esc-mark')).toHaveCount(1);
    await expect(d.locator('.esc-mark')).toHaveAttribute('data-shape', MARKS[color].shape);
    const mb = (await d.locator('.esc-mark').boundingBox())!;
    const ab = (await d.locator('.esc-door__arrow').boundingBox())!;
    expect(mb.width, `${label} L${level + 1} door mark`).toBeGreaterThanOrEqual(14 - 0.5);
    // the chevron's ink is its middle 8 x 8 px of 16 (the path runs 6 to 18 of 24)
    const ink = { x: ab.x + ab.width / 4, y: ab.y + ab.height / 4, width: ab.width / 2, height: ab.height / 2 };
    expect(overlaps(mb, ink), `${label} L${level + 1} door mark over the chevron`).toBe(false);
  }
  console.log(`[escape-r2] marks ${label} Level ${level + 1}: ${n} bricks, smallest brick mark ${smallest.toFixed(1)} px`);
  await page.close();
  return { smallest, board };
}

test('decision 2: every brick and every open door on Levels 1, 4, 9, 20 and 31 shows its colour’s mark', async ({ page }, info) => {
  for (const level of [0, 3, 8, 19, 30]) await checkMarks(page, level, info.project.name);
});

test.describe('decision 2 on a small phone, 375x667 @phone-only', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  test('the mark is at least 14 px on Level 31, the smallest squares', async ({ page }) => {
    const { smallest } = await checkMarks(page, 30, '375x667');
    expect(smallest).toBeGreaterThanOrEqual(14 - 0.5);
  });
});

/* ---------- decisions 17 and 20: the speaker in the tools row ---------- */

async function speakerChecks(page: Page, label: string) {
  const spoken = await recordSpeech(page);
  await openLevel(page, 0);
  const speaker = page.getByRole('button', { name: 'Hear the help line', exact: true });
  await expect(speaker).toBeVisible();
  const zoom = await zoomOf(page);
  const sb = (await speaker.boundingBox())!;
  const row = (await page.locator('.esc-tools').boundingBox())!;
  expect(sb.width).toBeGreaterThanOrEqual(54 * zoom - 0.5);
  expect(sb.height).toBeGreaterThanOrEqual(54 * zoom - 0.5);
  expect(sb.x).toBeGreaterThanOrEqual(row.x - 0.5);
  expect(sb.y).toBeGreaterThanOrEqual(row.y - 0.5);
  expect(sb.y + sb.height).toBeLessThanOrEqual(row.y + row.height + 0.5);
  for (const name of ['Undo', 'Hint']) expect(overlaps(sb, (await page.getByRole('button', { name, exact: true }).boundingBox())!)).toBe(false);
  // the offer cell, at the row's far end, is empty for now: the speaker stays in the left third
  expect(sb.x + sb.width).toBeLessThanOrEqual(row.x + row.width / 3);
  const centre = (await page.locator('.esc-tools__centre').boundingBox())!;
  console.log(`[escape-r2] speaker ${label}: ${sb.width.toFixed(1)} x ${sb.height.toFixed(1)} px on screen (zoom ${zoom}), centre group x ${centre.x.toFixed(1)}`);

  // a tap reads exactly the help line on screen, and nothing is said before it
  expect(await spoken()).toEqual([]);
  const line = await page.locator('.esc-help').innerText();
  await speaker.tap();
  await expect.poll(spoken).toEqual([line]);

  // the help line changes with a picked brick; the speaker reads the new one
  await page.locator('.esc-brick').first().tap();
  const picked = await page.locator('.esc-help').innerText();
  expect([SELECT_LINE, NO_MOVE_LINE]).toContain(picked);
  await speaker.tap();
  await expect.poll(spoken).toEqual([line, picked]);
  await page.keyboard.press('Escape');

  // Voice off (a grown-up, in another tab): no speaker, and Undo and Hint stay where they are
  await editSavedInAnotherTab(page, (s) => {
    (s as unknown as { settings: { voice: boolean } }).settings.voice = false;
  });
  await expect(speaker).toHaveCount(0);
  const after = (await page.locator('.esc-tools__centre').boundingBox())!;
  expect(Math.abs(after.x - centre.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - centre.y)).toBeLessThanOrEqual(1);
}

test('decisions 17 and 20: a speaker in the tools row reads the help line, and hides while Voice is off', async ({ page }, info) => {
  await speakerChecks(page, info.project.name);
});

test.describe('the speaker on a small phone, 375x667 @phone-only', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  test('the speaker at 375x667', async ({ page }) => {
    await speakerChecks(page, '375x667');
  });
});

test.describe('the speaker on iPad in landscape, 1194x834 @phone-only', () => {
  test.use({ viewport: { width: 1194, height: 834 }, isMobile: true, hasTouch: true });
  test('the speaker at 1194x834', async ({ page }) => {
    await speakerChecks(page, '1194x834');
  });
});

/* ---------- decision 38: the 150 ms fade under Reduce Motion ---------- */

test('decision 38: under Reduce Motion a leaving brick fades over 150 ms and does not slide; the others keep their values', async ({ page }) => {
  const { board } = await openLevel(page, 0);
  let state = initialState(board);
  await page.evaluate(() => {
    const w = window as unknown as { __exit?: { duration: string; property: string } };
    new MutationObserver((list) => {
      for (const m of list) {
        const el = m.target as HTMLElement;
        if (el.classList?.contains('is-exiting') && !w.__exit) {
          const cs = getComputedStyle(el);
          w.__exit = { duration: cs.transitionDuration, property: cs.transitionProperty };
        }
      }
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  // tap through the plan up to the first brick that leaves
  for (const { block, target } of tapPlan(board, state)) {
    const still = page.locator(`.esc-brick:not([data-block="${block}"])`).first();
    const before = (await still.count()) ? await still.evaluate((el) => getComputedStyle(el).transitionDuration) : null;
    await brick(page, block).tap();
    await page.getByRole('button', { name: targetName(board, block, target), exact: true }).tap();
    const res = tapMove(board, state, block, target)!;
    if (res.kind === 'exit') {
      await expect.poll(() => page.evaluate(() => (window as unknown as { __exit?: unknown }).__exit ?? null)).toEqual({ duration: '0.15s', property: 'opacity' });
      // a brick that is not leaving keeps the global value
      if (before !== null) {
        expect(before).not.toBe('0.15s');
        expect(await still.evaluate((el) => getComputedStyle(el).transitionDuration)).toBe(before);
      }
      return;
    }
    state = res.state;
  }
  throw new Error('No brick left the board');
});
