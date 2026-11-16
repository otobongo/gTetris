/**
 * Round 2 of the usability pass, drop.css:
 * - decision 38 (extended to Brick Drop): the global Reduce Motion rule (global.css, 0.01ms !important) would
 *   erase the 150 ms fades of the row flash, the help line and the card scrim. Each gets its duration back;
 *   the existing reduced-motion lines stay;
 * - decisions 17 and 20: the tiles row gets a third, 54px cell for the speaker only while Voice is on.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./drop.css', import.meta.url), 'utf8');
const reduced = (() => {
  const at = css.indexOf('@media (prefers-reduced-motion: reduce)');
  expect(at).toBeGreaterThan(-1);
  return css.slice(at);
})();

describe('decision 38: Brick Drop’s 150 ms fades under Reduce Motion', () => {
  it('gives the row flash, the help line and the scrim a 150ms !important duration', () => {
    expect(reduced).toMatch(/\.drop-flash,\s*\.drop-say:not\(:empty\),\s*\.drop-scrim\s*\{\s*animation-duration:\s*150ms\s*!important;\s*\}/);
  });

  it('keeps the existing lines: opacity fades only, and the flash does not move', () => {
    expect(reduced).toContain('.drop-flash { animation: drop-fade 0.15s linear forwards; transform: none; }');
    expect(reduced).toContain('.drop-say:not(:empty), .drop-scrim { animation: drop-fade 0.15s linear; }');
    expect(reduced).toContain('.drop-cell.is-clearing { animation: none; opacity: 0.3; }');
    expect(css).toMatch(/@keyframes drop-fade \{ from \{ opacity: 0; \} \}/);
  });

  it('gives nothing else an !important duration', () => {
    const rules = reduced.replace(/\/\*[\s\S]*?\*\//g, '');
    const important = [...rules.matchAll(/([^{}]+)\{[^}]*!important[^}]*\}/g)].map((m) => m[1].trim().replace(/\s+/g, ' '));
    expect(important).toEqual(['.drop-flash, .drop-say:not(:empty), .drop-scrim']);
  });
});

describe('decisions 17 and 20: the tiles row with the speaker', () => {
  it('is two cells without the speaker and 1fr 1fr 54px with it', () => {
    expect(css).toMatch(/\.drop-tiles \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/\.drop-tiles\.has-speaker \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\) 54px;/);
  });
});
