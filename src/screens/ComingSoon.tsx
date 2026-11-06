import type { GameEntry } from '../games/registry';
import { toHref } from '../shared/router';
import { PressButton, Screen, TopBar } from '../shared/ui';
import { GameArt } from './parts/Art';
import './screens.css';

/** A game on Home that is not built yet (playable: false in the registry). A calm stop, one way back. */
export default function ComingSoon({ game }: { game: GameEntry }) {
  return (
    <Screen>
      <TopBar title={game.title} subtitle="Coming soon" back="/" backLabel="Back to home" />
      <div className="sc-soon">
        <GameArt art={game.art} scale={3} />
        <div>
          <h2 className="sc-soon__title">{game.sub}</h2>
          <p className="sc-sub">This game is still being built. Pick another one for today.</p>
        </div>
      </div>
      <PressButton size="lg" block href={toHref('/')}>
        Back to games
      </PressButton>
    </Screen>
  );
}
