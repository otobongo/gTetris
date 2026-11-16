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

/* ---------- Big and small ---------- */

/** Below this height a phone is short (the 375x667 iPhone SE), and Big and small draws its trays smaller. */
export const SHORT_PHONE = 700;
/** Largest match tile: 64 on most screens, 56 on a short phone. */
export const MATCH_TILE = 64;
export const MATCH_TILE_SHORT = 56;
/** Gap between the two rows of a match tray: 18 as everywhere, 12 on a short phone. */
const MATCH_ROW_GAP_SHORT = 12;

/** Only the phone column gets short: the tablet frame is always drawn 853 tall and zoomed to fit. */
export const isShortScreen = (mode: 'phone' | 'tablet', height: number): boolean => mode === 'phone' && height < SHORT_PHONE;

/** The size of each Big and small tray (both trays share it). */
export function matchTraySize(pairs: number, innerW: number, short: boolean): TraySize {
  if (!short) return traySize(pairs, innerW, MATCH_TILE);
  return { ...traySize(pairs, innerW, MATCH_TILE_SHORT), rowGap: MATCH_ROW_GAP_SHORT };
}

/** The tray well's label line ("Big letters": 14px Baloo 2 at its normal line height, 22px as measured), and the 8px under it. */
const WELL_LABEL = 22 + 8;
/** Gap between the help row and the two wells in .lb-match (letters.css). */
const MATCH_GAP = 10;

/** Height of the Big and small view: the help row, then two labelled wells, as letters.css lays them out. */
export function matchViewHeight(t: TraySize): number {
  return HELP_ROW + 2 * (MATCH_GAP + WELL_LABEL + trayHeight(t));
}
