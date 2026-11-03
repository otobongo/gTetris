const generate = require('./gen.cjs');
const fs = require('fs');
const specs = {
  '1': [{ title: 'Level 1', corners: true, sub: 'Two colors', N: 4, base: 30, next: '5', colors: ['white', 'black'], sizes: ['s22'], prefer: 'easy' }, [4, 6]],
  '5': [{ title: 'Level 5', corners: true, sub: 'Three colors, one icy door', N: 6, base: 45, next: '9', colors: ['black', 'white', 'red'], sizes: ['s22', 's23', 's32', 's24', 's42'], countLocks: 1, maxCount: 2 }, [6, 10]],
  '9': [{ title: 'Level 9', sub: 'Color locks, one at a time', N: 8, base: 60, colors: ['white', 'black', 'blue', 'yellow', 'green', 'red'], colorChain: 2, seedDoors: true, seconds: 240,
    fixed: {
      A: { color: 'white', w: 4, h: 2, at: [0, 0] }, B: { color: 'black', w: 4, h: 2, at: [0, 4] },
      H: { color: 'blue', w: 3, h: 2, at: [2, 0] }, I: { color: 'blue', w: 3, h: 2, at: [2, 3] }, C: { color: 'white', w: 2, h: 2, at: [2, 6] },
      D: { color: 'yellow', w: 2, h: 4, at: [4, 0] }, E: { color: 'green', w: 2, h: 2, at: [4, 2] }, F: { color: 'black', w: 2, h: 2, at: [6, 2] },
      G: { color: 'red', w: 4, h: 4, at: [4, 4] }
    } }, [9, 24]],
  ice: [{ title: 'Frozen doors', corners: true, sub: 'Ice hides the door color', N: 6, base: 45, colors: ['yellow', 'white', 'black'], sizes: ['s22', 's23', 's32', 's24', 's42'], countLocks: 2, maxCount: 3, tip: 'Icy doors melt as bricks leave. The color only shows once it melts!' }, [7, 12]],
  walls: [{ title: 'Stone blocks', corners: true, sub: 'A shaped tray with stones', N: 8, base: 60, map: ['...##...', '...##...', '...XX...', '...XX...', '........', '........', '...##...', '...##...'], colors: ['pink', 'blue', 'green', 'white'], sizes: ['s22', 's23', 's32'], tip: 'Grey stones never move. Find a way around them.' }, [9, 18]],
  frozen: [{ title: 'Frozen bricks', corners: true, sub: 'Melt them by clearing others', N: 6, base: 45, colors: ['black', 'white', 'yellow', 'teal'], sizes: ['s22', 's23', 's32', 's24', 's42'], frozen: 2, tip: 'A frozen brick cannot move until its number reaches 0.' }, [7, 12]],
  arrows: [{ title: 'One-way bricks', corners: true, sub: 'Some bricks slide one way only', N: 6, base: 45, colors: ['red', 'yellow', 'blue', 'white'], sizes: ['s22', 's23', 's32', 's24', 's42'], axis: 2, tip: 'Bricks with arrows only slide the way the arrows point.' }, [6, 14]],
  master: [{ title: 'Master mix', sub: 'Everything at once', N: 8, base: 75, map: ['........', '........', '........', '...XX...', '...XX...', '........', '........', '##....##'], colors: ['red', 'blue', 'green', 'white', 'black'], sizes: ['s22', 's23', 's32'], countLocks: 1, colorChain: 1, frozen: 1, axis: 2, seedDoors: true, seconds: 300, tip: 'Stones, ice, frozen and one-way bricks together. Plan before you drag!' }, [10, 26]]
};
const only = process.argv.slice(2);
const file = only.length === 1 ? 'out-' + only[0] + '.json' : 'out.json';
const out = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
for (const [name, [opt, range]] of Object.entries(specs)) {
  if (only.length && !only.includes(name)) continue;
  const t = Date.now();
  const r = generate(name, opt, 1234 + name.length * 97, 100000, range);
  console.log(name, r ? 'best ' + r.level.best + ' bricks ' + Object.keys(r.level.bricks).length + ' score ' + r.score.toFixed(1) : 'NONE', ((Date.now() - t) / 1000).toFixed(1) + 's');
  if (r) out[name] = r.level;
  fs.writeFileSync(file, JSON.stringify(out));
}
