import { describe, expect, it } from 'vitest';
import type { GameMeta } from '../../games/meta';
import { getGame } from '../../games/registry';
import { emptyGame, type GameProgress, type Player } from '../../shared/progress';
import { authNotice, SOON } from './auth';
import { gateAsk, gateMatches } from './gate';
import { homePill, lockMessage, planLevels, tileLabel } from './levels';
import { backTarget, nextAvatarColor, notePath, shouldBreak } from './session';
import { earnedCount, STICKERS, stickerCells, stickerSource, stickersDue } from './stickers';

const META: GameMeta = {
  levelCount: 10,
  chapters: [
    { title: 'One', note: '', start: 0, count: 4 },
    { title: 'Two', note: '', start: 4, count: 6 },
    { title: 'Later', note: '', start: 10, count: 0, more: true },
  ],
};

const progress = (stars: Record<number, number>, unlocked = 0): GameProgress => ({ ...emptyGame(), stars, unlocked });
const states = (p: ReturnType<typeof planLevels>) => p.chapters.flatMap((c) => c.tiles.map((t) => t.state));

const NOON = new Date(2026, 10, 4, 12, 0).getTime();
const TODAY = '2026-11-04';

function player(over: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    name: 'Maya',
    ageBand: '7-8',
    color: 'blue',
    dailyLimit: 30,
    timerMode: 'auto',
    unnamed: false,
    createdAt: 0,
    updatedAt: 0,
    games: {},
    stickers: {},
    today: { day: TODAY, minutes: 0, extraMinutes: 0 },
    ...over,
  };
}

describe('level select', () => {
  it('opens only level 1 for a new player and makes it current', () => {
    const plan = planLevels(META, emptyGame(), '7-8');
    expect(states(plan)).toEqual(['current', ...Array(9).fill('locked')]);
    expect(plan.current).toBe(0);
    expect(plan.stars).toBe(0);
    expect(plan.maxStars).toBe(30);
    expect(plan.complete).toBe(false);
  });

  it('marks finished levels done and the next one current, linearly', () => {
    const plan = planLevels(META, progress({ 0: 3, 1: 1, 2: 2 }), '5-6');
    expect(states(plan).slice(0, 5)).toEqual(['done', 'done', 'done', 'current', 'locked']);
    expect(plan.stars).toBe(6);
    expect(plan.current).toBe(3);
  });

  it('opens the first level of every chapter for ages 9 to 10 only', () => {
    expect(states(planLevels(META, emptyGame(), '9-10'))[4]).toBe('open');
    expect(states(planLevels(META, emptyGame(), '7-8'))[4]).toBe('locked');
  });

  it('respects levels the store already opened', () => {
    expect(states(planLevels(META, progress({}, 2), '3-4')).slice(0, 4)).toEqual(['current', 'open', 'open', 'locked']);
  });

  it('is complete when every level has a star, with no current level', () => {
    const all = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, 2]));
    const plan = planLevels(META, progress(all), '7-8');
    expect(plan.complete).toBe(true);
    expect(plan.current).toBeNull();
    expect(homePill(META, progress(all), '7-8', 'Level')).toBe('All done');
  });

  it('keeps an open-ended chapter with no levels as a "More soon" chapter', () => {
    const last = planLevels(META, emptyGame(), '7-8').chapters[2];
    expect(last.tiles).toEqual([]);
    expect(last.more).toBe(true);
  });

  it('clamps out-of-range star values and ignores levels past the count', () => {
    const plan = planLevels({ levelCount: 2, chapters: [{ title: 'A', note: '', start: 0, count: 5 }] }, progress({ 0: 9, 1: -2 }), '7-8');
    expect(plan.chapters[0].tiles.map((t) => t.stars)).toEqual([3, 0]);
    expect(plan.levelCount).toBe(2);
  });

  it('explains a locked tile with the level to finish first', () => {
    const plan = planLevels(META, progress({ 0: 1 }), '7-8');
    expect(lockMessage(plan, 2, 'Level')).toBe('Finish Level 2 to open Level 3.');
    expect(lockMessage(plan, 5, 'Stage')).toBe('Finish Stage 2 first. Stages open one at a time.');
  });

  it('names tiles the way the board does', () => {
    expect(tileLabel({ index: 2, n: 3, state: 'done', stars: 1 }, 'Level')).toBe('Level 3, 1 star');
    expect(tileLabel({ index: 2, n: 3, state: 'done', stars: 2 }, 'Level')).toBe('Level 3, 2 stars');
    expect(tileLabel({ index: 8, n: 9, state: 'current', stars: 0 }, 'Level')).toBe('Level 9, play next');
    expect(tileLabel({ index: 12, n: 13, state: 'open', stars: 0 }, 'Stage')).toBe('Stage 13, not played');
    expect(tileLabel({ index: 11, n: 12, state: 'locked', stars: 0 }, 'Level')).toBe('Level 12, locked');
  });

  it('shows the current level on the Home pill, or Coming soon for games not built', () => {
    expect(homePill(META, progress({ 0: 1, 1: 1 }), '7-8', 'Stage')).toBe('Stage 3');
    expect(homePill(null, emptyGame(), '7-8', 'Level')).toBe('Coming soon');
  });
});

describe('sticker book', () => {
  it('has the 40 board stickers with unique ids and 5 x 5 art', () => {
    expect(STICKERS).toHaveLength(40);
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(40);
    for (const s of STICKERS) expect(stickerCells(s)).toHaveLength(25);
  });

  it('ties each game sticker of a playable game to a real chapter', () => {
    for (const s of STICKERS.filter((x) => x.game && getGame(x.game)?.playable)) {
      expect(stickerSource(s)?.chapter).toBeTruthy();
    }
    expect(stickerSource(STICKERS.find((s) => s.id === 'e3')!)).toMatchObject({ game: 'Brick Escape', chapter: 'Icy doors', playable: true });
    expect(stickerSource(STICKERS.find((s) => s.id === 'x1')!)).toBeNull();
  });

  it('gives no sticker for a new player', () => {
    expect(stickersDue(player())).toEqual([]);
    expect(stickersDue(null)).toEqual([]);
  });

  it('gives a chapter sticker once every level in the chapter has a star', () => {
    const escape = getGame('escape')!.meta!;
    const first = escape.chapters[0];
    const stars = Object.fromEntries(Array.from({ length: first.count }, (_, i) => [first.start + i, 1]));
    expect(stickersDue(player({ games: { escape: progress(stars) } }))).toEqual(['e1']);
    const missingOne = { ...stars, [first.start + first.count - 1]: 0 };
    expect(stickersDue(player({ games: { escape: progress(missingOne) } }))).toEqual([]);
  });

  it('does not give a sticker twice and counts only book stickers', () => {
    const escape = getGame('escape')!.meta!;
    const first = escape.chapters[0];
    const stars = Object.fromEntries(Array.from({ length: first.count }, (_, i) => [first.start + i, 3]));
    const p = player({ games: { escape: progress(stars) }, stickers: { e1: { earnedAt: 1, seen: true }, old: { earnedAt: 1, seen: true } } });
    expect(stickersDue(p)).toEqual([]);
    expect(earnedCount(p)).toBe(1);
  });
});

describe('grown-up check', () => {
  it('asks for forty-seven first and moves on after each try', () => {
    expect(gateAsk(0)).toEqual({ value: 47, words: 'forty-seven' });
    expect(gateAsk(1).value).toBe(62);
    expect(gateAsk(6).value).toBe(47);
  });

  it('accepts only the digits of the asked number', () => {
    expect(gateMatches('47', 0)).toBe(true);
    expect(gateMatches(' 47 ', 0)).toBe(true);
    expect(gateMatches('62', 0)).toBe(false);
    expect(gateMatches('', 0)).toBe(false);
    expect(gateMatches('forty-seven', 0)).toBe(false);
    expect(gateMatches('4.7e1', 0)).toBe(false);
    expect(gateMatches('62', 1)).toBe(true);
  });
});

describe('account messages', () => {
  it('shows the calm coming-soon message while accounts are off', () => {
    expect(authNotice('not-enabled', 'google')).toBe(SOON);
    expect(SOON.body).toMatch(/Playing doesn't need an account/);
  });

  it('uses one message for a wrong email or password and names the provider on failure', () => {
    expect(authNotice('wrong-credentials', 'email').title).toBe("That email and password don't match an account.");
    expect(authNotice('provider-failed', 'apple').title).toBe("Apple sign-in didn't finish.");
    expect(authNotice('unknown', 'facebook').tone).toBe('error');
  });

  it('never uses en or em dashes in any message', () => {
    const reasons = ['not-enabled', 'cancelled', 'offline', 'wrong-credentials', 'too-many-tries', 'provider-failed', 'unknown'] as const;
    for (const r of reasons) {
      const n = authNotice(r, 'google');
      expect(`${n.title} ${n.body}`).not.toMatch(/[\u2013\u2014]/);
    }
  });
});

describe('break and players', () => {
  it('sends play routes to Break once the limit is used up, and nothing else', () => {
    const tired = player({ today: { day: TODAY, minutes: 30, extraMinutes: 0 } });
    expect(shouldBreak({ name: 'home' }, tired, NOON)).toBe(true);
    expect(shouldBreak({ name: 'levels', id: 'escape' }, tired, NOON)).toBe(true);
    expect(shouldBreak({ name: 'game', id: 'escape', level: 3 }, tired, NOON)).toBe(true);
    expect(shouldBreak({ name: 'settings' }, tired, NOON)).toBe(false);
    expect(shouldBreak({ name: 'players' }, tired, NOON)).toBe(false);
    expect(shouldBreak({ name: 'home' }, player({ today: { day: TODAY, minutes: 29, extraMinutes: 0 } }), NOON)).toBe(false);
    expect(shouldBreak({ name: 'home' }, player({ today: { day: TODAY, minutes: 30, extraMinutes: 10 } }), NOON)).toBe(false);
    expect(shouldBreak({ name: 'home' }, null, NOON)).toBe(false);
  });

  it('starts a new day with no break', () => {
    expect(shouldBreak({ name: 'home' }, player({ today: { day: '2026-11-03', minutes: 90, extraMinutes: 0 } }), NOON)).toBe(false);
  });

  it('sends Back to an allowed previous path and falls back otherwise', () => {
    notePath('/settings');
    notePath('/help');
    expect(backTarget(['/settings', '/signin'], '/settings')).toBe('/settings');
    notePath('/help/terms');
    expect(backTarget(['/help'], '/help')).toBe('/help');
    notePath('/game/escape/levels');
    notePath('/help');
    expect(backTarget(['/settings', '/signin', '/signup'], '/settings')).toBe('/settings');
  });

  it('gives a new player a colour nobody uses yet', () => {
    expect(nextAvatarColor([])).toBe('red');
    expect(nextAvatarColor([player({ color: 'red' }), player({ color: 'yellow' })])).toBe('green');
  });
});
