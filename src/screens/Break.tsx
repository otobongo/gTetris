import { useState } from 'react';
import { dayKey, playToday, progressStore, useActivePlayer, useProgressState } from '../shared/progress';
import { getGame } from '../games/registry';
import { go, parseRoute, splitPath, toHref } from '../shared/router';
import { say } from '../shared/speech';
import { Brick, IconButton, Screen, cx, useLayout, type BrickColor } from '../shared/ui';
import { breakSavedLine } from './logic/levels';
import { getResumePath } from './logic/session';
import { Avatar } from './parts/Art';
import { GrownUpCheck, Segmented } from './parts/Controls';
import { Glyph } from './parts/Glyph';
import './screens.css';

type View = 'break' | 'gate' | 'extend';
const AMOUNTS = ['10', '20', '30'] as const;

/** Bricks that drop into the box once on arrival (board positions, 200 x 140 art). */
const BOX_BRICKS: { color: BrickColor; x: number; y: number; w: number; h: number }[] = [
  { color: 'red', x: 18, y: 52, w: 44, h: 30 },
  { color: 'green', x: 140, y: 48, w: 42, h: 34 },
  { color: 'yellow', x: 48, y: 62, w: 30, h: 22 },
  { color: 'purple', x: 124, y: 62, w: 30, h: 22 },
];

/** "Level 9 is saved with 2 of 4 puzzles solved." when the path Break resumes is a game whose current level has a solved puzzle. */
function midLevelLine(player: Parameters<typeof breakSavedLine>[1]): string | null {
  const route = parseRoute(splitPath(getResumePath()));
  if (route.name !== 'game') return null;
  const game = getGame(route.id);
  return game ? breakSavedLine(game, player) : null;
}

/**
 * Break time (design/canvas/Break.dc.html, brief 3.4). Shown when today's minutes reach the
 * player's limit. No back button. Nothing is read aloud until the speaker button is tapped.
 * A grown-up can add 10, 20 or 30 minutes for today after answering the sum they are asked.
 */
export default function Break() {
  const state = useProgressState();
  const player = useActivePlayer();
  const tablet = useLayout().mode === 'tablet';
  const [view, setView] = useState<View>('break');
  const [amount, setAmount] = useState<(typeof AMOUNTS)[number]>('10');

  if (!player) return null;

  const now = progressStore.now();
  const today = playToday(player, now);
  const played = today.minutes;
  const heading = `Time for a break, ${player.name}`;
  // When the day starts again is [PLACEHOLDER: daily reset time, e.g. midnight on this device]; the store uses the local calendar day.
  const message = `You played ${played} ${played === 1 ? 'minute' : 'minutes'} today. Your bricks will be here tomorrow.`;
  // Mid-level (brief 2.4): the level Break stopped names its solved puzzles; otherwise the general line.
  const saved = midLevelLine(player) ?? 'Your stars and levels are saved for next time.';
  const newToday = Object.values(player.stickers).filter((s) => dayKey(s.earnedAt) === today.day).length;
  const siblings = state.players.length > 1;
  const colClass = cx('sc-break__col', tablet && 'sc-break__col--wide');

  const addTime = () => {
    progressStore.addExtraMinutes(Number(amount), player.id);
    go(getResumePath());
  };

  return (
    <Screen className="sc-break">
      <div className="sc-break__top">
        {view === 'break' && <IconButton icon="speaker" label="Read it aloud" onClick={() => say(`${heading}. ${message} ${saved}`)} />}
      </div>

      {view === 'break' && <div className="sc-spacer" />}

      <div className={colClass}>
        <div className="sc-break__art" aria-hidden="true">
          <span className="sc-break__lid" />
          {BOX_BRICKS.map((b, i) => (
            <Brick
              key={b.color}
              color={b.color}
              stud={15}
              width={b.w}
              height={b.h}
              className="sc-drop"
              style={{ position: 'absolute', left: b.x, top: b.y, ['--delay' as string]: `${i * 40}ms` }}
            />
          ))}
          <span className="sc-break__kid" data-brick={player.color}>
            <span className="sc-break__stud" style={{ left: 16 }} />
            <span className="sc-break__stud" style={{ right: 16 }} />
            <Avatar name={player.name} color={player.color} size={64} radius={20} fontSize={32} />
          </span>
          <span className="sc-break__box">
            {(['red', 'yellow', 'green', 'blue'] as const).map((c) => (
              <span key={c} className="sc-break__logo" data-brick={c} />
            ))}
          </span>
        </div>

        <h1>{heading}</h1>
        <p className="sc-break__msg">{message}</p>

        {view === 'break' && (
          <>
            <p className="sc-saved">
              <Glyph name="saved" size={26} />
              <span>{saved}</span>
            </p>
            {newToday > 0 && (
              <div className="sc-chips" role="group" aria-label="Today">
                <span className="sc-chip">
                  <Glyph name="sticker" size={18} strokeWidth={2.2} />
                  {newToday} {newToday === 1 ? 'new sticker' : 'new stickers'}
                </span>
              </div>
            )}
            <p className="sc-break__try">Build something with real bricks and show a grown-up.</p>
          </>
        )}
      </div>

      <div className="sc-spacer" />

      {view === 'break' && (
        <div className={cx(colClass, 'sc-break__foot')}>
          {siblings && (
            <a className="sc-btn sc-btn--secondary sc-btn--switch" href={toHref('/players')}>
              Switch player
            </a>
          )}
          <button type="button" className="sc-textlink" onClick={() => setView('gate')}>
            Grown-ups: add time
          </button>
        </div>
      )}

      {view === 'gate' && (
        <div className={cx(colClass, 'sc-break__panel')}>
          <GrownUpCheck onPass={() => setView('extend')} onCancel={() => setView('break')} />
        </div>
      )}

      {view === 'extend' && (
        <section className={cx(colClass, 'sc-panel sc-break__panel sc-break__extend')} aria-labelledby="brk-ext">
          <h2 id="brk-ext" className="sc-panel__title">
            Add time for {player.name} today
          </h2>
          {today.extraMinutes > 0 && (
            <p className="sc-sub">
              {player.name} had {today.extraMinutes} extra minutes today.
            </p>
          )}
          <Segmented
            label="Extra minutes"
            value={amount}
            onChange={setAmount}
            options={AMOUNTS.map((m) => ({ value: m, label: `${m} min`, name: `${m} minutes` }))}
          />
          <button type="button" className="sc-btn sc-btn--go sc-btn--lg" onClick={addTime}>
            Add {amount} minutes
          </button>
          <button type="button" className="sc-btn sc-btn--flat sc-btn--md" onClick={() => setView('break')}>
            Keep the break
          </button>
          <p className="sc-helper">
            Only for today. Change the daily limit in{' '}
            <a href={toHref('/settings')} className="sc-inline-link">
              Settings
            </a>
            .
          </p>
        </section>
      )}
    </Screen>
  );
}
