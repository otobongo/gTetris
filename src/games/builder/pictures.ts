/**
 * Picture Builder's 42 hand-drawn pictures (six-games brief 4.6, user decision 5 A): 7 sets of 6, one set per
 * copy level, and the memory levels reuse their copy level's set in a new order (puzzles.ts).
 *
 * Each picture is a string in the board's format (design/canvas/Builder.dc.html): rows top to bottom joined by
 * '/', one letter per square, '.' for a square that stays empty. The letters are the board's 6 colours:
 * R red, Y yellow, G green, B blue, O orange, W white. The board's house is `.RR./RRRR/YYBY/YYBY`; its tree, house
 * and boat open sets C, D and E as drawn there.
 *
 * Every picture meets its set's grid, colour count and filled-square range (SET_RULES). A program can check
 * those; only a person can say a picture looks like a fish, so the canvas contact sheet `BuilderPictures` is
 * drawn from this file for review. Pure data: no React and no DOM.
 */

/** The board's 6 colours, in palette order (7.8): red, yellow, green, blue / orange, white. */
export const BUILDER_COLORS = ['red', 'yellow', 'green', 'blue', 'orange', 'white'] as const;
export type BuilderColor = (typeof BUILDER_COLORS)[number];

/** The letter each colour has in a picture string. */
export const COLOR_LETTERS: Readonly<Record<string, BuilderColor>> = {
  R: 'red',
  Y: 'yellow',
  G: 'green',
  B: 'blue',
  O: 'orange',
  W: 'white',
};

/** The letter for a square that stays empty. */
export const EMPTY_LETTER = '.';

export const PICTURE_SETS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type PictureSet = (typeof PICTURE_SETS)[number];

export interface SetRule {
  /** Squares per side: 3x3, 4x4 or 5x5. */
  size: 3 | 4 | 5;
  /** Different colours in every picture of the set, exactly. */
  colors: 2 | 3 | 4;
  /** Filled squares, inclusive. Starting values (4.6); those of sets C to E bracket the board's tree, house and boat. */
  fill: { min: number; max: number };
  /** The levels that show this set, as level numbers (Level 1 is 1): its copy level, then its memory level. */
  levels: readonly number[];
}

/** One row per set: the 4.6 level table seen from the pictures' side. */
export const SET_RULES: Readonly<Record<PictureSet, SetRule>> = {
  A: { size: 3, colors: 2, fill: { min: 5, max: 7 }, levels: [1, 6] },
  B: { size: 3, colors: 3, fill: { min: 6, max: 8 }, levels: [2, 7] },
  C: { size: 4, colors: 2, fill: { min: 9, max: 11 }, levels: [3] },
  D: { size: 4, colors: 3, fill: { min: 12, max: 15 }, levels: [4, 8] },
  E: { size: 4, colors: 4, fill: { min: 10, max: 13 }, levels: [5, 9] },
  F: { size: 5, colors: 3, fill: { min: 15, max: 20 }, levels: [10] },
  G: { size: 5, colors: 4, fill: { min: 15, max: 20 }, levels: [11, 12] },
};

/** Pictures per set: one for each puzzle of a level. */
export const PICTURES_PER_SET = 6;

/** A name is 12 characters or fewer, letters and spaces only (4.6). */
export const NAME_MAX_CHARS = 12;

export interface Picture {
  /** Stable id: the set letter and the name, `c-tree`. */
  id: string;
  /** What the child builds, lower case as it sits inside a sentence: "You built the tree." */
  name: string;
  set: PictureSet;
  /** The board's format: rows joined by '/', R Y G B O W for bricks and '.' for an empty square. */
  art: string;
  /** The levels that show it, as level numbers (Level 1 is 1). */
  levels: readonly number[];
}

/** The pictures as drawn, set by set, in puzzle order: the first of a set is puzzle 1 of its copy level. */
const DRAWN: Readonly<Record<PictureSet, readonly (readonly [name: string, art: string])[]>> = {
  // Set A: 3x3, 2 colours, 5 to 7 bricks.
  A: [
    ['mushroom', 'RWR/RRR/.W.'],
    ['flower', '.R./RYR/.R.'],
    ['apple', '.G./RRR/RRR'],
    ['tulip', 'Y.Y/YYY/.G.'],
    ['carrot', 'G.G/OOO/.O.'],
    ['sailboat', '.W./WW./OOO'],
  ],
  // Set B: 3x3, 3 colours, 6 to 8 bricks.
  B: [
    ['cake', 'R.R/WWW/YYY'],
    ['daisy', '.W./WYW/GG.'],
    ['ice cream', 'RRR/WWW/.O.'],
    ['strawberry', 'GGG/RWR/.R.'],
    ['duck', '.YO/YYY/BBB'],
    ['present', '.Y./BRB/BRB'],
  ],
  // Set C: 4x4, 2 colours, 9 to 11 bricks. Puzzle 1 is the board's tree.
  C: [
    ['tree', '.GG./GGGG/.OO./.OO.'],
    ['fish', '..../B.BW/BBBB/B.BB'],
    ['umbrella', '.RR./RRRR/..Y./.YY.'],
    ['hat', '.BB./.BB./.RR./BBBB'],
    ['pear', '..G./.YY./YYYY/YYYY'],
    ['watermelon', '..../RRRR/GRRG/.GG.'],
  ],
  // Set D: 4x4, 3 colours, 12 to 15 bricks. Puzzle 1 is the board's house.
  D: [
    ['house', '.RR./RRRR/YYBY/YYBY'],
    ['car', '.BB./RRRR/RRRR/W..W'],
    ['bus', 'YYYY/BYBY/YYYY/W..W'],
    ['pumpkin', '.GG./OOOO/OYYO/OOOO'],
    ['castle', 'Y..Y/YBBY/YYYY/YRRY'],
    ['cupcake', '.RR./WWWW/YYYY/.YY.'],
  ],
  // Set E: 4x4, 4 colours, 10 to 13 bricks. Puzzle 1 is the board's boat.
  E: [
    ['boat', '.R../.WW./OOOO/BBBB'],
    ['flower pot', '.RR./RYYR/.GG./.OO.'],
    ['train', 'BB.R/BBYY/YYYY/W..W'],
    ['bird', '.BWO/BBB./BBB./Y.Y.'],
    ['robot', '..Y./BBBB/BWWB/BRRB'],
    ['snowman', '.BB./.WWO/WRRW/WWWW'],
  ],
  // Set F: 5x5, 3 colours, 15 to 20 bricks. Butterfly and sunflower follow the sticker mosaics.
  F: [
    ['butterfly', 'OO.OO/OYBYO/..B../OYBYO/OO.OO'],
    ['sunflower', '.YYY./YYOYY/.YYY./GGG../..G..'],
    ['frog', '.W.W./GGGGG/GRRRG/GGGGG/G...G'],
    ['owl', 'O...O/OWOWO/OOYOO/OOOOO/.Y.Y.'],
    ['rainbow', '.RRR./RYYYR/RY.YR/RY.YR/WW.WW'],
    ['pizza', 'OOOOO/YRYYY/.YYR./.YRY./..Y..'],
  ],
  // Set G: 5x5, 4 colours, 15 to 20 bricks. The rocket follows the sticker mosaic.
  G: [
    ['rocket', '..R../.WWW./.WBW./RWWWR/.OOO.'],
    ['truck', 'YYY../YYYRB/YYYRR/YYYRR/.W..W'],
    ['burger', '.OOO./GGGGG/RRRRR/YYYY./.OOO.'],
    ['cat', 'O...O/OOOOO/OGOGO/WOROW/.OOO.'],
    ['balloon', '.RYR./RYRYR/.RYR./.W.W./.OOO.'],
    ['lighthouse', '..Y../.RRR./.WWW./.RRR./BBBBB'],
  ],
};

const idOf = (set: PictureSet, name: string) => `${set.toLowerCase()}-${name.replace(/ /g, '-')}`;

/** All 42 pictures, set A to G, each set in puzzle order. */
export const PICTURES: readonly Picture[] = PICTURE_SETS.flatMap((set) =>
  DRAWN[set].map(([name, art]) => ({ id: idOf(set, name), name, set, art, levels: SET_RULES[set].levels })),
);

/** The 6 pictures of a set, in puzzle order. */
export function picturesOf(set: PictureSet): readonly Picture[] {
  return PICTURES.filter((p) => p.set === set);
}

/** The picture with this id, or undefined. */
export const pictureById = (id: string): Picture | undefined => PICTURES.find((p) => p.id === id);

/** The rows of a picture string, top to bottom. */
export const rowsOf = (art: string): string[] => art.split('/');

/** Squares per side of a picture string (its row count). */
export const sizeOf = (art: string): number => rowsOf(art).length;

/** The squares row by row (row 1 left to right, then row 2): a colour, or null for a square that stays empty. */
export function cellsOf(art: string): (BuilderColor | null)[] {
  return rowsOf(art)
    .join('')
    .split('')
    .map((ch) => COLOR_LETTERS[ch] ?? null);
}

/** Filled squares: the picture's bricks. */
export const brickCount = (art: string): number => cellsOf(art).filter((c) => c !== null).length;

/** The different colours a picture uses, in palette order. */
export function colorsOf(art: string): BuilderColor[] {
  const used = new Set(cellsOf(art));
  return BUILDER_COLORS.filter((c) => used.has(c));
}
