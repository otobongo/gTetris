import type { ReactNode } from 'react';
import { cx } from '../../shared/ui';
import './kit.css';

/**
 * prompt (Shape Sorter, Number Line-up): 18px 800 in the text colour, the line saying what to do.
 * help (Color Mixer, Pattern Train, Brick Calculator, Picture Builder): 16px 700 in --bw-text-2.
 */
export type HelpLineStyle = 'prompt' | 'help';

export interface HelpRowProps {
  /** The line in the middle cell. It is a `role="status"` region, so each change is announced. */
  line: ReactNode;
  /** Defaults to 'help'. */
  lineStyle?: HelpLineStyle;
  /** Prompt style only: a wrong-answer line, drawn in --bw-error-text. */
  wrong?: boolean;
  /** The right cell: Number Line-up's Hint button, or nothing. */
  hint?: ReactNode;
  /** The left cell: the green New puzzle button while the stuck offer shows, or nothing. */
  offer?: ReactNode;
  className?: string;
}

/**
 * Letter Builder's help row, shared by the kit games (brief 3.1, 7.2): grid 54 / 1fr / 54, the offer
 * on the left, the hint on the right, the line in the middle. Markup order is line, hint, offer, so the
 * offer is last to tab to while CSS draws it first (four-puzzle section 10). The cells are always
 * there, so the line never shifts when the offer comes and goes.
 */
export function HelpRow({ line, lineStyle = 'help', wrong, hint, offer, className }: HelpRowProps) {
  return (
    <div className={cx('bw-helprow', className)}>
      <p className={cx('bw-helprow__line', `bw-helprow__line--${lineStyle}`, wrong && lineStyle === 'prompt' && 'is-wrong')} role="status">
        {line}
      </p>
      <span className="bw-helprow__hint">{hint}</span>
      <span className="bw-helprow__offer">{offer}</span>
    </div>
  );
}
