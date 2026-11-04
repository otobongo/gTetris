import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * The intro and Out of room cards of the boards (scrim, centred card, title, lines, stacked buttons). It sits inside the
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
