import type { MouseEvent } from 'react';
import { sfx } from '../sound';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import type { PressVariant } from './PressButton';

export interface IconButtonProps {
  icon: IconName | (string & {});
  /** Accessible name, required: the button shows only an icon. Also the tooltip. */
  label: string;
  /** Navigation: renders a link. */
  href?: string;
  /** Action: renders a button. */
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  /** Small count in the corner, such as hints left. */
  badge?: number | string;
  disabled?: boolean;
  /** purple (default), yellow or green. 'warm' and 'go' are the old names for yellow and green. */
  variant?: PressVariant | 'warm' | 'go';
  /** Toggle buttons only: sets aria-pressed and the pressed look. */
  pressed?: boolean;
  className?: string;
}

const tone = (v: IconButtonProps['variant']): PressVariant => (v === 'warm' ? 'yellow' : v === 'go' ? 'green' : (v ?? 'purple'));

/** 54px raised icon button (radius 16, 26px icon, stroke 2.8), as in every top bar. */
export function IconButton({ icon, label, href, onClick, badge, disabled, variant, pressed, className }: IconButtonProps) {
  const classes = cx('bw-iconbtn', pressed && 'is-pressed', className);
  const inner = (
    <>
      <Icon name={icon} size={26} strokeWidth={2.8} />
      {badge !== undefined && (
        <span className="bw-iconbtn__badge" aria-hidden="true">
          {badge}
        </span>
      )}
    </>
  );
  const name = badge !== undefined ? `${label} (${badge})` : label;
  if (href !== undefined && !disabled) {
    return (
      <a
        className={classes}
        data-tone={tone(variant)}
        href={href}
        aria-label={name}
        title={label}
        onClick={(e) => {
          sfx.tap();
          onClick?.(e);
        }}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={classes}
      data-tone={tone(variant)}
      aria-label={name}
      title={label}
      disabled={disabled}
      aria-pressed={pressed}
      onClick={(e) => {
        sfx.tap();
        onClick?.(e);
      }}
    >
      {inner}
    </button>
  );
}
