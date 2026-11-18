/**
 * Picture Builder's board draft (decision 13, the board half): the half-built board of the puzzle on screen is kept
 * in the session under `bw:draft:{player}:builder:{level}:{set}:0:{puzzle}:board`, so a Back tap or a reload never
 * loses it. The kit keeps that puzzle's slips under the same prefix. Storage is injected; every access may throw.
 */
import { describe, expect, it } from 'vitest';
import { endStroke, matchCount, newBoard, paintOnce, paintSquare, restoreBoard, startStroke, wrongCount, type Board, type Cell } from './board';
import { boardKey, clearBoard, loadBoard, loadMemory, saveBoard, sessionDrafts, type DraftStorage } from './draft';
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

describe('what the board remembers beyond its cells', () => {
  const target: Cell[] = ['red', 'red', null, 'blue', 'blue', null, 'white', 'white', 'white'];
  const none = { seen: [], given: [] };

  /** One stroke of `paint` over `squares`, as a finger drag lays it. */
  const stroke = (b: Board, paint: 'green' | 'eraser', squares: number[]) => {
    let at = startStroke(b, paint);
    for (const i of squares) at = paintSquare(at, i).board;
    return endStroke(at);
  };
  /** The board as a reload brings it back from the session. */
  const reload = (s: DraftStorage, b: Board, locked = false) => {
    saveBoard(s, KEY, 3, b.cells, b);
    return restoreBoard(target, loadBoard(s, KEY, 3), locked, loadMemory(s, KEY, 3));
  };

  it('keeps the wrong bricks seen and the keys given, and loads them back', () => {
    const s = memory();
    saveBoard(s, KEY, 4, cells4, { seen: ['0:blue', '1:red'], given: ['0:blue'] });
    expect(JSON.parse(s.items.get(KEY)!)).toEqual({ v: 1, size: 4, cells: [...cells4], seen: ['0:blue', '1:red'], given: ['0:blue'] });
    expect(loadMemory(s, KEY, 4)).toEqual({ seen: ['0:blue', '1:red'], given: ['0:blue'] });
    expect(loadBoard(s, KEY, 4)).toEqual([...cells4]);
  });

  it('writes the plain v1 value when there is nothing to remember', () => {
    const s = memory();
    saveBoard(s, KEY, 4, cells4, none);
    expect(JSON.parse(s.items.get(KEY)!)).toEqual({ v: 1, size: 4, cells: [...cells4] });
  });

  it('a draft saved without a memory loads with an empty one, and its wrong bricks still count as seen', () => {
    const s = memory();
    s.items.set(KEY, JSON.stringify({ v: 1, size: 3, cells: ['green', null, null, null, null, null, null, null, null] }));
    expect(loadMemory(s, KEY, 3)).toEqual(none);
    const b = restoreBoard(target, loadBoard(s, KEY, 3), false, loadMemory(s, KEY, 3));
    expect(b.seen).toEqual(['0:green']);
    expect(b.given).toEqual([]);
  });

  it('is empty when there is no draft, no storage, a size that does not match, or a storage that throws', () => {
    const s = memory();
    saveBoard(s, KEY, 4, cells4, { seen: ['0:blue'], given: ['0:blue'] });
    expect(loadMemory(s, KEY, 3)).toEqual(none);
    expect(loadMemory(memory(), KEY, 4)).toEqual(none);
    expect(loadMemory(null, KEY, 4)).toEqual(none);
    expect(loadMemory(broken, KEY, 4)).toEqual(none);
  });

  it('drops anything that is not a wrong-brick key of this board, and repeats', () => {
    const s = memory();
    const seen = ['0:blue', '0:blue', '15:red', '16:red', '-1:red', '1.5:red', '2:purple', '2:eraser', '2', ':red', '2:red:red', 7, null, { k: 1 }];
    s.items.set(KEY, JSON.stringify({ v: 1, size: 4, cells: [...cells4], seen, given: 'nope' }));
    expect(loadMemory(s, KEY, 4)).toEqual({ seen: ['0:blue', '15:red'], given: [] });
    expect(loadBoard(s, KEY, 4)).toEqual([...cells4]);
  });

  it('an empty board that still remembers a wrong brick is kept, so the memory outlives the erase', () => {
    const s = memory();
    const empty = cells4.map(() => null);
    saveBoard(s, KEY, 4, empty, { seen: ['0:blue'], given: ['0:blue'] });
    expect(loadBoard(s, KEY, 4)).toEqual(empty);
    expect(loadMemory(s, KEY, 4)).toEqual({ seen: ['0:blue'], given: ['0:blue'] });
    saveBoard(s, KEY, 4, empty, none);
    expect(s.items.has(KEY)).toBe(false);
  });

  it('a full or blocked storage keeps nothing and never throws', () => {
    expect(() => saveBoard(broken, KEY, 4, cells4, { seen: ['0:blue'], given: [] })).not.toThrow();
    expect(() => saveBoard(null, KEY, 4, cells4, { seen: ['0:blue'], given: [] })).not.toThrow();
  });

  it('a stroke with two new wrong bricks: after a reload, laying the second again passes the first key, no new slip', () => {
    const s = memory();
    const first = stroke(newBoard(target), 'green', [0, 1]);
    expect(first.slip).toBe('0:green');
    let b = reload(s, first.board);
    expect(b.given).toEqual(['0:green']);
    b = paintOnce(b, 'eraser', 1).board;
    const again = paintOnce(b, 'green', 1);
    expect(again.result).toBe('wrong');
    expect(again.slip).toBe('0:green');
  });

  it('both wrong bricks erased before the reload: laying either again is still no new slip', () => {
    const s = memory();
    const first = stroke(newBoard(target), 'green', [0, 1]);
    const erased = stroke(first.board, 'eraser', [0, 1]).board;
    expect(erased.cells.every((c) => c === null)).toBe(true);
    const b = reload(s, erased);
    expect(b.cells.every((c) => c === null)).toBe(true);
    expect(paintOnce(b, 'green', 1).slip).toBe('0:green');
    expect(paintOnce(b, 'green', 0).slip).toBe('0:green');
  });

  it('a brick never laid before the reload is still a new slip', () => {
    const s = memory();
    const first = stroke(newBoard(target), 'green', [0]);
    const b = reload(s, first.board);
    expect(paintOnce(b, 'green', 3).slip).toBe('3:green');
  });

  it('a wrong brick on the board counts as seen even when the memory does not name it', () => {
    const kept: Cell[] = ['green', 'green', null, null, null, null, null, null, null];
    const b = restoreBoard(target, kept, false, { seen: ['0:green'], given: ['0:green'] });
    expect(b.seen).toEqual(['0:green', '1:green']);
  });

  it('a memory level brings its memory back locked', () => {
    const s = memory();
    const first = stroke(newBoard(target), 'green', [0]);
    const b = reload(s, first.board, true);
    expect(b).toMatchObject({ locked: true, seen: ['0:green'], given: ['0:green'] });
  });

  it('cells that do not fit the picture bring no memory back', () => {
    expect(restoreBoard(target, ['red'], false, { seen: ['0:green'], given: ['0:green'] })).toMatchObject({ seen: [], given: [] });
    expect(restoreBoard(target, target.slice(), false, { seen: ['0:green'], given: ['0:green'] })).toMatchObject({ seen: [], given: [] });
  });
});
