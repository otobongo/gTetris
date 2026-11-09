import type { ReactNode } from 'react';
import { totalStars, useActivePlayer } from '../../shared/progress';
import { go, toHref } from '../../shared/router';
import { LevelCard, Screen, TopBar, cx } from '../../shared/ui';
import { BACK_TO_GAMES, BACK_TO_HOME, GAME_DONE_NOTE, GAME_DONE_TITLE, gameDoneFact } from './copy';
import type { KitGame } from './levelRun';
import './kit.css';

const HOME = '/';

export interface FinishedProps {
  /** The kit game: its title names the top bar, its id and level count give the star total. */
  game: Pick<KitGame<unknown>, 'id' | 'meta' | 'title'>;
  /**
   * The game's empty play area, drawn behind the scrim with no controls (Mixer: the empty slots and
   * bowl; Sorter: the empty holes and tray well; Numbers: the empty tower well). Hidden from assistive
   * tech and inert, since the card is the only thing on this screen.
   */
  children?: ReactNode;
  /** Classes on the screen frame (the game's own screen class, so its CSS variables apply). */
  className?: string;
}

/**
 * The finished state on `#/game/<id>` once every level has stars (four-puzzle 2.5, D6; brief 3.1): the
 * top bar with the game's title and no dots or speaker, the game's empty play area, and the level card
 * with the star total ("24 of 27"), "9 levels, 24 of 27 stars.", the grown-up note and one button,
 * Back to games. The button, the Escape key and the scrim all go Home: there is nothing behind the card
 * to return to (four-puzzle section 10).
 */
export function Finished({ game, children, className }: FinishedProps) {
  const player = useActivePlayer();
  const stars = totalStars(player, game.id);
  const levels = game.meta.levelCount;
  return (
    <Screen className={cx('bw-play', className)} gap={14}>
      <TopBar title={game.title} backLabel={BACK_TO_HOME} />
      <div className="bw-play__body" aria-hidden="true" inert>
        {children}
      </div>
      <LevelCard
        title={GAME_DONE_TITLE}
        total={{ stars, max: levels * 3 }}
        fact={gameDoneFact(levels, stars)}
        note={GAME_DONE_NOTE}
        primary={{ label: BACK_TO_GAMES, href: toHref(HOME) }}
        onClose={() => go(HOME)}
      />
    </Screen>
  );
}
