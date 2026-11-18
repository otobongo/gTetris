/**
 * Round 2 of the usability pass, Brick Drop's rules and lines:
 * - decision 9: bricks fall 1.6 times slower at ages 3 to 4 and 1.3 times slower at 5 to 6; 7 to 10 as before.
 *   A round keeps the band it started with, so Try again keeps its speed;
 * - decision 11: the help line while paused;
 * - decisions 17 and 20: what the two speakers say;
 * - decision 19: the sticker the stage card shows when a stage finishes a chapter.
 */
import { describe, expect, it } from 'vitest';
import { STICKERS, stickerCells, stickersDue } from '../../screens/logic/stickers';
import { STORAGE_KEY, createProgressStore, type AgeBand } from '../../shared/progress';
import { getGame } from '../registry';
import { KEYS_LINE, TOUCH_LINE } from './controls';
import {
  BAND_SPEED,
  PAUSED_LINE,
  helpLines,
  introLines,
  introSpoken,
  newRound,
  playSpoken,
  pressRound,
  puzzleGame,
  puzzleGoalRows,
  puzzleRules,
  readyLines,
  retryRound,
  solvedLine,
  stageSticker,
  tickRound,
} from './puzzles';
import { STAGES } from './stages';

const BANDS: readonly AgeBand[] = ['3-4', '5-6', '7-8', '9-10'];
const SPEEDY = 8; // Stage 9, 420 ms a row and a 700 ms lock delay

describe('decision 9: the fall speed by age band', () => {
  it('slows ages 3 to 4 by 1.6 and 5 to 6 by 1.3, and keeps 7 to 10 as they are', () => {
    expect(BAND_SPEED).toEqual({ '3-4': 1.6, '5-6': 1.3, '7-8': 1, '9-10': 1 });
  });

  it('gives Stage 9 (Speedy) 672 and 1120 ms at 3-4, 546 and 910 ms at 5-6, 420 and 700 ms at 7-8 and 9-10', () => {
    const at = (band: AgeBand) => {
      const r = puzzleRules(SPEEDY, band);
      return [r.gravityMs, r.lockDelayMs];
    };
    expect(at('3-4')).toEqual([672, 1120]);
    expect(at('5-6')).toEqual([546, 910]);
    expect(at('7-8')).toEqual([420, 700]);
    expect(at('9-10')).toEqual([420, 700]);
  });

  it('keeps every stage at 7-8, and with no band, exactly as the stage sets it', () => {
    STAGES.forEach((stage, i) => {
      const today = { cols: stage.cols, rows: stage.rows, pieces: stage.pieces, gravityMs: stage.gravityMs, lockDelayMs: stage.lockDelayMs, goalRows: puzzleGoalRows(i) };
      expect(puzzleRules(i, '7-8')).toEqual(today);
      expect(puzzleRules(i, '9-10')).toEqual(today);
      expect(puzzleRules(i)).toEqual(today);
    });
  });

  it('rounds to whole ms on every stage and band, and changes only the speed and the lock delay', () => {
    STAGES.forEach((stage, i) => {
      for (const band of BANDS) {
        const r = puzzleRules(i, band);
        expect(r.gravityMs).toBe(Math.round(stage.gravityMs * BAND_SPEED[band]));
        expect(r.lockDelayMs).toBe(Math.round(stage.lockDelayMs * BAND_SPEED[band]));
        expect(Number.isInteger(r.gravityMs) && Number.isInteger(r.lockDelayMs)).toBe(true);
        expect({ ...r, gravityMs: 0, lockDelayMs: 0 }).toEqual({ ...puzzleRules(i), gravityMs: 0, lockDelayMs: 0 });
      }
    });
  });

  it('builds the puzzle’s game and round with the band’s rules, and the same stack and bricks', () => {
    const slow = puzzleGame(0, 2, '3-4');
    const today = puzzleGame(0, 2);
    expect(slow.rules.gravityMs).toBe(1600);
    expect(slow.rules.lockDelayMs).toBe(1600);
    expect({ ...slow, rules: today.rules }).toEqual(today);
    const r = newRound(0, 2, 'ready', '5-6');
    expect(r.band).toBe('5-6');
    expect(r.game.rules.gravityMs).toBe(1300);
    expect(newRound(0, 2).band).toBe('7-8');
  });

  it('at 3-4 on Stage 1, a brick started with Down falls its next row after 1600 ms and not at 1590 ms', () => {
    const started = pressRound(newRound(0, 0, 'ready', '3-4'), 'down');
    const y = started.game.active!.y;
    expect(tickRound(started, 1590).game.active!.y).toBe(y);
    expect(tickRound(tickRound(started, 1590), 10).game.active!.y).toBe(y + 1);
    const today = pressRound(newRound(0, 0, 'ready', '7-8'), 'down');
    expect(tickRound(today, 990).game.active!.y).toBe(y);
    expect(tickRound(today, 1000).game.active!.y).toBe(y + 1);
  });

  it('keeps the band on Try again, so a retry falls at the speed the puzzle started with', () => {
    const played = tickRound(pressRound(newRound(3, 1, 'ready', '3-4'), 'left'), 2500);
    const again = retryRound({ ...played, phase: 'over' });
    expect(again.band).toBe('3-4');
    expect(again.game.rules).toEqual(puzzleRules(3, '3-4'));
    expect(again.elapsedMs).toBe(played.elapsedMs);
  });
});

describe('decision 11: the line while paused', () => {
  it('is "Paused. Press any button to play." and fits the 44 character help line', () => {
    expect(PAUSED_LINE).toBe('Paused. Press any button to play.');
    expect(PAUSED_LINE.length).toBeLessThanOrEqual(44);
    expect(PAUSED_LINE).not.toMatch(/[\u2013\u2014]/);
  });

  it('is the help line while paused, and the waiting and solved lines stay as they are', () => {
    expect(helpLines('paused', 4, false, 12)).toEqual([PAUSED_LINE]);
    expect(helpLines('ready', 4, true, 0)).toEqual(readyLines(4, true));
    expect(helpLines('solved', 4, false, 12)).toEqual([solvedLine(12)]);
    for (const phase of ['intro', 'playing', 'over'] as const) expect(helpLines(phase, 4, false, 12)).toEqual([]);
  });

  it('leaves a press on a paused round to the screen: the round itself does not move', () => {
    const playing = pressRound(newRound(0, 0), 'down');
    const paused = { ...playing, phase: 'paused' as const };
    expect(pressRound(paused, 'left')).toBe(paused);
    expect(tickRound(paused, 5000)).toBe(paused);
  });
});

describe('decisions 17 and 20: what the speakers say', () => {
  it('the intro speaker reads the card’s lines and then its controls line, touch or keys as the card shows it', () => {
    expect(introSpoken(2, false, TOUCH_LINE)).toBe([...introLines(2, false), TOUCH_LINE].join(' '));
    expect(introSpoken(8, true, KEYS_LINE)).toBe([...introLines(8, true), KEYS_LINE].join(' '));
    expect(introSpoken(0, false, TOUCH_LINE)).toMatch(/^Clear 3 rows in each puzzle\. Solve 4 to finish the stage\. 3 stars: \d+ bricks or fewer over the 4 puzzles\. Tap the board to turn\. Swipe down to drop\.$/);
  });

  it('the play speaker reads the lines on screen, in order', () => {
    expect(playSpoken(readyLines(1, true), 4, TOUCH_LINE)).toBe('Here is a different puzzle. Press any button to start. New brick: Short Stick.');
    expect(playSpoken([PAUSED_LINE], 4, TOUCH_LINE)).toBe(PAUSED_LINE);
    expect(playSpoken(['Nice row!'], 4, TOUCH_LINE)).toBe('Nice row!');
  });

  it('with no line on screen, it says the goal and then the controls line', () => {
    expect(playSpoken([], 4, TOUCH_LINE)).toBe('Clear 4 rows. Tap the board to turn. Swipe down to drop.');
    expect(playSpoken([], 1, KEYS_LINE)).toBe('Clear 1 row. Keys: arrow keys move, Up turns, Space drops, P pauses.');
  });
});

describe('decision 19: the sticker a finished stage earns', () => {
  const NOON = new Date(2026, 10, 16, 12, 0).getTime();
  const chapters = getGame('drop')!.meta!.chapters;
  const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);
  const chapter = (i: number) => range(chapters[i].start, chapters[i].count);

  function storeWith(levels: Record<string, number[]>) {
    let n = 0;
    const store = createProgressStore({ storage: null, now: () => NOON, newId: () => `p${++n}`, events: null });
    const p = store.addPlayer({ name: 'Kai', ageBand: '5-6', color: 'green' });
    for (const [game, list] of Object.entries(levels)) for (const lv of list) store.recordStars(game, lv, 2, p.id);
    return { store, id: p.id };
  }

  it('gives Drop’s chapter 1 sticker once Stages 1 to 3 have stars, and returns Tiny tower’s name and 25 squares', () => {
    const { store, id } = storeWith({ drop: chapter(0) });
    const d1 = STICKERS.find((s) => s.id === 'd1')!;
    expect(stageSticker(store, id)).toEqual({ name: 'Tiny tower', cells: stickerCells(d1) });
    expect(stickerCells(d1)).toHaveLength(25);
    expect(store.getState().players[0].stickers.d1).toBeTruthy();
  });

  it('gives it once: a later stage in the next chapter earns nothing until that chapter is done', () => {
    const { store, id } = storeWith({ drop: chapter(0) });
    stageSticker(store, id);
    expect(stageSticker(store, id)).toBeUndefined();
    store.recordStars('drop', chapters[1].start, 3, id);
    expect(stageSticker(store, id)).toBeUndefined();
  });

  it('gives nothing while a stage of the chapter has no stars', () => {
    const { store, id } = storeWith({ drop: chapter(0).slice(0, -1) });
    expect(stageSticker(store, id)).toBeUndefined();
    expect(store.getState().players[0].stickers).toEqual({});
  });

  it('leaves another game’s sticker for Home and the sticker book to give', () => {
    const { store, id } = storeWith({ drop: chapter(0), escape: range(0, getGame('escape')!.meta!.chapters[0].count) });
    expect(stickersDue(store.getState().players[0])).toEqual(['e1', 'd1']);
    stageSticker(store, id);
    expect(Object.keys(store.getState().players[0].stickers)).toEqual(['d1']);
  });

  it('gives every Drop sticker that is due and shows the first', () => {
    const { store, id } = storeWith({ drop: [...chapter(0), ...chapter(1)] });
    expect(stageSticker(store, id)?.name).toBe('Tiny tower');
    expect(Object.keys(store.getState().players[0].stickers).sort()).toEqual(['d1', 'd2']);
  });

  it('works on old saved data: a record with no stickers field gives the sticker, keeps it over a reload and never gives it twice', () => {
    const stars = Object.fromEntries(chapter(0).map((lv) => [lv, 2]));
    const old = {
      version: 3,
      players: [{ id: 'kai', name: 'Kai', ageBand: '5-6', color: 'green', games: { drop: { unlocked: 3, stars, best: {} } } }],
      activePlayerId: 'kai',
      settings: {},
    };
    const saved = new Map([[STORAGE_KEY, JSON.stringify(old)]]);
    const storage = { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => void saved.set(k, v), removeItem: (k: string) => void saved.delete(k) };
    const open = () => createProgressStore({ storage, now: () => NOON, newId: () => 'x', events: null });

    const store = open();
    expect(store.getState().players[0].stickers).toEqual({});
    expect(stageSticker(store, 'kai')?.name).toBe('Tiny tower');
    const earned = store.getState().players[0].stickers.d1;
    expect(earned).toEqual({ earnedAt: NOON, seen: false });

    const again = open();
    expect(again.getState().players[0].stickers.d1).toEqual(earned);
    expect(stageSticker(again, 'kai')).toBeUndefined();
    expect(again.getState().players[0].stickers.d1).toEqual(earned);
  });

  it('leaves a sticker the child already has as it was', () => {
    const { store, id } = storeWith({ drop: chapter(0) });
    store.awardSticker('d1', id);
    const earned = store.getState().players[0].stickers.d1;
    expect(stageSticker(store, id)).toBeUndefined();
    expect(store.getState().players[0].stickers.d1).toBe(earned);
  });

  it('gives nothing with no player to save to', () => {
    const { store } = storeWith({ drop: chapter(0) });
    expect(stageSticker(store, null)).toBeUndefined();
    expect(stageSticker(store, undefined)).toBeUndefined();
    expect(stageSticker(store, 'nobody')).toBeUndefined();
    expect(store.getState().players[0].stickers).toEqual({});
  });
});
