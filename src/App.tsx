import { useEffect, useMemo, type ComponentType } from 'react';
import { getGame, type GameId } from './games/registry';
import DropApp from './games/drop/DropApp';
import LettersApp from './games/letters/LettersApp';
import SlideApp from './games/slide/SlideApp';
import { activePlayer, progressStore, useProgressState } from './shared/progress';
import { parseRoute, replace, useRoute, type Route } from './shared/router';
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
import { planRoute } from './screens/logic/routes';
import { grownUpGate, needsGrownUpCheck, notePath, setResumePath } from './screens/logic/session';
import { GrownUpOnly } from './screens/parts/GrownUpOnly';
import { usePlayClock } from './screens/playClock';

/** The playable games. Each takes the path segments after its id: [] for its start screen, ['3'] for level 3. */
const GAME_SCREENS: Partial<Record<GameId, ComponentType<{ params: string[] }>>> = {
  escape: SlideApp,
  drop: DropApp,
  letters: LettersApp,
};

export default function App() {
  const segments = useRoute();
  const state = useProgressState();
  const player = activePlayer(state);
  const path = `/${segments.join('/')}`;

  // Where this path really goes (old paths, the old level grid, the current-level rule, Break),
  // worked out when a screen opens and not while it is open: a level in progress is not cut off by
  // the limit, and the fourth solve, which moves the current level on, does not leave the level card.
  const plan = useMemo(() => planRoute(segments, progressStore.getState(), progressStore.now()), [path]);
  const route = plan.route;
  // Home and Break need a player: before anyone is set up, or with nobody picked, Who's playing opens.
  const needsPlayer = (route.name === 'home' || route.name === 'break') && !player;

  const target = plan.redirect ?? (needsPlayer ? '/players' : null);

  // The grown-up check ends on any screen outside the grown-up pages, even one that only redirects.
  useEffect(() => {
    grownUpGate.follow(parseRoute(segments));
  }, [path]);

  useEffect(() => {
    if (!target) notePath(path);
  }, [path, target]);

  useEffect(() => {
    if (!target) return;
    if (target === '/break') setResumePath(plan.path);
    replace(target);
  }, [target, path]);

  usePlayClock(!target && route.name === 'game' && route.level !== null);

  if (target) return null;

  // Settings, the level picker, Sign in and Sign up open only after the grown-up check; Support, Terms and Privacy stay open.
  if (needsGrownUpCheck(route)) {
    return (
      <GrownUpOnly key={route.name} title={GROWN_UP_TITLES[route.name] ?? 'Grown-ups'}>
        <Screens route={route} />
      </GrownUpOnly>
    );
  }
  return <Screens route={route} />;
}

const GROWN_UP_TITLES: Partial<Record<Route['name'], string>> = { settings: 'Settings', levelPicker: 'Settings', signin: 'Sign in', signup: 'Sign up' };

/** The screen for a route that needs no redirect. */
function Screens({ route }: { route: Route }) {
  switch (route.name) {
    case 'players':
      return <Players />;
    case 'stickers':
      return <Stickers />;
    case 'break':
      return <Break />;
    case 'settings':
      return <Settings />;
    case 'levelPicker':
      return <Levels game={getGame(route.game)!} playerId={route.playerId} />;
    case 'signin':
      return <Signin />;
    case 'signup':
      return <Signup />;
    case 'help':
      return <Help />;
    case 'terms':
    case 'privacy':
      return <HelpDoc page={route.name} />;
    case 'game': {
      const game = getGame(route.id)!;
      const Game = GAME_SCREENS[game.id];
      if (!game.playable || !Game) return <ComingSoon game={game} />;
      // Every game draws its own Screen, which pads itself, so no shell wrapper goes around it.
      // routes.ts lets only the current level through; no level means every level is done (the finished state).
      return <Game params={route.level === null ? [] : [String(route.level)]} />;
    }
    default:
      return <Home />;
  }
}
