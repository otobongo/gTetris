/**
 * A registered game that is not built yet (six-games brief 3.5). After batch 2 every game in the registry is
 * playable, so nothing reaches routes.ts's not-playable branch or App's ComingSoon branch any more; both stay
 * for the next game. These tests reach them with no change to the app: for each test one registry entry,
 * Brick Calculator's, is marked as not built (no meta, not playable), and it is put back afterwards.
 * App is server-rendered with a stand-in window that carries only the hash, as in app.gate.test.ts.
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { GAMES, getGame, type GameEntry } from '../../games/registry';
import { createProgressStore, emptyState, progressStore, type KeyValueStorage } from '../../shared/progress';
import { splitPath } from '../../shared/router';
import { gamePath, planRoute } from './routes';

const NOON = new Date(2026, 10, 9, 12, 0).getTime();

const math = getGame('math')!;
const built = { playable: math.playable, meta: math.meta };

/** Mark Brick Calculator's registry entry as a game that is not built yet. */
function markNotBuilt(entry: GameEntry) {
  entry.playable = false;
  entry.meta = null;
}

beforeEach(() => markNotBuilt(math));
afterEach(() => {
  Object.assign(math, built);
  vi.unstubAllGlobals();
});

function setup() {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  let n = 0;
  const store = createProgressStore({ storage, now: () => NOON, newId: () => `id-${++n}`, events: null });
  const maya = store.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue', dailyLimit: 30 });
  store.setActivePlayer(maya.id);
  const plan = (hash: string) => planRoute(splitPath(hash), store.getState(), NOON);
  return { store, maya, plan };
}

function renderAt(hash: string): string {
  vi.stubGlobal('window', {
    location: { hash, pathname: '/', search: '', replace: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    innerWidth: 390,
    innerHeight: 844,
  });
  return renderToString(createElement(App));
}

describe('routes for a registered game that is not built', () => {
  it('stays on the game with no level, and sends any level or the old level grid back to it', () => {
    const { plan, store } = setup();
    expect(GAMES.filter((g) => !g.playable).map((g) => g.id)).toEqual(['math']);
    expect(plan('#/game/math')).toMatchObject({ redirect: null, route: { name: 'game', id: 'math', level: null } });
    expect(plan('#/game/math/3')).toMatchObject({ redirect: '/game/math', route: { name: 'game', id: 'math', level: null } });
    expect(plan('#/game/math/levels').redirect).toBe('/game/math');
    expect(gamePath('math', store.getState().players[0])).toBe('/game/math');
    // The built games still open their current level.
    expect(plan('#/game/pattern').redirect).toBe('/game/pattern/1');
  });

  it('sends the grown-up level picker for it back to Settings', () => {
    const { plan, maya } = setup();
    expect(plan(`#/settings/levels/math/${maya.id}`).redirect).toBe('/settings');
    expect(plan(`#/settings/levels/builder/${maya.id}`).redirect).toBeNull();
  });

  it('is a play route like Home and every game: once the daily limit is used up it goes to Break', () => {
    const { plan, store } = setup();
    store.addMinutesPlayed(30);
    expect(plan('#/').redirect).toBe('/break');
    expect(plan('#/game/math')).toMatchObject({ redirect: '/break', route: { name: 'game', id: 'math', level: null }, path: '/game/math' });
  });
});

describe('App for a registered game that is not built', () => {
  beforeEach(() => {
    progressStore.replace(emptyState());
    progressStore.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' });
  });
  afterEach(() => progressStore.replace(emptyState()));

  it('shows Coming soon with the game’s title and sub, and no play screen', () => {
    const html = renderAt('#/game/math');
    expect(html).toContain('Brick Calculator');
    expect(html).toContain('Coming soon');
    expect(html).toContain('This game is still being built. Pick another one for today.');
    expect(html).not.toContain('aria-label="Keypad"');
  });

  it('names its Home card Coming soon', () => {
    const html = renderAt('#/');
    expect(html).toContain(`aria-label="${math.title}. ${math.sub}. Coming soon."`);
  });

  it('plays the game again once the entry is built (the mark is put back)', () => {
    Object.assign(math, built);
    const html = renderAt('#/game/math/1');
    expect(html).toContain('aria-label="Keypad"');
    expect(html).not.toContain('Coming soon');
  });
});
