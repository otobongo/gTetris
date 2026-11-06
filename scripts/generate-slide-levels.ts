/**
 * Brick Escape puzzle generator. Writes src/games/slide/puzzles.data.ts: 31 levels, 6 puzzles each.
 * Plan: design/briefs/four-puzzle-levels.md, section 4.1.
 *
 * Puzzle 1 of every level is today's board (the anchor), read from puzzles.data.ts once it exists and from
 * levels.data.ts before that; anchors are never regenerated. Puzzles 2 to 6 copy the anchor's difficulty:
 * - same board size, tray shape (rotated or mirrored), number of colors, icy doors, color locks, stones,
 *   brick sizes, advanced-door flag, clock base, name and tip; brick count within 1; Best within 1 of the anchor's;
 * - variety: no two boards of a level equal under the 8 rotations and mirrors with colors renamed, no two with the
 *   same door layout (sides and positions), each with its own color set;
 * - the canvas rules (design/escape-levels/README.md): every open square packed, one door per color exactly as
 *   long as its bricks, at a corner unless the level is advanced (Levels 9 and 26 to 31), never next to another
 *   door; icy doors, color locks, stones and shaped trays only, no frozen or one-way bricks.
 * Every board passes validate, designProblems and the solver, and its par is the solver's best.
 *
 * Each level runs in its own child process, collects a pool of up to 12 candidates and saves it to
 * scripts/.slide-cache/level-<n>.json after every accepted board, so runs resume. Boards from the old tier caches
 * (scripts/.slide-cache/tier-*.json) that match a level are imported into its pool first.
 *   npm run levels:generate                        fill every level whose pool is short of 12, then combine
 *   npm run levels:generate -- --level 27          one level only
 *   npm run levels:generate -- --minutes 10        budget per level (default 30; Levels 9 and 31 get twice that)
 *   npm run levels:generate -- --level 27 --fallback 1   rerun with the par window widened to Best plus or minus 2
 *   npm run levels:generate -- --level 27 --fallback 2   also relax variety (color sets may repeat; a door layout
 *                                                        may repeat when the brick layouts differ)
 *   npm run levels:generate -- --combine           write puzzles.data.ts from the cache only
 *   npm run levels:generate -- --combine --allow-short   write it even when some levels have fewer than 6 boards
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { type Color, type GateDef, type LevelSpec, type Side, blockSize, designProblems, fromSpec, initialState, validate } from '../src/games/slide/engine';
import { solve } from '../src/games/slide/solver';
import { rng } from '../src/shared/rng';

const PALETTE: Color[] = ['red', 'yellow', 'green', 'blue', 'purple', 'orange', 'pink', 'teal', 'white', 'black'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PUZZLES = 6;
const POOL = 12;
const LEVEL_COUNT = 31;
/** Levels with the longest searches get twice the budget (brief 4.1). */
const LONG = new Set([9, 31]);

/* ---------- canvas levels (the six teaching boards are anchors of Levels 1, 5, 9, 14, 20 and 31) ---------- */

interface CanvasBrick {
  color: Color;
  w: number;
  h: number;
  at: [number, number];
}
interface CanvasGate {
  color: Color;
  side: Side;
  at: number;
  len: number;
  lockCount?: number;
  lockColor?: Color;
}
interface CanvasLevel {
  title: string;
  sub: string;
  base: number;
  tip?: string;
  N: number;
  map?: string[];
  bricks: Record<string, CanvasBrick>;
  gates: CanvasGate[];
  best: number;
}

const CANVAS_DIR = fileURLToPath(new URL('../design/escape-levels/', import.meta.url));
const CANVAS_FILES: Record<string, string> = { '1': 'out-1.json', '5': 'out-5.json', '9': 'out-9.json', ice: 'out-ice.json', walls: 'out-walls.json', master: 'out-master.json' };
/** Level number of each canvas board. */
export const CANVAS_LEVELS: Record<number, string> = { 1: '1', 5: '5', 9: '9', 14: 'ice', 20: 'walls', 31: 'master' };
/** Canvas levels without `corners: true` in run.cjs (Level 9 and the master mix) may use mid-edge doors. */
const CANVAS_ADVANCED = new Set(['9', 'master']);

/** Canvas JSON to a LevelSpec. Canvas maps use 'X' for stones; LevelSpec uses '*' so letters stay bricks. */
export function fromCanvas(key: string, lv: CanvasLevel): LevelSpec {
  const grid = Array.from({ length: lv.N }, (_, r) =>
    Array.from({ length: lv.N }, (_, c) => {
      const ch = lv.map ? lv.map[r][c] : '.';
      return ch === 'X' ? '*' : ch;
    }),
  );
  const colors: Record<string, Color> = {};
  for (const [k, b] of Object.entries(lv.bricks)) {
    colors[k] = b.color;
    for (let i = 0; i < b.h; i++) for (let j = 0; j < b.w; j++) grid[b.at[0] + i][b.at[1] + j] = k;
  }
  const gates: GateDef[] = lv.gates.map((g) => ({
    side: g.side,
    at: g.at,
    len: g.len,
    color: g.color,
    ...(g.lockCount ? { lock: g.lockCount } : {}),
    ...(g.lockColor ? { lockColor: g.lockColor } : {}),
  }));
  return {
    name: lv.sub,
    ...(lv.tip ? { tip: lv.tip } : {}),
    map: grid.map((r) => r.join('')),
    colors,
    gates,
    base: lv.base,
    ...(CANVAS_ADVANCED.has(key) ? { advanced: true } : {}),
  };
}

export function loadCanvas(key: string): { spec: LevelSpec; best: number } {
  const raw = JSON.parse(readFileSync(CANVAS_DIR + CANVAS_FILES[key], 'utf8')) as Record<string, CanvasLevel>;
  const lv = raw[key];
  return { spec: fromCanvas(key, lv), best: lv.best };
}

/* ---------- small helpers ---------- */

type Rand = () => number;
const shuffled = <T>(rand: Rand, a: T[]) => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};
const isBrick = (ch: string) => /[A-Za-z]/.test(ch);

/* ---------- the 8 rotations and mirrors ---------- */

/** Symmetry s (0..7) of point (r, c) on an M x M grid: transpose when s & 4, then s & 3 quarter turns clockwise. */
function symPoint(s: number, M: number, r: number, c: number): [number, number] {
  let a = r;
  let b = c;
  if (s & 4) [a, b] = [b, a];
  for (let k = 0; k < (s & 3); k++) [a, b] = [b, M - 1 - a];
  return [a, b];
}

export function transformMap(map: string[], s: number): string[] {
  const N = map.length;
  const out = Array.from({ length: N }, () => Array<string>(N).fill('#'));
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const [a, b] = symPoint(s, N, r, c);
      out[a][b] = map[r][c];
    }
  return out.map((l) => l.join(''));
}

/** The squares just outside the board that a door covers, as [row, col] (row -1 is above the board). */
function doorOutside(g: GateDef, N: number): [number, number][] {
  return Array.from({ length: g.len }, (_, i) =>
    g.side === 'top' ? [-1, g.at + i] : g.side === 'bottom' ? [N, g.at + i] : g.side === 'left' ? [g.at + i, -1] : [g.at + i, N],
  );
}

function transformGate(g: GateDef, s: number, N: number): GateDef {
  const cells = doorOutside(g, N).map(([r, c]) => {
    const [a, b] = symPoint(s, N + 2, r + 1, c + 1);
    return [a - 1, b - 1] as [number, number];
  });
  const [r0, c0] = cells[0];
  const side: Side = r0 === -1 ? 'top' : r0 === N ? 'bottom' : c0 === -1 ? 'left' : 'right';
  const at = side === 'top' || side === 'bottom' ? Math.min(...cells.map((x) => x[1])) : Math.min(...cells.map((x) => x[0]));
  return { ...g, side, at };
}

export function transformSpec(spec: LevelSpec, s: number): LevelSpec {
  return { ...spec, map: transformMap(spec.map, s), gates: spec.gates.map((g) => transformGate(g, s, spec.map.length)) };
}

/** Bricks renamed A, B, C in reading order; colors renamed 0, 1, 2 in the order their bricks first appear. */
function relabel(spec: LevelSpec): { map: string; gates: string; brickMap: string } {
  const letter = new Map<string, string>();
  const color = new Map<Color, number>();
  const map = spec.map
    .map((l) =>
      [...l]
        .map((ch) => {
          if (!isBrick(ch)) return ch;
          if (!letter.has(ch)) letter.set(ch, LETTERS[letter.size]);
          const col = spec.colors[ch];
          if (!color.has(col)) color.set(col, color.size);
          return letter.get(ch)!;
        })
        .join(''),
    )
    .join('/');
  const withColors = spec.map
    .map((l) => [...l].map((ch) => (isBrick(ch) ? String(color.get(spec.colors[ch])) : ch)).join(''))
    .join('/');
  const ci = (c: Color | undefined) => (c === undefined ? '' : String(color.get(c) ?? `?${c}`));
  const gates = spec.gates
    .map((g) => `${g.side}${g.at}x${g.len}:${ci(g.color)}:${g.lock ?? ''}:${ci(g.lockColor)}`)
    .sort()
    .join(' ');
  return { map: `${map}=${withColors}`, gates, brickMap: map };
}

/** Same key for two boards that are equal under a rotation or mirror with colors renamed. */
export function canonical(spec: LevelSpec): string {
  let best = '';
  for (let s = 0; s < 8; s++) {
    const r = relabel(transformSpec(spec, s));
    const k = `${r.map}|${r.gates}`;
    if (!best || k < best) best = k;
  }
  return best;
}

const trayOf = (map: string[]) => map.map((l) => [...l].map((ch) => (isBrick(ch) ? '.' : ch)).join(''));
function canonicalTray(map: string[]): string {
  let best = '';
  for (let s = 0; s < 8; s++) {
    const k = transformMap(trayOf(map), s).join('/');
    if (!best || k < best) best = k;
  }
  return best;
}

/* ---------- what a board looks like, for the signature and the variety rules ---------- */

interface Board {
  spec: LevelSpec;
  canon: string;
  /** door sides and positions as drawn */
  doorKey: string;
  colorKey: string;
  /** which squares belong to which brick, as drawn, without colors */
  brickKey: string;
  /** the 8 symmetric versions: door squares and brick grid, for the distance */
  versions: { doors: Set<string>; grid: string[] }[];
}

function board(spec: LevelSpec): Board {
  const N = spec.map.length;
  return {
    spec,
    canon: canonical(spec),
    doorKey: spec.gates
      .map((g) => `${g.side}${g.at}x${g.len}`)
      .sort()
      .join(' '),
    colorKey: [...new Set(Object.values(spec.colors))].sort().join(','),
    brickKey: relabel(spec).brickMap,
    versions: Array.from({ length: 8 }, (_, s) => {
      const t = transformSpec(spec, s);
      return { doors: new Set(t.gates.flatMap((g) => doorOutside(g, N).map(([r, c]) => `${r},${c}`))), grid: t.map };
    }),
  };
}

/**
 * How different two boards look: first how many door squares differ, then how many neighbouring squares differ
 * in whether they belong to one brick. The smallest over the 8 rotations and mirrors of b.
 */
export function distance(a: Board, b: Board): number {
  const A = a.versions[0];
  const N = A.grid.length;
  let best = Infinity;
  for (const B of b.versions) {
    let doors = 0;
    for (const d of A.doors) if (!B.doors.has(d)) doors++;
    for (const d of B.doors) if (!A.doors.has(d)) doors++;
    let bricks = 0;
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        for (const [r2, c2] of [
          [r, c + 1],
          [r + 1, c],
        ]) {
          if (r2 >= N || c2 >= N) continue;
          const same = (g: string[]) => isBrick(g[r][c]) && g[r][c] === g[r2][c2];
          if (same(A.grid) !== same(B.grid)) bricks++;
        }
    best = Math.min(best, doors * 1000 + bricks);
  }
  return best;
}

/** Variety rules between two boards of one level. Relaxed is fallback 2. */
export function compatible(a: Board, b: Board, relaxed: boolean): boolean {
  if (a.canon === b.canon) return false;
  if (relaxed) return a.doorKey !== b.doorKey || a.brickKey !== b.brickKey;
  return a.doorKey !== b.doorKey && a.colorKey !== b.colorKey;
}

interface Signature {
  N: number;
  tray: string;
  colors: number;
  ice: number;
  chain: number;
  /** brick sizes as unordered w x h, sorted */
  sizes: string;
  bricks: number;
}

function signature(spec: LevelSpec): Signature {
  const lvl = fromSpec(spec, 0);
  const sizes = new Set(
    lvl.blocks.map((b) => {
      const { w, h } = blockSize(b);
      return `${Math.min(w, h)}x${Math.max(w, h)}`;
    }),
  );
  return {
    N: spec.map.length,
    tray: canonicalTray(spec.map),
    colors: new Set(Object.values(spec.colors)).size,
    ice: spec.gates.filter((g) => g.lock).length,
    chain: spec.gates.filter((g) => g.lockColor).length,
    sizes: [...sizes].sort().join(','),
    bricks: lvl.blocks.length,
  };
}

/** Problems that keep a board out of its level's difficulty (empty = it matches the anchor). */
export function signatureProblems(anchor: LevelSpec, spec: LevelSpec): string[] {
  const a = signature(anchor);
  const b = signature(spec);
  const errs: string[] = [];
  for (const k of ['N', 'tray', 'colors', 'ice', 'chain', 'sizes'] as const) if (a[k] !== b[k]) errs.push(`${k} ${b[k]} instead of ${a[k]}`);
  if (Math.abs(a.bricks - b.bricks) > 1) errs.push(`${b.bricks} bricks, anchor has ${a.bricks}`);
  for (const k of ['name', 'tip', 'base', 'advanced'] as const) if (anchor[k] !== spec[k]) errs.push(`${k} differs from the anchor`);
  return errs;
}

/* ---------- design rules checked on every board ---------- */

/** Doors keep a free square between them on one side and never meet at a corner (the canvas rule). */
export function doorsTouch(spec: LevelSpec): string[] {
  const N = spec.map.length;
  const errs: string[] = [];
  const cover = (side: Side) => {
    const s = new Set<number>();
    for (const g of spec.gates) if (g.side === side) for (let i = 0; i < g.len; i++) s.add(g.at + i);
    return s;
  };
  for (const side of ['top', 'bottom', 'left', 'right'] as Side[]) {
    const mine = spec.gates.filter((g) => g.side === side).sort((x, y) => x.at - y.at);
    for (let i = 1; i < mine.length; i++) if (mine[i].at <= mine[i - 1].at + mine[i - 1].len) errs.push(`doors on the ${side} side touch`);
  }
  // corners: [side A, end of A near the corner, side B, end of B near the corner]
  const corners: [Side, number, Side, number][] = [
    ['top', 0, 'left', 0],
    ['top', N - 1, 'right', 0],
    ['bottom', 0, 'left', N - 1],
    ['bottom', N - 1, 'right', N - 1],
  ];
  for (const [sa, ea, sb, eb] of corners) {
    const near = (side: Side, end: number) => {
      const s = cover(side);
      return s.has(end) || s.has(end === 0 ? 1 : end - 1);
    };
    if (near(sa, ea) && near(sb, eb)) errs.push(`doors meet at the ${sa} ${sb} corner`);
  }
  return errs;
}

/**
 * Everything a shipped board must pass, apart from par (empty = fine). The Level 1 canvas board puts its two
 * doors side by side on purpose, so anchors skip the door spacing check.
 */
export function boardProblems(spec: LevelSpec, spacing = true): string[] {
  const lvl = fromSpec(spec, 0);
  const errs = [...validate(lvl), ...designProblems(lvl), ...(spacing ? doorsTouch(spec) : [])];
  if (spec.map.some((l) => l.includes('.'))) errs.push('an open square is not packed');
  if (spec.frozen && Object.keys(spec.frozen).length) errs.push('frozen bricks');
  const known = new Set(['name', 'tip', 'map', 'colors', 'gates', 'base', 'advanced']);
  for (const k of Object.keys(spec)) if (!known.has(k)) errs.push(`unknown field ${k} (one-way or other mechanics are not allowed)`);
  for (const g of spec.gates) for (const k of Object.keys(g)) if (!['side', 'at', 'len', 'color', 'lock', 'lockColor'].includes(k)) errs.push(`door field ${k}`);
  return errs;
}

/* ---------- solving ---------- */

export interface Solved {
  par: number;
  /** brick ids in the order they first move in one best solution (the hint fallback) */
  order: number[];
  explored: number;
  bricks: number;
}

export function solveSpec(spec: LevelSpec, limit: number): Solved | null {
  const lvl = fromSpec(spec, 0);
  if (validate(lvl).length || designProblems(lvl).length) return null;
  const sol = solve(lvl, initialState(lvl), limit);
  if (!sol) return null;
  const order: number[] = [];
  for (const m of sol.moves) if (!order.includes(m.block)) order.push(m.block);
  return { par: sol.moves.length, order, explored: sol.explored, bricks: lvl.blocks.length };
}

const solveLimit = (N: number) => (N <= 4 ? 50_000 : N <= 6 ? 250_000 : 300_000);

/* ---------- anchors ---------- */

export interface Puzzle {
  spec: LevelSpec;
  par: number;
  order: number[];
}
export interface PuzzleLevel {
  id: string;
  puzzles: Puzzle[];
}

const SLIDE_DIR = fileURLToPath(new URL('../src/games/slide/', import.meta.url));
const PUZZLES_FILE = SLIDE_DIR + 'puzzles.data.ts';
const LEVELS_FILE = SLIDE_DIR + 'levels.data.ts';

/** The JSON literal of a generated data file (`export const X: T[] = [...];`). */
function dataLiteral<T>(file: string): T[] {
  const text = readFileSync(file, 'utf8');
  const m = /\]\s*=\s*/.exec(text);
  if (!m) throw new Error(`no data in ${file}`);
  return JSON.parse(text.slice(m.index + m[0].length, text.lastIndexOf(';'))) as T[];
}

/** Puzzle 1 of each level: puzzles.data.ts once it exists, today's levels.data.ts before that. */
export function loadAnchors(): Puzzle[] {
  if (existsSync(PUZZLES_FILE)) return dataLiteral<PuzzleLevel>(PUZZLES_FILE).map((l) => l.puzzles[0]);
  return dataLiteral<Puzzle | PuzzleLevel>(LEVELS_FILE).map((l) => ('puzzles' in l ? l.puzzles[0] : l));
}

/* ---------- building one candidate (port of design/escape-levels/gen.cjs, fixed to the anchor) ---------- */

interface Placed {
  r: number;
  c: number;
  w: number;
  h: number;
}

/** Fill every open square of the tray with bricks of the given sizes (backtracking, first empty square first). */
function pack(N: number, tray: string[], dims: [number, number][], rand: Rand): Placed[] | null {
  const grid: number[][] = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (tray[r][c] === '.' ? 0 : -1)));
  const bricks: Placed[] = [];
  const first = (): [number, number] | null => {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] === 0) return [r, c];
    return null;
  };
  const fits = (r: number, c: number, w: number, h: number) => {
    if (r + h > N || c + w > N) return false;
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) if (grid[r + i][c + j] !== 0) return false;
    return true;
  };
  const set = (r: number, c: number, w: number, h: number, v: number) => {
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) grid[r + i][c + j] = v;
  };
  let budget = 20_000;
  const go = (): boolean => {
    if (--budget < 0) return false;
    const f = first();
    if (!f) return true;
    for (const [w, h] of shuffled(rand, dims)) {
      if (!fits(f[0], f[1], w, h)) continue;
      set(f[0], f[1], w, h, bricks.length + 1);
      bricks.push({ r: f[0], c: f[1], w, h });
      if (go()) return true;
      bricks.pop();
      set(f[0], f[1], w, h, 0);
    }
    return false;
  };
  return go() ? bricks : null;
}

/** A door may only open onto plain tray squares on the board's outer edge (no void, no stone). */
function edgeOk(N: number, tray: string[], side: Side, at: number, len: number) {
  for (let i = 0; i < len; i++) {
    const [r, c] = side === 'top' ? [0, at + i] : side === 'bottom' ? [N - 1, at + i] : side === 'left' ? [at + i, 0] : [at + i, N - 1];
    if (tray[r][c] !== '.') return false;
  }
  return true;
}

export interface Target {
  level: number;
  anchor: Puzzle;
  sig: Signature;
  tray: string[];
  dims: [number, number][];
  lockValues: number[];
}

export function target(level: number, anchor: Puzzle): Target {
  const sig = signature(anchor.spec);
  const dims = new Map<string, [number, number]>();
  for (const s of sig.sizes.split(',')) {
    const [a, b] = s.split('x').map(Number);
    dims.set(`${a}x${b}`, [a, b]);
    dims.set(`${b}x${a}`, [b, a]);
  }
  return {
    level,
    anchor,
    sig,
    tray: trayOf(anchor.spec.map),
    dims: [...dims.values()],
    lockValues: anchor.spec.gates.filter((g) => g.lock).map((g) => g.lock!),
  };
}

/** One candidate with exactly the anchor's signature, or null when this random try does not work out. */
export function build(t: Target, rand: Rand, avoidColorSets: Set<string>): LevelSpec | null {
  const { N } = t.sig;
  const a = t.anchor.spec;
  const tray = transformMap(t.tray, Math.floor(rand() * 8));
  const raw = pack(N, tray, t.dims, rand);
  if (!raw || raw.length > LETTERS.length || Math.abs(raw.length - t.sig.bricks) > 1 || raw.length < t.sig.colors) return null;
  const sizes = new Set(raw.map((b) => `${Math.min(b.w, b.h)}x${Math.max(b.w, b.h)}`));
  if ([...sizes].sort().join(',') !== t.sig.sizes) return null;

  let colors: Color[] = [];
  for (let k = 0; k < 30; k++) {
    colors = shuffled(rand, PALETTE).slice(0, t.sig.colors);
    if (!avoidColorSets.has(colors.slice().sort().join(','))) break;
  }
  // every color used at least once
  const assign = shuffled(
    rand,
    raw.map((_, i) => colors[i % colors.length]),
  );
  const bricks = raw.map((b, i) => ({ ...b, color: assign[i], key: LETTERS[i] }));

  const advanced = Boolean(a.advanced);
  const seedDoors = N >= 8;
  const gates: GateDef[] = [];
  const used = new Set<string>();
  for (const color of colors) {
    const mine = bricks.filter((b) => b.color === color);
    const seeds: [Side, number][] = [];
    for (const m of mine) {
      if (m.r === 0) seeds.push(['top', m.c]);
      if (m.r + m.h === N) seeds.push(['bottom', m.c]);
      if (m.c === 0) seeds.push(['left', m.r]);
      if (m.c + m.w === N) seeds.push(['right', m.r]);
    }
    let placed = false;
    for (let tries = 0; tries < 60 && !placed; tries++) {
      const seed = seedDoors && seeds.length && tries < 40 ? seeds[Math.floor(rand() * seeds.length)] : null;
      const side: Side = seed ? seed[0] : (['top', 'bottom', 'left', 'right'] as Side[])[Math.floor(rand() * 4)];
      const horiz = side === 'left' || side === 'right';
      // a door is exactly as long as the bricks that use it
      const len = Math.max(...mine.map((b) => (horiz ? b.h : b.w)));
      if (len > N) continue;
      const at = !advanced ? (rand() < 0.5 ? 0 : N - len) : seed ? Math.max(0, Math.min(N - len, seed[1])) : Math.floor(rand() * (N - len + 1));
      if (!edgeOk(N, tray, side, at, len)) continue;
      // doors keep at least one free square between them, and never meet at a corner
      let clash = false;
      for (let i = -1; i <= len; i++) if (used.has(side + (at + i))) clash = true;
      const end = at + len - 1;
      const corner = (s2: Side, pos: number) => used.has(s2 + pos) || used.has(s2 + (pos === 0 ? 1 : pos - 1));
      if (horiz) {
        if ((at <= 1 && corner('top', side === 'left' ? 0 : N - 1)) || (end >= N - 2 && corner('bottom', side === 'left' ? 0 : N - 1))) clash = true;
      } else if ((at <= 1 && corner('left', side === 'top' ? 0 : N - 1)) || (end >= N - 2 && corner('right', side === 'top' ? 0 : N - 1))) clash = true;
      if (clash) continue;
      for (let i = 0; i < len; i++) used.add(side + (at + i));
      gates.push({ side, at, len, color });
      placed = true;
    }
    if (!placed) return null;
  }

  // locks: the anchor's icy doors (same melt counts) and color-lock chain length; one door always stays open
  const order = shuffled(rand, gates);
  if (t.lockValues.length + t.sig.chain + (t.sig.chain ? 1 : 0) > order.length - (t.sig.chain ? 0 : 1)) return null;
  let gi = 0;
  for (const v of shuffled(rand, t.lockValues)) order[gi++].lock = v;
  if (t.sig.chain > 0) {
    let prev = order[gi++].color;
    for (let i = 0; i < t.sig.chain; i++) {
      const g = order[gi++];
      g.lockColor = prev;
      prev = g.color;
    }
  }

  const grid = tray.map((l) => [...l]);
  const colorOf: Record<string, Color> = {};
  for (const b of bricks) {
    colorOf[b.key] = b.color;
    for (let i = 0; i < b.h; i++) for (let j = 0; j < b.w; j++) grid[b.r + i][b.c + j] = b.key;
  }
  return withAnchorFields(a, { map: grid.map((r) => r.join('')), colors: colorOf, gates });
}

/** Name, tip, clock base and advanced flag come from the anchor, so all six share its subtitle and tip. */
function withAnchorFields(a: LevelSpec, s: Pick<LevelSpec, 'map' | 'colors' | 'gates'>): LevelSpec {
  return {
    ...(a.name !== undefined ? { name: a.name } : {}),
    ...(a.tip !== undefined ? { tip: a.tip } : {}),
    map: s.map,
    colors: s.colors,
    gates: s.gates.map((g) => ({ side: g.side, at: g.at, len: g.len, color: g.color, ...(g.lock ? { lock: g.lock } : {}), ...(g.lockColor ? { lockColor: g.lockColor } : {}) })),
    ...(a.base !== undefined ? { base: a.base } : {}),
    ...(a.advanced ? { advanced: true } : {}),
  };
}

/* ---------- one level, resumable ---------- */

interface Candidate extends Puzzle {
  score: number;
  /** 0 found under the strict rules, 1 with the wider par window, 2 with relaxed variety */
  fallback: number;
}
interface LevelCache {
  /** canonical key of the anchor the pool was built for; a changed anchor starts a fresh pool */
  anchor: string;
  runs: number;
  tries: number;
  /** highest fallback this level has been run with */
  fallback: number;
  pool: Candidate[];
}

const CACHE_DIR = fileURLToPath(new URL('./.slide-cache/', import.meta.url));
const cachePath = (n: number) => `${CACHE_DIR}level-${n}.json`;
const PROGRESS = `${CACHE_DIR}progress.log`;

function readCache(n: number, anchorKey: string): LevelCache {
  try {
    const c = JSON.parse(readFileSync(cachePath(n), 'utf8')) as LevelCache;
    if (c.anchor === anchorKey) return c;
  } catch {
    /* no cache yet */
  }
  return { anchor: anchorKey, runs: 0, tries: 0, fallback: 0, pool: [] };
}

const hhmm = () => new Date().toTimeString().slice(0, 5);
function progress(line: string) {
  const text = `${hhmm()} ${line}`;
  console.error(text);
  try {
    appendFileSync(PROGRESS, text + '\n');
  } catch {
    /* the log is a convenience */
  }
}

const parWindow = (fallback: number) => (fallback >= 1 ? 2 : 1);

/** Boards from the old tier caches that match this level. */
function oldTierBoards(): LevelSpec[] {
  if (!existsSync(CACHE_DIR)) return [];
  return readdirSync(CACHE_DIR)
    .filter((f) => /^tier-.*\.json$/.test(f))
    .flatMap((f) => {
      try {
        return (JSON.parse(readFileSync(CACHE_DIR + f, 'utf8')) as { pool: { spec: LevelSpec }[] }).pool.map((c) => c.spec);
      } catch {
        return [];
      }
    });
}

function runLevel(n: number, minutes: number, fallback: number) {
  const anchors = loadAnchors();
  const anchor = anchors[n - 1];
  const t = target(n, anchor);
  const anchorBoard = board(anchor.spec);
  const cache = readCache(n, anchorBoard.canon);
  cache.fallback = Math.max(cache.fallback, fallback);
  const relaxed = fallback >= 2;
  const win = parWindow(fallback);
  const best = anchor.par;
  const limit = solveLimit(t.sig.N);
  // never repeat another level's anchor either
  const taken = new Set(anchors.map((x) => canonical(x.spec)));
  const pool = cache.pool.map((c) => board(c.spec));
  for (const b of pool) taken.add(b.canon);
  const tried = new Set<string>(taken);
  const colorSets = new Set([anchorBoard.colorKey, ...pool.map((b) => b.colorKey)]);
  const fitsPool = (b: Board) => [anchorBoard, ...pool].every((x) => compatible(b, x, relaxed));

  const save = () => writeFileSync(cachePath(n), JSON.stringify(cache));
  const accept = (spec: LevelSpec): boolean => {
    const b = board(spec);
    if (tried.has(b.canon)) return false;
    tried.add(b.canon);
    if (signatureProblems(anchor.spec, spec).length || boardProblems(spec).length || !fitsPool(b)) return false;
    const s = solveSpec(spec, limit);
    if (!s || Math.abs(s.par - best) > win) return false;
    const fb = Math.abs(s.par - best) > 1 ? 1 : 0;
    // reward planning (moves beyond one per brick) and a bigger search space, as the canvas generator does
    cache.pool.push({ spec, par: s.par, order: s.order, score: (s.par - s.bricks) * 3 + Math.log2(s.explored + 1), fallback: Math.max(fb, relaxed ? 2 : 0) });
    pool.push(b);
    colorSets.add(b.colorKey);
    save();
    return true;
  };

  // a new seed per run, so a resumed run keeps finding new boards
  const rand = rng(20261104 + n * 7919 + cache.runs * 104_729 + fallback * 15_485_863);
  cache.runs++;
  save();

  let imported = 0;
  for (const spec of oldTierBoards()) {
    if (cache.pool.length >= POOL) break;
    const s = withAnchorFields(anchor.spec, spec);
    if (accept(s)) imported++;
  }
  if (imported) progress(`level ${n}: imported ${imported} boards from the old tier caches`);

  const start = Date.now();
  const deadline = start + minutes * 60_000;
  let lastLog = Date.now();
  let lastFind = Date.now();
  const gaps: number[] = [];
  let stop = '';
  while (cache.pool.length < POOL && Date.now() < deadline) {
    cache.tries++;
    const now = Date.now();
    if (now - lastLog >= 60_000) {
      progress(`level ${n}: pool ${cache.pool.length} of ${POOL}, ${cache.tries} tries`);
      lastLog = now;
      save();
    }
    // stop early once a level has enough boards and has stopped finding new ones
    const mean = gaps.length ? gaps.reduce((x, y) => x + y, 0) / gaps.length : 0;
    if (cache.pool.length >= PUZZLES - 1 && now - lastFind > Math.max(3 * 60_000, 4 * mean)) {
      stop = 'no new boards for a while';
      break;
    }
    // small boards run out of different layouts; stop instead of spinning for the whole budget
    if (t.sig.N < 8 && now - lastFind > 10 * 60_000) {
      stop = 'no new boards in 10 minutes';
      break;
    }
    const spec = build(t, rand, relaxed ? new Set() : colorSets);
    if (!spec || !accept(spec)) continue;
    gaps.push(Date.now() - lastFind);
    lastFind = Date.now();
  }
  save();
  const mins = ((Date.now() - start) / 60_000).toFixed(1);
  progress(`level ${n}: done, pool ${cache.pool.length} of ${POOL}, ${cache.tries} tries, ${mins} min${stop ? ` (${stop})` : ''}`);
}

/* ---------- choosing the 5 boards and writing the file ---------- */

export interface Choice {
  boards: Candidate[];
  /** fallbacks the chosen boards needed: 1 wider par window, 2 relaxed variety */
  fallbacks: number[];
}

/**
 * Keep the boards that differ most from the anchor and from each other (door layout first, then bricks),
 * preferring the strict rules: par within 1 and strict variety, then par within 2, then relaxed variety.
 */
export function choose(anchor: Puzzle, pool: Candidate[], taken: Set<string>, count = PUZZLES - 1): Choice {
  const chosen: Board[] = [board(anchor.spec)];
  const out: Candidate[] = [];
  const fallbacks = new Set<number>();
  const boards = pool.map((c) => ({ c, b: board(c.spec) })).filter(({ b }) => !taken.has(b.canon));
  while (out.length < count) {
    let pickedOne = false;
    for (const tier of [0, 1, 2]) {
      const relaxed = tier >= 2;
      const ok = boards.filter(
        ({ c, b }) => !out.includes(c) && Math.abs(c.par - anchor.par) <= parWindow(tier) && chosen.every((x) => compatible(b, x, relaxed)),
      );
      if (!ok.length) continue;
      const score = ({ c, b }: { c: Candidate; b: Board }) => [Math.min(...chosen.map((x) => distance(b, x))), c.score] as const;
      const best = ok.reduce((p, q) => {
        const [d1, s1] = score(p);
        const [d2, s2] = score(q);
        return d2 > d1 || (d2 === d1 && s2 > s1) ? q : p;
      });
      out.push(best.c);
      chosen.push(best.b);
      if (tier) fallbacks.add(tier);
      if (Math.abs(best.c.par - anchor.par) > 1) fallbacks.add(1);
      pickedOne = true;
      break;
    }
    if (!pickedOne) break;
  }
  return { boards: out, fallbacks: [...fallbacks].sort() };
}

/** Every check a shipped puzzle must pass against its anchor. Empty = fine. */
export function puzzleProblems(anchor: Puzzle, p: Puzzle, isAnchor: boolean): string[] {
  const errs = boardProblems(p.spec, !isAnchor);
  if (!isAnchor) errs.push(...signatureProblems(anchor.spec, p.spec));
  const s = solveSpec(p.spec, 2_000_000);
  if (!s) errs.push('the solver finds no solution');
  else {
    if (s.par !== p.par) errs.push(`par ${p.par} but the solver's best is ${s.par}`);
    if (!isAnchor && Math.abs(s.par - anchor.par) > 2) errs.push(`best ${s.par} is outside the par window around ${anchor.par}`);
  }
  return errs;
}

export function levelId(puzzles: Puzzle[]): string {
  return createHash('sha256').update(JSON.stringify(puzzles)).digest('hex').slice(0, 12);
}

function combine(allowShort: boolean) {
  const anchors = loadAnchors();
  if (anchors.length !== LEVEL_COUNT) throw new Error(`expected ${LEVEL_COUNT} anchors, found ${anchors.length}`);
  for (const [n, key] of Object.entries(CANVAS_LEVELS)) {
    const { spec, best } = loadCanvas(key);
    const a = anchors[Number(n) - 1];
    if (JSON.stringify(spec) !== JSON.stringify(a.spec) || best !== a.par) throw new Error(`Level ${n} no longer matches its canvas board`);
  }
  const taken = new Set(anchors.map((a) => canonical(a.spec)));
  const levels: PuzzleLevel[] = [];
  const short: string[] = [];
  const used: string[] = [];
  anchors.forEach((anchor, i) => {
    const n = i + 1;
    const cache = existsSync(cachePath(n)) ? readCache(n, canonical(anchor.spec)) : { pool: [] as Candidate[] };
    const pick = choose(anchor, cache.pool, taken);
    const puzzles: Puzzle[] = [anchor, ...pick.boards.map((c) => ({ spec: c.spec, par: c.par, order: c.order }))];
    puzzles.forEach((p, k) => {
      const errs = puzzleProblems(anchor, p, k === 0);
      if (errs.length) throw new Error(`Level ${n} puzzle ${k + 1}: ${errs.join('; ')}`);
      taken.add(canonical(p.spec));
    });
    if (puzzles.length < PUZZLES) short.push(`Level ${n}: ${puzzles.length} of ${PUZZLES} boards (pool ${cache.pool.length})`);
    if (pick.fallbacks.length) used.push(`Level ${n}: fallback ${pick.fallbacks.join(' and ')}`);
    levels.push({ id: levelId(puzzles), puzzles });
  });
  for (const line of used) console.error(line);
  if (short.length) {
    for (const line of short) console.error(line);
    if (!allowShort) {
      console.error('Not written: some levels are short. Rerun them with --fallback, or pass --allow-short.');
      process.exitCode = 1;
      return;
    }
  }
  writeFileSync(
    PUZZLES_FILE,
    `// Generated by scripts/generate-slide-levels.ts. Do not edit by hand; run \`npm run levels:generate\`.\n` +
      `// 31 Brick Escape levels, 6 puzzles each. Puzzle 1 is the level's original board. \`id\` changes when a level's puzzles do.\n` +
      `import type { LevelSpec } from './engine';\n\n` +
      `export interface PuzzleData {\n  spec: LevelSpec;\n  par: number;\n  order: number[];\n}\n\n` +
      `export const PUZZLE_DATA: { id: string; puzzles: PuzzleData[] }[] = [\n` +
      levels.map((l) => `  ${JSON.stringify(l)}`).join(',\n') +
      `\n];\n`,
  );
  console.error(`wrote ${levels.length} levels, ${levels.reduce((s, l) => s + l.puzzles.length, 0)} puzzles to ${PUZZLES_FILE}`);
}

/* ---------- main ---------- */

const self = fileURLToPath(import.meta.url);

async function main() {
  const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const minutes = Number(arg('--minutes') ?? 30);
  const fallback = Number(arg('--fallback') ?? 0);
  const levelArg = arg('--level');
  mkdirSync(CACHE_DIR, { recursive: true });
  const budget = (n: number) => (LONG.has(n) ? minutes * 2 : minutes);
  if (levelArg) {
    const n = Number(levelArg);
    if (!Number.isInteger(n) || n < 1 || n > LEVEL_COUNT) throw new Error(`--level takes 1 to ${LEVEL_COUNT}`);
    runLevel(n, budget(n), fallback);
    return;
  }

  if (!process.argv.includes('--combine')) {
    const anchors = loadAnchors();
    const size = (n: number) => anchors[n - 1].spec.map.length;
    const want = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).filter((n) => readCache(n, canonical(anchors[n - 1].spec)).pool.length < POOL);
    // 8x8 levels first, the longest budgets first among them
    const queue = want.sort((a, b) => size(b) - size(a) || budget(b) - budget(a) || a - b);
    const parallel = Math.max(1, Math.min(availableParallelism() - 1, queue.length));
    progress(`run: ${queue.length} levels on ${parallel} workers, ${minutes} min each (twice that for Levels 9 and 31)`);
    await Promise.all(
      Array.from({ length: parallel }, async () => {
        for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
          const args = [...process.execArgv, self, '--level', String(n), '--minutes', String(minutes), ...(fallback ? ['--fallback', String(fallback)] : [])];
          const code = await new Promise<number>((res) => spawn(process.execPath, args, { stdio: 'inherit' }).on('exit', (c) => res(c ?? 1)));
          if (code !== 0) progress(`level ${n}: exited with ${code}`);
        }
      }),
    );
  }
  combine(process.argv.includes('--allow-short'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) void main();
