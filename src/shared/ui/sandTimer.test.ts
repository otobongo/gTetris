/**
 * Decision D3: on the relaxed timer (ages 3 to 4, or timer mode 'relaxed') Brick Escape and Brick Drop
 * show the same sand timer: a filling bar with no digits that never costs a star, from one component.
 */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STAGES } from '../../games/drop/stages';
import { ranOut, timerPlan } from '../../games/drop/timer';
import { clockFor } from '../../games/slide/SlideGame';
import { SAND_CAPTION, SandTimer, sandFill } from './SandTimer';

const render = (elapsed: number, total: number) => renderToString(createElement(SandTimer, { elapsed, total }));
/** The words a child sees: the markup without tags or attributes. */
const visibleText = (html: string) => html.replace(/<[^>]*>/g, ' ');

describe('sand timer: how full the bar is', () => {
  it('fills from empty to full as the time passes', () => {
    expect(sandFill(0, 60)).toBe(0);
    expect(sandFill(15, 60)).toBe(25);
    expect(sandFill(30, 60)).toBe(50);
    expect(sandFill(60, 60)).toBe(100);
  });

  it('stays full after the time is up and never goes below empty', () => {
    expect(sandFill(600, 60)).toBe(100);
    expect(sandFill(-5, 60)).toBe(0);
  });

  it('shows an empty bar for a zero, negative or broken total or elapsed time', () => {
    expect(sandFill(10, 0)).toBe(0);
    expect(sandFill(10, -60)).toBe(0);
    expect(sandFill(10, Number.NaN)).toBe(0);
    expect(sandFill(Number.NaN, 60)).toBe(0);
  });
});

describe('sand timer: what it shows', () => {
  it('has the caption, and it has no dashes', () => {
    expect(SAND_CAPTION).toBe('A gentle sand timer for fun. It never costs a star.');
    expect(SAND_CAPTION).not.toMatch(/[–—]/);
    expect(render(10, 60)).toContain(SAND_CAPTION);
  });

  it('shows no digits and no clock, at the start, half way and after the time is up', () => {
    for (const elapsed of [0, 30, 600]) {
      const html = render(elapsed, 60);
      expect(visibleText(html), String(elapsed)).not.toMatch(/\d/);
      expect(html).not.toContain('role="timer"');
    }
  });

  it('draws the fill at the share of time played', () => {
    expect(render(30, 60)).toContain('width:50%');
    expect(render(600, 60)).toContain('width:100%');
  });
});

describe('sand timer: both games use it the same way', () => {
  const stage = STAGES[3];

  it('Brick Escape and Brick Drop both pick the relaxed timer for ages 3 to 4 and for relaxed mode', () => {
    expect(clockFor(45, '3-4', 'auto').kind).toBe('relaxed');
    expect(clockFor(45, '9-10', 'relaxed').kind).toBe('relaxed');
    expect(timerPlan(stage, 'auto', '3-4').kind).toBe('relaxed');
    expect(timerPlan(stage, 'relaxed', '9-10').kind).toBe('relaxed');
  });

  it('runs the sand over twice the base time for ages 3 to 4 in both games', () => {
    expect(clockFor(45, '3-4', 'auto').seconds).toBe(90);
    const base = (timerPlan(stage, 'auto', '9-10') as { seconds: number }).seconds;
    expect((timerPlan(stage, 'auto', '3-4') as { seconds: number }).seconds).toBe(base * 2);
  });

  it('never costs a star in Brick Drop, however long the stage takes', () => {
    expect(ranOut(timerPlan(stage, 'auto', '3-4'), 1e6)).toBe(false);
  });

  it('is the one shared component in both play screens, and the caption lives only in it', () => {
    const escape = readFileSync(new URL('../../games/slide/SlideGame.tsx', import.meta.url), 'utf8');
    const drop = readFileSync(new URL('../../games/drop/Play.tsx', import.meta.url), 'utf8');
    for (const src of [escape, drop]) {
      expect(src).toContain('<SandTimer');
      expect(src).not.toContain('It never costs a star');
    }
    // Brick Drop no longer shows a count-up clock
    expect(drop).not.toContain('Time played');
  });
});
