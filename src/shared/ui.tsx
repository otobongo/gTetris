import type { ReactNode } from 'react';
import { go } from './router';
import { sfx } from './sound';

/* ---------- Icons (inline SVG, stroke-based, inherit currentColor) ---------- */
const paths: Record<string, ReactNode> = {
  back: <path d="M15 5l-7 7 7 7" />,
  restart: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v5h5" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </>
  ),
  pause: (
    <>
      <path d="M9 5v14" />
      <path d="M15 5v14" />
    </>
  ),
  play: <path d="M8 5l11 7-11 7z" fill="currentColor" />,
  hint: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M17 8a5 5 0 0 1 0 8" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M17 9l5 6M22 9l-5 6" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16.5 9.5a3.5 3.5 0 0 1 0 5" />
      <path d="M19 7a7 7 0 0 1 0 10" />
    </>
  ),
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  down: <path d="M5 9l7 7 7-7" />,
  rotate: (
    <>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4v5h-5" />
    </>
  ),
  drop: (
    <>
      <path d="M6 5l6 6 6-6" />
      <path d="M6 12l6 6 6-6" />
    </>
  ),
  hold: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="3" />
      <path d="M9 12h6" />
    </>
  ),
  shuffle: (
    <>
      <path d="M4 7h3c5 0 5 10 10 10h3" />
      <path d="M4 17h3c2 0 3-1.5 4-3.5" />
      <path d="M13 9.5c1-2 2-2.5 4-2.5h3" />
      <path d="M18 4l3 3-3 3M18 14l3 3-3 3" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v10h12V10" />
    </>
  ),
};

export function Icon({ name, size = 26 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  badge,
  disabled,
  variant,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  badge?: number | string;
  disabled?: boolean;
  variant?: 'go' | 'warm';
}) {
  return (
    <button
      className={`btn btn--icon${variant ? ` btn--${variant}` : ''}`}
      style={{ position: 'relative' }}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => {
        sfx.tap();
        onClick();
      }}
    >
      <Icon name={icon} />
      {badge !== undefined && <span className="badge">{badge}</span>}
    </button>
  );
}

export function TopBar({
  title,
  subtitle,
  back = '/',
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  right?: ReactNode;
}) {
  return (
    <header className="topbar">
      <IconButton icon="back" label="Back" onClick={() => go(back)} />
      <div className="topbar__title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div>{right}</div>
    </header>
  );
}

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
