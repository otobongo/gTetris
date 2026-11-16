import { useEffect, useRef, useState } from 'react';
import { AGE_BANDS, progressStore, useProgressState, type AgeBand, type Player } from '../../shared/progress';
import { sfx } from '../../shared/sound';
import { nextAvatarColor } from '../logic/session';
import { Field, Segmented } from './Controls';

export const BAND_LABEL: Record<AgeBand, string> = { '3-4': '3 to 4', '5-6': '5 to 6', '7-8': '7 to 8', '9-10': '9 to 10' };

/** "Ages 7 to 8" */
export const bandText = (band: AgeBand) => `Ages ${BAND_LABEL[band]}`;

/**
 * Add a child: first name and age band only (the Settings board's panel). The avatar colour is
 * the first one nobody in the family uses yet.
 *
 * `focusOnOpen` (Settings only, after a tap on Add a child) scrolls the form into view and puts the
 * cursor in the name field, so the grown-up types straight away and the form's Age row is the one in
 * view. Who's playing on the first run and Sign up step 2 leave it off: their form is the screen.
 */
export function AddChild({
  onAdded,
  onCancel,
  heading = 'Add a child',
  primaryLabel = 'Add child',
  focusOnOpen = false,
}: {
  /** `named` is false when no name was typed and the child got a "Player N" name. */
  onAdded: (p: Player, named: boolean) => void;
  onCancel?: () => void;
  heading?: string;
  primaryLabel?: string;
  focusOnOpen?: boolean;
}) {
  const { players } = useProgressState();
  const [name, setName] = useState('');
  const [band, setBand] = useState<AgeBand>('5-6');
  const form = useRef<HTMLFormElement>(null);
  const nameField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focusOnOpen) return;
    // No smooth scroll: the jump follows the tap at once, and reduced motion needs nothing extra.
    form.current?.scrollIntoView({ block: 'nearest' });
    nameField.current?.focus({ preventScroll: true });
  }, []);

  return (
    <form
      ref={form}
      className="sc-panel"
      aria-label={heading}
      onSubmit={(e) => {
        e.preventDefault();
        sfx.tap();
        const named = name.trim() !== '';
        const p = progressStore.addPlayer({ name: named ? name.trim() : `Player ${players.length + 1}`, ageBand: band, color: nextAvatarColor(players) });
        onAdded(p, named);
      }}
    >
      <h2 className="sc-panel__title">{heading}</h2>
      <Field inputRef={nameField} label="Child's first name" surface="well" name="child-name" autoComplete="off" autoCapitalize="words" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" />
      <span className="sc-label" id="add-age">
        Age
      </span>
      <Segmented label="Age" value={band} onChange={setBand} options={AGE_BANDS.map((b) => ({ value: b, label: BAND_LABEL[b], name: bandText(b) }))} />
      <p className="sc-helper">The timer, level start and reading help are set from the age. You can change them later.</p>
      <div className="sc-row">
        {onCancel && (
          <button type="button" className="sc-btn sc-btn--flat sc-grow-1" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="sc-btn sc-btn--go sc-grow-2">
          {primaryLabel}
        </button>
      </div>
    </form>
  );
}
