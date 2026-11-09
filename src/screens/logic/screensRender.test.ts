/**
 * The screens as they render for four-puzzle levels (brief 7.2 to 7.4): Home cards open the game,
 * Settings lists each game's progress, the picker sits behind the grown-up check, Break names a
 * level in progress. App is server-rendered with a stand-in window that only carries the hash.
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { GAMES, GAME_IDS } from '../../games/registry';
import { escapeLevelStars } from '../../games/run';
import { emptyState, progressStore, type Player, type PuzzleRules } from '../../shared/progress';
import { grownUpGate, setResumePath, settingsReturn } from './session';

function renderAt(hash: string): string {
  vi.stubGlobal('window', {
    location: { hash, pathname: '/', search: '', replace: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    innerWidth: 390,
    innerHeight: 844,
    setTimeout: () => 0,
    clearTimeout: () => {},
  });
  return renderToString(createElement(App));
}

const ESC: PuzzleRules = { set: 'escape:x', seed: 0, levelCount: 31, stars: escapeLevelStars };
const decode = (html: string) => html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');

let maya: Player;

beforeEach(() => {
  progressStore.replace(emptyState());
  maya = progressStore.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' });
  progressStore.setActivePlayer(maya.id);
  for (let i = 0; i < 8; i++) progressStore.recordStars('escape', i, 2);
  progressStore.startRun('escape', 8, ESC);
  for (const p of [0, 1]) progressStore.recordPuzzle('escape', 8, { puzzle: p, count: 6, par: 6, usedHint: false, outOfTime: false }, ESC);
  grownUpGate.reset();
  settingsReturn.setChild(null);
  settingsReturn.takeToast();
});

afterEach(() => {
  grownUpGate.reset();
  setResumePath('/');
  vi.unstubAllGlobals();
});

describe('Home', () => {
  it('links every card to the game, never to a level grid, and names the puzzle progress', () => {
    const html = decode(renderAt('#/'));
    for (const id of GAME_IDS) expect(html, id).toContain(`href="#/game/${id}"`);
    expect(html).not.toContain('/levels');
    expect(html).toContain('aria-label="Brick Escape. Slide bricks out their doors. Level 9, 2 of 4 puzzles solved."');
    expect(html).toContain('>Level 9<');
  });

  it('opens Color Mixer from Today’s discovery, which promises only what the level shows (six-games 11.1, decision 2)', () => {
    const html = decode(renderAt('#/'));
    const card = /<a class="sc-discovery" href="([^"]+)">([\s\S]*?)<\/a>/.exec(html);
    expect(card?.[1]).toBe('#/game/mixer');
    expect(card?.[2]).toContain("Today's discovery");
    expect(card?.[2]).toContain('Mix two colors to make a new one');
    expect(html).not.toContain('What do red and blue make?');
    expect(html).not.toContain('+1 sticker');
    expect(html).not.toContain('sc-discovery__reward');
  });

  it('names the batch 1 games by their level, with Coming soon gone from their cards (six-games 1)', () => {
    const html = decode(renderAt('#/'));
    for (const id of ['mixer', 'sorter', 'numbers']) {
      const g = GAMES.find((x) => x.id === id)!;
      expect(g.playable, id).toBe(true);
      expect(html).toContain(`aria-label="${g.title}. ${g.sub}. Level 1."`);
    }
    expect(GAMES.find((x) => x.id === 'mixer')!.sub).toBe('Mix two colors to make a new one');
    // The batch 2 games are still Coming soon.
    expect(html).toContain('aria-label="Brick Calculator. Add and take away with bricks. Coming soon."');
  });
});

describe('the level picker', () => {
  const hash = () => `#/settings/levels/escape/${maya.id}`;

  it('shows the grown-up check first, then the picker', () => {
    const locked = decode(renderAt(hash()));
    expect(locked).toContain('Grown-up check');
    expect(locked).not.toContain('Pick the level Maya plays next');
    grownUpGate.pass();
    const open = decode(renderAt(hash()));
    expect(open).not.toContain('Grown-up check');
    expect(open).toContain('Pick the level Maya plays next. Earned stars stay.');
    expect(open).toContain('Maya · 16 of 93 stars');
    expect(open).toContain('Maya is on Level 9, 2 of 4 puzzles solved.');
    expect(open).toContain('Play Level 9');
    expect(open).toContain('Start Brick Escape over');
    expect(open).toContain('aria-label="Back to settings"');
  });

  it('makes every tile a button, locked ones too, with the current one marked', () => {
    grownUpGate.pass();
    const open = decode(renderAt(hash()));
    expect(open).toContain('aria-label="Level 9, Maya’s current level"');
    expect(open).toMatch(/<button[^>]*aria-label="Level 9, Maya’s current level"[^>]*aria-current="step"/);
    expect(open).toMatch(/<button[^>]*aria-label="Level 20, locked"/);
    expect(open).not.toContain('aria-disabled');
    expect(open).not.toContain('Read this page aloud');
  });

  it('offers Set, not Play, for a child who is not playing now', () => {
    const leo = progressStore.addPlayer({ name: 'Leo', ageBand: '3-4', color: 'orange' });
    grownUpGate.pass();
    const open = decode(renderAt(`#/settings/levels/drop/${leo.id}`));
    expect(open).toContain('Set Stage 1 for Leo');
    expect(open).toContain('Leo is on Stage 1.');
  });

  it('opens even when the daily limit is used up', () => {
    progressStore.addMinutesPlayed(60);
    grownUpGate.pass();
    expect(decode(renderAt(hash()))).toContain('Pick the level Maya plays next');
  });
});

describe('Settings', () => {
  it('lists one row per playable game, each opening the picker', () => {
    grownUpGate.pass();
    const html = decode(renderAt('#/settings'));
    // Six-games brief 10.3: six rows after batch 1, in Home order.
    for (const id of ['escape', 'drop', 'letters', 'mixer', 'sorter', 'numbers']) expect(html).toContain(`href="#/settings/levels/${id}/${maya.id}"`);
    for (const g of GAMES) expect(html.includes(`href="#/settings/levels/${g.id}/${maya.id}"`), g.id).toBe(g.playable);
    const at = GAMES.filter((g) => g.playable).map((g) => html.indexOf(`href="#/settings/levels/${g.id}/${maya.id}"`));
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(html).not.toContain(`href="#/settings/levels/math/`);
    expect(html).toContain('aria-label="Brick Escape for Maya: Level 9, 2 of 4 puzzles. Pick a level"');
    expect(html).toContain('Stage 1');
    expect(html).toContain("Reset Maya's progress");
  });

  it('says the timer is only for the two timed games, since the kit games have no clock (six-games 3.4, 8.8)', () => {
    grownUpGate.pass();
    const html = decode(renderAt('#/settings'));
    expect(html).toContain('<p class="sc-sub sc-sub--small">Only Brick Escape and Brick Drop use this timer.</p>');
    expect(html.split('Only Brick Escape and Brick Drop use this timer.')).toHaveLength(2);
  });

  it('says what running out of time costs, as the star rules do (F5)', () => {
    grownUpGate.pass();
    const html = decode(renderAt('#/settings'));
    expect(html).toContain('Running out never ends the game. The level can then get at most 2 stars.');
    expect(html).not.toContain('speed star');
  });

  it('has an Age row for the child, with the four bands (D2)', () => {
    grownUpGate.pass();
    const html = decode(renderAt('#/settings'));
    expect(html).toContain('role="group" aria-label="Maya\'s age"');
    for (const band of ['3 to 4', '5 to 6', '7 to 8', '9 to 10']) expect(html).toContain(`aria-label="Ages ${band}"`);
    expect(html).toContain('A new age applies from the next puzzle. Solved puzzles stay solved.');
  });
});

describe('Break', () => {
  // Break draws only once today's limit is used up; with time left, #/break goes Home (routes.test.ts).
  beforeEach(() => {
    progressStore.addMinutesPlayed(maya.dailyLimit);
  });

  it('names the level in progress when it stopped one', () => {
    setResumePath('/game/escape/9');
    expect(decode(renderAt('#/break'))).toContain('Level 9 is saved with 2 of 4 puzzles solved.');
  });

  it('keeps the general saved line between levels', () => {
    setResumePath('/');
    const html = decode(renderAt('#/break'));
    expect(html).toContain('Your stars and levels are saved for next time.');
    expect(html).not.toContain('is saved with');
  });
});

describe('Support', () => {
  it('answers how a child replays a level', () => {
    const html = decode(renderAt('#/help'));
    expect(html).toContain('How does my child replay a level?');
    expect(html).toContain('In Settings, under Progress, tap the game and pick the level. Children can’t pick levels themselves.');
  });

  it('answers what running out of time costs, as the star rules do (F5)', () => {
    const html = decode(renderAt('#/help'));
    expect(html).toContain('The game keeps going, and the level can get at most 2 stars. Ages 3 to 4 play with a sand timer that never costs a star.');
    expect(html).not.toContain('speed star');
  });
});
