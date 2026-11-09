/** Progress store: the shapes kept on this device under STORAGE_KEY. */

export const STORAGE_KEY = 'brickwise:v2';
export const LEGACY_KEY = 'brickwise:v1';
/** 3 marks the four-puzzle levels shape (current and runs). Records written as 2 load through sanitize unchanged. */
export const SCHEMA_VERSION = 3;

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

/** Puzzles each level holds (puzzle numbers 0 to 5); puzzle 0 is the level's original board. */
export const PUZZLES_PER_LEVEL = 6;
/** Solved puzzles that finish a level. */
export const SOLVES_PER_LEVEL = 4;
/** Letter Builder's hint budget per level. */
export const HINTS_PER_RUN = 3;
/** Highest level index a stored `current` may hold; the range check against a game's level count is currentLevel's. */
export const MAX_LEVEL_INDEX = 999;
/** Longest stored puzzle set id. */
export const MAX_SET_LENGTH = 64;

export interface GameProgress {
  /** Highest open level, as a 0-based index (0 means only the first level is open). */
  unlocked: number;
  /** Stars (1 to 3) per finished level, keyed by 0-based level index. */
  stars: Record<number, number>;
  /** Best score per level, keyed by 0-based level index (Brick Drop: the highest level score). */
  best: Record<number, number>;
  /** Level a Home tap opens (0-based), when set by a finish or a grown-up pick. Absent: work it out (games/meta.ts currentLevel). */
  current?: number;
  /** Puzzle progress for levels started and not finished, keyed by 0-based level. */
  runs?: Record<number, LevelRun>;
}

/** One level in progress: which puzzles are left, in order, and the ones already solved. */
export interface LevelRun {
  /** Which puzzle set: 'escape:<level id>', 'drop:1', 'letters:1:<age band>'. */
  set: string;
  /** Seed the puzzles are built from (Letter Builder); 0 for fixed sets. */
  seed: number;
  /** Every unsolved puzzle number (0 to 5), in the order they come; queue[0] is on screen. A swap moves it to the end. */
  queue: number[];
  /** Counted puzzles, in the order solved: 0 to 3 stored, because the fourth finishes the level in the same write. */
  solved: PuzzleResult[];
  /** Letter Builder hints left in this level (3 at the start). Absent for games with no hint budget. */
  hintsLeft?: number;
  updatedAt: number;
}

/** What one solved puzzle stores: the numbers its game's star rule and level card need. */
export interface PuzzleResult {
  /** Puzzle number, 0 to 5. */
  puzzle: number;
  /** Escape: moves. Drop: bricks used. Letter Builder: slips. */
  count: number;
  /** Escape: the board's Best (par). */
  par?: number;
  /** Drop: the puzzle's 3-star brick count (T3). */
  three?: number;
  /** Drop: the puzzle's 2-star brick count (T2). */
  two?: number;
  /** Drop: this puzzle's score. */
  score?: number;
  /** Letter Builder spelling: the word built, so a band change leaves it out. */
  word?: string;
  usedHint: boolean;
  outOfTime: boolean;
}

/** What a game passes when it opens a level: its puzzle set for that level, and how to start one. */
export interface RunInit {
  /** The game's set id for this level (at most 64 characters). A stored run with another set restarts. */
  set: string;
  /** Seed for built puzzles (Letter Builder); 0 for fixed sets. Kept from the stored run when its set matches. */
  seed: number;
  /** Letter Builder: hints a new run starts with (3). Leave out for games with no hint budget. */
  hintsLeft?: number;
  /**
   * An age band change (Letter Builder, Number Line-up, Brick Calculator): when the stored set differs
   * only in its band part ('numbers:1:5-6' to 'numbers:1:7-8', isBandMove), keep the solved puzzles,
   * the queue and the hints left, and take the new set and seed (the game re-fills the unsolved puzzles).
   * Any other set change, a raised version included ('numbers:1:5-6' to 'numbers:2:5-6'), starts the
   * level again at puzzle 1.
   */
  keepSolved?: boolean;
}

/** What recordPuzzle needs besides the result: the run to use, and the game's level rules. */
export interface PuzzleRules extends RunInit {
  /** The game's level count, so the level after the last wraps round to the first with no stars. */
  levelCount: number;
  /** The level's stars (1 to 3) from its 4 solved results, caps included (games/run.ts levelStars). */
  stars: (solved: readonly PuzzleResult[]) => number;
  /** The level's score from its 4 results (Brick Drop: the sum), kept in `best` when higher. */
  score?: (solved: readonly PuzzleResult[]) => number;
}

/** What recordPuzzle did. */
export type PuzzleOutcome =
  /** Saved: the level goes on; `run` is the stored run after the solve. */
  | { kind: 'saved'; run: LevelRun }
  /** The fourth solve: the level is finished. `stars` is what this run earned (the store keeps the higher). */
  | { kind: 'finished'; level: number; stars: number; results: PuzzleResult[]; next: number | null }
  /** Nothing saved: no player, a bad result, or a puzzle that is not in the queue. */
  | { kind: 'ignored' };

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
