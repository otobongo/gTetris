import { useEffect, useRef, useState } from 'react';
import type { GameEntry } from '../games/registry';
import { gameOf, useActivePlayer } from '../shared/progress';
import { toHref } from '../shared/router';
import { say } from '../shared/speech';
import { sfx } from '../shared/sound';
import { Icon, IconButton, PressButton, Screen, TopBar, useLayout } from '../shared/ui';
import ComingSoon from './ComingSoon';
import { lockMessage, planLevels, tileLabel } from './logic/levels';
import './screens.css';

/**
 * Level select, one screen for every playable game (design/canvas/Levels.dc.html, brief 3.2):
 * chapters of tiles (done, current, open, locked) and the big Play button. Reads the game's
 * meta.ts through the registry and the active player's progress.
 */
export default function Levels({ game }: { game: GameEntry }) {
  const player = useActivePlayer();
  const tablet = useLayout().mode === 'tablet';
  const [status, setStatus] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  // On arrival, bring the chapter that holds the current level into view.
  useEffect(() => {
    const sc = scroller.current;
    const cur = sc?.querySelector<HTMLElement>('[aria-current="step"]');
    const section = cur?.closest('section');
    if (sc && cur && section && cur.offsetTop + cur.offsetHeight > sc.scrollTop + sc.clientHeight) {
      sc.scrollTop = Math.max(0, section.offsetTop - 4);
    }
  }, [game.id]);

  if (!game.meta) return <ComingSoon game={game} />;

  const band = player?.ageBand ?? '7-8';
  const small = band === '3-4';
  const reads = band === '3-4' || band === '5-6';
  const plan = planLevels(game.meta, gameOf(player, game.id), band);
  const noun = game.noun;
  const cols = tablet ? (small ? 6 : 8) : small ? 4 : 5;
  const playN = (plan.current ?? 0) + 1;
  const playLabel = `Play ${noun} ${playN}`;
  const doneMsg = `You finished every ${noun.toLowerCase()}! Pick one to play again.`;
  const levelHref = (n: number) => toHref(`/game/${game.id}/${n}`);

  return (
    <Screen>
      <TopBar
        title={game.title}
        subtitle={plan.stars > 0 ? `${plan.stars} of ${plan.maxStars} stars` : 'No stars yet'}
        back="/"
        backLabel="Back to home"
        action={reads ? <IconButton icon="speaker" label="Read this page aloud" onClick={() => say(`${game.title}. ${plan.complete ? doneMsg : playLabel}`)} /> : undefined}
      />

      <div ref={scroller} className="sc-scroll sc-levels">
        {plan.chapters.map((c) => (
          <section key={`${c.title}-${c.tiles[0]?.index ?? 'more'}`} className="sc-chapter">
            <div className="sc-chapter__head">
              <h2 className="sc-h2">{c.title}</h2>
              {c.note && <span className="sc-note">{c.note}</span>}
            </div>
            <div className="sc-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
              {c.tiles.map((t) => {
                const label = tileLabel(t, noun);
                if (t.state === 'locked') {
                  return (
                    <button
                      key={t.index}
                      type="button"
                      className="sc-tile is-locked"
                      aria-disabled="true"
                      aria-label={label}
                      onClick={() => {
                        const msg = lockMessage(plan, t.index, noun);
                        setStatus(msg);
                        if (reads) say(msg);
                      }}
                    >
                      <span className="sc-tile__lock">
                        <Icon name="lock" size={18} strokeWidth={2.4} />
                      </span>
                      <span className="sc-tile__n" aria-hidden="true">
                        {t.n}
                      </span>
                    </button>
                  );
                }
                const current = t.state === 'current';
                return (
                  <a
                    key={t.index}
                    className="sc-tile"
                    data-tone={current ? 'yellow' : 'purple'}
                    href={levelHref(t.n)}
                    aria-label={label}
                    aria-current={current ? 'step' : undefined}
                    onClick={() => sfx.tap()}
                  >
                    <span className="sc-tile__n" aria-hidden="true">
                      {t.n}
                    </span>
                    {current ? (
                      <span aria-hidden="true" style={{ marginLeft: 2, display: 'grid' }}>
                        <Icon name="play" size={16} />
                      </span>
                    ) : (
                      <span className="sc-tile__stars" aria-hidden="true">
                        {[1, 2, 3].map((i) => (
                          <span key={i} className={i <= t.stars ? 'sc-tile__star' : 'sc-tile__star is-off'}>
                            <Icon name="star" size={12} />
                          </span>
                        ))}
                      </span>
                    )}
                  </a>
                );
              })}
              {c.more && <div className="sc-tile sc-tile--more">More soon</div>}
            </div>
          </section>
        ))}
      </div>

      <div className="sc-levels__foot">
        <p role="status" className="sc-status">
          {status || (plan.complete ? doneMsg : '')}
        </p>
        {!plan.complete && (
          <PressButton variant="green" size="xl" icon="play" iconEnd block href={levelHref(playN)}>
            {playLabel}
          </PressButton>
        )}
      </div>
    </Screen>
  );
}
