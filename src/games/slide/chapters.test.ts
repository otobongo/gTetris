/** Decision D4: Brick Escape chapter 4 is called "Stone blocks", on the Levels screen and on its sticker. */
import { describe, expect, it } from 'vitest';
import { STICKERS, stickerSource } from '../../screens/logic/stickers';
import { meta } from './meta';

describe('Brick Escape chapter names', () => {
  it('names chapter 4 "Stone blocks"', () => {
    expect(meta.chapters[3].title).toBe('Stone blocks');
  });

  it('has no placeholder or bracketed text left in any chapter title or note', () => {
    for (const c of meta.chapters) {
      expect(c.title, c.title).not.toMatch(/PLACEHOLDER|\[|\]/);
      expect(c.note, c.title).not.toMatch(/PLACEHOLDER|\[|\]/);
    }
  });

  it('uses each chapter name once', () => {
    const titles = meta.chapters.map((c) => c.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('shows "Stone blocks" as the source of the chapter 4 sticker', () => {
    const sticker = STICKERS.find((s) => s.game === 'escape' && s.chapter === 3)!;
    expect(stickerSource(sticker)?.chapter).toBe('Stone blocks');
  });
});
