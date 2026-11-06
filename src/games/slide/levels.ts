import { type Level, fromSpec } from './engine';
import { LEVEL_DATA } from './levels.data';
import { meta } from './meta';

export const LEVELS: Level[] = LEVEL_DATA.map((d, i) => ({ ...fromSpec(d.spec, i + 1, d.par), order: d.order }));

/** Chapters shown on the level select, as 0-based [from, to) ranges. The names live in meta.ts. */
export const CHAPTERS = meta.chapters.map((c) => ({ title: c.title, note: c.note, from: c.start, to: c.start + c.count, more: Boolean(c.more) }));
