import { Finished } from '../kit/Finished';
import { GameApp } from '../kit/GameApp';
import { GAME } from './game';
import { BuilderEmpty, Play } from './Play';
import './builder.css';

/**
 * Picture Builder. `#/game/builder` opens the child's current level, or the finished state once every level has
 * stars; `#/game/builder/<n>` plays only the current level (six-games brief 3.1: GameApp decides the route).
 * Children never see a level grid: a grown-up picks levels in Settings. The default export is what App.tsx's
 * GAME_SCREENS maps to `builder`.
 */
export default function BuilderApp({ params }: { params: string[] }) {
  return (
    <GameApp
      game={GAME}
      params={params}
      play={(level) => <Play level={level} />}
      finished={() => (
        <Finished game={GAME} className="pb-screen">
          <BuilderEmpty />
        </Finished>
      )}
    />
  );
}
