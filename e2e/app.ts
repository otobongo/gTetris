/**
 * Helpers the journeys share: a known starting state on this device, the grown-up check, reading what
 * the app saved, and solving a puzzle the way a child would (arrow keys on a Brick Escape brick, letter
 * keys in Letter Builder, paint taps in Color Mixer, shapes dragged or tapped into Shape Sorter's holes,
 * towers swapped in Number Line-up). Nothing here reaches into the app's code at run time: the page is
 * driven through its buttons, links and keys, and pointer drags for Shape Sorter and Number Line-up,
 * and storage is only written before the app loads. The kit games' puzzles are read from the
 * accessible names in six-games brief 9.2.
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { PAINTS, RECIPES, RESULTS, mixOf, type PaintId, type ResultId } from '../src/games/mixer/colors';
import { type Cell, type Level, type State, DIRS, canPlace, fromSpec, initialState, isSolved, occupancy, reachable, withMove } from '../src/games/slide/engine';
import { keyStep } from '../src/games/slide/drag';
import { PUZZLE_DATA } from '../src/games/slide/puzzles.data';
import { solve } from '../src/games/slide/solver';
import { CLEAR_MS, hardDrop as dropHardDrop, move as dropMove, rotate as dropRotate, step as dropStep, type GameState as DropGame } from '../src/games/drop/engine';
import { puzzleGame } from '../src/games/drop/puzzles';

export const STORAGE_KEY = 'brickwise:v2';

/* ---------- Seeding a known state ---------- */

export type Band = '3-4' | '5-6' | '7-8' | '9-10';

export interface GameSeed {
  /** Stars per finished level (0-based level index). */
  stars?: Record<number, number>;
  /** A grown-up's pick (0-based). */
  current?: number;
}

export interface PlayerSeed {
  id: string;
  name: string;
  ageBand: Band;
  color?: string;
  dailyLimit?: number;
  /** Minutes already played today. */
  minutesToday?: number;
  games?: Record<string, GameSeed>;
}

/** Stars on levels 0 to count-1, three each: a child whose frontier is level `count` (0-based). */
export function starsUpTo(count: number, stars = 3): Record<number, number> {
  return Object.fromEntries(Array.from({ length: count }, (_, i) => [i, stars]));
}

function gameRecord(seed: GameSeed) {
  const stars = seed.stars ?? {};
  const levels = Object.keys(stars).map(Number);
  const record: Record<string, unknown> = { unlocked: levels.length ? Math.max(...levels) + 1 : 0, stars, best: {} };
  if (seed.current !== undefined) record.current = seed.current;
  return record;
}

/**
 * Write a progress record before the app's first load in this tab, as a v3 record of `players`
 * (the first one active). Later reloads keep whatever the app saved since: the seed is written once per tab.
 */
export async function seed(page: Page, players: PlayerSeed[], active = players[0]?.id ?? null) {
  const now = Date.now();
  const state = {
    version: 3,
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      ageBand: p.ageBand,
      color: p.color ?? 'blue',
      dailyLimit: p.dailyLimit ?? 20,
      timerMode: p.ageBand === '3-4' ? 'relaxed' : 'auto',
      unnamed: false,
      createdAt: now,
      updatedAt: now,
      games: Object.fromEntries(Object.entries(p.games ?? {}).map(([id, g]) => [id, gameRecord(g)])),
      stickers: {},
      today: { day: '', minutes: p.minutesToday ?? 0, extraMinutes: 0 },
    })),
    activePlayerId: active,
    settings: { sound: false, music: false, voice: true, alerts: false },
    settingsUpdatedAt: now,
  };
  await page.addInitScript(
    ({ key, state }) => {
      if (sessionStorage.getItem('e2e-seeded')) return;
      sessionStorage.setItem('e2e-seeded', '1');
      // Today's local day, from the page's own clock (a test may have installed a fake one).
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      const day = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      for (const player of state.players) player.today.day = day;
      localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state },
  );
}

/** The whole saved record, as the app wrote it. */
export async function savedState(page: Page): Promise<SavedState> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
}

/**
 * Change the saved record from another tab, as a grown-up's second tab would. The other tab opens a plain
 * file on the same origin, so no copy of the app runs there; the browser's storage event then makes this
 * tab's store read the record again.
 */
export async function editSavedInAnotherTab(page: Page, edit: (state: SavedState) => void) {
  const other = await page.context().newPage();
  await other.goto('/icon.svg');
  const state: SavedState = await other.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
  edit(state);
  await other.evaluate(({ key, json }) => localStorage.setItem(key, json), { key: STORAGE_KEY, json: JSON.stringify(state) });
  await other.close();
}

/* ---------- Reading what the app saved ---------- */

export interface SavedRun {
  set: string;
  seed: number;
  queue: number[];
  solved: { puzzle: number; count: number; word?: string; usedHint: boolean; outOfTime: boolean }[];
  hintsLeft?: number;
}

export interface SavedGame {
  unlocked: number;
  stars: Record<string, number>;
  best: Record<string, number>;
  current?: number;
  runs?: Record<string, SavedRun>;
}

export interface SavedState {
  activePlayerId: string | null;
  players: { id: string; name: string; ageBand: Band; dailyLimit: number; games: Record<string, SavedGame>; stickers: Record<string, unknown> }[];
}

export async function savedGame(page: Page, game: string, playerId?: string): Promise<SavedGame | null> {
  const state = await savedState(page);
  if (!state) return null;
  const id = playerId ?? state.activePlayerId;
  return state.players.find((p) => p.id === id)?.games?.[game] ?? null;
}

/** The run of a 0-based level, once the game has saved it (it does when the level opens). */
export async function savedRun(page: Page, game: string, level: number): Promise<SavedRun> {
  let run: SavedRun | undefined;
  await expect
    .poll(async () => {
      run = (await savedGame(page, game))?.runs?.[level];
      return !!run;
    })
    .toBe(true);
  return run!;
}

/* ---------- Screens ---------- */

/** The four progress dots under a game's title, by their text equivalent. */
export const dots = (page: Page): Locator => page.locator('.bw-dots[role="img"]');

export const levelCard = (page: Page): Locator => page.getByRole('dialog');

/** A Home game card, by the start of its accessible name ("Brick Escape. ..."). */
export const homeCard = (page: Page, title: string): Locator => page.getByRole('link', { name: new RegExp(`^${title}\\.`) });

/** Answer the grown-up check's random two-digit sum. */
export async function passGrownUpCheck(page: Page) {
  const sum = (await page.locator('.sc-gate__sum').textContent()) ?? '';
  const m = /What is (\d+) \+ (\d+)\?/.exec(sum);
  if (!m) throw new Error(`No sum on the grown-up check: "${sum}"`);
  await page.getByLabel(/^Answer for \d+ plus \d+$/).fill(String(Number(m[1]) + Number(m[2])));
  await page.getByRole('button', { name: 'Check', exact: true }).click();
}

/** Home, then the gear, then the grown-up check: Settings for grown-ups. */
export async function openSettings(page: Page) {
  await page.goto('/#/');
  await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
  await passGrownUpCheck(page);
  await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
}

export const hashOf = (page: Page) => new URL(page.url()).hash;

/* ---------- Brick Escape: solving a board with the arrow keys ---------- */

/** Board `puzzle` (0 to 5) of Brick Escape level `level` (0-based), as the game builds it. */
export function escapeBoard(level: number, puzzle: number): Level {
  const p = PUZZLE_DATA[level].puzzles[puzzle];
  return { ...fromSpec(p.spec, level + 1, p.par), order: p.order };
}

const ARROW: Record<string, string> = { '-1,0': 'ArrowUp', '1,0': 'ArrowDown', '0,-1': 'ArrowLeft', '0,1': 'ArrowRight' };
const STEPS: Cell[] = [DIRS.top, DIRS.bottom, DIRS.left, DIRS.right];

/** One-square steps that slide `block` from where it is to `to`, through legal spots only. */
function stepsTo(level: Level, state: State, block: number, to: Cell): Cell[] {
  const from = state.pos[block]!;
  const occ = occupancy(level, state);
  const key = (c: Cell) => `${c[0]},${c[1]}`;
  const back = new Map<string, { prev: Cell; dir: Cell } | null>([[key(from), null]]);
  const queue: Cell[] = [from];
  while (queue.length) {
    const at = queue.shift()!;
    if (at[0] === to[0] && at[1] === to[1]) break;
    for (const dir of STEPS) {
      const next: Cell = [at[0] + dir[0], at[1] + dir[1]];
      if (back.has(key(next)) || !canPlace(level, occ, block, next[0], next[1])) continue;
      back.set(key(next), { prev: at, dir });
      queue.push(next);
    }
  }
  if (!back.has(key(to))) throw new Error(`No path for brick ${block} to ${key(to)}`);
  const steps: Cell[] = [];
  for (let c: Cell = to, b = back.get(key(c)); b; c = b.prev, b = back.get(key(c))) steps.unshift(b.dir);
  return steps;
}

/**
 * Solve the board on screen: the solver picks each drag, and the arrow keys carry it out (a run of presses
 * on one brick is one move, as one drag is). Returns the moves the game counted. With `stopAfter`, it
 * plays only that many of the solver's drags and leaves the board unsolved.
 */
export async function solveEscapeBoard(page: Page, level: number, puzzle: number, stopAfter = Infinity): Promise<number> {
  return (await playEscapeBoard(page, level, puzzle, { stopAfter })).moves;
}

/**
 * The solver's drags on the board on screen, as solveEscapeBoard plays them, from the board's first position
 * or from `from` (where earlier presses left it). Returns the moves counted here, where the board stands, and
 * the brick still taking presses as one move (`open`; null once a brick has left, which ends the move).
 */
export async function playEscapeBoard(
  page: Page,
  level: number,
  puzzle: number,
  { stopAfter = Infinity, from }: { stopAfter?: number; from?: State } = {},
): Promise<{ moves: number; state: State; open: number | null }> {
  const board = escapeBoard(level, puzzle);
  let state = from ?? initialState(board);
  const bricks = page.locator('.esc-brick');
  await expect(bricks).toHaveCount(state.pos.filter(Boolean).length);
  let moves = 0;
  let last = -1;
  for (let drags = 0; !isSolved(state) && drags < stopAfter; drags++) {
    const move = solve(board, state, 2_000_000)?.moves[0];
    if (!move) throw new Error(`No solution from here: level ${level + 1}, puzzle ${puzzle}`);
    const block = move.block;
    const target = move.to ?? reachable(board, state, block).exit!.at;
    // The bricks still on the board are drawn in block order, so this brick is the k-th button.
    const k = state.pos.slice(0, block).filter(Boolean).length;
    await bricks.nth(k).focus();
    if (block !== last) moves++;
    last = block;
    for (const dir of stepsTo(board, state, block, target)) {
      const step = keyStep(board, state, block, dir);
      await page.keyboard.press(ARROW[`${dir[0]},${dir[1]}`]);
      if (step.kind === 'exit') {
        state = withMove(state, block, null);
        break;
      }
      if (step.kind !== 'moved') throw new Error('A planned step was blocked');
      state = withMove(state, block, step.at);
    }
    if (move.to === null && state.pos[block]) {
      const out = STEPS.find((dir) => keyStep(board, state, block, dir).kind === 'exit');
      if (!out) throw new Error('The brick is not beside an open door it fits');
      await page.keyboard.press(ARROW[`${out[0]},${out[1]}`]);
      state = withMove(state, block, null);
    }
    if (!state.pos[block]) {
      // It slides out (about 320 ms), then the next brick can move.
      last = -1;
      await expect(bricks).toHaveCount(state.pos.filter(Boolean).length);
    }
  }
  return { moves, state, open: last >= 0 ? last : null };
}

/** One arrow press on brick `block` (focused first), from `state`. Returns the board after it; the step must be a slide. */
export async function pressEscapeBrick(page: Page, level: Level, state: State, block: number, dir: Cell): Promise<State> {
  const step = keyStep(level, state, block, dir);
  if (step.kind !== 'moved') throw new Error(`Brick ${block} can not slide that way`);
  const k = state.pos.slice(0, block).filter(Boolean).length;
  await page.locator('.esc-brick').nth(k).focus();
  await page.keyboard.press(ARROW[`${dir[0]},${dir[1]}`]);
  return withMove(state, block, step.at);
}

export interface EscapePress {
  block: number;
  dir: Cell;
}

/**
 * Four one-square slides on two bricks in turn (A, then B, then A back, then B back) that bring the board back
 * to where it was and never take a brick out. The brick changes on every press, so each press is a new move;
 * `notFirst` is the brick whose move is still open, which the first press avoids. Null when there is no room.
 */
export function escapeWiggle(level: Level, state: State, notFirst: number | null = null): EscapePress[] | null {
  const slid = (s: State, block: number, dir: Cell) => {
    const step = keyStep(level, s, block, dir);
    return step.kind === 'moved' ? withMove(s, block, step.at) : null;
  };
  const back = (d: Cell): Cell => [-d[0], -d[1]];
  const same = (a: State, b: State) => JSON.stringify(a.pos) === JSON.stringify(b.pos);
  for (let a = 0; a < level.blocks.length; a++)
    for (const da of STEPS) {
      // a press on the brick that last took presses would carry on that move instead of starting one
      if (a === notFirst) continue;
      const s1 = slid(state, a, da);
      if (!s1) continue;
      for (let b = 0; b < level.blocks.length; b++) {
        if (b === a) continue;
        for (const db of STEPS) {
          const s2 = slid(s1, b, db);
          const s3 = s2 && slid(s2, a, back(da));
          const s4 = s3 && slid(s3, b, back(db));
          if (s4 && same(s4, state)) return [{ block: a, dir: da }, { block: b, dir: db }, { block: a, dir: back(da) }, { block: b, dir: back(db) }];
        }
      }
    }
  return null;
}

/* ---------- Brick Drop: clearing a puzzle with the keys ---------- */

/** Where one brick goes: turns from where it appears, then columns (minus is left), then Space. */
export interface DropPlacement {
  turns: number;
  shift: number;
}

export interface DropPlan {
  placements: DropPlacement[];
  /** Bricks used and the score the engine gives for them, as the game will count them. */
  bricks: number;
  score: number;
}

/** A plain stacking score: rows cleared first, then few covered holes, a low and flat stack. */
function dropBoardScore(board: (string | null)[][], lines: number): number {
  const rows = board.length;
  let holes = 0;
  let total = 0;
  let bumps = 0;
  let prev = -1;
  for (let x = 0; x < board[0].length; x++) {
    let h = 0;
    for (let y = 0; y < rows; y++) {
      if (board[y][x]) h ||= rows - y;
      else if (h) holes++;
    }
    total += h;
    if (prev >= 0) bumps += Math.abs(h - prev);
    prev = h;
  }
  return lines * 1000 - holes * 60 - total * 3 - bumps * 4;
}

/**
 * Plan a whole Brick Drop puzzle (0-based stage, puzzle 0 to 5) with the game's own engine: each brick drops
 * straight down after its turns and shifts, at the place that clears the most rows and leaves the flattest
 * stack. The game's starter stack and brick order are fixed per puzzle, so the plan is what the screen will do.
 */
export function planDropPuzzle(stage: number, puzzle: number): DropPlan {
  let game: DropGame = puzzleGame(stage, puzzle);
  const placements: DropPlacement[] = [];
  for (let n = 0; game.status === 'playing' && n < 80; n++) {
    let best: { place: DropPlacement; after: DropGame; score: number } | null = null;
    for (let turns = 0; turns < 4; turns++) {
      let turned: DropGame | null = game;
      for (let i = 0; i < turns && turned; i++) {
        const next: DropGame = dropRotate(turned, 1);
        turned = next.active === turned.active ? null : next;
      }
      if (!turned) continue;
      for (const dir of [-1, 1]) {
        let at = turned;
        for (let k = 0; k <= game.rules.cols; k++) {
          if (k > 0) {
            const next = dropMove(at, dir);
            if (next.active === at.active) break;
            at = next;
          }
          if (k === 0 && dir === 1) continue;
          const after = dropHardDrop(at);
          if (after.status === 'over') continue;
          const left = after.board.filter((_, y) => !after.clearing.includes(y));
          const score = dropBoardScore(left, after.clearing.length);
          if (!best || score > best.score) best = { place: { turns, shift: dir * k }, after, score };
        }
      }
    }
    if (!best) throw new Error(`No place for the next brick: stage ${stage + 1}, puzzle ${puzzle}`);
    placements.push(best.place);
    game = best.after.status === 'clearing' ? dropStep(best.after, CLEAR_MS) : best.after;
  }
  if (game.status !== 'won') throw new Error(`The plan does not clear stage ${stage + 1}, puzzle ${puzzle}`);
  return { placements, bricks: game.placed, score: game.score };
}

/**
 * Play a planned Brick Drop puzzle with the keys (Up turns, the arrows shift, Space drops). The page's clock
 * must be paused (page.clock), so no brick falls between presses; each drop then runs the clock on 400 ms,
 * past the 340 ms row-clear flash, so the next brick is in play before its presses.
 */
export async function playDropPuzzle(page: Page, plan: DropPlan) {
  for (const { turns, shift } of plan.placements) {
    for (let i = 0; i < turns; i++) await page.keyboard.press('ArrowUp');
    for (let i = 0; i < Math.abs(shift); i++) await page.keyboard.press(shift < 0 ? 'ArrowLeft' : 'ArrowRight');
    await page.keyboard.press(' ');
    await page.clock.runFor(400);
  }
}

/** The Brick Escape puzzle on screen for a 0-based level: the saved run's queue[0]. */
export async function escapePuzzleOnScreen(page: Page, level: number): Promise<number> {
  return (await savedRun(page, 'escape', level)).queue[0];
}

/* ---------- Letter Builder: building a puzzle with the letter keys ---------- */

/** "A to D" -> ['A', 'B', 'C', 'D'] (also lower case). */
function letterRange(label: string): string[] {
  const m = /^(\w) to (\w)$/.exec(label.trim());
  if (!m) throw new Error(`Not a letter run: "${label}"`);
  const out: string[] = [];
  for (let c = m[1].charCodeAt(0); c <= m[2].charCodeAt(0); c++) out.push(String.fromCharCode(c));
  return out;
}

/** The letters the puzzle on screen asks for, in order: a spelling word (from its picture) or a train run. */
export async function lettersAnswer(page: Page): Promise<string[]> {
  const picture = page.locator('button.lb-picture');
  if (await picture.count()) {
    const name = (await picture.getAttribute('aria-label')) ?? '';
    const m = /^Picture of an? (.+), tap to hear it$/.exec(name);
    if (!m) throw new Error(`No word on the picture: "${name}"`);
    return m[1].toUpperCase().split('');
  }
  return letterRange((await page.locator('.lb-picture--label').textContent()) ?? '');
}

/** The spelling word on screen, upper case. */
export async function lettersWord(page: Page): Promise<string> {
  return (await lettersAnswer(page)).join('');
}

/** Build the puzzle on screen with the physical letter keys, one press per letter, as the tray allows. */
export async function solveLettersPuzzle(page: Page) {
  await expect(page.locator('.lb-tray button').first()).toBeVisible();
  for (const ch of await lettersAnswer(page)) await page.keyboard.press(ch);
}

/** A wrong tap: a tray letter that is not the next one (for a run or a word, its last letter). */
export async function lettersWrongTap(page: Page) {
  const answer = await lettersAnswer(page);
  const wrong = [...answer].reverse().find((ch) => ch !== answer[0]);
  if (!wrong) throw new Error('No wrong letter to tap');
  await page.locator('.lb-tray').getByRole('button', { name: wrong, exact: true }).first().click();
}

/* ---------- Pointer drags (Shape Sorter, Number Line-up) ---------- */

/** The middle of an element on screen, in viewport px (the tablet zoom is in the box already). */
async function middle(el: Locator): Promise<{ x: number; y: number }> {
  await el.scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  if (!box) throw new Error('Nothing on screen to drag');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * A real pointer drag, as a finger makes it: press on `from`, travel past the 8 px threshold, move over
 * `to` (an element or a point) in steps, release there.
 */
export async function pointerDrag(page: Page, from: Locator, to: Locator | { x: number; y: number }) {
  const a = await middle(from);
  const b = 'x' in to ? to : await middle(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 6, a.y + 6, { steps: 2 });
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

/* ---------- Color Mixer: reading the question and tapping the paints ---------- */

const MIX_COLOR_BY_WORD = new Map<string, PaintId | ResultId>([
  ...Object.values(PAINTS).map((c) => [c.name.toLowerCase(), c.id] as const),
  ...Object.values(RESULTS).map((c) => [c.name.toLowerCase(), c.id] as const),
]);
function mixColor(word: string): PaintId | ResultId {
  const id = MIX_COLOR_BY_WORD.get(word.trim().toLowerCase());
  if (!id) throw new Error(`No Color Mixer colour named "${word}"`);
  return id;
}

export type MixerOnScreen =
  | { form: 'finish'; goal: ResultId; given: PaintId; right: PaintId; wrong: PaintId[] }
  | { form: 'make'; goal: ResultId; pair: readonly [PaintId, PaintId]; shelf: PaintId[] }
  | { form: 'guess'; paints: [PaintId, PaintId]; answer: ResultId; choices: string[] };

export const mixerShelf = (page: Page): Locator => page.getByRole('group', { name: 'Paints' });
export const mixerSwatches = (page: Page): Locator => page.getByRole('group', { name: 'Colors' });
/** A pot on the shelf, by its name ("Red paint"). */
export const mixerPot = (page: Page, paint: PaintId): Locator => mixerShelf(page).getByRole('button', { name: `${PAINTS[paint].name} paint`, exact: true });
export const mixerSlot = (page: Page, n: 1 | 2): Locator => page.getByRole('button', { name: new RegExp(`^Paint ${n}: `) });
export const mixerBowl = (page: Page): Locator => page.getByRole('img', { name: /^Bowl: / });

/**
 * The Mixer question on screen, read as a reader hears it: the chip, the slots ("Paint 1: red, given") and
 * the shelf's pots ("Red paint") or the named swatches.
 */
export async function mixerOnScreen(page: Page): Promise<MixerOnScreen> {
  await expect(page.locator('.mix-chip')).toBeVisible();
  const chip = ((await page.locator('.mix-chip').textContent()) ?? '').trim();
  const slot1 = (await mixerSlot(page, 1).getAttribute('aria-label')) ?? '';
  if (await mixerSwatches(page).count()) {
    const slot2 = (await mixerSlot(page, 2).getAttribute('aria-label')) ?? '';
    const given = (s: string) => mixColor(/^Paint \d: (.+), given$/.exec(s)![1]) as PaintId;
    const paints: [PaintId, PaintId] = [given(slot1), given(slot2)];
    const choices = await mixerSwatches(page).getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    return { form: 'guess', paints, answer: mixOf(paints[0], paints[1])!, choices };
  }
  const m = /^Can you make ?(.+)\?$/.exec(chip);
  if (!m) throw new Error(`Not a Color Mixer goal: "${chip}"`);
  const goal = mixColor(m[1]) as ResultId;
  const pair = RECIPES.find((r) => r.result === goal)!.pair;
  const shelf = (await mixerShelf(page).getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))).map(
    (name) => mixColor(name.replace(/ paint$/, '')) as PaintId,
  );
  const given = /^Paint 1: (.+), given$/.exec(slot1);
  if (given) {
    const g = mixColor(given[1]) as PaintId;
    const right = pair.find((p) => p !== g)!;
    return { form: 'finish', goal, given: g, right, wrong: shelf.filter((p) => p !== right) };
  }
  return { form: 'make', goal, pair, shelf };
}

/** Solve the Mixer question on screen with the right taps: one pot (Finish), two pots (Make it) or one swatch (Guess). */
export async function solveMixerPuzzle(page: Page) {
  const p = await mixerOnScreen(page);
  if (p.form === 'finish') await mixerPot(page, p.right).click();
  else if (p.form === 'make') {
    await mixerPot(page, p.pair[0]).click();
    await mixerPot(page, p.pair[1]).click();
  } else await mixerSwatches(page).getByRole('button', { name: RESULTS[p.answer].name, exact: true }).click();
}

/* ---------- Shape Sorter: dragging or tapping each shape into its hole ---------- */

export const sorterTray = (page: Page): Locator => page.getByRole('group', { name: 'Shapes to place' });
export const sorterHoles = (page: Page): Locator => page.getByRole('group', { name: 'Holes' });
export const sorterPiece = (page: Page, name: string): Locator => sorterTray(page).getByRole('button', { name, exact: true });
export const sorterHole = (page: Page, name: string): Locator => sorterHoles(page).getByRole('button', { name: `${name} hole`, exact: true });

/** The pieces still in the tray, by name ("circle", "red circle"), in tray order. */
export async function sorterPieces(page: Page): Promise<string[]> {
  return sorterTray(page)
    .getByRole('button')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
}

/** Put every piece on screen in its own hole: dragged with the pointer, or tapped and then the hole tapped. */
export async function sortShapes(page: Page, how: 'drag' | 'tap') {
  await expect(sorterTray(page).getByRole('button').first()).toBeVisible();
  for (let guard = 0; guard < 9; guard++) {
    const names = await sorterPieces(page);
    if (!names.length) return;
    const name = names[0];
    if (how === 'drag') await pointerDrag(page, sorterPiece(page, name), sorterHole(page, name));
    else {
      await sorterPiece(page, name).click();
      await sorterHole(page, name).click();
    }
    await expect(page.getByRole('img', { name: `Filled ${name} hole`, exact: true })).toBeVisible();
  }
  throw new Error('The board did not empty');
}

/* ---------- Number Line-up: swapping towers ---------- */

const TOWER_NAME = /^Tower of (\d+), spot (\d) of 6, (?:in|not in) the right spot$/;
export const numbersTowers = (page: Page): Locator => page.getByRole('button', { name: /^Tower of / });
/** The tower in a spot (0-based), by its name. */
export const numbersTower = (page: Page, spot: number): Locator => page.getByRole('button', { name: new RegExp(`^Tower of \\d+, spot ${spot + 1} of 6,`) });

/** The towers left to right, read from their names ("Tower of 4, spot 2 of 6, not in the right spot"). */
export async function numbersRow(page: Page): Promise<number[]> {
  await expect(numbersTowers(page)).toHaveCount(6);
  const names = await numbersTowers(page).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
  return names.map((n) => {
    const m = TOWER_NAME.exec(n);
    if (!m) throw new Error(`Not a tower name: "${n}"`);
    return Number(m[1]);
  });
}

/** The level's order, from the goal strip's text. */
export async function numbersDir(page: Page): Promise<'up' | 'down'> {
  return /smallest first/.test((await page.locator('.num-goal__text').textContent()) ?? '') ? 'up' : 'down';
}

/** The next swap toward the goal: the tower that belongs in the first wrong spot, and that spot. Null once in order. */
export async function numbersNextSwap(page: Page): Promise<[number, number] | null> {
  const row = await numbersRow(page);
  const dir = await numbersDir(page);
  const goal = [...row].sort((a, b) => (dir === 'up' ? a - b : b - a));
  const to = row.findIndex((v, i) => v !== goal[i]);
  return to < 0 ? null : [row.indexOf(goal[to]), to];
}

/** Two neighbours already in the level's order: swapping them moves the row further from done (a slip). */
export async function numbersBackwardSwap(page: Page): Promise<[number, number]> {
  const row = await numbersRow(page);
  const up = (await numbersDir(page)) === 'up';
  for (let i = 0; i + 1 < row.length; i++) if (up ? row[i] < row[i + 1] : row[i] > row[i + 1]) return [i, i + 1];
  throw new Error('No backward swap on this row');
}

/** Swap two towers by tapping one and then the other, and wait for the row to change. */
export async function swapTowers(page: Page, a: number, b: number) {
  const before = await numbersRow(page);
  await numbersTower(page, a).click();
  await numbersTower(page, b).click();
  const after = [...before];
  [after[a], after[b]] = [after[b], after[a]];
  await expect.poll(() => numbersRow(page)).toEqual(after);
}

/** Put the row in the level's order by taps, one forward swap at a time (the fewest swaps). Returns the swaps made. */
export async function solveNumbersPuzzle(page: Page): Promise<number> {
  let swaps = 0;
  for (let step = await numbersNextSwap(page); step; step = await numbersNextSwap(page)) {
    await swapTowers(page, step[0], step[1]);
    if (++swaps > 6) throw new Error('The row is not getting closer to done');
  }
  return swaps;
}
