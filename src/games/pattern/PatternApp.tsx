import { Finished } from '../kit/Finished';
import { GameApp } from '../kit/GameApp';
import { GAME } from './game';
import { PatternPlay } from './PatternPlay';
import { Train } from './Train';
import './pattern.css';

/**
 * Pattern Train. `#/game/pattern` opens the child's current level, or the finished state when every level has
 * stars; `#/game/pattern/<n>` plays only the current level (six-games brief 3.1: GameApp decides the route).
 * The default export is what App.tsx's GAME_SCREENS maps to `pattern`. The finished state shows the locomotive
 * on an empty rail behind the level card.
 */
export default function PatternApp({ params }: { params: string[] }) {
  return (
    <GameApp
      game={GAME}
      params={params}
      play={(level) => <PatternPlay level={level} />}
      finished={() => (
        <Finished game={GAME} className="pat">
          <Train slots={[]} />
        </Finished>
      )}
    />
  );
}
