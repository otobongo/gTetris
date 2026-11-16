/**
 * Decision 38 (a11y-cross-10): the global Reduce Motion rule (global.css, 0.01ms !important) would erase the
 * 150 ms fade of a brick leaving the board. slide.css gives that one fade its duration back, and only it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./slide.css', import.meta.url), 'utf8');
const reduced = (() => {
  const at = css.indexOf('@media (prefers-reduced-motion: reduce)');
  expect(at).toBeGreaterThan(-1);
  return css.slice(at);
})();

describe('decision 38: the leaving brick keeps its 150 ms fade under Reduce Motion', () => {
  it('gives .esc-brick.is-exiting a 150ms !important duration inside the reduced-motion block', () => {
    expect(reduced).toMatch(/\.esc-brick\.is-exiting\s*\{\s*transition-duration:\s*150ms\s*!important;\s*\}/);
  });

  it('keeps the existing shorthand line, so only opacity fades and the brick does not slide', () => {
    expect(reduced).toMatch(/\.esc-brick,\s*\.esc-brick\.is-exiting\s*\{\s*transition:\s*opacity 150ms ease-out;\s*\}/);
  });

  it('gives no other brick an !important duration, so a brick that is not leaving keeps today’s values', () => {
    const important = [...reduced.matchAll(/([^{}]+)\{[^}]*!important[^}]*\}/g)].map((m) => m[1].trim());
    expect(important).toEqual(['.esc-brick.is-exiting']);
  });
});
