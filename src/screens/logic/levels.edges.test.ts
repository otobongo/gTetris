import { describe, expect, it } from 'vitest';
import { isLevelOpen, type GameMeta } from '../../games/meta';
import { GAMES, getGame } from '../../games/registry';
import { parseRoute, splitPath } from '../../shared/router';
import { AGE_BANDS, emptyGame, type GameProgress } from '../../shared/progress';
import { unlockedFromStars } from '../../shared/progress/model';
import { homePill, lockMessage, planLevels, tileLabel, type LevelPlan, type TileState } from './levels';

const PLAYABLE = GAMES.filter((g) => g.playable);
const progress = (stars: Record<number, number>, unlocked = 0): GameProgress => ({ ...emptyGame(), stars, unlocked });
/** Progress as the store keeps it: a level with stars always has the level after it unlocked. */
const stored = (stars: Record<number, number>, unlocked = 0): GameProgress => progress(stars, Math.max(unlocked, unlockedFromStars(stars)));
const tiles = (p: LevelPlan) => p.chapters.flatMap((c) => c.tiles);
const states = (p: LevelPlan) => tiles(p).map((t) => t.state);
const allStars = (n: number, s = 1) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i, s]));

const META: GameMeta = {
  levelCount: 9,
  chapters: [
    { title: 'A', note: '', start: 0, count: 3 },
    { title: 'B', note: '', start: 3, count: 3 },
    { title: 'C', note: '', start: 6, count: 3 },
  ],
};

describe('game registry: every card', () => {
  it('has a unique id and title, and copy without en or em dashes', () => {
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
    expect(new Set(GAMES.map((g) => g.title)).size).toBe(GAMES.length);
    for (const g of GAMES) {
      expect(`${g.title} ${g.sub}`, g.id).not.toMatch(/[–—]/);
      for (const c of g.meta?.chapters ?? []) expect(`${c.title} ${c.note}`, `${g.id}: ${c.title}`).not.toMatch(/[–—]/);
    }
  });

  it('is playable exactly when it has levels, and the rest still open their Coming soon screen', () => {
    for (const g of GAMES) {
      expect(g.playable, g.id).toBe(g.meta !== null);
      if (g.meta) expect(g.meta.levelCount, g.id).toBeGreaterThan(0);
      expect(parseRoute(splitPath(g.playRoute)), g.id).toEqual({ name: 'game', id: g.id, level: null });
    }
  });

  it('finds games by their exact id only', () => {
    expect(getGame('')).toBeUndefined();
    expect(getGame('Escape')).toBeUndefined();
    expect(getGame(' escape')).toBeUndefined();
    expect(getGame('toString')).toBeUndefined();
    for (const g of GAMES) expect(getGame(g.id)).toBe(g);
  });

  it('has art on every card, in brick colours and inside the box', () => {
    for (const g of GAMES) {
      expect(g.art.length, g.id).toBeGreaterThan(0);
      for (const a of g.art) {
        expect(a.x >= 0 && a.y >= 0 && a.w > 0 && a.h > 0, `${g.id} ${a.kind}`).toBe(true);
        if (a.kind !== 'glyph') expect(a.color, `${g.id} ${a.kind}`).toBeTruthy();
      }
    }
  });

  it('calls Brick Drop levels Stage and every other game Level', () => {
    for (const g of GAMES) expect(g.noun, g.id).toBe(g.id === 'drop' ? 'Stage' : 'Level');
  });

  it('ships 31 Brick Escape levels, 24 Letter Builder levels and the Brick Drop stages, with no empty chapter in the middle', () => {
    expect(getGame('escape')!.meta!.levelCount).toBe(31);
    expect(getGame('letters')!.meta!.levelCount).toBe(24);
    for (const g of PLAYABLE) {
      const chapters = g.meta!.chapters;
      chapters.forEach((c, i) => {
        if (i < chapters.length - 1) expect(c.count, `${g.id}: ${c.title}`).toBeGreaterThan(0);
        if (c.more) expect(i, `${g.id}: only the last chapter is open-ended`).toBe(chapters.length - 1);
      });
    }
  });
});

describe('level select on the real games', () => {
  for (const g of PLAYABLE) {
    const meta = g.meta!;
    const n = meta.levelCount;

    it(`${g.title}: a new player sees one current tile, level 1, and the rest locked (ages 3 to 8)`, () => {
      for (const band of ['3-4', '5-6', '7-8'] as const) {
        const plan = planLevels(meta, emptyGame(), band);
        expect(states(plan), band).toEqual(['current', ...Array(n - 1).fill('locked')]);
        expect(plan).toMatchObject({ current: 0, complete: false, stars: 0, maxStars: n * 3, levelCount: n });
      }
    });

    it(`${g.title}: ages 9 to 10 also start every chapter's first level open`, () => {
      const plan = planLevels(meta, emptyGame(), '9-10');
      const starts = new Set(meta.chapters.filter((c) => c.count > 0).map((c) => c.start));
      tiles(plan).forEach((t) => {
        const want: TileState = t.index === 0 ? 'current' : starts.has(t.index) ? 'open' : 'locked';
        expect(t.state, `level ${t.n}`).toBe(want);
      });
    });

    it(`${g.title}: tiles cover every level once, numbered from 1, in order`, () => {
      const plan = planLevels(meta, emptyGame(), '7-8');
      expect(tiles(plan).map((t) => t.index)).toEqual(Array.from({ length: n }, (_, i) => i));
      expect(tiles(plan).every((t) => t.n === t.index + 1)).toBe(true);
    });

    it(`${g.title}: finishing every level shows All done and leaves no current tile`, () => {
      for (const band of AGE_BANDS) {
        const plan = planLevels(meta, progress(allStars(n, 3)), band);
        expect(plan.complete, band).toBe(true);
        expect(plan.current).toBeNull();
        expect(plan.stars).toBe(n * 3);
        expect(new Set(states(plan))).toEqual(new Set(['done']));
        expect(homePill(meta, progress(allStars(n)), band, g.noun)).toBe('All done');
      }
    });

    it(`${g.title}: the last level is current once all the others have a star`, () => {
      const plan = planLevels(meta, progress(allStars(n - 1)), '5-6');
      expect(plan.current).toBe(n - 1);
      expect(plan.complete).toBe(false);
      expect(homePill(meta, progress(allStars(n - 1)), '5-6', g.noun)).toBe(`${g.noun} ${n}`);
    });

    it(`${g.title}: every tile the Levels screen shows open is one the game opens too`, () => {
      const samples = [emptyGame(), stored({ 0: 1, 1: 2 }), stored({ 0: 3 }, 5), stored({ 4: 1 }), stored(allStars(n - 2))];
      for (const band of AGE_BANDS) {
        for (const game of samples) {
          for (const t of tiles(planLevels(meta, game, band))) {
            expect(t.state !== 'locked', `${band} level ${t.n}`).toBe(isLevelOpen(meta, game, band, t.index));
          }
        }
      }
    });
  }
});

describe('level select: the four tile states together', () => {
  it('shows done, current, open and locked side by side for a 9 to 10 year old', () => {
    // level 1 done, level 2 next, level 4 and 7 open as chapter starts, the rest locked
    const plan = planLevels(META, progress({ 0: 2 }), '9-10');
    expect(states(plan)).toEqual(['done', 'current', 'locked', 'open', 'locked', 'locked', 'open', 'locked', 'locked']);
  });

  it('shows a star further on as done and opens every level up to the one after it', () => {
    // stars can arrive out of order: a sync, or a 9 to 10 player who started a later chapter.
    // The store then keeps levels unlocked up to the one after the starred level.
    const plan = planLevels(META, stored({ 4: 1 }), '7-8');
    expect(states(plan)).toEqual(['current', 'open', 'open', 'open', 'done', 'open', 'locked', 'locked', 'locked']);
    expect(plan.current).toBe(0);
  });

  it('shows a tile with stars as done whatever the unlock says', () => {
    expect(states(planLevels(META, progress({ 4: 1 }), '7-8'))[4]).toBe('done');
  });

  it('makes the first open level without stars current, not the one after the last finished level', () => {
    // a 9 to 10 player finished chapter B's start, then went back to chapter A
    const plan = planLevels(META, stored({ 0: 1, 3: 1, 4: 1 }), '9-10');
    expect(plan.current).toBe(1);
    expect(states(plan).slice(0, 7)).toEqual(['done', 'current', 'open', 'done', 'done', 'open', 'open']);
  });

  it('counts only whole stars from 1 to 3 per tile', () => {
    const plan = planLevels(META, progress({ 0: 3, 1: 2, 2: 1 }), '7-8');
    expect(tiles(plan).slice(0, 4).map((t) => t.stars)).toEqual([3, 2, 1, 0]);
    expect(plan.stars).toBe(6);
  });

  it('is never complete for a game with no levels', () => {
    const plan = planLevels({ levelCount: 0, chapters: [{ title: 'Soon', note: '', start: 0, count: 0, more: true }] }, emptyGame(), '7-8');
    expect(plan).toMatchObject({ complete: false, current: null, stars: 0, maxStars: 0 });
    expect(plan.chapters[0].tiles).toEqual([]);
  });
});

describe('level select: what a locked tile says', () => {
  it('names the level right before it when that one is open', () => {
    const plan = planLevels(META, emptyGame(), '7-8');
    expect(lockMessage(plan, 1, 'Level')).toBe('Finish Level 1 to open Level 2.');
  });

  it('points at the nearest open level when several in a row are locked', () => {
    const plan = planLevels(META, progress({ 0: 1, 1: 1 }), '5-6');
    expect(lockMessage(plan, 6, 'Stage')).toBe('Finish Stage 3 first. Stages open one at a time.');
  });

  it('points at a 9 to 10 year old’s open chapter start, not level 1', () => {
    const plan = planLevels(META, emptyGame(), '9-10');
    expect(lockMessage(plan, 5, 'Level')).toBe('Finish Level 4 first. Levels open one at a time.');
    expect(lockMessage(plan, 4, 'Level')).toBe('Finish Level 4 to open Level 5.');
  });

  it('labels a one-star tile in the singular and the others in the plural', () => {
    expect(tileLabel({ index: 0, n: 1, state: 'done', stars: 1 }, 'Stage')).toBe('Stage 1, 1 star');
    expect(tileLabel({ index: 0, n: 1, state: 'done', stars: 3 }, 'Stage')).toBe('Stage 1, 3 stars');
  });
});

describe('Home pill', () => {
  it('shows the first level for a new player of any age, in the game’s own word', () => {
    for (const g of PLAYABLE) for (const band of AGE_BANDS) expect(homePill(g.meta, emptyGame(), band, g.noun)).toBe(`${g.noun} 1`);
  });

  it('shows Coming soon for every game that is not built yet', () => {
    for (const g of GAMES.filter((x) => !x.playable)) expect(homePill(g.meta, emptyGame(), '7-8', g.noun), g.id).toBe('Coming soon');
  });
});
