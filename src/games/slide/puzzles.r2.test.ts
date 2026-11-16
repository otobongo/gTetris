/**
 * Round 2, Brick Escape's level card and top bar:
 * - decision 25: the capped-star mark shows when a counted hint caps the level, the same rule as the card's cap line;
 * - decision 19: finishing a level that completes a chapter gives that chapter's Escape sticker, once, and the
 *   card shows it. Only Escape's stickers are given here; any other game's stay for Home and the sticker book.
 */
import { describe, expect, it } from 'vitest';
import { STICKERS, stickerCells, stickersDue } from '../../screens/logic/stickers';
import { getGame } from '../registry';
import { createProgressStore, type PuzzleResult } from '../../shared/progress';
import { hintCapped, levelCard, levelSticker } from './puzzles';
import { meta } from './meta';

const NOON = new Date(2026, 10, 16, 12, 0).getTime();
const r = (usedHint: boolean, puzzle = 0): PuzzleResult => ({ puzzle, count: 5, par: 4, usedHint, outOfTime: false });

function storeWith(chapterLevels: Record<string, number[]>) {
  let n = 0;
  const store = createProgressStore({ storage: null, now: () => NOON, newId: () => `p${++n}`, events: null });
  const p = store.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' });
  for (const [game, levels] of Object.entries(chapterLevels)) for (const lv of levels) store.recordStars(game, lv, 3, p.id);
  return { store, id: p.id };
}

const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);
const chapter = (i: number) => range(meta.chapters[i].start, meta.chapters[i].count);

describe('decision 25: when a hint caps the level', () => {
  it('is false with no hint on the board on screen and none on a solved puzzle', () => {
    expect(hintCapped(false, [])).toBe(false);
    expect(hintCapped(false, [r(false), r(false, 1)])).toBe(false);
  });

  it('is true once a hint is used on the board on screen', () => {
    expect(hintCapped(true, [])).toBe(true);
  });

  it('is true when a solved puzzle of this level used a hint, even with none on the board now', () => {
    expect(hintCapped(false, [r(false), r(true, 1)])).toBe(true);
  });

  it('follows the level card: the card shows its hint cap line exactly when the mark would show', () => {
    for (const results of [[r(false), r(false, 1), r(false, 2), r(false, 3)], [r(false), r(true, 1), r(false, 2), r(false, 3)]]) {
      const card = levelCard(1, results, 1, 0);
      expect(Boolean(card.cap), JSON.stringify(results)).toBe(hintCapped(false, results));
    }
  });
});

describe('decision 19: the sticker a finished level earns', () => {
  it('gives Escape’s chapter 1 sticker when chapter 1 is starred, and returns its name and mosaic for the card', () => {
    const { store, id } = storeWith({ escape: chapter(0) });
    const e1 = STICKERS.find((s) => s.id === 'e1')!;
    expect(levelSticker(store, id)).toEqual({ name: 'Open door', cells: stickerCells(e1) });
    expect(store.getState().players[0].stickers.e1).toBeTruthy();
    expect(stickerCells(e1)).toHaveLength(25);
  });

  it('gives it once: the next level of the chapter earns nothing more', () => {
    const { store, id } = storeWith({ escape: chapter(0) });
    levelSticker(store, id);
    expect(levelSticker(store, id)).toBeUndefined();
  });

  it('gives nothing while a level of the chapter has no stars', () => {
    const { store, id } = storeWith({ escape: chapter(0).slice(0, -1) });
    expect(levelSticker(store, id)).toBeUndefined();
    expect(store.getState().players[0].stickers).toEqual({});
  });

  it('leaves another game’s sticker for Home and the sticker book to give', () => {
    const c = getGame('drop')!.meta!.chapters[0];
    const { store, id } = storeWith({ escape: chapter(0), drop: range(c.start, c.count) });
    // Drop's chapter 1 sticker is due too, but it is not this game's to give
    expect(stickersDue(store.getState().players[0])).toEqual(['e1', 'd1']);
    levelSticker(store, id);
    expect(Object.keys(store.getState().players[0].stickers)).toEqual(['e1']);
  });

  it('gives every Escape sticker that is due and shows the first', () => {
    const { store, id } = storeWith({ escape: [...chapter(0), ...chapter(1)] });
    expect(levelSticker(store, id)?.name).toBe('Open door');
    expect(Object.keys(store.getState().players[0].stickers).sort()).toEqual(['e1', 'e2']);
  });

  it('gives nothing with no player to save to', () => {
    const { store } = storeWith({ escape: chapter(0) });
    expect(levelSticker(store, null)).toBeUndefined();
    expect(levelSticker(store, 'nobody')).toBeUndefined();
    expect(store.getState().players[0].stickers).toEqual({});
  });
});
