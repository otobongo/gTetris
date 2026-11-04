/* Slot and tile sizes for Letter Builder, from the Letters board (design/canvas/Letters.dc.html, sizes()).
   The answer row and the tray shrink to fit the word. Pure numbers, so the fit rule can be tested. */

export interface TraySize {
  /** Tile width and height in px. */
  w: number;
  h: number;
  font: number;
  radius: number;
  /** Stud width, stud height and the stud's inset from the tile edge. */
  studW: number;
  studH: number;
  studIn: number;
  /** Tiles per row and rows. More than one row when a single row would make tiles smaller than MIN_TILE. */
  perRow: number;
  rows: number;
  gap: number;
  rowGap: number;
}

export interface SlotSize {
  w: number;
  h: number;
  gap: number;
  font: number;
  radius: number;
  border: number;
}

export interface WordSizes {
  slot: SlotSize;
  tray: TraySize;
}

/** Page padding on each side of the inner frame, and the tray well's side padding. */
export const FRAME_PAD = 16;
export const WELL_PAD = 12;

const MAX_SLOT = 76;
export const MAX_TILE = 70;
/** A tile narrower than this wraps the tray into two rows instead. */
export const MIN_TILE = 56;

/** Space the tray tiles can use, and the space the answer row can use, for an inner frame `innerW` px wide. */
const availableWidth = (innerW: number) => innerW - FRAME_PAD * 2;

export function traySize(count: number, innerW: number, maxTile = MAX_TILE): TraySize {
  const trayW = availableWidth(innerW) - WELL_PAD * 2;
  const gap = 12;
  const n = Math.max(1, count);
  let perRow = n;
  let w = Math.floor((trayW - gap * (n - 1)) / n);
  if (w >= maxTile) w = maxTile;
  else if (w < MIN_TILE) {
    perRow = Math.ceil(n / 2);
    w = Math.min(maxTile, Math.floor((trayW - gap * (perRow - 1)) / perRow));
  }
  return {
    w,
    h: Math.round((w * 74) / 70),
    font: Math.round((w * 40) / 70),
    radius: Math.round((w * 14) / 70),
    studW: Math.round((w * 18) / 70),
    studH: Math.max(7, Math.round((w * 10) / 70)),
    studIn: Math.round((w * 12) / 70),
    perRow,
    rows: Math.ceil(n / perRow),
    gap,
    rowGap: 18,
  };
}

export function slotSize(count: number, innerW: number): SlotSize {
  const avail = availableWidth(innerW);
  const n = Math.max(1, count);
  const gap = n <= 4 ? 12 : n <= 6 ? 8 : 6;
  const w = Math.min(MAX_SLOT, Math.floor((avail - gap * (n - 1)) / n));
  return {
    w,
    h: Math.round((w * 84) / 76),
    gap,
    font: Math.round((w * 46) / 76),
    radius: Math.max(8, Math.round((w * 18) / 76)),
    border: w < 56 ? 2 : 3,
  };
}

/** Sizes for a word of `letters` letters: `letters` slots, and one tile per letter in the tray. */
export function wordSizes(letters: number, innerW: number): WordSizes {
  return { slot: slotSize(letters, innerW), tray: traySize(letters, innerW) };
}

/** Width of the inner frame: the phone column (up to 430px wide) or the tablet board's 596px. */
export function innerWidth(mode: 'phone' | 'tablet', viewportWidth: number): number {
  return mode === 'tablet' ? 596 : Math.min(430, Math.max(280, viewportWidth));
}

/** Room the help line and its hint button need. */
const HELP_ROW = 54;
/** The smallest the picture frame may shrink to on a short screen. */
export const PICTURE_MIN = 80;
const GAP = 14;

/** Height of the tray well: padding, rows of tiles and the gaps between rows. */
export function trayHeight(t: TraySize): number {
  return 36 + t.studH + t.rows * t.h + (t.rows - 1) * t.rowGap;
}

/** The least height a spelling or first-sound view needs, so a short screen scrolls instead of squashing it.
    `rowH` is the height of the answer row (slots, or the word line). */
export function minViewHeight(rowH: number, t: TraySize): number {
  return PICTURE_MIN + 10 + rowH + 10 + HELP_ROW + trayHeight(t) + GAP * 3;
}
