import { useEffect, useMemo } from 'react';
import { replace } from '../../shared/router';
import { gameOf, useActivePlayer } from '../../shared/progress';
import { useProgress } from '../../shared/storage';
import { currentLevel } from '../meta';
import { meta } from './meta';
import { GAME, routeFor } from './puzzles';
import SlideGame, { EscapeFinished } from './SlideGame';
import './slide.css';

/**
 * Brick Escape (brief 2.1, 2.5, 7.4). `#/game/escape` opens the child's current level, or the finished state
 * when every level has stars; `#/game/escape/<n>` plays only the current level, and any other level goes back
 * to `#/game/escape`. Children never see a level grid: a grown-up picks levels in Settings.
 */
export default function SlideApp({ params }: { params: string[] }) {
  useProgress(); // the current level moves when a level is finished or a grown-up picks one
  const player = useActivePlayer();
  const path = params.join('/');
  const playerId = player?.id;
  const live = routeFor(params, currentLevel(meta, gameOf(player, GAME)));
  // A level that opened keeps playing whatever the store says next: finishing it moves `current` on, and the
  // level card must stay up until the child taps Play Level. Everything else follows the store.
  const entered = useMemo(() => live, [path, playerId]);
  const decision = entered.kind === 'play' ? entered : live;
  const to = decision.kind === 'redirect' ? decision.to : null;

  useEffect(() => {
    if (to) replace(to);
  }, [to]);

  if (decision.kind === 'play') return <SlideGame key={decision.index} index={decision.index} />;
  if (decision.kind === 'finished') return <EscapeFinished />;
  return null;
}
