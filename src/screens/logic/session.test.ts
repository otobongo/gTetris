import { describe, expect, it } from 'vitest';
import { AVATAR_COLORS, type Player } from '../../shared/progress';
import { backTarget, getResumePath, grownUpGate, isPlayRoute, nextAvatarColor, notePath, setResumePath, shouldBreak } from './session';

const NOON = new Date(2026, 10, 4, 12, 0).getTime();

function player(over: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Maya',
    ageBand: '7-8',
    color: 'blue',
    dailyLimit: 20,
    timerMode: 'auto',
    unnamed: false,
    createdAt: 0,
    updatedAt: 0,
    games: {},
    stickers: {},
    today: { day: '2026-11-04', minutes: 0, extraMinutes: 0 },
    ...over,
  };
}

describe('Break: which screens it blocks', () => {
  it('treats Home, Levels and the games as play, and nothing else', () => {
    expect(isPlayRoute({ name: 'home' })).toBe(true);
    expect(isPlayRoute({ name: 'levels', id: 'drop' })).toBe(true);
    expect(isPlayRoute({ name: 'game', id: 'letters', level: null })).toBe(true);
    expect(isPlayRoute({ name: 'game', id: 'letters', level: 4 })).toBe(true);
    for (const name of ['players', 'stickers', 'break', 'settings', 'signin', 'signup', 'help', 'terms', 'privacy'] as const) {
      expect(isPlayRoute({ name }), name).toBe(false);
    }
  });

  it('breaks exactly when the minutes played reach the limit plus extra time', () => {
    const at = (minutes: number, extraMinutes = 0) => shouldBreak({ name: 'home' }, player({ today: { day: '2026-11-04', minutes, extraMinutes } }), NOON);
    expect(at(19)).toBe(false);
    expect(at(20)).toBe(true);
    expect(at(21)).toBe(true);
    expect(at(29, 10)).toBe(false);
    expect(at(30, 10)).toBe(true);
  });

  it('uses each player’s own limit', () => {
    const today = { day: '2026-11-04', minutes: 45, extraMinutes: 0 };
    expect(shouldBreak({ name: 'home' }, player({ dailyLimit: 30, today }), NOON)).toBe(true);
    expect(shouldBreak({ name: 'home' }, player({ dailyLimit: 60, today }), NOON)).toBe(false);
  });

  it('does not carry yesterday’s extra time into today', () => {
    const p = player({ today: { day: '2026-11-03', minutes: 0, extraMinutes: 60 } });
    // a new day: the stored extra time belongs to the 3rd, so today starts at the plain limit
    expect(shouldBreak({ name: 'home' }, p, NOON)).toBe(false);
    expect(shouldBreak({ name: 'home' }, { ...p, today: { day: '2026-11-04', minutes: 20, extraMinutes: 0 } }, NOON)).toBe(true);
  });
});

describe('Break: where play picks up again', () => {
  it('starts at Home and remembers the path the limit stopped, with a leading slash', () => {
    expect(getResumePath()).toBe('/');
    setResumePath('/game/escape/4');
    expect(getResumePath()).toBe('/game/escape/4');
    setResumePath('game/drop/levels');
    expect(getResumePath()).toBe('/game/drop/levels');
  });
});

describe('grown-up pages: the check and the Back button', () => {
  it('stays passed until it is reset', () => {
    expect(grownUpGate.passed()).toBe(false);
    grownUpGate.pass();
    expect(grownUpGate.passed()).toBe(true);
    grownUpGate.pass();
    expect(grownUpGate.passed()).toBe(true);
    grownUpGate.reset();
    expect(grownUpGate.passed()).toBe(false);
  });

  it('falls back when nothing came before, and ignores a repeat of the same path', () => {
    expect(backTarget(['/'], '/settings')).toBe('/settings');
    notePath('/');
    expect(backTarget(['/'], '/settings')).toBe('/settings'); // still on the first path
    notePath('settings');
    expect(backTarget(['/'], '/help')).toBe('/');
    notePath('/settings');
    expect(backTarget(['/'], '/help')).toBe('/'); // the same path again does not replace "before"
  });

  it('never sends Back to a path that is not allowed', () => {
    notePath('/game/escape/3');
    notePath('/settings');
    expect(backTarget(['/help', '/signin'], '/')).toBe('/');
  });
});

describe('a new player’s avatar colour', () => {
  const withColors = (colors: readonly string[]) => colors.map((c, i) => player({ id: `p${i}`, color: c as Player['color'] }));

  it('takes the first colour nobody has, in board order', () => {
    expect(nextAvatarColor(withColors(['red', 'green']))).toBe('yellow');
    expect(nextAvatarColor(withColors(['blue', 'blue']))).toBe('red');
  });

  it('cycles once all eight colours are taken', () => {
    const eight = withColors(AVATAR_COLORS);
    expect(nextAvatarColor(eight)).toBe(AVATAR_COLORS[0]);
    expect(nextAvatarColor([...eight, player({ id: 'x', color: 'red' })])).toBe(AVATAR_COLORS[1]);
  });
});
