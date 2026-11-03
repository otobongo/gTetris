import type { LevelSpec } from './engine';

/**
 * Hand-made teaching levels. Each one introduces exactly one idea.
 * Map legend: '#' void, '.' empty, letters = bricks (same letter = same brick).
 */
export const TUTORIAL: LevelSpec[] = [
  {
    name: 'First door',
    tip: 'Drag the brick to the door with the same color.',
    map: ['...', '.A.', '...'],
    colors: { A: 'red' },
    gates: [{ side: 'right', at: 1, len: 1, color: 'red' }],
  },
  {
    name: 'Two colors',
    tip: 'Every brick has its own door. Match the colors!',
    map: ['A..', '...', '..B'],
    colors: { A: 'yellow', B: 'blue' },
    gates: [
      { side: 'bottom', at: 0, len: 1, color: 'yellow' },
      { side: 'top', at: 2, len: 1, color: 'blue' },
    ],
  },
  {
    name: 'Make room',
    tip: 'Some bricks are in the way. Which one should move first?',
    map: ['AB.', 'AB.', '...'],
    colors: { A: 'green', B: 'red' },
    gates: [
      { side: 'right', at: 0, len: 2, color: 'green' },
      { side: 'bottom', at: 1, len: 1, color: 'red' },
    ],
  },
  {
    name: 'Wide door',
    tip: 'A brick only fits through a door that is wide enough.',
    map: ['AA..', 'AA..', 'B...', 'C...'],
    colors: { A: 'blue', B: 'yellow', C: 'yellow' },
    gates: [
      { side: 'right', at: 2, len: 2, color: 'blue' },
      { side: 'top', at: 3, len: 1, color: 'yellow' },
    ],
  },
];

/** Teaching levels for later mechanics, inserted where those mechanics first appear. */
export const ICE_DOOR: LevelSpec = {
  name: 'Ice door',
  tip: 'The number on an icy door counts down each time a brick leaves. At 0 it opens!',
  map: ['A.B.', '..C.', 'D...', '....'],
  colors: { A: 'red', B: 'green', C: 'green', D: 'purple' },
  gates: [
    { side: 'left', at: 0, len: 1, color: 'red', lock: 2 },
    { side: 'top', at: 3, len: 1, color: 'green' },
    { side: 'bottom', at: 1, len: 1, color: 'purple' },
  ],
};

export const ICE_BRICK: LevelSpec = {
  name: 'Frozen brick',
  tip: 'A frozen brick can not move until enough other bricks have left.',
  map: ['AB..', 'AB..', 'CC..', '.D..'],
  colors: { A: 'orange', B: 'teal', C: 'orange', D: 'teal' },
  frozen: { C: 2 },
  gates: [
    { side: 'right', at: 2, len: 2, color: 'orange' },
    { side: 'right', at: 0, len: 2, color: 'teal' },
  ],
};
