/** Cases from the security review: pulled snapshots dated in the future cannot win every merge. */
import { describe, expect, it } from 'vitest';
import { mergeSnapshot, toSnapshot, type ProgressSnapshot } from './index';
import { dayKey, emptyState, makePlayer } from '../progress/model';
import type { Player, ProgressState } from '../progress';

const NOW = new Date(2026, 10, 4, 12, 0).getTime();
const YEAR = 365 * 24 * 3600 * 1000;
const FUTURE = NOW + 5 * YEAR;

function player(id: string, patch: Partial<Player> = {}): Player {
  return { ...makePlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' }, id, NOW - 1000), ...patch };
}
function state(players: Player[], patch: Partial<ProgressState> = {}): ProgressState {
  return { ...emptyState(), players, activePlayerId: players[0]?.id ?? null, ...patch };
}
const snap = (s: ProgressState): ProgressSnapshot => toSnapshot(s, FUTURE);

describe('merge rule: a pulled snapshot from the future', () => {
  it('caps the remote profile edit time at now, so a later local edit still wins', () => {
    const local = state([player('a', { name: 'Maya', updatedAt: NOW - 10 })]);
    const remote = state([player('a', { name: 'Remote', updatedAt: FUTURE })]);
    const merged = mergeSnapshot(local, snap(remote), NOW);
    expect(merged.players[0].updatedAt).toBeLessThanOrEqual(NOW);
    // the device then edits again a minute later: that edit is newer than anything pulled
    const edited = state([{ ...merged.players[0], name: 'Maya', updatedAt: NOW + 60_000 }]);
    const again = mergeSnapshot(edited, snap(remote), NOW + 60_000);
    expect(again.players[0].name).toBe('Maya');
  });

  it('caps settingsUpdatedAt, created and sticker times at now', () => {
    const local = state([player('a')], { settingsUpdatedAt: NOW - 5 });
    const remote = state([player('a', { createdAt: FUTURE, stickers: { e1: { earnedAt: FUTURE, seen: false } } }), player('b', { updatedAt: FUTURE, createdAt: FUTURE })], {
      settingsUpdatedAt: FUTURE,
      settings: { sound: false, music: true, voice: true, alerts: false },
    });
    const merged = mergeSnapshot(local, snap(remote), NOW);
    expect(merged.settingsUpdatedAt).toBe(NOW);
    expect(merged.settings.sound).toBe(false); // still the newer change, just not dated after now
    for (const p of merged.players) {
      expect(p.updatedAt).toBeLessThanOrEqual(NOW);
      expect(p.createdAt).toBeLessThanOrEqual(NOW);
      for (const s of Object.values(p.stickers)) expect(s.earnedAt).toBeLessThanOrEqual(NOW);
    }
  });

  it('caps a play day after today at today, so today’s local minutes are not thrown away', () => {
    const today = dayKey(NOW);
    const local = state([player('a', { today: { day: today, minutes: 15, extraMinutes: 0 } })]);
    const remote = state([player('a', { today: { day: '2031-01-01', minutes: 3, extraMinutes: 0 } })]);
    const merged = mergeSnapshot(local, snap(remote), NOW);
    expect(merged.players[0].today).toEqual({ day: today, minutes: 15, extraMinutes: 0 });
  });

  it('leaves times at or before now as they are', () => {
    const local = state([player('a', { updatedAt: NOW - 100 })]);
    const remote = state([player('a', { name: 'Nia', updatedAt: NOW - 50, today: { day: dayKey(NOW), minutes: 4, extraMinutes: 5 } })], { settingsUpdatedAt: NOW - 1 });
    const merged = mergeSnapshot(local, toSnapshot(remote, NOW), NOW);
    expect(merged.players[0]).toMatchObject({ name: 'Nia', updatedAt: NOW - 50, today: { day: dayKey(NOW), minutes: 4, extraMinutes: 5 } });
    expect(merged.settingsUpdatedAt).toBe(NOW - 1);
  });
});
