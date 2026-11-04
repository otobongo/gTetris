import { useEffect, useState } from 'react';

/**
 * Tiny hash router: '#/game/escape/3' -> ['game', 'escape', '3']. Hash routing works on any
 * static host and inside a mobile webview.
 *
 * Route table (paths after '#/'):
 *   ''  or 'home'          Home (all games)
 *   'players'              Who's playing
 *   'game/<id>'            the game: opens the child's current level, or the finished state
 *   'game/<id>/<n>'        the game at level n (1-based); only the current level plays (screens/logic/routes.ts)
 *   'game/<id>/levels'     old Level select, which now redirects to 'game/<id>'
 *   'stickers'             Sticker book
 *   'break'                Break time
 *   'settings'             Settings for grown-ups
 *   'settings/levels/<game>/<playerId>'  the grown-up level picker (brief 7.3)
 *   'signin', 'signup'     Family account
 *   'help'                 Support
 *   'help/terms', 'help/privacy'  Terms of use, Privacy policy
 * Old paths 'slide', 'drop', 'letters' (with an optional level) redirect to 'game/<id>' or 'game/<id>/<n>'.
 */

export type Route =
  | { name: 'home' }
  | { name: 'players' }
  | { name: 'game'; id: string; level: number | null }
  | { name: 'levels'; id: string }
  | { name: 'stickers' }
  | { name: 'break' }
  | { name: 'settings' }
  | { name: 'levelPicker'; game: string; playerId: string }
  | { name: 'signin' }
  | { name: 'signup' }
  | { name: 'help' }
  | { name: 'terms' }
  | { name: 'privacy' }
  | { name: 'notFound'; path: string };

const SIMPLE = ['players', 'stickers', 'break', 'settings', 'signin', 'signup'] as const;

/** Old top-level game paths and the registry id each one became. */
export const LEGACY_ROUTES: Record<string, string> = { slide: 'escape', drop: 'drop', letters: 'letters' };

export function splitPath(hash: string): string[] {
  return hash.replace(/^#?\/?/, '').split('/').filter(Boolean);
}

export function parseRoute(segments: string[]): Route {
  const [a, b, c, ...rest] = segments;
  if (a === undefined || (a === 'home' && b === undefined)) return { name: 'home' };
  if ((SIMPLE as readonly string[]).includes(a) && b === undefined) return { name: a as (typeof SIMPLE)[number] };
  if (a === 'settings' && b === 'levels' && c !== undefined && rest.length === 1) {
    const playerId = decode(rest[0]);
    if (playerId) return { name: 'levelPicker', game: c, playerId };
  }
  if (a === 'help') {
    if (b === undefined) return { name: 'help' };
    if ((b === 'terms' || b === 'privacy') && c === undefined) return { name: b };
  }
  if (a === 'game' && b && rest.length === 0) {
    if (c === undefined) return { name: 'game', id: b, level: null };
    if (c === 'levels') return { name: 'levels', id: b };
    const n = Number(c);
    if (Number.isInteger(n) && n >= 1) return { name: 'game', id: b, level: n };
  }
  return { name: 'notFound', path: segments.join('/') };
}

/** A path segment as text, or '' when it is not valid percent-encoding. */
function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
}

/**
 * Where an old path goes now, or null when it is not an old path: 'slide' becomes the game
 * ('/game/escape'), 'slide/3' the game at that level. screens/logic/routes.ts then applies the
 * current-level rule in the same replace.
 */
export function legacyRedirect(segments: string[]): string | null {
  const [a, b, ...rest] = segments;
  const id = a !== undefined && Object.hasOwn(LEGACY_ROUTES, a) ? LEGACY_ROUTES[a] : undefined;
  if (!id || rest.length) return null;
  if (b === undefined) return `/game/${id}`;
  return `/game/${id}/${b}`;
}

/** Path for a route, without the '#'. */
export function pathFor(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/';
    case 'game':
      return route.level === null ? `/game/${route.id}` : `/game/${route.id}/${route.level}`;
    case 'levels':
      return `/game/${route.id}/levels`;
    case 'levelPicker':
      return `/settings/levels/${route.game}/${encodeURIComponent(route.playerId)}`;
    case 'terms':
      return '/help/terms';
    case 'privacy':
      return '/help/privacy';
    case 'notFound':
      return `/${route.path}`;
    default:
      return `/${route.name}`;
  }
}

/** href for a link: toHref('/stickers') -> '#/stickers'. Accepts a path with or without the leading '/' or '#'. */
export function toHref(path: string): string {
  if (path.startsWith('#')) return path;
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

const read = () => (typeof window === 'undefined' ? [] : splitPath(window.location.hash));

export function useRoute(): string[] {
  const [route, setRoute] = useState<string[]>(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function go(path: string) {
  window.location.hash = path.startsWith('/') ? path : `/${path}`;
}

/** Go without adding a history entry (redirects), so Back skips the old path. */
export function replace(path: string) {
  const url = `${window.location.pathname}${window.location.search}${toHref(path)}`;
  window.location.replace(url);
}
