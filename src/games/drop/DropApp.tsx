import { useEffect } from 'react';
import { replace } from '../../shared/router';
import { gameOf, useActivePlayer } from '../../shared/progress';
import { useProgress } from '../../shared/storage';
import { isLevelOpen } from '../meta';
import { meta } from './meta';
import Play from './Play';
import { currentStage } from './stages';
import './drop.css';

/**
 * Brick Drop. `#/game/drop/<n>` plays stage n (1-based). The stage list is the shared Levels screen
 * (`#/game/drop/levels`), so `#/game/drop` (the Play button) opens the stage the player is up to, and a
 * stage that does not exist or is still locked goes back to Levels.
 */
export default function DropApp({ params }: { params: string[] }) {
  useProgress(); // unlocks depend on stars
  const n = params[0] === undefined ? NaN : Number(params[0]);
  const index = Number.isInteger(n) ? n - 1 : -1;
  const player = useActivePlayer();
  // Same rule as the Levels screen, so every tile it shows open also opens here.
  const playable = isLevelOpen(meta, gameOf(player, 'drop'), player?.ageBand, index);
  const target = params[0] === undefined ? `/game/drop/${currentStage() + 1}` : playable ? null : '/game/drop/levels';

  useEffect(() => {
    if (target) replace(target);
  }, [target]);

  if (target) return null;
  return <Play key={index} index={index} />;
}
