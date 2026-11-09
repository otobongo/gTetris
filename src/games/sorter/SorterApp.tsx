import { Finished } from '../kit/Finished';
import { GameApp } from '../kit/GameApp';
import { GAME } from './game';
import { Play, SorterEmpty } from './Play';
import './sorter.css';

/**
 * Shape Sorter. `#/game/sorter` opens the child's current level, or the finished state once every level
 * has stars; `#/game/sorter/<n>` plays only the current level (the kit's route guard). Children never see
 * a level grid: a grown-up picks levels in Settings.
 */
export default function SorterApp({ params }: { params: string[] }) {
  return (
    <GameApp
      game={GAME}
      params={params}
      play={(level) => <Play level={level} />}
      finished={() => (
        <Finished game={GAME} className="sort">
          <SorterEmpty />
        </Finished>
      )}
    />
  );
}
