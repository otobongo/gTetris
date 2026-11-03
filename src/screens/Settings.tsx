import { Screen, TopBar } from '../shared/ui';

/** Stub: the screens builder replaces this with the Grownups (Settings) board. */
export default function Settings() {
  return (
    <Screen>
      <TopBar title="Settings" subtitle="For grown-ups" back="/" backLabel="Back to home" />
    </Screen>
  );
}
