import type { ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export interface PillProps {
  /** panel #30257a (level pills, default); yellow for "New" and "Placeholder"; well for chips on a panel. */
  tone?: 'panel' | 'yellow' | 'well';
  icon?: IconName;
  children: ReactNode;
  className?: string;
}

/** Small rounded label, 14/800. Information only: never a button. */
export function Pill({ tone = 'panel', icon, children, className }: PillProps) {
  return (
    <span className={cx('bw-pill', tone !== 'panel' && `bw-pill--${tone}`, className)}>
      {icon && <Icon name={icon} size={14} strokeWidth={2.8} />}
      {children}
    </span>
  );
}
