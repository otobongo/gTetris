import { useEffect, useRef, useState } from 'react';
import type { GameEntry } from '../games/registry';
import { gameOf, progressStore, useProgressState } from '../shared/progress';
import { go } from '../shared/router';
import { sfx } from '../shared/sound';
import { Icon, PressButton, Screen, TopBar, cx, useLayout } from '../shared/ui';
import { pickerCopy, planLevels, tileLabel } from './logic/levels';
import { settingsReturn } from './logic/session';
import { Overlay } from './parts/Controls';
import './screens.css';

/**
 * The grown-up level picker (design/canvas/Levels.dc.html, brief 7.3), at
 * '#/settings/levels/<game>/<playerId>' behind the grown-up check. Children never see it.
 * Any tile can be picked, locked ones too (user decision 4). The footer saves the pick: for the
 * active player it opens the game at that level, for another child it returns to Settings with a
 * toast. The panel at the end of the list resets this one game; stickers stay (user decision 5).
 */
export default function Levels({ game, playerId }: { game: GameEntry; playerId: string }) {
  const state = useProgressState();
  const tablet = useLayout().mode === 'tablet';
  const kid = state.players.find((p) => p.id === playerId) ?? null;
  const [picked, setPicked] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  // Back to Settings shows the same child.
  useEffect(() => {
    settingsReturn.setChild(playerId);
  }, [playerId]);

  // On arrival, bring the chapter that holds the current level into view.
  useEffect(() => {
    const sc = scroller.current;
    const cur = sc?.querySelector<HTMLElement>('[aria-current="step"]');
    const section = cur?.closest('section');
    if (sc && cur && section && cur.offsetTop + cur.offsetHeight > sc.scrollTop + sc.clientHeight) {
      sc.scrollTop = Math.max(0, section.offsetTop - 4);
    }
  }, [game.id]);

  if (!kid || !game.meta) return null; // App sends an unknown game or child back to Settings.

  const meta = game.meta;
  const active = state.activePlayerId === kid.id;
  const plan = planLevels(meta, gameOf(kid, game.id), kid.ageBand);
  const copy = pickerCopy(game, kid, active);
  const noun = game.noun;
  const target = picked ?? plan.current;

  const pick = (index: number) => {
    sfx.tap();
    setPicked(index);
    setToast('');
  };

  const save = () => {
    if (target === null) return;
    progressStore.pickLevel(game.id, target, meta.levelCount, kid.id);
    if (active) {
      go(`/game/${game.id}/${target + 1}`);
      return;
    }
    settingsReturn.setToast(copy.toast(target));
    go('/settings');
  };

  const reset = () => {
    progressStore.resetGame(game.id, kid.id);
    setConfirm(false);
    setPicked(null);
    setToast(copy.reset.toast);
  };

  return (
    <Screen>
      <TopBar title={game.title} subtitle={copy.sub} back="/settings" backLabel="Back to settings" />
      <p className="sc-sub sc-picker__intro">{copy.intro}</p>

      <div ref={scroller} className="sc-scroll sc-levels">
        {plan.chapters.map((c) => (
          <section key={`${c.title}-${c.tiles[0]?.index ?? 'more'}`} className="sc-chapter">
            <div className="sc-chapter__head">
              <h2 className="sc-h2">{c.title}</h2>
              {c.note && <span className="sc-note">{c.note}</span>}
            </div>
            <div className="sc-grid" style={{ gridTemplateColumns: `repeat(${tablet ? 8 : 5}, minmax(0, 1fr))` }}>
              {c.tiles.map((t) => {
                const locked = t.state === 'locked';
                const current = t.state === 'current';
                return (
                  <button
                    key={t.index}
                    type="button"
                    className={cx('sc-tile', locked && 'is-locked')}
                    data-tone={locked ? undefined : current ? 'yellow' : 'purple'}
                    aria-label={tileLabel(t, noun, kid.name)}
                    aria-pressed={picked === t.index}
                    aria-current={current ? 'step' : undefined}
                    onClick={() => pick(t.index)}
                  >
                    {locked ? (
                      <>
                        <span className="sc-tile__lock">
                          <Icon name="lock" size={18} strokeWidth={2.4} />
                        </span>
                        <span className="sc-tile__n" aria-hidden="true">
                          {t.n}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="sc-tile__n sc-tile__n--row" aria-hidden="true">
                          {t.n}
                          {current && <Icon name="play" size={16} />}
                        </span>
                        {(!current || t.stars > 0) && (
                          <span className="sc-tile__stars" aria-hidden="true">
                            {[1, 2, 3].map((i) => (
                              <span key={i} className={i <= t.stars ? 'sc-tile__star' : 'sc-tile__star is-off'}>
                                <Icon name="star" size={12} />
                              </span>
                            ))}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );
              })}
              {c.more && <div className="sc-tile sc-tile--more">More soon</div>}
            </div>
          </section>
        ))}

        <section className="sc-panel sc-picker__reset" aria-labelledby="pick-reset">
          <h2 id="pick-reset" className="sc-panel__title sc-panel__title--sm">
            {copy.reset.heading}
          </h2>
          <p className="sc-helper">{copy.reset.helper}</p>
          <button type="button" className="sc-btn sc-btn--outline-danger" onClick={() => setConfirm(true)}>
            {copy.reset.button}
          </button>
        </section>
      </div>

      <div className="sc-levels__foot">
        <p role="status" className={toast ? 'sc-toast sc-toast--inline' : 'sc-status sc-status--strong'}>
          {toast || copy.status(picked)}
        </p>
        {target !== null && (
          <PressButton variant="green" size="xl" icon={active ? 'play' : undefined} iconEnd block onClick={save}>
            {copy.button(target)}
          </PressButton>
        )}
      </div>

      {confirm && (
        <Overlay role="alertdialog" label={copy.reset.title} describedBy="pick-reset-body" onClose={() => setConfirm(false)}>
          <h2 className="sc-overlay__title">{copy.reset.title}</h2>
          <p id="pick-reset-body" className="sc-sub">
            {copy.reset.body}
          </p>
          <div className="sc-overlay__actions">
            <button type="button" className="sc-btn sc-btn--flat sc-btn--md" data-autofocus onClick={() => setConfirm(false)}>
              Keep it
            </button>
            <button type="button" className="sc-btn sc-btn--danger sc-btn--md" onClick={reset}>
              {copy.reset.go}
            </button>
          </div>
        </Overlay>
      )}
    </Screen>
  );
}
