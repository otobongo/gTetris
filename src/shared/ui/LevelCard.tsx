import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent } from 'react';
import { Icon } from './Icon';
import { PressButton } from './PressButton';

/** The level card opens this long after the last dot fills (brief 2.1 step 5, section 8). */
export const LEVEL_CARD_DELAY_MS = 600;

/** One of the card's buttons: a link when `href` is given (Back to games), otherwise a button. */
export interface LevelCardAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface LevelCardProps {
  /** "You finished Level 9", "You finished every level!" */
  title: string;
  /** Stars this level earned, 0 to 3. Leave out to show no star row. */
  stars?: number;
  /**
   * The game's star total, in place of the level's star row: the finished state on a later visit shows
   * "78 of 93" with one star (user decision D6), never the last level's stars.
   */
  total?: { stars: number; max: number };
  /** The fact line, which also describes the dialog: "4 puzzles in 31 moves." */
  fact: string;
  /** The star rule line: "3 stars: 28 moves or fewer. 2 stars: 36 or fewer." */
  rule?: string;
  /** The cap line, only when a cap applied (stars.ts capRule). */
  cap?: string;
  /** A last line, as the finished state's "A grown-up can pick a level to play again." */
  note?: string;
  /** The green button: "Play Level 10", or "Back to games" on the finished card. Focus starts here. */
  primary: LevelCardAction;
  /** The secondary button under it: "Back to games". */
  secondary?: LevelCardAction;
  /**
   * The Escape key and a tap on the scrim. Between levels the game then shows the same Play button in
   * its controls slot and moves focus there; on the finished card this goes Home.
   */
  onClose: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * The one card between two levels, and the finished card (brief 2.1, 2.5, 7.1, 8, 10). A modal dialog
 * inside the screen frame, so on a tablet it scales with the screen like the other game cards:
 * labelled by its title, described by its fact line, focus starts on the primary button and stays
 * inside. It does not hand focus back on close; the game places it (brief 10).
 */
export function LevelCard({ title, stars, total, fact, rule, cap, note, primary, secondary, onClose }: LevelCardProps) {
  const id = useId();
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (card.current?.querySelector<HTMLElement>('[data-autofocus]') ?? card.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !card.current) return;
    const items = [...card.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const head = items[0];
    const tail = items[items.length - 1];
    if (e.shiftKey && document.activeElement === head) {
      e.preventDefault();
      tail.focus();
    } else if (!e.shiftKey && document.activeElement === tail) {
      e.preventDefault();
      head.focus();
    }
  };

  const onScrim = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const shown = stars === undefined || total ? null : Math.min(3, Math.max(0, Math.round(Number.isFinite(stars) ? stars : 0)));
  const whole = (n: number) => Math.max(0, Math.round(Number.isFinite(n) ? n : 0));

  return (
    <div className="bw-levelcard-scrim" onClick={onScrim} onKeyDown={onKeyDown}>
      <div ref={card} className="bw-levelcard" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-fact`}>
        <h2 id={`${id}-title`} className="bw-levelcard__title">
          {title}
        </h2>
        {shown !== null && (
          <div className="bw-levelcard__stars" role="img" aria-label={`${shown} of 3 stars`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < shown ? 'is-on' : undefined}>
                <Icon name="star" size={48} />
              </span>
            ))}
          </div>
        )}
        {total && (
          <div className="bw-levelcard__total" role="img" aria-label={`${whole(total.stars)} of ${whole(total.max)} stars`}>
            <span className="bw-levelcard__total-star">
              <Icon name="star" size={48} />
            </span>
            <span className="bw-levelcard__total-count" aria-hidden="true">
              {whole(total.stars)} of {whole(total.max)}
            </span>
          </div>
        )}
        <p id={`${id}-fact`} className="bw-levelcard__fact">
          {fact}
        </p>
        {rule && <p className="bw-levelcard__line">{rule}</p>}
        {cap && <p className="bw-levelcard__line">{cap}</p>}
        {note && <p className="bw-levelcard__line">{note}</p>}
        <div className="bw-levelcard__actions">
          <CardButton action={primary} primary />
          {secondary && <CardButton action={secondary} />}
        </div>
      </div>
    </div>
  );
}

function CardButton({ action, primary }: { action: LevelCardAction; primary?: boolean }) {
  const common = {
    variant: primary ? ('green' as const) : ('purple' as const),
    size: primary ? ('lg' as const) : ('md' as const),
    block: true,
    className: primary ? undefined : 'bw-levelcard__secondary',
    'data-autofocus': primary ? true : undefined,
  };
  return action.href !== undefined ? (
    <PressButton {...common} href={action.href} onClick={action.onClick}>
      {action.label}
    </PressButton>
  ) : (
    <PressButton {...common} onClick={action.onClick}>
      {action.label}
    </PressButton>
  );
}
