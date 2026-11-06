import { describe, expect, it } from 'vitest';
import { ACCOUNTS_ENABLED, PROVIDERS, auth, disabledAuth, localOnlySync, mergeProgress, mergeSnapshot, parseFlag, sync, toSnapshot } from './index';
import { emptyGame, emptyState, makePlayer } from '../progress/model';
import type { Player, ProgressState } from '../progress';

describe('accounts are switched off', () => {
  it('reads the flag as off unless it is exactly true or 1', () => {
    expect(ACCOUNTS_ENABLED).toBe(false);
    for (const v of [undefined, '', 'false', '0', 'yes', 'TRUE ', null]) expect(parseFlag(v)).toBe(false);
    expect(parseFlag('true')).toBe(true);
    expect(parseFlag('1')).toBe(true);
  });

  it('plans email and Google first, Apple and Facebook later', () => {
    const stage = Object.fromEntries(PROVIDERS.map((p) => [p.id, p.stage]));
    expect(stage).toEqual({ email: 'planned-first', google: 'planned-first', apple: 'planned-later', facebook: 'planned-later' });
  });

  it('uses the disabled services', () => {
    expect(auth).toBe(disabledAuth);
    expect(sync).toBe(localOnlySync);
  });

  it('answers every auth call with not-enabled', async () => {
    const off = { ok: false, reason: 'not-enabled' };
    await expect(disabledAuth.signInWithEmail('grown-up@example.com', 'secret')).resolves.toEqual(off);
    await expect(disabledAuth.sendEmailLink('grown-up@example.com')).resolves.toEqual(off);
    await expect(disabledAuth.signInWithGoogle()).resolves.toEqual(off);
    await expect(disabledAuth.signInWithApple()).resolves.toEqual(off);
    await expect(disabledAuth.signInWithFacebook()).resolves.toEqual(off);
    await expect(disabledAuth.signOut()).resolves.toEqual(off);
    await expect(disabledAuth.currentUser()).resolves.toEqual(off);
  });

  it('never calls an onChange listener, and unsubscribing is safe', () => {
    let calls = 0;
    const stop = disabledAuth.onChange(() => calls++);
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
    expect(calls).toBe(0);
  });

  it('keeps sync local: pull finds nothing and push does nothing', async () => {
    await expect(localOnlySync.pull()).resolves.toEqual({ ok: true, value: null });
    await expect(localOnlySync.push(toSnapshot(emptyState(), 1))).resolves.toEqual({ ok: true, value: undefined });
  });
});

/* ---------- merge rule ---------- */

const T = new Date(2026, 10, 4, 12, 0).getTime();

function player(id: string, patch: Partial<Player> = {}): Player {
  return { ...makePlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' }, id, T), ...patch };
}

function state(players: Player[], patch: Partial<ProgressState> = {}): ProgressState {
  return { ...emptyState(), players, activePlayerId: players[0]?.id ?? null, ...patch };
}

describe('merge rule', () => {
  it('keeps the higher stars and best score per level, and the further unlock', () => {
    const local = state([player('a', { games: { escape: { unlocked: 3, stars: { 0: 3, 1: 1, 2: 2 }, best: { 0: 10 } } } })]);
    const remote = state([player('a', { games: { escape: { unlocked: 5, stars: { 0: 2, 1: 3, 4: 1 }, best: { 0: 40 } }, drop: { ...emptyGame(), stars: { 0: 2 }, unlocked: 1 } } })]);
    const merged = mergeProgress(local, remote).players[0];
    expect(merged.games.escape).toEqual({ unlocked: 5, stars: { 0: 3, 1: 3, 2: 2, 4: 1 }, best: { 0: 40 } });
    expect(merged.games.drop.stars).toEqual({ 0: 2 });
  });

  it('takes the union of stickers, keeping the earliest earn time', () => {
    const local = state([player('a', { stickers: { key: { earnedAt: 50, seen: false }, train: { earnedAt: 10, seen: true } } })]);
    const remote = state([player('a', { stickers: { key: { earnedAt: 20, seen: true }, pot: { earnedAt: 30, seen: false } } })]);
    expect(mergeProgress(local, remote).players[0].stickers).toEqual({
      key: { earnedAt: 20, seen: true },
      train: { earnedAt: 10, seen: true },
      pot: { earnedAt: 30, seen: false },
    });
  });

  it('keeps the newest settings, and local ones on a tie', () => {
    const local = state([], { settings: { sound: true, music: true, voice: true, alerts: false }, settingsUpdatedAt: 100 });
    const newer = state([], { settings: { sound: false, music: false, voice: true, alerts: true }, settingsUpdatedAt: 200 });
    expect(mergeProgress(local, newer).settings).toEqual(newer.settings);
    expect(mergeProgress(local, newer).settingsUpdatedAt).toBe(200);
    expect(mergeProgress(newer, local).settings).toEqual(newer.settings);
    const tie = { ...newer, settingsUpdatedAt: 100 };
    expect(mergeProgress(local, tie).settings).toEqual(local.settings);
  });

  it('joins players from both devices and takes the newer profile edit', () => {
    const local = state([player('a', { name: 'Maya', updatedAt: 100 }), player('b', { name: 'Leo' })]);
    const remote = state([player('a', { name: 'Maya Rose', color: 'teal', updatedAt: 300 }), player('c', { name: 'Nia' })]);
    const merged = mergeProgress(local, remote);
    expect(merged.players.map((p) => `${p.id}:${p.name}`)).toEqual(['a:Maya Rose', 'b:Leo', 'c:Nia']);
    expect(merged.players[0].color).toBe('teal');
    expect(merged.activePlayerId).toBe('a');
  });

  it('keeps this device’s active player', () => {
    const local = state([player('a'), player('b')], { activePlayerId: 'b' });
    const remote = state([player('a')], { activePlayerId: 'a' });
    expect(mergeProgress(local, remote).activePlayerId).toBe('b');
    expect(mergeProgress(state([]), remote).activePlayerId).toBe('a');
  });

  it('keeps the later day of play time, and the larger counts on the same day', () => {
    const today = { day: '2026-11-04', minutes: 12, extraMinutes: 0 };
    const local = state([player('a', { today })]);
    const sameDay = state([player('a', { today: { day: '2026-11-04', minutes: 8, extraMinutes: 10 } })]);
    expect(mergeProgress(local, sameDay).players[0].today).toEqual({ day: '2026-11-04', minutes: 12, extraMinutes: 10 });
    const older = state([player('a', { today: { day: '2026-11-03', minutes: 50, extraMinutes: 0 } })]);
    expect(mergeProgress(local, older).players[0].today).toEqual(today);
  });

  it('merges a pulled snapshot after validating it, and ignores none or a newer format', () => {
    const local = state([player('a', { games: { escape: { unlocked: 1, stars: { 0: 1 }, best: {} } } })]);
    expect(mergeSnapshot(local, null, T)).toBe(local);
    const future = { ...toSnapshot(local, T), snapshotVersion: 99 } as unknown as ReturnType<typeof toSnapshot>;
    expect(mergeSnapshot(local, future, T)).toBe(local);
    const junk = { snapshotVersion: 1, takenAt: T, progress: { players: [{ id: 'a', games: { escape: { stars: { 0: 3, 1: 99 } } } }, 'x'] } };
    const merged = mergeSnapshot(local, junk as unknown as ReturnType<typeof toSnapshot>, T);
    expect(merged.players).toHaveLength(1);
    expect(merged.players[0].games.escape.stars).toEqual({ 0: 3 });
  });
});
