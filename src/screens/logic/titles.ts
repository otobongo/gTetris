/**
 * The page title for each screen (app-core-10, a11y-cross-6, unslop INT-22). App sets it whenever the
 * route changes, so VoiceOver and the app switcher name the screen that is open: the screen first,
 * then the app ("Shape Sorter, Level 1 · Brickwise"). Home is the app itself, so it is just "Brickwise".
 */
import { getGame } from '../../games/registry';
import type { Route } from '../../shared/router';

export const APP_NAME = 'Brickwise';

const named = (screen: string) => `${screen} · ${APP_NAME}`;

/** Screens whose title is a fixed name: the h1 wording, or the screen's name where the h1 greets. */
const FIXED: Partial<Record<Route['name'], string>> = {
  players: "Who's playing",
  stickers: 'Sticker book',
  break: 'Break time',
  settings: 'Settings',
  signin: 'Sign in',
  signup: 'Sign up',
  help: 'Support',
  terms: 'Terms of use',
  privacy: 'Privacy policy',
};

export function screenTitle(route: Route): string {
  switch (route.name) {
    case 'game':
    case 'levels': {
      const game = getGame(route.id);
      if (!game) return APP_NAME;
      // Brick Drop calls its levels stages, as its play screen does.
      if (route.name === 'game' && route.level !== null) return named(`${game.title}, ${game.noun} ${route.level}`);
      return named(game.title);
    }
    case 'levelPicker': {
      const game = getGame(route.game);
      return named(game ? `${game.title} levels` : 'Settings');
    }
    default: {
      const fixed = FIXED[route.name];
      return fixed ? named(fixed) : APP_NAME;
    }
  }
}
