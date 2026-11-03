import { Screen, TopBar } from '../shared/ui';

/** Stub: the screens builder replaces this with the Signin board. */
export default function Signin() {
  return (
    <Screen>
      <TopBar title="Sign in" back="/signup" />
    </Screen>
  );
}
