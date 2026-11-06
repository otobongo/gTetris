/**
 * Every game on Home, in the order of the Home board (design/canvas/Hub.dc.html, brief 3.6).
 * Titles, subtitles and card art come from that board. Each playable game publishes its own
 * level count and chapters in src/games/<folder>/meta.ts.
 */
import type { BrickColor } from '../shared/ui/palette';
import type { GameMeta } from './meta';
import { meta as dropMeta } from './drop/meta';
import { LEVELS as LETTERS_LEVELS } from './letters/levels';
import { meta as lettersMeta } from './letters/meta';
import { meta as escapeMeta } from './slide/meta';

export const GAME_IDS = ['escape', 'drop', 'letters', 'mixer', 'sorter', 'pattern', 'numbers', 'builder', 'math'] as const;
export type GameId = (typeof GAME_IDS)[number];

/**
 * One shape in a Home card's 56 x 44 art box, positioned in px like the board's at(x, y, w, h).
 * brick: a Brick (studs when `stud` is set, otherwise a plain face that can carry `text`).
 * disc, triangle, tile: flat shapes in a brick colour's base value (tile has `radius`).
 * glyph: text only, in the secondary text colour.
 */
export interface ArtPiece {
  kind: 'brick' | 'disc' | 'triangle' | 'tile' | 'glyph';
  x: number;
  y: number;
  w: number;
  h: number;
  color?: BrickColor;
  stud?: number;
  text?: string;
  fontSize?: number;
  radius?: number;
  /** Multiply blend, so overlapping colour discs mix (Color Mixer). */
  blend?: boolean;
}

export interface GameEntry {
  id: GameId;
  title: string;
  /** One-line subtitle on the Home card. */
  sub: string;
  /** What the game calls a level on Levels and in pills. */
  noun: 'Level' | 'Stage';
  art: ArtPiece[];
  /** False until the game exists in the app; Home can still show its card. */
  playable: boolean;
  /**
   * Where the Home card goes: the game itself, which opens the child's current level (brief 2.1).
   * Children never see a level grid; grown-ups pick levels in Settings.
   */
  route: string;
  /** The game itself, without a level (the same path as `route`). */
  playRoute: string;
  /** What one puzzle of a level is called in progress lines: 'word' on spelling levels, otherwise 'puzzle' (brief 9). */
  unit: (level: number) => 'puzzle' | 'word';
  /** Level count and chapters; null for games not built yet. */
  meta: GameMeta | null;
}

const ART_W = 56;
const ART_H = 44;
export const ART_BOX = { width: ART_W, height: ART_H };

const brick = (color: BrickColor, x: number, y: number, w: number, h: number, stud?: number, text?: string): ArtPiece => ({
  kind: 'brick', color, x, y, w, h, stud, text, fontSize: text ? 15 : undefined,
});

const puzzles = (): 'puzzle' => 'puzzle';
/** Letter Builder's spelling levels count words built; every other level counts puzzles solved. */
const lettersUnit = (level: number): 'puzzle' | 'word' => (LETTERS_LEVELS[level]?.kind === 'spell' ? 'word' : 'puzzle');

function entry(
  id: GameId,
  title: string,
  sub: string,
  art: ArtPiece[],
  meta: GameMeta | null,
  noun: 'Level' | 'Stage' = 'Level',
  unit: (level: number) => 'puzzle' | 'word' = puzzles,
): GameEntry {
  return { id, title, sub, noun, art, playable: meta !== null, route: `/game/${id}`, playRoute: `/game/${id}`, unit, meta };
}

export const GAMES: readonly GameEntry[] = [
  entry('escape', 'Brick Escape', 'Slide bricks out their doors', [
    brick('red', 0, 3, 36, 18, 9),
    brick('yellow', 38, 3, 18, 36, 9),
    brick('green', 0, 23, 18, 18, 9),
    brick('blue', 20, 23, 18, 18, 9),
  ], escapeMeta),
  entry('drop', 'Brick Drop', 'Stack falling bricks into rows', [
    brick('purple', 8, 26, 48, 16, 16),
    brick('purple', 24, 8, 16, 16, 16),
    brick('teal', 0, 8, 16, 16, 16),
  ], dropMeta, 'Stage'),
  entry('letters', 'Letter Builder', 'Alphabet, sounds and spelling', [
    brick('orange', 0, 9, 18, 26, undefined, 'A'),
    brick('pink', 19, 9, 18, 26, undefined, 'B'),
    brick('blue', 38, 9, 18, 26, undefined, 'C'),
  ], lettersMeta, 'Level', lettersUnit),
  entry('mixer', 'Color Mixer', 'Mix two colors to make a new one', [
    { kind: 'disc', color: 'yellow', x: 6, y: 7, w: 30, h: 30 },
    { kind: 'disc', color: 'blue', x: 24, y: 7, w: 30, h: 30, blend: true },
  ], null),
  entry('sorter', 'Shape Sorter', 'Match each shape to its hole', [
    { kind: 'disc', color: 'pink', x: 0, y: 16, w: 22, h: 22 },
    { kind: 'triangle', color: 'yellow', x: 18, y: 4, w: 24, h: 22 },
    { kind: 'tile', color: 'teal', x: 36, y: 20, w: 20, h: 20, radius: 4 },
  ], null),
  entry('pattern', 'Pattern Train', 'Finish the pattern on the train', [
    { kind: 'disc', color: 'red', x: 0, y: 14, w: 16, h: 16 },
    { kind: 'tile', color: 'blue', x: 20, y: 14, w: 16, h: 16, radius: 3 },
    { kind: 'disc', color: 'red', x: 40, y: 14, w: 16, h: 16 },
  ], null),
  entry('numbers', 'Number Line-up', 'Put the number towers in order', [
    brick('green', 0, 16, 18, 24, undefined, '1'),
    brick('yellow', 19, 10, 18, 30, undefined, '2'),
    brick('red', 38, 4, 18, 36, undefined, '3'),
  ], null),
  entry('builder', 'Picture Builder', 'Look, then build the picture', [
    brick('red', 14, 2, 13, 13, 13),
    brick('red', 29, 2, 13, 13, 13),
    brick('yellow', 6, 16, 13, 13, 13),
    brick('blue', 21, 16, 13, 13, 13),
    brick('yellow', 36, 16, 13, 13, 13),
    { kind: 'tile', color: 'yellow', x: 6, y: 30, w: 43, h: 12, radius: 4 },
  ], null),
  entry('math', 'Brick Calculator', 'Add and take away with bricks', [
    brick('blue', 0, 9, 17, 26, undefined, '2'),
    { kind: 'glyph', x: 17, y: 9, w: 22, h: 26, text: '+', fontSize: 20 },
    brick('orange', 39, 9, 17, 26, undefined, '3'),
  ], null),
];

export function getGame(id: string): GameEntry | undefined {
  return GAMES.find((g) => g.id === id);
}
