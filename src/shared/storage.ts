import { useCallback, useSyncExternalStore } from 'react';

/** Per-device progress, kept in localStorage. Every access is guarded so private mode never breaks the game. */
const KEY = 'brickwise:v1';

export interface Progress {
  /** stars earned per level, keyed by `${game}:${levelId}` */
  stars: Record<string, number>;
  /** best score per game key (falling-block stages etc.) */
  best: Record<string, number>;
  settings: { sound: boolean; voice: boolean };
}

const empty = (): Progress => ({ stars: {}, best: {}, settings: { sound: true, voice: true } });

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return { ...empty(), ...parsed, settings: { ...empty().settings, ...parsed.settings } };
  } catch {
    return empty();
  }
}

let state: Progress = load();
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: progress lives for this session only */
  }
  listeners.forEach((l) => l());
}

export function getProgress(): Progress {
  return state;
}

export function recordStars(game: string, levelId: string | number, stars: number) {
  const k = `${game}:${levelId}`;
  if ((state.stars[k] ?? 0) >= stars) return;
  state = { ...state, stars: { ...state.stars, [k]: stars } };
  save();
}

export function recordBest(key: string, value: number) {
  if ((state.best[key] ?? 0) >= value) return;
  state = { ...state, best: { ...state.best, [key]: value } };
  save();
}

export function setSetting<K extends keyof Progress['settings']>(k: K, v: Progress['settings'][K]) {
  state = { ...state, settings: { ...state.settings, [k]: v } };
  save();
}

export function starsFor(game: string, levelId: string | number): number {
  return state.stars[`${game}:${levelId}`] ?? 0;
}

export function totalStars(game: string): number {
  return Object.entries(state.stars)
    .filter(([k]) => k.startsWith(`${game}:`))
    .reduce((s, [, v]) => s + v, 0);
}

export function useProgress(): Progress {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);
  return useSyncExternalStore(subscribe, getProgress, getProgress);
}
