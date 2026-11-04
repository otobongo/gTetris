import { describe, expect, it } from 'vitest';
import { createProgressStore, loadState, type KeyValueStorage } from './store';
import {
  activePlayer,
  ageBandOf,
  clampLimit,
  cleanName,
  dayKey,
  gameOf,
  migrateV1,
  playToday,
  sanitize,
  starsFor,
  totalStars,
} from './model';
import { LEGACY_KEY, LIMIT_DEFAULT, LIMIT_MAX, LIMIT_MIN, SCHEMA_VERSION, STORAGE_KEY, type Player, type ProgressState } from './types';

/* ---------- test doubles: storage and the clock are the only outside boundaries ---------- */

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  let writes = 0;
  const storage: KeyValueStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      writes++;
      data.set(k, v);
    },
  };
  return { data, storage, writes: () => writes };
}

/** Reads work, every write fails (a full disk, or Safari private mode). */
function readOnly(initial: Record<string, string>): KeyValueStorage {
  return {
    getItem: (k) => initial[k] ?? null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
}

function ids(prefix = 'id') {
  let n = 0;
  return () => `${prefix}-${++n}`;
}

const NOON = new Date(2026, 10, 4, 12, 0).getTime();
const maya = { name: 'Maya', ageBand: '7-8' as const, color: 'blue' as const };
const leo = { name: 'Leo', ageBand: '3-4' as const, color: 'orange' as const };

/* ---------- load order ---------- */

describe('progress store: which record loads', () => {
  const v1 = JSON.stringify({ stars: { 'slide:0': 3 }, best: {}, settings: { sound: false } });

  it('prefers v2 over v1 when both are there, and leaves v1 alone', () => {
    const v2 = JSON.stringify({ players: [{ id: 'a', name: 'Nia' }], activePlayerId: 'a' });
    const { storage } = memory({ [STORAGE_KEY]: v2, [LEGACY_KEY]: v1 });
    const { state, migrated } = loadState(storage, NOON, () => 'never');
    expect(migrated).toBe(false);
    expect(state.players.map((p) => p.name)).toEqual(['Nia']);
    expect(state.settings.sound).toBe(true);
  });

  it('does not fall back to v1 when the v2 record is unreadable', () => {
    // v2 exists, so this device already moved over; old v1 stars must not come back as a new player
    const { storage } = memory({ [STORAGE_KEY]: '{broken', [LEGACY_KEY]: v1 });
    const { state, migrated } = loadState(storage, NOON, () => 'never');
    expect(migrated).toBe(false);
    expect(state.players).toEqual([]);
  });

  it('starts empty when reading storage throws', () => {
    const blocked: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    };
    expect(loadState(blocked, NOON, () => 'x')).toEqual({ state: sanitize(null, NOON), migrated: false });
  });

  it('still migrates v1 into memory when the v2 write fails', () => {
    const store = createProgressStore({ storage: readOnly({ [LEGACY_KEY]: v1 }), now: () => NOON, newId: ids() });
    const p = activePlayer(store.getState())!;
    expect(p.unnamed).toBe(true);
    expect(starsFor(p, 'escape', 0)).toBe(3);
    expect(store.getState().settings.sound).toBe(false);
  });

  it('writes the record with its schema version, and reads it back exactly', () => {
    const { storage, data } = memory();
    const store = createProgressStore({ storage, now: () => NOON, newId: ids() });
    store.addPlayer(maya);
    store.recordStars('escape', 2, 2);
    store.awardSticker('e1');
    store.addMinutesPlayed(7);
    const saved = JSON.parse(data.get(STORAGE_KEY)!);
    expect(saved.version).toBe(SCHEMA_VERSION);
    const again = createProgressStore({ storage, now: () => NOON, newId: ids('other') });
    expect(again.getState()).toEqual(store.getState());
  });
});

/* ---------- v1 migration details ---------- */

describe('progress store: v1 migration rules', () => {
  it('joins the old slide key and the registry id into one game, keeping the higher stars', () => {
    const s = migrateV1({ stars: { 'slide:0': 1, 'escape:0': 3, 'slide:1': 2 } }, NOON, 'p');
    expect(s.players[0].games).toEqual({ escape: { unlocked: 2, stars: { 0: 3, 1: 2 }, best: {} } });
  });

  it('creates a player for scores alone, with nothing unlocked past level 1', () => {
    const s = migrateV1({ best: { 'drop:3': 240 } }, NOON, 'p');
    expect(s.players).toHaveLength(1);
    expect(s.players[0].games.drop).toEqual({ unlocked: 0, stars: {}, best: { 3: 240 } });
  });

  it('gives the moved-over player the defaults a grown-up can change later', () => {
    const p = migrateV1({ stars: { 'letters:0': 1 } }, NOON, 'p').players[0];
    expect(p).toMatchObject({ id: 'p', name: 'Player 1', unnamed: true, ageBand: '5-6', color: 'blue', dailyLimit: LIMIT_DEFAULT, timerMode: 'auto' });
    expect(p.today).toEqual({ day: dayKey(NOON), minutes: 0, extraMinutes: 0 });
    expect(p.stickers).toEqual({});
  });

  it('takes only boolean sound and voice from v1, and keeps the v2 defaults for the rest', () => {
    const s = migrateV1({ settings: { sound: 'off', voice: false, music: false, alerts: true } }, NOON, 'p');
    expect(s.settings).toEqual({ sound: true, music: true, voice: false, alerts: false });
  });

  it('skips keys without a game or with a level that is not a whole number', () => {
    const s = migrateV1({ stars: { ':2': 3, 'slide:-1': 3, 'slide:1.5': 3, 'slide:two': 3, slide: 3 }, best: { 'drop:0': Number.NaN } }, NOON, 'p');
    expect(s.players).toEqual([]);
  });

  it('returns the empty state for a v1 value of the wrong shape', () => {
    for (const raw of [null, 7, 'text', [], true]) expect(migrateV1(raw, NOON, 'p').players, String(raw)).toEqual([]);
  });
});

/* ---------- repairing what storage holds ---------- */

describe('progress store: repairing a stored record', () => {
  const base = { id: 'a', name: 'Maya', ageBand: '7-8', color: 'teal', dailyLimit: 30, timerMode: 'off' };

  it('keeps a valid active player that is not the first one', () => {
    const s = sanitize({ players: [base, { ...base, id: 'b', name: 'Leo' }], activePlayerId: 'b' }, NOON);
    expect(s.activePlayerId).toBe('b');
  });

  it('chooses nobody when there are no players', () => {
    expect(sanitize({ players: [], activePlayerId: 'a' }, NOON).activePlayerId).toBeNull();
    expect(sanitize({ players: 'lots' }, NOON).players).toEqual([]);
  });

  it('resets bad times: negative or missing stamps', () => {
    const s = sanitize({ players: [{ ...base, createdAt: -5, updatedAt: 'later' }], settingsUpdatedAt: -1 }, NOON);
    expect(s.players[0].createdAt).toBe(NOON);
    expect(s.players[0].updatedAt).toBe(0);
    expect(s.settingsUpdatedAt).toBe(0);
  });

  it('repairs stickers: a bad earn time becomes 0, and only an exact true counts as seen', () => {
    const s = sanitize({ players: [{ ...base, stickers: { e1: { earnedAt: -3, seen: 'yes' }, e2: { earnedAt: 10, seen: true } } }] }, NOON);
    expect(s.players[0].stickers).toEqual({ e1: { earnedAt: 0, seen: false }, e2: { earnedAt: 10, seen: true } });
  });

  it('keeps a valid day of play and zeroes bad counts on it', () => {
    const s = sanitize({ players: [{ ...base, today: { day: '2026-11-04', minutes: -4, extraMinutes: 10 } }] }, NOON);
    expect(s.players[0].today).toEqual({ day: '2026-11-04', minutes: 0, extraMinutes: 10 });
  });

  it('keeps an unlock that is further than the stars, and raises one that is behind them', () => {
    const ahead = sanitize({ players: [{ ...base, games: { escape: { unlocked: 9, stars: { 0: 1 } } } }] }, NOON);
    expect(ahead.players[0].games.escape.unlocked).toBe(9);
    const behind = sanitize({ players: [{ ...base, games: { escape: { unlocked: 1, stars: { 0: 1, 4: 2 } } } }] }, NOON);
    expect(behind.players[0].games.escape.unlocked).toBe(5);
  });

  it('drops a game stored under an empty id and a game that is not an object', () => {
    const s = sanitize({ players: [{ ...base, games: { '': { unlocked: 2 }, drop: 'x' } }] }, NOON);
    expect(Object.keys(s.players[0].games)).toEqual(['drop']);
    expect(s.players[0].games.drop).toEqual({ unlocked: 0, stars: {}, best: {} });
  });

  it('cuts a long name to 24 characters', () => {
    const s = sanitize({ players: [{ ...base, name: 'A'.repeat(40) }] }, NOON);
    expect(s.players[0].name).toHaveLength(24);
  });
});

/* ---------- small rules ---------- */

describe('progress store: small rules', () => {
  it('keeps the daily limit between 10 and 90 minutes, rounding to a whole minute', () => {
    expect(clampLimit(LIMIT_MIN)).toBe(10);
    expect(clampLimit(LIMIT_MAX)).toBe(90);
    expect(clampLimit(9.4)).toBe(10);
    expect(clampLimit(47.6)).toBe(48);
    expect(clampLimit(-20)).toBe(10);
    expect(clampLimit(1000)).toBe(90);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(clampLimit(bad)).toBe(LIMIT_DEFAULT);
  });

  it('puts an age into its band at each edge', () => {
    expect([2, 3, 4, 5, 6, 7, 8, 9, 10, 12].map(ageBandOf)).toEqual(['3-4', '3-4', '3-4', '5-6', '5-6', '7-8', '7-8', '9-10', '9-10', '9-10']);
  });

  it('cleans a first name: spaces, tabs and line breaks collapse, other types give nothing', () => {
    expect(cleanName('  Maya\t\n Rose ')).toBe('Maya Rose');
    for (const bad of [undefined, null, 7, {}, ['Maya']]) expect(cleanName(bad)).toBe('');
  });

  it('uses the local calendar day either side of midnight', () => {
    expect(dayKey(new Date(2026, 10, 4, 23, 59, 59, 999).getTime())).toBe('2026-11-04');
    expect(dayKey(new Date(2026, 10, 5, 0, 0, 0, 0).getTime())).toBe('2026-11-05');
    expect(dayKey(new Date(2028, 1, 29, 12).getTime())).toBe('2028-02-29');
  });

  it('reads the old slide key as Brick Escape, and gives empty progress for a game never played', () => {
    const p = { ...sanitize({ players: [{ id: 'a', games: { escape: { stars: { 3: 2 } } } }] }, NOON).players[0] };
    expect(starsFor(p, 'slide', 3)).toBe(2);
    expect(totalStars(p, 'slide')).toBe(2);
    expect(gameOf(p, 'mixer')).toEqual({ unlocked: 0, stars: {}, best: {} });
    expect(totalStars(null)).toBe(0);
    expect(starsFor(null, 'escape', 0)).toBe(0);
  });

  it('treats a stored day in the future (a clock moved back) as a new day', () => {
    const p = sanitize({ players: [{ id: 'a', today: { day: '2026-11-09', minutes: 80, extraMinutes: 0 } }] }, NOON).players[0];
    expect(playToday(p, NOON)).toEqual({ day: '2026-11-04', minutes: 0, extraMinutes: 0 });
  });
});

/* ---------- the store object ---------- */

describe('progress store: the store object', () => {
  const make = () => {
    const mem = memory();
    const store = createProgressStore({ storage: mem.storage, now: () => NOON, newId: ids() });
    return { store, ...mem };
  };

  it('stops calling a listener once it unsubscribes', () => {
    const { store } = make();
    let calls = 0;
    const stop = store.subscribe(() => calls++);
    store.addPlayer(maya);
    stop();
    store.addPlayer(leo);
    expect(calls).toBe(1);
    expect(() => stop()).not.toThrow();
  });

  it('picks up a change another tab saved, on reload', () => {
    const { store, storage } = make();
    const other = createProgressStore({ storage, now: () => NOON, newId: ids('tab2') });
    other.addPlayer(leo);
    expect(store.getState().players).toEqual([]);
    let calls = 0;
    store.subscribe(() => calls++);
    store.reload();
    expect(store.getState().players.map((p) => p.name)).toEqual(['Leo']);
    expect(calls).toBe(1);
  });

  it('validates a replaced state before keeping it', () => {
    const { store, data } = make();
    const junk = { players: [{ id: 'a', name: 'Nia', games: { escape: { stars: { 0: 3, 1: 9 } } } }, { id: 'a' }], activePlayerId: 'nobody' } as unknown as ProgressState;
    store.replace(junk);
    const s = store.getState();
    expect(s.players).toHaveLength(1);
    expect(s.players[0].games.escape.stars).toEqual({ 0: 3 });
    expect(s.activePlayerId).toBe('a');
    expect(JSON.parse(data.get(STORAGE_KEY)!).players[0].name).toBe('Nia');
  });

  it('makes the first player active again instead of creating one when nobody is picked', () => {
    const { store } = make();
    const a = store.addPlayer(maya);
    store.addPlayer(leo);
    store.setActivePlayer(null);
    expect(store.getState().activePlayerId).toBeNull();
    expect(store.ensureActivePlayer()).toBe(a.id);
    expect(store.getState().players).toHaveLength(2);
  });

  it('records for the player it is told to, not only the active one', () => {
    const { store } = make();
    store.addPlayer(maya);
    const b = store.addPlayer(leo);
    store.recordStars('drop', 0, 2, b.id);
    store.addMinutesPlayed(5, b.id);
    const [first, second] = store.getState().players;
    expect(starsFor(first, 'drop', 0)).toBe(0);
    expect(starsFor(second, 'drop', 0)).toBe(2);
    expect(first.today.minutes).toBe(0);
    expect(second.today.minutes).toBe(5);
  });

  it('changes nothing for a player id that does not exist', () => {
    const { store, writes } = make();
    store.addPlayer(maya);
    const before = store.getState();
    const w = writes();
    store.recordStars('escape', 0, 3, 'ghost');
    store.updatePlayer('ghost', { name: 'Theo' });
    store.removePlayer('ghost');
    store.resetPlayerProgress('ghost');
    store.addExtraMinutes(10, 'ghost');
    expect(store.getState()).toBe(before);
    expect(writes()).toBe(w);
  });

  it('keeps the profile and today’s minutes when progress is reset, so a reset gives no extra play time', () => {
    const { store } = make();
    const p = store.addPlayer({ ...maya, dailyLimit: 30 });
    store.recordStars('escape', 0, 3);
    store.addMinutesPlayed(25);
    store.addExtraMinutes(10);
    store.resetPlayerProgress(p.id);
    const after = store.getState().players[0];
    expect(after.games).toEqual({});
    expect(after).toMatchObject({ name: 'Maya', ageBand: '7-8', dailyLimit: 30 });
    expect(after.today).toEqual({ day: dayKey(NOON), minutes: 25, extraMinutes: 10 });
  });

  it('keeps the active player when someone else is removed', () => {
    const { store } = make();
    const a = store.addPlayer(maya);
    const b = store.addPlayer(leo);
    store.removePlayer(b.id);
    expect(store.getState().activePlayerId).toBe(a.id);
  });

  it('ignores profile values outside the lists, and clears "unnamed" once a grown-up names the player', () => {
    const { store } = make();
    const id = store.ensureActivePlayer();
    store.updatePlayer(id, { ageBand: '11-12', color: 'gold', timerMode: 'turbo' } as unknown as Partial<Player>);
    let p = store.getState().players[0];
    expect(p).toMatchObject({ ageBand: '5-6', color: 'blue', timerMode: 'auto', unnamed: true });
    store.updatePlayer(id, { name: '  Theo ' });
    p = store.getState().players[0];
    expect(p).toMatchObject({ name: 'Theo', unnamed: false });
  });

  it('stores the old slide key under Brick Escape when a game records through the store', () => {
    const { store } = make();
    store.addPlayer(maya);
    store.recordStars('slide', 1, 2);
    store.recordBest('slide', 1, 12);
    store.unlockLevel('slide', 4);
    expect(activePlayer(store.getState())!.games).toEqual({ escape: { unlocked: 4, stars: { 1: 2 }, best: { 1: 12 } } });
  });

  it('still notifies listeners when saving fails', () => {
    const store = createProgressStore({ storage: readOnly({}), now: () => NOON, newId: ids() });
    let calls = 0;
    store.subscribe(() => calls++);
    store.addPlayer(maya);
    store.setSetting('sound', false);
    expect(calls).toBe(2);
    expect(store.getState().settings.sound).toBe(false);
  });

  it('does not stamp or notify for a setting that already has that value', () => {
    const { store } = make();
    let calls = 0;
    store.subscribe(() => calls++);
    const before = store.getState();
    store.setSetting('sound', true);
    expect(store.getState()).toBe(before);
    expect(calls).toBe(0);
  });

  it('marks stickers seen only when there is something new', () => {
    const { store } = make();
    store.addPlayer(maya);
    const before = store.getState();
    store.markStickersSeen();
    expect(store.getState()).toBe(before);
    store.awardSticker('');
    expect(store.getState()).toBe(before);
  });
});

/* ---------- review additions ---------- */

describe('progress store: when loading writes (review)', () => {
  it('never writes while loading a v2 record, even a broken one, so a bad read is not saved over', () => {
    for (const v2 of [JSON.stringify({ players: [{ id: 'a', name: 'Nia' }] }), '{broken', 'null']) {
      const mem = memory({ [STORAGE_KEY]: v2 });
      createProgressStore({ storage: mem.storage, now: () => NOON, newId: ids() });
      expect(mem.writes(), v2).toBe(0);
      expect(mem.data.get(STORAGE_KEY), v2).toBe(v2);
    }
  });

  it('writes once when it moves v1 over, and not at all when there is nothing to load', () => {
    const v1 = memory({ [LEGACY_KEY]: JSON.stringify({ stars: { 'drop:0': 2 } }) });
    createProgressStore({ storage: v1.storage, now: () => NOON, newId: ids() });
    expect(v1.writes()).toBe(1);
    const empty = memory();
    createProgressStore({ storage: empty.storage, now: () => NOON, newId: ids() });
    expect(empty.writes()).toBe(0);
  });

  it('keeps saving when reads are blocked but writes work, and a later healthy load finds the save', () => {
    const data = new Map<string, string>();
    const blockedReads: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: (k, v) => void data.set(k, v),
    };
    const store = createProgressStore({ storage: blockedReads, now: () => NOON, newId: ids() });
    expect(store.getState().players).toEqual([]);
    store.addPlayer(maya);
    const later = createProgressStore({ storage: memory(Object.fromEntries(data)).storage, now: () => NOON, newId: ids('x') });
    expect(later.getState().players.map((p) => p.name)).toEqual(['Maya']);
  });
});

describe('progress store: a new day with extra time (review)', () => {
  it('gives extra time to today only, and drops yesterday’s minutes when it does', () => {
    let t = new Date(2026, 10, 3, 18, 0).getTime();
    const store = createProgressStore({ storage: null, now: () => t, newId: ids() });
    store.addPlayer({ ...maya, dailyLimit: 20 });
    store.addMinutesPlayed(30);
    t = NOON; // the next day
    store.addExtraMinutes(10);
    const p = activePlayer(store.getState())!;
    expect(p.today).toEqual({ day: '2026-11-04', minutes: 0, extraMinutes: 10 });
    expect(playToday(p, NOON)).toEqual({ day: '2026-11-04', minutes: 0, extraMinutes: 10 });
  });
});
