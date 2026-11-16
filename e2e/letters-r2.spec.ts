/**
 * Letter Builder, usability round 2 (owner decisions of 16 November 2026):
 * - 22: on the practice level (Level 1, ages 3 to 4) the hint glows and spends as usual but never caps the stars;
 * - 20: with Voice off the top bar has no speaker, and its title stays where it was;
 * - 21: a finger tap on the help line reads it aloud, the same words as the top bar speaker;
 * - 5: on the practice level a tap says the letter and then the drag note, and from the second tap a ghost
 *   brick glides once from the tray to its own place (a static arrow under Reduce Motion).
 * The pure rules are unit-tested in src/games/letters/logic.r2.test.ts and speech.r2.test.ts.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { letterName } from '../src/shared/speech';
import {
  dots,
  editSavedInAnotherTab,
  levelCard,
  lettersAnswer,
  lettersWrongTap,
  recordSpeech,
  savedGame,
  savedRun,
  seed,
  solveLettersPuzzle,
  starsUpTo,
  STORAGE_KEY,
  type Band,
} from './app';

const DRAG_NOTE = 'Hold the letter and drag it up.';
const PRACTICE_SPEECH = 'Drag each letter up to its place.';
const OFFER_LINE = 'This one is tricky. Want a different puzzle?';

const help = (page: Page) => page.locator('.lb-help');
const helpTap = (page: Page) => page.locator('.lb-help-tap');
const tray = (page: Page) => page.locator('.lb-tray');
const trayTile = (page: Page, ch: string) => tray(page).getByRole('button', { name: ch, exact: true }).first();
const place = (page: Page, i: number) => page.getByRole('list', { name: 'Your answer' }).getByRole('listitem').nth(i);
const offer = (page: Page) => page.getByRole('button', { name: 'New puzzle' });
const hint = (page: Page, left: number) => page.getByRole('button', { name: `Hint (${left})` });
const title = (page: Page) => page.getByRole('heading', { level: 1 });
const topBarButtons = (page: Page) => page.locator('.bw-topbar button');

/** What the answer row holds, place by place: the letter on a placed brick, or null for a place still empty. */
async function row(page: Page): Promise<(string | null)[]> {
  return page
    .getByRole('list', { name: 'Your answer' })
    .getByRole('listitem')
    .evaluateAll((items) =>
      items.map((li) => (li.querySelector('.lb-slot') ? null : (li.querySelector('.lb-brick__ch')?.textContent ?? '').trim() || null)),
    );
}

/** Turn Voice off in the record the seed writes, before the app first reads it. */
async function voiceOff(page: Page) {
  await page.addInitScript((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const state = JSON.parse(raw);
    if (sessionStorage.getItem('e2e-voice-off')) return;
    sessionStorage.setItem('e2e-voice-off', '1');
    state.settings.voice = false;
    localStorage.setItem(key, JSON.stringify(state));
  }, STORAGE_KEY);
}

/** Open Letter Builder at a 0-based level for one child and wait for the tray. */
async function open(page: Page, ageBand: Band, level = 0, opts: { voice?: boolean } = {}) {
  await seed(page, [{ id: 'leo', name: 'Leo', ageBand, games: level ? { letters: { stars: starsUpTo(level) } } : undefined }]);
  if (opts.voice === false) await voiceOff(page);
  await page.goto('/#/game/letters');
  await expect(page).toHaveURL(new RegExp(`#/game/letters/${level + 1}$`));
  await expect(tray(page).getByRole('button').first()).toBeVisible();
}

/** Build the puzzle on screen with the letter keys, then go on with Next unless it was the fourth. */
async function buildAndGoOn(page: Page, solvedBefore: number) {
  await solveLettersPuzzle(page);
  if (solvedBefore + 1 >= 4) return;
  const next = page.getByRole('button', { name: /^Next (puzzle|word)$/ });
  await expect(next).toBeFocused();
  await next.click();
  await expect(dots(page)).toHaveAttribute('aria-label', new RegExp(`^(Puzzle|Word) ${solvedBefore + 2} of 4\\.`));
}

const centre = async (el: Locator) => {
  const b = (await el.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

type Box = { x: number; y: number; width: number; height: number };
const near = (a: Box, b: Box, tol: number) =>
  Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol && Math.abs(a.width - b.width) <= tol && Math.abs(a.height - b.height) <= tol;

/* ---------- Decision 22: no star cap from the hint on the practice level ---------- */

test('practice Level 1 at ages 3 to 4: a hint glows and spends but the level still earns 3 stars @phone-only', async ({ page }) => {
  await open(page, '3-4');
  await hint(page, 3).click();
  await expect(hint(page, 2)).toBeVisible();
  await expect(tray(page).locator('button.is-hint')).toHaveCount(1);
  for (let n = 0; n < 4; n++) await buildAndGoOn(page, n);

  const card = levelCard(page);
  await expect(card.getByRole('heading')).toHaveText('You finished Level 1');
  await expect(card).toContainText('4 puzzles, no slips.');
  await expect(card.getByRole('img', { name: '3 of 3 stars' })).toBeVisible();
  await expect(card).not.toContainText('Using a hint caps');
  const saved = await savedGame(page, 'letters');
  expect(saved?.stars['0']).toBe(3);
});

for (const [band, level] of [
  ['5-6', 0],
  ['3-4', 1],
] as const) {
  test(`ages ${band} on Level ${level + 1}: a hint still caps the level at 2 stars @phone-only`, async ({ page }) => {
    await open(page, band, level);
    await hint(page, 3).click();
    await expect(hint(page, 2)).toBeVisible();
    for (let n = 0; n < 4; n++) await buildAndGoOn(page, n);
    const card = levelCard(page);
    await expect(card.getByRole('img', { name: '2 of 3 stars' })).toBeVisible();
    await expect(card).toContainText('Using a hint caps the level at 2 stars.');
  });
}

/* ---------- Decision 20: no speaker when Voice is off ---------- */

for (const [band, level, what] of [
  ['3-4', 0, 'practice train'],
  ['5-6', 0, 'train'],
  ['5-6', 7, 'Big and small'],
  ['5-6', 11, 'first sounds'],
  ['5-6', 15, 'spelling'],
] as const) {
  test(`Voice off: no speaker on Level ${level + 1} (${what}) at ages ${band}, and the title stays put`, async ({ page }) => {
    await open(page, band, level, { voice: false });
    await expect(title(page)).toHaveText(`Level ${level + 1}`);
    // Only the back link is left in the top bar; the right cell is the empty slot.
    await expect(topBarButtons(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(Hear it again|Say the word|Read the help line aloud)$/ })).toHaveCount(0);
    const off = (await title(page).boundingBox())!;

    // Voice on again from a grown-up's other tab: the speaker comes back and the title does not move.
    await editSavedInAnotherTab(page, (state) => {
      (state as unknown as { settings: { voice: boolean } }).settings.voice = true;
    });
    await expect(page.getByRole('button', { name: /^(Hear it again|Say the word)$/ })).toBeVisible();
    const on = (await title(page).boundingBox())!;
    expect(Math.abs(on.x + on.width / 2 - (off.x + off.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(on.y - off.y)).toBeLessThanOrEqual(1);
  });
}

test('Voice off: the stuck offer brings no speaker either', async ({ page }) => {
  await open(page, '5-6', 0, { voice: false });
  for (let i = 0; i < 3; i++) await lettersWrongTap(page);
  await expect(offer(page)).toBeVisible();
  await expect(help(page)).toHaveText(OFFER_LINE);
  await expect(page.getByRole('button', { name: 'Read the help line aloud' })).toHaveCount(0);
  await expect(topBarButtons(page)).toHaveCount(0);
});

/* ---------- Decision 21: the help line is tappable to hear it ---------- */

/** The top bar speaker's words now: tap it and read the last line it asked the voice to say. */
async function speakerSays(page: Page, spoken: () => Promise<string[]>): Promise<string> {
  const before = (await spoken()).length;
  await page.locator('.bw-topbar button').last().click();
  await expect.poll(async () => (await spoken()).length).toBe(before + 1);
  return (await spoken()).at(-1)!;
}

/** Finger taps across the help line: its middle and both ends of its cell. */
async function tapAcrossHelpLine(page: Page): Promise<{ x: number; y: number }[]> {
  const cell = (await helpTap(page).boundingBox())!;
  const y = cell.y + cell.height / 2;
  return [
    { x: cell.x + cell.width / 2, y },
    { x: cell.x + 4, y },
    { x: cell.x + cell.width - 4, y: cell.y + 4 },
  ];
}

const elementAt = (page: Page, p: { x: number; y: number }) =>
  page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el?.closest('button')?.getAttribute('aria-label') ?? el?.className ?? null;
  }, p);

function helpLineCases() {
  for (const band of ['3-4', '5-6'] as Band[]) {
    test(`ages ${band} on Level 1: a finger tap anywhere on the help line reads it once, and places and counts nothing`, async ({ page }) => {
      const spoken = await recordSpeech(page);
      await open(page, band);
      const answer = await lettersAnswer(page);
      const instruction = ((await help(page).textContent()) ?? '').trim();
      // No speech without a tap.
      expect(await spoken()).toEqual([]);

      // The overlay covers the whole middle cell, at least 44 tall, over the line; it is not a stop for
      // the keyboard or VoiceOver (they keep the top bar speaker, which says the same).
      const overlay = helpTap(page);
      await expect(overlay).toHaveAttribute('aria-hidden', 'true');
      await expect(overlay).toHaveAttribute('tabindex', '-1');
      const box = (await overlay.boundingBox())!;
      const line = (await help(page).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeLessThanOrEqual(line.x + 0.5);
      expect(box.x + box.width).toBeGreaterThanOrEqual(line.x + line.width - 0.5);
      expect(box.y).toBeLessThanOrEqual(line.y + 0.5);
      expect(box.y + box.height).toBeGreaterThanOrEqual(line.y + line.height - 0.5);
      await expect(help(page)).toHaveAttribute('role', 'status');

      // The hint button keeps its own taps.
      expect(await elementAt(page, await centre(hint(page, 3)))).toBe('Hint (3)');

      const points = await tapAcrossHelpLine(page);
      for (const [i, p] of points.entries()) {
        await page.touchscreen.tap(p.x, p.y);
        await expect.poll(async () => (await spoken()).length).toBe(i + 1);
      }
      const heard = await spoken();
      const expected = band === '3-4' ? PRACTICE_SPEECH : `Tap the letters in order, from ${letterName(answer[0])} to ${letterName(answer[answer.length - 1])}.`;
      expect(heard).toEqual([expected, expected, expected]);
      // The same words as the top bar speaker.
      expect(await speakerSays(page, spoken)).toBe(expected);

      // Nothing placed, nothing counted: the line, the row, the dots and the hint badge are as they were.
      await expect(help(page)).toHaveText(instruction);
      expect(await row(page)).toEqual(answer.map(() => null));
      await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 0 solved.');
      await expect(hint(page, 3)).toBeVisible();
      await expect(offer(page)).toHaveCount(0);
    });
  }

  test('while the stuck offer shows, a tap on the line reads the offer, and the offer button keeps its taps', async ({ page }) => {
    const spoken = await recordSpeech(page);
    await open(page, '5-6');
    for (let i = 0; i < 3; i++) await lettersWrongTap(page);
    await expect(offer(page)).toBeVisible();
    expect(await elementAt(page, await centre(offer(page)))).toBe('New puzzle');
    expect(await elementAt(page, await centre(hint(page, 3)))).toBe('Hint (3)');
    const before = (await spoken()).length;
    const [mid] = await tapAcrossHelpLine(page);
    await page.touchscreen.tap(mid.x, mid.y);
    await expect.poll(async () => (await spoken()).slice(before)).toEqual([OFFER_LINE]);
    expect(await speakerSays(page, spoken)).toBe(OFFER_LINE);
    // The offer stays up: the tap was not progress.
    await expect(offer(page)).toBeVisible();
  });

  test('ages 3 to 4 on Level 2: the offer cell and the hint cell keep their taps beside the line', async ({ page }) => {
    const spoken = await recordSpeech(page);
    await open(page, '3-4', 1);
    for (let i = 0; i < 3; i++) await lettersWrongTap(page);
    await expect(offer(page)).toBeVisible();
    expect(await elementAt(page, await centre(offer(page)))).toBe('New puzzle');
    expect(await elementAt(page, await centre(hint(page, 3)))).toBe('Hint (3)');
    const before = (await spoken()).length;
    const [mid] = await tapAcrossHelpLine(page);
    await page.touchscreen.tap(mid.x, mid.y);
    await expect.poll(async () => (await spoken()).slice(before)).toEqual([OFFER_LINE]);
  });

  test('Voice off: the help line has no tap overlay', async ({ page }) => {
    await open(page, '5-6', 0, { voice: false });
    await expect(help(page)).toBeVisible();
    await expect(helpTap(page)).toHaveCount(0);
  });
}

helpLineCases();
test.describe('help line on a 375x667 phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  helpLineCases();
});
test.describe('help line on a 1194x834 iPad in landscape', () => {
  test.use({ viewport: { width: 1194, height: 834 }, isMobile: true, hasTouch: true });
  helpLineCases();
});

/* ---------- Decision 5: the practice tap speaks the drag note, then shows the drag ---------- */

/**
 * Watch the demo elements from the page: when each appeared and went, in ms after the last pointerup, and
 * the first frame of every animation started on a glide (paused there when `hold` is set, so it can be measured).
 */
async function watchDemo(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __demo: { up: number; seen: { cls: string; added: number; removed: number | null }[]; anims: Animation[]; hold: boolean };
    };
    w.__demo = { up: 0, seen: [], anims: [], hold: false };
    document.addEventListener('pointerup', () => (w.__demo.up = performance.now()), true);
    const track = new Map<Element, { cls: string; added: number; removed: number | null }>();
    new MutationObserver((list) => {
      for (const m of list) {
        for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue;
          for (const el of [n, ...n.querySelectorAll('.lb-demo-glide, .lb-demo-arrow')]) {
            // An element counts once, though it may come in a record of its own and inside its parent's.
            if (!el.matches('.lb-demo-glide, .lb-demo-arrow') || track.has(el)) continue;
            const rec = { cls: el.matches('.lb-demo-glide') ? 'glide' : 'arrow', added: performance.now() - w.__demo.up, removed: null };
            track.set(el, rec);
            w.__demo.seen.push(rec);
          }
        }
        for (const n of m.removedNodes) {
          if (!(n instanceof Element)) continue;
          for (const [el, rec] of track) if (n === el || n.contains(el)) rec.removed = performance.now() - w.__demo.up;
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args: Parameters<Element['animate']>) {
      const a = animate.apply(this, args);
      if (this.matches('.lb-demo-glide')) {
        w.__demo.anims.push(a);
        if (w.__demo.hold) a.pause();
      }
      return a;
    };
  });
  return {
    seen: () => page.evaluate(() => (window as unknown as { __demo: { seen: { cls: string; added: number; removed: number | null }[] } }).__demo.seen.slice()),
    hold: (on: boolean) => page.evaluate((v) => ((window as unknown as { __demo: { hold: boolean } }).__demo.hold = v), on),
    /** Seek the last glide's animation to `ms` and read the glide's box there. */
    at: (ms: number) =>
      page.evaluate((t) => {
        const d = (window as unknown as { __demo: { anims: Animation[] } }).__demo;
        const a = d.anims.at(-1)!;
        a.currentTime = t;
        const r = document.querySelector('.lb-demo-glide')!.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height, opacity: Number(getComputedStyle(document.querySelector('.lb-demo-glide')!).opacity) };
      }, ms),
    finish: () => page.evaluate(() => (window as unknown as { __demo: { anims: Animation[] } }).__demo.anims.at(-1)!.finish()),
  };
}

/** The tray tiles' boxes, letter by letter. */
const trayBoxes = (page: Page) =>
  tray(page)
    .getByRole('button')
    .evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10); }));

function demoCases() {
  test.describe('with motion on', () => {
    test.use({ reducedMotion: 'no-preference' });

    test('practice Level 1: the first tap says the letter then the drag note; from the second a ghost glides to its place once', async ({ page }) => {
      const spoken = await recordSpeech(page);
      await open(page, '3-4');
      const demo = await watchDemo(page);
      const answer = await lettersAnswer(page);
      const instruction = ((await help(page).textContent()) ?? '').trim();
      // Wait for the view's own slide-in to end, so the tiles stand still.
      await page.waitForTimeout(400);
      const tiles = await trayBoxes(page);

      // 1st tap: the letter's name, then the drag note, and no demo.
      await trayTile(page, answer[0]).tap();
      await expect.poll(spoken).toEqual([letterName(answer[0]), DRAG_NOTE]);
      await expect(help(page)).toHaveText(DRAG_NOTE);
      await page.waitForTimeout(150);
      expect(await demo.seen()).toEqual([]);

      // 2nd tap, on another letter: the glide starts at that tile and ends over its own place.
      await demo.hold(true);
      const tapped = trayTile(page, answer[2]);
      await page.waitForTimeout(500);
      const from = (await tapped.boundingBox())!;
      await tapped.tap();
      await expect(page.locator('.lb-demo-glide')).toHaveCount(1);
      const seen = await demo.seen();
      expect(seen).toHaveLength(1);
      expect(seen[0].cls).toBe('glide');
      expect(seen[0].added).toBeLessThan(100);
      await expect(page.locator('.lb-demo-glide')).toHaveAttribute('aria-hidden', 'true');
      expect(await page.locator('.lb-demo-glide').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
      const start = await demo.at(0);
      expect(near(start, from, 2), `start ${JSON.stringify(start)} vs tile ${JSON.stringify(from)}`).toBe(true);
      expect(start.opacity).toBeCloseTo(0.5, 1);
      const goal = (await place(page, 2).boundingBox())!;
      const end = await demo.at(600);
      expect(near(end, goal, 2), `end ${JSON.stringify(end)} vs place ${JSON.stringify(goal)}`).toBe(true);
      await demo.finish();
      await expect(page.locator('.lb-demo-glide')).toHaveCount(0);
      await demo.hold(false);

      // A new tap restarts it, and it is gone by 900 ms.
      await page.waitForTimeout(300);
      await trayTile(page, answer[3]).tap();
      await expect(page.locator('.lb-demo-glide')).toHaveCount(1);
      await expect(page.locator('.lb-demo-glide')).toHaveCount(0, { timeout: 2_000 });
      const last = (await demo.seen()).at(-1)!;
      expect(last.added).toBeLessThan(100);
      expect(last.removed).not.toBeNull();
      expect(last.removed!).toBeLessThanOrEqual(950);
      expect(last.removed!).toBeGreaterThan(700);

      // The row stays empty, the tray tiles never moved, the help line asks for a drag, and nothing counted.
      expect(await row(page)).toEqual(answer.map(() => null));
      expect(await trayBoxes(page)).toEqual(tiles);
      expect(instruction).toMatch(/drag/i);
      await solveLettersPuzzle(page);
      await expect(dots(page)).toHaveAttribute('aria-label', 'Puzzle 1 of 4. 1 solved.');
      expect((await savedRun(page, 'letters', 0)).solved.map((r) => r.count)).toEqual([0]);
    });

    test('practice Level 1: the demo never runs during a drag', async ({ page }) => {
      await open(page, '3-4');
      const demo = await watchDemo(page);
      const answer = await lettersAnswer(page);
      await trayTile(page, answer[0]).tap();
      await trayTile(page, answer[1]).tap();
      await expect(page.locator('.lb-demo-glide')).toHaveCount(1);
      // A press and drag on a letter stops the glide at once.
      const from = await centre(trayTile(page, answer[3]));
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 6, from.y - 20, { steps: 3 });
      await page.mouse.move(from.x + 10, from.y - 60, { steps: 3 });
      await expect(trayTile(page, answer[3])).toHaveClass(/is-dragging/);
      await expect(page.locator('.lb-demo-glide')).toHaveCount(0);
      await page.mouse.up();
      expect((await demo.seen()).filter((s) => s.cls === 'glide')).toHaveLength(1);
    });
  });

  test('practice Level 1 with Reduce Motion: the second tap shows a still arrow to the place for 1.5 s', async ({ page }) => {
    const spoken = await recordSpeech(page);
    await open(page, '3-4');
    const demo = await watchDemo(page);
    const answer = await lettersAnswer(page);
    const tiles = await trayBoxes(page);

    await trayTile(page, answer[1]).tap();
    await expect.poll(spoken).toEqual([letterName(answer[1]), DRAG_NOTE]);
    await page.waitForTimeout(150);
    expect(await demo.seen()).toEqual([]);

    await trayTile(page, answer[0]).tap();
    const arrow = page.locator('.lb-demo-arrow');
    await expect(arrow).toBeVisible();
    await expect(arrow).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.lb-demo-glide')).toHaveCount(0);
    // Drawn in the accent colour, 4 px wide, and nothing on the screen moves.
    const stroke = await arrow.evaluate((svg) => {
      const line = svg.querySelector('path, line')!;
      const cs = getComputedStyle(line);
      return { width: cs.strokeWidth, color: cs.stroke, accent: getComputedStyle(document.documentElement).getPropertyValue('--bw-accent').trim() };
    });
    expect(stroke.width).toBe('4px');
    expect(stroke.color).toBe('rgb(255, 194, 26)');
    const moving = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .filter((a) => {
          const fx = a.effect as KeyframeEffect | null;
          return !!fx?.getKeyframes().some((k) => 'transform' in k || 'translate' in k || 'scale' in k);
        }).length,
    );
    expect(moving).toBe(0);
    // It points from the tapped brick up to its own place.
    const a = (await arrow.boundingBox())!;
    const tile = (await trayTile(page, answer[0]).boundingBox())!;
    const goal = (await place(page, 0).boundingBox())!;
    expect(a.y).toBeLessThanOrEqual(goal.y + goal.height + 2);
    expect(a.y + a.height).toBeGreaterThanOrEqual(tile.y - 2);

    // Up for 1.5 s from the tap, by the page's own record of when it came and went.
    await expect(arrow).toHaveCount(0, { timeout: 3_000 });
    const rec = (await demo.seen()).at(-1)!;
    expect(rec.cls).toBe('arrow');
    expect(rec.removed!).toBeGreaterThanOrEqual(1400);
    expect(rec.removed!).toBeLessThanOrEqual(1600);

    expect(await row(page)).toEqual(answer.map(() => null));
    expect(await trayBoxes(page)).toEqual(tiles);
  });

  for (const [band, level] of [
    ['5-6', 0],
    ['3-4', 1],
  ] as const) {
    test(`ages ${band} on Level ${level + 1}: a tap shows no demo and does not say the drag note`, async ({ page }) => {
      const spoken = await recordSpeech(page);
      await open(page, band, level);
      const demo = await watchDemo(page);
      const answer = await lettersAnswer(page);
      await trayTile(page, answer[0]).tap();
      await expect.poll(async () => (await row(page))[0]).toBe(answer[0]);
      await lettersWrongTap(page);
      await expect(help(page)).toHaveText('Not that one. Try again.');
      await page.waitForTimeout(300);
      expect(await demo.seen()).toEqual([]);
      expect(await spoken()).not.toContain(DRAG_NOTE);
      expect(await spoken()).toEqual([letterName(answer[0])]);
    });
  }
}

demoCases();
test.describe('demo on a 375x667 phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });
  demoCases();
});
test.describe('demo on a 1194x834 iPad in landscape', () => {
  test.use({ viewport: { width: 1194, height: 834 }, isMobile: true, hasTouch: true });
  demoCases();
});
