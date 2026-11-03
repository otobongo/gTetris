const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../escape-script.js', 'utf8');
module.exports = function check(levels, onlyKeys) {
  class DCLogic { constructor(p) { this.props = p; } setState(x) { this.state = Object.assign({}, this.state, x); } }
  const C = new Function('DCLogic', 'LEVELS_JSON', src + '; return Component;')(DCLogic, levels);
  const out = {};
  for (const level of onlyKeys || Object.keys(levels)) {
    const c = new C({ level });
    const defs = c.defs();
    const keys = Object.keys(defs);
    const issues = [];
    // static checks
    for (const k of keys) {
      const d = defs[k];
      if (!c.fits(k, d.at[0], d.at[1], c.state.pos, {})) issues.push(k + ' overlaps or off tray');
      c.state.gone = {};
      if (c.exitSide(k, d.at[0], d.at[1])) issues.push(k + ' can leave without moving');
      if (!c.gateList().some(g => g.color === d.color)) issues.push(k + ' has no door');
    }
    const key = st => keys.map(k => st.gone[k] ? 'x' : st.pos[k].join('.')).join('|');
    let frontier = [{ pos: Object.assign({}, c.state.pos), gone: {}, path: [] }];
    const seen = new Set([key(frontier[0])]);
    let best = null, path = null, explored = 0;
    outer: while (frontier.length) {
      const next = [];
      for (const st of frontier) {
        explored++;
        if (explored > 400000) break outer;
        for (const k of keys) {
          if (st.gone[k]) continue;
          c.state = Object.assign({}, c.state, { pos: st.pos, gone: st.gone });
          if (c.isFrozen(k, st.gone)) continue;
          const d = defs[k];
          const start = st.pos[k];
          const q = [start]; const vis = new Set([start.join(',')]);
          while (q.length) {
            const p = q.shift();
            c.state.pos = Object.assign({}, st.pos, { [k]: p });
            if (c.exitSide(k, p[0], p[1])) {
              const g = Object.assign({}, st.gone, { [k]: true });
              const ns = { pos: st.pos, gone: g, path: st.path.concat(k + '>out') };
              if (Object.keys(g).length === keys.length) { best = ns.path.length; path = ns.path; break outer; }
              const kk = key(ns); if (!seen.has(kk)) { seen.add(kk); next.push(ns); }
              continue;
            }
            for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              if ((d.axis === 'h' && dr) || (d.axis === 'v' && dc)) continue;
              const np = [p[0] + dr, p[1] + dc];
              if (vis.has(np.join(','))) continue; vis.add(np.join(','));
              if (!c.fits(k, np[0], np[1], st.pos, st.gone)) continue;
              q.push(np);
              const ns = { pos: Object.assign({}, st.pos, { [k]: np }), gone: st.gone, path: st.path.concat(k + '>' + np.join(',')) };
              const kk = key(ns); if (!seen.has(kk)) { seen.add(kk); next.push(ns); }
            }
          }
        }
      }
      frontier = next;
    }
    out[level] = { best, issues, explored, path };
  }
  return out;
};
