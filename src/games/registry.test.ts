import { describe, expect, it } from 'vitest';
import { parseRoute, splitPath } from '../shared/router';
import { GAMES, GAME_IDS, getGame } from './registry';

describe('game registry', () => {
  it('lists the nine Home games in board order, three of them playable', () => {
    expect(GAMES.map((g) => g.id)).toEqual([...GAME_IDS]);
    expect(GAMES.filter((g) => g.playable).map((g) => g.id)).toEqual(['escape', 'drop', 'letters']);
    expect(getGame('escape')?.title).toBe('Brick Escape');
    expect(getGame('drop')?.noun).toBe('Stage');
    expect(getGame('slide')).toBeUndefined();
  });

  it('points every card at its Levels route', () => {
    for (const g of GAMES) expect(parseRoute(splitPath(g.route))).toEqual({ name: 'levels', id: g.id });
  });

  it('has chapters that cover each playable game’s levels in order, with no gaps', () => {
    for (const g of GAMES.filter((x) => x.playable)) {
      const m = g.meta!;
      let next = 0;
      for (const c of m.chapters) {
        expect(c.start).toBe(next);
        next += c.count;
      }
      expect(next).toBe(m.levelCount);
      expect(m.chapters.every((c) => !/\p{Extended_Pictographic}/u.test(c.title))).toBe(true);
    }
  });

  it('keeps every art piece inside the 56 x 44 box', () => {
    for (const g of GAMES) for (const a of g.art) expect(a.x + a.w <= 56 && a.y + a.h <= 44).toBe(true);
  });
});
