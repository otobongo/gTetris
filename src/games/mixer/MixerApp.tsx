import { Finished } from '../kit/Finished';
import { GameApp } from '../kit/GameApp';
import { Bowl, Slot } from './Board';
import { EMPTY_SLOT_LABEL, bowlName, slotName } from './copy';
import { GAME } from './game';
import { MixerPlay } from './MixerPlay';
import './mixer.css';

/**
 * Color Mixer. `#/game/mixer` opens the child's current level, or the finished state when every level has
 * stars; `#/game/mixer/<n>` plays only the current level (six-games brief 3.1: GameApp decides the route).
 * The default export is what App.tsx's GAME_SCREENS maps to `mixer`.
 */
export default function MixerApp({ params }: { params: string[] }) {
  return (
    <GameApp
      game={GAME}
      params={params}
      play={(level) => <MixerPlay level={level} />}
      finished={() => (
        <Finished game={GAME} className="mix-screen">
          <div className="mix-slots">
            <Slot paint={null} label={EMPTY_SLOT_LABEL[0]} name={slotName(0, null, false)} />
            <span className="mix-plus" aria-hidden="true">+</span>
            <Slot paint={null} label={EMPTY_SLOT_LABEL[1]} name={slotName(1, null, false)} />
          </div>
          <Bowl color={null} name={bowlName(null)} />
        </Finished>
      )}
    />
  );
}
