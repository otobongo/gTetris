import { useEffect, useMemo, useRef, type ComponentType } from 'react';
import { getGame, type GameId } from './games/registry';
import BuilderApp from './games/builder/BuilderApp';
import DropApp from './games/drop/DropApp';
import LettersApp from './games/letters/LettersApp';
import MathApp from './games/math/MathApp';
import MixerApp from './games/mixer/MixerApp';
import NumbersApp from './games/numbers/NumbersApp';
import PatternApp from './games/pattern/PatternApp';
import SorterApp from './games/sorter/SorterApp';
import SlideApp from './games/slide/SlideApp';
import { activePlayer, progressStore, useProgressState } from './shared/progress';
import { onRouteChange, parseRoute, replace, splitPath, useRoute, type Route } from './shared/router';
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
import { planRoute, type RoutePlan } from './screens/logic/routes';
import { grownUpGate, needsGrownUpCheck, noteArrival, setResumePath } from './screens/logic/session';
import { screenTitle } from './screens/logic/titles';
import { GrownUpOnly } from './screens/parts/GrownUpOnly';
import { usePlayClock } from './screens/playClock';

/** The playable games. Each takes the path segments after its id: [] for its start screen, ['3'] for level 3. */
const GAME_SCREENS: Partial<Record<GameId, ComponentType<{ params: string[] }>>> = {
  escape: SlideApp,
  drop: DropApp,
  letters: LettersApp,
  mixer: MixerApp,
  sorter: SorterApp,
  pattern: PatternApp,
  builder: BuilderApp,
  math: MathApp,
  numbers: NumbersApp,
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
  const target = targetOf(plan, !!player);

  // Record each path Back can return to before its screen draws (app-grownups-2): the router calls this
  // in its hashchange handler, ahead of the state update, so Support, Terms, Sign in, Sign up and the
  // grown-up check read the screen just left, not the one before it. A path that only redirects is never
  // recorded. The first path is recorded here, since no hashchange brings it.
  useEffect(() => {
    const arrive = (next: string[]) => {
      const state = progressStore.getState();
      noteArrival(pathOf(next), targetOf(planRoute(next, state, progressStore.now()), !!activePlayer(state)));
    };
    arrive(splitPath(window.location.hash));
    return onRouteChange(arrive);
  }, []);

  // The grown-up check ends on any screen outside the grown-up pages, even one that only redirects.
  useEffect(() => {
    grownUpGate.follow(parseRoute(segments));
  }, [path]);

  useEffect(() => {
    if (!target) return;
    if (target === '/break') setResumePath(plan.path);
    replace(target);
  }, [target, path]);

  // The page title names the screen (app-core-10).
  useEffect(() => {
    if (!target) document.title = screenTitle(route);
  }, [path, target]);

  // After a screen change (not the first load), focus moves to the new screen (a11y-cross-6).
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (target || shown.current === path) return;
    const first = shown.current === null;
    shown.current = path;
    if (first) return;
    const frame = requestAnimationFrame(focusNewScreen);
    return () => cancelAnimationFrame(frame);
  }, [path, target]);

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

const pathOf = (segments: string[]) => `/${segments.join('/')}`;

/**
 * Where App sends a planned path on, or null when its screen draws: the plan's redirect, or Who's playing
 * for Home and Break with no player (before anyone is set up, or with nobody picked).
 */
function targetOf(plan: RoutePlan, hasPlayer: boolean): string | null {
  const needsPlayer = (plan.route.name === 'home' || plan.route.name === 'break') && !hasPlayer;
  return plan.redirect ?? (needsPlayer ? '/players' : null);
}

/**
 * Runs one frame after a new screen draws. When the screen has placed focus itself (PlayScreen's first
 * control, a level card's Play Level N), it stays there. Otherwise, with focus on the page or outside the
 * screen (the link that opened it is gone), it goes to the screen's h1, so VoiceOver reads the new
 * screen's name. TopBar's h1 already takes focus without a ring; any other h1 is made to here.
 */
function focusNewScreen() {
  const main = document.querySelector('main');
  if (!main) return;
  const active = document.activeElement;
  if (active && active !== document.body && main.contains(active)) return;
  const heading = main.querySelector<HTMLElement>('h1');
  if (!heading) return;
  if (!heading.hasAttribute('tabindex')) {
    heading.tabIndex = -1;
    heading.style.outline = 'none';
  }
  heading.focus({ preventScroll: true });
}

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
