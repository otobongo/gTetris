import { useState, type ReactNode } from 'react';
import { go } from '../../shared/router';
import { Screen, TopBar } from '../../shared/ui';
import { backTarget, grownUpGate } from '../logic/session';
import { GrownUpCheck } from './Controls';

/**
 * The locked view of a grown-up screen (Grownups board): the addition check. Cancel and Back return to
 * Who's playing when the check opened from there (its Add a child tile, app-grownups-8), and go home
 * otherwise. Not history.back(): Settings can be the first page this tab opened.
 */
export function GrownUpLock({ title, onPass }: { title: string; onPass: () => void }) {
  const back = backTarget(['/players'], '/');
  const backLabel = back === '/players' ? "Back to Who's playing" : 'Back to home';
  return (
    <Screen>
      <TopBar title={title} subtitle="For grown-ups" back={back} backLabel={backLabel} />
      <div className="sc-locked">
        <p className="sc-locked__title">This area is for grown-ups</p>
        <GrownUpCheck
          onPass={() => {
            grownUpGate.pass();
            onPass();
          }}
          onCancel={() => go(back)}
        />
      </div>
    </Screen>
  );
}

/**
 * Shows its screen only once the grown-up check has passed (the same pass Settings uses, which
 * ends on the first screen outside the grown-up pages). App uses it for Settings, Sign in and Sign up.
 */
export function GrownUpOnly({ title, children }: { title: string; children: ReactNode }) {
  // Read once per screen (App keys this by route), as Settings did: a reset while the screen is
  // still open (Delete everything, just before it leaves) does not flash the check.
  const [open, setOpen] = useState(grownUpGate.passed);
  if (open) return <>{children}</>;
  return <GrownUpLock title={title} onPass={() => setOpen(true)} />;
}
