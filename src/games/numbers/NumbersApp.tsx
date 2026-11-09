import { GameApp } from '../kit/GameApp';
import { Finished } from '../kit/Finished';
import { NUMBERS } from './game';
import { Play } from './Play';
import { TowerWell } from './parts';
import './numbers.css';

/**
 * Number Line-up's route guard (brief 3.1): `#/game/numbers` opens the child's current level at its
 * next unsolved puzzle, or the finished state, where the empty tower well sits behind the card.
 */
export default function NumbersApp({ params }: { params: string[] }) {
  return (
    <GameApp
      game={NUMBERS}
      params={params}
      play={(level) => <Play level={level} />}
      finished={() => (
        <Finished game={NUMBERS} className="num-screen">
          <TowerWell towers={[]} marks={null} />
        </Finished>
      )}
    />
  );
}
