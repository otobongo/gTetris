/**
 * Decision 1: where the tap targets sit, on every board of all 31 levels, from the start and after a few taps,
 * at the square sizes the play screen draws (24 px, the least; 35 and 38 on phones; 53 and 76 on bigger
 * boards). A spot to slide to is exactly its free squares; a door's target never covers a brick, never reaches
 * into a square of the tray, and is 44 px across both ways with the squares it reaches into.
 */
import { describe, expect, it } from 'vitest';
import { type Level, type State, initialState, isSolved, withMove } from './engine';
import { PUZZLE_LEVELS } from './puzzles';
import { type Box, MIN_HIT, cellsBox, doorBox, exitHit, tapButtons, tapMove } from './tap';

const overlaps = (a: Box, b: Box) => a.left + a.width > b.left && b.left + b.width > a.left && a.top + a.height > b.top && b.top + b.height > a.top;

/** A brick as the board draws it: its squares, 2 px in from each edge. */
function brickBoxes(level: Level, s: State): Box[] {
  return level.blocks.flatMap((b, i) => {
    const p = s.pos[i];
    if (!p) return [];
    const rows = b.cells.map((c) => c[0]);
    const cols = b.cells.map((c) => c[1]);
    const h = Math.max(...rows) + 1;
    const w = Math.max(...cols) + 1;
    return [{ left: p[1] * cell + 2, top: p[0] * cell + 2, width: w * cell - 4, height: h * cell - 4 }];
  });
}
let cell = 38;

/** The board at its start and every board one or two taps away (at most `cap` of them). */
function boardsNear(level: Level, cap = 60): State[] {
  const out: State[] = [initialState(level)];
  const seen = new Set([JSON.stringify(out[0].pos)]);
  for (let depth = 0, frontier = [out[0]]; depth < 2 && out.length < cap; depth++) {
    const next: State[] = [];
    for (const s of frontier)
      level.blocks.forEach((_, b) => {
        for (const t of tapButtons(level, s, b)) {
          const res = tapMove(level, s, b, t)!;
          const after = res.kind === 'exit' ? withMove(res.state, b, null) : res.state;
          const k = JSON.stringify(after.pos);
          if (seen.has(k) || isSolved(after) || out.length >= cap) continue;
          seen.add(k);
          out.push(after);
          next.push(after);
        }
      });
    frontier = next;
  }
  return out;
}

describe('a door target’s hit area', () => {
  it('never reaches into a square of the tray, on any door of any board, at any square size', () => {
    for (const size of [24, 35, 38, 53, 76])
      for (const L of PUZZLE_LEVELS)
        for (const level of L.puzzles)
          for (const gate of level.gates) {
            const hit = exitHit(level, gate, size);
            // the squares under the hit area, and one more each way
            const r0 = Math.max(0, Math.floor(hit.top / size) - 1);
            const r1 = Math.min(level.rows - 1, Math.floor((hit.top + hit.height) / size) + 1);
            const c0 = Math.max(0, Math.floor(hit.left / size) - 1);
            const c1 = Math.min(level.cols - 1, Math.floor((hit.left + hit.width) / size) + 1);
            for (let r = r0; r <= r1; r++)
              for (let c = c0; c <= c1; c++) {
                if (level.void[r][c]) continue;
                const square = { left: c * size, top: r * size, width: size, height: size };
                expect(overlaps(hit, square), `${level.id} ${gate.side} ${gate.at} at ${size}px, square ${r},${c}`).toBe(false);
              }
          }
  }, 30_000);

  it('grows a 1 square door on a 30 px board to 44 px along it, centred, and 44 px outward', () => {
    const level = PUZZLE_LEVELS[0].puzzles[0];
    const gate = { ...level.gates[0], side: 'left' as const, at: 1, len: 1 };
    const door = doorBox(level, gate, 30);
    expect(door).toEqual({ left: -20, top: 34, width: 18, height: 22 });
    expect(exitHit(level, gate, 30)).toEqual({ left: -46, top: 23, width: 44, height: 44 });
  });
});

describe('tap target layout on every board', () => {
  for (const size of [24, 35, 38, 53, 76]) {
    it(`at ${size} px squares: no target covers a brick or another target, and every door target is 44 px`, () => {
      cell = size;
      let doors = 0;
      const short: string[] = [];
      for (const [li, L] of PUZZLE_LEVELS.entries())
        for (const [pi, level] of L.puzzles.entries())
          for (const s of boardsNear(level)) {
            const bricks = brickBoxes(level, s);
            level.blocks.forEach((_, b) => {
              const where = `L${li + 1} p${pi} brick ${b}`;
              const boxes: Box[] = [];
              for (const t of tapButtons(level, s, b)) {
                if (t.kind === 'slide') {
                  const box = cellsBox(t.cells, cell)!;
                  boxes.push(box);
                  continue;
                }
                doors++;
                const gate = level.gates[t.gate];
                const hit = exitHit(level, gate, cell);
                const door = doorBox(level, gate, cell);
                // the hit area holds the door
                expect(hit.left <= door.left && hit.top <= door.top && hit.left + hit.width >= door.left + door.width && hit.top + hit.height >= door.top + door.height, where).toBe(true);
                for (const k of bricks) expect(overlaps(hit, k), `${where} door target over a brick`).toBe(false);
                const reach = cellsBox(t.reach, cell);
                if (reach) boxes.push(reach);
                const all = reach ? [hit, reach] : [hit];
                const w = Math.max(...all.map((x) => x.left + x.width)) - Math.min(...all.map((x) => x.left));
                const h = Math.max(...all.map((x) => x.top + x.height)) - Math.min(...all.map((x) => x.top));
                if (w < MIN_HIT || h < MIN_HIT) short.push(`${where} ${w}x${h}`);
              }
              for (let i = 0; i < boxes.length; i++) {
                for (const k of bricks) expect(overlaps(boxes[i], k), `${where} spot over a brick`).toBe(false);
                for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j]), `${where} spots overlap`).toBe(false);
              }
            });
          }
      expect(doors).toBeGreaterThan(100);
      expect(short, `door targets under 44 px at ${size} px squares`).toEqual([]);
    }, 30_000); // every board of all 31 levels: give a busy machine room
  }
});
