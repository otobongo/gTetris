/**
 * The new sticker on a kit game's level card (decision 19). When a level finishes a chapter, this
 * game's due stickers are awarded at that moment and the first one is shown on the card. Stickers due
 * from other games stay for Home and the sticker book to award, as they always did.
 */
import { findPlayer, type ProgressStore } from '../../shared/progress';
import type { BrickColor } from '../../shared/ui/palette';
import { STICKERS, stickerCells, stickersDue } from '../../screens/logic/stickers';
import type { GameId } from '../registry';

/** What the level card draws: the sticker's name and its 25 mosaic cells, row by row. */
export interface LevelSticker {
  name: string;
  cells: (BrickColor | null)[];
}

/** Awards `game`'s due stickers to the player and answers the first, or undefined when none is due. */
export function claimLevelSticker(store: ProgressStore, playerId: string, game: GameId): LevelSticker | undefined {
  const player = findPlayer(store.getState(), playerId);
  if (!player) return undefined;
  const mine = stickersDue(player).filter((id) => STICKERS.find((s) => s.id === id)?.game === game);
  for (const id of mine) store.awardSticker(id, player.id);
  const first = STICKERS.find((s) => s.id === mine[0]);
  return first ? { name: first.name, cells: stickerCells(first) } : undefined;
}
