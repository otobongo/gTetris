/**
 * The page title names the screen (app-core-10, a11y-cross-6, unslop INT-22), so VoiceOver and the
 * app switcher say where the child or grown-up is: Home is the app's name, every other screen puts
 * its own name first.
 */
import { describe, expect, it } from 'vitest';
import { GAMES } from '../../games/registry';
import { parseRoute, splitPath, type Route } from '../../shared/router';
import { screenTitle } from './titles';

const at = (hash: string) => screenTitle(parseRoute(splitPath(hash)));

describe('the page title on each screen', () => {
  it('is the app name on Home', () => {
    expect(at('#/')).toBe('Brickwise');
    expect(at('#/home')).toBe('Brickwise');
  });

  it('names the game and the level on a level', () => {
    expect(at('#/game/sorter/1')).toBe('Shape Sorter, Level 1 · Brickwise');
    expect(at('#/game/pattern/3')).toBe('Pattern Train, Level 3 · Brickwise');
  });

  it('uses the word the game uses for a level', () => {
    expect(at('#/game/drop/2')).toBe('Brick Drop, Stage 2 · Brickwise');
  });

  it('names the game alone when there is no level (the finished state)', () => {
    expect(at('#/game/escape')).toBe('Brick Escape · Brickwise');
  });

  it('gives every game on Home its own title', () => {
    for (const g of GAMES) expect(screenTitle({ name: 'game', id: g.id, level: 1 })).toMatch(new RegExp(`^${g.title}, (Level|Stage) 1 · Brickwise$`));
  });

  it('uses the screen name on the other screens', () => {
    expect(at('#/stickers')).toBe('Sticker book · Brickwise');
    expect(at('#/break')).toBe('Break time · Brickwise');
    expect(at('#/settings')).toBe('Settings · Brickwise');
    expect(at('#/players')).toBe("Who's playing · Brickwise");
    expect(at('#/signin')).toBe('Sign in · Brickwise');
    expect(at('#/signup')).toBe('Sign up · Brickwise');
    expect(at('#/help')).toBe('Support · Brickwise');
    expect(at('#/help/terms')).toBe('Terms of use · Brickwise');
    expect(at('#/help/privacy')).toBe('Privacy policy · Brickwise');
    expect(at('#/settings/levels/escape/maya')).toBe('Brick Escape levels · Brickwise');
  });

  it('falls back to the app name on an unknown route or game', () => {
    expect(at('#/nowhere/at/all')).toBe('Brickwise');
    expect(at('#/game/chess/2')).toBe('Brickwise');
    expect(at('#/settings/levels/chess/maya')).toBe('Settings · Brickwise');
  });

  it('never uses an em or en dash', () => {
    const routes: Route[] = [
      { name: 'home' },
      { name: 'players' },
      { name: 'stickers' },
      { name: 'break' },
      { name: 'settings' },
      { name: 'signin' },
      { name: 'signup' },
      { name: 'help' },
      { name: 'terms' },
      { name: 'privacy' },
      { name: 'notFound', path: 'x' },
      ...GAMES.flatMap((g): Route[] => [
        { name: 'game', id: g.id, level: null },
        { name: 'game', id: g.id, level: 4 },
        { name: 'levels', id: g.id },
        { name: 'levelPicker', game: g.id, playerId: 'p1' },
      ]),
    ];
    for (const r of routes) expect(screenTitle(r)).not.toMatch(/[–—]/);
  });
});
