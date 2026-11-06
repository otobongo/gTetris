/**
 * Progress store v2: keeps ProgressState in localStorage under 'brickwise:v2'.
 * Every storage access is wrapped, so private mode, a full disk or blocked storage never
 * breaks a game: progress then lives in memory for this session only.
 * On first load, data under the old key 'brickwise:v1' moves into a first player (v1 is left in place).
 * When another tab writes the same key, the browser's 'storage' event makes this store reload, so
 * this tab's next write never brings back a child another tab removed.
 */
import * as m from './model';
import {
  LEGACY_KEY,
  STORAGE_KEY,
  type LevelRun,
  type NewPlayer,
  type Player,
  type PlayerPatch,
  type ProgressState,
  type PuzzleOutcome,
  type PuzzleResult,
  type PuzzleRules,
  type RunInit,
  type SettingKey,
} from './types';

/** The part of the Web Storage API the store uses. Tests pass an in-memory one. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ProgressStoreOptions {
  /** Defaults to window.localStorage; null keeps progress in memory only. */
  storage?: KeyValueStorage | null;
  /** Clock in ms. Defaults to Date.now. */
  now?: () => number;
  /** Id maker for new players. */
  newId?: () => string;
  /**
   * Where 'storage' events from other tabs arrive. Defaults to window when there is one;
   * null does not listen. A store without storage never listens.
   */
  events?: Pick<EventTarget, 'addEventListener'> | null;
}

export interface ProgressStore {
  getState(): ProgressState;
  subscribe(listener: () => void): () => void;
  /** Read storage again (another tab changed it, or a test). */
  reload(): void;

  addPlayer(input: NewPlayer): Player;
  updatePlayer(id: string, patch: PlayerPatch): void;
  removePlayer(id: string): void;
  setActivePlayer(id: string | null): void;
  /** The active player's id; creates an unnamed "Player 1" first when there is none, so a game can always save. */
  ensureActivePlayer(): string;

  recordStars(gameId: string, level: number, stars: number, playerId?: string): void;
  recordBest(gameId: string, level: number, value: number, playerId?: string): void;
  unlockLevel(gameId: string, level: number, playerId?: string): void;
  awardSticker(stickerId: string, playerId?: string): void;
  markStickersSeen(playerId?: string): void;
  addMinutesPlayed(minutes: number, playerId?: string): void;
  addExtraMinutes(minutes: number, playerId?: string): void;
  resetPlayerProgress(playerId: string): void;

  /**
   * Four-puzzle levels (brief 6.2). The store stays game-agnostic: each game passes its set, seed and
   * star rule. Every action reads and writes the active player unless `playerId` is given.
   */
  /** Open a level: the run it continues from (saved when new, or moved to a new set). */
  startRun(gameId: string, level: number, init: RunInit, playerId?: string): LevelRun;
  /** Save a solved puzzle; the fourth finishes the level (stars, best, current) in the same write. */
  recordPuzzle(gameId: string, level: number, result: PuzzleResult, rules: PuzzleRules, playerId?: string): PuzzleOutcome;
  /** Take a different puzzle: queue[0] moves to the end. Null when the level has no run. */
  swapPuzzle(gameId: string, level: number, playerId?: string): LevelRun | null;
  /** Spend one of a Letter Builder level's hints, saved at once. The hints left, or null with no budget. */
  spendHint(gameId: string, level: number, playerId?: string): number | null;
  /** A grown-up picks the level a child plays next (any level below levelCount). */
  pickLevel(gameId: string, level: number, levelCount: number, playerId?: string): void;
  /** Settings "Start <game> over" for one child: that game only; stickers stay. */
  resetGame(gameId: string, playerId?: string): void;

  setSetting(key: SettingKey, value: boolean): void;
  /** Replace the whole state (used after a sync merge). */
  replace(next: ProgressState): void;
  now(): number;
}

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function browserEvents(): Pick<EventTarget, 'addEventListener'> | null {
  try {
    return typeof window !== 'undefined' && window && typeof window.addEventListener === 'function' ? window : null;
  } catch {
    return null;
  }
}

function randomId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readJSON(storage: KeyValueStorage | null, key: string): { found: boolean; value: unknown; ok: boolean } {
  if (!storage) return { found: false, value: null, ok: true };
  try {
    const raw = storage.getItem(key);
    if (raw === null) return { found: false, value: null, ok: true };
    return { found: true, value: JSON.parse(raw), ok: true };
  } catch {
    return { found: true, value: null, ok: false };
  }
}

/** Load order: v2 if present (repaired if partly broken, defaults if unreadable), else migrate v1, else defaults. */
export function loadState(storage: KeyValueStorage | null, now: number, newId: () => string): { state: ProgressState; migrated: boolean } {
  const v2 = readJSON(storage, STORAGE_KEY);
  if (v2.found) return { state: v2.ok ? m.sanitize(v2.value, now) : m.emptyState(), migrated: false };
  const v1 = readJSON(storage, LEGACY_KEY);
  if (v1.found && v1.ok) return { state: m.migrateV1(v1.value, now, newId()), migrated: true };
  return { state: m.emptyState(), migrated: false };
}

export function createProgressStore(options: ProgressStoreOptions = {}): ProgressStore {
  const storage = options.storage === undefined ? browserStorage() : options.storage;
  const now = options.now ?? (() => Date.now());
  const newId = options.newId ?? randomId;
  const listeners = new Set<() => void>();

  let state: ProgressState;
  const first = loadState(storage, now(), newId);
  state = first.state;
  if (first.migrated) persist();

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable or full: progress lives for this session only */
    }
  }

  function commit(next: ProgressState) {
    if (next === state) return;
    state = next;
    persist();
    listeners.forEach((l) => l());
  }

  const target = (playerId?: string) => playerId ?? state.activePlayerId ?? '';

  // Another tab wrote this store's key (or cleared all storage, key null): read it again.
  const events = options.events === undefined ? browserEvents() : options.events;
  if (storage && events) {
    events.addEventListener('storage', (e) => {
      const { key, storageArea } = e as StorageEvent;
      if (key !== null && key !== STORAGE_KEY) return;
      if (storageArea && storageArea !== storage) return;
      store.reload();
    });
  }

  const store: ProgressStore = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    reload() {
      state = loadState(storage, now(), newId).state;
      listeners.forEach((l) => l());
    },

    addPlayer(input) {
      const id = newId();
      commit(m.addPlayer(state, input, id, now()));
      return m.findPlayer(state, id)!;
    },
    updatePlayer: (id, patch) => commit(m.updatePlayer(state, id, patch, now())),
    removePlayer: (id) => commit(m.removePlayer(state, id)),
    setActivePlayer: (id) => commit(m.setActivePlayer(state, id)),
    ensureActivePlayer() {
      if (m.activePlayer(state)) return state.activePlayerId!;
      if (state.players[0]) {
        commit(m.setActivePlayer(state, state.players[0].id));
        return state.players[0].id;
      }
      const id = newId();
      const player = m.makePlayer({ name: m.DEFAULT_PLAYER_NAME, ageBand: '5-6', color: 'blue' }, id, now(), true);
      commit({ ...state, players: [player], activePlayerId: id });
      return id;
    },

    recordStars: (g, level, stars, p) => commit(m.recordStars(state, target(p), g, level, stars)),
    recordBest: (g, level, value, p) => commit(m.recordBest(state, target(p), g, level, value)),
    unlockLevel: (g, level, p) => commit(m.unlockLevel(state, target(p), g, level)),
    awardSticker: (id, p) => commit(m.awardSticker(state, target(p), id, now())),
    markStickersSeen: (p) => commit(m.markStickersSeen(state, target(p))),
    addMinutesPlayed: (min, p) => commit(m.addMinutesPlayed(state, target(p), min, now())),
    addExtraMinutes: (min, p) => commit(m.addExtraMinutes(state, target(p), min, now())),
    resetPlayerProgress: (id) => commit(m.resetPlayerProgress(state, id)),

    startRun(g, level, init, p) {
      const out = m.startRun(state, target(p), g, level, init, now());
      commit(out.state);
      return out.run;
    },
    recordPuzzle(g, level, result, rules, p) {
      const out = m.recordPuzzle(state, target(p), g, level, result, rules, now());
      commit(out.state);
      return out.outcome;
    },
    swapPuzzle(g, level, p) {
      const out = m.swapPuzzle(state, target(p), g, level, now());
      commit(out.state);
      return out.run;
    },
    spendHint(g, level, p) {
      const out = m.spendHint(state, target(p), g, level, now());
      commit(out.state);
      return out.hintsLeft;
    },
    pickLevel: (g, level, count, p) => commit(m.pickLevel(state, target(p), g, level, count)),
    resetGame: (g, p) => commit(m.resetGame(state, target(p), g)),

    setSetting: (key, value) => commit(m.setSetting(state, key, value, now())),
    replace: (next) => commit(m.sanitize(next, now())),
    now,
  };
  return store;
}

/** The app's one store. */
export const progressStore: ProgressStore = createProgressStore();
