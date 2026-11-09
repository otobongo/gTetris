import { Finished } from '../kit/Finished';
import { GameApp } from '../kit/GameApp';
import { MATH } from './game';
import { Play } from './Play';
import { BricksPanel, Display } from './parts';
import { EMPTY_FRAMES } from './puzzles';
import './calc.css';

/**
 * Brick Calculator. `#/game/math` opens the child's current level at its next unsolved puzzle, or the
 * finished state, where the display shows only "?" and the two ten-frames are empty behind the card
 * (six-games brief 3.1, 4.5: GameApp decides the route). The default export is what App.tsx's
 * GAME_SCREENS maps to `math`.
 */
export default function MathApp({ params }: { params: string[] }) {
  return (
    <GameApp
      game={MATH}
      params={params}
      play={(level) => <Play level={level} />}
      finished={() => (
        <Finished game={MATH} className="calc-screen">
          <Display puzzle={null} entry="" solved={false} />
          <BricksPanel puzzle={null} cells={EMPTY_FRAMES} solved={false} />
        </Finished>
      )}
    />
  );
}
