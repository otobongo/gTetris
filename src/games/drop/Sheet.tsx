import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from '../../shared/ui';

/** Three stars, 48px, as on the win card of the boards. Earned stars are filled; the rest are dim. */
export function StarRow({ value }: { value: number }) {
  return (
    <div className="drop-starrow" role="img" aria-label={`${value} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < value ? 'is-on' : undefined}>
          <Icon name="star" size={48} />
        </span>
      ))}
    </div>
  );
}

/**
 * The overlay card of the boards (scrim, centred card, title, content, buttons). It sits inside the
 * screen frame, so on a tablet it scales with the rest of the screen. The page behind it is inert.
 */
export function Sheet({ title, children, actions }: { title: string; children?: ReactNode; actions: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Focus the main button, so keyboard players can carry on straight away.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);
  return (
    <div className="drop-scrim">
      <div className="drop-sheet" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        <h2 id={id} className="drop-sheet__title">
          {title}
        </h2>
        {children}
        <div className="drop-sheet__actions">{actions}</div>
      </div>
    </div>
  );
}
