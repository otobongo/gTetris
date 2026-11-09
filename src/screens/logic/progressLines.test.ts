/**
 * Progress lines on Home, Settings, Break and the grown-up picker (brief 7.2, 7.3, 2.4 and 9),
 * all from the one current-level rule.
 */
import { describe, expect, it } from 'vitest';
import { dropLevelStars, escapeLevelStars, lettersLevelStars } from '../../games/run';
import { getGame, type GameEntry, type GameId } from '../../games/registry';
import { createProgressStore, emptyGame, type KeyValueStorage, type Player, type PuzzleRules } from '../../shared/progress';
import { breakSavedLine, homeCardName, homePill, levelSpot, pickerCopy, planLevels, settingsRowName, settingsRowSub, tileLabel } from './levels';
import { settingsReturn } from './session';

const NOON = new Date(2026, 10, 4, 12, 0).getTime();
const escape = getGame('escape')!;
const drop = getGame('drop')!;
const letters = getGame('letters')!;
/**
 * A game that is not built yet. A stub entry, not a registered game: once batch 2 lands every game in the
 * registry is playable, and ComingSoon stays for the next one (six-games brief 3.5).
 */
const notBuilt: GameEntry = {
  ...escape,
  id: 'chess' as GameId,
  title: 'Brick Chess',
  sub: 'Move bricks to win',
  playable: false,
  meta: null,
  route: '/game/chess',
  playRoute: '/game/chess',
};

const RULES: Record<string, PuzzleRules> = {
  escape: { set: 'escape:x', seed: 0, levelCount: 31, stars: escapeLevelStars },
  drop: { set: 'drop:1', seed: 0, levelCount: 12, stars: dropLevelStars },
  letters: { set: 'letters:1:7-8', seed: 1, levelCount: 24, stars: lettersLevelStars, hintsLeft: 3 },
};

function setup() {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  let n = 0;
  const store = createProgressStore({ storage, now: () => NOON, newId: () => `id-${++n}`, events: null });
  const id = store.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' }).id;
  store.setActivePlayer(id);
  const me = (): Player => store.getState().players.find((p) => p.id === id)!;
  /** Give the first `done` levels 2 stars each. */
  const finish = (game: GameEntry, done: number) => {
    for (let i = 0; i < done; i++) store.recordStars(game.id, i, 2);
  };
  /** Solve `count` puzzles (0 to 3) of a level, leaving its run stored. */
  const solve = (game: GameEntry, level: number, count: number) => {
    const rules = RULES[game.id];
    store.startRun(game.id, level, rules);
    for (let p = 0; p < count; p++) store.recordPuzzle(game.id, level, { puzzle: p, count: 1, par: 1, three: 9, two: 12, usedHint: false, outOfTime: false }, rules);
  };
  return { store, me, finish, solve, id };
}

describe('the one current level', () => {
  it('Home, Settings, Break and the picker all name the grown-up pick', () => {
    const { store, me, finish, solve } = setup();
    finish(escape, 9);
    store.pickLevel('escape', 19, 31);
    solve(escape, 19, 2);
    const p = me();
    expect(levelSpot(escape, p)).toEqual({ level: 19, solved: 2, unit: 'puzzle' });
    expect(homePill(escape.meta, p.games.escape, p.ageBand, escape.noun)).toBe('Level 20');
    expect(homeCardName(escape, p)).toBe('Brick Escape. Slide bricks out their doors. Level 20, 2 of 4 puzzles solved.');
    expect(settingsRowSub(escape, p)).toBe('Level 20, 2 of 4 puzzles');
    expect(breakSavedLine(escape, p)).toBe('Level 20 is saved with 2 of 4 puzzles solved.');
    expect(pickerCopy(escape, p, true).status(null)).toBe('Maya is on Level 20, 2 of 4 puzzles solved.');
    expect(planLevels(escape.meta!, p.games.escape, p.ageBand).current).toBe(19);
  });
});

describe('Home card names', () => {
  it('leave out the puzzle part until a puzzle is solved', () => {
    const { me, finish } = setup();
    finish(escape, 8);
    expect(homeCardName(escape, me())).toBe('Brick Escape. Slide bricks out their doors. Level 9.');
    expect(homeCardName(drop, me())).toBe('Brick Drop. Stack falling bricks into rows. Stage 1.');
  });

  it('say Stage for Brick Drop and words built on spelling levels', () => {
    const { me, finish, solve } = setup();
    finish(drop, 3);
    solve(drop, 3, 1);
    finish(letters, 16);
    solve(letters, 16, 2);
    expect(homeCardName(drop, me())).toBe('Brick Drop. Stack falling bricks into rows. Stage 4, 1 of 4 puzzles solved.');
    expect(homeCardName(letters, me())).toBe('Letter Builder. Alphabet, sounds and spelling. Level 17, 2 of 4 words built.');
  });

  it('count puzzles, not words, on the Letter Builder levels before spelling', () => {
    const { me, finish, solve } = setup();
    finish(letters, 3);
    solve(letters, 3, 1);
    expect(homeCardName(letters, me())).toBe('Letter Builder. Alphabet, sounds and spelling. Level 4, 1 of 4 puzzles solved.');
  });

  it('say All done for a finished game and Coming soon for a game not built', () => {
    const { me, finish } = setup();
    finish(drop, drop.meta!.levelCount);
    expect(homeCardName(drop, me())).toBe('Brick Drop. Stack falling bricks into rows. All done.');
    expect(homePill(drop.meta, me().games.drop, '7-8', 'Stage')).toBe('All done');
    expect(homeCardName(notBuilt, me())).toBe('Brick Chess. Move bricks to win. Coming soon.');
    expect(homePill(notBuilt.meta, emptyGame(), '7-8', notBuilt.noun)).toBe('Coming soon');
    expect(settingsRowSub(notBuilt, me())).toBe('Coming soon');
  });

  it('work with no player at all', () => {
    expect(homeCardName(escape, null)).toBe('Brick Escape. Slide bricks out their doors. Level 1.');
  });
});

describe('Settings game rows', () => {
  it('give the level, then the puzzles solved, in each game’s words', () => {
    const { me, finish, solve } = setup();
    finish(escape, 8);
    solve(escape, 8, 2);
    finish(letters, 16);
    solve(letters, 16, 3);
    const p = me();
    expect(settingsRowSub(escape, p)).toBe('Level 9, 2 of 4 puzzles');
    expect(settingsRowSub(drop, p)).toBe('Stage 1');
    expect(settingsRowSub(letters, p)).toBe('Level 17, 3 of 4 words');
    expect(settingsRowName(escape, p)).toBe('Brick Escape for Maya: Level 9, 2 of 4 puzzles. Pick a level');
    expect(settingsRowName(drop, p)).toBe('Brick Drop for Maya: Stage 1. Pick a stage');
  });

  it('say every level or stage is done for a finished game', () => {
    const { me, finish } = setup();
    finish(escape, 31);
    finish(drop, 12);
    expect(settingsRowSub(escape, me())).toBe('All levels done');
    expect(settingsRowSub(drop, me())).toBe('All stages done');
  });
});

describe('Break, mid-level', () => {
  it('names the level and its solved puzzles, or words built', () => {
    const { me, finish, solve } = setup();
    finish(drop, 3);
    solve(drop, 3, 2);
    finish(letters, 16);
    solve(letters, 16, 1);
    expect(breakSavedLine(drop, me())).toBe('Stage 4 is saved with 2 of 4 puzzles solved.');
    expect(breakSavedLine(letters, me())).toBe('Level 17 is saved with 1 of 4 words built.');
  });

  it('has no line with nothing solved, a finished game or a game not built', () => {
    const { me, finish } = setup();
    expect(breakSavedLine(escape, me())).toBeNull();
    finish(drop, 12);
    expect(breakSavedLine(drop, me())).toBeNull();
    expect(breakSavedLine(notBuilt, me())).toBeNull();
    expect(breakSavedLine(escape, null)).toBeNull();
  });
});

describe('the grown-up picker', () => {
  it('writes the sub and intro with the child’s stars', () => {
    const { me, finish } = setup();
    finish(escape, 8);
    const c = pickerCopy(escape, me(), true);
    expect(c.sub).toBe('Maya · 16 of 93 stars');
    expect(c.intro).toBe('Pick the level Maya plays next. Earned stars stay.');
    expect(pickerCopy(drop, me(), true).intro).toBe('Pick the stage Maya plays next. Earned stars stay.');
  });

  it('says where the child is on arrival, with or without solved puzzles, or that every level is done', () => {
    const { me, finish, solve } = setup();
    finish(escape, 8);
    expect(pickerCopy(escape, me(), true).status(null)).toBe('Maya is on Level 9.');
    solve(escape, 8, 1);
    expect(pickerCopy(escape, me(), true).status(null)).toBe('Maya is on Level 9, 1 of 4 puzzles solved.');
    expect(pickerCopy(escape, me(), true).status(8)).toBe('Maya is on Level 9, 1 of 4 puzzles solved.');
    finish(drop, 12);
    expect(pickerCopy(drop, me(), true).status(null)).toBe('Maya has finished every stage.');
  });

  it('describes a picked level by what it holds: a run, finished, open or locked', () => {
    const { store, me, finish, solve } = setup();
    finish(escape, 8);
    solve(escape, 6, 2); // a replay a grown-up started earlier
    store.pickLevel('escape', 8, 31);
    const c = pickerCopy(escape, me(), true);
    expect(c.status(6)).toBe('Level 7 picked. Maya goes on from puzzle 3.');
    expect(c.status(4)).toBe('Level 5 picked. Maya plays it again from puzzle 1.');
    expect(c.status(13)).toBe('Level 14 picked. Maya hasn’t reached it yet.');
  });

  it('calls an open, unplayed level open and says words on spelling levels', () => {
    const { store, me, finish, solve } = setup();
    store.updatePlayer(me().id, { ageBand: '9-10' });
    expect(pickerCopy(escape, me(), true).status(8)).toBe('Level 9 picked. Maya hasn’t played it yet.');
    finish(letters, 18);
    solve(letters, 16, 2);
    store.pickLevel('letters', 18, 24);
    const c = pickerCopy(letters, me(), true);
    expect(c.status(16)).toBe('Level 17 picked. Maya goes on from word 3.');
    expect(c.status(17)).toBe('Level 18 picked. Maya plays it again from word 1.');
  });

  it('labels the footer Play for the active child and Set for another, with the toast', () => {
    const { store, me } = setup();
    const leo = store.addPlayer({ name: 'Leo', ageBand: '3-4', color: 'orange' });
    expect(pickerCopy(escape, me(), true).button(4)).toBe('Play Level 5');
    const c = pickerCopy(drop, leo, false);
    expect(c.button(4)).toBe('Set Stage 5 for Leo');
    expect(c.toast(4)).toBe('Leo plays Stage 5 next in Brick Drop.');
    expect(pickerCopy(escape, leo, false).toast(4)).toBe('Leo plays Level 5 next in Brick Escape.');
  });

  it('writes the per-game reset in the game’s words', () => {
    const { me } = setup();
    expect(pickerCopy(escape, me(), true).reset).toEqual({
      heading: 'Start Brick Escape over',
      helper: 'Maya’s levels and stars in Brick Escape go back to Level 1 on this device. Stickers stay in the sticker book.',
      button: 'Reset Brick Escape for Maya',
      title: 'Reset Brick Escape for Maya?',
      body: 'Levels and stars in Brick Escape go back to Level 1 on this device. Stickers stay. This can’t be undone.',
      go: 'Reset Brick Escape',
      toast: 'Brick Escape starts again at Level 1 for Maya.',
    });
    const r = pickerCopy(drop, me(), true).reset;
    expect(r.helper).toBe('Maya’s stages and stars in Brick Drop go back to Stage 1 on this device. Stickers stay in the sticker book.');
    expect(r.toast).toBe('Brick Drop starts again at Stage 1 for Maya.');
  });

  it('shows the current level as current even when a grown-up picked a finished one', () => {
    const { store, me, finish } = setup();
    finish(escape, 8);
    store.pickLevel('escape', 3, 31);
    const plan = planLevels(escape.meta!, me().games.escape, '7-8');
    const tiles = plan.chapters.flatMap((c) => c.tiles);
    expect(tiles[3]).toMatchObject({ state: 'current', stars: 2 });
    expect(tiles[8].state).toBe('open');
    expect(plan.complete).toBe(false);
    expect(tileLabel(tiles[3], 'Level', 'Maya')).toBe('Level 4, Maya’s current level');
    expect(tileLabel(tiles[3], 'Stage', 'Leo')).toBe('Stage 4, Leo’s current stage');
  });

  it('starts the game over at Level 1 after a reset, and keeps the stickers', () => {
    const { store, me, finish, solve } = setup();
    finish(escape, 8);
    solve(escape, 8, 2);
    store.awardSticker('e1');
    store.resetGame('escape');
    expect(levelSpot(escape, me())).toEqual({ level: 0, solved: 0, unit: 'puzzle' });
    expect(pickerCopy(escape, me(), true).status(null)).toBe('Maya is on Level 1.');
    expect(Object.keys(me().stickers)).toEqual(['e1']);
  });
});

describe('copy', () => {
  it('has no en or em dashes in any progress line', () => {
    const { me, finish, solve } = setup();
    finish(escape, 8);
    solve(escape, 8, 2);
    const lines: string[] = [];
    // Six-games brief 10.3: every playable game, the batch 1 kit games too.
    for (const g of [escape, drop, letters, ...['mixer', 'sorter', 'numbers'].map((id) => getGame(id)!)]) {
      const c = pickerCopy(g, me(), false);
      lines.push(homeCardName(g, me()), settingsRowName(g, me()), c.sub, c.intro, c.status(null), c.status(3), c.status(20), c.button(2), c.toast(2), ...Object.values(c.reset));
    }
    for (const l of lines) expect(l).not.toMatch(/[–—]/);
  });
});

describe('Settings coming back from the picker', () => {
  it('remembers the child and hands its toast over once', () => {
    settingsReturn.setChild('p2');
    settingsReturn.setToast('Leo plays Level 5 next in Brick Escape.');
    expect(settingsReturn.child()).toBe('p2');
    expect(settingsReturn.takeToast()).toBe('Leo plays Level 5 next in Brick Escape.');
    expect(settingsReturn.takeToast()).toBe('');
    settingsReturn.setChild(null);
    expect(settingsReturn.child()).toBeNull();
  });
});
