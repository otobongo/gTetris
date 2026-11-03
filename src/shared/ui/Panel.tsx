import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /** flat #30257a for information (default); well #1d1550 for a slot or the album page. */
  tone?: 'flat' | 'well';
  /** Panel heading (18/800). */
  heading?: ReactNode;
  headingLevel?: 2 | 3;
  /** section (default) when it has a heading, div otherwise. */
  as?: 'section' | 'div' | 'aside';
  children?: ReactNode;
}

/** Flat information surface, radius 20, padding 16. Never put a panel inside a panel. */
export function Panel({ tone = 'flat', heading, headingLevel = 2, as, children, className, ...rest }: PanelProps) {
  const Tag = as ?? (heading ? 'section' : 'div');
  const H = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <Tag {...rest} className={cx('bw-panel', tone === 'well' && 'bw-panel--well', className)}>
      {heading && <H className="bw-panel__heading">{heading}</H>}
      {children}
    </Tag>
  );
}
