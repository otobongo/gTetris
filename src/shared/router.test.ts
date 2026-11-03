import { describe, expect, it } from 'vitest';
import { legacyRedirect, parseRoute, pathFor, splitPath, toHref } from './router';

describe('router', () => {
  it('parses every route in the table', () => {
    expect(parseRoute([])).toEqual({ name: 'home' });
    expect(parseRoute(['home'])).toEqual({ name: 'home' });
    for (const n of ['players', 'stickers', 'break', 'settings', 'signin', 'signup', 'help']) expect(parseRoute([n])).toEqual({ name: n });
    expect(parseRoute(['help', 'terms'])).toEqual({ name: 'terms' });
    expect(parseRoute(['help', 'privacy'])).toEqual({ name: 'privacy' });
    expect(parseRoute(['game', 'escape'])).toEqual({ name: 'game', id: 'escape', level: null });
    expect(parseRoute(['game', 'escape', '9'])).toEqual({ name: 'game', id: 'escape', level: 9 });
    expect(parseRoute(['game', 'drop', 'levels'])).toEqual({ name: 'levels', id: 'drop' });
  });

  it('treats anything else as not found', () => {
    for (const s of [['nope'], ['game'], ['game', 'escape', '0'], ['game', 'escape', '2.5'], ['game', 'escape', '3', 'x'], ['help', 'faq'], ['stickers', 'x']]) {
      expect(parseRoute(s).name).toBe('notFound');
    }
  });

  it('round-trips paths', () => {
    for (const p of ['/', '/players', '/game/escape', '/game/escape/9', '/game/letters/levels', '/help/terms', '/help/privacy', '/break']) {
      expect(pathFor(parseRoute(splitPath(`#${p}`)))).toBe(p);
    }
  });

  it('redirects the old game paths', () => {
    expect(legacyRedirect(['slide'])).toBe('/game/escape/levels');
    expect(legacyRedirect(['slide', '3'])).toBe('/game/escape/3');
    expect(legacyRedirect(['drop', '2'])).toBe('/game/drop/2');
    expect(legacyRedirect(['letters'])).toBe('/game/letters/levels');
    expect(legacyRedirect(['game', 'escape'])).toBeNull();
    expect(legacyRedirect([])).toBeNull();
    expect(legacyRedirect(['slide', '3', 'x'])).toBeNull();
  });

  it('builds hash links', () => {
    expect(toHref('/stickers')).toBe('#/stickers');
    expect(toHref('stickers')).toBe('#/stickers');
    expect(toHref('#/help')).toBe('#/help');
  });
});
