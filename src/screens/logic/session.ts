/**
 * Screen-level rules that sit between the router and the progress store: when Break takes
 * over, where the child goes back to afterwards, and the avatar colour a new player gets.
 */
import { replace, type Route } from '../../shared/router';
import { AVATAR_COLORS, activePlayer, isBreakTime, progressStore, type AvatarColor, type Player } from '../../shared/progress';

/** Routes a used-up daily limit blocks (brief 3.4): Home and the games (and the old Levels path). Never the grown-up level picker. */
export function isPlayRoute(route: Route): boolean {
  return route.name === 'home' || route.name === 'levels' || route.name === 'game';
}

export function shouldBreak(route: Route, player: Player | null, now: number): boolean {
  return !!player && isPlayRoute(route) && isBreakTime(player, now);
}

/** First avatar colour no other player uses, cycling once all eight are taken. */
export function nextAvatarColor(players: readonly Player[]): AvatarColor {
  const used = new Set(players.map((p) => p.color));
  return AVATAR_COLORS.find((c) => !used.has(c)) ?? AVATAR_COLORS[players.length % AVATAR_COLORS.length];
}

/** Where Break sends the child once a grown-up adds time: the path the limit stopped. */
let resumePath = '/';
export function setResumePath(path: string) {
  resumePath = path.startsWith('/') ? path : `/${path}`;
}
export function getResumePath(): string {
  return resumePath;
}

/**
 * The daily-limit check the games run on every Next puzzle and Play Level tap (brief 2.4), so a
 * puzzle in progress is never cut off. When the limit is used up it records `path` (the level's
 * route) as where Break resumes, opens Break in place of the current entry, and returns true: the
 * game then loads nothing. Otherwise it returns false and the game goes on.
 * `go` and `now` are for tests; they default to the router's replace and the store's clock.
 */
export function breakBefore(
  path: string,
  { player = activePlayer(progressStore.getState()), now = progressStore.now(), go = replace }: { player?: Player | null; now?: number; go?: (path: string) => void } = {},
): boolean {
  if (!player || !isBreakTime(player, now)) return false;
  setResumePath(path);
  go('/break');
  return true;
}

/** Screens a passed grown-up check covers: Settings, the level picker, the account screens, Support and the legal pages. */
const GROWN_UP_ROUTES: readonly Route['name'][] = ['settings', 'levelPicker', 'signin', 'signup', 'help', 'terms', 'privacy'];

export function isGrownUpRoute(route: Route): boolean {
  return GROWN_UP_ROUTES.includes(route.name);
}

/** Screens that open only after the grown-up check: Settings, the level picker and the account screens. Support, Terms and Privacy stay open. */
const CHECKED_ROUTES: readonly Route['name'][] = ['settings', 'levelPicker', 'signin', 'signup'];

export function needsGrownUpCheck(route: Route): boolean {
  return CHECKED_ROUTES.includes(route.name);
}

/**
 * The grown-up check on Settings stays passed while a grown-up moves between Settings,
 * Support and the account screens, and ends on the first screen outside them. App calls
 * `follow` on every route, including one it redirects (Home that turns into Break), so the
 * pass never outlives the grown-up pages, whichever way they were left (Back, device Back, a link).
 */
let grownUp = false;
export const grownUpGate = {
  passed: () => grownUp,
  pass: () => {
    grownUp = true;
  },
  reset: () => {
    grownUp = false;
  },
  follow: (route: Route) => {
    if (!isGrownUpRoute(route)) grownUp = false;
  },
};

/** The app path before the current one, so Back on grown-up pages returns where it came from. */
let currentPath = '/';
let previousPath: string | null = null;
export function notePath(path: string) {
  const next = path.startsWith('/') ? path : `/${path}`;
  if (next === currentPath) return;
  previousPath = currentPath;
  currentPath = next;
}

/** Where Back goes: the previous path when it is one of `allowed`, otherwise `fallback`. */
export function backTarget(allowed: readonly string[], fallback: string): string {
  return previousPath && allowed.includes(previousPath) ? previousPath : fallback;
}

/**
 * What Settings shows when a grown-up comes back from the level picker: the child whose game was
 * open there, and the toast of a level set for another child ("Leo plays Level 5 next in Brick Escape.").
 * Settings takes the toast once.
 */
let settingsChild: string | null = null;
let settingsToast = '';
export const settingsReturn = {
  child: () => settingsChild,
  setChild: (id: string | null) => {
    settingsChild = id;
  },
  setToast: (text: string) => {
    settingsToast = text;
  },
  takeToast: () => {
    const t = settingsToast;
    settingsToast = '';
    return t;
  },
};
