import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { sfx } from '../sound';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export type PressVariant = 'purple' | 'yellow' | 'green';
export type PressSize = 'sm' | 'md' | 'lg' | 'xl';

interface CommonProps {
  /** purple: raised tile (default). yellow: accent and current. green: the one Play or primary action. */
  variant?: PressVariant;
  /** sm 15px / 44px tall, md 17px / 48px, lg 20px / 56px, xl 24px / 64px (the big Play button). */
  size?: PressSize;
  /** Icon beside the label (decorative; the label names the control). */
  icon?: IconName;
  /** Put the icon after the label, as on "Play Level 9 >". */
  iconEnd?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  /** Toggle buttons: shows the pressed-down look and sets aria-pressed. */
  pressed?: boolean;
  /** Shows `loadingLabel` in place of the label, keeps the button's width, and ignores taps. */
  loading?: boolean;
  loadingLabel?: ReactNode;
  /** Skip the tap sound. */
  silent?: boolean;
  children: ReactNode;
  className?: string;
}

type AsLink = CommonProps & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | 'href'>;
type AsButton = CommonProps & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>;
export type PressButtonProps = AsLink | AsButton;

const iconSize: Record<PressSize, number> = { sm: 18, md: 20, lg: 22, xl: 22 };

/**
 * The raised brick button: if it looks like a brick, you can press it. A link when `href` is
 * given (navigation), otherwise a button (action). Press moves it down 3px over 100ms.
 */
export function PressButton(props: PressButtonProps) {
  const { variant = 'purple', size = 'lg', icon, iconEnd, block, pressed, loading, loadingLabel, silent, children, className, ...rest } = props;
  const classes = cx('bw-press', `bw-press--${size}`, block && 'bw-press--block', pressed && 'is-pressed', loading && 'is-loading', className);
  const glyph = icon ? <Icon name={icon} size={iconSize[size]} strokeWidth={2.8} /> : null;
  const label = (
    <span className="bw-press__label">
      <span className="bw-press__text" aria-hidden={loading || undefined}>
        {!iconEnd && glyph}
        {children}
        {iconEnd && glyph}
      </span>
      {loading && <span className="bw-press__text bw-press__loading">{loadingLabel ?? children}</span>}
    </span>
  );

  if (rest.href !== undefined) {
    const { onClick, ...a } = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a
        {...a}
        className={classes}
        data-tone={variant}
        onClick={(e: MouseEvent<HTMLAnchorElement>) => {
          if (!silent) sfx.tap();
          onClick?.(e);
        }}
      >
        {label}
      </a>
    );
  }

  const { onClick, type = 'button', disabled, ...b } = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      {...b}
      type={type}
      className={classes}
      data-tone={variant}
      disabled={disabled}
      aria-pressed={pressed === undefined ? b['aria-pressed'] : pressed}
      aria-busy={loading || undefined}
      aria-disabled={loading || b['aria-disabled'] || undefined}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (loading) {
          e.preventDefault();
          return;
        }
        if (!silent) sfx.tap();
        onClick?.(e);
      }}
    >
      {label}
    </button>
  );
}
