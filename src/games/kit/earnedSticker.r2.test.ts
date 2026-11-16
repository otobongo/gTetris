/**
 * Round 2, decision 19 (kit part): when a kit level finishes a chapter, the level card shows the new
 * sticker. claimLevelSticker awards this game's due stickers at that moment and answers the first one;
 * stickers due from other games stay for Home and the sticker book to award, as today.
 * The progress store is the real one on in-memory storage.
 */
import { describe, expect, it } from 'vitest';
import { createProgressStore, findPlayer, type KeyValueStorage } from '../../shared/progress';
import { STICKERS, stickerCells, stickersDue } from '../../screens/logic/stickers';
import { meta as mixerMeta } from '../mixer/meta';
import { meta as sorterMeta } from '../sorter/meta';
import { claimLevelSticker } from './earnedSticker';

const NOW = new Date(2026, 10, 16, 11, 0).getTime();

function makeStore() {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  let n = 0;
  const store = createProgressStore({ storage, now: () => NOW, newId: () => `id-${++n}`, events: null });
  const id = store.addPlayer({ name: 'Maya', ageBand: '5-6', color: 'blue' }).id;
  store.setActivePlayer(id);
  return { store, id };
}

const stickersOf = (store: ReturnType<typeof makeStore>['store'], id: string) => Object.keys(findPlayer(store.getState(), id)!.stickers);

describe('claimLevelSticker (decision 19)', () => {
  it('Shape Sorter Levels 1 to 3 starred: answers Star with its 25 cells and awards s1', () => {
    const { store, id } = makeStore();
    expect(sorterMeta.chapters[0]).toMatchObject({ start: 0, count: 3 });
    store.recordStars('sorter', 0, 3, id);
    store.recordStars('sorter', 1, 2, id);
    store.recordStars('sorter', 2, 1, id);
    const star = STICKERS.find((s) => s.id === 's1')!;
    const got = claimLevelSticker(store, id, 'sorter');
    expect(got).toEqual({ name: 'Star', cells: stickerCells(star) });
    expect(got!.cells).toHaveLength(25);
    expect(stickersOf(store, id)).toEqual(['s1']);
  });

  it('answers once: a second call finds nothing due', () => {
    const { store, id } = makeStore();
    for (let lv = 0; lv < 3; lv++) store.recordStars('sorter', lv, 2, id);
    expect(claimLevelSticker(store, id, 'sorter')).toBeDefined();
    expect(claimLevelSticker(store, id, 'sorter')).toBeUndefined();
    expect(stickersOf(store, id)).toEqual(['s1']);
  });

  it('leaves another game’s finished chapter for Home and the book', () => {
    const { store, id } = makeStore();
    const ch = mixerMeta.chapters[0];
    for (let lv = ch.start; lv < ch.start + ch.count; lv++) store.recordStars('mixer', lv, 2, id);
    for (let lv = 0; lv < 3; lv++) store.recordStars('sorter', lv, 2, id);
    expect(claimLevelSticker(store, id, 'sorter')).toMatchObject({ name: 'Star' });
    expect(stickersOf(store, id)).toEqual(['s1']);
    expect(stickersDue(findPlayer(store.getState(), id))).toEqual(['m1']);
  });

  it('with no chapter finished it answers undefined and awards nothing', () => {
    const { store, id } = makeStore();
    store.recordStars('sorter', 0, 3, id);
    store.recordStars('sorter', 1, 3, id);
    expect(claimLevelSticker(store, id, 'sorter')).toBeUndefined();
    expect(stickersOf(store, id)).toEqual([]);
  });

  it('a level with no stars yet does not finish the chapter', () => {
    const { store, id } = makeStore();
    store.recordStars('sorter', 0, 3, id);
    store.recordStars('sorter', 1, 3, id);
    store.recordStars('sorter', 2, 0, id);
    expect(claimLevelSticker(store, id, 'sorter')).toBeUndefined();
  });

  it('an unknown player gets nothing and nothing is awarded', () => {
    const { store, id } = makeStore();
    for (let lv = 0; lv < 3; lv++) store.recordStars('sorter', lv, 2, id);
    expect(claimLevelSticker(store, 'nobody', 'sorter')).toBeUndefined();
    expect(stickersOf(store, id)).toEqual([]);
  });
});
