/**
 * Usability batch D (app-grownups-5): Settings remembers how far down it was when a grown-up opens a
 * game's level picker from a Progress row, and scrolls back there once on its way back.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { setScroll, takeScroll } from './settingsScroll';

describe('Settings scroll return', () => {
  beforeEach(() => {
    // Empty it between tests: a one-shot value read here is gone.
    takeScroll();
  });

  it('gives nothing before a position is stored', () => {
    expect(takeScroll()).toBeNull();
  });

  it('gives back the stored position once, then nothing', () => {
    setScroll(900);
    expect(takeScroll()).toBe(900);
    expect(takeScroll()).toBeNull();
  });

  it('keeps only the latest position', () => {
    setScroll(300);
    setScroll(1235);
    expect(takeScroll()).toBe(1235);
    expect(takeScroll()).toBeNull();
  });

  it('keeps the top of the page (0) as a real position', () => {
    setScroll(0);
    expect(takeScroll()).toBe(0);
  });

  it('ignores a position that is not a finite number of pixels, or is below 0', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -20]) {
      setScroll(bad);
      expect(takeScroll(), String(bad)).toBeNull();
    }
  });
});
