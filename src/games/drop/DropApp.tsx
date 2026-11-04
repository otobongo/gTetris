import { useEffect, useMemo, useRef } from 'react';
import { go, replace, toHref } from '../../shared/router';
import { activePlayer, gameOf, progressStore, totalStars, useActivePlayer } from '../../shared/progress';
import { LevelCard, Screen } from '../../shared/ui';
import { useProgress } from '../../shared/storage';
import { isLevelOpen } from '../meta';
import { meta } from './meta';
import Play, { DropBar, Well, useCellSize } from './Play';
import { GAME_DONE_NOTE, gameDoneCard } from './puzzles';
import { STAGES, currentStage } from './stages';
import './drop.css';

/**
 * Brick Drop. `#/game/drop` (Home's card) opens the child's current stage (brief 2.6), or the finished
 * state once every stage has stars (2.5). `#/game/drop/<n>` plays stage n (1-based); a stage that
 * does not exist or is still locked goes back to `#/game/drop`. The choice is made when the route
 * changes, so finishing a stage (which moves the current stage on) never pulls the screen away.
 */
export default function DropApp({ params }: { params: string[] }) {
  useProgress(); // unlocks depend on stars
  const player = useActivePlayer();
  const raw = params[0];
  const playerId = player?.id;
  const { target, index } = useMemo(() => {
    if (raw === undefined) {
      const current = currentStage();
      return { target: current === null ? null : `/game/drop/${current + 1}`, index: -1 };
    }
    const n = Number(raw);
    const i = Number.isInteger(n) ? n - 1 : -1;
    // Same rule as the grown-up picker, so every stage it opens also opens here.
    const p = activePlayer(progressStore.getState());
    const open = isLevelOpen(meta, gameOf(p, 'drop'), p?.ageBand, i);
    return { target: open ? null : '/game/drop', index: i };
    // playerId: a different child gets the choice made again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, playerId]);

  useEffect(() => {
    if (target) replace(target);
  }, [target]);

  if (target) return null;
  if (index < 0) return <Finished />;
  return <Play key={index} index={index} />;
}

/**
 * The finished state (brief 2.5): the game's top bar with the game name and no dots, the empty board,
 * and the finished card with the grown-up note. Its button, the Escape key and a scrim tap go Home.
 */
function Finished() {
  const stage = STAGES[STAGES.length - 1];
  const areaRef = useRef<HTMLDivElement>(null);
  const cell = useCellSize(areaRef, stage.cols, stage.rows);
  const player = activePlayer(progressStore.getState());
  const card = gameDoneCard(totalStars(player, 'drop'));
  return (
    <div className="drop-root">
      <Screen className="drop-frame">
        <div className="drop-content" inert>
          <DropBar title="Brick Drop" />
          <div className="drop-area" ref={areaRef}>
            <Well cols={stage.cols} rows={stage.rows} cell={cell} aria-hidden="true" />
          </div>
          <div className="drop-slot" />
        </div>
        <LevelCard
          title={card.title}
          stars={gameOf(player, 'drop').stars[STAGES.length - 1] ?? 0}
          fact={card.fact}
          note={GAME_DONE_NOTE}
          primary={{ label: 'Back to games', href: toHref('/') }}
          onClose={() => go('/')}
        />
      </Screen>
    </div>
  );
}
