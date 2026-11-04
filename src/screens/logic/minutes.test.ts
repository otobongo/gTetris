import { describe, expect, it } from 'vitest';
import { createProgressStore } from '../../shared/progress/store';
import { activePlayer, isBreakTime, minutesLeft, playToday } from '../../shared/progress/model';
import { MAX_STEP_MS, MINUTE_MS, TICK_MS, countPlayTime } from './minutes';
import { shouldBreak } from './session';

/** Runs `ms` of play through the counter in TICK_MS steps, the way the play clock does. */
function play(ms: number, visible = true, start = 0) {
  let carry = start;
  let minutes = 0;
  for (let t = 0; t < ms; t += TICK_MS) {
    const c = countPlayTime(carry, Math.min(TICK_MS, ms - t), visible);
    carry = c.carry;
    minutes += c.minutes;
  }
  return { carry, minutes };
}

describe('play clock: counting minutes', () => {
  it('counts one minute for every 60 seconds of visible play', () => {
    expect(play(MINUTE_MS)).toEqual({ carry: 0, minutes: 1 });
    expect(play(5 * MINUTE_MS)).toEqual({ carry: 0, minutes: 5 });
  });

  it('keeps part of a minute for later instead of rounding it up or dropping it', () => {
    expect(play(MINUTE_MS - 1)).toEqual({ carry: MINUTE_MS - 1, minutes: 0 });
    const first = play(30_000);
    expect(first.minutes).toBe(0);
    // the next level picks up where the last one stopped
    expect(play(30_000, true, first.carry)).toEqual({ carry: 0, minutes: 1 });
  });

  it('never counts time while the page is hidden', () => {
    expect(play(10 * MINUTE_MS, false)).toEqual({ carry: 0, minutes: 0 });
    expect(play(10 * MINUTE_MS, false, 42_000)).toEqual({ carry: 42_000, minutes: 0 });
  });

  it('counts nothing for a tick with no time in it', () => {
    expect(countPlayTime(12_000, 0, true)).toEqual({ carry: 12_000, minutes: 0 });
  });

  it('can hand over more than one minute from a single tick that carries a lot', () => {
    expect(countPlayTime(MINUTE_MS * 2 - 1, TICK_MS, true)).toEqual({ carry: TICK_MS - 1, minutes: 2 });
  });

  it('does not count a long gap between ticks, such as a tablet that slept with a level open', () => {
    // The interval does not run while the device sleeps. The first tick after waking sees the page
    // visible again; the hours in between were not play.
    const woke = countPlayTime(0, 2 * 60 * MINUTE_MS, true);
    expect(woke.minutes).toBe(0);
    expect(woke.carry).toBeLessThanOrEqual(2 * TICK_MS);
  });

  it('counts a late tick in full up to two ticks long, and no more', () => {
    expect(countPlayTime(0, MAX_STEP_MS, true).carry).toBe(MAX_STEP_MS);
    expect(countPlayTime(0, MAX_STEP_MS + 1, true).carry).toBe(MAX_STEP_MS);
    expect(countPlayTime(MINUTE_MS - 1, MAX_STEP_MS + 5_000, true)).toEqual({ carry: MAX_STEP_MS - 1, minutes: 1 });
  });

  it('never takes counted time away when the device clock goes backwards', () => {
    const back = countPlayTime(50_000, -60 * MINUTE_MS, true);
    expect(back).toEqual({ carry: 50_000, minutes: 0 });
    expect(countPlayTime(back.carry, 10_000, true).minutes).toBe(1);
  });

  it('ignores a broken time value instead of getting stuck', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const c = countPlayTime(20_000, bad, true);
      expect(c, String(bad)).toEqual({ carry: 20_000, minutes: 0 });
    }
  });
});

describe('daily minutes reach the limit and Break takes over', () => {
  const NOON = new Date(2026, 10, 4, 12, 0).getTime();
  const maya = { name: 'Maya', ageBand: '7-8' as const, color: 'blue' as const };

  function setup(limit = 20) {
    let t = NOON;
    const store = createProgressStore({ storage: null, now: () => t, newId: () => 'p1' });
    store.addPlayer({ ...maya, dailyLimit: limit });
    let carry = 0;
    const playFor = (ms: number) => {
      const c = play(ms, true, carry);
      carry = c.carry;
      if (c.minutes > 0) store.addMinutesPlayed(c.minutes);
      t += ms;
    };
    const player = () => activePlayer(store.getState())!;
    return { store, playFor, player, now: () => t, setNow: (ms: number) => (t = ms) };
  }

  it('lets a child play right up to the limit, then sends play screens to Break', () => {
    const { playFor, player, now } = setup(20);
    playFor(19 * MINUTE_MS + 59_000);
    expect(playToday(player(), now()).minutes).toBe(19);
    expect(minutesLeft(player(), now())).toBe(1);
    expect(shouldBreak({ name: 'home' }, player(), now())).toBe(false);
    playFor(1_000);
    expect(minutesLeft(player(), now())).toBe(0);
    expect(isBreakTime(player(), now())).toBe(true);
    expect(shouldBreak({ name: 'game', id: 'drop', level: 2 }, player(), now())).toBe(true);
  });

  it('lets a child play on for the extra minutes a grown-up adds, then breaks again', () => {
    const { store, playFor, player, now } = setup(10);
    playFor(10 * MINUTE_MS);
    expect(isBreakTime(player(), now())).toBe(true);
    store.addExtraMinutes(10);
    expect(shouldBreak({ name: 'levels', id: 'escape' }, player(), now())).toBe(false);
    expect(minutesLeft(player(), now())).toBe(10);
    playFor(10 * MINUTE_MS);
    expect(shouldBreak({ name: 'levels', id: 'escape' }, player(), now())).toBe(true);
  });

  it('keeps going past the limit without a negative count when a level runs long', () => {
    const { playFor, player, now } = setup(10);
    playFor(14 * MINUTE_MS);
    expect(playToday(player(), now()).minutes).toBe(14);
    expect(minutesLeft(player(), now())).toBe(0);
  });

  it('starts the next day with a fresh count and no break', () => {
    const { playFor, player, setNow, now } = setup(10);
    playFor(12 * MINUTE_MS);
    expect(isBreakTime(player(), now())).toBe(true);
    setNow(new Date(2026, 10, 5, 8, 0).getTime());
    expect(isBreakTime(player(), now())).toBe(false);
    expect(minutesLeft(player(), now())).toBe(10);
    playFor(3 * MINUTE_MS);
    expect(player().today).toEqual({ day: '2026-11-05', minutes: 3, extraMinutes: 0 });
  });

  it('never breaks the grown-up screens, Break itself or the sticker book', () => {
    const { playFor, player, now } = setup(10);
    playFor(30 * MINUTE_MS);
    for (const route of [{ name: 'break' }, { name: 'settings' }, { name: 'players' }, { name: 'stickers' }, { name: 'help' }, { name: 'signin' }, { name: 'signup' }, { name: 'terms' }, { name: 'privacy' }] as const) {
      expect(shouldBreak(route, player(), now()), route.name).toBe(false);
    }
    expect(shouldBreak({ name: 'notFound', path: 'x' }, player(), now())).toBe(false);
    expect(shouldBreak({ name: 'game', id: 'escape', level: null }, player(), now())).toBe(true);
  });
});
