/**
 * Level rules for the grown-up level picker (design/canvas/Levels.dc.html, brief 7.3) and the
 * progress lines Home, Settings and Break show (brief 9), as pure functions so they can be tested
 * without a browser. Level indexes are 0-based; the numbers people see are 1-based. Every screen
 * takes the current level from one rule, currentLevel in games/meta.ts (brief 2.6).
 */
import { currentLevel, isLevelOpen, type GameMeta } from '../../games/meta';
import type { GameEntry } from '../../games/registry';
import { SOLVES_PER_LEVEL, gameOf, runOf, solvedCount, totalStars, type AgeBand, type GameProgress, type Player } from '../../shared/progress';

export type TileState = 'done' | 'current' | 'open' | 'locked';

export interface LevelTile {
  /** 0-based level index. */
  index: number;
  /** The number on the tile (1-based). */
  n: number;
  state: TileState;
  /** Stars earned, 0 to 3. */
  stars: number;
}

export interface LevelChapter {
  title: string;
  note: string;
  tiles: LevelTile[];
  /** Open-ended chapter: a "More soon" tile follows its levels. */
  more: boolean;
}

export interface LevelPlan {
  chapters: LevelChapter[];
  /** The child's current level (0-based, brief 2.6), or null when every level is done. */
  current: number | null;
  complete: boolean;
  stars: number;
  maxStars: number;
  levelCount: number;
}

/**
 * The picker's tiles. The current level is currentLevel's (a grown-up pick or a finish, else the
 * first level with no stars) and shows as current even when it already has stars. The rest are
 * done (stars), open or locked by the unlock rule: linear, as the games use it (a level opens once
 * the one before has a star), plus anything the store already marks open. Ages 9 to 10 also start
 * the first level of every chapter open (user decision 7).
 */
export function planLevels(meta: GameMeta, game: GameProgress, band: AgeBand): LevelPlan {
  const count = meta.levelCount;
  const starsOf = (i: number) => Math.max(0, Math.min(3, game.stars[i] ?? 0));
  const isOpen = (i: number) => isLevelOpen(meta, game, band, i);
  const current = currentLevel(meta, game);

  let stars = 0;
  const chapters = meta.chapters.map((c) => {
    const tiles: LevelTile[] = [];
    const end = Math.min(c.start + c.count, count);
    for (let i = c.start; i < end; i++) {
      const s = starsOf(i);
      stars += s;
      const state: TileState = i === current ? 'current' : s > 0 ? 'done' : isOpen(i) ? 'open' : 'locked';
      tiles.push({ index: i, n: i + 1, state, stars: s });
    }
    return { title: c.title, note: c.note, tiles, more: !!c.more };
  });

  const complete = count > 0 && current === null;
  return { chapters, current, complete, stars, maxStars: count * 3, levelCount: count };
}

/** Status line for a tap on a locked tile: "Finish Level 9 to open Level 10." */
export function lockMessage(plan: LevelPlan, index: number, noun: string): string {
  const stateOf = (i: number) => plan.chapters.flatMap((c) => c.tiles).find((t) => t.index === i)?.state ?? 'locked';
  let q = index - 1;
  while (q > 0 && stateOf(q) === 'locked') q--;
  if (q === index - 1) return `Finish ${noun} ${q + 1} to open ${noun} ${index + 1}.`;
  return `Finish ${noun} ${q + 1} first. ${noun}s open one at a time.`;
}

const starWord = (n: number) => `${n} ${n === 1 ? 'star' : 'stars'}`;

/**
 * Accessible name of a tile, as the board writes it. With `name` (the picker), the current tile
 * reads "Level 9, Maya’s current level".
 */
export function tileLabel(tile: LevelTile, noun: string, name?: string): string {
  switch (tile.state) {
    case 'done':
      return `${noun} ${tile.n}, ${starWord(tile.stars)}`;
    case 'current':
      return name ? `${noun} ${tile.n}, ${name}’s current ${noun.toLowerCase()}` : `${noun} ${tile.n}, play next`;
    case 'open':
      return `${noun} ${tile.n}, not played`;
    default:
      return `${noun} ${tile.n}, locked`;
  }
}

/** Home card pill: "Level 9", "Stage 4", or "All done" once currentLevel finds no level left (brief 7.2). */
export function homePill(meta: GameMeta | null, game: GameProgress, _band: AgeBand, noun: string): string {
  if (!meta) return 'Coming soon';
  const current = currentLevel(meta, game);
  return current === null ? 'All done' : `${noun} ${current + 1}`;
}

/* ---------- Progress lines (brief section 9) ---------- */

/** Where a child is in one game: the current level (0-based, null when every level is done) and its solved puzzles. */
export interface LevelSpot {
  level: number | null;
  solved: number;
  unit: 'puzzle' | 'word';
}

/** The child's current level in a game and how many of its puzzles are solved; null for a game that is not built. */
export function levelSpot(game: GameEntry, player: Player | null): LevelSpot | null {
  if (!game.meta) return null;
  const level = currentLevel(game.meta, gameOf(player, game.id));
  if (level === null) return { level, solved: 0, unit: 'puzzle' };
  return { level, solved: solvedCount(player, game.id, level), unit: game.unit(level) };
}

/** "2 of 4 puzzles solved" / "2 of 4 words built". */
const solvedPhrase = (solved: number, unit: 'puzzle' | 'word') => `${solved} of ${SOLVES_PER_LEVEL} ${unit === 'word' ? 'words built' : 'puzzles solved'}`;

/** Home card accessible name: "Brick Escape. Slide bricks out their doors. Level 9, 2 of 4 puzzles solved." */
export function homeCardName(game: GameEntry, player: Player | null): string {
  const head = `${game.title}. ${game.sub}.`;
  const spot = levelSpot(game, player);
  if (!spot) return `${head} Coming soon.`;
  if (spot.level === null) return `${head} All done.`;
  return `${head} ${game.noun} ${spot.level + 1}${spot.solved > 0 ? `, ${solvedPhrase(spot.solved, spot.unit)}` : ''}.`;
}

/** Settings game row sub: "Level 9, 2 of 4 puzzles", "Stage 1", "All levels done". */
export function settingsRowSub(game: GameEntry, player: Player | null): string {
  const spot = levelSpot(game, player);
  if (!spot) return 'Coming soon';
  if (spot.level === null) return `All ${game.noun.toLowerCase()}s done`;
  const n = `${game.noun} ${spot.level + 1}`;
  return spot.solved > 0 ? `${n}, ${spot.solved} of ${SOLVES_PER_LEVEL} ${spot.unit}s` : n;
}

/** Settings game row accessible name: "Brick Escape for Maya: Level 9, 2 of 4 puzzles. Pick a level". */
export function settingsRowName(game: GameEntry, player: Player): string {
  return `${game.title} for ${player.name}: ${settingsRowSub(game, player)}. Pick a ${game.noun.toLowerCase()}`;
}

/** Break's mid-level line, or null when the current level has no solved puzzle: "Level 9 is saved with 2 of 4 puzzles solved." */
export function breakSavedLine(game: GameEntry, player: Player | null): string | null {
  const spot = levelSpot(game, player);
  if (!spot || spot.level === null || spot.solved === 0) return null;
  return `${game.noun} ${spot.level + 1} is saved with ${solvedPhrase(spot.solved, spot.unit)}.`;
}

/** Everything the picker writes for one game and child (brief 7.3 and 9). Levels are 0-based. */
export interface PickerCopy {
  sub: string;
  intro: string;
  /** Status line for a picked level, or the arrival line when `picked` is null or the current level. */
  status: (picked: number | null) => string;
  /** Footer button: "Play Level 5" for the active player, "Set Level 5 for Leo" otherwise. */
  button: (level: number) => string;
  /** Toast after "Set Level 5 for Leo": "Leo plays Level 5 next in Brick Escape." */
  toast: (level: number) => string;
  reset: { heading: string; helper: string; button: string; title: string; body: string; go: string; toast: string };
}

export function pickerCopy(game: GameEntry, player: Player, active: boolean): PickerCopy {
  const meta = game.meta;
  const noun = game.noun;
  const lower = noun.toLowerCase();
  const name = player.name;
  const progress = gameOf(player, game.id);
  const spot = levelSpot(game, player);
  const arrival =
    !spot || spot.level === null
      ? `${name} has finished every ${lower}.`
      : `${name} is on ${noun} ${spot.level + 1}${spot.solved > 0 ? `, ${solvedPhrase(spot.solved, spot.unit)}` : ''}.`;

  const status = (picked: number | null): string => {
    if (picked === null || !meta || picked === spot?.level) return arrival;
    const head = `${noun} ${picked + 1} picked.`;
    const run = runOf(player, game.id, picked);
    if (run) return `${head} ${name} goes on from ${game.unit(picked)} ${run.solved.length + 1}.`;
    if ((progress.stars[picked] ?? 0) > 0) return `${head} ${name} plays it again from ${game.unit(picked)} 1.`;
    if (isLevelOpen(meta, progress, player.ageBand, picked)) return `${head} ${name} hasn’t played it yet.`;
    return `${head} ${name} hasn’t reached it yet.`;
  };

  return {
    sub: `${name} · ${totalStars(player, game.id)} of ${(meta?.levelCount ?? 0) * 3} stars`,
    intro: `Pick the ${lower} ${name} plays next. Earned stars stay.`,
    status,
    button: (level) => (active ? `Play ${noun} ${level + 1}` : `Set ${noun} ${level + 1} for ${name}`),
    toast: (level) => `${name} plays ${noun} ${level + 1} next in ${game.title}.`,
    reset: {
      heading: `Start ${game.title} over`,
      helper: `${name}’s ${lower}s and stars in ${game.title} go back to ${noun} 1 on this device. Stickers stay in the sticker book.`,
      button: `Reset ${game.title} for ${name}`,
      title: `Reset ${game.title} for ${name}?`,
      body: `${noun}s and stars in ${game.title} go back to ${noun} 1 on this device. Stickers stay. This can’t be undone.`,
      go: `Reset ${game.title}`,
      toast: `${game.title} starts again at ${noun} 1 for ${name}.`,
    },
  };
}
