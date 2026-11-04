/**
 * Screen-level rules that sit between the router and the progress store: when Break takes
 * over, where the child goes back to afterwards, and the avatar colour a new player gets.
 */
import type { Route } from '../../shared/router';
import { AVATAR_COLORS, isBreakTime, type AvatarColor, type Player } from '../../shared/progress';

/** Routes a used-up daily limit blocks (brief 3.4): Home, Levels and the games. */
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
 * The grown-up check on Settings stays passed while a grown-up moves between Settings,
 * Support and the account screens, and resets when Home opens again.
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
