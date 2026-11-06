/**
 * The sticker book (design/canvas/Stickers.dc.html, brief 3.3 and decision 4): one sticker per
 * finished chapter of any game, plus one per Today's discovery. The set of 40 and the art are
 * the board's sample data until the full set is drawn: [PLACEHOLDER: total stickers].
 * Art is a 5 x 5 brick mosaic: r red, y yellow, g green, b blue, p purple, o orange, k pink,
 * t teal, '.' empty.
 */
import { GAMES, getGame, type GameId } from '../../games/registry';
import { gameOf, type Player } from '../../shared/progress';
import type { BrickColor } from '../../shared/ui';

export type StickerPage = 'games' | 'discoveries';

export interface Sticker {
  id: string;
  page: StickerPage;
  name: string;
  art: string[];
  /** Game stickers: the game and the chapter index (0-based, chapters with levels only). */
  game?: GameId;
  chapter?: number;
}

const g = (id: string, game: GameId, chapter: number, name: string, art: string[]): Sticker => ({ id, page: 'games', game, chapter, name, art });
const x = (id: string, name: string, art: string[]): Sticker => ({ id, page: 'discoveries', name, art });

export const STICKERS: readonly Sticker[] = [
  g('e1', 'escape', 0, 'Open door', ['ooo..', 'ooo..', 'ooyrr', 'ooo..', 'ooo..']),
  g('e2', 'escape', 1, 'Light bulb', ['.yyy.', 'yyyyy', '.yyy.', '.bbb.', '..b..']),
  g('e3', 'escape', 2, 'Ice key', ['.ttt.', '.t.t.', '.ttt.', '..t..', '..tt.']),
  g('e4', 'escape', 3, 'Ladder', ['g...g', 'ggggg', 'g...g', 'ggggg', 'g...g']),
  g('e5', 'escape', 4, 'Big brick', ['.....', 'rrrrr', 'rrrrr', 'rrrrr', '.....']),
  g('d1', 'drop', 0, 'Tiny tower', ['..k..', '.kkk.', '.kkk.', '.kkk.', 'kkkkk']),
  g('d2', 'drop', 1, 'Full row', ['..p..', '.ppp.', '.....', 'ttyyb', 'ttyyb']),
  g('d3', 'drop', 2, 'Rocket', ['..r..', '.bbb.', '.byb.', '.bbb.', 'o.o.o']),
  g('l1', 'letters', 0, 'Big A', ['.ooo.', 'o...o', 'ooooo', 'o...o', 'o...o']),
  g('l2', 'letters', 1, 'Little b', ['k....', 'k....', 'kkkk.', 'k..k.', 'kkkk.']),
  g('l3', 'letters', 2, 'Bell', ['..y..', '.yyy.', '.yyy.', 'yyyyy', '..o..']),
  g('l4', 'letters', 3, 'Pencil', ['.kkk.', '.yyy.', '.yyy.', '.yyy.', '..o..']),
  g('m1', 'mixer', 0, 'Paint pot', ['.rrr.', 'ttttt', '.ttt.', '.ttt.', '.ttt.']),
  g('m2', 'mixer', 1, 'Paintbrush', ['.ppp.', '.ppp.', '..o..', '..o..', '..o..']),
  g('m3', 'mixer', 2, 'Rainbow', ['rrrrr', 'ooooo', 'yy.yy', 'gg.gg', 'bb.bb']),
  g('s1', 'sorter', 0, 'Star', ['..y..', '.yyy.', 'yyyyy', '.yyy.', '.y.y.']),
  g('s2', 'sorter', 1, 'Heart', ['.k.k.', 'kkkkk', 'kkkkk', '.kkk.', '..k..']),
  g('s3', 'sorter', 2, 'Diamond', ['..t..', '.ttt.', 'ttttt', '.ttt.', '..t..']),
  g('p1', 'pattern', 0, 'Train', ['o....', 'o.bbb', 'rrbbb', 'rrrrr', '.g.g.']),
  g('p2', 'pattern', 1, 'Carriage', ['.....', 'rbrbr', 'brbrb', 'rbrbr', '.y.y.']),
  g('p3', 'pattern', 2, 'Signal', ['..r..', '..y..', '..g..', '..p..', '.ppp.']),
  g('n1', 'numbers', 0, 'Number 1', ['..g..', '.gg..', '..g..', '..g..', '.ggg.']),
  g('n2', 'numbers', 1, 'Steps', ['....b', '...yb', '..gyb', '.rgyb', 'orgyb']),
  g('b1', 'builder', 0, 'House', ['..r..', '.rrr.', 'rrrrr', 'yybyy', 'yybyy']),
  g('b2', 'builder', 1, 'Tree', ['.ggg.', 'ggggg', 'ggggg', '..o..', '..o..']),
  g('b3', 'builder', 2, 'Boat', ['..r..', '..rr.', '..o..', 'ooooo', '.bbb.']),
  g('c1', 'math', 0, 'Plus sign', ['..b..', '..b..', 'bbbbb', '..b..', '..b..']),
  g('c2', 'math', 1, 'Calculator', ['ttttt', 'tyyyt', 'ttttt', 'tbtbt', 'ttttt']),
  x('x1', 'Green drop', ['..g..', '.ggg.', 'ggggg', 'ggggg', '.ggg.']),
  x('x2', 'Sun', ['y.y.y', '.ooo.', 'yoooy', '.ooo.', 'y.y.y']),
  x('x3', 'Moon', ['.yyy.', 'yy...', 'yy...', 'yy...', '.yyy.']),
  x('x4', 'Fish', ['.....', '.oo.o', 'ooooo', '.oo.o', '.....']),
  x('x5', 'Flower', ['.kkk.', 'kkykk', '.kkk.', '..g..', '.gg..']),
  x('x6', 'Apple', ['..g..', '.rrr.', 'rrrrr', 'rrrrr', '.rrr.']),
  x('x7', 'Rain cloud', ['.....', '..bb.', '.bbbb', 'bbbbb', 'b.b.b']),
  x('x8', 'Leaf', ['...gg', '..ggg', '.ggg.', 'ggg..', 'g....']),
  x('x9', 'Butterfly', ['kk.kk', 'kkpkk', '..p..', 'kkpkk', 'kk.kk']),
  x('x10', 'Ice cream', ['.kkk.', 'kkkkk', '.ooo.', '..o..', '..o..']),
  x('x11', 'Ladybug', ['..p..', '.rpr.', 'rrprr', 'rrprr', '.rpr.']),
  x('x12', 'Mushroom', ['.rrr.', 'rrrrr', 'rrrrr', '..y..', '.yyy.']),
];

const CELL: Record<string, BrickColor> = { r: 'red', y: 'yellow', g: 'green', b: 'blue', p: 'purple', o: 'orange', k: 'pink', t: 'teal' };

/** The 25 mosaic cells, row by row: a brick colour or null for an empty cell. */
export function stickerCells(sticker: Sticker): (BrickColor | null)[] {
  return sticker.art.join('').split('').map((ch) => CELL[ch] ?? null);
}

/** Chapters that have levels, in order; sticker `chapter` indexes count these only. */
function playableChapters(gameId: GameId) {
  return getGame(gameId)?.meta?.chapters.filter((c) => c.count > 0) ?? [];
}

/** Where a game sticker comes from: "Brick Escape · Icy doors". Null for discoveries. */
export function stickerSource(sticker: Sticker): { game: string; chapter: string | null; playable: boolean; route: string } | null {
  if (sticker.page !== 'games' || !sticker.game) return null;
  const game = getGame(sticker.game);
  if (!game) return null;
  const chapter = playableChapters(sticker.game)[sticker.chapter ?? -1]?.title ?? null;
  return { game: game.title, chapter, playable: game.playable, route: game.route };
}

/**
 * Game stickers the player has earned by finishing chapters but not yet been given. A chapter
 * is finished when every one of its levels has at least one star.
 */
export function stickersDue(player: Player | null): string[] {
  if (!player) return [];
  const due: string[] = [];
  for (const entry of GAMES) {
    if (!entry.meta) continue;
    const progress = gameOf(player, entry.id);
    playableChapters(entry.id).forEach((c, i) => {
      const end = Math.min(c.start + c.count, entry.meta!.levelCount);
      let finished = end > c.start;
      for (let lv = c.start; lv < end && finished; lv++) if (!((progress.stars[lv] ?? 0) > 0)) finished = false;
      if (!finished) return;
      const sticker = STICKERS.find((s) => s.game === entry.id && s.chapter === i);
      if (sticker && !player.stickers[sticker.id]) due.push(sticker.id);
    });
  }
  return due;
}

/** Stickers the player has, counting only ones in the book. */
export function earnedCount(player: Player | null): number {
  if (!player) return 0;
  return STICKERS.filter((s) => player.stickers[s.id]).length;
}
