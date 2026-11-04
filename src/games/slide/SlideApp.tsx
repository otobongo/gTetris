import { useEffect } from 'react';
import { go, replace } from '../../shared/router';
import { gameOf, useActivePlayer } from '../../shared/progress';
import { starsFor, totalStars, useProgress } from '../../shared/storage';
import { LevelGrid, Screen, TopBar } from '../../shared/ui';
import { isLevelOpen } from '../meta';
import { CHAPTERS, LEVELS } from './levels';
import { meta } from './meta';
import SlideGame from './SlideGame';
import './slide.css';

/**
 * Brick Escape. With a level number it opens that level's board. Without one it shows a plain level list,
 * which stays until the Levels screen (game/escape/levels) takes over.
 */
export default function SlideApp({ params }: { params: string[] }) {
  useProgress(); // re-render when stars change
  const player = useActivePlayer();
  // Same rule as the Levels screen, so every tile it shows open also opens here.
  const unlocked = (i: number) => isLevelOpen(meta, gameOf(player, 'escape'), player?.ageBand, i);

  const n = Number(params[0]);
  const playable = Number.isInteger(n) && n >= 1 && n <= LEVELS.length && unlocked(n - 1);
  const bounce = params.length > 0 && !playable;
  useEffect(() => {
    if (bounce) replace('/game/escape/levels');
  }, [bounce]);

  if (playable) return <SlideGame key={n} index={n - 1} />;
  if (bounce) return null;

  return (
    <Screen fit="content">
      <TopBar title="Brick Escape" subtitle={`${totalStars('slide')} of ${LEVELS.length * 3} stars`} back="/game/escape/levels" backLabel="Back to levels" />
      {CHAPTERS.filter((ch) => ch.from < LEVELS.length && ch.to > ch.from).map((ch) => (
        <section key={ch.title} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="section-title">
            {ch.title} <small>{ch.note}</small>
          </h2>
          <LevelGrid
            count={Math.min(ch.to, LEVELS.length) - ch.from}
            offset={ch.from}
            starsOf={(i) => starsFor('slide', i)}
            unlocked={unlocked}
            onPick={(i) => go(`/game/escape/${i + 1}`)}
          />
        </section>
      ))}
    </Screen>
  );
}
