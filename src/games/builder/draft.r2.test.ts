/**
 * Picture Builder's board draft (decision 13, the board half): the half-built board of the puzzle on screen is kept
 * in the session under `bw:draft:{player}:builder:{level}:{set}:0:{puzzle}:board`, so a Back tap or a reload never
 * loses it. The kit keeps that puzzle's slips under the same prefix. Storage is injected; every access may throw.
 */
import { describe, expect, it } from 'vitest';
import { matchCount, newBoard, paintOnce, restoreBoard, wrongCount, type Cell } from './board';
import { boardKey, clearBoard, loadBoard, saveBoard, sessionDrafts, type DraftStorage } from './draft';
import { GAME } from './game';

/** A Storage stand-in that keeps its items in a Map. */
function memory(): DraftStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (k) => (items.has(k) ? items.get(k)! : null),
    setItem: (k, v) => void items.set(k, v),
    removeItem: (k) => void items.delete(k),
  };
}

/** A storage that throws on every call, as private browsing can. */
const broken: DraftStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
  removeItem: () => {
    throw new Error('blocked');
  },
};

const place = { playerId: 'maya', level: 3, set: 'builder:1', puzzleNo: 2 };
const KEY = 'bw:draft:maya:builder:3:builder:1:0:2:board';
const cells4 = ['red', null, 'blue', null, null, null, null, null, null, null, null, null, null, 'white', null, 'yellow'] as const;

describe('the board key', () => {
  it('names the player, level, set, the fixed seed 0 and the puzzle, ending in :board', () => {
    expect(boardKey(place)).toBe(KEY);
  });

  it('shares its prefix with the kit half (:slips), so both belong to one puzzle', () => {
    expect(boardKey(place).replace(/board$/, 'slips')).toBe(`bw:draft:maya:builder:3:builder:1:0:2:slips`);
  });

  it('differs for another player, level, set or puzzle', () => {
    const keys = [
      boardKey(place),
      boardKey({ ...place, playerId: 'sam' }),
      boardKey({ ...place, level: 4 }),
      boardKey({ ...place, set: 'builder:2' }),
      boardKey({ ...place, puzzleNo: 3 }),
    ];
    expect(new Set(keys).size).toBe(5);
  });
});

describe('the game opts in to keeping a draft', () => {
  it('sets keepDraft on Picture Builder', () => {
    expect((GAME as { keepDraft?: boolean }).keepDraft).toBe(true);
  });
});

describe('saving and loading a board', () => {
  it('saves the size and the cells as v1 JSON, and loads them back', () => {
    const s = memory();
    saveBoard(s, KEY, 4, cells4);
    expect(JSON.parse(s.items.get(KEY)!)).toEqual({ v: 1, size: 4, cells: [...cells4] });
    expect(loadBoard(s, KEY, 4)).toEqual([...cells4]);
  });

  it('loads nothing when there is no draft, or no storage', () => {
    expect(loadBoard(memory(), KEY, 4)).toBeNull();
    expect(loadBoard(null, KEY, 4)).toBeNull();
  });

  it('loads nothing when the size does not match the puzzle on screen', () => {
    const s = memory();
    saveBoard(s, KEY, 4, cells4);
    expect(loadBoard(s, KEY, 3)).toBeNull();
    expect(loadBoard(s, KEY, 5)).toBeNull();
  });

  it('ignores malformed or foreign values', () => {
    const s = memory();
    const bad = [
      'not json',
      'null',
      '[]',
      '42',
      JSON.stringify({ v: 2, size: 4, cells: [...cells4] }),
      JSON.stringify({ size: 4, cells: [...cells4] }),
      JSON.stringify({ v: 1, size: '4', cells: [...cells4] }),
      JSON.stringify({ v: 1, size: 4, cells: cells4.slice(1) }),
      JSON.stringify({ v: 1, size: 4, cells: [...cells4, null] }),
      JSON.stringify({ v: 1, size: 4, cells: cells4.map((c) => (c === 'red' ? 'purple' : c)) }),
      JSON.stringify({ v: 1, size: 4, cells: cells4.map((c) => (c === 'red' ? 'eraser' : c)) }),
      JSON.stringify({ v: 1, size: 4, cells: cells4.map((c) => (c === null ? 0 : c)) }),
      JSON.stringify({ v: 1, size: 4 }),
      JSON.stringify({ v: 1, slips: 2, wrongKeys: ['3:red'] }),
    ];
    for (const raw of bad) {
      s.items.set(KEY, raw);
      expect(loadBoard(s, KEY, 4), raw).toBeNull();
    }
  });

  it('an empty board is not kept: saving one removes the draft', () => {
    const s = memory();
    saveBoard(s, KEY, 4, cells4);
    saveBoard(s, KEY, 4, cells4.map(() => null));
    expect(s.items.has(KEY)).toBe(false);
  });

  it('clear removes only that puzzle board, never the kit half', () => {
    const s = memory();
    const other = boardKey({ ...place, puzzleNo: 4 });
    const slips = KEY.replace(/board$/, 'slips');
    saveBoard(s, KEY, 4, cells4);
    saveBoard(s, other, 4, cells4);
    s.items.set(slips, JSON.stringify({ v: 1, slips: 1, wrongKeys: ['0:red'] }));
    clearBoard(s, KEY);
    expect(loadBoard(s, KEY, 4)).toBeNull();
    expect(loadBoard(s, other, 4)).toEqual([...cells4]);
    expect(s.items.has(slips)).toBe(true);
  });

  it('a storage that throws keeps nothing, and never throws itself', () => {
    expect(() => saveBoard(broken, KEY, 4, cells4)).not.toThrow();
    expect(loadBoard(broken, KEY, 4)).toBeNull();
    expect(() => clearBoard(broken, KEY)).not.toThrow();
    expect(() => saveBoard(null, KEY, 4, cells4)).not.toThrow();
    expect(() => clearBoard(null, KEY)).not.toThrow();
  });
});

describe('the session storage', () => {
  it('is null where there is no window (node), and null when reaching it throws', () => {
    expect(sessionDrafts()).toBeNull();
    const had = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      get: () => ({
        get sessionStorage(): Storage {
          throw new Error('blocked');
        },
      }),
    });
    try {
      expect(sessionDrafts()).toBeNull();
    } finally {
      if (had) Object.defineProperty(globalThis, 'window', had);
      else delete (globalThis as { window?: unknown }).window;
    }
  });
});

describe('a board restored from its draft', () => {
  const target: Cell[] = ['red', 'red', null, 'blue', 'blue', null, 'white', 'white', 'white'];

  it('holds the kept cells, counts on the match bar as before, and starts with no stroke', () => {
    const kept: Cell[] = ['red', 'green', null, 'blue', null, null, null, null, 'white'];
    const b = restoreBoard(target, kept);
    expect(b.cells).toEqual(kept);
    expect(matchCount(b)).toEqual({ right: 3, total: 7 });
    expect(wrongCount(b)).toBe(1);
    expect(b).toMatchObject({ stroke: null, locked: false, solved: false });
  });

  it('remembers its wrong bricks, so laying the same one again after an erase is no new slip key', () => {
    const kept: Cell[] = ['red', 'green', null, null, null, null, null, null, null];
    let b = restoreBoard(target, kept);
    expect(b.seen).toEqual(['1:green']);
    b = paintOnce(b, 'eraser', 1).board;
    const again = paintOnce(b, 'green', 1);
    expect(again.result).toBe('wrong');
    expect(again.slip).toBe('1:green');
    expect(again.board.seen).toEqual(['1:green']);
  });

  it('is locked for a memory level, which starts with its first look', () => {
    const b = restoreBoard(target, ['red', null, null, null, null, null, null, null, null], true);
    expect(b.locked).toBe(true);
    expect(paintOnce(b, 'red', 1).result).toBe('none');
  });

  it('falls back to an empty board when the kept cells do not fit the picture, or already finish it', () => {
    expect(restoreBoard(target, ['red']).cells).toEqual(newBoard(target).cells);
    expect(restoreBoard(target, target.slice()).cells).toEqual(newBoard(target).cells);
    expect(restoreBoard(target, null).cells).toEqual(newBoard(target).cells);
  });
});
