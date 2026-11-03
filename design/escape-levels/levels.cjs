const b = (color, w, h, r, c, extra) => Object.assign({ color, w, h, at: [r, c] }, extra || {});
module.exports = {
  '1': { title: 'Level 1', sub: 'Two colors', N: 4, base: 30, next: '5',
    bricks: { A: b('white', 2, 2, 0, 0), C: b('black', 2, 2, 0, 2), B: b('white', 2, 2, 2, 2) },
    gates: [{ color: 'white', side: 'bottom', at: 0, len: 2 }, { color: 'black', side: 'left', at: 2, len: 2 }] },
  '5': { title: 'Level 5', sub: 'Three colors, one icy door', N: 6, base: 40, next: '9',
    bricks: { A: b('black', 2, 2, 0, 0), B: b('white', 3, 2, 0, 2), C: b('red', 2, 2, 2, 0), D: b('black', 2, 2, 2, 4), E: b('white', 2, 2, 4, 2) },
    gates: [{ color: 'black', side: 'right', at: 2, len: 2 }, { color: 'red', side: 'bottom', at: 0, len: 2 }, { color: 'white', side: 'top', at: 3, len: 3, lockCount: 2 }] },
  '9': { title: 'Level 9', sub: 'Color locks, one at a time', N: 8, base: 60, next: null,
    bricks: { A: b('purple', 4, 2, 0, 0), B: b('orange', 3, 2, 0, 4), C: b('white', 2, 2, 2, 6), D: b('yellow', 2, 4, 4, 0), E: b('green', 2, 2, 4, 2), F: b('black', 2, 2, 6, 2), G: b('red', 4, 4, 4, 4) },
    gates: [{ color: 'orange', side: 'right', at: 0, len: 2 }, { color: 'purple', side: 'right', at: 2, len: 2 }, { color: 'yellow', side: 'top', at: 0, len: 2, lockColor: 'green' }, { color: 'green', side: 'top', at: 2, len: 2 }, { color: 'black', side: 'top', at: 4, len: 2 }, { color: 'white', side: 'top', at: 6, len: 2 }, { color: 'red', side: 'left', at: 4, len: 4, lockColor: 'yellow' }] },

  ice: { title: 'Frozen doors', sub: 'Ice hides the door color', N: 6, base: 45, next: null, tip: 'Icy doors melt as bricks leave. You only see the color once it melts!',
    bricks: { A: b('yellow', 2, 2, 0, 0), B: b('white', 2, 2, 0, 2), C: b('black', 2, 2, 0, 4), D: b('white', 2, 2, 2, 0), E: b('black', 4, 2, 2, 2), F: b('yellow', 2, 2, 4, 4) },
    gates: [{ color: 'yellow', side: 'bottom', at: 0, len: 2 }, { color: 'white', side: 'right', at: 4, len: 2, lockCount: 2 }, { color: 'black', side: 'top', at: 0, len: 4, lockCount: 3 }] },
  walls: { title: 'Stone blocks', sub: 'A shaped tray with walls', N: 6, base: 45, next: null, tip: 'Grey stones never move. Find a way around them.',
    map: ['..##..', '......', '...X..', '......', '......', '..##..'],
    bricks: { A: b('pink', 2, 2, 0, 0), B: b('blue', 2, 2, 0, 4), C: b('green', 2, 2, 4, 0), D: b('red', 2, 2, 4, 4), F: b('white', 2, 2, 2, 0), E: b('orange', 2, 2, 2, 4) },
    gates: [{ color: 'pink', side: 'bottom', at: 4, len: 2 }, { color: 'blue', side: 'bottom', at: 0, len: 2 }, { color: 'green', side: 'top', at: 0, len: 2 }, { color: 'red', side: 'top', at: 4, len: 2 }, { color: 'white', side: 'right', at: 2, len: 2 }, { color: 'orange', side: 'left', at: 2, len: 2 }] },
  frozen: { title: 'Frozen bricks', sub: 'Melt them by clearing others', N: 6, base: 45, next: null, tip: 'A frozen brick cannot move until its number reaches 0.',
    bricks: { A: b('black', 2, 2, 0, 0, { frozen: 2 }), B: b('white', 4, 2, 2, 0), C: b('black', 2, 2, 4, 4), D: b('white', 2, 2, 0, 4), E: b('yellow', 2, 2, 4, 0) },
    gates: [{ color: 'black', side: 'right', at: 0, len: 2 }, { color: 'white', side: 'top', at: 2, len: 4 }, { color: 'yellow', side: 'bottom', at: 2, len: 2 }] },
  arrows: { title: 'One-way bricks', sub: 'Some bricks slide one way only', N: 6, base: 45, next: null, tip: 'Bricks with arrows only slide the way the arrows point.',
    bricks: { A: b('red', 2, 2, 0, 0, { axis: 'h' }), D: b('yellow', 2, 2, 0, 4), B: b('blue', 2, 2, 2, 2, { axis: 'v' }), C: b('green', 3, 2, 4, 0, { axis: 'h' }), E: b('pink', 2, 2, 4, 4, { axis: 'v' }) },
    gates: [{ color: 'red', side: 'right', at: 0, len: 2 }, { color: 'yellow', side: 'left', at: 0, len: 2 }, { color: 'pink', side: 'top', at: 4, len: 2 }, { color: 'green', side: 'right', at: 4, len: 2 }, { color: 'blue', side: 'bottom', at: 2, len: 2 }] }
};
