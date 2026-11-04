import { describe, expect, it } from 'vitest';
import { PROVIDERS, disabledAuth, localOnlySync, mergeProgress, mergeSnapshot, parseFlag, toSnapshot, type ProgressSnapshot } from './index';
import { authNotice } from '../../screens/logic/auth';
import { emptyState, makePlayer, sanitize } from '../progress/model';
import { createProgressStore } from '../progress/store';
import { rng } from '../rng';
import type { GameProgress, Player, ProgressState, StickerRecord } from '../progress';

const T = new Date(2026, 10, 4, 12, 0).getTime();

function player(id: string, patch: Partial<Player> = {}): Player {
  return { ...makePlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' }, id, T), ...patch };
}

function state(players: Player[], patch: Partial<ProgressState> = {}): ProgressState {
  return { ...emptyState(), players, activePlayerId: players[0]?.id ?? null, ...patch };
}

/** Deep-freezes a value so any write to it throws (ES modules run in strict mode). */
function freeze<T>(v: T): T {
  if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) freeze((v as Record<string, unknown>)[k]);
    Object.freeze(v);
  }
  return v;
}

/* ---------- random but valid progress, from a seed ---------- */

function randomGame(r: () => number): GameProgress {
  const stars: Record<number, number> = {};
  const best: Record<number, number> = {};
  for (let lv = 0; lv < 8; lv++) {
    if (r() < 0.5) stars[lv] = 1 + Math.floor(r() * 3);
    if (r() < 0.3) best[lv] = Math.floor(r() * 500);
  }
  const top = Math.max(0, ...Object.keys(stars).map((k) => Number(k) + 1));
  return { unlocked: top + (r() < 0.2 ? 3 : 0), stars, best };
}

function randomState(seed: number): ProgressState {
  const r = rng(seed);
  const players: Player[] = [];
  for (const id of ['a', 'b', 'c']) {
    if (r() < 0.35) continue;
    const games: Record<string, GameProgress> = {};
    for (const g of ['escape', 'drop', 'letters']) if (r() < 0.6) games[g] = randomGame(r);
    const stickers: Record<string, StickerRecord> = {};
    for (const s of ['e1', 'e2', 'd1', 'x1']) if (r() < 0.4) stickers[s] = { earnedAt: Math.floor(r() * 1000), seen: r() < 0.5 };
    const day = r() < 0.5 ? '2026-11-04' : '2026-11-03';
    players.push(
      player(id, {
        name: `Kid ${id}${Math.floor(r() * 9)}`,
        updatedAt: Math.floor(r() * 5),
        createdAt: Math.floor(r() * 100),
        games,
        stickers,
        today: { day, minutes: Math.floor(r() * 40), extraMinutes: r() < 0.3 ? 10 : 0 },
      }),
    );
  }
  return state(players, { settingsUpdatedAt: Math.floor(r() * 5), settings: { sound: r() < 0.5, music: r() < 0.5, voice: r() < 0.5, alerts: r() < 0.5 } });
}

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 7919 + 1);
const byId = (s: ProgressState, id: string) => s.players.find((p) => p.id === id);

describe('merge rule: never loses an earned result (60 random pairs)', () => {
  it('keeps every player once, local ones first', () => {
    for (const seed of SEEDS) {
      const local = randomState(seed);
      const remote = randomState(seed + 1);
      const merged = mergeProgress(local, remote);
      const ids = merged.players.map((p) => p.id);
      expect(new Set(ids).size, `seed ${seed}`).toBe(ids.length);
      expect(new Set(ids)).toEqual(new Set([...local.players, ...remote.players].map((p) => p.id)));
      expect(ids.slice(0, local.players.length)).toEqual(local.players.map((p) => p.id));
    }
  });

  it('has the higher stars, best score and unlock of either side for every level', () => {
    for (const seed of SEEDS) {
      const local = randomState(seed);
      const remote = randomState(seed + 1);
      const merged = mergeProgress(local, remote);
      for (const p of merged.players) {
        const l = byId(local, p.id);
        const r = byId(remote, p.id);
        for (const g of new Set([...Object.keys(l?.games ?? {}), ...Object.keys(r?.games ?? {})])) {
          const lg = l?.games[g];
          const rg = r?.games[g];
          const mg = p.games[g];
          expect(mg, `seed ${seed} ${p.id} ${g}`).toBeDefined();
          expect(mg.unlocked).toBe(Math.max(lg?.unlocked ?? 0, rg?.unlocked ?? 0));
          for (let lv = 0; lv < 8; lv++) {
            expect(mg.stars[lv] ?? 0).toBe(Math.max(lg?.stars[lv] ?? 0, rg?.stars[lv] ?? 0));
            expect(mg.best[lv] ?? 0).toBe(Math.max(lg?.best[lv] ?? 0, rg?.best[lv] ?? 0));
          }
        }
      }
    }
  });

  it('keeps every sticker from either side with the earliest earn time', () => {
    for (const seed of SEEDS) {
      const local = randomState(seed);
      const remote = randomState(seed + 1);
      for (const p of mergeProgress(local, remote).players) {
        const l = byId(local, p.id)?.stickers ?? {};
        const r = byId(remote, p.id)?.stickers ?? {};
        expect(new Set(Object.keys(p.stickers))).toEqual(new Set([...Object.keys(l), ...Object.keys(r)]));
        for (const [id, s] of Object.entries(p.stickers)) {
          expect(s.earnedAt).toBe(Math.min(l[id]?.earnedAt ?? Infinity, r[id]?.earnedAt ?? Infinity));
          expect(s.seen).toBe(Boolean(l[id]?.seen || r[id]?.seen));
        }
      }
    }
  });

  it('gives the same progress whichever device merges, and changes nothing when merged again', () => {
    for (const seed of SEEDS) {
      const a = randomState(seed);
      const b = randomState(seed + 1);
      const ab = mergeProgress(a, b);
      const ba = mergeProgress(b, a);
      for (const p of ab.players) {
        const q = byId(ba, p.id)!;
        expect(q.games, `seed ${seed}`).toEqual(p.games);
        expect(q.stickers).toEqual(p.stickers);
        expect(q.today).toEqual(p.today);
        expect(q.createdAt).toBe(p.createdAt);
      }
      expect(mergeProgress(ab, b)).toEqual(ab);
      expect(mergeProgress(a, a)).toEqual(a);
    }
  });
});

describe('merge rule: edges', () => {
  it('keeps the local profile when both edits have the same time', () => {
    const local = state([player('a', { name: 'Maya', color: 'blue', updatedAt: 50 })]);
    const remote = state([player('a', { name: 'Maya Rose', color: 'teal', updatedAt: 50 })]);
    expect(mergeProgress(local, remote).players[0]).toMatchObject({ name: 'Maya', color: 'blue' });
  });

  it('takes the whole newer profile: name, age band, colour, limit and timer together', () => {
    const local = state([player('a', { updatedAt: 1 })]);
    const remote = state([player('a', { name: 'Nia', ageBand: '9-10', color: 'pink', dailyLimit: 45, timerMode: 'off', unnamed: false, updatedAt: 2 })]);
    expect(mergeProgress(local, remote).players[0]).toMatchObject({ name: 'Nia', ageBand: '9-10', color: 'pink', dailyLimit: 45, timerMode: 'off', updatedAt: 2 });
  });

  it('keeps the earliest creation time', () => {
    const local = state([player('a', { createdAt: 900 })]);
    const remote = state([player('a', { createdAt: 300 })]);
    expect(mergeProgress(local, remote).players[0].createdAt).toBe(300);
  });

  it('keeps a game only one device has played', () => {
    const local = state([player('a', { games: { letters: { unlocked: 2, stars: { 0: 1, 1: 1 }, best: {} } } })]);
    const remote = state([player('a', { games: { drop: { unlocked: 1, stars: { 0: 3 }, best: { 0: 900 } } } })]);
    expect(Object.keys(mergeProgress(local, remote).players[0].games).sort()).toEqual(['drop', 'letters']);
  });

  it('keeps a child removed on the other device (no deletion markers yet)', () => {
    const local = state([player('a'), player('b', { name: 'Leo' })]);
    const remote = state([player('a')]);
    expect(mergeProgress(local, remote).players.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('chooses nobody when neither side has a player', () => {
    expect(mergeProgress(state([]), state([])).activePlayerId).toBeNull();
  });

  it('does not change the local state it was given', () => {
    const local = freeze(state([player('a', { games: { escape: { unlocked: 1, stars: { 0: 1 }, best: {} } }, stickers: { e1: { earnedAt: 5, seen: false } } })]));
    const remote = freeze(state([player('a', { games: { escape: { unlocked: 4, stars: { 0: 3, 3: 2 }, best: {} } }, stickers: { e1: { earnedAt: 2, seen: true } } })]));
    expect(() => mergeProgress(local, remote)).not.toThrow();
    expect(() => mergeSnapshot(local, toSnapshot(remote, T), T)).not.toThrow();
    expect(local.players[0].games.escape.stars).toEqual({ 0: 1 });
  });
});

describe('merge rule: a pulled snapshot', () => {
  const local = state([player('a', { name: 'Maya', games: { escape: { unlocked: 2, stars: { 0: 3, 1: 1 }, best: {} } } })]);

  it('keeps all local progress when the snapshot holds nothing usable', () => {
    for (const progress of [null, 'text', 42, [], { players: 'x' }]) {
      const snap = { snapshotVersion: 1, takenAt: T, progress } as unknown as ProgressSnapshot;
      const merged = mergeSnapshot(local, snap, T);
      expect(merged.players, JSON.stringify(progress)).toEqual(local.players);
      expect(merged.activePlayerId).toBe('a');
    }
  });

  it('ignores a snapshot from an older or unknown format', () => {
    for (const v of [0, 2, '1', undefined]) {
      const snap = { ...toSnapshot(state([player('z')]), T), snapshotVersion: v } as unknown as ProgressSnapshot;
      expect(mergeSnapshot(local, snap, T)).toBe(local);
    }
  });

  it('repairs remote players before merging, dating a bad play day with the time given', () => {
    const later = new Date(2026, 10, 6, 9, 0).getTime();
    const snap = { snapshotVersion: 1, takenAt: T, progress: { players: [{ id: 'n', name: 'Nia', today: { day: 'soon', minutes: 999 } }] } } as unknown as ProgressSnapshot;
    const nia = mergeSnapshot(local, snap, later).players.find((p) => p.id === 'n')!;
    expect(nia.today).toEqual({ day: '2026-11-06', minutes: 0, extraMinutes: 0 });
  });

  it('round-trips through toSnapshot without losing anything', () => {
    const snap = toSnapshot(local, T);
    expect(snap).toEqual({ snapshotVersion: 1, takenAt: T, progress: local });
    expect(mergeSnapshot(state([]), snap, T).players).toEqual(local.players);
  });
});

describe('accounts switched off: edges', () => {
  it('reads only the exact strings true and 1, or a real true, as on', () => {
    expect(parseFlag(true)).toBe(true);
    for (const v of [1, 'True', 'TRUE', ' true', 'on', 'enabled', false, 0, {}, []]) expect(parseFlag(v), JSON.stringify(v)).toBe(false);
  });

  it('lists each provider once, email first, with labels that have no dashes', () => {
    expect(PROVIDERS[0].id).toBe('email');
    expect(new Set(PROVIDERS.map((p) => p.id)).size).toBe(PROVIDERS.length);
    for (const p of PROVIDERS) expect(p.label).not.toMatch(/[–—]/);
  });

  it('never returns a user, even for odd input, and never throws', async () => {
    const results = await Promise.all([
      disabledAuth.signInWithEmail('', ''),
      disabledAuth.signInWithEmail('not an email', 'x'.repeat(10_000)),
      disabledAuth.sendEmailLink(''),
      disabledAuth.currentUser(),
    ]);
    for (const r of results) {
      expect(r.ok).toBe(false);
      expect('value' in r).toBe(false);
    }
  });

  it('keeps nothing it is asked to push: a pull afterwards still finds no snapshot', async () => {
    await localOnlySync.push(toSnapshot(state([player('a')]), T));
    await expect(localOnlySync.pull()).resolves.toEqual({ ok: true, value: null });
  });

  it('has a message for every failure, naming the provider where it matters', () => {
    const reasons = ['not-enabled', 'cancelled', 'offline', 'wrong-credentials', 'too-many-tries', 'provider-failed', 'unknown'] as const;
    for (const p of PROVIDERS) {
      for (const r of reasons) {
        const n = authNotice(r, p.id);
        expect(n.title.length, `${r} ${p.id}`).toBeGreaterThan(0);
        expect(n.body.length).toBeGreaterThan(0);
      }
      const name = p.id === 'email' ? 'Email' : p.label.replace('Continue with ', '');
      expect(authNotice('cancelled', p.id).title).toContain(name);
      expect(authNotice('provider-failed', p.id).title).toContain(name);
    }
    expect(authNotice('offline', 'google').tone).toBe('info');
    expect(authNotice('too-many-tries', 'email').body).toContain('[PLACEHOLDER:');
  });
});

describe('merge rule: review additions', () => {
  it('gives a state the store keeps exactly as merged, so nothing changes on save (60 random pairs)', () => {
    for (const seed of SEEDS) {
      const merged = mergeProgress(randomState(seed), randomState(seed + 1));
      expect(sanitize(merged, T), `seed ${seed}`).toEqual(merged);
      const store = createProgressStore({ storage: null, now: () => T, newId: () => 'unused' });
      store.replace(merged);
      expect(store.getState(), `seed ${seed}`).toEqual(merged);
    }
  });

  it('merges a pulled snapshot of the other device exactly like that device’s own state', () => {
    for (const seed of SEEDS) {
      const local = randomState(seed);
      const remote = randomState(seed + 1);
      expect(mergeSnapshot(local, toSnapshot(remote, T), T), `seed ${seed}`).toEqual(mergeProgress(local, remote));
    }
  });

  it('picks the first player when this device’s active choice points at nobody', () => {
    const local = state([player('a'), player('b')], { activePlayerId: 'ghost' });
    expect(mergeProgress(local, state([player('c')])).activePlayerId).toBe('a');
    expect(mergeProgress(state([], { activePlayerId: 'ghost' }), state([player('c')])).activePlayerId).toBe('c');
  });

  it('starts today from the later day only, even when the earlier day has more minutes and extra time', () => {
    const local = state([player('a', { today: { day: '2026-11-03', minutes: 80, extraMinutes: 30 } })]);
    const remote = state([player('a', { today: { day: '2026-11-04', minutes: 2, extraMinutes: 0 } })]);
    expect(mergeProgress(local, remote).players[0].today).toEqual({ day: '2026-11-04', minutes: 2, extraMinutes: 0 });
  });

  it('keeps a sticker seen on either device seen, whichever device earned it first', () => {
    const local = state([player('a', { stickers: { e1: { earnedAt: 9, seen: true } } })]);
    const remote = state([player('a', { stickers: { e1: { earnedAt: 3, seen: false } } })]);
    expect(mergeProgress(local, remote).players[0].stickers.e1).toEqual({ earnedAt: 3, seen: true });
    expect(mergeProgress(remote, local).players[0].stickers.e1).toEqual({ earnedAt: 3, seen: true });
  });
});
