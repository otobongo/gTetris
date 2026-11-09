/**
 * Review cases for the kit's hook (six-games brief 3.1, 3.3, 10.1), added by the test review next to
 * useLevelRun.test.ts: the 1 s tick and what pauses it (hold, a hidden page), the level card's delay,
 * Break on Next, New puzzle and Play Level, double taps, a player removed mid-level ('ignored'), the
 * band frozen per puzzle with the real store, keepSolved against a version bump, keyed slips and the
 * card's lines, and the last level.
 *
 * The hook runs in a real React root so its effects run. Only the outside boundaries are stand-ins:
 * the page (document.visibilityState and its visibilitychange event), the browser window and the
 * clock (Vitest's fake timers). The progress store is the real one on in-memory storage.
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createProgressStore,
  findPlayer,
  gameOf,
  runOf,
  type AgeBand,
  type KeyValueStorage,
  type LevelRun,
  type ProgressStore,
} from '../../shared/progress';
import { LEVEL_CARD_DELAY_MS } from '../../shared/ui/LevelCard';
import type { GameMeta } from '../meta';
import { levelStars, mixerSet, numbersSet } from '../run';
import { BACK_TO_GAMES, GAME_DONE_TITLE, HINT_CAP, LEVEL_RULE, gameDoneFact, levelDoneTitle, playLabel, slipFact } from './copy';
import type { KitGame, LevelRunApi } from './levelRun';
import { useLevelRun, type UseLevelRunOptions } from './useLevelRun';

const NOW = new Date(2026, 10, 7, 16, 0).getTime();
const SEED = 6161;

const meta = (levelCount: number): GameMeta => ({ levelCount, chapters: [{ title: 'All levels', note: '', start: 0, count: levelCount }] });

/** Each puzzle is named by its number and the band it was built for, so a test sees which band built it. */
const MIXER: KitGame<string> = { id: 'mixer', meta: meta(9), title: 'Color Mixer', set: () => mixerSet(), seed: 'run', puzzle: (_l, n, c) => `${n}@${c.band}` };
const NUMBERS: KitGame<string> = {
  id: 'numbers',
  meta: meta(12),
  title: 'Number Line-up',
  set: (b) => numbersSet(b),
  seed: 'run',
  keepSolved: true,
  hints: true,
  puzzle: (_l, n, c) => `${n}@${c.band}`,
};
const NUMBERS_V2: KitGame<string> = { ...NUMBERS, set: (b) => numbersSet(b, 2) };

/* ---------- The page, the window and the clock ---------- */

const page = { hidden: false, listeners: new Set<() => void>() };
const doc = {
  get visibilityState() {
    return page.hidden ? 'hidden' : 'visible';
  },
  addEventListener(type: string, fn: () => void) {
    if (type === 'visibilitychange') page.listeners.add(fn);
  },
  removeEventListener(type: string, fn: () => void) {
    if (type === 'visibilitychange') page.listeners.delete(fn);
  },
  activeElement: null,
  body: null,
  defaultView: null as unknown,
};
const win = {
  event: undefined,
  document: doc,
  innerWidth: 390,
  innerHeight: 844,
  HTMLIFrameElement: class {},
  addEventListener() {},
  removeEventListener() {},
  // read the timers when called, so Vitest's fake ones are used
  setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
  clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id),
  setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
  clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
};
doc.defaultView = win;

/** The page goes to the background (another app, a locked screen) or comes back, as the browser reports it. */
function setPage(hidden: boolean, { event = true } = {}) {
  page.hidden = hidden;
  if (event) act(() => page.listeners.forEach((fn) => fn()));
}

const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  page.hidden = false;
  page.listeners.clear();
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

/** Renders the hook in a real React root and gives its latest answer. */
function mount<T>(use: () => T) {
  let latest: T | undefined;
  function Probe() {
    latest = use();
    return null;
  }
  const container = { nodeType: 1, nodeName: 'DIV', tagName: 'DIV', namespaceURI: 'http://www.w3.org/1999/xhtml', ownerDocument: doc, textContent: '', addEventListener() {}, removeEventListener() {} };
  const root = createRoot(container as unknown as Element);
  act(() => root.render(createElement(Probe)));
  let mounted = true;
  const unmount = () => {
    if (!mounted) return;
    mounted = false;
    act(() => root.unmount());
  };
  roots.push(unmount);
  return {
    get current(): T {
      return latest as T;
    },
    unmount,
  };
}

/* ---------- The store and a level ---------- */

function makeStore(players: { name: string; band: AgeBand }[] = [{ name: 'Maya', band: '5-6' }]) {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  let n = 0;
  const store = createProgressStore({ storage, now: () => NOW, newId: () => `id-${++n}`, events: null });
  const ids = players.map((p) => store.addPlayer({ name: p.name, ageBand: p.band, color: 'blue' }).id);
  if (ids[0]) store.setActivePlayer(ids[0]);
  return { store, ids };
}

function play(game: KitGame<string>, level: number, store: ProgressStore, over: Partial<UseLevelRunOptions> = {}) {
  const breaks: string[] = [];
  const went: string[] = [];
  let breakTime = false;
  const h = mount<LevelRunApi<string>>(() =>
    useLevelRun(game, level, {
      store,
      newSeed: () => SEED,
      breakBefore: (path) => {
        breaks.push(path);
        return breakTime;
      },
      go: (path) => void went.push(path),
      ...over,
    }),
  );
  return {
    h,
    breaks,
    went,
    /** The daily limit is used up (true) or a grown-up added time (false). */
    setBreak: (on: boolean) => {
      breakTime = on;
    },
  };
}

const tap = (fn: () => void) => act(fn);
const run = (store: ProgressStore, playerId: string, game: string, level: number): LevelRun | null => runOf(findPlayer(store.getState(), playerId), game, level);

/** Solves the puzzle on screen and, unless it was the last, goes on to the next. */
function solveAll(api: () => LevelRunApi<string>, perPuzzle: (() => void)[] = [() => {}, () => {}, () => {}, () => {}]) {
  perPuzzle.forEach((before, i) => {
    tap(before);
    tap(() => api().solve());
    if (i < perPuzzle.length - 1) tap(() => api().next());
  });
}

/* ---------- The tests ---------- */

describe('review: the 1 s tick and what pauses it', () => {
  it('counts whole seconds to the limit: Mixer ages 5 to 6 offers at 40 s, not at 39', () => {
    const { store } = makeStore();
    const { h } = play(MIXER, 0, store);
    wait(39_000);
    expect(h.current.offer).toBe(false);
    wait(1000);
    expect(h.current.offer).toBe(true);
    expect(h.current.shared).toBe('offer');
  });

  it('hold(true) stops the clock and hold(false) lets it run on from the seconds already counted', () => {
    const { store } = makeStore();
    const { h } = play(MIXER, 0, store);
    wait(20_000);
    tap(() => h.current.hold(true));
    wait(100_000);
    expect(h.current.offer).toBe(false);
    tap(() => h.current.hold(false));
    wait(19_000);
    expect(h.current.offer).toBe(false);
    wait(1000);
    expect(h.current.offer).toBe(true);
  });

  it('a hidden page stops the clock, and it runs on from where it was when the page shows again', () => {
    const { store } = makeStore();
    const { h } = play(MIXER, 0, store);
    wait(20_000);
    setPage(true);
    wait(100_000);
    expect(h.current.offer).toBe(false);
    setPage(false);
    wait(19_000);
    expect(h.current.offer).toBe(false);
    wait(1000);
    expect(h.current.offer).toBe(true);
  });

  it('counts no second while the page is hidden, even before the browser reports the change', () => {
    const { store } = makeStore();
    const { h } = play(MIXER, 0, store);
    wait(20_000);
    setPage(true, { event: false });
    wait(100_000);
    expect(h.current.offer).toBe(false);
    setPage(false, { event: false });
    wait(19_000);
    expect(h.current.offer).toBe(false);
    wait(1000);
    expect(h.current.offer).toBe(true);
  });

  it('a level opened in a hidden page counts nothing until the page shows', () => {
    const { store } = makeStore();
    page.hidden = true;
    const { h } = play(MIXER, 0, store);
    wait(100_000);
    expect(h.current.offer).toBe(false);
    setPage(false);
    wait(39_000);
    expect(h.current.offer).toBe(false);
    wait(1000);
    expect(h.current.offer).toBe(true);
  });

  it('a hold and a hidden page together: time counts again only once both have cleared', () => {
    const { store } = makeStore();
    const { h } = play(MIXER, 0, store);
    wait(10_000);
    tap(() => h.current.hold(true));
    setPage(true);
    setPage(false);
    wait(100_000);
    expect(h.current.offer).toBe(false);
    tap(() => h.current.hold(false));
    wait(30_000);
    expect(h.current.offer).toBe(true);
  });

  it('a new puzzle starts its clock at 0', () => {
    const { store } = makeStore();
    const { h } = play(MIXER, 0, store);
    wait(30_000);
    tap(() => h.current.solve());
    wait(100_000);
    tap(() => h.current.next());
    wait(39_000);
    expect(h.current.offer).toBe(false);
    wait(1000);
    expect(h.current.offer).toBe(true);
  });

  it('leaves no timer behind once the level is gone, nor a page listener', () => {
    const { store } = makeStore();
    const { h } = play(MIXER, 0, store);
    expect(vi.getTimerCount()).toBe(1);
    expect(page.listeners.size).toBe(1);
    h.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(page.listeners.size).toBe(0);
  });

  it('runs no clock once the fourth puzzle is solved, while the card waits and once it is open', () => {
    const { store } = makeStore();
    const { h } = play(MIXER, 0, store);
    solveAll(() => h.current);
    // only the card's delay is pending
    expect(vi.getTimerCount()).toBe(1);
    wait(LEVEL_CARD_DELAY_MS);
    expect(h.current.card).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('review: the level card’s delay', () => {
  it('opens LEVEL_CARD_DELAY_MS after the fourth solve, not a millisecond sooner', () => {
    const { store } = makeStore();
    const { h } = play(MIXER, 0, store);
    solveAll(() => h.current);
    expect(h.current.phase).toBe('done');
    expect(h.current.slot).toBe('empty');
    expect(h.current.dots).toEqual({ solved: 4, at: 4 });
    wait(LEVEL_CARD_DELAY_MS - 1);
    expect(h.current.card).toBeNull();
    wait(1);
    expect(h.current.card).toMatchObject({ title: levelDoneTitle(1), stars: 3, fact: slipFact(0), rule: LEVEL_RULE });
  });

  it('a Play Level tap while the card still waits does nothing: no Break check and no move', () => {
    const { store } = makeStore();
    const { h, breaks, went } = play(MIXER, 0, store);
    solveAll(() => h.current);
    const before = breaks.length;
    tap(() => h.current.next());
    expect(breaks).toHaveLength(before);
    expect(went).toEqual([]);
  });
});

describe('review: Break on Next, New puzzle and Play Level', () => {
  it('Next checks the daily limit with the level’s route; when Break takes over nothing loads, and the level resumes at the next unsolved puzzle', () => {
    const { store, ids } = makeStore();
    const { h, breaks, setBreak } = play(MIXER, 0, store);
    tap(() => h.current.solve());
    setBreak(true);
    tap(() => h.current.next());
    expect(breaks).toEqual(['/game/mixer/1']);
    expect(h.current.phase).toBe('solved');
    expect(h.current.puzzleNo).toBe(0);
    expect(h.current.slot).toBe('next');
    // nothing is solved or saved behind Break
    tap(() => h.current.solve());
    expect(run(store, ids[0], 'mixer', 0)).toMatchObject({ queue: [1, 2, 3, 4, 5] });
    expect(run(store, ids[0], 'mixer', 0)!.solved).toHaveLength(1);
    // a grown-up adds time; the child comes back to the level's route
    h.unmount();
    setBreak(false);
    const back = play(MIXER, 0, store);
    expect(back.h.current.puzzleNo).toBe(1);
    expect(back.h.current.dots).toEqual({ solved: 1, at: 2 });
    expect(back.h.current.phase).toBe('play');
  });

  it('Next goes on once Break no longer takes over', () => {
    const { store } = makeStore();
    const { h, breaks, setBreak } = play(MIXER, 0, store);
    tap(() => h.current.solve());
    setBreak(true);
    tap(() => h.current.next());
    setBreak(false);
    tap(() => h.current.next());
    expect(breaks).toEqual(['/game/mixer/1', '/game/mixer/1']);
    expect(h.current.puzzleNo).toBe(1);
    expect(h.current.phase).toBe('play');
  });

  it('New puzzle checks the daily limit with the level’s route; when Break takes over nothing swaps or saves, and the offer stays', () => {
    const { store, ids } = makeStore();
    const { h, breaks, setBreak } = play(MIXER, 0, store);
    tap(() => {
      for (let i = 0; i < 3; i++) h.current.slip();
    });
    setBreak(true);
    tap(() => h.current.swap());
    expect(breaks).toEqual(['/game/mixer/1']);
    expect(h.current.puzzleNo).toBe(0);
    expect(h.current.offer).toBe(true);
    expect(run(store, ids[0], 'mixer', 0)!.queue).toEqual([0, 1, 2, 3, 4, 5]);
    setBreak(false);
    tap(() => h.current.swap());
    expect(h.current.puzzleNo).toBe(1);
    expect(h.current.shared).toBe('swapped');
    expect(run(store, ids[0], 'mixer', 0)!.queue).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it('Play Level on the card checks the daily limit with the next level’s route; when Break takes over the card stays and nothing moves', () => {
    const { store } = makeStore();
    const { h, breaks, went, setBreak } = play(MIXER, 0, store);
    solveAll(() => h.current);
    wait(LEVEL_CARD_DELAY_MS);
    const card = h.current.card!;
    expect(card.primary.label).toBe(playLabel(2));
    expect(card.secondary).toMatchObject({ label: BACK_TO_GAMES, href: '#/' });
    const before = breaks.length;
    setBreak(true);
    tap(() => card.primary.onClick!());
    expect(breaks.slice(before)).toEqual(['/game/mixer/2']);
    expect(went).toEqual([]);
    expect(h.current.card).not.toBeNull();
    setBreak(false);
    tap(() => h.current.card!.primary.onClick!());
    expect(went).toEqual(['/game/mixer/2']);
  });

  it('Play Level in the controls slot, after the card is closed with Escape or the scrim, checks the limit too', () => {
    const { store } = makeStore();
    const { h, breaks, went, setBreak } = play(MIXER, 0, store);
    solveAll(() => h.current);
    wait(LEVEL_CARD_DELAY_MS);
    tap(() => h.current.card!.onClose!());
    expect(h.current.card).toBeNull();
    expect(h.current.slot).toBe('play');
    const before = breaks.length;
    setBreak(true);
    tap(() => h.current.next());
    expect(breaks.slice(before)).toEqual(['/game/mixer/2']);
    expect(went).toEqual([]);
    expect(h.current.slot).toBe('play');
    setBreak(false);
    tap(() => h.current.next());
    expect(went).toEqual(['/game/mixer/2']);
  });
});

describe('review: double taps act once', () => {
  it('a double tap on the last right move records one result', () => {
    const { store, ids } = makeStore();
    const { h } = play(MIXER, 0, store);
    tap(() => {
      h.current.solve();
      h.current.solve();
    });
    expect(run(store, ids[0], 'mixer', 0)!.solved).toHaveLength(1);
  });

  it('a double tap on Next checks Break once and moves on one puzzle', () => {
    const { store, ids } = makeStore();
    const { h, breaks } = play(MIXER, 0, store);
    tap(() => h.current.solve());
    tap(() => {
      h.current.next();
      h.current.next();
    });
    expect(breaks).toEqual(['/game/mixer/1']);
    expect(h.current.puzzleNo).toBe(1);
    tap(() => h.current.solve());
    expect(run(store, ids[0], 'mixer', 0)!.solved.map((r) => r.puzzle)).toEqual([0, 1]);
  });

  it('a double tap on Play Level checks Break once and opens the next level once', () => {
    const { store } = makeStore();
    const { h, breaks, went } = play(MIXER, 0, store);
    solveAll(() => h.current);
    wait(LEVEL_CARD_DELAY_MS);
    const before = breaks.length;
    const card = h.current.card!;
    tap(() => {
      card.primary.onClick!();
      card.primary.onClick!();
    });
    expect(breaks.slice(before)).toEqual(['/game/mixer/2']);
    expect(went).toEqual(['/game/mixer/2']);
  });
});

describe('review: a player removed mid-level (recordPuzzle answers ignored)', () => {
  it('the level goes on in memory to its card, and nothing is saved, for the removed child or anyone else', () => {
    const { store, ids } = makeStore([
      { name: 'Maya', band: '5-6' },
      { name: 'Leo', band: '9-10' },
    ]);
    const [maya, leo] = ids;
    const { h } = play(MIXER, 0, store);
    tap(() => h.current.solve());
    tap(() => h.current.next());
    // a grown-up removes Maya in Settings; Leo becomes the active player
    tap(() => store.removePlayer(maya));
    expect(store.getState().activePlayerId).toBe(leo);
    const before = store.getState();
    tap(() => h.current.slip('a'));
    tap(() => h.current.solve());
    tap(() => h.current.next());
    tap(() => {
      for (let i = 0; i < 3; i++) h.current.slip();
    });
    // New puzzle still works, in memory
    tap(() => h.current.swap());
    expect(h.current.puzzleNo).toBe(3);
    expect(h.current.dots).toEqual({ solved: 2, at: 3 });
    tap(() => h.current.solve());
    tap(() => h.current.next());
    tap(() => h.current.solve());
    expect(h.current.phase).toBe('done');
    expect(h.current.finish).toMatchObject({ stars: 3, next: 1 });
    expect(h.current.finish!.results.map((r) => r.puzzle)).toEqual([0, 1, 3, 4]);
    expect(store.getState()).toBe(before);
    expect(run(store, leo, 'mixer', 0)).toBeNull();
    expect(gameOf(findPlayer(store.getState(), leo), 'mixer').stars).toEqual({});
    wait(LEVEL_CARD_DELAY_MS);
    expect(h.current.card).toMatchObject({ title: levelDoneTitle(1), stars: 3, fact: slipFact(1), primary: { label: playLabel(2) } });
  });

  it('a level opened with no player at all saves to the player it makes, as the built games do', () => {
    const { store } = makeStore([]);
    expect(store.getState().players).toEqual([]);
    const { h } = play(MIXER, 0, store);
    const [player] = store.getState().players;
    expect(player).toBeDefined();
    tap(() => h.current.solve());
    expect(run(store, player.id, 'mixer', 0)!.solved).toHaveLength(1);
  });
});

describe('review: the band frozen per puzzle, with the store', () => {
  it('Number Line-up Level 9: a band changed mid-puzzle keeps the puzzle, its band and its stuck row until Next', () => {
    const { store, ids } = makeStore();
    const { h } = play(NUMBERS, 8, store);
    tap(() => h.current.solve());
    tap(() => h.current.next());
    expect(h.current.puzzle).toBe('1@5-6');
    tap(() => store.updatePlayer(ids[0], { ageBand: '7-8' }));
    expect(h.current.band).toBe('5-6');
    expect(h.current.puzzle).toBe('1@5-6');
    // ages 5 to 6 offer at 3 slips; ages 7 to 8 would wait for 4
    tap(() => {
      for (let i = 0; i < 3; i++) h.current.slip();
    });
    expect(h.current.offer).toBe(true);
    tap(() => h.current.hint!.use());
    tap(() => h.current.solve());
    // the puzzle on screen is saved on the set it was built from
    expect(run(store, ids[0], 'numbers', 8)).toMatchObject({ set: 'numbers:1:5-6', hintsLeft: 2 });
    tap(() => h.current.next());
    expect(h.current.band).toBe('7-8');
    expect(h.current.puzzle).toBe('2@7-8');
    expect(h.current.dots).toEqual({ solved: 2, at: 3 });
    expect(h.current.hint!.left).toBe(2);
    const moved = run(store, ids[0], 'numbers', 8)!;
    expect(moved).toMatchObject({ set: 'numbers:1:7-8', seed: SEED, queue: [2, 3, 4, 5], hintsLeft: 2 });
    expect(moved.solved.map((r) => [r.puzzle, r.count, r.usedHint])).toEqual([
      [0, 0, false],
      [1, 3, true],
    ]);
    // the new puzzle counts to the new row
    tap(() => {
      for (let i = 0; i < 3; i++) h.current.slip();
    });
    expect(h.current.offer).toBe(false);
    tap(() => h.current.slip());
    expect(h.current.offer).toBe(true);
  });

  it('a band changed mid-puzzle reaches the swapped-in puzzle, and the store keeps the swap and the solved puzzle', () => {
    const { store, ids } = makeStore();
    const { h } = play(NUMBERS, 8, store);
    tap(() => h.current.solve());
    tap(() => h.current.next());
    tap(() => store.updatePlayer(ids[0], { ageBand: '9-10' }));
    tap(() => {
      for (let i = 0; i < 3; i++) h.current.slip();
    });
    tap(() => h.current.swap());
    expect(h.current.band).toBe('9-10');
    expect(h.current.puzzle).toBe('2@9-10');
    expect(h.current.dots).toEqual({ solved: 1, at: 2 });
    expect(run(store, ids[0], 'numbers', 8)).toMatchObject({ set: 'numbers:1:9-10', seed: SEED, queue: [2, 3, 4, 5, 1] });
    expect(run(store, ids[0], 'numbers', 8)!.solved).toHaveLength(1);
  });

  it('Color Mixer: a band change keeps the same run and brings the new stuck row at Next', () => {
    const { store, ids } = makeStore([{ name: 'Maya', band: '3-4' }]);
    const { h } = play(MIXER, 0, store);
    tap(() => store.updatePlayer(ids[0], { ageBand: '9-10' }));
    // ages 3 to 4 offer at 30 s on the puzzle on screen
    wait(30_000);
    expect(h.current.offer).toBe(true);
    tap(() => h.current.solve());
    const before = run(store, ids[0], 'mixer', 0);
    tap(() => h.current.next());
    expect(h.current.band).toBe('9-10');
    expect(run(store, ids[0], 'mixer', 0)).toBe(before);
    wait(59_000);
    expect(h.current.offer).toBe(false);
    wait(1000);
    expect(h.current.offer).toBe(true);
  });

  it('a band changed and changed back before Next moves nothing', () => {
    const { store, ids } = makeStore();
    const { h } = play(NUMBERS, 8, store);
    tap(() => h.current.solve());
    const before = run(store, ids[0], 'numbers', 8);
    tap(() => store.updatePlayer(ids[0], { ageBand: '9-10' }));
    tap(() => store.updatePlayer(ids[0], { ageBand: '5-6' }));
    tap(() => h.current.next());
    expect(h.current.band).toBe('5-6');
    expect(h.current.puzzle).toBe('1@5-6');
    expect(run(store, ids[0], 'numbers', 8)).toBe(before);
  });
});

describe('review: keepSolved on a band move against a version bump, as a level opens', () => {
  /** A run Maya left on Level 9 at ages 3 to 4: two puzzles solved and two hints spent. */
  function leftAt34(store: ProgressStore, id: string) {
    const init = { set: numbersSet('3-4'), seed: 77, hintsLeft: 3, keepSolved: true };
    const rules = { ...init, levelCount: 12, stars: (r: Parameters<typeof levelStars>[1]) => levelStars('numbers', r) };
    store.startRun('numbers', 8, init, id);
    store.spendHint('numbers', 8, id);
    store.spendHint('numbers', 8, id);
    store.recordPuzzle('numbers', 8, { puzzle: 0, count: 0, usedHint: true, outOfTime: false }, rules, id);
    store.recordPuzzle('numbers', 8, { puzzle: 1, count: 2, usedHint: false, outOfTime: false }, rules, id);
  }

  it('the same version on a new band resumes at the next unsolved puzzle with its seed and hints, built for the new band', () => {
    const { store, ids } = makeStore([{ name: 'Maya', band: '7-8' }]);
    leftAt34(store, ids[0]);
    const { h } = play(NUMBERS, 8, store);
    expect(h.current.puzzleNo).toBe(2);
    expect(h.current.puzzle).toBe('2@7-8');
    expect(h.current.dots).toEqual({ solved: 2, at: 3 });
    expect(h.current.hint!.left).toBe(1);
    expect(run(store, ids[0], 'numbers', 8)).toMatchObject({ set: 'numbers:1:7-8', seed: 77, queue: [2, 3, 4, 5], hintsLeft: 1 });
  });

  it('a raised version starts the level again at puzzle 1, with a new seed and 3 hints', () => {
    const { store, ids } = makeStore([{ name: 'Maya', band: '7-8' }]);
    leftAt34(store, ids[0]);
    const { h } = play(NUMBERS_V2, 8, store);
    expect(h.current.puzzleNo).toBe(0);
    expect(h.current.dots).toEqual({ solved: 0, at: 1 });
    expect(h.current.hint!.left).toBe(3);
    expect(run(store, ids[0], 'numbers', 8)).toMatchObject({ set: 'numbers:2:7-8', seed: SEED, queue: [0, 1, 2, 3, 4, 5], solved: [], hintsLeft: 3 });
  });
});

describe('review: keyed slips, the hint cap and the card’s lines', () => {
  it('one wrong pair given three times shows the offer and saves one slip', () => {
    const { store, ids } = makeStore();
    const { h } = play(MIXER, 0, store);
    tap(() => {
      for (let i = 0; i < 3; i++) h.current.slip('red+blue');
    });
    expect(h.current.offer).toBe(true);
    tap(() => h.current.solve());
    expect(run(store, ids[0], 'mixer', 0)!.solved[0].count).toBe(1);
  });

  it('the card counts star slips: the same key twice on each puzzle is "4 puzzles, 4 slips." and 2 stars', () => {
    const { store } = makeStore();
    const { h } = play(MIXER, 0, store);
    const twice = () => {
      h.current.slip('a');
      h.current.slip('a');
    };
    solveAll(() => h.current, [twice, twice, twice, twice]);
    wait(LEVEL_CARD_DELAY_MS);
    expect(h.current.card).toMatchObject({ stars: 2, fact: slipFact(4) });
    expect(h.current.card!.fact).toBe('4 puzzles, 4 slips.');
  });

  it('unkeyed slips each count: twice on each puzzle is "4 puzzles, 8 slips." and 1 star', () => {
    const { store } = makeStore();
    const { h } = play(MIXER, 0, store);
    const twice = () => {
      h.current.slip();
      h.current.slip();
    };
    solveAll(() => h.current, [twice, twice, twice, twice]);
    wait(LEVEL_CARD_DELAY_MS);
    expect(h.current.card).toMatchObject({ stars: 1, fact: '4 puzzles, 8 slips.' });
  });

  it('a hint on a puzzle swapped away stays spent and puts no cap on the card', () => {
    const { store } = makeStore();
    const { h } = play(NUMBERS, 0, store);
    tap(() => h.current.hint!.use());
    tap(() => {
      for (let i = 0; i < 3; i++) h.current.slip();
    });
    tap(() => h.current.swap());
    expect(h.current.hint!.left).toBe(2);
    solveAll(() => h.current);
    wait(LEVEL_CARD_DELAY_MS);
    expect(h.current.card).toMatchObject({ stars: 3 });
    expect(h.current.card!.cap).toBeUndefined();
  });

  it('a hint on a solved puzzle caps the card at 2 stars and says why', () => {
    const { store } = makeStore();
    const { h } = play(NUMBERS, 0, store);
    solveAll(() => h.current, [() => {}, () => {}, () => h.current.hint!.use(), () => {}]);
    wait(LEVEL_CARD_DELAY_MS);
    expect(h.current.card).toMatchObject({ stars: 2, cap: HINT_CAP });
  });

  it('a game without hints has no hint and never a cap line', () => {
    const { store } = makeStore();
    const { h } = play(MIXER, 0, store);
    expect(h.current.hint).toBeNull();
    solveAll(() => h.current);
    wait(LEVEL_CARD_DELAY_MS);
    expect(h.current.card!.cap).toBeUndefined();
  });
});

describe('review: the last level', () => {
  /** Maya has stars on Mixer Levels 1 to 8 and plays Level 9, the last. */
  function lastLevel() {
    const made = makeStore();
    for (let i = 0; i < 8; i++) made.store.recordStars('mixer', i, i < 4 ? 3 : 2, made.ids[0]);
    made.store.pickLevel('mixer', 8, 9, made.ids[0]);
    return { ...made, ...play(MIXER, 8, made.store) };
  }

  it('the card reads "You finished every level!" with the game’s star total and one button, Back to games', () => {
    const { h, store, ids } = lastLevel();
    solveAll(() => h.current);
    wait(LEVEL_CARD_DELAY_MS);
    // 4 x 3 + 4 x 2 + 3 for this level
    expect(h.current.card).toMatchObject({
      title: GAME_DONE_TITLE,
      stars: 3,
      fact: gameDoneFact(9, 23),
      primary: { label: BACK_TO_GAMES, href: '#/' },
    });
    expect(h.current.card!.fact).toBe('9 levels, 23 of 27 stars.');
    expect(h.current.card!.secondary).toBeUndefined();
    expect(gameOf(findPlayer(store.getState(), ids[0]), 'mixer').current).toBeUndefined();
  });

  it('closing the last card goes Home, with no Break check', () => {
    const { h, breaks, went } = lastLevel();
    solveAll(() => h.current);
    wait(LEVEL_CARD_DELAY_MS);
    const before = breaks.length;
    tap(() => h.current.card!.onClose!());
    expect(went).toEqual(['/']);
    expect(breaks).toHaveLength(before);
    // and once gone, a further tap does nothing
    tap(() => h.current.next());
    expect(went).toEqual(['/']);
  });

  it('the last level with an earlier level left without stars sends the child there next', () => {
    const { store, ids } = makeStore();
    for (const i of [0, 1, 2, 4, 5, 6, 7]) store.recordStars('mixer', i, 3, ids[0]);
    store.pickLevel('mixer', 8, 9, ids[0]);
    const { h, went } = play(MIXER, 8, store);
    solveAll(() => h.current);
    wait(LEVEL_CARD_DELAY_MS);
    expect(h.current.card).toMatchObject({ title: levelDoneTitle(9), primary: { label: playLabel(4) } });
    tap(() => h.current.card!.primary.onClick!());
    expect(went).toEqual(['/game/mixer/4']);
  });

  it('the level before the last opens the last one', () => {
    const { store, ids } = makeStore();
    for (let i = 0; i < 7; i++) store.recordStars('mixer', i, 3, ids[0]);
    const { h, went } = play(MIXER, 7, store);
    solveAll(() => h.current);
    wait(LEVEL_CARD_DELAY_MS);
    expect(h.current.card).toMatchObject({ title: levelDoneTitle(8), primary: { label: playLabel(9) } });
    tap(() => h.current.card!.primary.onClick!());
    expect(went).toEqual(['/game/mixer/9']);
  });
});
