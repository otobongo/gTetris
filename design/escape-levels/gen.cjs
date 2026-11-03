// Packs every open square with bricks, assigns doors and locks, keeps boards the solver can finish.
const check = require('./solve.cjs');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const SIZES = { s22: [2, 2], s23: [3, 2], s32: [2, 3], s24: [4, 2], s42: [2, 4], s44: [4, 4] }; // [w,h]

function pack(N, map, sizes, rand) {
  const grid = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (map ? map[r][c] : '.') === '.' ? 0 : -1));
  const bricks = [];
  function first() { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] === 0) return [r, c]; return null; }
  function fits(r, c, w, h) { if (r + h > N || c + w > N) return false; for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) if (grid[r + i][c + j] !== 0) return false; return true; }
  function set(r, c, w, h, v) { for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) grid[r + i][c + j] = v; }
  let budget = 20000;
  function go() {
    if (--budget < 0) return false;
    const f = first(); if (!f) return true;
    const opts = sizes.map(s => SIZES[s]).sort(() => rand() - 0.5);
    for (const [w, h] of opts) {
      if (!fits(f[0], f[1], w, h)) continue;
      set(f[0], f[1], w, h, bricks.length + 1); bricks.push({ r: f[0], c: f[1], w, h });
      if (go()) return true;
      bricks.pop(); set(f[0], f[1], w, h, 0);
    }
    return false;
  }
  return go() ? bricks : null;
}

function edgeOk(N, map, side, at, len) {
  for (let i = 0; i < len; i++) {
    const [r, c] = side === 'top' ? [0, at + i] : side === 'bottom' ? [N - 1, at + i] : side === 'left' ? [at + i, 0] : [at + i, N - 1];
    if (map && map[r][c] !== '.') return false;
  }
  return true;
}

function build(opt, rand) {
  const { N, map } = opt;
  const raw = pack(N, map, opt.sizes, rand); if (!raw) return null;
  const colors = opt.colors;
  // every color used at least once
  const assign = raw.map((_, i) => colors[i % colors.length]).sort(() => rand() - 0.5);
  const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bricks = {};
  raw.forEach((b, i) => { bricks[L[i]] = { color: assign[i], w: b.w, h: b.h, at: [b.r, b.c] }; });
  // doors: one per color, wide enough for every brick of that color on that side
  const gates = []; const used = {};
  for (const color of colors) {
    const mine = Object.values(bricks).filter(b => b.color === color);
    let placed = false;
    // seed doors next to an edge brick of this color, so a packed board always has a way in
    const seeds = [];
    for (const m of mine) {
      if (m.at[0] === 0) seeds.push(['top', m.at[1]]);
      if (m.at[0] + m.h === N) seeds.push(['bottom', m.at[1]]);
      if (m.at[1] === 0) seeds.push(['left', m.at[0]]);
      if (m.at[1] + m.w === N) seeds.push(['right', m.at[0]]);
    }
    for (let t = 0; t < 60 && !placed; t++) {
      const seed = opt.seedDoors && seeds.length && t < 40 ? seeds[Math.floor(rand() * seeds.length)] : null;
      const side = seed ? seed[0] : ['top', 'bottom', 'left', 'right'][Math.floor(rand() * 4)];
      const horiz = side === 'left' || side === 'right';
      const need = Math.max(...mine.map(b => horiz ? b.h : b.w));
      const len = need + (rand() < 0.3 && need < N ? 1 : 0);
      if (len > N) continue;
      const at = seed ? Math.max(0, Math.min(N - len, seed[1] - Math.floor(rand() * (len - need + 1)))) : Math.floor(rand() * (N - len + 1));
      if (!edgeOk(N, map, side, at, len)) continue;
      // doors keep at least one free square between them, and never meet at a corner
      let clash = false; for (let i = -1; i <= len; i++) if (used[side + (at + i)]) clash = true;
      const end = at + len - 1;
      const corner = (s2, pos) => used[s2 + pos] || used[s2 + (pos === 0 ? 1 : pos - 1)];
      if (horiz) { if ((at <= 1 && corner('top', side === 'left' ? 0 : N - 1)) || (end >= N - 2 && corner('bottom', side === 'left' ? 0 : N - 1))) clash = true; }
      else { if ((at <= 1 && corner('left', side === 'top' ? 0 : N - 1)) || (end >= N - 2 && corner('right', side === 'top' ? 0 : N - 1))) clash = true; }
      if (clash) continue;
      for (let i = 0; i < len; i++) used[side + (at + i)] = 1;
      gates.push({ color, side, at, len }); placed = true;
    }
    if (!placed) return null;
  }
  // locks
  const shuffled = gates.slice().sort(() => rand() - 0.5);
  let gi = 0;
  for (let i = 0; i < (opt.countLocks || 0); i++) { const g = shuffled[gi++]; if (g) g.lockCount = 1 + Math.floor(rand() * (opt.maxCount || 3)); }
  // color chain: door X waits for color Y, then door Z waits for color X (one at a time)
  if (opt.colorChain) {
    let prev = shuffled[gi++] && shuffled[gi - 1].color;
    for (let i = 0; i < opt.colorChain; i++) { const g = shuffled[gi++]; if (!g || !prev) break; g.lockColor = prev; prev = g.color; }
  }
  const keys = Object.keys(bricks).sort(() => rand() - 0.5);
  for (let i = 0; i < (opt.frozen || 0); i++) bricks[keys[i]].frozen = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < (opt.axis || 0); i++) { const b = bricks[keys[keys.length - 1 - i]]; if (!b.frozen) b.axis = rand() < 0.5 ? 'h' : 'v'; }
  return { N, map, bricks, gates };
}

module.exports = function generate(name, opt, seed, tries, range) {
  const rand = rng(seed);
  let best = null;
  const deadline = Date.now() + (opt.seconds || 240) * 1000;
  for (let t = 0; t < tries && Date.now() < deadline; t++) {
    const lv = build(opt, rand); if (!lv) continue;
    const full = Object.assign({ title: opt.title, sub: opt.sub, base: opt.base, next: opt.next || null, tip: opt.tip }, lv);
    const res = check({ [name]: full })[name];
    if (res.best === null || res.issues.some(i => !i.includes('without moving'))) continue;
    const nb = Object.keys(lv.bricks).length;
    if (res.best < range[0] || res.best > range[1]) continue;
    const score = (res.best - nb) * 3 + Math.log2(res.explored + 1);
    const sc = opt.prefer === 'easy' ? -score : score;
    if (!best || sc > best.sc) { best = { score, sc, level: full, res }; }
  }
  if (!best) return null;
  const order = []; for (const step of best.res.path) { const k = step.split('>')[0]; if (!order.includes(k)) order.push(k); }
  best.level.best = best.res.best; best.level.order = order;
  return best;
};
