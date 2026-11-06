/**
 * Progress store v2, pure part: defaults, validation of whatever is in storage, the v1
 * migration, updates and read helpers. Nothing here touches storage or the clock; the
 * store passes `now` (ms) and new ids in, so every rule can be tested directly.
 */
import {
  AGE_BANDS,
  AVATAR_COLORS,
  HINTS_PER_RUN,
  LIMIT_DEFAULT,
  LIMIT_MAX,
  LIMIT_MIN,
  MAX_LEVEL_INDEX,
  MAX_SET_LENGTH,
  PUZZLES_PER_LEVEL,
  SCHEMA_VERSION,
  SOLVES_PER_LEVEL,
  TIMER_MODES,
  type AgeBand,
  type AvatarColor,
  type GameProgress,
  type LevelRun,
  type NewPlayer,
  type PlayToday,
  type Player,
  type PlayerPatch,
  type ProgressState,
  type PuzzleOutcome,
  type PuzzleResult,
  type PuzzleRules,
  type RunInit,
  type SettingKey,
  type Settings,
  type StickerRecord,
  type TimerMode,
} from './types';

/* ---------- Ids and days ---------- */

/** Old game keys used by the games' code before the registry ids existed. */
export const LEGACY_GAME_IDS: Record<string, string> = { slide: 'escape' };

/** Registry id for a game key the games' code uses ('slide' becomes 'escape'). */
export function toGameId(game: string): string {
  // Own keys only: 'constructor' or '__proto__' must not resolve to something Object inherits.
  return Object.hasOwn(LEGACY_GAME_IDS, game) ? LEGACY_GAME_IDS[game] : game;
}

/** Local calendar day for a timestamp, 'YYYY-MM-DD'. The daily play count resets when this changes. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function ageBandOf(age: number): AgeBand {
  return age <= 4 ? '3-4' : age <= 6 ? '5-6' : age <= 8 ? '7-8' : '9-10';
}

/* ---------- Defaults ---------- */

export const DEFAULT_SETTINGS: Settings = { sound: true, music: true, voice: true, alerts: false };

/** Name given to a player the app creates itself (the Who's playing board uses the same fallback). */
export const DEFAULT_PLAYER_NAME = 'Player 1';

export function emptyState(): ProgressState {
  return { version: SCHEMA_VERSION, players: [], activePlayerId: null, settings: { ...DEFAULT_SETTINGS }, settingsUpdatedAt: 0 };
}

export function emptyGame(): GameProgress {
  return { unlocked: 0, stars: {}, best: {} };
}

/** The Settings board starts ages 3 to 4 on the relaxed timer and everyone else on auto. */
export function defaultTimerMode(band: AgeBand): TimerMode {
  return band === '3-4' ? 'relaxed' : 'auto';
}

export function clampLimit(minutes: number): number {
  if (!Number.isFinite(minutes)) return LIMIT_DEFAULT;
  return Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, Math.round(minutes)));
}

export function makePlayer(input: NewPlayer, id: string, now: number, unnamed = false): Player {
  return {
    id,
    name: cleanName(input.name) || DEFAULT_PLAYER_NAME,
    ageBand: input.ageBand,
    color: input.color,
    dailyLimit: clampLimit(input.dailyLimit ?? LIMIT_DEFAULT),
    timerMode: input.timerMode ?? defaultTimerMode(input.ageBand),
    unnamed,
    createdAt: now,
    updatedAt: now,
    games: {},
    stickers: {},
    today: { day: dayKey(now), minutes: 0, extraMinutes: 0 },
  };
}

/** First names only: trimmed, single spaces, at most 24 characters. */
export function cleanName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.replace(/\s+/g, ' ').trim().slice(0, 24);
}

/* ---------- Validation: anything read from storage goes through here ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;
const time = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);

/** Keys that would reach an object's prototype chain if copied from parsed JSON. Never copied. */
const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);
/** A key from parsed JSON that is safe to copy into a plain map: not empty and not a prototype key. */
export const isSafeKey = (k: string): boolean => k !== '' && !UNSAFE_KEYS.has(k);

/** A level key: plain ASCII digits only (no '', spaces, signs, exponents or hex), as a safe integer. */
export function parseLevelKey(k: string): number | null {
  if (!/^\d+$/.test(k)) return null;
  const n = Number(k);
  return Number.isSafeInteger(n) ? n : null;
}

function cleanLevelMap(raw: unknown, valid: (n: number) => boolean): Record<number, number> {
  const out: Record<number, number> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const level = parseLevelKey(k);
    if (level !== null && typeof v === 'number' && valid(v)) out[level] = v;
  }
  return out;
}

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isPuzzleNo = (v: unknown): v is number => isInt(v) && v >= 0 && v < PUZZLES_PER_LEVEL;
const isHints = (v: unknown): v is number => isInt(v) && v >= 0 && v <= HINTS_PER_RUN;
/** A puzzle set id: 1 to 64 characters. */
export const isSetId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_SET_LENGTH;
const isSeed = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
/** A built word: 1 to 16 letters A to Z (either case, as the word lists store them). */
const WORD = /^[A-Za-z]{1,16}$/;

/** One stored puzzle result, or null when any field breaks the rules (6.2). Unknown fields are dropped. */
export function cleanResult(raw: unknown): PuzzleResult | null {
  if (!isObj(raw) || !isPuzzleNo(raw.puzzle) || !isCount(raw.count)) return null;
  if (typeof raw.usedHint !== 'boolean' || typeof raw.outOfTime !== 'boolean') return null;
  const out: PuzzleResult = { puzzle: raw.puzzle, count: raw.count, usedHint: raw.usedHint, outOfTime: raw.outOfTime };
  for (const k of ['par', 'three', 'two', 'score'] as const) {
    if (raw[k] === undefined) continue;
    if (!isCount(raw[k])) return null;
    out[k] = raw[k] as number;
  }
  if (raw.word !== undefined) {
    if (typeof raw.word !== 'string' || !WORD.test(raw.word)) return null;
    out.word = raw.word;
  }
  return out;
}

/**
 * One stored level run, or null when it breaks any rule (6.2): queue and solved together hold each
 * puzzle 0 to 5 exactly once, solved holds 0 to 3 results, so the queue is never empty.
 */
export function cleanRun(raw: unknown): LevelRun | null {
  if (!isObj(raw) || !isSetId(raw.set) || !isSeed(raw.seed)) return null;
  if (!Array.isArray(raw.queue) || !Array.isArray(raw.solved)) return null;
  // Lengths first, so an oversized list from storage is never walked.
  if (raw.queue.length > PUZZLES_PER_LEVEL || raw.solved.length > PUZZLES_PER_LEVEL) return null;
  if (raw.solved.length >= SOLVES_PER_LEVEL) return null;
  const solved: PuzzleResult[] = [];
  for (const r of raw.solved) {
    const clean = cleanResult(r);
    if (!clean) return null;
    solved.push(clean);
  }
  const queue: number[] = [];
  for (const n of raw.queue) {
    if (!isPuzzleNo(n)) return null;
    queue.push(n);
  }
  const seen = new Set<number>([...queue, ...solved.map((r) => r.puzzle)]);
  if (seen.size !== PUZZLES_PER_LEVEL || queue.length + solved.length !== PUZZLES_PER_LEVEL) return null;
  if (raw.hintsLeft !== undefined && !isHints(raw.hintsLeft)) return null;
  const run: LevelRun = { set: raw.set, seed: raw.seed as number, queue, solved, updatedAt: time(raw.updatedAt, 0) };
  if (raw.hintsLeft !== undefined) run.hintsLeft = raw.hintsLeft as number;
  return run;
}

function cleanRuns(raw: unknown): Record<number, LevelRun> {
  const out: Record<number, LevelRun> = {};
  if (!isObj(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const level = parseLevelKey(k);
    // A key past the highest level index is never a real level: skip it before reading its run.
    if (level === null || level > MAX_LEVEL_INDEX) continue;
    const run = cleanRun(v);
    if (run) out[level] = run;
  }
  return out;
}

const isLevelIndex = (v: unknown): v is number => isInt(v) && v >= 0 && v <= MAX_LEVEL_INDEX;

function cleanGame(raw: unknown): GameProgress {
  if (!isObj(raw)) return emptyGame();
  const stars = cleanLevelMap(raw.stars, (v) => isInt(v) && v >= 1 && v <= 3);
  const best = cleanLevelMap(raw.best, (v) => Number.isFinite(v) && v >= 0);
  const unlocked = isInt(raw.unlocked) && raw.unlocked >= 0 ? raw.unlocked : 0;
  const game: GameProgress = { unlocked: Math.max(unlocked, unlockedFromStars(stars)), stars, best };
  if (isLevelIndex(raw.current)) game.current = raw.current;
  const runs = cleanRuns(raw.runs);
  if (Object.keys(runs).length > 0) game.runs = runs;
  return game;
}

function cleanStickers(raw: unknown): Record<string, StickerRecord> {
  const out: Record<string, StickerRecord> = {};
  if (!isObj(raw)) return out;
  for (const [id, v] of Object.entries(raw)) {
    if (!isSafeKey(id) || !isObj(v)) continue;
    out[id] = { earnedAt: time(v.earnedAt, 0), seen: v.seen === true };
  }
  return out;
}

function cleanToday(raw: unknown, now: number): PlayToday {
  const fresh = { day: dayKey(now), minutes: 0, extraMinutes: 0 };
  if (!isObj(raw) || typeof raw.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.day)) return fresh;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return { day: raw.day, minutes: n(raw.minutes), extraMinutes: n(raw.extraMinutes) };
}

function cleanPlayer(raw: unknown, now: number): Player | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id) return null;
  const ageBand = oneOf(AGE_BANDS, raw.ageBand, '5-6');
  const games: Record<string, GameProgress> = {};
  if (isObj(raw.games)) for (const [g, v] of Object.entries(raw.games)) if (isSafeKey(g)) games[g] = cleanGame(v);
  return {
    id: raw.id,
    name: cleanName(raw.name) || DEFAULT_PLAYER_NAME,
    ageBand,
    color: oneOf<AvatarColor>(AVATAR_COLORS, raw.color, 'blue'),
    dailyLimit: clampLimit(typeof raw.dailyLimit === 'number' ? raw.dailyLimit : LIMIT_DEFAULT),
    timerMode: oneOf(TIMER_MODES, raw.timerMode, defaultTimerMode(ageBand)),
    unnamed: raw.unnamed === true,
    createdAt: time(raw.createdAt, now),
    updatedAt: time(raw.updatedAt, 0),
    games,
    stickers: cleanStickers(raw.stickers),
    today: cleanToday(raw.today, now),
  };
}

function cleanSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (!isObj(raw)) return s;
  for (const k of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) if (typeof raw[k] === 'boolean') s[k] = raw[k] as boolean;
  return s;
}

/** Turn whatever was parsed from storage into a valid state. Broken parts fall back to defaults. */
export function sanitize(raw: unknown, now: number): ProgressState {
  if (!isObj(raw)) return emptyState();
  const seen = new Set<string>();
  const players: Player[] = [];
  if (Array.isArray(raw.players)) {
    for (const p of raw.players) {
      const clean = cleanPlayer(p, now);
      if (clean && !seen.has(clean.id)) {
        seen.add(clean.id);
        players.push(clean);
      }
    }
  }
  const active = typeof raw.activePlayerId === 'string' && seen.has(raw.activePlayerId) ? raw.activePlayerId : (players[0]?.id ?? null);
  return {
    version: SCHEMA_VERSION,
    players,
    activePlayerId: active,
    settings: cleanSettings(raw.settings),
    settingsUpdatedAt: time(raw.settingsUpdatedAt, 0),
  };
}

/* ---------- Migration from brickwise:v1 ---------- */

/**
 * v1 kept one device-wide record: { stars: { 'slide:3': 2 }, best: { 'drop:3': 120 }, settings: { sound, voice } }.
 * Its stars and scores move into a first player; its settings become the family settings.
 */
export function migrateV1(raw: unknown, now: number, playerId: string): ProgressState {
  const state = emptyState();
  if (!isObj(raw)) return state;
  if (isObj(raw.settings)) {
    if (typeof raw.settings.sound === 'boolean') state.settings.sound = raw.settings.sound;
    if (typeof raw.settings.voice === 'boolean') state.settings.voice = raw.settings.voice;
  }
  const games: Record<string, GameProgress> = {};
  const put = (key: string, value: unknown, field: 'stars' | 'best') => {
    const cut = key.lastIndexOf(':');
    if (cut <= 0) return;
    const game = toGameId(key.slice(0, cut));
    const level = parseLevelKey(key.slice(cut + 1));
    if (!isSafeKey(game) || level === null || typeof value !== 'number' || !Number.isFinite(value)) return;
    if (field === 'stars' && !(isInt(value) && value >= 1 && value <= 3)) return;
    if (field === 'best' && value < 0) return;
    // own entries only: a game named 'toString' must not pick up what Object inherits
    const g = Object.hasOwn(games, game) ? games[game] : (games[game] = emptyGame());
    g[field][level] = Math.max(g[field][level] ?? 0, value);
  };
  if (isObj(raw.stars)) for (const [k, v] of Object.entries(raw.stars)) put(k, v, 'stars');
  if (isObj(raw.best)) for (const [k, v] of Object.entries(raw.best)) put(k, v, 'best');
  if (Object.keys(games).length === 0) return state;
  for (const g of Object.values(games)) g.unlocked = unlockedFromStars(g.stars);
  const player = makePlayer({ name: DEFAULT_PLAYER_NAME, ageBand: '5-6', color: 'blue' }, playerId, now, true);
  player.games = games;
  state.players = [player];
  state.activePlayerId = player.id;
  return state;
}

/** Linear unlock rule: a level opens once the one before it has at least 1 star. */
export function unlockedFromStars(stars: Record<number, number>): number {
  let top = 0;
  for (const [k, v] of Object.entries(stars)) if (v >= 1) top = Math.max(top, Number(k) + 1);
  return top;
}

/* ---------- Read helpers ---------- */

export function findPlayer(state: ProgressState, id: string | null | undefined): Player | null {
  if (!id) return null;
  return state.players.find((p) => p.id === id) ?? null;
}

export function activePlayer(state: ProgressState): Player | null {
  return findPlayer(state, state.activePlayerId);
}

export function gameOf(player: Player | null, gameId: string): GameProgress {
  return player?.games[toGameId(gameId)] ?? emptyGame();
}

/** The stored run for a level, or null when that level has none (not started, or finished). */
export function runOf(player: Player | null, gameId: string, level: number): LevelRun | null {
  const runs = gameOf(player, gameId).runs;
  return runs && Object.hasOwn(runs, level) ? runs[level] : null;
}

/** Puzzles solved so far in a level's run (0 to 3); 0 when there is no run. */
export function solvedCount(player: Player | null, gameId: string, level: number): number {
  return runOf(player, gameId, level)?.solved.length ?? 0;
}

export function starsFor(player: Player | null, gameId: string, level: number): number {
  return gameOf(player, gameId).stars[level] ?? 0;
}

/** Stars for one game, or for every game when gameId is left out. */
export function totalStars(player: Player | null, gameId?: string): number {
  if (!player) return 0;
  const games = gameId ? [gameOf(player, gameId)] : Object.values(player.games);
  return games.reduce((sum, g) => sum + Object.values(g.stars).reduce((s, v) => s + v, 0), 0);
}

/** Today's play count, already reset to zero when the stored day is not today. */
export function playToday(player: Player, now: number): PlayToday {
  const day = dayKey(now);
  return player.today.day === day ? player.today : { day, minutes: 0, extraMinutes: 0 };
}

export function minutesLeft(player: Player, now: number): number {
  const t = playToday(player, now);
  return Math.max(0, player.dailyLimit + t.extraMinutes - t.minutes);
}

export function isBreakTime(player: Player, now: number): boolean {
  return minutesLeft(player, now) <= 0;
}

export function stickerCount(player: Player | null): number {
  return player ? Object.keys(player.stickers).length : 0;
}

export function unseenStickers(player: Player | null): string[] {
  return player ? Object.entries(player.stickers).filter(([, s]) => !s.seen).map(([id]) => id) : [];
}

/* ---------- Updates: each returns a new state, or the same object when nothing changed ---------- */

function withPlayer(state: ProgressState, id: string | null, fn: (p: Player) => Player | null): ProgressState {
  const i = state.players.findIndex((p) => p.id === id);
  if (i < 0) return state;
  const next = fn(state.players[i]);
  if (!next || next === state.players[i]) return state;
  const players = state.players.slice();
  players[i] = next;
  return { ...state, players };
}

function withGame(player: Player, gameId: string, fn: (g: GameProgress) => GameProgress | null): Player | null {
  const id = toGameId(gameId);
  const g = fn(player.games[id] ?? emptyGame());
  return g ? { ...player, games: { ...player.games, [id]: g } } : null;
}

export function addPlayer(state: ProgressState, input: NewPlayer, id: string, now: number): ProgressState {
  const name = cleanName(input.name) || `Player ${state.players.length + 1}`;
  const player = makePlayer({ ...input, name }, id, now);
  return { ...state, players: [...state.players, player], activePlayerId: state.activePlayerId ?? player.id };
}

/** Apply a profile edit. An edit that changes nothing (after cleaning and clamping) returns the same state, updatedAt untouched. */
export function updatePlayer(state: ProgressState, id: string, patch: PlayerPatch, now: number): ProgressState {
  return withPlayer(state, id, (p) => {
    const next: Player = { ...p };
    if (patch.name !== undefined) {
      const name = cleanName(patch.name);
      if (name) {
        next.name = name;
        next.unnamed = false;
      }
    }
    if (patch.ageBand && (AGE_BANDS as readonly string[]).includes(patch.ageBand)) next.ageBand = patch.ageBand;
    if (patch.color && (AVATAR_COLORS as readonly string[]).includes(patch.color)) next.color = patch.color;
    if (patch.dailyLimit !== undefined) next.dailyLimit = clampLimit(patch.dailyLimit);
    if (patch.timerMode && (TIMER_MODES as readonly string[]).includes(patch.timerMode)) next.timerMode = patch.timerMode;
    const changed =
      next.name !== p.name ||
      next.unnamed !== p.unnamed ||
      next.ageBand !== p.ageBand ||
      next.color !== p.color ||
      next.dailyLimit !== p.dailyLimit ||
      next.timerMode !== p.timerMode;
    return changed ? { ...next, updatedAt: now } : null;
  });
}

export function removePlayer(state: ProgressState, id: string): ProgressState {
  if (!findPlayer(state, id)) return state;
  const players = state.players.filter((p) => p.id !== id);
  const activePlayerId = state.activePlayerId === id ? (players[0]?.id ?? null) : state.activePlayerId;
  return { ...state, players, activePlayerId };
}

export function setActivePlayer(state: ProgressState, id: string | null): ProgressState {
  if (id !== null && !findPlayer(state, id)) return state;
  return state.activePlayerId === id ? state : { ...state, activePlayerId: id };
}

/** Keep the higher star count, and open the next level once a level has a star. */
export function recordStars(state: ProgressState, playerId: string, gameId: string, level: number, stars: number): ProgressState {
  if (!isInt(level) || level < 0 || !Number.isFinite(stars)) return state;
  const s = Math.min(3, Math.max(0, Math.round(stars)));
  if (s < 1) return state;
  return withPlayer(state, playerId, (p) =>
    withGame(p, gameId, (g) => {
      const had = g.stars[level] ?? 0;
      const unlocked = Math.max(g.unlocked, level + 1);
      if (had >= s && unlocked === g.unlocked) return null;
      return { ...g, unlocked, stars: { ...g.stars, [level]: Math.max(had, s) } };
    }),
  );
}

/** Keep the higher score. */
export function recordBest(state: ProgressState, playerId: string, gameId: string, level: number, value: number): ProgressState {
  if (!isInt(level) || level < 0 || !Number.isFinite(value) || value < 0) return state;
  return withPlayer(state, playerId, (p) =>
    withGame(p, gameId, (g) => ((g.best[level] ?? 0) >= value ? null : { ...g, best: { ...g.best, [level]: value } })),
  );
}

/** Open a level without stars (ages 9 to 10 start every chapter's first level open). */
export function unlockLevel(state: ProgressState, playerId: string, gameId: string, level: number): ProgressState {
  if (!isInt(level) || level < 0) return state;
  return withPlayer(state, playerId, (p) => withGame(p, gameId, (g) => (g.unlocked >= level ? null : { ...g, unlocked: level })));
}

export function awardSticker(state: ProgressState, playerId: string, stickerId: string, now: number): ProgressState {
  if (!stickerId) return state;
  return withPlayer(state, playerId, (p) =>
    p.stickers[stickerId] ? null : { ...p, stickers: { ...p.stickers, [stickerId]: { earnedAt: now, seen: false } } },
  );
}

export function markStickersSeen(state: ProgressState, playerId: string): ProgressState {
  return withPlayer(state, playerId, (p) => {
    if (unseenStickers(p).length === 0) return null;
    const stickers: Record<string, StickerRecord> = {};
    for (const [id, s] of Object.entries(p.stickers)) stickers[id] = { ...s, seen: true };
    return { ...p, stickers };
  });
}

/** Add minutes played; a new day starts the count again from zero. */
export function addMinutesPlayed(state: ProgressState, playerId: string, minutes: number, now: number): ProgressState {
  if (!Number.isFinite(minutes) || minutes <= 0) return state;
  return withPlayer(state, playerId, (p) => {
    const t = playToday(p, now);
    return { ...p, today: { ...t, minutes: t.minutes + minutes } };
  });
}

/** A grown-up adds time for today from the break screen. */
export function addExtraMinutes(state: ProgressState, playerId: string, minutes: number, now: number): ProgressState {
  if (!Number.isFinite(minutes) || minutes <= 0) return state;
  return withPlayer(state, playerId, (p) => {
    const t = playToday(p, now);
    return { ...p, today: { ...t, extraMinutes: t.extraMinutes + minutes } };
  });
}

export function setSetting(state: ProgressState, key: SettingKey, value: boolean, now: number): ProgressState {
  if (!(key in DEFAULT_SETTINGS) || state.settings[key] === value) return state;
  return { ...state, settings: { ...state.settings, [key]: value }, settingsUpdatedAt: now };
}

/* ---------- Level runs (brief 6.2): four solved puzzles finish a level ---------- */

/** A new run: every puzzle in order, none solved. */
export function freshRun(init: RunInit, now: number): LevelRun {
  const run: LevelRun = {
    set: init.set,
    seed: isSeed(init.seed) ? init.seed : 0,
    queue: Array.from({ length: PUZZLES_PER_LEVEL }, (_, i) => i),
    solved: [],
    updatedAt: now,
  };
  if (init.hintsLeft !== undefined) run.hintsLeft = isHints(init.hintsLeft) ? init.hintsLeft : HINTS_PER_RUN;
  return run;
}

const isBand = (v: string): boolean => (AGE_BANDS as readonly string[]).includes(v);

/**
 * True when two set ids differ in their age band part alone ('numbers:1:5-6' and 'numbers:1:7-8'):
 * the same game and version, both ending in an age band, and the bands differ. A different version
 * part ('numbers:1:5-6' and 'numbers:2:5-6') is a new set, not a band move (six-games brief 6).
 */
export function isBandMove(from: string, to: string): boolean {
  const a = from.lastIndexOf(':');
  const b = to.lastIndexOf(':');
  if (a <= 0 || b <= 0 || from.slice(0, a) !== to.slice(0, b)) return false;
  const bandA = from.slice(a + 1);
  const bandB = to.slice(b + 1);
  return bandA !== bandB && isBand(bandA) && isBand(bandB);
}

/**
 * The run a level should continue from, given what is stored: the stored one when its set matches;
 * on a band change alone, the stored one moved to the new set and seed when `keepSolved` (Letter
 * Builder, Number Line-up and Brick Calculator); otherwise, a raised version included, a fresh run.
 */
export function resolveRun(stored: LevelRun | null, init: RunInit, now: number): LevelRun {
  if (!stored) return freshRun(init, now);
  if (stored.set === init.set) return stored;
  if (init.keepSolved && isBandMove(stored.set, init.set)) return { ...stored, set: init.set, seed: isSeed(init.seed) ? init.seed : 0, updatedAt: now };
  return freshRun(init, now);
}

function withRuns(g: GameProgress, level: number, run: LevelRun | null): GameProgress {
  const runs: Record<number, LevelRun> = { ...(g.runs ?? {}) };
  if (run) runs[level] = run;
  else delete runs[level];
  const next: GameProgress = { ...g, runs };
  if (Object.keys(runs).length === 0) delete next.runs;
  return next;
}

const validLevel = (level: number) => isInt(level) && level >= 0 && level <= MAX_LEVEL_INDEX;

/**
 * Open a level: returns the run it continues from (6.2 set changes) and saves it when it is new or
 * moved. Without a player, or with a bad level or set, nothing is saved and a fresh run comes back.
 */
export function startRun(state: ProgressState, playerId: string, gameId: string, level: number, init: RunInit, now: number): { state: ProgressState; run: LevelRun } {
  const player = findPlayer(state, playerId);
  if (!player || !validLevel(level) || !isSetId(init.set)) return { state, run: freshRun(init, now) };
  const stored = runOf(player, gameId, level);
  const run = resolveRun(stored, init, now);
  if (run === stored) return { state, run };
  return { state: withPlayer(state, playerId, (p) => withGame(p, gameId, (g) => withRuns(g, level, run))), run };
}

/**
 * The level a finish moves on to: the first level after it with no stars, wrapping round to the
 * first level with no stars; null when every level has stars.
 */
export function nextCurrentLevel(stars: Record<number, number>, level: number, levelCount: number): number | null {
  const open = (i: number) => !((stars[i] ?? 0) > 0);
  for (let i = level + 1; i < levelCount; i++) if (open(i)) return i;
  for (let i = 0; i < Math.min(level, levelCount); i++) if (open(i)) return i;
  return null;
}

const clampStars = (v: number) => (Number.isFinite(v) ? Math.min(3, Math.max(1, Math.round(v))) : 1);

/**
 * Save a solved puzzle (6.2). It joins `solved` and leaves the queue. The fourth result finishes the
 * level in the same write: stars by `rules.stars` (the higher count is kept, the next level opens),
 * the score by `rules.score` into `best` when higher, the run is deleted, and `current` moves to the
 * next level with no stars (deleted when every level has stars). A missing run, or one on another
 * set, is first resolved as startRun does, so a solve is never lost.
 */
export function recordPuzzle(
  state: ProgressState,
  playerId: string,
  gameId: string,
  level: number,
  result: PuzzleResult,
  rules: PuzzleRules,
  now: number,
): { state: ProgressState; outcome: PuzzleOutcome } {
  const ignored = { state, outcome: { kind: 'ignored' } as PuzzleOutcome };
  const player = findPlayer(state, playerId);
  const clean = cleanResult(result);
  if (!player || !clean || !validLevel(level) || !isInt(rules.levelCount) || level >= rules.levelCount || !isSetId(rules.set)) return ignored;
  const run = resolveRun(runOf(player, gameId, level), rules, now);
  if (!run.queue.includes(clean.puzzle)) return ignored;
  const solved = [...run.solved, clean];
  const queue = run.queue.filter((n) => n !== clean.puzzle);

  if (solved.length < SOLVES_PER_LEVEL) {
    const next: LevelRun = { ...run, queue, solved, updatedAt: now };
    return {
      state: withPlayer(state, playerId, (p) => withGame(p, gameId, (g) => withRuns(g, level, next))),
      outcome: { kind: 'saved', run: next },
    };
  }

  const stars = clampStars(rules.stars(solved));
  const score = rules.score ? rules.score(solved) : null;
  let next: number | null = null;
  const after = withPlayer(state, playerId, (p) =>
    withGame(p, gameId, (g) => {
      const allStars = { ...g.stars, [level]: Math.max(g.stars[level] ?? 0, stars) };
      const best = score !== null && Number.isFinite(score) && score >= 0 && score > (g.best[level] ?? 0) ? { ...g.best, [level]: score } : g.best;
      const done = withRuns({ ...g, unlocked: Math.max(g.unlocked, level + 1), stars: allStars, best }, level, null);
      next = nextCurrentLevel(allStars, level, rules.levelCount);
      if (next === null) delete done.current;
      else done.current = next;
      return done;
    }),
  );
  return { state: after, outcome: { kind: 'finished', level, stars, results: solved, next } };
}

/** Take a different puzzle (3.3): queue[0] moves to the end. Returns the saved run, or null when the level has none. */
export function swapPuzzle(state: ProgressState, playerId: string, gameId: string, level: number, now: number): { state: ProgressState; run: LevelRun | null } {
  const run = runOf(findPlayer(state, playerId), gameId, level);
  if (!run || run.queue.length < 2) return { state, run };
  const next: LevelRun = { ...run, queue: [...run.queue.slice(1), run.queue[0]], updatedAt: now };
  return { state: withPlayer(state, playerId, (p) => withGame(p, gameId, (g) => withRuns(g, level, next))), run: next };
}

/**
 * Letter Builder spends one hint from the level's budget, saved at once so it stays spent when the
 * puzzle is left or swapped. Returns the hints left after it, or null when the run has no budget.
 * With none left nothing changes and 0 comes back.
 */
export function spendHint(state: ProgressState, playerId: string, gameId: string, level: number, now: number): { state: ProgressState; hintsLeft: number | null } {
  const run = runOf(findPlayer(state, playerId), gameId, level);
  if (!run || run.hintsLeft === undefined) return { state, hintsLeft: null };
  if (run.hintsLeft <= 0) return { state, hintsLeft: 0 };
  const next: LevelRun = { ...run, hintsLeft: run.hintsLeft - 1, updatedAt: now };
  return { state: withPlayer(state, playerId, (p) => withGame(p, gameId, (g) => withRuns(g, level, next))), hintsLeft: next.hintsLeft! };
}

/**
 * A grown-up picks the level a child plays next (any level, locked ones too): `current` becomes it
 * and `unlocked` rises to it. An existing run for it continues. Levels outside the game are ignored.
 */
export function pickLevel(state: ProgressState, playerId: string, gameId: string, level: number, levelCount: number): ProgressState {
  if (!validLevel(level) || !isInt(levelCount) || level >= levelCount) return state;
  return withPlayer(state, playerId, (p) =>
    withGame(p, gameId, (g) => (g.current === level && g.unlocked >= level ? null : { ...g, current: level, unlocked: Math.max(g.unlocked, level) })),
  );
}

/** Settings "Start <game> over": that game's levels, stars, scores, current level and runs go. Other games and stickers stay. */
export function resetGame(state: ProgressState, playerId: string, gameId: string): ProgressState {
  const id = toGameId(gameId);
  return withPlayer(state, playerId, (p) => {
    if (!Object.hasOwn(p.games, id)) return null;
    const games = { ...p.games };
    delete games[id];
    return { ...p, games };
  });
}

/** Settings "Reset progress": stars, levels, scores and stickers go back to the start. The player stays. */
export function resetPlayerProgress(state: ProgressState, playerId: string): ProgressState {
  return withPlayer(state, playerId, (p) => ({ ...p, games: {}, stickers: {} }));
}
