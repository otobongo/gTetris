import { Screen, TopBar } from '../shared/ui';

/** Stub: the screens builder replaces this with the Signup board. */
export default function Signup() {
  return (
    <Screen>
      <TopBar title="Create a family account" back="/settings" />
    </Screen>
  );
}
