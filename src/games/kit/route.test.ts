/**
 * Which route plays what for a kit game (six-games brief 3.1, 10.1): `#/game/<id>` goes to the current
 * level or the finished state, `#/game/<id>/<n>` plays only the current level, and anything else goes
 * back to `#/game/<id>`. It is Brick Escape's routeFor made generic, so the two agree.
 */
import { describe, expect, it } from 'vitest';
import { parseRoute, splitPath } from '../../shared/router';
import { routeFor as escapeRouteFor } from '../slide/puzzles';
import { gamePath, levelPath, routeFor } from './route';

const MIXER_LEVELS = 9;
const NUMBERS_LEVELS = 12;

describe('paths', () => {
  it('names the game and a level, 1-based in the path', () => {
    expect(gamePath('mixer')).toBe('/game/mixer');
    expect(levelPath('mixer', 0)).toBe('/game/mixer/1');
    expect(levelPath('mixer', 8)).toBe('/game/mixer/9');
    expect(levelPath('numbers', 11)).toBe('/game/numbers/12');
  });

  it('gives a game path the router reads back as that game', () => {
    expect(parseRoute(splitPath(gamePath('sorter')))).toEqual({ name: 'game', id: 'sorter', level: null });
    expect(parseRoute(splitPath(levelPath('sorter', 2)))).toMatchObject({ name: 'game', id: 'sorter' });
  });
});

describe('routeFor', () => {
  it('sends the game itself to the current level', () => {
    expect(routeFor('mixer', [], 0, MIXER_LEVELS)).toEqual({ kind: 'redirect', to: '/game/mixer/1' });
    expect(routeFor('mixer', [], 4, MIXER_LEVELS)).toEqual({ kind: 'redirect', to: '/game/mixer/5' });
  });

  it('sends the game to its last level when that is the current one', () => {
    expect(routeFor('numbers', [], 11, NUMBERS_LEVELS)).toEqual({ kind: 'redirect', to: '/game/numbers/12' });
  });

  it('shows the finished state when no level is current (every level has stars)', () => {
    expect(routeFor('mixer', [], null, MIXER_LEVELS)).toEqual({ kind: 'finished' });
  });

  it('plays the current level at its own path, first and last level included', () => {
    expect(routeFor('mixer', ['1'], 0, MIXER_LEVELS)).toEqual({ kind: 'play', index: 0 });
    expect(routeFor('mixer', ['5'], 4, MIXER_LEVELS)).toEqual({ kind: 'play', index: 4 });
    expect(routeFor('mixer', ['9'], 8, MIXER_LEVELS)).toEqual({ kind: 'play', index: 8 });
  });

  it('sends any other level back to the game, so a child cannot skip ahead or go back by URL', () => {
    expect(routeFor('mixer', ['2'], 0, MIXER_LEVELS)).toEqual({ kind: 'redirect', to: '/game/mixer' });
    expect(routeFor('mixer', ['1'], 3, MIXER_LEVELS)).toEqual({ kind: 'redirect', to: '/game/mixer' });
  });

  it('sends a level number to the game once every level is finished', () => {
    expect(routeFor('mixer', ['9'], null, MIXER_LEVELS)).toEqual({ kind: 'redirect', to: '/game/mixer' });
  });

  it('sends level numbers outside the game back, even when current says otherwise', () => {
    expect(routeFor('mixer', ['0'], 0, MIXER_LEVELS)).toEqual({ kind: 'redirect', to: '/game/mixer' });
    expect(routeFor('mixer', ['10'], 9, MIXER_LEVELS)).toEqual({ kind: 'redirect', to: '/game/mixer' });
  });

  it('sends anything that is not a plain level number back to the game', () => {
    for (const bad of ['levels', '1a', '-1', '1.0', '1e0', ' 1', '', 'NaN', 'Infinity']) {
      expect(routeFor('mixer', [bad], 0, MIXER_LEVELS), JSON.stringify(bad)).toEqual({ kind: 'redirect', to: '/game/mixer' });
    }
  });

  it('sends a path with more than one part back to the game, even with the right level first', () => {
    expect(routeFor('mixer', ['1', 'x'], 0, MIXER_LEVELS)).toEqual({ kind: 'redirect', to: '/game/mixer' });
    expect(routeFor('mixer', ['1', '1'], 0, MIXER_LEVELS)).toEqual({ kind: 'redirect', to: '/game/mixer' });
  });

  it('uses the game id it is given in every path', () => {
    expect(routeFor('math', [], 2, 12)).toEqual({ kind: 'redirect', to: '/game/math/3' });
    expect(routeFor('builder', ['7'], 0, 12)).toEqual({ kind: 'redirect', to: '/game/builder' });
  });

  it('decides exactly as Brick Escape does for the same inputs', () => {
    const cases: [string[], number | null][] = [
      [[], 0],
      [[], 30],
      [[], null],
      [['1'], 0],
      [['31'], 30],
      [['2'], 0],
      [['0'], 0],
      [['32'], 31],
      [['01'], 0],
      [['levels'], 0],
      [['1', 'x'], 0],
      [['3'], null],
    ];
    for (const [params, current] of cases) {
      const kit = routeFor('escape', params, current, 31);
      expect(kit, `${params.join('/')} at ${current}`).toEqual(escapeRouteFor(params, current, 31));
    }
  });
});
