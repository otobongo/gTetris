import { describe, expect, it } from 'vitest';
import { createProgressStore, type KeyValueStorage } from './store';
import { LEGACY_KEY, STORAGE_KEY } from './types';
import { activePlayer, dayKey, isBreakTime, minutesLeft, playToday, starsFor, totalStars, unseenStickers } from './model';
import * as legacy from '../storage';

/* ---------- test doubles: only the true outside boundaries (storage, clock) ---------- */

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: KeyValueStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
  return { data, storage };
}

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error('SecurityError: storage blocked');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

function clock(start: number) {
  let t = start;
  return { now: () => t, set: (ms: number) => (t = ms) };
}

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

const NOV_4_NOON = new Date(2026, 10, 4, 12, 0).getTime();
const maya = { name: 'Maya', ageBand: '7-8' as const, color: 'blue' as const };

/* ---------- loading ---------- */

describe('progress store: loading', () => {
  it('starts empty with default settings when storage has nothing', () => {
    const { storage, data } = memory();
    const store = createProgressStore({ storage, now: () => NOV_4_NOON, newId: ids() });
    const s = store.getState();
    expect(s.players).toEqual([]);
    expect(s.activePlayerId).toBeNull();
    expect(s.settings).toEqual({ sound: true, music: true, voice: true, alerts: false });
    expect(data.has(STORAGE_KEY)).toBe(false); // nothing is written until something changes
  });

  it('falls back to defaults when the stored JSON is corrupt, and overwrites it on the next change', () => {
    const { storage, data } = memory({ [STORAGE_KEY]: '{"players": [ oops' });
    const store = createProgressStore({ storage, now: () => NOV_4_NOON, newId: ids() });
    expect(store.getState().players).toEqual([]);
    store.addPlayer(maya);
    expect(JSON.parse(data.get(STORAGE_KEY)!).players[0].name).toBe('Maya');
  });

  it('falls back to defaults when the stored value is valid JSON of the wrong shape', () => {
    for (const raw of ['null', '42', '"text"', '[]']) {
      const { storage } = memory({ [STORAGE_KEY]: raw });
      const store = createProgressStore({ storage, now: () => NOV_4_NOON, newId: ids() });
      expect(store.getState().players).toEqual([]);
    }
  });

  it('repairs a partly broken record instead of dropping it', () => {
    const broken = {
      players: [
        {
          id: 'a', name: '  Nia   Rose  ', ageBand: '11-12', color: 'gold', dailyLimit: 500, timerMode: 'turbo',
          games: { escape: { unlocked: -3, stars: { 0: 3, 1: 7, x: 2, 2: 1.5 }, best: { 0: 'high' } } },
          stickers: { 'ice-key': { earnedAt: 5, seen: true }, bad: 'nope' },
          today: { day: 'yesterday', minutes: 12 },
        },
        { id: 'a', name: 'Duplicate' },
        { name: 'No id' },
        'not a player',
      ],
      activePlayerId: 'missing',
      settings: { sound: false, music: 'yes' },
    };
    const { storage } = memory({ [STORAGE_KEY]: JSON.stringify(broken) });
    const store = createProgressStore({ storage, now: () => NOV_4_NOON, newId: ids() });
    const s = store.getState();
    expect(s.players).toHaveLength(1);
    const p = s.players[0];
    expect(p.name).toBe('Nia Rose');
    expect(p.ageBand).toBe('5-6');
    expect(p.color).toBe('blue');
    expect(p.dailyLimit).toBe(90);
    expect(p.timerMode).toBe('auto');
    expect(p.games.escape.stars).toEqual({ 0: 3 });
    expect(p.games.escape.best).toEqual({});
    expect(p.games.escape.unlocked).toBe(1); // derived from the 3 stars on level 0
    expect(Object.keys(p.stickers)).toEqual(['ice-key']);
    expect(p.today).toEqual({ day: dayKey(NOV_4_NOON), minutes: 0, extraMinutes: 0 });
    expect(s.activePlayerId).toBe('a');
    expect(s.settings).toEqual({ sound: false, music: true, voice: true, alerts: false });
  });

  it('keeps working in memory when storage throws on every read and write', () => {
    const store = createProgressStore({ storage: throwing, now: () => NOV_4_NOON, newId: ids() });
    expect(store.getState().players).toEqual([]);
    const p = store.addPlayer(maya);
    expect(() => store.recordStars('escape', 0, 3)).not.toThrow();
    expect(starsFor(store.getState().players[0], 'escape', 0)).toBe(3);
    expect(p.name).toBe('Maya');
  });

  it('keeps working with no storage at all', () => {
    const store = createProgressStore({ storage: null, now: () => NOV_4_NOON, newId: ids() });
    store.addPlayer(maya);
    store.setSetting('music', false);
    expect(store.getState().settings.music).toBe(false);
  });
});

/* ---------- migration from v1 ---------- */

describe('progress store: migration from brickwise:v1', () => {
  const v1 = {
    stars: { 'slide:0': 3, 'slide:1': 2, 'drop:0': 1, 'letters:2': 1, 'slide:9': 0, 'slide:x': 3, nonsense: 2, 'drop:4': 9 },
    best: { 'drop:0': 150, 'drop:1': -4 },
    settings: { sound: false, voice: false },
  };

  it('moves v1 stars, scores and settings into a first, unnamed player', () => {
    const { storage, data } = memory({ [LEGACY_KEY]: JSON.stringify(v1) });
    const store = createProgressStore({ storage, now: () => NOV_4_NOON, newId: ids() });
    const s = store.getState();
    expect(s.players).toHaveLength(1);
    const p = activePlayer(s)!;
    expect(p.name).toBe('Player 1');
    expect(p.unnamed).toBe(true);
    expect(p.games.escape.stars).toEqual({ 0: 3, 1: 2 }); // 'slide' is stored under the registry id
    expect(p.games.escape.unlocked).toBe(2);
    expect(p.games.drop.stars).toEqual({ 0: 1 });
    expect(p.games.drop.best).toEqual({ 0: 150 });
    expect(p.games.letters.stars).toEqual({ 2: 1 });
    expect(p.games.letters.unlocked).toBe(3);
    expect(s.settings).toEqual({ sound: false, music: true, voice: false, alerts: false });
    // v2 is written right away; v1 stays in place untouched
    expect(JSON.parse(data.get(STORAGE_KEY)!).players[0].id).toBe(p.id);
    expect(data.get(LEGACY_KEY)).toBe(JSON.stringify(v1));
  });

  it('migrates only once: the next load reads v2', () => {
    const { storage } = memory({ [LEGACY_KEY]: JSON.stringify(v1) });
    const first = createProgressStore({ storage, now: () => NOV_4_NOON, newId: ids() });
    first.updatePlayer(first.getState().players[0].id, { name: 'Maya' });
    const second = createProgressStore({ storage, now: () => NOV_4_NOON, newId: () => 'never-used' });
    expect(second.getState().players.map((p) => p.name)).toEqual(['Maya']);
    expect(second.getState().players[0].unnamed).toBe(false);
  });

  it('creates no player when v1 holds settings only', () => {
    const { storage } = memory({ [LEGACY_KEY]: JSON.stringify({ stars: {}, best: {}, settings: { sound: false, voice: true } }) });
    const store = createProgressStore({ storage, now: () => NOV_4_NOON, newId: ids() });
    expect(store.getState().players).toEqual([]);
    expect(store.getState().settings.sound).toBe(false);
  });

  it('ignores a corrupt v1 record', () => {
    const { storage } = memory({ [LEGACY_KEY]: 'not json' });
    const store = createProgressStore({ storage, now: () => NOV_4_NOON, newId: ids() });
    expect(store.getState().players).toEqual([]);
    expect(store.getState().settings.sound).toBe(true);
  });
});

/* ---------- players, levels, stickers, settings ---------- */

describe('progress store: updates', () => {
  const make = () => {
    const mem = memory();
    const store = createProgressStore({ storage: mem.storage, now: () => NOV_4_NOON, newId: ids() });
    return { store, ...mem };
  };

  it('adds players, makes the first one active, and keeps them after a reload', () => {
    const { store, storage } = make();
    const a = store.addPlayer(maya);
    const b = store.addPlayer({ name: 'Leo', ageBand: '3-4', color: 'orange' });
    expect(store.getState().activePlayerId).toBe(a.id);
    expect(b.timerMode).toBe('relaxed'); // ages 3 to 4 start on the relaxed timer
    expect(b.dailyLimit).toBe(20);
    store.setActivePlayer(b.id);
    const again = createProgressStore({ storage, now: () => NOV_4_NOON, newId: ids() });
    expect(again.getState().players.map((p) => p.name)).toEqual(['Maya', 'Leo']);
    expect(again.getState().activePlayerId).toBe(b.id);
  });

  it('numbers players added without a name, and ignores an unknown active id', () => {
    const { store } = make();
    store.addPlayer({ ...maya, name: '   ' });
    const second = store.addPlayer({ ...maya, name: '' });
    expect(second.name).toBe('Player 2');
    const before = store.getState();
    store.setActivePlayer('nobody');
    expect(store.getState()).toBe(before);
  });

  it('removes a player and moves the active choice to the next one', () => {
    const { store } = make();
    const a = store.addPlayer(maya);
    const b = store.addPlayer({ name: 'Leo', ageBand: '3-4', color: 'orange' });
    store.removePlayer(a.id);
    expect(store.getState().activePlayerId).toBe(b.id);
    store.removePlayer(b.id);
    expect(store.getState().activePlayerId).toBeNull();
  });

  it('keeps the higher stars per level and opens the next level', () => {
    const { store } = make();
    store.addPlayer(maya);
    store.recordStars('escape', 0, 2);
    store.recordStars('escape', 0, 1);
    store.recordStars('escape', 1, 3);
    const p = activePlayer(store.getState())!;
    expect(p.games.escape.stars).toEqual({ 0: 2, 1: 3 });
    expect(p.games.escape.unlocked).toBe(2);
    expect(totalStars(p, 'escape')).toBe(5);
    expect(totalStars(p)).toBe(5);
    store.recordStars('escape', 0, 3);
    expect(starsFor(activePlayer(store.getState()), 'escape', 0)).toBe(3);
  });

  it('ignores star records out of range and notifies nobody when nothing changed', () => {
    const { store } = make();
    store.addPlayer(maya);
    let calls = 0;
    store.subscribe(() => calls++);
    const before = store.getState();
    store.recordStars('escape', -1, 3);
    store.recordStars('escape', 1.5, 3);
    store.recordStars('escape', 0, 0);
    store.recordStars('escape', 0, Number.NaN);
    expect(store.getState()).toBe(before);
    expect(calls).toBe(0);
    store.recordStars('escape', 0, 8); // clamped to 3
    expect(starsFor(activePlayer(store.getState()), 'escape', 0)).toBe(3);
    expect(calls).toBe(1);
  });

  it('does nothing when there is no player to record for', () => {
    const { store } = make();
    const before = store.getState();
    store.recordStars('escape', 0, 3);
    store.recordBest('drop', 0, 100);
    store.awardSticker('ice-key');
    expect(store.getState()).toBe(before);
  });

  it('keeps the higher best score', () => {
    const { store } = make();
    store.addPlayer(maya);
    store.recordBest('drop', 3, 120);
    store.recordBest('drop', 3, 80);
    store.recordBest('drop', 3, -5);
    expect(activePlayer(store.getState())!.games.drop.best).toEqual({ 3: 120 });
  });

  it('opens a level without stars only forward', () => {
    const { store } = make();
    store.addPlayer(maya);
    store.unlockLevel('escape', 13);
    store.unlockLevel('escape', 8);
    expect(activePlayer(store.getState())!.games.escape.unlocked).toBe(13);
  });

  it('records each sticker once and tracks which are new', () => {
    const { store } = make();
    store.addPlayer(maya);
    store.awardSticker('ice-key');
    store.awardSticker('ice-key');
    store.awardSticker('train');
    expect(unseenStickers(activePlayer(store.getState()))).toEqual(['ice-key', 'train']);
    store.markStickersSeen();
    expect(unseenStickers(activePlayer(store.getState()))).toEqual([]);
    expect(Object.keys(activePlayer(store.getState())!.stickers)).toHaveLength(2);
  });

  it('updates a profile within the allowed ranges and stamps the edit time', () => {
    const t = clock(NOV_4_NOON);
    const store = createProgressStore({ storage: null, now: t.now, newId: ids() });
    const p = store.addPlayer(maya);
    t.set(NOV_4_NOON + 1000);
    store.updatePlayer(p.id, { dailyLimit: 3, ageBand: '9-10', color: 'teal', timerMode: 'off', name: '' });
    const after = store.getState().players[0];
    expect(after.dailyLimit).toBe(10);
    expect(after.ageBand).toBe('9-10');
    expect(after.color).toBe('teal');
    expect(after.timerMode).toBe('off');
    expect(after.name).toBe('Maya'); // an empty name is not applied
    expect(after.updatedAt).toBe(NOV_4_NOON + 1000);
  });

  it('resets one child without touching the others', () => {
    const { store } = make();
    const a = store.addPlayer(maya);
    const b = store.addPlayer({ name: 'Leo', ageBand: '3-4', color: 'orange' });
    store.recordStars('escape', 0, 3, a.id);
    store.recordStars('escape', 0, 2, b.id);
    store.awardSticker('ice-key', a.id);
    store.resetPlayerProgress(a.id);
    const s = store.getState();
    expect(s.players[0].games).toEqual({});
    expect(s.players[0].stickers).toEqual({});
    expect(starsFor(s.players[1], 'escape', 0)).toBe(2);
  });

  it('changes a setting and stamps when it changed', () => {
    const t = clock(NOV_4_NOON);
    const store = createProgressStore({ storage: null, now: t.now, newId: ids() });
    t.set(NOV_4_NOON + 500);
    store.setSetting('alerts', true);
    expect(store.getState().settings.alerts).toBe(true);
    expect(store.getState().settingsUpdatedAt).toBe(NOV_4_NOON + 500);
  });

  it('creates an unnamed first player only once when a game needs to save', () => {
    const { store } = make();
    const id = store.ensureActivePlayer();
    expect(store.ensureActivePlayer()).toBe(id);
    expect(store.getState().players).toHaveLength(1);
    expect(store.getState().players[0]).toMatchObject({ name: 'Player 1', unnamed: true });
  });
});

/* ---------- daily play time ---------- */

describe('progress store: minutes played today', () => {
  const late = new Date(2026, 10, 4, 23, 50).getTime();
  const nextMorning = new Date(2026, 10, 5, 0, 5).getTime();

  it('counts minutes against the daily limit plus extra time', () => {
    const t = clock(late);
    const store = createProgressStore({ storage: null, now: t.now, newId: ids() });
    store.addPlayer(maya); // limit 20
    store.addMinutesPlayed(15);
    let p = store.getState().players[0];
    expect(playToday(p, t.now())).toEqual({ day: '2026-11-04', minutes: 15, extraMinutes: 0 });
    expect(minutesLeft(p, t.now())).toBe(5);
    store.addMinutesPlayed(5);
    p = store.getState().players[0];
    expect(isBreakTime(p, t.now())).toBe(true);
    store.addExtraMinutes(10);
    p = store.getState().players[0];
    expect(minutesLeft(p, t.now())).toBe(10);
    expect(isBreakTime(p, t.now())).toBe(false);
  });

  it('starts from zero on a new day key, for reads and for new minutes', () => {
    const t = clock(late);
    const store = createProgressStore({ storage: null, now: t.now, newId: ids() });
    store.addPlayer(maya);
    store.addMinutesPlayed(20);
    store.addExtraMinutes(10);
    t.set(nextMorning);
    const p = store.getState().players[0];
    expect(playToday(p, t.now())).toEqual({ day: '2026-11-05', minutes: 0, extraMinutes: 0 });
    expect(minutesLeft(p, t.now())).toBe(20);
    store.addMinutesPlayed(4);
    expect(store.getState().players[0].today).toEqual({ day: '2026-11-05', minutes: 4, extraMinutes: 0 });
  });

  it('ignores zero, negative and non-number minutes', () => {
    const store = createProgressStore({ storage: null, now: () => late, newId: ids() });
    store.addPlayer(maya);
    const before = store.getState();
    store.addMinutesPlayed(0);
    store.addMinutesPlayed(-3);
    store.addExtraMinutes(Number.NaN);
    expect(store.getState()).toBe(before);
  });

  it('writes the local calendar day as the day key', () => {
    expect(dayKey(new Date(2026, 0, 9, 0, 0).getTime())).toBe('2026-01-09');
    expect(dayKey(new Date(2026, 11, 31, 23, 59).getTime())).toBe('2026-12-31');
  });
});

/* ---------- the v1 wrappers the games still call ---------- */

describe('storage.ts wrappers over the v2 store', () => {
  it('records for the active player under the games’ own keys', () => {
    legacy.recordStars('slide', 4, 2);
    legacy.recordStars('slide', 4, 1);
    legacy.recordBest('drop:2', 90);
    expect(legacy.starsFor('slide', 4)).toBe(2);
    expect(legacy.totalStars('slide')).toBeGreaterThanOrEqual(2);
    const view = legacy.getProgress();
    expect(view.stars['slide:4']).toBe(2);
    expect(view.best['drop:2']).toBe(90);
    expect(legacy.getProgress()).toBe(view); // same object until something changes
    legacy.setSetting('voice', false);
    expect(legacy.getProgress()).not.toBe(view);
    expect(legacy.getProgress().settings.voice).toBe(false);
    legacy.setSetting('voice', true);
  });
});
