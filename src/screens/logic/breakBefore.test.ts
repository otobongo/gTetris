/** Brief 2.4: Next puzzle and Play Level check the daily limit; Break opens at a puzzle boundary. */
import { describe, expect, it } from 'vitest';
import type { Player } from '../../shared/progress';
import { breakBefore, getResumePath, setResumePath } from './session';

const NOON = new Date(2026, 10, 4, 12, 0).getTime();

function player(minutes: number, extraMinutes = 0, day = '2026-11-04'): Player {
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
    today: { day, minutes, extraMinutes },
  };
}

function check(p: Player | null, path = '/game/escape/9') {
  const went: string[] = [];
  const blocked = breakBefore(path, { player: p, now: NOON, go: (to) => went.push(to) });
  return { blocked, went };
}

describe('breakBefore', () => {
  it('lets the game go on while there is time left', () => {
    setResumePath('/');
    expect(check(player(19))).toEqual({ blocked: false, went: [] });
    expect(getResumePath()).toBe('/');
  });

  it('opens Break when the limit is used up, resuming on the level’s route', () => {
    expect(check(player(20))).toEqual({ blocked: true, went: ['/break'] });
    expect(getResumePath()).toBe('/game/escape/9');
  });

  it('counts the minutes a grown-up added', () => {
    expect(check(player(25, 10)).blocked).toBe(false);
    expect(check(player(30, 10)).blocked).toBe(true);
  });

  it('a new day starts the count again', () => {
    expect(check(player(60, 0, '2026-11-03')).blocked).toBe(false);
  });

  it('never blocks without a player', () => {
    expect(check(null)).toEqual({ blocked: false, went: [] });
  });

  it('adds the leading slash to a resume path without one', () => {
    check(player(20), 'game/drop/4');
    expect(getResumePath()).toBe('/game/drop/4');
  });
});
