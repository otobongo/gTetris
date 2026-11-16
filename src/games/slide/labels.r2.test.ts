/**
 * Decision 1: the names VoiceOver reads for the tap targets. A spot is named by where the brick's top left
 * square lands, as the line read after the move says it ("Red brick slid to column 3."); the door by what
 * a tap on it does.
 */
import { describe, expect, it } from 'vitest';
import { exitTargetLabel, slidLine, slideTargetLabel } from './labels';

describe('tap target names', () => {
  it('names a spot by the brick colour and the row and column it slides to, counting from 1', () => {
    expect(slideTargetLabel('red', [1, 2])).toBe('Slide Red brick to row 2, column 3');
    expect(slideTargetLabel('white', [0, 0])).toBe('Slide White brick to row 1, column 1');
  });

  it('names the door target by what it does', () => {
    expect(exitTargetLabel('blue')).toBe('Take Blue brick out through its door');
  });

  it('matches the line read once the brick is there', () => {
    expect(slidLine('red', [1, 0], [1, 2])).toBe('Red brick slid to column 3.');
    expect(slideTargetLabel('red', [1, 2])).toContain('column 3');
  });

  it('uses no dashes', () => {
    for (const s of [slideTargetLabel('pink', [3, 4]), exitTargetLabel('pink')]) expect(s).not.toMatch(/[–—]/);
  });
});
