import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx';
import { useLayout } from './layout';

export interface ScreenProps {
  children: ReactNode;
  /**
   * standard 20/16/18 (games, Settings, kid screens), roomy 24/20/22 (Sign in, Sign up),
   * home 22/16/0 (Home: its list scrolls to the bottom edge), none.
   */
  padding?: 'standard' | 'roomy' | 'home' | 'none';
  /**
   * viewport (default): exactly one screen tall; the screen scrolls its own list inside.
   * content: grows with the content and the page scrolls (Sticker book, Support).
   */
  fit?: 'viewport' | 'content';
  /** Column gap: 12 (default) or 14 and 18 as some boards use. */
  gap?: 12 | 14 | 18;
  className?: string;
}

/**
 * The screen frame. Phone: one column up to 430px wide. Tablet: the boards' 596px inner area,
 * scaled up with CSS zoom like the tablet boards (834 x 1194 is zoom 1.4), so tablet screens are
 * the phone design at a larger scale with wider grids where a screen asks for them (useLayout).
 */
export function Screen({ children, padding = 'standard', fit = 'viewport', gap = 12, className }: ScreenProps) {
  const layout = useLayout();
  const tablet = layout.mode === 'tablet';
  const frameStyle: CSSProperties = { gap };
  if (tablet) {
    frameStyle.zoom = layout.zoom;
    const h = `${Math.floor(layout.height / layout.zoom)}px`;
    if (fit === 'viewport') frameStyle.height = h;
    else frameStyle.minHeight = h;
  }
  return (
    <main className={cx('bw-screen', `bw-screen--${layout.mode}`, `bw-screen--fit-${fit}`)}>
      <div className={cx('bw-screen__frame', `bw-screen__frame--${padding}`, className)} style={frameStyle}>
        {children}
      </div>
    </main>
  );
}
