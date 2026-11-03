/* Components the games' current screens use, kept as they were until the games move to the
   new screens (Levels replaces LevelGrid; the win card replaces ResultCard). They use the
   classes in src/styles/global.css. */
import type { ReactNode } from 'react';
import { sfx } from '../sound';

export function Stars({ value, max = 3 }: { value: number; max?: number }) {
  return (
    <span className="stars" aria-label={`${value} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} className={`star${i < value ? ' is-on' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" />
        </svg>
      ))}
    </span>
  );
}

export function ResultCard({
  title,
  message,
  stars,
  children,
}: {
  title: string;
  message?: ReactNode;
  stars?: number;
  children: ReactNode;
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="card">
        <h2>{title}</h2>
        {stars !== undefined && <Stars value={stars} />}
        {message && <p>{message}</p>}
        <div className="card__actions">{children}</div>
      </div>
    </div>
  );
}

/** Simple level picker shared by every game. */
export function LevelGrid({
  count,
  starsOf,
  unlocked,
  onPick,
  label = (i) => String(i + 1),
  offset = 0,
}: {
  count: number;
  starsOf: (i: number) => number;
  unlocked: (i: number) => boolean;
  onPick: (i: number) => void;
  label?: (i: number) => ReactNode;
  offset?: number;
}) {
  return (
    <div className="level-grid">
      {Array.from({ length: count }, (_, k) => {
        const i = k + offset;
        const open = unlocked(i);
        const s = starsOf(i);
        const isNext = open && s === 0;
        return (
          <button
            key={i}
            className={`level-tile${isNext ? ' is-next' : ''}`}
            disabled={!open}
            onClick={() => {
              sfx.tap();
              onPick(i);
            }}
            aria-label={`Level ${i + 1}${open ? `, ${s} stars` : ', locked'}`}
          >
            {open ? label(i) : '🔒'}
            {open && <Stars value={s} />}
          </button>
        );
      })}
    </div>
  );
}
