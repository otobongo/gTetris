/**
 * The hook's New puzzle (six-games brief 3.1, 10.1): swap() saves and checks Break only while the stuck
 * offer shows, so a double tap swaps once. The hook is rendered once on the server to get its actions
 * (effects do not run there); the actions read the reducer state synchronously, so slips and swaps called
 * afterwards act on it, and their store writes and Break checks are what the test observes.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createProgressStore, runOf, type KeyValueStorage } from '../../shared/progress';
import type { GameMeta } from '../meta';
import { mixerSet } from '../run';
import type { KitGame, LevelRunApi } from './levelRun';
import { useLevelRun } from './useLevelRun';

const NOW = new Date(2026, 10, 6, 12, 0).getTime();
const meta: GameMeta = { levelCount: 9, chapters: [{ title: 'All levels', note: '', start: 0, count: 9 }] };
const MIXER: KitGame<number> = { id: 'mixer', meta, title: 'Color Mixer', set: () => mixerSet(), seed: 'run', puzzle: (_level, n) => n };

function setup() {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  let n = 0;
  const store = createProgressStore({ storage, now: () => NOW, newId: () => `id-${++n}`, events: null });
  store.addPlayer({ name: 'Maya', ageBand: '5-6', color: 'blue' });
  store.startRun('mixer', 0, { set: mixerSet(), seed: 4242 });
  const breaks: string[] = [];
  let api: LevelRunApi<number> | null = null;
  function Probe() {
    api = useLevelRun(MIXER, 0, { store, newSeed: () => 4242, breakBefore: (path) => (breaks.push(path), false), go: () => {} });
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  if (!api) throw new Error('the hook did not render');
  const queue = () => runOf(store.getState().players[0], 'mixer', 0)?.queue;
  return { api: api as LevelRunApi<number>, breaks, queue };
}

describe('useLevelRun swap (New puzzle)', () => {
  it('a double tap on New puzzle swaps once: one Break check and one saved swap', () => {
    const { api, breaks, queue } = setup();
    for (let i = 0; i < 3; i++) api.slip();
    api.swap();
    api.swap();
    expect(breaks).toHaveLength(1);
    expect(queue()).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it('does nothing while the offer is hidden: no Break check and nothing saved', () => {
    const { api, breaks, queue } = setup();
    api.slip();
    api.swap();
    expect(breaks).toEqual([]);
    expect(queue()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('swaps again once a fresh offer shows on the swapped-in puzzle', () => {
    const { api, breaks, queue } = setup();
    for (let i = 0; i < 3; i++) api.slip();
    api.swap();
    for (let i = 0; i < 3; i++) api.slip();
    api.swap();
    expect(breaks).toHaveLength(2);
    expect(queue()).toEqual([2, 3, 4, 5, 0, 1]);
  });
});
