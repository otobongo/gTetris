/**
 * Round 2, decision 13 (kit half of DRAFT): a game that sets `keepDraft` keeps the star slips of the
 * puzzle on screen for the session, so leaving and coming back can never shed a slip. Only Picture
 * Builder sets it; every other game reads and writes nothing.
 *
 * The pure helpers in draft.ts run on a fake storage. The hook runs in a real React root with the real
 * progress store on in-memory storage; the session storage is a stand-in passed through the options,
 * or a stand-in window.sessionStorage for the default path.
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgressStore, findPlayer, runOf, type KeyValueStorage, type ProgressStore } from '../../shared/progress';
import type { GameMeta } from '../meta';
import { builderSet, mixerSet } from '../run';
import { clearDraft, draftKey, loadDraft, saveDraft, type DraftStorage } from './draft';
import { initLevelRun, levelRunReducer, type KitGame, type LevelRunApi, type LevelRunState } from './levelRun';
import { useLevelRun, type UseLevelRunOptions } from './useLevelRun';

const NOW = new Date(2026, 10, 16, 10, 0).getTime();

const meta = (levelCount: number): GameMeta => ({ levelCount, chapters: [{ title: 'All levels', note: '', start: 0, count: levelCount }] });

/** A Picture Builder stand-in: a fixed set, seed 0, and the draft kept. Its puzzle is its number. */
const BUILDER: KitGame<number> = { id: 'builder', meta: meta(12), title: 'Picture Builder', set: () => builderSet(1), seed: 'fixed', keepDraft: true, puzzle: (_l, n) => n };
/** The same game without keepDraft, as every other kit game is. */
const PLAIN: KitGame<number> = { ...BUILDER, keepDraft: undefined };
const MIXER: KitGame<number> = { id: 'mixer', meta: meta(9), title: 'Color Mixer', set: () => mixerSet(), seed: 'run', puzzle: (_l, n) => n };

/* ---------- A fake session storage that records every call ---------- */

function fakeStorage(start: Record<string, string> = {}) {
  const data = new Map(Object.entries(start));
  const calls: string[] = [];
  const storage: DraftStorage = {
    getItem: (k) => {
      calls.push(`get ${k}`);
      return data.get(k) ?? null;
    },
    setItem: (k, v) => {
      calls.push(`set ${k}`);
      data.set(k, v);
    },
    removeItem: (k) => {
      calls.push(`remove ${k}`);
      data.delete(k);
    },
  };
  return { storage, data, calls };
}

const throwing: DraftStorage = {
  getItem: () => {
    throw new Error('denied');
  },
  setItem: () => {
    throw new Error('denied');
  },
  removeItem: () => {
    throw new Error('denied');
  },
};

/* ---------- The page, the window and the clock (as useLevelRun.review.test.ts) ---------- */

const doc = {
  visibilityState: 'visible',
  addEventListener() {},
  removeEventListener() {},
  activeElement: null,
  body: null,
  defaultView: null as unknown,
};
const win: Record<string, unknown> = {
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

function makeStore(names: string[] = ['Maya']) {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  let n = 0;
  const store = createProgressStore({ storage, now: () => NOW, newId: () => `id-${++n}`, events: null });
  const ids = names.map((name) => store.addPlayer({ name, ageBand: '5-6', color: 'blue' }).id);
  if (ids[0]) store.setActivePlayer(ids[0]);
  return { store, ids };
}

function play(game: KitGame<number>, level: number, store: ProgressStore, over: Partial<UseLevelRunOptions> = {}) {
  return mount<LevelRunApi<number>>(() => useLevelRun(game, level, { store, newSeed: () => 777, breakBefore: () => false, go: () => {}, ...over }));
}

const tap = (fn: () => void) => act(fn);

/** The key of the puzzle on screen for player `pid` on the stand-in builder's level `level`. */
const keyOn = (pid: string, level: number, puzzleNo: number) => draftKey({ playerId: pid, game: 'builder', level, set: builderSet(1), seed: 0, puzzleNo });
const value = (slips: number, wrongKeys: string[]) => JSON.stringify({ v: 1, slips, wrongKeys });

/* ---------- The pure helpers ---------- */

describe('draft.ts: the key and the stored value', () => {
  it('names the puzzle by player, game, level, set, seed and puzzle number, ending in :slips', () => {
    expect(draftKey({ playerId: 'p1', game: 'builder', level: 2, set: 'builder:1', seed: 0, puzzleNo: 4 })).toBe('bw:draft:p1:builder:2:builder:1:0:4:slips');
  });

  it('writes {"v":1,"slips":n,"wrongKeys":[...]} and reads it back', () => {
    const { storage, data } = fakeStorage();
    saveDraft(storage, 'k', { slips: 2, wrongKeys: ['a', 'b'] });
    expect(data.get('k')).toBe('{"v":1,"slips":2,"wrongKeys":["a","b"]}');
    expect(loadDraft(storage, 'k')).toEqual({ slips: 2, wrongKeys: ['a', 'b'] });
    clearDraft(storage, 'k');
    expect(data.has('k')).toBe(false);
    expect(loadDraft(storage, 'k')).toBeNull();
  });

  it('ignores malformed or foreign JSON', () => {
    const junk = [
      'not json',
      'null',
      '[]',
      '"slips"',
      '{}',
      '{"v":2,"slips":1,"wrongKeys":[]}',
      '{"v":1,"slips":"2","wrongKeys":[]}',
      '{"v":1,"slips":-1,"wrongKeys":[]}',
      '{"v":1,"slips":1.5,"wrongKeys":[]}',
      '{"v":1,"slips":2}',
      '{"v":1,"slips":2,"wrongKeys":"a"}',
      '{"v":1,"slips":2,"wrongKeys":[1,2]}',
      '{"v":1,"slips":1,"wrongKeys":["a","b"]}',
      '{"v":1,"size":5,"cells":[]}',
    ];
    for (const raw of junk) {
      const { storage } = fakeStorage({ k: raw });
      expect(loadDraft(storage, 'k'), raw).toBeNull();
    }
  });

  it('never throws when the storage does, and a null storage keeps nothing', () => {
    expect(loadDraft(throwing, 'k')).toBeNull();
    expect(() => saveDraft(throwing, 'k', { slips: 1, wrongKeys: [] })).not.toThrow();
    expect(() => clearDraft(throwing, 'k')).not.toThrow();
    expect(loadDraft(null, 'k')).toBeNull();
    expect(() => saveDraft(null, 'k', { slips: 1, wrongKeys: [] })).not.toThrow();
    expect(() => clearDraft(null, 'k')).not.toThrow();
  });
});

/* ---------- The reducer's restore action ---------- */

describe('levelRun: the restore action', () => {
  const open = (): LevelRunState => initLevelRun({ game: BUILDER, level: 0, band: '5-6', stored: null, now: NOW });

  it('puts the slips and keys back on a puzzle in play that has none yet, and leaves the stuck count at zero', () => {
    const s = levelRunReducer(open(), { type: 'restore', slips: 3, wrongKeys: ['a', 'b'] });
    expect(s.slips).toBe(3);
    expect(s.wrongKeys).toEqual(['a', 'b']);
    expect(s.stuck.count).toBe(0);
    expect(s.stuck.offer).toBe(false);
    expect(s.round).toBe(0);
  });

  it('does nothing once the puzzle has a slip, after a solve, or while leaving', () => {
    const slipped = levelRunReducer(open(), { type: 'slip', key: 'x' });
    expect(levelRunReducer(slipped, { type: 'restore', slips: 3, wrongKeys: ['a'] })).toBe(slipped);
    const solved = levelRunReducer(open(), { type: 'solve', outcome: { kind: 'ignored' } });
    expect(levelRunReducer(solved, { type: 'restore', slips: 3, wrongKeys: ['a'] })).toBe(solved);
    const leaving = levelRunReducer(open(), { type: 'leave' });
    expect(levelRunReducer(leaving, { type: 'restore', slips: 3, wrongKeys: ['a'] })).toBe(leaving);
  });

  it('a repeat of a restored key adds no star slip but still feeds the stuck count', () => {
    let s = levelRunReducer(open(), { type: 'restore', slips: 2, wrongKeys: ['a', 'b'] });
    s = levelRunReducer(s, { type: 'slip', key: 'a' });
    expect(s.slips).toBe(2);
    expect(s.stuck.count).toBe(1);
  });

  it('ignores an empty or broken restore', () => {
    const s = open();
    expect(levelRunReducer(s, { type: 'restore', slips: 0, wrongKeys: [] })).toBe(s);
    expect(levelRunReducer(s, { type: 'restore', slips: -2, wrongKeys: [] })).toBe(s);
    expect(levelRunReducer(s, { type: 'restore', slips: Number.NaN, wrongKeys: [] })).toBe(s);
  });
});

/* ---------- The hook ---------- */

describe('useLevelRun with keepDraft: slips survive leaving the puzzle', () => {
  it('two slips, the level left and opened again: slips 2 and keys a, b; a repeat of a adds none; solving records 2 and removes the key', () => {
    const { store, ids } = makeStore();
    const { storage, data } = fakeStorage();
    const first = play(BUILDER, 0, store, { drafts: storage });
    const key = keyOn(ids[0], 0, first.current.puzzleNo);
    tap(() => first.current.slip('a'));
    tap(() => first.current.slip('b'));
    expect(data.get(key)).toBe(value(2, ['a', 'b']));
    first.unmount();

    const again = play(BUILDER, 0, store, { drafts: storage });
    expect(again.current.puzzleNo).toBe(first.current.puzzleNo);
    tap(() => again.current.slip('a'));
    // the repeat still counts towards the offer: two more bring it at 5 to 6 (count 3)
    expect(again.current.offer).toBe(false);
    tap(() => again.current.slip('a'));
    tap(() => again.current.slip('a'));
    expect(again.current.offer).toBe(true);
    expect(data.get(key)).toBe(value(2, ['a', 'b']));

    tap(() => again.current.solve());
    const run = runOf(findPlayer(store.getState(), ids[0]), 'builder', 0)!;
    expect(run.solved.at(-1)).toMatchObject({ puzzle: again.current.puzzleNo, count: 2 });
    expect(data.has(key)).toBe(false);
  });

  it('a slip with no key is kept too', () => {
    const { store, ids } = makeStore();
    const { storage, data } = fakeStorage();
    const h = play(BUILDER, 0, store, { drafts: storage });
    tap(() => h.current.slip());
    expect(data.get(keyOn(ids[0], 0, h.current.puzzleNo))).toBe(value(1, []));
  });

  it('a swap removes the swapped-away puzzle’s key and the next puzzle starts with no slips', () => {
    const { store, ids } = makeStore();
    const { storage, data } = fakeStorage();
    const h = play(BUILDER, 0, store, { drafts: storage });
    const was = h.current.puzzleNo;
    tap(() => h.current.slip('a'));
    tap(() => h.current.slip('b'));
    tap(() => h.current.slip('c'));
    expect(h.current.offer).toBe(true);
    expect(data.has(keyOn(ids[0], 0, was))).toBe(true);
    tap(() => h.current.swap());
    expect(h.current.puzzleNo).not.toBe(was);
    expect(data.has(keyOn(ids[0], 0, was))).toBe(false);
    expect(data.has(keyOn(ids[0], 0, h.current.puzzleNo))).toBe(false);
    h.unmount();

    const again = play(BUILDER, 0, store, { drafts: storage });
    tap(() => again.current.slip('z'));
    tap(() => again.current.solve());
    const run = runOf(findPlayer(store.getState(), ids[0]), 'builder', 0)!;
    expect(run.solved.at(-1)).toMatchObject({ count: 1 });
  });

  it('restores neither the stuck count nor the offer', () => {
    const { store, ids } = makeStore();
    const { storage } = fakeStorage();
    const first = play(BUILDER, 0, store, { drafts: storage });
    tap(() => first.current.slip('a'));
    tap(() => first.current.slip('b'));
    tap(() => first.current.slip('c'));
    expect(first.current.offer).toBe(true);
    first.unmount();

    const again = play(BUILDER, 0, store, { drafts: storage });
    expect(again.current.offer).toBe(false);
    expect(again.current.shared).toBeNull();
    tap(() => again.current.slip('d'));
    tap(() => again.current.slip('e'));
    expect(again.current.offer).toBe(false);
    tap(() => again.current.solve());
    const run = runOf(findPlayer(store.getState(), ids[0]), 'builder', 0)!;
    expect(run.solved.at(-1)).toMatchObject({ count: 5 });
  });

  it('a draft for another player, level, set, seed or puzzle restores nothing', () => {
    const { store, ids } = makeStore(['Maya', 'Leo']);
    const probe = play(BUILDER, 0, store, { drafts: fakeStorage().storage });
    const on = probe.current.puzzleNo;
    probe.unmount();
    const place = { playerId: ids[0], game: 'builder', level: 0, set: builderSet(1), seed: 0, puzzleNo: on };
    const others = [
      draftKey({ ...place, playerId: ids[1] }),
      draftKey({ ...place, level: 1 }),
      draftKey({ ...place, set: builderSet(2) }),
      draftKey({ ...place, seed: 5 }),
      draftKey({ ...place, puzzleNo: on + 1 }),
      draftKey({ ...place, game: 'mixer' }),
    ];
    for (const other of others) {
      const { storage } = fakeStorage({ [other]: value(3, ['a', 'b', 'c']) });
      const h = play(BUILDER, 0, store, { drafts: storage });
      tap(() => h.current.solve());
      const run = runOf(findPlayer(store.getState(), ids[0]), 'builder', 0)!;
      expect(run.solved.at(-1), other).toMatchObject({ count: 0 });
      h.unmount();
      store.resetPlayerProgress(ids[0]);
    }
  });

  it('a draft from a run that is gone (progress reset) is not restored on the new run, and is removed', () => {
    const { store, ids } = makeStore();
    const { storage, data } = fakeStorage();
    const first = play(BUILDER, 0, store, { drafts: storage });
    const key = keyOn(ids[0], 0, first.current.puzzleNo);
    tap(() => first.current.slip('a'));
    tap(() => first.current.slip('b'));
    expect(data.has(key)).toBe(true);
    first.unmount();
    store.resetPlayerProgress(ids[0]);
    expect(runOf(findPlayer(store.getState(), ids[0]), 'builder', 0)).toBeNull();

    const again = play(BUILDER, 0, store, { drafts: storage });
    expect(keyOn(ids[0], 0, again.current.puzzleNo)).toBe(key);
    expect(data.has(key)).toBe(false);
    tap(() => again.current.solve());
    expect(runOf(findPlayer(store.getState(), ids[0]), 'builder', 0)!.solved.at(-1)).toMatchObject({ count: 0 });
  });

  it('junk JSON or a throwing storage restores nothing and never throws', () => {
    const { store, ids } = makeStore();
    const probe = play(BUILDER, 0, store, { drafts: fakeStorage().storage });
    const key = keyOn(ids[0], 0, probe.current.puzzleNo);
    probe.unmount();

    const { storage } = fakeStorage({ [key]: '{"v":1,"slips":' });
    const junk = play(BUILDER, 0, store, { drafts: storage });
    tap(() => junk.current.slip('a'));
    tap(() => junk.current.solve());
    expect(runOf(findPlayer(store.getState(), ids[0]), 'builder', 0)!.solved.at(-1)).toMatchObject({ count: 1 });
    junk.unmount();
    store.resetPlayerProgress(ids[0]);

    const h = play(BUILDER, 0, store, { drafts: throwing });
    expect(() => {
      tap(() => h.current.slip('a'));
      tap(() => h.current.slip('a'));
      tap(() => h.current.solve());
    }).not.toThrow();
    expect(runOf(findPlayer(store.getState(), ids[0]), 'builder', 0)!.solved.at(-1)).toMatchObject({ count: 1 });
  });

  it('uses window.sessionStorage by default, and keeps nothing when reaching it throws', () => {
    const { store, ids } = makeStore();
    const { storage, data } = fakeStorage();
    vi.stubGlobal('window', { ...win, sessionStorage: storage });
    const h = play(BUILDER, 0, store);
    tap(() => h.current.slip('a'));
    expect(data.get(keyOn(ids[0], 0, h.current.puzzleNo))).toBe(value(1, ['a']));
    h.unmount();

    const blocked = Object.create(win, { sessionStorage: { get: () => { throw new Error('SecurityError'); } } });
    vi.stubGlobal('window', blocked);
    const b = play(BUILDER, 0, store);
    expect(() => tap(() => b.current.slip('b'))).not.toThrow();
    expect(b.current.phase).toBe('play');
  });
});

describe('useLevelRun without keepDraft: nothing read or written', () => {
  it.each([
    ['Picture Builder stand-in without the flag', PLAIN],
    ['Color Mixer', MIXER],
  ])('%s: zero storage calls through slips, a swap, a solve and Next', (_name, game) => {
    const { store } = makeStore();
    const { storage, calls } = fakeStorage();
    vi.stubGlobal('window', { ...win, sessionStorage: storage });
    const h = play(game, 0, store, { drafts: storage });
    tap(() => h.current.slip('a'));
    tap(() => h.current.slip('b'));
    tap(() => h.current.slip('c'));
    tap(() => h.current.swap());
    tap(() => h.current.slip('d'));
    tap(() => h.current.solve());
    tap(() => h.current.next());
    h.unmount();
    play(game, 0, store, { drafts: storage });
    expect(calls).toEqual([]);
  });
});
