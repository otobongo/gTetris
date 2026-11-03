class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.state = this.fresh(this.props.level ?? '1');
    this.drag = null;
  }
  /**
   * Sample levels. map: '.' open square, '#' outside the tray, 'X' stone block.
   * Brick extras: frozen (stuck in ice until that many bricks are out), axis ('h' or 'v': slides one way only).
   * Door locks are ice that hides the door color: lockCount (opens after N bricks out) or lockColor (opens when that color is cleared).
   */
  levels() {
    return LEVELS_JSON;
  }
  lv() { return this.levels()[this.state.level]; }
  limit() { return Math.round(this.lv().base * 1.5); }
  fresh(level) {
    var all = this.levels();
    var key = all[level] ? level : '1';
    var L = all[key];
    var pos = {};
    Object.keys(L.bricks).forEach(function (k) { pos[k] = L.bricks[k].at; });
    return { level: key, pos: pos, gone: {}, exiting: null, moves: 0, history: [], hintKey: null, tLeft: Math.round(L.base * 1.5), won: false, bumped: null, note: '' };
  }
  componentDidMount() {
    var self = this;
    this.timer = setInterval(function () {
      if (self.state.won || self.state.tLeft <= 0) return;
      self.setState({ tLeft: self.state.tLeft - 1 });
    }, 1000);
  }
  componentWillUnmount() { clearInterval(this.timer); }
  defs() { return this.lv().bricks; }
  gateList() { return this.lv().gates; }
  cellAt(r, c) {
    var L = this.lv();
    if (r < 0 || c < 0 || r >= L.N || c >= L.N) return '#';
    return L.map ? L.map[r].charAt(c) : '.';
  }
  pal() {
    return {
      red: ['#f03a3a', '#ff7a6e', '#b51f27'], yellow: ['#ffc21a', '#ffe266', '#d48a00'],
      green: ['#1fb53c', '#5fe06e', '#0f7a26'], blue: ['#2f8cff', '#7cc0ff', '#1557c4'],
      purple: ['#9b4dff', '#c79bff', '#6624c9'], orange: ['#ff7a1a', '#ffab5e', '#c4500a'],
      pink: ['#ff5fb4', '#ff9fd4', '#c72f84'], teal: ['#14c8c0', '#6aeee4', '#0b8c87'],
      white: ['#f1eef7', '#ffffff', '#b9b3c9'], black: ['#3a3a46', '#5c5c6c', '#1d1d24']
    };
  }
  brick(color, stud) {
    var p = this.pal()[color];
    var studs = 'radial-gradient(circle at 46% 42%, ' + p[1] + ' 0 19%, transparent 21%), radial-gradient(circle at 50% 50%, ' + p[0] + ' 0 25%, transparent 27%), radial-gradient(circle at 54% 58%, rgba(0,0,0,0.28) 0 26%, transparent 28%), ';
    var base = 'linear-gradient(160deg, ' + p[1] + ' -30%, ' + p[0] + ' 45%, ' + p[2] + ' 140%)';
    var size = stud ? stud + 'px ' + stud + 'px, ' + stud + 'px ' + stud + 'px, ' + stud + 'px ' + stud + 'px, 100% 100%' : '100% 100%';
    return 'background: ' + (stud ? studs : '') + base + '; background-size: ' + size + '; ';
  }
  occupied(pos, gone, skip) {
    var defs = this.defs();
    var grid = {};
    Object.keys(pos).forEach(function (k) {
      if (gone[k] || k === skip) return;
      var d = defs[k];
      for (var r = 0; r < d.h; r++) for (var c = 0; c < d.w; c++) grid[(pos[k][0] + r) + ',' + (pos[k][1] + c)] = true;
    });
    return grid;
  }
  fits(k, r, c, pos, gone) {
    var d = this.defs()[k];
    var occ = this.occupied(pos, gone, k);
    for (var i = 0; i < d.h; i++) for (var j = 0; j < d.w; j++) {
      if (this.cellAt(r + i, c + j) !== '.') return false;
      if (occ[(r + i) + ',' + (c + j)]) return false;
    }
    return true;
  }
  isFrozen(k, gone) { var f = this.defs()[k].frozen || 0; return Object.keys(gone).length < f; }
  locked(g, gone) {
    var defs = this.defs();
    if (g.lockColor) return Object.keys(defs).some(function (k) { return defs[k].color === g.lockColor && !gone[k]; });
    if (g.lockCount) return Object.keys(gone).length < g.lockCount;
    return false;
  }
  exitSide(k, r, c) {
    var d = this.defs()[k];
    var N = this.lv().N;
    var gates = this.gateList();
    for (var i = 0; i < gates.length; i++) {
      var g = gates[i];
      if (g.color !== d.color || this.locked(g, this.state.gone)) continue;
      if (d.axis === 'h' && (g.side === 'top' || g.side === 'bottom')) continue;
      if (d.axis === 'v' && (g.side === 'left' || g.side === 'right')) continue;
      var acrossRows = r >= g.at && r + d.h <= g.at + g.len;
      var acrossCols = c >= g.at && c + d.w <= g.at + g.len;
      if (g.side === 'right' && acrossRows && c + d.w === N) return 'right';
      if (g.side === 'left' && acrossRows && c === 0) return 'left';
      if (g.side === 'bottom' && acrossCols && r + d.h === N) return 'bottom';
      if (g.side === 'top' && acrossCols && r === 0) return 'top';
    }
    return null;
  }
  leave(k, side) {
    var self = this;
    this.setState({ exiting: { k: k, side: side } });
    setTimeout(function () {
      var gone = Object.assign({}, self.state.gone);
      gone[k] = true;
      var won = Object.keys(gone).length === Object.keys(self.defs()).length;
      self.setState({ gone: gone, exiting: null, won: won });
    }, 320);
  }
  begin(before) {
    var s = this.state;
    this.setState({ history: s.history.concat([before]), moves: before.moves + 1, hintKey: null, note: '' });
  }
  step(k, dr, dc) {
    var s = this.state;
    var d = this.defs()[k];
    if ((d.axis === 'h' && dr) || (d.axis === 'v' && dc)) return 'blocked';
    var p = s.pos[k];
    var here = this.exitSide(k, p[0], p[1]);
    var dirOf = { right: [0, 1], left: [0, -1], bottom: [1, 0], top: [-1, 0] };
    if (here && dirOf[here][0] === dr && dirOf[here][1] === dc) return 'exit';
    var nr = p[0] + dr, nc = p[1] + dc;
    if (!this.fits(k, nr, nc, s.pos, s.gone)) return 'blocked';
    var pos = Object.assign({}, s.pos);
    pos[k] = [nr, nc];
    this.state.pos = pos;
    this.setState({ pos: pos });
    return this.exitSide(k, nr, nc) ? 'exit' : 'moved';
  }
  bump(k, note) {
    var self = this;
    this.setState({ bumped: k, note: note });
    setTimeout(function () { self.setState({ bumped: null }); }, 350);
  }
  renderVals() {
    var self = this;
    var s = this.state;
    var tablet = this.props.device === 'tablet';
    var L = this.lv();
    var N = L.N;
    var cell = Math.floor(304 / N), pad = 22, grid = cell * N;
    var defs = this.defs();
    var limit = this.limit();
    var outCount = Object.keys(s.gone).length;
    var mm = Math.floor(Math.max(0, s.tLeft) / 60), ss = Math.max(0, s.tLeft) % 60;
    var arrows = { right: 'M9 6l6 6-6 6', left: 'M15 6l-6 6 6 6', bottom: 'M6 9l6 6 6-6', top: 'M6 15l6-6 6 6' };
    var p = this.pal();
    var starsWon = s.moves <= L.best ? 3 : s.moves <= L.best + 3 ? 2 : 1;
    var inTime = s.tLeft > 0;
    var lockMsg = '';
    var gl = this.gateList();
    for (var gi = 0; gi < gl.length && !lockMsg; gi++) {
      var gx = gl[gi];
      if (!this.locked(gx, s.gone)) continue;
      lockMsg = gx.lockColor
        ? 'An icy door melts when every ' + gx.lockColor + ' brick is out.'
        : 'An icy door melts after ' + (gx.lockCount - outCount) + ' more brick' + (gx.lockCount - outCount === 1 ? '' : 's') + ' leave.';
    }
    var frames = [], wells = [], walls = [];
    var open = function (r, c) { return self.cellAt(r, c) === '#'; };
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var t = this.cellAt(r, c);
      if (t === '#') continue;
      var rad = function (dr, dc) { return open(r + dr, c) && open(r, c + dc) && open(r + dr, c + dc) ? pad : 0; };
      frames.push({ style: 'left: ' + (c * cell - pad) + 'px; top: ' + (r * cell - pad) + 'px; width: ' + (cell + 2 * pad) + 'px; height: ' + (cell + 2 * pad) + 'px; border-radius: ' + rad(-1, -1) + 'px ' + rad(-1, 1) + 'px ' + rad(1, 1) + 'px ' + rad(1, -1) + 'px;' + (open(r + 1, c) ? ' box-shadow: 0 8px 0 #241a63;' : '') });
      var box = 'left: ' + (c * cell) + 'px; top: ' + (r * cell) + 'px; width: ' + cell + 'px; height: ' + cell + 'px;';
      wells.push({ style: box });
      if (t === 'X') walls.push({ style: 'left: ' + (c * cell + 2) + 'px; top: ' + (r * cell + 2) + 'px; width: ' + (cell - 4) + 'px; height: ' + (cell - 4) + 'px;' });
    }
    var help = s.tLeft <= 0 && !s.won ? "Time's up! Keep going, you can still finish." : s.note ? s.note : s.hintKey ? 'Try the glowing brick first.' : lockMsg || L.tip || 'Drag each brick to the door of its color.';
    return {
      W: tablet ? 834 : 390, H: tablet ? 1194 : 844, Z: tablet ? 1.4 : 1, IW: tablet ? 596 : 390, IH: tablet ? 853 : 844,
      hubHref: tablet ? 'HubTablet.dc.html' : 'Hub.dc.html',
      cell: cell, pad: pad, gridPx: grid, boardPx: grid + pad * 2,
      clock: mm + ':' + (ss < 10 ? '0' : '') + ss,
      timePct: Math.round((Math.max(0, s.tLeft) / limit) * 100),
      timerColor: s.tLeft > limit * 0.33 ? '#5fe06e' : s.tLeft > 0 ? '#ffc21a' : '#ff9fd4',
      moves: s.moves,
      frames: frames, wells: wells, walls: walls,
      gates: this.gateList().map(function (g) {
        var span = g.len * cell - 8;
        var st = g.side === 'right'
          ? 'left: ' + (grid + 2) + 'px; top: ' + (g.at * cell + 4) + 'px; width: ' + (pad - 4) + 'px; height: ' + span + 'px;'
          : g.side === 'left'
            ? 'left: ' + (-pad + 2) + 'px; top: ' + (g.at * cell + 4) + 'px; width: ' + (pad - 4) + 'px; height: ' + span + 'px;'
            : g.side === 'bottom'
              ? 'left: ' + (g.at * cell + 4) + 'px; top: ' + (grid + 2) + 'px; width: ' + span + 'px; height: ' + (pad - 4) + 'px;'
              : 'left: ' + (g.at * cell + 4) + 'px; top: ' + (-pad + 2) + 'px; width: ' + span + 'px; height: ' + (pad - 4) + 'px;';
        var lk = self.locked(g, s.gone);
        var ice = 'background: linear-gradient(160deg, #f2fbff, #bfe6f8 55%, #8ccbea); box-shadow: inset 0 2px 0 #ffffff, inset 0 -3px 0 rgba(30,90,140,0.25), 0 0 0 2px rgba(255,255,255,0.35);';
        return {
          label: lk ? 'Frozen door' + (g.lockColor ? ', melts when every ' + g.lockColor + ' brick is out' : ', melts after ' + (g.lockCount - outCount) + ' more bricks leave') : g.color + ' door',
          arrow: arrows[g.side], arrowColor: g.color === 'white' ? '#6b6585' : '#ffffff', open: !lk, locked: lk,
          needColor: !!g.lockColor, need: g.lockColor ? p[g.lockColor][0] : '',
          count: g.lockCount ? String(g.lockCount - outCount) : '',
          dir: g.side === 'left' || g.side === 'right' ? 'flex-direction: column;' : '',
          style: st + ' ' + (lk ? ice : self.brick(g.color, 0))
        };
      }),
      bricks: Object.keys(defs).filter(function (k) { return !s.gone[k]; }).map(function (k) {
        var d = defs[k];
        var pos = s.pos[k];
        var x = pos[1] * cell + 2, y = pos[0] * cell + 2;
        var ex = s.exiting && s.exiting.k === k ? s.exiting.side : null;
        if (ex === 'right') x += (d.w + 0.6) * cell;
        if (ex === 'left') x -= (d.w + 0.6) * cell;
        if (ex === 'bottom') y += (d.h + 0.6) * cell;
        if (ex === 'top') y -= (d.h + 0.6) * cell;
        if (s.bumped === k) x += 5;
        var frozen = self.isFrozen(k, s.gone);
        var glow = s.hintKey === k ? ' box-shadow: 0 0 0 4px #ffffff, 0 0 22px #ffffff;' : ' box-shadow: inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -4px 0 rgba(0,0,0,0.22), 0 3px 0 rgba(0,0,0,0.25);';
        return {
          label: d.color + ' brick' + (frozen ? ', frozen until ' + (d.frozen - outCount) + ' more bricks leave' : '') + (d.axis ? (d.axis === 'h' ? ', slides left and right only' : ', slides up and down only') : ''),
          isFrozen: frozen, frozenLeft: frozen ? String(d.frozen - outCount) : '',
          hasAxis: !!d.axis && !frozen, axisDeg: d.axis === 'v' ? 90 : 0,
          style: 'width: ' + (d.w * cell - 4) + 'px; height: ' + (d.h * cell - 4) + 'px; transform: translate(' + x + 'px, ' + y + 'px); opacity: ' + (ex ? 0 : 1) + '; ' + self.brick(d.color, cell) + 'background-position: -2px -2px;' + glow + (frozen ? ' cursor: not-allowed;' : ''),
          down: function (e) {
            if (s.won || s.exiting) return;
            if (self.isFrozen(k, self.state.gone)) { self.bump(k, 'That brick is frozen. Get ' + (d.frozen - Object.keys(self.state.gone).length) + ' more bricks out to melt it.'); return; }
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
            var rect = e.currentTarget.getBoundingClientRect();
            self.drag = { k: k, id: e.pointerId, x0: e.clientX, y0: e.clientY, start: self.state.pos[k], before: { pos: self.state.pos, gone: self.state.gone, moves: self.state.moves }, unit: rect.width / (d.w - 4 / cell), moved: false };
          },
          move: function (e) {
            var dg = self.drag;
            if (!dg || dg.id !== e.pointerId) return;
            var tr = dg.start[0] + Math.round((e.clientY - dg.y0) / dg.unit);
            var tc = dg.start[1] + Math.round((e.clientX - dg.x0) / dg.unit);
            if (d.axis === 'h') tr = self.state.pos[dg.k][0];
            if (d.axis === 'v') tc = self.state.pos[dg.k][1];
            for (var guard = 0; guard < 10; guard++) {
              var cp = self.state.pos[dg.k];
              var ry = tr - cp[0], rx = tc - cp[1];
              if (!ry && !rx) return;
              var tries = Math.abs(ry) >= Math.abs(rx) ? [[Math.sign(ry), 0], [0, Math.sign(rx)]] : [[0, Math.sign(rx)], [Math.sign(ry), 0]];
              var progressed = false;
              for (var i = 0; i < tries.length; i++) {
                if (!tries[i][0] && !tries[i][1]) continue;
                var res = self.step(dg.k, tries[i][0], tries[i][1]);
                if (res === 'blocked') continue;
                if (!dg.moved) { dg.moved = true; self.begin(dg.before); }
                if (res === 'exit') {
                  self.drag = null;
                  var np = self.state.pos[dg.k];
                  self.leave(dg.k, self.exitSide(dg.k, np[0], np[1]));
                  return;
                }
                progressed = true;
                break;
              }
              if (!progressed) return;
            }
          },
          up: function () { self.drag = null; }
        };
      }),
      help: help,
      undo: function () {
        if (!s.history.length || s.exiting) return;
        var last = s.history[s.history.length - 1];
        self.setState({ pos: last.pos, gone: last.gone, moves: last.moves, history: s.history.slice(0, -1), hintKey: null, note: '' });
      },
      hint: function () {
        var next = L.order.filter(function (k) { return !s.gone[k]; })[0];
        self.setState({ hintKey: next || null });
      },
      restart: function () { self.drag = null; self.setState(self.fresh(s.level)); },
      lvTitle: L.title, lvSub: L.sub, best: L.best,
      caption: 'Maya, age 7: ' + L.title.toLowerCase() + ' gets ' + L.base + 's x 1.5 = ' + Math.floor(limit / 60) + ':' + (limit % 60 < 10 ? '0' : '') + (limit % 60),
      nextLabel: L.next ? 'Next: ' + this.levels()[L.next].title : 'Play again',
      nextLevel: function () { self.drag = null; self.setState(self.fresh(L.next || s.level)); },
      won: s.won,
      winTitle: starsWon === 3 ? 'Brilliant!' : 'Great job!',
      stars: [0, 1, 2].map(function (i) { return { fill: i < starsWon ? '#ffb21f' : 'rgba(0,0,0,0.3)' }; }),
      winText: s.moves + ' moves' + (inTime ? ', with time to spare!' : '. Next time, try to beat the clock!')
    };
  }
}
