import { useEffect, useMemo, type ComponentType } from 'react';
import { getGame, type GameId } from './games/registry';
import DropApp from './games/drop/DropApp';
import LettersApp from './games/letters/LettersApp';
import SlideApp from './games/slide/SlideApp';
import { activePlayer, progressStore, useProgressState } from './shared/progress';
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
import { grownUpGate, notePath, setResumePath, shouldBreak } from './screens/logic/session';
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
  const redirect = legacyRedirect(segments);
  const route = parseRoute(segments);
  const unknown = route.name === 'notFound' || ((route.name === 'game' || route.name === 'levels') && !getGame(route.id));

  // Break is decided when a screen opens, not while it is open, so a level in progress is not
  // cut off; the next screen change after the limit is used up shows Break instead.
  const breakNow = useMemo(() => shouldBreak(route, activePlayer(progressStore.getState()), progressStore.now()), [path]);
  // Home and Break need a player: before anyone is set up, or with nobody picked, Who's playing opens.
  const needsPlayer = (route.name === 'home' || route.name === 'break') && !player;

  const target = redirect ?? (unknown ? '/' : breakNow ? '/break' : needsPlayer ? '/players' : null);

  // The grown-up check ends on any screen outside the grown-up pages, even one that only redirects.
  useEffect(() => {
    grownUpGate.follow(route);
  }, [path]);

  useEffect(() => {
    if (!target) notePath(path);
  }, [path, target]);

  useEffect(() => {
    if (!target) return;
    if (target === '/break') setResumePath(path);
    replace(target);
  }, [target, path]);

  usePlayClock(!target && route.name === 'game' && route.level !== null);

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
    case 'levels': {
      const game = getGame(route.id)!;
      return game.playable ? <Levels game={game} /> : <ComingSoon game={game} />;
    }
    case 'game': {
      const game = getGame(route.id)!;
      const Game = GAME_SCREENS[game.id];
      if (!game.playable || !Game) return <ComingSoon game={game} />;
      // Every game draws its own Screen, which pads itself, so no shell wrapper goes around it.
      return <Game params={route.level === null ? [] : [String(route.level)]} />;
    }
    default:
      return <Home />;
  }
}
