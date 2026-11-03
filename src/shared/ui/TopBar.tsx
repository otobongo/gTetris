import type { ReactNode } from 'react';
import { toHref } from '../router';
import { IconButton } from './IconButton';

export interface TopBarProps {
  /** The screen's one h1. */
  title: ReactNode;
  subtitle?: ReactNode;
  /** Route the back button opens ('/' is Home), or null for no back button (Break). */
  back?: string | null;
  /** Accessible name of the back button, such as "Back to home". */
  backLabel?: string;
  /** A 54px control on the right (speaker, restart, hint), or nothing. */
  action?: ReactNode;
  /** Old name for `action`, used by the games. */
  right?: ReactNode;
}

/** Grid 54px / 1fr / 54px: back link, centred title and sub, then an action or an empty slot. */
export function TopBar({ title, subtitle, back = '/', backLabel = 'Back', action, right }: TopBarProps) {
  const end = action ?? right;
  return (
    <header className="bw-topbar">
      {back === null ? <span aria-hidden="true" /> : <IconButton icon="back" label={backLabel} href={toHref(back)} />}
      <div className="bw-topbar__title">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {end ?? <span aria-hidden="true" />}
    </header>
  );
}
