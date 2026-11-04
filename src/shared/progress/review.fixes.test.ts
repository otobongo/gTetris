/**
 * Cases from the test and security review: strict level keys, no-op profile edits, and keys
 * from parsed JSON that must never reach an object's prototype chain.
 */
import { describe, expect, it } from 'vitest';
import { LIMIT_MAX } from './types';
import { addPlayer, emptyState, migrateV1, sanitize, updatePlayer } from './model';

const NOW = new Date(2026, 10, 4, 12, 0).getTime();
const LATER = NOW + 60_000;

describe('level keys: only plain digits count', () => {
  const odd = ['', ' 2', '2 ', '1e1', '0x3', '+4', '-1', '1.0', '0b1', 'Infinity', 'NaN', '٣'];

  it('migrateV1 drops v1 keys whose level part is not plain digits', () => {
    const stars: Record<string, number> = { 'slide:3': 2, 'drop:07': 1 };
    const best: Record<string, number> = { 'drop:5': 40 };
    for (const k of odd) {
      stars[`slide:${k}`] = 3;
      best[`drop:${k}`] = 99;
    }
    const s = migrateV1({ stars, best }, NOW, 'p1');
    const games = s.players[0].games;
    expect(games.escape.stars).toEqual({ 3: 2 });
    expect(games.drop.stars).toEqual({ 7: 1 });
    expect(games.drop.best).toEqual({ 5: 40 });
  });

  it('sanitize drops stored level keys that are not plain digits', () => {
    const stars: Record<string, number> = { '4': 2, '0': 1 };
    const best: Record<string, number> = { '2': 30 };
    for (const k of odd) {
      stars[k] = 3;
      best[k] = 99;
    }
    const raw = JSON.parse(JSON.stringify({ players: [{ id: 'a', games: { drop: { unlocked: 0, stars, best } } }] }));
    const g = sanitize(raw, NOW).players[0].games.drop;
    expect(g.stars).toEqual({ 0: 1, 4: 2 });
    expect(g.best).toEqual({ 2: 30 });
    expect(g.unlocked).toBe(5);
  });
});

describe('updatePlayer: an edit that changes nothing is not an edit', () => {
  const base = addPlayer(emptyState(), { name: 'Maya', ageBand: '7-8', color: 'blue', dailyLimit: LIMIT_MAX }, 'p1', NOW);

  it('returns the same state for an empty patch', () => {
    expect(updatePlayer(base, 'p1', {}, LATER)).toBe(base);
  });

  it('returns the same state when every value equals the current one', () => {
    const p = base.players[0];
    expect(updatePlayer(base, 'p1', { name: p.name, ageBand: p.ageBand, color: p.color, dailyLimit: p.dailyLimit, timerMode: p.timerMode }, LATER)).toBe(base);
  });

  it('returns the same state when a value only matches after cleaning or clamping', () => {
    expect(updatePlayer(base, 'p1', { name: '  Maya  ' }, LATER)).toBe(base);
    expect(updatePlayer(base, 'p1', { dailyLimit: 500 }, LATER)).toBe(base);
    expect(updatePlayer(base, 'p1', { dailyLimit: LIMIT_MAX + 0.4 }, LATER)).toBe(base);
  });

  it('returns the same state when every value is ignored', () => {
    const bad = { name: '   ', ageBand: '11-12', color: 'gold', timerMode: 'turbo' } as unknown as Parameters<typeof updatePlayer>[2];
    expect(updatePlayer(base, 'p1', bad, LATER)).toBe(base);
  });

  it('still stamps updatedAt when one value really changes', () => {
    const next = updatePlayer(base, 'p1', { name: 'Maya', color: 'teal' }, LATER);
    expect(next).not.toBe(base);
    expect(next.players[0]).toMatchObject({ color: 'teal', updatedAt: LATER });
  });

  it('naming an unnamed player with its current name still clears "unnamed"', () => {
    const s = { ...base, players: [{ ...base.players[0], name: 'Player 1', unnamed: true }] };
    const next = updatePlayer(s, 'p1', { name: 'Player 1' }, LATER);
    expect(next.players[0]).toMatchObject({ name: 'Player 1', unnamed: false, updatedAt: LATER });
  });
});

describe('sanitize: keys from parsed JSON never touch a prototype', () => {
  const BAD = ['__proto__', 'constructor', 'prototype'];
  const json = `{
    "players": [{
      "id": "a",
      "games": {
        "__proto__": { "unlocked": 9, "stars": { "0": 3 } },
        "constructor": { "unlocked": 4 },
        "prototype": { "unlocked": 2 },
        "drop": { "unlocked": 1, "stars": { "__proto__": 3, "0": 2 }, "best": { "constructor": 5 } }
      },
      "stickers": {
        "__proto__": { "earnedAt": 1, "seen": true },
        "constructor": { "earnedAt": 2 },
        "prototype": { "earnedAt": 3 },
        "owl": { "earnedAt": 4 }
      }
    }]
  }`;

  it('copies none of the special keys and keeps every map a plain object', () => {
    const p = sanitize(JSON.parse(json), NOW).players[0];
    for (const map of [p.games, p.stickers, p.games.drop.stars, p.games.drop.best]) {
      expect(Object.getPrototypeOf(map)).toBe(Object.prototype);
      for (const k of BAD) expect(Object.prototype.hasOwnProperty.call(map, k), k).toBe(false);
    }
    expect(Object.keys(p.games)).toEqual(['drop']);
    expect(Object.keys(p.stickers)).toEqual(['owl']);
    expect(p.games.drop.stars).toEqual({ 0: 2 });
    expect(p.games.drop.best).toEqual({});
    // a read of a game nobody played does not find inherited data
    expect((p.games as Record<string, unknown>).unlocked).toBeUndefined();
    expect(({} as Record<string, unknown>).unlocked).toBeUndefined();
  });
});
