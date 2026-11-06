/**
 * Routes for four-puzzle levels (brief 2.1, 2.5, 2.6 and 7.4): every game path opens the child's
 * current level, old paths take one replace, the grown-up level picker never meets Break.
 */
import { describe, expect, it } from 'vitest';
import { escapeLevelStars } from '../../games/run';
import { getGame } from '../../games/registry';
import { createProgressStore, type KeyValueStorage, type PuzzleRules } from '../../shared/progress';
import { parseRoute, pathFor, splitPath } from '../../shared/router';
import { gamePath, planRoute } from './routes';
import { isGrownUpRoute, isPlayRoute, needsGrownUpCheck, shouldBreak } from './session';

const NOON = new Date(2026, 10, 4, 12, 0).getTime();

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

const starAll = (store: ReturnType<typeof setup>['store'], game: string, count: number) => {
  for (let i = 0; i < count; i++) store.recordStars(game, i, 2);
};

const ESC: PuzzleRules = { set: 'escape:x', seed: 0, levelCount: 31, stars: escapeLevelStars };

describe('the picker route', () => {
  it('parses settings/levels/<game>/<playerId> and writes it back', () => {
    expect(parseRoute(['settings', 'levels', 'escape', 'p1'])).toEqual({ name: 'levelPicker', game: 'escape', playerId: 'p1' });
    expect(pathFor({ name: 'levelPicker', game: 'drop', playerId: 'p1' })).toBe('/settings/levels/drop/p1');
  });

  it('encodes a player id with unsafe characters and reads it back', () => {
    const path = pathFor({ name: 'levelPicker', game: 'letters', playerId: 'a b/c' });
    expect(path).toBe('/settings/levels/letters/a%20b%2Fc');
    expect(parseRoute(splitPath(`#${path}`))).toEqual({ name: 'levelPicker', game: 'letters', playerId: 'a b/c' });
  });

  it('rejects a missing or extra segment and broken encoding', () => {
    for (const s of [['settings', 'levels'], ['settings', 'levels', 'escape'], ['settings', 'levels', 'escape', 'p1', 'x'], ['settings', 'x', 'escape', 'p1'], ['settings', 'levels', 'escape', '%E0%A4%A']]) {
      expect(parseRoute(s).name, s.join('/')).toBe('notFound');
    }
    expect(parseRoute(['settings'])).toEqual({ name: 'settings' });
  });

  it('is a grown-up page behind the check, and Break never blocks it', () => {
    const r = { name: 'levelPicker', game: 'escape', playerId: 'p1' } as const;
    expect(isGrownUpRoute(r)).toBe(true);
    expect(needsGrownUpCheck(r)).toBe(true);
    expect(isPlayRoute(r)).toBe(false);
  });
});

describe('planRoute: Home cards open the current level', () => {
  it('opens Level 1 for a new child, in one replace', () => {
    const { plan } = setup();
    expect(plan('#/game/escape')).toMatchObject({ redirect: '/game/escape/1', path: '/game/escape/1', route: { name: 'game', id: 'escape', level: 1 } });
    expect(plan('#/game/drop').redirect).toBe('/game/drop/1');
    expect(plan('#/game/letters').redirect).toBe('/game/letters/1');
  });

  it('stays on the current level, with no redirect', () => {
    const { store, plan } = setup();
    store.recordStars('escape', 0, 3);
    expect(plan('#/game/escape/2')).toMatchObject({ redirect: null, path: '/game/escape/2' });
  });

  it('sends any other level number to the current level', () => {
    const { store, plan } = setup();
    starAll(store, 'escape', 8);
    for (const n of [1, 5, 8, 10, 31, 99]) expect(plan(`#/game/escape/${n}`).redirect, String(n)).toBe('/game/escape/9');
  });

  it('opens a level a grown-up picked, even one past the frontier, and nothing else', () => {
    const { store, plan } = setup();
    starAll(store, 'escape', 9);
    store.pickLevel('escape', 19, 31);
    expect(plan('#/game/escape').redirect).toBe('/game/escape/20');
    expect(plan('#/game/escape/20').redirect).toBeNull();
    expect(plan('#/game/escape/10').redirect).toBe('/game/escape/20');
  });

  it('follows a finished level to the next one, which recordPuzzle stores', () => {
    const { store, plan } = setup();
    store.startRun('escape', 0, ESC);
    for (const p of [0, 1, 2, 3]) store.recordPuzzle('escape', 0, { puzzle: p, count: 6, par: 6, usedHint: false, outOfTime: false }, ESC);
    expect(plan('#/game/escape').redirect).toBe('/game/escape/2');
    expect(plan('#/game/escape/2').redirect).toBeNull();
  });

  it('keeps a finished game on #/game/<id>, the finished state, and sends level numbers there', () => {
    const { store, plan } = setup();
    starAll(store, 'drop', getGame('drop')!.meta!.levelCount);
    expect(plan('#/game/drop')).toMatchObject({ redirect: null, route: { name: 'game', id: 'drop', level: null } });
    expect(plan('#/game/drop/3').redirect).toBe('/game/drop');
  });

  it('uses Level 1 when nobody is playing yet', () => {
    const { store } = setup();
    store.setActivePlayer(null);
    expect(planRoute(['game', 'letters'], store.getState(), NOON).redirect).toBe('/game/letters/1');
    expect(gamePath('letters', null)).toBe('/game/letters/1');
  });

  it('shows Coming soon for a game that is not built, without a level', () => {
    const { plan } = setup();
    expect(plan('#/game/mixer')).toMatchObject({ redirect: null, route: { name: 'game', id: 'mixer', level: null } });
    expect(plan('#/game/mixer/3').redirect).toBe('/game/mixer');
    expect(plan('#/game/mixer/levels').redirect).toBe('/game/mixer');
  });
});

describe('planRoute: old paths take one replace', () => {
  it('sends the old level grid straight to the current level', () => {
    const { store, plan } = setup();
    starAll(store, 'letters', 3);
    expect(plan('#/game/letters/levels').redirect).toBe('/game/letters/4');
  });

  it('sends #/slide, #/drop and #/letters to the current level', () => {
    const { store, plan } = setup();
    starAll(store, 'escape', 2);
    expect(plan('#/slide').redirect).toBe('/game/escape/3');
    expect(plan('#/drop').redirect).toBe('/game/drop/1');
    expect(plan('#/letters').redirect).toBe('/game/letters/1');
  });

  it('sends #/slide/<n> to the current level, whatever n is', () => {
    const { store, plan } = setup();
    starAll(store, 'escape', 2);
    expect(plan('#/slide/3').redirect).toBe('/game/escape/3');
    expect(plan('#/slide/7').redirect).toBe('/game/escape/3');
    expect(plan('#/drop/2').redirect).toBe('/game/drop/1');
  });

  it('sends unknown paths and unknown games Home', () => {
    const { plan } = setup();
    for (const h of ['#/nope', '#/game/nope', '#/game/nope/2', '#/game/escape/0', '#/slide/3/x']) expect(plan(h).redirect, h).toBe('/');
    expect(plan('#/home').redirect).toBeNull();
    expect(plan('#/').redirect).toBeNull();
  });
});

describe('planRoute: the level picker', () => {
  it('opens for a playable game and a child that exists', () => {
    const { maya, plan } = setup();
    for (const g of ['escape', 'drop', 'letters']) {
      expect(plan(`#/settings/levels/${g}/${maya.id}`)).toMatchObject({ redirect: null, route: { name: 'levelPicker', game: g, playerId: maya.id } });
    }
  });

  it('sends an unknown game, a game not built or an unknown child to Settings', () => {
    const { maya, plan } = setup();
    expect(plan(`#/settings/levels/nope/${maya.id}`).redirect).toBe('/settings');
    expect(plan(`#/settings/levels/mixer/${maya.id}`).redirect).toBe('/settings');
    expect(plan('#/settings/levels/escape/nobody').redirect).toBe('/settings');
  });

  it('opens for a child who is not the active player', () => {
    const { store, plan } = setup();
    const leo = store.addPlayer({ name: 'Leo', ageBand: '3-4', color: 'orange' });
    expect(plan(`#/settings/levels/drop/${leo.id}`).redirect).toBeNull();
  });
});

describe('planRoute: Break', () => {
  const tired = () => {
    const s = setup();
    s.store.addMinutesPlayed(30);
    return s;
  };

  it('replaces a play route with Break and resumes at the resolved level', () => {
    const { store, plan } = tired();
    starAll(store, 'escape', 4);
    expect(plan('#/game/escape')).toMatchObject({ redirect: '/break', path: '/game/escape/5' });
    expect(plan('#/slide')).toMatchObject({ redirect: '/break', path: '/game/escape/5' });
    expect(plan('#/game/escape/levels')).toMatchObject({ redirect: '/break', path: '/game/escape/5' });
    expect(plan('#/')).toMatchObject({ redirect: '/break', path: '/' });
  });

  it('never blocks the grown-up pages, the picker included', () => {
    const { maya, plan } = tired();
    for (const h of ['#/settings', `#/settings/levels/escape/${maya.id}`, '#/help', '#/players', '#/break']) expect(plan(h).redirect, h).toBeNull();
    expect(shouldBreak({ name: 'levelPicker', game: 'escape', playerId: maya.id }, null, NOON)).toBe(false);
  });

  it('stops once a grown-up adds time', () => {
    const { store, plan } = tired();
    store.addExtraMinutes(10);
    expect(plan('#/game/escape').redirect).toBe('/game/escape/1');
  });

  it('sends #/break Home while the child still has time, so it never says 0 minutes played', () => {
    const { store, plan } = setup();
    expect(plan('#/break')).toMatchObject({ redirect: '/', route: { name: 'home' } });
    store.addMinutesPlayed(29);
    expect(plan('#/break').redirect).toBe('/');
  });

  it('keeps #/break open once the limit is used up, and when nobody is playing (App sends that to Who’s playing)', () => {
    const { store, plan } = setup();
    store.addMinutesPlayed(30);
    expect(plan('#/break').redirect).toBeNull();
    const nobody = createProgressStore({ storage: { getItem: () => null, setItem: () => {} }, now: () => NOON, events: null });
    expect(planRoute(splitPath('#/break'), nobody.getState(), NOON).redirect).toBeNull();
  });
});
