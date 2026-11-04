/**
 * Where a path really goes (brief 7.4), as one pure function so App can redirect in a single
 * replace and tests can check every rule without a browser:
 * - old paths ('#/slide', '#/drop/3') become the game routes;
 * - '#/game/<id>/levels' (the old level grid) becomes the game;
 * - '#/game/<id>' and '#/game/<id>/<n>' of a playable game open the child's current level
 *   (brief 2.6), or stay on '#/game/<id>' (the finished state) when every level is done. A grown-up
 *   pick stores the current level first, so the level it opens passes this rule;
 * - the level picker needs a playable game and a player that exists, else it goes to Settings;
 * - unknown paths and games go Home;
 * - a used-up daily limit then sends a play route to Break, with the resolved path to resume.
 */
import { currentLevel } from '../../games/meta';
import { getGame } from '../../games/registry';
import { activePlayer, findPlayer, gameOf, type Player, type ProgressState } from '../../shared/progress';
import { legacyRedirect, parseRoute, pathFor, splitPath, type Route } from '../../shared/router';
import { shouldBreak } from './session';

export interface RoutePlan {
  /** The route to draw once any redirect is done. */
  route: Route;
  /** Its path, without the '#'. */
  path: string;
  /** The path to replace the current one with, or null to stay. '/break' when the limit is used up. */
  redirect: string | null;
}

/** The path a playable game opens for a player: its current level, or the game alone when every level is done. */
export function gamePath(id: string, player: Player | null): string {
  const game = getGame(id);
  if (!game?.meta) return `/game/${id}`;
  const level = currentLevel(game.meta, gameOf(player, game.id));
  return level === null ? `/game/${game.id}` : `/game/${game.id}/${level + 1}`;
}

/** The route a path settles on, before the daily-limit check. */
function settle(segments: string[], state: ProgressState): Route {
  const legacy = legacyRedirect(segments);
  const route = parseRoute(legacy ? splitPath(legacy) : segments);
  switch (route.name) {
    case 'notFound':
      return { name: 'home' };
    case 'levels':
    case 'game': {
      const game = getGame(route.id);
      if (!game) return { name: 'home' };
      if (!game.playable) return { name: 'game', id: game.id, level: null };
      return parseRoute(splitPath(gamePath(game.id, activePlayer(state))));
    }
    case 'levelPicker': {
      const game = getGame(route.game);
      return game?.playable && findPlayer(state, route.playerId) ? route : { name: 'settings' };
    }
    default:
      return route;
  }
}

/** Plan a path: where it settles, and the one replace (if any) that gets there. */
export function planRoute(segments: string[], state: ProgressState, now: number): RoutePlan {
  // Compared as written by pathFor, so '#/home' and '#/' count as the same place.
  const asked = pathFor(parseRoute(segments));
  const route = settle(segments, state);
  const path = pathFor(route);
  if (shouldBreak(route, activePlayer(state), now)) return { route, path, redirect: '/break' };
  return { route, path, redirect: path === asked ? null : path };
}
