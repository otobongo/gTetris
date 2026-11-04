import { useState } from 'react';
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
 */
export function AddChild({ onAdded, onCancel, heading = 'Add a child', primaryLabel = 'Add child' }: { onAdded: (p: Player) => void; onCancel?: () => void; heading?: string; primaryLabel?: string }) {
  const { players } = useProgressState();
  const [name, setName] = useState('');
  const [band, setBand] = useState<AgeBand>('5-6');

  return (
    <form
      className="sc-panel sc-adding"
      aria-label={heading}
      onSubmit={(e) => {
        e.preventDefault();
        sfx.tap();
        const p = progressStore.addPlayer({ name: name.trim() || `Player ${players.length + 1}`, ageBand: band, color: nextAvatarColor(players) });
        onAdded(p);
      }}
    >
      <h2 className="sc-panel__title">{heading}</h2>
      <Field label="Child's first name" surface="well" name="child-name" autoComplete="off" autoCapitalize="words" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" />
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
