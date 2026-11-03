import { useEffect, type ComponentType } from 'react';
import { getGame, type GameId } from './games/registry';
import DropApp from './games/drop/DropApp';
import LettersApp from './games/letters/LettersApp';
import SlideApp from './games/slide/SlideApp';
import { legacyRedirect, parseRoute, replace, useRoute } from './shared/router';
import Break from './screens/Break';
import ComingSoon from './screens/ComingSoon';
import Help from './screens/Help';
import HelpDoc from './screens/HelpDoc';
import Home from './screens/Home';
import Levels from './screens/Levels';
import Players from './screens/Players';
import Settings from './screens/Settings';
import Signin from './screens/Signin';
import Signup from './screens/Signup';
import Stickers from './screens/Stickers';

/** The playable games. Each takes the path segments after its id: [] for its start screen, ['3'] for level 3. */
const GAME_SCREENS: Partial<Record<GameId, ComponentType<{ params: string[] }>>> = {
  escape: SlideApp,
  drop: DropApp,
  letters: LettersApp,
};

export default function App() {
  const segments = useRoute();
  const redirect = legacyRedirect(segments);
  const route = parseRoute(segments);
  const unknown = route.name === 'notFound' || ((route.name === 'game' || route.name === 'levels') && !getGame(route.id));
  const target = redirect ?? (unknown ? '/' : null);

  useEffect(() => {
    if (target) replace(target);
  }, [target]);
  if (target) return null;

  switch (route.name) {
    case 'players':
      return <Players />;
    case 'stickers':
      return <Stickers />;
    case 'break':
      return <Break />;
    case 'settings':
      return <Settings />;
    case 'signin':
      return <Signin />;
    case 'signup':
      return <Signup />;
    case 'help':
      return <Help />;
    case 'terms':
    case 'privacy':
      return <HelpDoc page={route.name} />;
    case 'levels':
      return <Levels game={getGame(route.id)!} />;
    case 'game': {
      const game = getGame(route.id)!;
      const Game = GAME_SCREENS[game.id];
      if (!game.playable || !Game) return <ComingSoon game={game} />;
      return (
        <div className="app">
          <Game params={route.level === null ? [] : [String(route.level)]} />
        </div>
      );
    }
    default:
      return <Home />;
  }
}
