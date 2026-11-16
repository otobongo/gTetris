/**
 * Round 2 rules for Letter Builder (usability decisions 2026-11-16):
 * - decision 25: the capped-star mark shows when a counted hint caps the level, never on the practice level;
 * - decision 19: the sticker a finished Letter Builder chapter earns, for the level card.
 */
import { describe, expect, it } from 'vitest';
import { emptyGame, type GameProgress, type Player } from '../../shared/progress';
import { STICKERS, stickerCells } from '../../screens/logic/stickers';
import { CHAPTERS } from './levels';
import { lettersCapped } from './logic';
import { levelSticker } from './LettersApp';

describe('lettersCapped (decision 25: the capped-star mark beside the dots)', () => {
  const clean = { usedHint: false };
  const hinted = { usedHint: true };

  it('shows nothing before any hint', () => {
    expect(lettersCapped(false, false, [])).toBe(false);
    expect(lettersCapped(false, false, [clean, clean])).toBe(false);
  });

  it('shows once a hint is used on the puzzle on screen', () => {
    expect(lettersCapped(false, true, [])).toBe(true);
  });

  it('stays while a solved puzzle of the level used a hint', () => {
    expect(lettersCapped(false, false, [clean, hinted])).toBe(true);
  });

  it('never shows on the practice level, whatever was hinted', () => {
    expect(lettersCapped(true, true, [])).toBe(false);
    expect(lettersCapped(true, false, [hinted])).toBe(false);
  });

  it('reads a solved puzzle with no usedHint field as no hint', () => {
    expect(lettersCapped(false, false, [{}])).toBe(false);
  });
});

describe('levelSticker (decision 19: the new sticker on the level card)', () => {
  const NOW = new Date(2026, 10, 16, 12, 0).getTime();
  const player = (over: Partial<Player> = {}): Player => ({
    id: 'p1',
    name: 'Maya',
    ageBand: '5-6',
    color: 'blue',
    dailyLimit: 20,
    timerMode: 'auto',
    unnamed: false,
    createdAt: NOW,
    updatedAt: NOW,
    games: {},
    stickers: {},
    today: { day: '2026-11-16', minutes: 0, extraMinutes: 0 },
    ...over,
  });
  const game = (stars: Record<number, number>): GameProgress => ({ ...emptyGame(), stars, unlocked: Object.keys(stars).length });
  const upTo = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [i, 2]));
  const chapter1 = CHAPTERS[0].start + CHAPTERS[0].count;

  it('gives nothing with no player', () => {
    expect(levelSticker(null)).toEqual({ ids: [] });
  });

  it('gives nothing before a chapter is finished', () => {
    expect(levelSticker(player({ games: { letters: game(upTo(chapter1 - 1)) } }))).toEqual({ ids: [] });
  });

  it('gives Big A, with its mosaic, once every level of the first chapter has a star', () => {
    const out = levelSticker(player({ games: { letters: game(upTo(chapter1)) } }));
    const bigA = STICKERS.find((s) => s.id === 'l1')!;
    expect(out.ids).toEqual(['l1']);
    expect(out.sticker).toEqual({ name: 'Big A', cells: stickerCells(bigA) });
    expect(out.sticker!.cells).toHaveLength(25);
  });

  it('does not give a sticker the player already has', () => {
    const p = player({ games: { letters: game(upTo(chapter1)) }, stickers: { l1: { earnedAt: 1, seen: true } } });
    expect(levelSticker(p)).toEqual({ ids: [] });
  });

  it("leaves another game's due sticker for Home and the sticker book", () => {
    const escape = { ...emptyGame(), stars: Object.fromEntries(Array.from({ length: 30 }, (_, i) => [i, 3])), unlocked: 30 };
    const out = levelSticker(player({ games: { escape, letters: game(upTo(chapter1)) } }));
    expect(out.ids).toEqual(['l1']);
    expect(levelSticker(player({ games: { escape } }))).toEqual({ ids: [] });
  });
});
