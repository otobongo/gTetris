import type { GameEntry } from '../games/registry';
import { PressButton, Screen, TopBar } from '../shared/ui';
import { toHref } from '../shared/router';

/** Stub: the screens builder replaces this with the Levels board. Until then Play opens the game's own level list. */
export default function Levels({ game }: { game: GameEntry }) {
  return (
    <Screen>
      <TopBar title={game.title} back="/" backLabel="Back to home" />
      <div style={{ flex: 1 }} />
      <PressButton variant="green" size="xl" icon="play" iconEnd block href={toHref(game.playRoute)}>
        Play
      </PressButton>
    </Screen>
  );
}
