import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * The intro and Out of room cards of the boards (scrim, centred card, title, lines, stacked buttons). It sits inside the
 * screen frame, so on a tablet it scales with the rest of the screen. The page behind it is inert. `action` puts one
 * icon button at the end of the title row (the intro card's speaker); without it the title stands alone as before.
 */
export function Sheet({ title, children, actions, action }: { title: string; children?: ReactNode; actions: ReactNode; action?: ReactNode }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Focus the main button, so keyboard players can carry on straight away.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);
  return (
    <div className="drop-scrim">
      <div className="drop-sheet" role="dialog" aria-modal="true" aria-labelledby={id} ref={ref}>
        {action ? (
          <div className="drop-sheet__head">
            <h2 id={id} className="drop-sheet__title">
              {title}
            </h2>
            {action}
          </div>
        ) : (
          <h2 id={id} className="drop-sheet__title">
            {title}
          </h2>
        )}
        {children}
        <div className="drop-sheet__actions">{actions}</div>
      </div>
    </div>
  );
}
