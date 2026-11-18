/**
 * Round 2 cases for the kit's hook: the new sticker on the level card when the level ends a chapter
 * (decision 19) and `hintCapped` for the capped-star mark (decision 25).
 *
 * The hook runs in a real React root so its effects run; the page, the window and the clock are
 * stand-ins, as in useLevelRun.review.test.ts. The progress store is the real one on in-memory storage.
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgressStore, findPlayer, STORAGE_KEY, type KeyValueStorage, type ProgressStore } from '../../shared/progress';
import { LEVEL_CARD_DELAY_MS } from '../../shared/ui/LevelCard';
import { STICKERS, stickerCells, stickersDue } from '../../screens/logic/stickers';
import { meta as sorterMeta } from '../sorter/meta';
import type { GameMeta } from '../meta';
import { numbersSet, sorterSet } from '../run';
import { GAME_DONE_TITLE, levelDoneTitle } from './copy';
import type { KitGame, LevelRunApi } from './levelRun';
import { useLevelRun } from './useLevelRun';

const NOW = new Date(2026, 10, 16, 12, 0).getTime();

const SORTER: KitGame<number> = { id: 'sorter', meta: sorterMeta, title: 'Shape Sorter', set: () => sorterSet(), seed: 'fixed', puzzle: (_l, n) => n };
const meta = (levelCount: number): GameMeta => ({ levelCount, chapters: [{ title: 'All levels', note: '', start: 0, count: levelCount }] });
const NUMBERS: KitGame<number> = { id: 'numbers', meta: meta(12), title: 'Number Line-up', set: (b) => numbersSet(b), seed: 'run', keepSolved: true, hints: true, puzzle: (_l, n) => n };

const doc = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, activeElement: null, body: null, defaultView: null as unknown };
const win = {
  event: undefined,
  document: doc,
  innerWidth: 390,
  innerHeight: 844,
  HTMLIFrameElement: class {},
  addEventListener() {},
  removeEventListener() {},
  setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
  clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
};
doc.defaultView = win;

beforeEach(() => {
  vi.stubGlobal('window', win);
  vi.stubGlobal('document', doc);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
});

const roots: (() => void)[] = [];
afterEach(() => {
  roots.splice(0).forEach((unmount) => unmount());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mount<T>(use: () => T) {
  let latest: T | undefined;
  function Probe() {
    latest = use();
    return null;
  }
  const container = { nodeType: 1, nodeName: 'DIV', tagName: 'DIV', namespaceURI: 'http://www.w3.org/1999/xhtml', ownerDocument: doc, textContent: '', addEventListener() {}, removeEventListener() {} };
  const root = createRoot(container as unknown as Element);
  act(() => root.render(createElement(Probe)));
  roots.push(() => act(() => root.unmount()));
  return {
    get current(): T {
      return latest as T;
    },
  };
}

function makeStore() {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  let n = 0;
  const store = createProgressStore({ storage, now: () => NOW, newId: () => `id-${++n}`, events: null });
  const id = store.addPlayer({ name: 'Maya', ageBand: '5-6', color: 'blue' }).id;
  store.setActivePlayer(id);
  return { store, id };
}

const play = (game: KitGame<number>, level: number, store: ProgressStore) =>
  mount<LevelRunApi<number>>(() => useLevelRun(game, level, { store, newSeed: () => 31, breakBefore: () => false, go: () => {} }));
const tap = (fn: () => void) => act(fn);
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

/** Solve four puzzles, then wait for the level card. */
function finishLevel(h: { current: LevelRunApi<number> }) {
  for (let i = 0; i < 4; i++) {
    tap(() => h.current.solve());
    if (i < 3) tap(() => h.current.next());
  }
  wait(LEVEL_CARD_DELAY_MS);
}

const sticker = (id: string) => {
  const s = STICKERS.find((x) => x.id === id)!;
  return { name: s.name, cells: stickerCells(s) };
};

describe('the new sticker on the level card (decision 19)', () => {
  it('Shape Sorter Level 3 with Levels 1 and 2 starred: the card carries Star, awarded once', () => {
    const { store, id } = makeStore();
    store.recordStars('sorter', 0, 3, id);
    store.recordStars('sorter', 1, 3, id);
    const h = play(SORTER, 2, store);
    finishLevel(h);
    expect(h.current.card).toMatchObject({ title: levelDoneTitle(3), sticker: sticker('s1') });
    const player = findPlayer(store.getState(), id)!;
    expect(Object.keys(player.stickers)).toEqual(['s1']);
    // Home and the book find nothing more to award
    expect(stickersDue(player)).toEqual([]);
  });

  it('a level that ends no chapter carries no sticker', () => {
    const { store } = makeStore();
    const h = play(SORTER, 0, store);
    finishLevel(h);
    expect(h.current.card).toMatchObject({ title: levelDoneTitle(1) });
    expect(Reflect.get(h.current.card!, 'sticker')).toBeUndefined();
  });

  it('a replayed level whose chapter sticker is already earned carries none', () => {
    const { store, id } = makeStore();
    for (let lv = 0; lv < 3; lv++) store.recordStars('sorter', lv, 3, id);
    store.awardSticker('s1', id);
    const h = play(SORTER, 2, store);
    finishLevel(h);
    expect(h.current.card).not.toBeNull();
    expect(Reflect.get(h.current.card!, 'sticker')).toBeUndefined();
  });

  it('the game-done card after the last level carries the last chapter’s sticker', () => {
    const { store, id } = makeStore();
    for (let lv = 0; lv < sorterMeta.levelCount - 1; lv++) store.recordStars('sorter', lv, 3, id);
    // the first two chapters were awarded on Home earlier
    store.awardSticker('s1', id);
    store.awardSticker('s2', id);
    const h = play(SORTER, sorterMeta.levelCount - 1, store);
    finishLevel(h);
    expect(h.current.card).toMatchObject({ title: GAME_DONE_TITLE, sticker: sticker('s3') });
  });

  it('no player to save to (removed mid-level): the level ends in memory with no sticker and nothing awarded', () => {
    const { store, id } = makeStore();
    store.recordStars('sorter', 0, 3, id);
    store.recordStars('sorter', 1, 3, id);
    const h = play(SORTER, 2, store);
    store.removePlayer(id);
    finishLevel(h);
    expect(h.current.card).not.toBeNull();
    expect(Reflect.get(h.current.card!, 'sticker')).toBeUndefined();
  });
});

describe('the sticker waits for the level to finish (review)', () => {
  it('a chapter already due is not awarded by the first three solves, only by the fourth, and then shows on the card', () => {
    const { store, id } = makeStore();
    for (let lv = 0; lv < 3; lv++) store.recordStars('sorter', lv, 3, id);
    const h = play(SORTER, 2, store);
    for (let i = 0; i < 3; i++) {
      tap(() => h.current.solve());
      tap(() => h.current.next());
      expect(Object.keys(findPlayer(store.getState(), id)!.stickers)).toEqual([]);
    }
    tap(() => h.current.solve());
    wait(LEVEL_CARD_DELAY_MS);
    expect(Object.keys(findPlayer(store.getState(), id)!.stickers)).toEqual(['s1']);
    expect(h.current.card).toMatchObject({ sticker: sticker('s1') });
  });
});

describe('saved data from before round 2 (review)', () => {
  /** A store that opens on `saved`, as the app does on a device with an older record. */
  const storeOn = (saved: unknown) => {
    const data = new Map([[STORAGE_KEY, JSON.stringify(saved)]]);
    const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
    return createProgressStore({ storage, now: () => NOW, newId: () => 'new-id', events: null });
  };

  it('a v2 record with no sticker list: finishing the chapter shows Star and saves it', () => {
    const games = { sorter: { unlocked: 2, stars: { 0: 3, 1: 2 }, best: {} } };
    const store = storeOn({ version: 2, players: [{ id: 'old', name: 'Maya', ageBand: '5-6', color: 'blue', games }], activePlayerId: 'old' });
    const h = play(SORTER, 2, store);
    finishLevel(h);
    expect(h.current.card).toMatchObject({ title: levelDoneTitle(3), sticker: sticker('s1') });
    expect(Object.keys(findPlayer(store.getState(), 'old')!.stickers)).toEqual(['s1']);
  });

  it.each([
    [true, 'a solved puzzle that used a hint shows the mark from the start'],
    [false, 'solved puzzles with no hint show none'],
  ])('a saved Number Line-up run, usedHint %s: %s', (usedHint) => {
    const run = { set: numbersSet('5-6'), seed: 31, queue: [1, 2, 3, 4, 5], solved: [{ puzzle: 0, count: 0, usedHint, outOfTime: false }], hintsLeft: 2, updatedAt: NOW };
    const games = { numbers: { unlocked: 0, stars: {}, best: {}, runs: { 0: run } } };
    const store = storeOn({ version: 3, players: [{ id: 'old', name: 'Maya', ageBand: '5-6', color: 'blue', games }], activePlayerId: 'old' });
    const h = play(NUMBERS, 0, store);
    expect(h.current.puzzleNo).toBe(1);
    expect(h.current.hintCapped).toBe(usedHint);
  });
});

describe('hintCapped from the hook (decision 25)', () => {
  it('is false before a hint, true after it, and stays true after the solve and on the next puzzle', () => {
    const { store } = makeStore();
    const h = play(NUMBERS, 0, store);
    expect(h.current.hintCapped).toBe(false);
    tap(() => h.current.hint!.use());
    expect(h.current.hintCapped).toBe(true);
    tap(() => h.current.solve());
    expect(h.current.hintCapped).toBe(true);
    tap(() => h.current.next());
    expect(h.current.hintCapped).toBe(true);
  });

  it('is false for a game without hints', () => {
    const { store } = makeStore();
    const h = play(SORTER, 0, store);
    expect(h.current.hintCapped).toBe(false);
  });
});
