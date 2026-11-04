import { describe, expect, it } from 'vitest';
import { meta } from './meta';
import { PIECES } from './pieces';
import { STAGES } from './stages';
import { AGE_FACTOR, SECONDS_PER_ROW, clearMessage, formatClock, timerPlan, timerState } from './timer';

describe('game timer plan', () => {
  const stage = STAGES[3]; // 6 rows

  it('shows no timer when the grown-up turned it off', () => {
    expect(timerPlan(stage, 'off', '7-8')).toEqual({ kind: 'off' });
    expect(timerPlan(stage, 'off', '3-4')).toEqual({ kind: 'off' });
  });

  it('counts up gently in relaxed mode and for ages 3 to 4', () => {
    expect(timerPlan(stage, 'relaxed', '9-10')).toEqual({ kind: 'relaxed' });
    expect(timerPlan(stage, 'auto', '3-4')).toEqual({ kind: 'relaxed' });
  });

  it('counts down in auto mode: base time times the age factor', () => {
    const base = stage.goalRows * SECONDS_PER_ROW;
    for (const band of ['5-6', '7-8', '9-10'] as const) {
      expect(timerPlan(stage, 'auto', band)).toEqual({ kind: 'countdown', seconds: Math.round(base * AGE_FACTOR[band]) });
    }
  });

  it('gives younger children more time on the same stage', () => {
    const secs = (b: '5-6' | '7-8' | '9-10') => (timerPlan(stage, 'auto', b) as { seconds: number }).seconds;
    expect(secs('5-6')).toBeGreaterThan(secs('7-8'));
    expect(secs('7-8')).toBeGreaterThan(secs('9-10'));
  });

  it('gives bigger goals more time', () => {
    const secs = (i: number) => (timerPlan(STAGES[i], 'auto', '9-10') as { seconds: number }).seconds;
    expect(secs(STAGES.length - 1)).toBeGreaterThan(secs(0));
  });
});

describe('clock text and colour', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(9)).toBe('0:09');
    expect(formatClock(125)).toBe('2:05');
    expect(formatClock(600)).toBe('10:00');
  });

  it('never shows a negative clock', () => {
    expect(formatClock(-4)).toBe('0:00');
  });

  it('is green above a third of the time, yellow below, pink at zero', () => {
    expect(timerState(120, 120)).toBe('ok');
    expect(timerState(41, 120)).toBe('ok');
    expect(timerState(40, 120)).toBe('low');
    expect(timerState(1, 120)).toBe('low');
    expect(timerState(0, 120)).toBe('out');
    expect(timerState(-5, 120)).toBe('out');
  });
});

describe('clear message', () => {
  it('names one, two and three rows, then a big clear', () => {
    expect(clearMessage(1)).toBe('Nice row!');
    expect(clearMessage(2)).toBe('Double rows!');
    expect(clearMessage(3)).toBe('Triple rows!');
    expect(clearMessage(4)).toBe('Big clear!');
  });

  it('has no dashes', () => {
    for (let n = 0; n <= 5; n++) expect(clearMessage(n)).not.toMatch(/[\u2013\u2014]/);
  });
});

describe('Brick Drop chapters', () => {
  const chapterPieces = (start: number, count: number) => STAGES.slice(start, start + count).flatMap((s) => s.pieces);
  const biggest = (ids: string[]) => Math.max(...ids.map((id) => PIECES[id as keyof typeof PIECES].cells.length));

  it('cover every stage in order with no gaps', () => {
    let next = 0;
    for (const c of meta.chapters) {
      expect(c.start).toBe(next);
      next += c.count;
    }
    expect(next).toBe(STAGES.length);
    expect(meta.levelCount).toBe(STAGES.length);
  });

  it('match the bricks each chapter uses', () => {
    const [small, four, big] = meta.chapters;
    expect(biggest(chapterPieces(small.start, small.count))).toBeLessThanOrEqual(3);
    expect(biggest(chapterPieces(four.start, four.count))).toBe(4);
    expect(biggest(chapterPieces(big.start, big.count))).toBe(5);
  });

  it('starts the Four-square chapter where the first four-square brick appears (stage 4)', () => {
    expect(meta.chapters[1].start).toBe(3);
    expect(STAGES[3].pieces.some((id) => PIECES[id].cells.length === 4)).toBe(true);
  });
});

describe('stage tips', () => {
  it('do not mention a Hold button, which the board no longer has', () => {
    for (const s of STAGES) expect(s.tip).not.toMatch(/\bhold\b/i);
  });
});
