import { useSyncExternalStore } from 'react';
import { LEGACY_GAME_IDS, activePlayer, progressStore, starsFor as starsOf, toGameId, totalStars as totalOf, type ProgressState } from './progress';

/**
 * v1 API, kept as thin wrappers over the progress store v2 (src/shared/progress) so the games
 * keep working until they move to it. Everything here reads and writes the active player.
 * Game keys are the games' own ('slide', 'drop', 'letters'); 'slide' is stored as 'escape'.
 * Level ids are the 0-based level index the games already pass.
 */

export interface Progress {
  /** stars earned per level, keyed by `${game}:${levelId}` */
  stars: Record<string, number>;
  /** best score per game key (falling-block stages etc.) */
  best: Record<string, number>;
  settings: { sound: boolean; voice: boolean };
}

const legacyName: Record<string, string> = Object.fromEntries(Object.entries(LEGACY_GAME_IDS).map(([old, id]) => [id, old]));

let cachedFor: ProgressState | null = null;
let cachedView: Progress = { stars: {}, best: {}, settings: { sound: true, voice: true } };

/** v1-shaped view of the active player, rebuilt only when the store changes (stable for useSyncExternalStore). */
export function getProgress(): Progress {
  const state = progressStore.getState();
  if (state === cachedFor) return cachedView;
  const player = activePlayer(state);
  const stars: Record<string, number> = {};
  const best: Record<string, number> = {};
  for (const [id, g] of Object.entries(player?.games ?? {})) {
    const name = legacyName[id] ?? id;
    for (const [level, v] of Object.entries(g.stars)) stars[`${name}:${level}`] = v;
    for (const [level, v] of Object.entries(g.best)) best[`${name}:${level}`] = v;
  }
  cachedFor = state;
  cachedView = { stars, best, settings: { sound: state.settings.sound, voice: state.settings.voice } };
  return cachedView;
}

const level = (levelId: string | number) => Number(levelId);

export function recordStars(game: string, levelId: string | number, stars: number) {
  const id = progressStore.ensureActivePlayer();
  progressStore.recordStars(toGameId(game), level(levelId), stars, id);
}

/** v1 best keys look like 'drop:3' (game and level index). */
export function recordBest(key: string, value: number) {
  const cut = key.lastIndexOf(':');
  const game = cut > 0 ? key.slice(0, cut) : key;
  const lvl = cut > 0 ? level(key.slice(cut + 1)) : 0;
  const id = progressStore.ensureActivePlayer();
  progressStore.recordBest(toGameId(game), lvl, value, id);
}

export function setSetting<K extends keyof Progress['settings']>(k: K, v: Progress['settings'][K]) {
  progressStore.setSetting(k, v);
}

export function starsFor(game: string, levelId: string | number): number {
  return starsOf(activePlayer(progressStore.getState()), game, level(levelId));
}

export function totalStars(game: string): number {
  return totalOf(activePlayer(progressStore.getState()), game);
}

const subscribe = (cb: () => void) => progressStore.subscribe(cb);

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, getProgress, getProgress);
}
