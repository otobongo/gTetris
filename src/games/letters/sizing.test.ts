import { describe, expect, it } from 'vitest';
import { FRAME_PAD, MAX_TILE, MIN_TILE, WELL_PAD, innerWidth, minViewHeight, slotSize, traySize, trayHeight, wordSizes } from './sizing';

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
