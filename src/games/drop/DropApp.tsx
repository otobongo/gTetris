import { useEffect, useMemo, useRef } from 'react';
import { go, replace, toHref } from '../../shared/router';
import { activePlayer, progressStore, totalStars, useActivePlayer } from '../../shared/progress';
import { LevelCard, Screen, TopBar } from '../../shared/ui';
import { useProgress } from '../../shared/storage';
import Play, { Well, useCellSize } from './Play';
import { GAME_DONE_NOTE, gameDoneCard } from './puzzles';
import { STAGES, currentStage } from './stages';
import './drop.css';

/**
 * Brick Drop. `#/game/drop` (Home's card) opens the child's current stage (brief 2.6), or the finished
 * state once every stage has stars (2.5). `#/game/drop/<n>` plays stage n (1-based) only when it is
 * the child's current stage (2.6, 7.4); any other stage, open or not, goes back to `#/game/drop`. A
 * grown-up's pick stores the current stage first, so the stage it opens passes this rule. The choice
 * is made when the route changes, so finishing a stage (which moves the current stage on) never pulls
 * the screen away.
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
    const open = i >= 0 && i === currentStage();
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
          <TopBar title="Brick Drop" backLabel="Back to home" />
          <div className="drop-area" ref={areaRef}>
            <Well cols={stage.cols} rows={stage.rows} cell={cell} aria-hidden="true" />
          </div>
          <div className="drop-slot" />
        </div>
        <LevelCard
          title={card.title}
          total={{ stars: totalStars(player, 'drop'), max: STAGES.length * 3 }}
          fact={card.fact}
          note={GAME_DONE_NOTE}
          primary={{ label: 'Back to games', href: toHref('/') }}
          onClose={() => go('/')}
        />
      </Screen>
    </div>
  );
}
