import { describe, expect, it } from 'vitest';
import {
  AXIS_PX,
  KEYS,
  MIN_STEP_PX,
  PAD,
  PAUSE_KEYS,
  REPEAT,
  TAP_MS,
  applyAction,
  dragMoves,
  dragStep,
  gestureAxis,
  keyAction,
  keyCommand,
  releaseAction,
  type Action,
  type Axis,
  type KeyLike,
} from './controls';
import { emptyBoard, newGame, withBoard, type GameState, type Rules } from './engine';

const rules: Rules = { cols: 10, rows: 18, pieces: ['tee'], goalRows: 3, gravityMs: 1000, lockDelayMs: 500 };
const game = (): GameState => newGame(rules, 1);
const ALL: Action[] = ['left', 'right', 'down', 'rotate', 'rotateBack', 'drop', 'hold'];

describe('Brick Drop keys', () => {
  it('maps the arrows, Space and the letter keys to the board moves', () => {
    expect(keyAction('ArrowLeft')).toBe('left');
    expect(keyAction('ArrowRight')).toBe('right');
    expect(keyAction('ArrowDown')).toBe('down');
    expect(keyAction('ArrowUp')).toBe('rotate');
    expect(keyAction(' ')).toBe('drop');
    expect(keyAction('Shift')).toBe('hold');
  });

  it('treats upper and lower case letters the same', () => {
    for (const [lower, upper] of [['x', 'X'], ['z', 'Z'], ['c', 'C']]) expect(keyAction(lower)).toBe(keyAction(upper));
    expect(keyAction('x')).toBe('rotate');
    expect(keyAction('z')).toBe('rotateBack');
    expect(keyAction('c')).toBe('hold');
  });

  it('ignores every other key, including names that exist on every object', () => {
    for (const key of ['', 'Enter', 'Tab', 'a', 'ArrowUpLeft', 'Space', 'toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      expect(keyAction(key), JSON.stringify(key)).toBeNull();
      expect(keyCommand({ key }), JSON.stringify(key)).toBeNull();
    }
  });

  it('pauses on P and Escape', () => {
    for (const key of PAUSE_KEYS) expect(keyCommand({ key })).toBe('pause');
    expect(PAUSE_KEYS).toEqual(['p', 'P', 'Escape']);
  });

  it('leaves shortcuts with Ctrl, Cmd or Alt to the browser, so Cmd+P still prints', () => {
    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
      expect(keyCommand({ key: 'ArrowLeft', ...mod })).toBeNull();
      expect(keyCommand({ key: 'p', ...mod })).toBeNull();
      expect(keyCommand({ key: ' ', ...mod })).toBeNull();
    }
    expect(keyCommand({ key: 'ArrowLeft', ctrlKey: false, metaKey: false, altKey: false })).toBe('left');
  });

  it('gives every action a key, and no key a pause and a move at once', () => {
    expect(new Set(Object.values(KEYS))).toEqual(new Set(ALL));
    for (const key of PAUSE_KEYS) expect(keyAction(key), key).toBeNull();
  });
});

describe('Brick Drop control row', () => {
  it('shows Left, Turn, Down and Right in that order, with no Hold or Drop button', () => {
    expect(PAD.map((p) => [p.act, p.label])).toEqual([
      ['left', 'Left'],
      ['rotate', 'Turn'],
      ['down', 'Down'],
      ['right', 'Right'],
    ]);
  });

  it('makes Turn the one green button, and gives each button an icon of its own', () => {
    expect(PAD.filter((p) => p.tone === 'green').map((p) => p.act)).toEqual(['rotate']);
    expect(new Set(PAD.map((p) => p.icon)).size).toBe(PAD.length);
  });

  it('repeats only moving and dropping one row when held, never turns, hard drops or holds', () => {
    expect(Object.keys(REPEAT).sort()).toEqual(['down', 'left', 'right']);
    for (const a of ['rotate', 'rotateBack', 'drop', 'hold'] as const) expect(REPEAT[a], a).toBeUndefined();
  });

  it('waits before repeating, and steps down faster than sideways', () => {
    for (const r of Object.values(REPEAT)) expect(r!.delay).toBeGreaterThan(r!.every);
    expect(REPEAT.down!.every).toBeLessThan(REPEAT.left!.every);
    expect(REPEAT.left).toEqual(REPEAT.right);
  });
});

describe('Brick Drop actions on the game', () => {
  it('moves the brick one column left or right', () => {
    const g = game();
    const x = g.active!.x;
    expect(applyAction(g, 'left').active!.x).toBe(x - 1);
    expect(applyAction(g, 'right').active!.x).toBe(x + 1);
  });

  it('turns one way with Turn and the other way with the back key', () => {
    const g = game();
    expect(applyAction(g, 'rotate').active!.rot).toBe(1);
    expect(applyAction(g, 'rotateBack').active!.rot).toBe(3);
    expect(applyAction(applyAction(g, 'rotate'), 'rotateBack').active!.rot).toBe(0);
  });

  it('moves down one row for a point with Down', () => {
    const g = game();
    const next = applyAction(g, 'down');
    expect(next.active!.y).toBe(g.active!.y + 1);
    expect(next.score).toBe(g.score + 1);
  });

  it('drops the brick to the bottom and brings the next one with Space', () => {
    const g = game();
    const next = applyAction(g, 'drop');
    expect(next.placed).toBe(1);
    expect(next.board[rules.rows - 1].some(Boolean)).toBe(true);
    expect(next.active!.y).toBe(g.active!.y);
  });

  it('puts the brick on hold once per brick', () => {
    const g = game();
    const held = applyAction(g, 'hold');
    expect(held.hold).toBe('tee');
    expect(held.holdUsed).toBe(true);
    expect(applyAction(held, 'hold')).toBe(held);
  });

  it('bumps at the wall and stays inside the board however often Left is pressed', () => {
    let g = game();
    for (let i = 0; i < 20; i++) g = applyAction(g, 'left');
    expect(g.events).toEqual(['bump']);
    const minX = g.active!.x;
    expect(applyAction(g, 'left').active!.x).toBe(minX);
  });

  it('does nothing once the game is over', () => {
    const full = emptyBoard(rules.cols, rules.rows).map((row) => row.map(() => 'black' as const));
    const over = { ...withBoard(game(), full), status: 'over' as const };
    for (const a of ALL) expect(applyAction(over, a), a).toBe(over);
  });
});

describe('Brick Drop board gestures', () => {
  it('waits for the finger to travel before picking a direction', () => {
    expect(gestureAxis(0, 0)).toBe('');
    expect(gestureAxis(AXIS_PX, 0)).toBe('');
    expect(gestureAxis(0, -AXIS_PX)).toBe('');
    expect(gestureAxis(AXIS_PX + 1, 0)).toBe('h');
    expect(gestureAxis(-(AXIS_PX + 1), 3)).toBe('h');
    expect(gestureAxis(2, AXIS_PX + 1)).toBe('v');
    expect(gestureAxis(3, -(AXIS_PX + 1))).toBe('v');
  });

  it('counts an exact diagonal as up or down, not sideways', () => {
    expect(gestureAxis(20, 20)).toBe('v');
  });

  it('moves one column per cell of sideways drag, never less than the minimum step', () => {
    expect(dragStep(30)).toBe(30);
    expect(dragStep(10)).toBe(MIN_STEP_PX);
    expect(dragMoves(65, 0, 30)).toEqual({ moves: 2, sx: 60 });
    expect(dragMoves(-65, 0, 30)).toEqual({ moves: -2, sx: -60 });
    expect(dragMoves(30, 0, 30)).toEqual({ moves: 1, sx: 30 });
    expect(dragMoves(29, 0, 30)).toEqual({ moves: 0, sx: 0 });
  });

  it('carries leftover pixels into the next move, and turning back needs a full step', () => {
    let d = dragMoves(65, 0, 30); // two right, 5 px left over
    d = dragMoves(95, d.sx, 30);
    expect(d).toEqual({ moves: 1, sx: 90 });
    expect(dragMoves(61, d.sx, 30)).toEqual({ moves: 0, sx: 90 });
    expect(dragMoves(60, d.sx, 30)).toEqual({ moves: -1, sx: 60 });
  });

  it('turns the brick on a quick tap, and not on a long press', () => {
    expect(releaseAction('', 0, 0, 100, 30)).toBe('rotate');
    expect(releaseAction('', 4, -3, TAP_MS - 1, 30)).toBe('rotate');
    expect(releaseAction('', 0, 0, TAP_MS, 30)).toBeNull();
  });

  it('drops on a clear swipe down that is long enough for the cell size', () => {
    expect(releaseAction('v', 0, 41, 200, 20)).toBe('drop');
    expect(releaseAction('v', 0, 40, 200, 20)).toBeNull();
    expect(releaseAction('v', 0, 60, 200, 30)).toBeNull(); // big cells need two cells of swipe
    expect(releaseAction('v', 0, 61, 200, 30)).toBe('drop');
  });

  it('does nothing for a swipe up, a slanted swipe, or the end of a sideways drag', () => {
    expect(releaseAction('v', 0, -80, 200, 20)).toBeNull();
    // down has to be more than one and a half times the sideways drift
    expect(releaseAction('v', 50, 60, 200, 20)).toBeNull();
    expect(releaseAction('v', -40, 60, 200, 20)).toBeNull();
    expect(releaseAction('v', 39, 60, 200, 20)).toBe('drop');
    expect(releaseAction('h', 200, 5, 100, 20)).toBeNull();
  });
});

describe('Brick Drop keys and gestures: review additions', () => {
  it('still holds with Shift and turns with Shift+X, since Shift is not a browser shortcut key', () => {
    // A real Shift press arrives with shiftKey set; it must not be treated like Ctrl, Cmd or Alt.
    expect(keyCommand({ key: 'Shift', shiftKey: true } as KeyLike)).toBe('hold');
    expect(keyCommand({ key: 'X', shiftKey: true } as KeyLike)).toBe('rotate');
    expect(keyCommand({ key: 'P', shiftKey: true } as KeyLike)).toBe('pause');
  });

  it('plays a whole sideways drag as moves, then does nothing on release', () => {
    // finger down at x 100, cells 30 px wide; the path wobbles a little up and down
    const path: [number, number][] = [[104, 2], [110, -1], [118, 3], [131, 2], [162, 4], [189, 1], [171, 0]];
    let axis: Axis = '';
    let sx = 100;
    const moves: number[] = [];
    for (const [x, y] of path) {
      if (!axis) axis = gestureAxis(x - 100, y);
      if (axis !== 'h') continue;
      const d = dragMoves(x, sx, dragStep(30));
      sx = d.sx;
      moves.push(d.moves);
    }
    expect(axis).toBe('h');
    expect(moves.reduce((a, b) => a + b, 0)).toBe(2); // 89 px right is two full cells; drifting back 18 px is not a full step left
    expect(releaseAction(axis, 71, 0, 400, 30)).toBeNull();
  });
});
