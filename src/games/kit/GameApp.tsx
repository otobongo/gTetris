import { Fragment, useEffect, useMemo, type ReactNode } from 'react';
import { gameOf, useActivePlayer } from '../../shared/progress';
import { replace } from '../../shared/router';
import { currentLevel } from '../meta';
import type { KitGame } from './levelRun';
import { routeFor } from './route';

export interface GameAppProps {
  /** The kit game: its id and meta decide the routes. */
  game: Pick<KitGame<unknown>, 'id' | 'meta'>;
  /** The route's params after `game/<id>`, as App passes them. */
  params: string[];
  /** The game's Play screen for a 0-based level. GameApp mounts a new one for every level. */
  play: (level: number) => ReactNode;
  /** The finished state, shown on `#/game/<id>` once every level has stars. */
  finished: () => ReactNode;
}

/**
 * The route guard each kit game's App uses (six-games brief 3.1), as SlideApp does it: `#/game/<id>`
 * opens the child's current level, or the finished state when every level has stars; `#/game/<id>/<n>`
 * plays only the current level, and any other level goes back to `#/game/<id>`. Children never see a
 * level grid: a grown-up picks levels in Settings.
 *
 * It decides once per route change (and per player). A level that opened keeps playing whatever the
 * store says next: its fourth solve moves `current` on, and the level card must stay up until the
 * child taps Play Level.
 */
export function GameApp({ game, params, play, finished }: GameAppProps) {
  const player = useActivePlayer();
  const path = params.join('/');
  const playerId = player?.id;
  const live = routeFor(game.id, params, currentLevel(game.meta, gameOf(player, game.id)), game.meta.levelCount);
  // Decided when the route (or the player) changes, never while a level is on screen.
  const entered = useMemo(() => live, [path, playerId]);
  const decision = entered.kind === 'play' ? entered : live;
  const to = decision.kind === 'redirect' ? decision.to : null;

  useEffect(() => {
    if (to) replace(to);
  }, [to]);

  if (decision.kind === 'play') return <Fragment key={decision.index}>{play(decision.index)}</Fragment>;
  if (decision.kind === 'finished') return <>{finished()}</>;
  return null;
}
