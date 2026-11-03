import { Screen, TopBar } from '../shared/ui';

/** Stub: the screens builder replaces this with the Main (Who's playing) board. */
export default function Players() {
  return (
    <Screen>
      <TopBar title="Who's playing?" back="/" backLabel="Back to home" />
    </Screen>
  );
}
