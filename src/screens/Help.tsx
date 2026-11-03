import { Screen, TopBar } from '../shared/ui';

/** Stub: the screens builder replaces this with the Help board. */
export default function Help() {
  return (
    <Screen>
      <TopBar title="Support" subtitle="For grown-ups" back="/settings" />
    </Screen>
  );
}
