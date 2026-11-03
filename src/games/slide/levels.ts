import { type Level, fromSpec } from './engine';
import { LEVEL_DATA } from './levels.data';

export const LEVELS: Level[] = LEVEL_DATA.map((d: (typeof LEVEL_DATA)[number], i: number) => fromSpec(d.spec, i + 1, d.par));

/** Chapters shown on the level select, so kids can see the path ahead. */
export const CHAPTERS = [
  { title: 'Getting started', note: 'one idea at a time', from: 0, to: 8 },
  { title: 'Think first', note: 'some bricks block others', from: 8, to: 13 },
  { title: 'Icy doors', note: 'wait for the ice to melt', from: 13, to: 19 },
  { title: 'Frozen bricks', note: 'plan the order', from: 19, to: 25 },
  { title: 'Big bricks', note: 'tight squeeze', from: 25, to: 30 },
  { title: 'Master', note: 'for real brick experts', from: 30, to: Infinity },
];
