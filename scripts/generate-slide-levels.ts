/**
 * Brick Escape level generator. Writes src/games/slide/levels.data.ts. Run: npm run levels:generate
 *
 * Follows the rules the user set on the design canvas (design/escape-levels/README.md, gen.cjs):
 * - every open square of the tray is packed with bricks (2x2, 2x3, 2x4, 4x4), so the first move frees space;
 * - one door per color, exactly as long as the bricks that use it, starting at a corner of the board
 *   (doors in the middle of an edge only on advanced levels), never next to another door;
 * - obstacles: icy doors that melt after N bricks leave, color locks that open one at a time,
 *   grey stones that never move, and shaped trays. No frozen and no one-way bricks.
 * - the six canvas levels (design/escape-levels/out-*.json) ship as they are, at their places in the list.
 * Every level is checked by the game's own solver, and its par is the solver's best move count.
 *
 * Generation is slow, so each tier runs in its own child process and saves its candidates to
 * scripts/.slide-cache/tier-<n>.json after every find. Runs resume from that cache.
 *   npm run levels:generate                   generate every tier (default budget 40 minutes), then write the file
 *   npm run levels:generate -- --minutes 10   smaller time budget per tier
 *   npm run levels:generate -- --combine      write the file from the cache only
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { type Color, type GateDef, type LevelSpec, type Side, designProblems, fromSpec, initialState, validate } from '../src/games/slide/engine';
import { solve } from '../src/games/slide/solver';
import { rng } from '../src/shared/rng';

/* ---------- shapes and tiers ---------- */

/** Brick sizes as [w, h], named like the canvas generator. */
const SIZES = { s22: [2, 2], s23: [3, 2], s32: [2, 3], s24: [4, 2], s42: [2, 4], s44: [4, 4] } as const;
type SizeKey = keyof typeof SIZES;

const PALETTE: Color[] = ['red', 'yellow', 'green', 'blue', 'purple', 'orange', 'pink', 'teal', 'white', 'black'];

export interface Tier {
  key: string;
  count: number;
  /** board size (square) */
  N: number;
  /** tray shapes: '.' open, '#' outside the tray, '*' stone. One is picked per level. */
  maps?: string[][];
  colors: [number, number];
  sizes: SizeKey[];
  /** count locks: icy doors that melt after 1..maxCount bricks are out */
  countLocks: [number, number];
  maxCount: number;
  /** color locks: door X waits for color Y, then door Z waits for color X (one at a time) */
  colorChain: [number, number];
  /** advanced levels may put a door in the middle of an edge */
  advanced: boolean;
  /** put doors next to an edge brick of their color first (helps packed 8x8 boards) */
  seedDoors: boolean;
  par: [number, number];
  /** seconds on the level clock before the age factor */
  base: number;
  /** solver budget per candidate (explored states) */
  limit: number;
}

const OPEN6 = ['......', '......', '..**..', '..**..', '......', '......'];
const NOTCH6 = ['##....', '##....', '......', '......', '....##', '....##'];
const STONE6 = ['......', '......', '**....', '**....', '......', '......'];
const WALLS8 = ['...##...', '...##...', '...**...', '...**...', '........', '........', '...##...', '...##...'];
const RING8 = ['........', '........', '........', '...**...', '...**...', '........', '........', '........'];

export const TIERS: Tier[] = [
  // Getting started (levels 2 to 4): small packed boards, two or three colors
  { key: 'start', count: 3, N: 4, colors: [2, 3], sizes: ['s22', 's24', 's42'], countLocks: [0, 0], maxCount: 0, colorChain: [0, 0], advanced: false, seedDoors: false, par: [4, 7], base: 30, limit: 50_000 },
  // Getting started (levels 6 to 8): 6x6, three colors, sometimes one icy door like Level 5
  { key: 'six', count: 3, N: 6, colors: [3, 3], sizes: ['s22', 's23', 's32', 's24', 's42'], countLocks: [0, 1], maxCount: 2, colorChain: [0, 0], advanced: false, seedDoors: false, par: [7, 11], base: 45, limit: 150_000 },
  // Think first (levels 10 to 13): more planning, some bricks block others
  { key: 'think', count: 4, N: 6, colors: [3, 4], sizes: ['s22', 's23', 's32', 's24', 's42'], countLocks: [0, 0], maxCount: 0, colorChain: [0, 0], advanced: false, seedDoors: false, par: [10, 14], base: 45, limit: 200_000 },
  // Icy doors (levels 15 to 19): count locks, later one color lock
  { key: 'ice', count: 5, N: 6, colors: [3, 4], sizes: ['s22', 's23', 's32', 's24', 's42'], countLocks: [1, 2], maxCount: 3, colorChain: [0, 1], advanced: false, seedDoors: false, par: [11, 16], base: 45, limit: 200_000 },
  // Stones and shaped trays (levels 21 to 25)
  { key: 'stones', count: 5, N: 6, maps: [OPEN6, NOTCH6, STONE6], colors: [3, 4], sizes: ['s22', 's23', 's32'], countLocks: [0, 1], maxCount: 3, colorChain: [0, 0], advanced: false, seedDoors: false, par: [13, 18], base: 45, limit: 250_000 },
  // Big bricks (levels 26 to 30): 8x8 with 2x4 and 4x4 bricks, advanced doors allowed
  { key: 'big', count: 5, N: 8, maps: [Array(8).fill('........'), RING8, WALLS8], colors: [4, 5], sizes: ['s44', 's24', 's42', 's22', 's23', 's32'], countLocks: [0, 1], maxCount: 3, colorChain: [0, 1], advanced: true, seedDoors: true, par: [15, 22], base: 60, limit: 300_000 },
];

/**
 * The shipped order. Canvas levels sit at their numbers (1, 5, 9); the three teaching boards from the canvas
 * open the chapter that uses their idea (Icy doors, stones, Master).
 */
const PLAN: ({ canvas: string } | { tier: string })[] = [
  // Getting started 1 to 8
  { canvas: '1' }, { tier: 'start' }, { tier: 'start' }, { tier: 'start' }, { canvas: '5' }, { tier: 'six' }, { tier: 'six' }, { tier: 'six' },
  // Think first 9 to 13
  { canvas: '9' }, { tier: 'think' }, { tier: 'think' }, { tier: 'think' }, { tier: 'think' },
  // Icy doors 14 to 19
  { canvas: 'ice' }, { tier: 'ice' }, { tier: 'ice' }, { tier: 'ice' }, { tier: 'ice' }, { tier: 'ice' },
  // Stones (chapter name still a placeholder on the Levels board) 20 to 25
  { canvas: 'walls' }, { tier: 'stones' }, { tier: 'stones' }, { tier: 'stones' }, { tier: 'stones' }, { tier: 'stones' },
  // Big bricks 26 to 30
  { tier: 'big' }, { tier: 'big' }, { tier: 'big' }, { tier: 'big' }, { tier: 'big' },
  // Master 31
  { canvas: 'master' },
];

/* ---------- canvas levels ---------- */

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

/* ---------- building one level (port of design/escape-levels/gen.cjs) ---------- */

type Rand = () => number;
const between = (rand: Rand, [a, b]: [number, number]) => a + Math.floor(rand() * (b - a + 1));
const shuffled = <T>(rand: Rand, a: T[]) => {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

interface Placed {
  r: number;
  c: number;
  w: number;
  h: number;
}

/** Fill every open square with bricks of the given sizes (backtracking, first empty square first). */
function pack(N: number, map: string[] | undefined, sizes: SizeKey[], rand: Rand): Placed[] | null {
  const grid: number[][] = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => ((map ? map[r][c] : '.') === '.' ? 0 : -1)));
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
    for (const key of shuffled(rand, sizes)) {
      const [w, h] = SIZES[key];
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
function edgeOk(N: number, map: string[] | undefined, side: Side, at: number, len: number) {
  for (let i = 0; i < len; i++) {
    const [r, c] = side === 'top' ? [0, at + i] : side === 'bottom' ? [N - 1, at + i] : side === 'left' ? [at + i, 0] : [at + i, N - 1];
    if (map && map[r][c] !== '.') return false;
  }
  return true;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function build(t: Tier, rand: Rand): LevelSpec | null {
  const N = t.N;
  const map = t.maps ? t.maps[Math.floor(rand() * t.maps.length)] : undefined;
  const nColors = between(rand, t.colors);
  const colors = shuffled(rand, PALETTE).slice(0, nColors);
  const raw = pack(N, map, t.sizes, rand);
  if (!raw || raw.length > LETTERS.length) return null;
  // every color used at least once
  const assign = shuffled(
    rand,
    raw.map((_, i) => colors[i % colors.length]),
  );
  const bricks = raw.map((b, i) => ({ ...b, color: assign[i], key: LETTERS[i] }));

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
      const seed = t.seedDoors && seeds.length && tries < 40 ? seeds[Math.floor(rand() * seeds.length)] : null;
      const side: Side = seed ? seed[0] : (['top', 'bottom', 'left', 'right'] as Side[])[Math.floor(rand() * 4)];
      const horiz = side === 'left' || side === 'right';
      // a door is exactly as long as the bricks that use it
      const len = Math.max(...mine.map((b) => (horiz ? b.h : b.w)));
      if (len > N) continue;
      const at = !t.advanced ? (rand() < 0.5 ? 0 : N - len) : seed ? Math.max(0, Math.min(N - len, seed[1])) : Math.floor(rand() * (N - len + 1));
      if (!edgeOk(N, map, side, at, len)) continue;
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

  // locks
  const order = shuffled(rand, gates);
  let gi = 0;
  const nCount = between(rand, t.countLocks);
  for (let i = 0; i < nCount && gi < order.length - 1; i++) order[gi++].lock = 1 + Math.floor(rand() * t.maxCount);
  const nChain = between(rand, t.colorChain);
  if (nChain > 0 && gi < order.length - 1) {
    let prev = order[gi++].color;
    for (let i = 0; i < nChain && gi < order.length; i++) {
      const g = order[gi++];
      g.lockColor = prev;
      prev = g.color;
    }
  }

  const grid = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (map ? map[r][c] : '.')));
  const colorOf: Record<string, Color> = {};
  for (const b of bricks) {
    colorOf[b.key] = b.color;
    for (let i = 0; i < b.h; i++) for (let j = 0; j < b.w; j++) grid[b.r + i][b.c + j] = b.key;
  }
  return {
    name: describe(colors.length, gates, Boolean(map?.some((l) => l.includes('*')))),
    map: grid.map((r) => r.join('')),
    colors: colorOf,
    gates,
    base: t.base,
    ...(t.advanced ? { advanced: true } : {}),
  };
}

const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/** A short factual subtitle from what the level contains, in the canvas style ("Three colors, one icy door"). */
export function describe(colors: number, gates: GateDef[], stones: boolean): string {
  const parts = [`${WORDS[colors] ?? colors} colors`];
  const ice = gates.filter((g) => g.lock).length;
  const locks = gates.filter((g) => g.lockColor).length;
  if (ice) parts.push(`${WORDS[ice].toLowerCase()} icy door${ice === 1 ? '' : 's'}`);
  if (locks) parts.push(`${WORDS[locks].toLowerCase()} color lock${locks === 1 ? '' : 's'}`);
  if (stones) parts.push('stones');
  return parts.join(', ');
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

/* ---------- one tier, resumable ---------- */

interface Candidate {
  spec: LevelSpec;
  par: number;
  order: number[];
  score: number;
}
interface TierCache {
  runs: number;
  tries: number;
  pool: Candidate[];
}

const CACHE_DIR = fileURLToPath(new URL('./.slide-cache/', import.meta.url));
const cachePath = (key: string) => `${CACHE_DIR}tier-${key}.json`;

function readCache(key: string): TierCache {
  try {
    return JSON.parse(readFileSync(cachePath(key), 'utf8')) as TierCache;
  } catch {
    return { runs: 0, tries: 0, pool: [] };
  }
}

const canonical = (s: LevelSpec) => JSON.stringify([s.map, s.gates]);

function runTier(key: string, minutes: number) {
  const t = TIERS.find((x) => x.key === key)!;
  const cache = readCache(key);
  const want = t.count * 10;
  const seen = new Set(cache.pool.map((c) => canonical(c.spec)));
  // a new seed per run, so a resumed run keeps finding new boards
  const rand = rng(20261104 + TIERS.indexOf(t) * 7919 + cache.runs * 104_729);
  cache.runs++;
  const deadline = Date.now() + minutes * 60_000;
  const save = () => writeFileSync(cachePath(key), JSON.stringify(cache));
  save();
  let lastLog = Date.now();
  while (cache.pool.length < want && Date.now() < deadline) {
    cache.tries++;
    if (Date.now() - lastLog > 60_000) {
      console.error(`tier ${key}: still searching, ${cache.pool.length}/${want} after ${cache.tries} tries`);
      lastLog = Date.now();
    }
    const spec = build(t, rand);
    if (!spec || seen.has(canonical(spec))) continue;
    const s = solveSpec(spec, t.limit);
    if (!s || s.par < t.par[0] || s.par > t.par[1]) continue;
    seen.add(canonical(spec));
    // reward planning (moves beyond one per brick) and a bigger search space, as the canvas generator does
    cache.pool.push({ spec, par: s.par, order: s.order, score: (s.par - s.bricks) * 3 + Math.log2(s.explored + 1) });
    save();
    console.error(`tier ${key}: ${cache.pool.length}/${want} (par ${s.par}, ${cache.tries} tries)`);
    lastLog = Date.now();
  }
  save();
}

/** Pick `count` levels spread over the par range, the most interesting of each bucket, easiest first. */
export function choose(pool: Candidate[], count: number): Candidate[] {
  if (pool.length <= count) return pool.slice().sort((a, b) => a.par - b.par);
  const sorted = pool.slice().sort((a, b) => a.par - b.par || a.score - b.score);
  return Array.from({ length: count }, (_, k) => {
    const bucket = sorted.slice(Math.floor((k * sorted.length) / count), Math.floor(((k + 1) * sorted.length) / count));
    return bucket.reduce((best, c) => (c.score > best.score ? c : best));
  });
}

/* ---------- main ---------- */

const self = fileURLToPath(import.meta.url);

async function main() {
  const arg = (name: string) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const minutes = Number(arg('--minutes') ?? 40);
  const tierArg = arg('--tier');
  mkdirSync(CACHE_DIR, { recursive: true });
  if (tierArg) {
    runTier(tierArg, minutes);
    return;
  }

  if (!process.argv.includes('--combine')) {
    // hardest first, they take longest
    const queue = TIERS.map((t) => t.key).reverse();
    const parallel = Math.max(1, Math.min(availableParallelism() - 1, TIERS.length));
    await Promise.all(
      Array.from({ length: parallel }, async () => {
        for (let key = queue.shift(); key !== undefined; key = queue.shift()) {
          const code = await new Promise<number>((res) =>
            spawn(process.execPath, [...process.execArgv, self, '--tier', key, '--minutes', String(minutes)], { stdio: 'inherit' }).on('exit', (c) => res(c ?? 1)),
          );
          if (code !== 0) console.error(`tier ${key} exited with ${code}`);
        }
      }),
    );
  }

  const picked = new Map<string, Candidate[]>();
  for (const t of TIERS) {
    const pool = existsSync(cachePath(t.key)) ? readCache(t.key).pool : [];
    picked.set(t.key, choose(pool, t.count));
    if (pool.length < t.count) console.error(`tier ${t.key}: only ${pool.length} of ${t.count} levels so far; those slots are left out`);
  }

  const out: { spec: LevelSpec; par: number; order: number[] }[] = [];
  for (const slot of PLAN) {
    if ('canvas' in slot) {
      const { spec, best } = loadCanvas(slot.canvas);
      const s = solveSpec(spec, 2_000_000);
      if (!s) throw new Error(`canvas level ${slot.canvas} breaks a rule or is not solvable`);
      if (s.par !== best) throw new Error(`canvas level ${slot.canvas}: solver says ${s.par}, canvas says ${best}`);
      out.push({ spec, par: s.par, order: s.order });
    } else {
      const next = picked.get(slot.tier)!.shift();
      if (next) out.push({ spec: next.spec, par: next.par, order: next.order });
    }
  }

  const file = fileURLToPath(new URL('../src/games/slide/levels.data.ts', import.meta.url));
  writeFileSync(
    file,
    `// Generated by scripts/generate-slide-levels.ts. Do not edit by hand; run \`npm run levels:generate\`.\n` +
      `import type { LevelSpec } from './engine';\n\n` +
      `export const LEVEL_DATA: { spec: LevelSpec; par: number; order: number[] }[] = ${JSON.stringify(out)};\n`,
  );
  console.error(`wrote ${out.length} of ${PLAN.length} levels to ${file}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) void main();
