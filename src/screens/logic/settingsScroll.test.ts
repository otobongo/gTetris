/**
 * Usability batch D (app-grownups-5): Settings remembers how far down it was when a grown-up opens a
 * game's level picker from a Progress row, and scrolls back there once on its way back.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { parseRoute, splitPath } from '../../shared/router';
import { followRoute, setScroll, takeScroll } from './settingsScroll';

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

  describe('the trip to the level picker (review of batch D)', () => {
    const follow = (hash: string) => followRoute(parseRoute(splitPath(hash)));

    it('keeps the place while the grown-up is on the picker, and when they come back to Settings', () => {
      setScroll(1235);
      follow('#/settings/levels/escape/maya');
      follow('#/settings');
      expect(takeScroll()).toBe(1235);
    });

    it('keeps it across a picker for another game or child, with an encoded child id', () => {
      setScroll(640);
      follow('#/settings/levels/escape/maya');
      follow('#/settings/levels/drop/leo%20b');
      expect(takeScroll()).toBe(640);
    });

    it('drops it when the picker opens the game (Play Level N for the child who is playing)', () => {
      setScroll(1497);
      follow('#/settings/levels/escape/maya');
      follow('#/game/escape/5');
      expect(takeScroll()).toBeNull();
    });

    it('drops it on any other screen, so the next visit to Settings starts at the top', () => {
      for (const hash of ['#/', '#/home', '#/players', '#/break', '#/stickers', '#/help', '#/help/terms', '#/signin', '#/signup', '#/game/escape', '#/nowhere', '#/settings/levels/escape']) {
        setScroll(900);
        follow(hash);
        expect(takeScroll(), hash).toBeNull();
      }
    });

    it('stays empty when nothing was stored', () => {
      follow('#/settings');
      expect(takeScroll()).toBeNull();
    });
  });
});
