/**
 * Usability round 2, decision 10 (older-bands-start): every screen names the same start level for a child
 * of an older band who has never played a game. The `#/game/<id>` redirect, Home's pill and card name,
 * the Settings row, the level picker and Break's line all take it from currentLevel (brief 2.6).
 */
import { describe, expect, it } from 'vitest';
import { getGame, type GameEntry } from '../../games/registry';
import { LEGACY_KEY, STORAGE_KEY, createProgressStore, findPlayer, gameOf, type AgeBand, type KeyValueStorage, type PuzzleRules } from '../../shared/progress';
import { splitPath } from '../../shared/router';
import { breakSavedLine, homeCardName, homePill, pickerCopy, planLevels, settingsRowName, settingsRowSub } from './levels';
import { gamePath, planRoute } from './routes';

const NOON = new Date(2026, 10, 16, 12, 0).getTime();

function setup(band: AgeBand) {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  let n = 0;
  const store = createProgressStore({ storage, now: () => NOON, newId: () => `id-${++n}`, events: null });
  const added = store.addPlayer({ name: 'Maya', ageBand: band, color: 'blue', dailyLimit: 30 });
  store.setActivePlayer(added.id);
  const maya = () => findPlayer(store.getState(), added.id)!;
  const plan = (hash: string) => planRoute(splitPath(hash), store.getState(), NOON);
  return { store, maya, plan };
}

const g = (id: string): GameEntry => getGame(id)!;
const SORTER: PuzzleRules = { set: 'sorter:1', seed: 0, levelCount: g('sorter').meta!.levelCount, stars: () => 2 };
const solve = (puzzle: number) => ({ puzzle, count: 1, usedHint: false, outOfTime: false });

/** The level (1-based) a new child of each band starts at, per game. */
const START: Record<string, Record<AgeBand, number>> = {
  sorter: { '3-4': 1, '5-6': 1, '7-8': 4, '9-10': 7 },
  numbers: { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 9 },
  mixer: { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 4 },
  pattern: { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 4 },
  builder: { '3-4': 1, '5-6': 1, '7-8': 3, '9-10': 3 },
  math: { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 1 },
  letters: { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 1 },
  escape: { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 1 },
  drop: { '3-4': 1, '5-6': 1, '7-8': 1, '9-10': 1 },
};

describe('a new child: every screen names the band start level', () => {
  for (const band of ['3-4', '5-6', '7-8', '9-10'] as const) {
    it(`ages ${band}`, () => {
      const { maya, plan } = setup(band);
      for (const [id, want] of Object.entries(START)) {
        const game = g(id);
        const n = want[band];
        const level = `${game.noun} ${n}`;
        const where = `${id} ${band}`;
        // The `#/game/<id>` redirect, and the old level grid, open the start level in one replace.
        expect(plan(`#/game/${id}`).redirect, where).toBe(`/game/${id}/${n}`);
        expect(plan(`#/game/${id}/levels`).redirect, where).toBe(`/game/${id}/${n}`);
        expect(plan(`#/game/${id}/${n}`).redirect, where).toBeNull();
        if (n > 1) expect(plan(`#/game/${id}/1`).redirect, where).toBe(`/game/${id}/${n}`);
        expect(gamePath(id, maya()), where).toBe(`/game/${id}/${n}`);
        // Home's pill and card name.
        expect(homePill(game.meta, gameOf(maya(), id), band, game.noun), where).toBe(level);
        expect(homeCardName(game, maya()), where).toBe(`${game.title}. ${game.sub}. ${level}.`);
        // The Settings row.
        expect(settingsRowSub(game, maya()), where).toBe(level);
        expect(settingsRowName(game, maya()), where).toBe(`${game.title} for Maya: ${level}. Pick a ${game.noun.toLowerCase()}`);
        // The picker: its current tile and arrival line.
        const levels = planLevels(game.meta!, gameOf(maya(), id), band);
        expect(levels.current, where).toBe(n - 1);
        expect(levels.chapters.flatMap((c) => c.tiles).find((t) => t.state === 'current')?.n, where).toBe(n);
        expect(pickerCopy(game, maya(), true).status(null), where).toBe(`Maya is on ${level}.`);
        // Break has no line: nothing is solved yet.
        expect(breakSavedLine(game, maya()), where).toBeNull();
      }
    });
  }

  it('the picker shows the start level open and the levels before it as today', () => {
    const { maya } = setup('7-8');
    const tiles = planLevels(g('sorter').meta!, gameOf(maya(), 'sorter'), '7-8').chapters.flatMap((c) => c.tiles);
    expect(tiles.map((t) => t.state)).toEqual(['open', 'locked', 'locked', 'current', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(pickerCopy(g('sorter'), maya(), true).status(0)).toBe('Level 1 picked. Maya hasn’t played it yet.');
  });
});

describe('the picker’s line for a level the child skipped', () => {
  it('a locked level before the start level is one the child has not played, not one still ahead', () => {
    const { maya } = setup('7-8');
    const status = pickerCopy(g('sorter'), maya(), true).status;
    expect(status(1)).toBe('Level 2 picked. Maya hasn’t played it yet.');
    expect(status(2)).toBe('Level 3 picked. Maya hasn’t played it yet.');
    // A level after the start level is still ahead.
    expect(status(4)).toBe('Level 5 picked. Maya hasn’t reached it yet.');
    expect(status(8)).toBe('Level 9 picked. Maya hasn’t reached it yet.');
  });

  it('every game with a band start says so for every skipped level, at 7-8 and 9-10', () => {
    for (const band of ['7-8', '9-10'] as const) {
      const { maya } = setup(band);
      for (const [id, want] of Object.entries(START)) {
        const game = g(id);
        const status = pickerCopy(game, maya(), true).status;
        for (let i = 1; i < want[band] - 1; i++) expect(status(i), `${id} ${band} ${game.noun} ${i + 1}`).toMatch(/ hasn’t played it yet\.$/);
        if (want[band] < game.meta!.levelCount) expect(status(want[band]), `${id} ${band} after the start`).toMatch(/ hasn’t reached it yet\.$/);
      }
    }
  });

  it('ages 3 to 6 keep today’s line: a locked level is still ahead', () => {
    for (const band of ['3-4', '5-6'] as const) {
      const { maya } = setup(band);
      expect(pickerCopy(g('sorter'), maya(), true).status(1), band).toBe('Level 2 picked. Maya hasn’t reached it yet.');
      expect(pickerCopy(g('numbers'), maya(), true).status(8), band).toBe('Level 9 picked. Maya hasn’t reached it yet.');
    }
  });

  it('a 9-10 child with a star on Level 1 is on Level 2, so Level 3 is still ahead', () => {
    const { store, maya } = setup('9-10');
    store.recordStars('sorter', 0, 2);
    expect(pickerCopy(g('sorter'), maya(), true).status(2)).toBe('Level 3 picked. Maya hasn’t reached it yet.');
  });
});

describe('starting a game over names the level the child starts again at', () => {
  /** Some progress in a game: a star on its start level and Level 1, a pick, and a run part way. */
  function played(store: ReturnType<typeof setup>['store'], id: string, start: number) {
    const count = g(id).meta!.levelCount;
    const rules: PuzzleRules = { set: `${id}:1`, seed: 0, levelCount: count, stars: () => 2 };
    store.recordStars(id, start - 1, 3);
    store.recordStars(id, 0, 1);
    store.startRun(id, Math.min(start, count - 1), rules);
    store.recordPuzzle(id, Math.min(start, count - 1), solve(0), rules);
    store.pickLevel(id, 1, count);
  }

  for (const band of ['3-4', '5-6', '7-8', '9-10'] as const) {
    it(`ages ${band}: the helper, the confirm and the toast name the level the reset leads to`, () => {
      const { store, maya, plan } = setup(band);
      for (const [id, want] of Object.entries(START)) {
        const game = g(id);
        const n = want[band];
        const level = `${game.noun} ${n}`;
        const lower = game.noun.toLowerCase();
        const where = `${id} ${band}`;
        played(store, id, n);
        const reset = pickerCopy(game, maya(), true).reset;
        expect(reset.helper, where).toBe(`Maya’s ${lower}s and stars in ${game.title} go back to ${level} on this device. Stickers stay in the sticker book.`);
        expect(reset.body, where).toBe(`${game.noun}s and stars in ${game.title} go back to ${level} on this device. Stickers stay. This can’t be undone.`);
        expect(reset.toast, where).toBe(`${game.title} starts again at ${level} for Maya.`);
        // And that is where the reset leads: every screen names it.
        store.resetGame(id);
        expect(gameOf(maya(), id).stars, where).toEqual({});
        expect(plan(`#/game/${id}`).redirect, where).toBe(`/game/${id}/${n}`);
        expect(settingsRowSub(game, maya()), where).toBe(level);
        expect(pickerCopy(game, maya(), true).status(null), where).toBe(`Maya is on ${level}.`);
      }
    });
  }

  it('reads the band at the time: a child moved to 9-10 starts Shape Sorter again at Level 7', () => {
    const { store, maya } = setup('5-6');
    expect(pickerCopy(g('sorter'), maya(), true).reset.toast).toBe('Shape Sorter starts again at Level 1 for Maya.');
    store.updatePlayer(maya().id, { ageBand: '9-10' });
    expect(pickerCopy(g('sorter'), maya(), true).reset.toast).toBe('Shape Sorter starts again at Level 7 for Maya.');
  });
});

describe('a 9-10 child in Shape Sorter', () => {
  it('who leaves Level 7 part way through sees Level 7 again, with the puzzles solved', () => {
    const { store, maya, plan } = setup('9-10');
    store.startRun('sorter', 6, SORTER);
    store.recordPuzzle('sorter', 6, solve(0), SORTER);
    store.recordPuzzle('sorter', 6, solve(1), SORTER);
    expect(plan('#/game/sorter').redirect).toBe('/game/sorter/7');
    expect(homePill(g('sorter').meta, gameOf(maya(), 'sorter'), '9-10', 'Level')).toBe('Level 7');
    expect(homeCardName(g('sorter'), maya())).toBe('Shape Sorter. Match each shape to its hole. Level 7, 2 of 4 puzzles solved.');
    expect(settingsRowSub(g('sorter'), maya())).toBe('Level 7, 2 of 4 puzzles');
    expect(pickerCopy(g('sorter'), maya(), true).status(null)).toBe('Maya is on Level 7, 2 of 4 puzzles solved.');
    expect(breakSavedLine(g('sorter'), maya())).toBe('Level 7 is saved with 2 of 4 puzzles solved.');
  });

  it('who finishes Level 7 goes on to Level 8', () => {
    const { store, maya, plan } = setup('9-10');
    store.startRun('sorter', 6, SORTER);
    for (const p of [0, 1, 2, 3]) store.recordPuzzle('sorter', 6, solve(p), SORTER);
    expect(gameOf(maya(), 'sorter').current).toBe(7);
    expect(plan('#/game/sorter').redirect).toBe('/game/sorter/8');
    expect(settingsRowSub(g('sorter'), maya())).toBe('Level 8');
  });

  it('with a star on Level 1 keeps today’s rule: the first level with no stars', () => {
    const { store, maya, plan } = setup('9-10');
    store.recordStars('sorter', 0, 2);
    expect(plan('#/game/sorter').redirect).toBe('/game/sorter/2');
    expect(homePill(g('sorter').meta, gameOf(maya(), 'sorter'), '9-10', 'Level')).toBe('Level 2');
  });

  it('who started Level 1 and is then moved to 9-10 in Settings stays on Level 1', () => {
    const { store, maya, plan } = setup('5-6');
    store.startRun('sorter', 0, SORTER);
    store.recordPuzzle('sorter', 0, solve(0), SORTER);
    store.updatePlayer(maya().id, { ageBand: '9-10' });
    expect(maya().ageBand).toBe('9-10');
    expect(plan('#/game/sorter').redirect).toBe('/game/sorter/1');
    expect(settingsRowSub(g('sorter'), maya())).toBe('Level 1, 1 of 4 puzzles');
    // A game they never played still starts at the band start.
    expect(plan('#/game/numbers').redirect).toBe('/game/numbers/9');
  });

  it('a grown-up can still pick an earlier level, and it sticks', () => {
    const { store, maya, plan } = setup('9-10');
    store.pickLevel('sorter', 1, SORTER.levelCount);
    expect(plan('#/game/sorter').redirect).toBe('/game/sorter/2');
    expect(settingsRowSub(g('sorter'), maya())).toBe('Level 2');
  });
});

describe('a device that already holds saved progress', () => {
  /** A store that loads what the device holds, as the app does when it opens. */
  function loaded(saved: Record<string, string>) {
    const data = new Map(Object.entries(saved));
    const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
    const store = createProgressStore({ storage, now: () => NOON, newId: () => 'migrated', events: null });
    const kid = () => store.getState().players[0];
    const opens = (id: string) => planRoute(splitPath(`#/game/${id}`), store.getState(), NOON).redirect;
    return { store, data, kid, opens };
  }

  /** The record an earlier version of the app wrote: version 2, no runs and no current unless given. */
  const v2 = (ageBand: string, games: Record<string, unknown>) => ({
    [STORAGE_KEY]: JSON.stringify({ version: 2, players: [{ id: 'a', name: 'Maya', ageBand, color: 'blue', games }], activePlayerId: 'a' }),
  });
  const savedRun = { set: 'sorter:1', seed: 0, queue: [1, 2, 3, 4, 5], solved: [{ puzzle: 0, count: 1, usedHint: false, outOfTime: false }], updatedAt: 1 };

  it('a 9-10 child who never played a game starts it at the band start, and other games keep their place', () => {
    const { kid, opens } = loaded(v2('9-10', { escape: { unlocked: 3, stars: { 0: 3, 1: 2, 2: 1 }, best: {} } }));
    expect(opens('sorter')).toBe('/game/sorter/7');
    expect(opens('numbers')).toBe('/game/numbers/9');
    expect(opens('escape')).toBe('/game/escape/4');
    expect(kid().games.escape.stars).toEqual({ 0: 3, 1: 2, 2: 1 });
  });

  it('saved stars keep the first level with no stars', () => {
    const { opens } = loaded(v2('9-10', { sorter: { unlocked: 2, stars: { 0: 3, 1: 2 }, best: {} } }));
    expect(opens('sorter')).toBe('/game/sorter/3');
  });

  it('a saved current wins, and a saved run on Level 1 stays on Level 1 with its solved puzzle', () => {
    expect(loaded(v2('9-10', { sorter: { unlocked: 2, stars: {}, best: {}, current: 2 } })).opens('sorter')).toBe('/game/sorter/3');
    const { kid, opens } = loaded(v2('9-10', { sorter: { unlocked: 0, stars: {}, best: {}, runs: { 0: savedRun } } }));
    expect(opens('sorter')).toBe('/game/sorter/1');
    expect(settingsRowSub(g('sorter'), kid())).toBe('Level 1, 1 of 4 puzzles');
  });

  it('a saved current that is no level of the game falls back to the band start', () => {
    expect(loaded(v2('9-10', { sorter: { unlocked: 0, stars: {}, best: {}, current: 99 } })).opens('sorter')).toBe('/game/sorter/7');
  });

  it('a broken saved run is dropped on load and counts as never played', () => {
    expect(loaded(v2('9-10', { sorter: { unlocked: 0, stars: {}, best: {}, runs: { 0: { set: 'sorter:1', queue: 'oops' } } } })).opens('sorter')).toBe('/game/sorter/7');
  });

  it('a star saved on a level the game no longer has counts as never played', () => {
    expect(loaded(v2('9-10', { sorter: { unlocked: 0, stars: { 99: 3 }, best: {} } })).opens('sorter')).toBe('/game/sorter/7');
  });

  it('a saved age band that is not one of ours loads as 5-6, which starts at Level 1', () => {
    const { kid, opens } = loaded(v2('11-12', {}));
    expect(kid().ageBand).toBe('5-6');
    expect(opens('sorter')).toBe('/game/sorter/1');
  });

  it('a first-version record moves into a 5-6 child at Level 1; moved to 9-10, only games with no stars use the band start', () => {
    const { store, kid, opens } = loaded({ [LEGACY_KEY]: JSON.stringify({ stars: { 'sorter:0': 2 } }) });
    expect(kid().ageBand).toBe('5-6');
    expect(opens('sorter')).toBe('/game/sorter/2');
    expect(opens('numbers')).toBe('/game/numbers/1');
    store.updatePlayer(kid().id, { ageBand: '9-10' });
    expect(opens('sorter')).toBe('/game/sorter/2');
    expect(opens('numbers')).toBe('/game/numbers/9');
  });

  it('working out the start level writes nothing: the child’s saved record stays as it was', () => {
    const saved = v2('9-10', {});
    const { data, kid, opens } = loaded(saved);
    expect(opens('sorter')).toBe('/game/sorter/7');
    expect(gameOf(kid(), 'sorter').current).toBeUndefined();
    expect(data.get(STORAGE_KEY)).toBe(saved[STORAGE_KEY]);
  });
});
