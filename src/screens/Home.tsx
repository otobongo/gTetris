import { useEffect } from 'react';
import { GAMES } from '../games/registry';
import { gameOf, progressStore, totalStars, useActivePlayer } from '../shared/progress';
import { toHref } from '../shared/router';
import { Icon, IconButton, Pill, Screen, cx, useLayout } from '../shared/ui';
import { homePill } from './logic/levels';
import { grownUpGate } from './logic/session';
import { STICKERS, earnedCount, stickersDue } from './logic/stickers';
import { Avatar, GameArt } from './parts/Art';
import './screens.css';

/** Home (design/canvas/Hub.dc.html, brief 3.6): greeting, sticker line, Today's discovery, all nine games. */
export default function Home() {
  const player = useActivePlayer();
  const tablet = useLayout().mode === 'tablet';

  useEffect(() => {
    grownUpGate.reset();
  }, []);

  // Chapters finished since the last visit turn into stickers.
  useEffect(() => {
    for (const id of stickersDue(player)) progressStore.awardSticker(id, player?.id);
  }, [player]);

  if (!player) return null; // App sends a missing player to Who's playing.

  const stars = totalStars(player);
  const stickers = earnedCount(player);

  return (
    <Screen padding="home" gap={14}>
      <header className="sc-home__head">
        <a className="sc-avatar-link" href={toHref('/players')} aria-label="Switch player">
          <Avatar name={player.name} color={player.color} size={54} radius={16} fontSize={28} />
        </a>
        <div className="sc-home__hello">
          <h1>Hi {player.name}!</h1>
          <a
            className="sc-stats"
            href={toHref('/stickers')}
            aria-label={`${stars} ${stars === 1 ? 'star' : 'stars'} and ${stickers} of ${STICKERS.length} stickers. Open the sticker book`}
          >
            <span className="sc-star">
              <Icon name="star" size={15} />
            </span>
            <span>
              {stars} {stars === 1 ? 'star' : 'stars'} · {stickers}/{STICKERS.length} stickers
            </span>
            <Icon name="chevronRight" size={16} strokeWidth={2.8} />
          </a>
        </div>
        <IconButton icon="gear" label="Settings for grown-ups" href={toHref('/settings')} />
      </header>

      <div className="sc-scroll sc-home__scroll">
        {/* Today's discovery: the board's sample question. It opens Color Mixer, which is not built yet. */}
        <a className="sc-discovery" href={toHref('/game/mixer/levels')}>
          <span className="sc-art" aria-hidden="true" style={{ width: 56, height: 44 }}>
            <span className="sc-art__piece sc-art__disc" data-brick="red" style={{ left: 0, top: 4, width: 34, height: 34, opacity: 0.9 }} />
            <span className="sc-art__piece sc-art__disc sc-art__blend" data-brick="blue" style={{ left: 20, top: 4, width: 34, height: 34, opacity: 0.85 }} />
          </span>
          <span className="sc-discovery__text">
            <span className="sc-discovery__kicker">Today's discovery</span>
            <span className="sc-discovery__title">What do red and blue make?</span>
          </span>
          <span className="sc-discovery__reward">+1 sticker</span>
        </a>

        <h2 className="sc-h2 sc-home__games-h">Games</h2>
        <ul className={cx('sc-games', tablet && 'sc-games--two')}>
          {GAMES.map((g) => {
            const pill = homePill(g.meta, gameOf(player, g.id), player.ageBand, g.noun);
            return (
              <li key={g.id}>
                <a className={cx('sc-gamecard', !g.playable && 'is-soon')} href={toHref(g.route)} aria-label={`${g.title}. ${g.sub}. ${pill}`}>
                  <GameArt art={g.art} />
                  <span className="sc-gamecard__title">{g.title}</span>
                  <span className="sc-gamecard__sub">{g.sub}</span>
                  <Pill>{pill}</Pill>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </Screen>
  );
}
