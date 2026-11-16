import { describe, expect, it } from 'vitest';
import {
  FRAME_PAD,
  MAX_TILE,
  MIN_TILE,
  WELL_PAD,
  innerWidth,
  isShortScreen,
  matchTraySize,
  matchViewHeight,
  minViewHeight,
  slotSize,
  traySize,
  trayHeight,
  wordSizes,
} from './sizing';

const PHONE_WIDTHS = [320, 360, 375, 390, 414, 430];

describe('tray and slot sizes (Letters board, 390 wide)', () => {
  it('matches the board for 3 to 8 letters', () => {
    const at = (n: number) => wordSizes(n, 390);
    expect(at(3).tray).toMatchObject({ w: 70, perRow: 3, rows: 1 });
    expect(at(4).tray).toMatchObject({ w: 70, perRow: 4, rows: 1 });
    expect(at(5).tray).toMatchObject({ w: 57, perRow: 5, rows: 1 });
    expect(at(6).tray).toMatchObject({ w: 70, perRow: 3, rows: 2 });
    expect(at(7).tray).toMatchObject({ w: 70, perRow: 4, rows: 2 });
    expect(at(8).tray).toMatchObject({ w: 70, perRow: 4, rows: 2 });
    expect(at(3).slot.w).toBe(76);
    expect(at(8).slot).toMatchObject({ w: 39, gap: 6, border: 2 });
  });

  it('wraps 6 to 8 letter words into two rows on every phone', () => {
    for (const width of PHONE_WIDTHS) for (const n of [6, 7, 8]) expect(traySize(n, width).rows, `${n} letters at ${width}`).toBe(2);
  });

  it('keeps 3 and 4 letter words on one row on every phone', () => {
    for (const width of PHONE_WIDTHS) for (const n of [3, 4]) expect(traySize(n, width).rows, `${n} letters at ${width}`).toBe(1);
  });

  it('shrinks to fit: tiles and slots never run past the space they have', () => {
    for (const width of [...PHONE_WIDTHS, 596]) {
      const avail = width - FRAME_PAD * 2;
      for (let n = 3; n <= 8; n++) {
        const { slot, tray } = wordSizes(n, width);
        expect(slot.w * n + slot.gap * (n - 1), `slots, ${n} letters at ${width}`).toBeLessThanOrEqual(avail);
        expect(tray.perRow * tray.w + (tray.perRow - 1) * tray.gap, `tray, ${n} letters at ${width}`).toBeLessThanOrEqual(avail - WELL_PAD * 2);
        expect(tray.perRow * tray.rows).toBeGreaterThanOrEqual(n);
        expect(tray.w).toBeLessThanOrEqual(MAX_TILE);
      }
    }
  });

  it('keeps tiles big enough to press: at least 44px', () => {
    for (const width of PHONE_WIDTHS) for (let n = 3; n <= 8; n++) expect(traySize(n, width).w, `${n} at ${width}`).toBeGreaterThanOrEqual(44);
  });

  it('keeps single-row tiles at or above the wrap threshold', () => {
    for (const width of PHONE_WIDTHS) for (let n = 3; n <= 8; n++) {
      const t = traySize(n, width);
      if (t.rows === 1) expect(t.w, `${n} at ${width}`).toBeGreaterThanOrEqual(MIN_TILE);
    }
  });

  it('keeps the tile and slot proportions of the board', () => {
    const t = traySize(3, 390);
    expect(t).toMatchObject({ w: 70, h: 74, font: 40, radius: 14, studW: 18, studH: 10, studIn: 12 });
    const s = slotSize(3, 390);
    expect(s).toMatchObject({ w: 76, h: 84, font: 46, radius: 18, border: 3 });
  });

  it('honours a smaller maximum tile for the match rows', () => {
    expect(traySize(4, 390, 64).w).toBe(64);
    expect(traySize(8, 390, 64).rows).toBe(2);
  });

  it('does not break on an empty or one-letter row', () => {
    expect(traySize(0, 390).perRow).toBe(1);
    expect(slotSize(1, 390).w).toBe(76);
  });
});

describe('frame width and height', () => {
  it('uses the phone column up to 430px and the tablet board at 596px', () => {
    expect(innerWidth('phone', 390)).toBe(390);
    expect(innerWidth('phone', 700)).toBe(430);
    expect(innerWidth('phone', 100)).toBe(280);
    expect(innerWidth('tablet', 834)).toBe(596);
  });

  it('asks for more height as the tray gets taller, so a short screen scrolls instead of squashing', () => {
    const one = minViewHeight(84, traySize(3, 390));
    const two = minViewHeight(84, traySize(8, 390));
    expect(two).toBeGreaterThan(one);
    expect(trayHeight(traySize(8, 390))).toBeGreaterThan(trayHeight(traySize(3, 390)));
  });
});

describe('Big and small on a short phone (375x667)', () => {
  /** The play area's height at 375x667 (.lb-body clientHeight), and its bottom padding (letters.css). */
  const BODY_375x667 = 497;
  const BODY_PAD = 6;

  it('counts as short only on a phone under 700px tall', () => {
    expect(isShortScreen('phone', 667)).toBe(true);
    expect(isShortScreen('phone', 699)).toBe(true);
    expect(isShortScreen('phone', 700)).toBe(false);
    expect(isShortScreen('phone', 844)).toBe(false);
    // The tablet frame is always drawn 853 tall and zoomed to fit, so its trays never shrink.
    expect(isShortScreen('tablet', 600)).toBe(false);
  });

  it('keeps the 64px match tiles and 18px row gap on a tall phone', () => {
    expect(matchTraySize(8, 390, false)).toMatchObject({ w: 64, h: 68, rows: 2, rowGap: 18 });
    expect(matchTraySize(4, 390, false)).toEqual(traySize(4, 390, 64));
  });

  it('8 pairs: tiles 54 to 56 wide in two rows with a 12px row gap, at the frame width and with the page gutter taken off', () => {
    for (const innerW of [375, 343]) {
      const t = matchTraySize(8, innerW, true);
      expect(t.w, `at ${innerW}`).toBeGreaterThanOrEqual(54);
      expect(t.w, `at ${innerW}`).toBeLessThanOrEqual(56);
      expect(t).toMatchObject({ rows: 2, perRow: 4, rowGap: 12 });
    }
    // The concrete tray the view draws at 375: 56 by 59 tiles, a stud of 8, so each well's tray is 138px tall.
    const t = matchTraySize(8, 375, true);
    expect(t).toMatchObject({ w: 56, h: 59, studH: 8, rowGap: 12 });
    expect(t.studH + t.rows * t.h + (t.rows - 1) * t.rowGap).toBe(138);
    expect(trayHeight(t)).toBe(174);
  });

  it('6 and 8 pairs: both trays, the help row and the gaps fit the 497px play area', () => {
    for (const pairs of [6, 8]) {
      const t = matchTraySize(pairs, 375, true);
      expect(t.rows, `${pairs} pairs`).toBe(2);
      expect(matchViewHeight(t) + BODY_PAD, `${pairs} pairs`).toBeLessThanOrEqual(BODY_375x667);
    }
  });

  it('the tall phone sizes are what overflowed: 538px of content in the 497px area', () => {
    expect(Math.round(matchViewHeight(matchTraySize(8, 375, false)) + BODY_PAD)).toBe(538);
  });

  it('keeps every match tile at least 44px on every phone width when short', () => {
    for (const width of PHONE_WIDTHS) for (const pairs of [3, 4, 6, 8]) {
      const t = matchTraySize(pairs, width, true);
      expect(t.w, `${pairs} pairs at ${width}`).toBeGreaterThanOrEqual(44);
      expect(t.perRow * t.w + (t.perRow - 1) * t.gap, `${pairs} pairs at ${width}`).toBeLessThanOrEqual(width - FRAME_PAD * 2 - WELL_PAD * 2);
    }
  });
});
