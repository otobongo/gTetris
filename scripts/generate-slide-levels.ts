/**
 * Generates Brick Escape levels from a seeded RNG, keeps only levels the solver can finish, scores them by how
 * much planning they need, and writes src/games/slide/levels.data.ts. Run: npm run levels:generate
 *
 * Difficulty knobs per tier: board size and shape, number of colors, brick shapes, how full the tray is,
 * door widths, ice locks, frozen bricks, and a target range for the optimal move count (par).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { type Color, type GateDef, type LevelSpec, type Side, exitGate, fromSpec, initialState, occupancy, validate } from '../src/games/slide/engine';
import { solve } from '../src/games/slide/solver';
import { ICE_BRICK, ICE_DOOR, TUTORIAL } from '../src/games/slide/levels.hand';
import { rng } from '../src/shared/rng';

type Shape = [number, number][];
const S: Record<string, Shape> = {
  dot: [[0, 0]],
  duoH: [[0, 0], [0, 1]],
  duoV: [[0, 0], [1, 0]],
  triH: [[0, 0], [0, 1], [0, 2]],
  triV: [[0, 0], [1, 0], [2, 0]],
  sq: [[0, 0], [0, 1], [1, 0], [1, 1]],
  l1: [[0, 0], [1, 0], [1, 1]],
  l2: [[0, 1], [1, 0], [1, 1]],
  l3: [[0, 0], [0, 1], [1, 0]],
  l4: [[0, 0], [0, 1], [1, 1]],
  bar2x3: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]],
  bar3x2: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
};

interface Tier {
  count: number;
  rows: [number, number];
  cols: [number, number];
  /** chance of cutting a corner out of the tray */
  voidChance: number;
  colors: [number, number];
  shapes: (keyof typeof S)[];
  fill: [number, number];
  gateLen: [number, number];
  locks: number; // max ice-locked doors
  frozen: number; // max frozen bricks
  par: [number, number];
  /** minimum moves beyond one per brick (planning needed) */
  extra: number;
}

const PALETTE: Color[] = ['red', 'yellow', 'green', 'blue', 'purple', 'orange', 'pink', 'teal', 'white', 'black'];

export const TIERS: Tier[] = [
  { count: 4, rows: [3, 4], cols: [3, 4], voidChance: 0, colors: [2, 2], shapes: ['dot', 'duoH', 'duoV'], fill: [0.4, 0.55], gateLen: [1, 2], locks: 0, frozen: 0, par: [3, 5], extra: 1 },
  { count: 5, rows: [4, 4], cols: [4, 5], voidChance: 0, colors: [2, 3], shapes: ['dot', 'duoH', 'duoV', 'sq'], fill: [0.55, 0.7], gateLen: [1, 2], locks: 0, frozen: 0, par: [5, 8], extra: 2 },
  { count: 5, rows: [4, 5], cols: [5, 5], voidChance: 0.3, colors: [3, 3], shapes: ['dot', 'duoH', 'duoV', 'triH', 'triV', 'sq'], fill: [0.6, 0.75], gateLen: [1, 3], locks: 1, frozen: 0, par: [7, 11], extra: 3 },
  { count: 5, rows: [5, 6], cols: [5, 5], voidChance: 0.4, colors: [3, 4], shapes: ['dot', 'duoH', 'duoV', 'triH', 'triV', 'sq', 'l1', 'l2', 'l3', 'l4'], fill: [0.65, 0.8], gateLen: [1, 3], locks: 1, frozen: 1, par: [10, 15], extra: 3 },
  { count: 5, rows: [6, 6], cols: [5, 6], voidChance: 0.5, colors: [4, 4], shapes: ['dot', 'duoH', 'duoV', 'triH', 'triV', 'sq', 'l1', 'l2', 'l3', 'l4', 'bar2x3', 'bar3x2'], fill: [0.7, 0.85], gateLen: [1, 3], locks: 2, frozen: 1, par: [12, 22], extra: 3 },
  { count: 4, rows: [6, 7], cols: [6, 6], voidChance: 0.5, colors: [4, 5], shapes: ['dot', 'duoH', 'duoV', 'triH', 'triV', 'sq', 'l1', 'l2', 'l3', 'l4', 'bar2x3', 'bar3x2'], fill: [0.75, 0.88], gateLen: [1, 3], locks: 2, frozen: 2, par: [14, 30], extra: 4 },
];

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generate(t: Tier, rand: () => number): LevelSpec | null {
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
  const between = ([a, b]: [number, number]) => a + Math.floor(rand() * (b - a + 1));
  const rows = between(t.rows);
  const cols = between(t.cols);
  const grid: string[][] = Array.from({ length: rows }, () => Array(cols).fill('.'));

  // optional corner cut, like an L-shaped tray
  if (rand() < t.voidChance) {
    const h = 1 + Math.floor(rand() * Math.floor(rows / 2));
    const w = 1 + Math.floor(rand() * Math.floor(cols / 2));
    const top = rand() < 0.5;
    const left = rand() < 0.5;
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) grid[top ? r : rows - 1 - r][left ? c : cols - 1 - c] = '#';
  }

  const nColors = between(t.colors);
  const colors = [...PALETTE].sort(() => rand() - 0.5).slice(0, nColors);

  // doors: one per color, on distinct edge spans
  const gates: GateDef[] = [];
  const taken = new Set<string>();
  for (const color of colors) {
    let placed = false;
    for (let tries = 0; tries < 40 && !placed; tries++) {
      const side = pick<Side>(['top', 'bottom', 'left', 'right']);
      const horizontal = side === 'left' || side === 'right';
      const span = horizontal ? rows : cols;
      const len = Math.min(between(t.gateLen), span);
      const at = Math.floor(rand() * (span - len + 1));
      const keys = Array.from({ length: len }, (_, i) => `${side}:${at + i}`);
      if (keys.some((k) => taken.has(k))) continue;
      const g: GateDef = { side, at, len, color };
      const lvl = fromSpec({ map: grid.map((r) => r.join('')), colors: {}, gates: [g] }, 0);
      if (validate(lvl).some((e) => e.includes('uneven') || e.includes('range'))) continue;
      keys.forEach((k) => taken.add(k));
      gates.push(g);
      placed = true;
    }
    if (!placed) return null;
  }
  // ice locks on some doors (never all of them)
  const lockCount = Math.min(t.locks, Math.floor(rand() * (t.locks + 1)), gates.length - 1);
  [...gates].sort(() => rand() - 0.5).slice(0, lockCount).forEach((g) => (g.lock = 1 + Math.floor(rand() * 3)));

  // bricks
  const playable = grid.flat().filter((x) => x === '.').length;
  const target = Math.round(playable * (t.fill[0] + rand() * (t.fill[1] - t.fill[0])));
  const colorsOf: Record<string, Color> = {};
  let filled = 0;
  let li = 0;
  for (let attempt = 0; attempt < 400 && filled < target && li < LETTERS.length; attempt++) {
    const shape = S[pick(t.shapes)];
    const h = Math.max(...shape.map((s) => s[0])) + 1;
    const w = Math.max(...shape.map((s) => s[1])) + 1;
    const fits = gates.filter((g) => (g.side === 'left' || g.side === 'right' ? h : w) <= g.len);
    if (!fits.length) continue;
    const r0 = Math.floor(rand() * (rows - h + 1));
    const c0 = Math.floor(rand() * (cols - w + 1));
    if (shape.some(([dr, dc]) => grid[r0 + dr][c0 + dc] !== '.')) continue;
    const ch = LETTERS[li++];
    shape.forEach(([dr, dc]) => (grid[r0 + dr][c0 + dc] = ch));
    colorsOf[ch] = pick(fits).color;
    filled += shape.length;
  }
  // drop bricks that could already leave without moving (repeat: removing one can free another's path)
  for (let changed = true; changed; ) {
    changed = false;
    const lvl = fromSpec({ map: grid.map((r) => r.join('')), colors: colorsOf, gates }, 0);
    const st = initialState(lvl);
    const occ = occupancy(lvl, st);
    const letterAt = (r: number, c: number) => grid[r][c];
    for (let i = 0; i < lvl.blocks.length; i++) {
      const b = lvl.blocks[i];
      if (exitGate(lvl, occ, st, i, b.r, b.c) < 0) continue;
      const ch = letterAt(b.r + b.cells[0][0], b.c + b.cells[0][1]);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (grid[r][c] === ch) grid[r][c] = '.';
      delete colorsOf[ch];
      changed = true;
      break;
    }
  }
  const used = new Set(Object.values(colorsOf));
  const finalGates = gates.filter((g) => used.has(g.color));
  if (finalGates.length < Math.min(2, nColors)) return null;

  const frozen: Record<string, number> = {};
  const letters = Object.keys(colorsOf);
  const frozenCount = Math.min(t.frozen, Math.floor(rand() * (t.frozen + 1)));
  [...letters].sort(() => rand() - 0.5).slice(0, frozenCount).forEach((ch) => (frozen[ch] = 1 + Math.floor(rand() * 3)));

  return { map: grid.map((r) => r.join('')), colors: colorsOf, gates: finalGates, ...(frozenCount ? { frozen } : {}) };
}

export function solveSpec(spec: LevelSpec, limit: number) {
  const lvl = fromSpec(spec, 0);
  if (validate(lvl).length) return null;
  const sol = solve(lvl, { pos: lvl.blocks.map((b) => [b.r, b.c]), exited: 0 }, limit);
  return sol ? { par: sol.moves.length, bricks: lvl.blocks.length, explored: sol.explored } : null;
}

interface Picked {
  spec: LevelSpec;
  par: number;
  score: number;
}

/** Build one tier's levels. Seeded per tier so tiers can run in parallel and stay reproducible. */
function runTier(ti: number): Picked[] {
  const tier = TIERS[ti];
  const rand = rng(20261103 + ti * 7919);
  const pool: Picked[] = [];
  let tries = 0;
  while (pool.length < tier.count * 3 && tries < 5000) {
    tries++;
    const spec = generate(tier, rand);
    if (!spec) continue;
    const s = solveSpec(spec, 100_000);
    if (!s) continue;
    const extra = s.par - s.bricks;
    if (s.par < tier.par[0] || s.par > tier.par[1] || extra < tier.extra) continue;
    // reward planning (extra moves) and a bigger search space, i.e. more ways to go wrong
    pool.push({ spec, par: s.par, score: extra * 3 + Math.log2(s.explored + 1) });
  }
  if (pool.length < tier.count) throw new Error(`Tier ${ti + 1}: only ${pool.length} levels after ${tries} tries`);
  // spread across the tier's par range: split by par into equal buckets, take the most interesting of each
  pool.sort((a, b) => a.par - b.par || a.score - b.score);
  const chosen = Array.from({ length: tier.count }, (_, k) => {
    const bucket = pool.slice(Math.floor((k * pool.length) / tier.count), Math.floor(((k + 1) * pool.length) / tier.count));
    return bucket.reduce((best, c) => (c.score > best.score ? c : best));
  });
  console.error(`tier ${ti + 1}: ${pool.length} candidates in ${tries} tries, pars ${chosen.map((c) => c.par).join(', ')}`);
  return chosen;
}

const self = fileURLToPath(import.meta.url);
const cacheDir = fileURLToPath(new URL('./.slide-cache/', import.meta.url));

async function main() {
  const tierArg = process.argv.indexOf('--tier');
  if (tierArg > 0) {
    const ti = Number(process.argv[tierArg + 1]);
    writeFileSync(`${cacheDir}tier-${ti}.json`, JSON.stringify(runTier(ti)));
    return;
  }

  mkdirSync(cacheDir, { recursive: true });
  // one child process per tier, a few at a time
  const queue = TIERS.map((_, i) => i).reverse(); // hardest first, they take longest
  const parallel = Math.max(1, Math.min(availableParallelism() - 1, TIERS.length));
  await Promise.all(
    Array.from({ length: parallel }, async () => {
      for (let ti = queue.shift(); ti !== undefined; ti = queue.shift()) {
        const code = await new Promise<number>((res) =>
          spawn(process.execPath, [...process.execArgv, self, '--tier', String(ti)], { stdio: 'inherit' }).on('exit', (c) => res(c ?? 1)),
        );
        if (code !== 0) throw new Error(`tier ${ti + 1} failed`);
      }
    }),
  );

  const out: { spec: LevelSpec; par: number }[] = [];
  for (const spec of TUTORIAL) {
    const s = solveSpec(spec, 1e6);
    if (!s) throw new Error(`Tutorial level "${spec.name}" is not solvable`);
    out.push({ spec, par: s.par });
  }
  TIERS.forEach((_, ti) => {
    // teach a mechanic right before the tier that first uses it
    if (ti === 2) out.push({ spec: ICE_DOOR, par: solveSpec(ICE_DOOR, 1e6)!.par });
    if (ti === 3) out.push({ spec: ICE_BRICK, par: solveSpec(ICE_BRICK, 1e6)!.par });
    const picked = JSON.parse(readFileSync(`${cacheDir}tier-${ti}.json`, 'utf8')) as Picked[];
    picked.forEach((p) => out.push({ spec: p.spec, par: p.par }));
  });

  const file = fileURLToPath(new URL('../src/games/slide/levels.data.ts', import.meta.url));
  writeFileSync(
    file,
    `// Generated by scripts/generate-slide-levels.ts. Do not edit by hand; run \`npm run levels:generate\`.\n` +
      `import type { LevelSpec } from './engine';\n\n` +
      `export const LEVEL_DATA: { spec: LevelSpec; par: number }[] = ${JSON.stringify(out)};\n`,
  );
  console.error(`wrote ${out.length} levels to ${file}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) void main();
