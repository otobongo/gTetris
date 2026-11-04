/**
 * Two tabs share one localStorage. The browser fires a 'storage' event in every other tab when
 * one tab writes, and the store reloads on it, so a tab's next write never brings back what
 * another tab removed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProgressStore, type KeyValueStorage } from './store';
import { LEGACY_KEY, STORAGE_KEY } from './types';

const NOON = new Date(2026, 10, 4, 12, 0).getTime();
const maya = { name: 'Maya', ageBand: '7-8' as const, color: 'blue' as const };
const leo = { name: 'Leo', ageBand: '3-4' as const, color: 'orange' as const };

function shared() {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
  return { data, storage };
}

function ids(prefix: string) {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

/** A 'storage' event as the browser sends it to the other tabs. */
function storageEvent(key: string | null, storageArea: unknown) {
  const e = new Event('storage');
  Object.defineProperty(e, 'key', { value: key });
  Object.defineProperty(e, 'storageArea', { value: storageArea });
  return e;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('progress store: another tab changed storage', () => {
  it('a child removed in one tab stays removed after the other tab saves', () => {
    const { storage, data } = shared();
    const tabA = new EventTarget();
    const tabB = new EventTarget();
    const a = createProgressStore({ storage, now: () => NOON, newId: ids('a'), events: tabA });
    const maya1 = a.addPlayer(maya);
    a.addPlayer(leo);
    const b = createProgressStore({ storage, now: () => NOON, newId: ids('b'), events: tabB });
    expect(b.getState().players).toHaveLength(2);

    a.removePlayer(maya1.id);
    tabB.dispatchEvent(storageEvent(STORAGE_KEY, storage));
    b.recordStars('drop', 0, 3);

    const saved = JSON.parse(data.get(STORAGE_KEY)!);
    expect(saved.players.map((p: { name: string }) => p.name)).toEqual(['Leo']);
    expect(b.getState().players.map((p) => p.name)).toEqual(['Leo']);
  });

  it('tells its listeners after a reload from another tab', () => {
    const { storage } = shared();
    const tab = new EventTarget();
    const other = createProgressStore({ storage, now: () => NOON, newId: ids('o') });
    const store = createProgressStore({ storage, now: () => NOON, newId: ids('s'), events: tab });
    let calls = 0;
    store.subscribe(() => calls++);
    other.addPlayer(maya);
    tab.dispatchEvent(storageEvent(STORAGE_KEY, storage));
    expect(calls).toBe(1);
    expect(store.getState().players.map((p) => p.name)).toEqual(['Maya']);
  });

  it('reloads when another tab clears all storage (key is null)', () => {
    const { storage, data } = shared();
    const tab = new EventTarget();
    const store = createProgressStore({ storage, now: () => NOON, newId: ids('s'), events: tab });
    store.addPlayer(maya);
    data.clear();
    tab.dispatchEvent(storageEvent(null, storage));
    expect(store.getState().players).toEqual([]);
  });

  it('ignores events for other keys and for other storage areas', () => {
    const { storage, data } = shared();
    const tab = new EventTarget();
    const store = createProgressStore({ storage, now: () => NOON, newId: ids('s'), events: tab });
    store.addPlayer(maya);
    let calls = 0;
    store.subscribe(() => calls++);
    data.set(STORAGE_KEY, JSON.stringify({ players: [] }));
    tab.dispatchEvent(storageEvent(LEGACY_KEY, storage));
    tab.dispatchEvent(storageEvent('somebody-else', storage));
    tab.dispatchEvent(storageEvent(STORAGE_KEY, { getItem: () => null }));
    expect(calls).toBe(0);
    expect(store.getState().players).toHaveLength(1);
  });

  it('stops listening when told not to, and keeps memory-only stores out of it', () => {
    const { storage } = shared();
    const tab = new EventTarget();
    const add = vi.spyOn(tab, 'addEventListener');
    createProgressStore({ storage, now: () => NOON, newId: ids('s'), events: null });
    createProgressStore({ storage: null, now: () => NOON, newId: ids('m'), events: tab });
    expect(add).not.toHaveBeenCalled();
  });

  it('listens on window by default when there is one', () => {
    const { storage } = shared();
    const win = new EventTarget();
    vi.stubGlobal('window', win);
    const other = createProgressStore({ storage, now: () => NOON, newId: ids('o'), events: null });
    const store = createProgressStore({ storage, now: () => NOON, newId: ids('s') });
    other.addPlayer(leo);
    win.dispatchEvent(storageEvent(STORAGE_KEY, storage));
    expect(store.getState().players.map((p) => p.name)).toEqual(['Leo']);
  });

  it('works without a window at all (tests, server render)', () => {
    vi.stubGlobal('window', undefined);
    expect(() => createProgressStore({ storage: shared().storage, now: () => NOON, newId: ids('s') })).not.toThrow();
  });
});
