/** Progress store v2: the shapes kept on this device under STORAGE_KEY. */

export const STORAGE_KEY = 'brickwise:v2';
export const LEGACY_KEY = 'brickwise:v1';
export const SCHEMA_VERSION = 2;

export const AGE_BANDS = ['3-4', '5-6', '7-8', '9-10'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** Avatar colours a child can pick (the eight brick colours of the canvas pal()). */
export const AVATAR_COLORS = ['red', 'yellow', 'green', 'blue', 'purple', 'orange', 'pink', 'teal'] as const;
export type AvatarColor = (typeof AVATAR_COLORS)[number];

/** Settings timer modes, per child (Grownups board). */
export const TIMER_MODES = ['auto', 'relaxed', 'off'] as const;
export type TimerMode = (typeof TIMER_MODES)[number];

/** Daily play limit range in minutes (Settings stepper: 10 to 90 in steps of 5). */
export const LIMIT_MIN = 10;
export const LIMIT_MAX = 90;
export const LIMIT_DEFAULT = 20;

export interface GameProgress {
  /** Highest open level, as a 0-based index (0 means only the first level is open). */
  unlocked: number;
  /** Stars (1 to 3) per finished level, keyed by 0-based level index. */
  stars: Record<number, number>;
  /** Best score per level, keyed by 0-based level index (Brick Drop's score, for example). */
  best: Record<number, number>;
}

export interface StickerRecord {
  /** When it was earned (ms since epoch). */
  earnedAt: number;
  /** False until the child has seen it in the sticker book ("New" pill). */
  seen: boolean;
}

export interface PlayToday {
  /** Local calendar day this count belongs to, 'YYYY-MM-DD'. */
  day: string;
  /** Minutes played on that day. */
  minutes: number;
  /** Minutes a grown-up added on that day from the break screen. */
  extraMinutes: number;
}

export interface Player {
  id: string;
  /** First name only. */
  name: string;
  ageBand: AgeBand;
  color: AvatarColor;
  /** Daily play limit in minutes. */
  dailyLimit: number;
  timerMode: TimerMode;
  /** True for a player the app made itself (moved over from v1, or created so a game could save).
      A grown-up should name it in Settings. */
  unnamed: boolean;
  createdAt: number;
  /** Last change to name, age band, colour, limit or timer (used by the sync merge). */
  updatedAt: number;
  /** Keyed by registry game id ('escape', 'drop', 'letters', ...). */
  games: Record<string, GameProgress>;
  stickers: Record<string, StickerRecord>;
  today: PlayToday;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  voice: boolean;
  alerts: boolean;
}

export type SettingKey = keyof Settings;

export interface ProgressState {
  version: typeof SCHEMA_VERSION;
  players: Player[];
  activePlayerId: string | null;
  settings: Settings;
  /** Last change to settings (used by the sync merge: newest settings win). */
  settingsUpdatedAt: number;
}

export interface NewPlayer {
  name: string;
  ageBand: AgeBand;
  color: AvatarColor;
  dailyLimit?: number;
  timerMode?: TimerMode;
}

export type PlayerPatch = Partial<Pick<Player, 'name' | 'ageBand' | 'color' | 'dailyLimit' | 'timerMode'>>;
