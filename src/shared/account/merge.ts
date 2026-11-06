/**
 * Merge rule for syncing progress between devices. It never loses an earned result:
 * - players: union by id; name, age band, colour, limit and timer come from the newer edit (updatedAt)
 * - per game and level: the higher stars and the higher best score; unlocked is the further one
 * - stickers: union (earliest earn time; seen if seen on either device)
 * - today's play time: the later day wins; on the same day the larger counts win
 * - settings: the newer change (settingsUpdatedAt) wins
 * - the active player stays this device's choice
 * Ties keep the local value. Times in a pulled snapshot are capped at this device's now. Removing a child on one device does not yet remove them on the
 * others; that needs deletion markers once a provider exists (docs/accounts.md).
 */
import { dayKey, sanitize, type GameProgress, type Player, type PlayToday, type ProgressState, type StickerRecord } from '../progress';
import { SNAPSHOT_VERSION, type ProgressSnapshot } from './types';

function maxMap(a: Record<number, number>, b: Record<number, number>): Record<number, number> {
  const out: Record<number, number> = { ...a };
  for (const [k, v] of Object.entries(b)) out[Number(k)] = Math.max(out[Number(k)] ?? 0, v);
  return out;
}

function mergeGame(a: GameProgress | undefined, b: GameProgress | undefined): GameProgress {
  if (!a) return b!;
  if (!b) return a;
  return { unlocked: Math.max(a.unlocked, b.unlocked), stars: maxMap(a.stars, b.stars), best: maxMap(a.best, b.best) };
}

/** A map entry only when the map holds it itself, so a key like 'toString' never finds what Object inherits. */
const own = <T>(map: Record<string, T>, key: string): T | undefined => (Object.hasOwn(map, key) ? map[key] : undefined);

function mergeStickers(a: Record<string, StickerRecord>, b: Record<string, StickerRecord>): Record<string, StickerRecord> {
  const out: Record<string, StickerRecord> = { ...a };
  for (const [id, s] of Object.entries(b)) {
    const mine = own(out, id);
    out[id] = mine ? { earnedAt: Math.min(mine.earnedAt, s.earnedAt), seen: mine.seen || s.seen } : s;
  }
  return out;
}

function mergeToday(a: PlayToday, b: PlayToday): PlayToday {
  if (a.day !== b.day) return a.day > b.day ? a : b;
  return { day: a.day, minutes: Math.max(a.minutes, b.minutes), extraMinutes: Math.max(a.extraMinutes, b.extraMinutes) };
}

function mergePlayer(local: Player, remote: Player): Player {
  const profile = remote.updatedAt > local.updatedAt ? remote : local;
  const games: Record<string, GameProgress> = {};
  for (const id of new Set([...Object.keys(local.games), ...Object.keys(remote.games)])) games[id] = mergeGame(own(local.games, id), own(remote.games, id));
  return {
    ...profile,
    id: local.id,
    createdAt: Math.min(local.createdAt, remote.createdAt),
    games,
    stickers: mergeStickers(local.stickers, remote.stickers),
    today: mergeToday(local.today, remote.today),
  };
}

export function mergeProgress(local: ProgressState, remote: ProgressState): ProgressState {
  const remoteById = new Map(remote.players.map((p) => [p.id, p]));
  const players = local.players.map((p) => (remoteById.has(p.id) ? mergePlayer(p, remoteById.get(p.id)!) : p));
  const localIds = new Set(local.players.map((p) => p.id));
  for (const p of remote.players) if (!localIds.has(p.id)) players.push(p);
  const remoteSettingsNewer = remote.settingsUpdatedAt > local.settingsUpdatedAt;
  const active = players.some((p) => p.id === local.activePlayerId) ? local.activePlayerId : (players[0]?.id ?? null);
  return {
    version: local.version,
    players,
    activePlayerId: active,
    settings: remoteSettingsNewer ? { ...remote.settings } : { ...local.settings },
    settingsUpdatedAt: Math.max(local.settingsUpdatedAt, remote.settingsUpdatedAt),
  };
}

export function toSnapshot(progress: ProgressState, now: number): ProgressSnapshot {
  return { snapshotVersion: SNAPSHOT_VERSION, takenAt: now, progress };
}

/**
 * A device with its clock ahead (or a tampered snapshot) could date its data in the future and win
 * every merge until that date. Pulled times are capped at this device's now, and a play day after
 * today counts as today.
 */
function capAtNow(remote: ProgressState, now: number): ProgressState {
  const cap = (t: number) => Math.min(t, now);
  const today = dayKey(now);
  const players = remote.players.map((p) => {
    const stickers: Record<string, StickerRecord> = {};
    for (const [id, s] of Object.entries(p.stickers)) stickers[id] = { ...s, earnedAt: cap(s.earnedAt) };
    return {
      ...p,
      createdAt: cap(p.createdAt),
      updatedAt: cap(p.updatedAt),
      stickers,
      today: p.today.day > today ? { ...p.today, day: today } : p.today,
    };
  });
  return { ...remote, players, settingsUpdatedAt: cap(remote.settingsUpdatedAt) };
}

/** Merge a pulled snapshot into local progress. Remote data is validated first, like anything read from storage, and its times capped at now. */
export function mergeSnapshot(local: ProgressState, remote: ProgressSnapshot | null, now: number): ProgressState {
  if (!remote || remote.snapshotVersion !== SNAPSHOT_VERSION) return local;
  return mergeProgress(local, capAtNow(sanitize(remote.progress, now), now));
}
