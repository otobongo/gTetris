import { useEffect } from 'react';
import { go } from '../../shared/router';
import { useProgress } from '../../shared/storage';
import Play from './Play';
import StageSelect from './StageSelect';
import { STAGES, isUnlocked } from './stages';
import './drop.css';

/** Brick Drop: `#/drop` is the stage select, `#/drop/<n>` plays stage n (1-based). */
export default function DropApp({ params }: { params: string[] }) {
  useProgress(); // unlocks depend on stars
  const n = params[0] === undefined ? NaN : Number(params[0]);
  const index = Number.isInteger(n) ? n - 1 : -1;
  const playable = index >= 0 && index < STAGES.length && isUnlocked(index);

  useEffect(() => {
    if (params[0] !== undefined && !playable) go('/drop');
  }, [params, playable]);

  if (!playable) return <StageSelect />;
  return <Play key={index} index={index} />;
}
