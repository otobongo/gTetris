import { cx } from './cx';

/** The caption under the sand timer, the same in every game. */
export const SAND_CAPTION = 'A gentle sand timer for fun. It never costs a star.';

/** How full the sand bar is, 0 to 100 (percent). An empty or broken total shows an empty bar. */
export function sandFill(elapsed: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(elapsed)) return 0;
  return Math.round(Math.min(1, Math.max(0, elapsed / total)) * 100);
}

export interface SandTimerProps {
  /** Seconds played so far. */
  elapsed: number;
  /** Seconds until the bar is full. The bar then stays full; nothing else happens. */
  total: number;
  className?: string;
}

/**
 * The relaxed timer (decision D3), shared by Brick Escape and Brick Drop: an hourglass and a bar that
 * fills with sand, with no digits, and a caption saying it never costs a star.
 */
export function SandTimer({ elapsed, total, className }: SandTimerProps) {
  return (
    <div className={cx('bw-sand', className)}>
      <div className="bw-sand__row">
        <svg className="bw-sand__glass" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
        </svg>
        <span className="bw-sand__track" aria-hidden="true">
          <span className="bw-sand__fill" style={{ width: `${sandFill(elapsed, total)}%` }} />
        </span>
      </div>
      <p className="bw-sand__caption">{SAND_CAPTION}</p>
    </div>
  );
}
