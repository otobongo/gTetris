import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { progressStore, useActivePlayer } from '../shared/progress';
import { toHref } from '../shared/router';
import { say } from '../shared/speech';
import { Icon, IconButton, PressButton, Screen, TopBar, useLayout } from '../shared/ui';
import { STICKERS, earnedCount, stickerSource, stickersDue, type Sticker, type StickerPage } from './logic/stickers';
import { Mosaic } from './parts/Art';
import { Overlay } from './parts/Controls';
import './screens.css';

const TABS: { key: StickerPage; label: string }[] = [
  { key: 'games', label: 'Games' },
  { key: 'discoveries', label: 'Discoveries' },
];

const DISCOVERY_HOW = "Today's discovery on Home gives you a sticker. Try a new one each day.";

/** How to get a missing sticker, and where the green button goes. */
function howToGet(st: Sticker): { line: string; cta: string; href: string; play: boolean; from: string } {
  const src = stickerSource(st);
  if (!src) return { line: DISCOVERY_HOW, cta: 'Go to Home', href: '/', play: false, from: "From Today's discovery" };
  if (!src.playable) return { line: `${src.game} is coming soon. Its stickers come with it.`, cta: 'Back to games', href: '/', play: false, from: `From ${src.game}` };
  return { line: `Finish ${src.chapter} in ${src.game} to get this sticker.`, cta: `Play ${src.game}`, href: src.route, play: true, from: `From ${src.game} · ${src.chapter}` };
}

/** Sticker book (design/canvas/Stickers.dc.html, brief 3.3): two pages, earned stickers and outlines for the rest. */
export default function Stickers() {
  const player = useActivePlayer();
  const tablet = useLayout().mode === 'tablet';
  const [tab, setTab] = useState<StickerPage>('games');
  const [openId, setOpenId] = useState<string | null>(null);
  const tabRefs = useRef<Record<StickerPage, HTMLButtonElement | null>>({ games: null, discoveries: null });
  // Stickers that were new when the page opened keep their "New" pill for this visit.
  const [fresh] = useState(() => new Set(Object.entries(player?.stickers ?? {}).filter(([, s]) => !s.seen).map(([id]) => id)));

  useEffect(() => {
    for (const id of stickersDue(player)) progressStore.awardSticker(id, player?.id);
  }, [player]);

  // Leaving the book marks every sticker as seen, so "New" shows once.
  useEffect(() => {
    const id = player?.id;
    return () => {
      if (id) progressStore.markStickersSeen(id);
    };
  }, [player?.id]);

  if (!player) return null;

  const young = player.ageBand === '3-4' || player.ageBand === '5-6';
  const has = (st: Sticker) => !!player.stickers[st.id];
  const total = earnedCount(player);
  const isNew = (st: Sticker) => has(st) && (fresh.has(st.id) || !player.stickers[st.id].seen);
  const onPage = STICKERS.filter((s) => s.page === tab);
  const gotOnPage = onPage.filter(has).length;
  const empty = total === 0;
  const allFound = total === STICKERS.length;
  const pageDone = !empty && gotOnPage === onPage.length;
  const pageLine = empty
    ? tab === 'games'
      ? 'Each game chapter you finish adds a sticker here.'
      : "Today's discovery on Home gives you a sticker."
    : pageDone
      ? 'You found every sticker on this page.'
      : `${gotOnPage} of ${onPage.length} on this page`;
  const open = STICKERS.find((s) => s.id === openId) ?? null;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].key;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <Screen>
      <TopBar
        title="Sticker book"
        subtitle={`${total} of ${STICKERS.length} stickers`}
        back="/"
        backLabel="Back to home"
        action={
          young ? (
            <IconButton icon="speaker" label="Read this page aloud" onClick={() => say(`Sticker book. You have ${total} of ${STICKERS.length} stickers. Tap a sticker to see it.`)} />
          ) : undefined
        }
      />

      <div className="sc-scroll">
        {empty && (
          <section className="sc-empty" aria-labelledby="stk-empty">
            <h2 id="stk-empty" className="sc-panel__title">
              No stickers yet
            </h2>
            <p className="sc-body sc-body--soft">
              Finish a chapter in any game to get your first sticker.
            </p>
            <PressButton variant="green" size="lg" icon="play" iconEnd href={toHref('/')}>
              Play a game
            </PressButton>
          </section>
        )}

        {allFound && (
          <div className="sc-found">
            <span className="sc-star">
              <Icon name="star" size={26} />
            </span>
            Every sticker found!
          </div>
        )}

        <div role="tablist" aria-label="Sticker pages" className="sc-tabs">
          {TABS.map((t, i) => (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[t.key] = el;
              }}
              id={`stk-tab-${t.key}`}
              role="tab"
              type="button"
              className="sc-tab"
              aria-selected={t.key === tab}
              aria-controls="stk-panel"
              tabIndex={t.key === tab ? 0 : -1}
              onClick={() => setTab(t.key)}
              onKeyDown={(e) => onTabKey(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <section id="stk-panel" role="tabpanel" aria-labelledby={`stk-tab-${tab}`} className="sc-album">
          <div className="sc-album__line">
            {pageDone && <Icon name="check" size={18} strokeWidth={2.8} />}
            <span>{pageLine}</span>
          </div>
          <div className={tablet ? 'sc-album__grid sc-album__grid--wide' : 'sc-album__grid'}>
            {onPage.map((st) => {
              const got = has(st);
              const neu = isNew(st);
              const src = stickerSource(st);
              return (
                <button
                  key={st.id}
                  type="button"
                  className="sc-slot"
                  aria-haspopup="dialog"
                  aria-label={got ? `${st.name}${neu ? ', new sticker' : ''}` : `Sticker not found yet, from ${src?.game ?? "Today's discovery"}`}
                  onClick={() => setOpenId(st.id)}
                >
                  <span className={`sc-face ${got ? 'sc-face--got' : 'sc-face--missing'}${neu ? ' sc-settle' : ''}`} aria-hidden="true">
                    <Mosaic sticker={st} got={got} cell={tablet ? 11 : 10} gap={1} />
                  </span>
                  {got && (
                    <span className="sc-slot__name" aria-hidden="true">
                      {st.name}
                    </span>
                  )}
                  {neu && (
                    <span className="sc-slot__new" aria-hidden="true">
                      New
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {open && (
        <StickerCard
          sticker={open}
          got={has(open)}
          young={young}
          onClose={() => {
            window.speechSynthesis?.cancel?.();
            setOpenId(null);
          }}
        />
      )}
    </Screen>
  );
}

function StickerCard({ sticker, got, young, onClose }: { sticker: Sticker; got: boolean; young: boolean; onClose: () => void }) {
  const how = howToGet(sticker);
  const title = got ? sticker.name : 'Not found yet';
  return (
    <Overlay label={title} onClose={onClose}>
      <span className={`sc-face sc-face--big ${got ? 'sc-face--got' : 'sc-face--missing'}`} aria-hidden="true">
        <Mosaic sticker={sticker} got={got} cell={24} gap={2} />
      </span>
      <h2 className="sc-overlay__title">{title}</h2>
      <p className="sc-overlay__text">{got ? how.from : how.line}</p>
      {got ? (
        <div className="sc-overlay__actions">
          <button type="button" className="sc-btn sc-btn--secondary" data-autofocus onClick={() => say(sticker.name)}>
            <span className="sc-btn__inner">
              <Icon name="speaker" size={22} />
              Say the name
            </span>
          </button>
          <button type="button" className="sc-btn sc-btn--secondary sc-btn--fixed" onClick={onClose}>
            Close
          </button>
        </div>
      ) : (
        <>
          <PressButton variant="green" size="lg" block icon={how.play ? 'play' : undefined} iconEnd href={toHref(how.href)} data-autofocus className="sc-overlay__cta">
            {how.cta}
          </PressButton>
          <div className="sc-overlay__actions sc-overlay__actions--tight">
            {young && <IconButton icon="speaker" label="Hear how to get it" onClick={() => say(how.line)} />}
            <button type="button" className="sc-btn sc-btn--secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
}
