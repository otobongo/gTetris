const fs = require('fs');
const P = '/tmp/claude-0/-home-user-gTetris/7acaf150-388d-5501-9149-9bc7f14f8954/scratchpad/canvas/project/';
const levels = {};
for (const f of fs.readdirSync('.').filter(f => /^out.*\.json$/.test(f))) Object.assign(levels, JSON.parse(fs.readFileSync(f, 'utf8')));
const want = ['1', '5', '9', 'ice', 'walls', 'frozen', 'arrows', 'master'];
const missing = want.filter(k => !levels[k]);
if (missing.length) { console.log('missing', missing); process.exit(1); }
// re-verify every level with the solver before shipping
const res = require('./solve.cjs')(levels, want);
for (const k of want) { if (res[k].best !== levels[k].best) { console.log('mismatch', k, res[k].best, levels[k].best); process.exit(1); } }
const ordered = {}; want.forEach(k => { ordered[k] = levels[k]; });
let script = fs.readFileSync('../escape-script.js', 'utf8').replace('return LEVELS_JSON;', 'return ' + JSON.stringify(ordered) + ';');
let html = fs.readFileSync(P + 'Escape.dc.html', 'utf8');
const i = html.indexOf('<script type="text/x-dc" data-dc-script');
html = html.slice(0, i) + `<script type="text/x-dc" data-dc-script data-props='{"device":{"editor":"enum","options":["phone","tablet"],"default":"phone"},"level":{"editor":"enum","options":${JSON.stringify(want)},"default":"1"},"$preview":{"width":390,"height":844}}'>\n` + script + '</script>\n</body>\n</html>\n';
fs.writeFileSync(P + 'Escape.dc.html', html);
for (const k of want) console.log(k, levels[k].title, 'best', levels[k].best, 'bricks', Object.keys(levels[k].bricks).length, 'doors', levels[k].gates.map(g => g.side + g.at + (g.lockCount ? ' ice' + g.lockCount : '') + (g.lockColor ? ' ice:' + g.lockColor : '')).join(','));
