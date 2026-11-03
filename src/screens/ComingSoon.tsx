import type { GameEntry } from '../games/registry';
import { Screen, TopBar } from '../shared/ui';

/** Stub for a game on Home that is not built yet (playable: false in the registry). */
export default function ComingSoon({ game }: { game: GameEntry }) {
  return (
    <Screen>
      <TopBar title={game.title} subtitle="[PLACEHOLDER: not built yet]" back="/" backLabel="Back to home" />
    </Screen>
  );
}
