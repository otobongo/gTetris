/**
 * Review: people can zoom the page, game boards and drag areas still take every touch, and env
 * files never get committed. These read the project files themselves.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/** The declarations of every rule whose selector list contains `selector` exactly. */
function rulesFor(css: string, selector: string): string[] {
  const out: string[] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1].split(',').map((s) => s.trim().replace(/\s+/g, ' '));
    if (selectors.includes(selector)) out.push(m[2]);
  }
  return out;
}
const touchAction = (css: string, selector: string) =>
  rulesFor(css, selector)
    .map((body) => /touch-action:\s*([a-z-]+)/.exec(body)?.[1])
    .filter(Boolean)
    .pop();

describe('viewport: zoom is allowed', () => {
  const meta = /<meta\s+name="viewport"\s+content="([^"]*)"/.exec(read('index.html'))?.[1] ?? '';

  it('keeps the device width and safe-area fit', () => {
    expect(meta).toContain('width=device-width');
    expect(meta).toContain('viewport-fit=cover');
  });

  it('does not block pinch zoom', () => {
    expect(meta).not.toMatch(/user-scalable\s*=\s*(no|0)/);
    expect(meta).not.toMatch(/maximum-scale\s*=\s*1(\.0*)?\b/);
  });
});

describe('touch: boards and drags keep every touch, controls skip double-tap zoom', () => {
  const drags: [string, string][] = [
    ['src/games/slide/slide.css', '.esc-board'],
    ['src/games/slide/slide.css', '.esc-brick'],
    ['src/games/drop/drop.css', '.drop-well'],
    ['src/games/drop/drop.css', '.drop-pad .drop-pad__btn'],
    ['src/games/letters/letters.css', '.lb-brick.is-draggable'],
    ['src/screens/screens.css', '.sc-hold'],
  ];

  for (const [file, selector] of drags) {
    it(`${selector} has touch-action: none`, () => {
      expect(touchAction(read(file), selector)).toBe('none');
    });
  }

  it('tap targets use manipulation, so a quick double tap never zooms', () => {
    const global = read('src/styles/global.css');
    for (const s of ['button', 'a', '[role="button"]', 'input', 'label', 'select']) expect(touchAction(global, s), s).toBe('manipulation');
    expect(touchAction(read('src/games/letters/letters.css'), '.lb-brick')).toBe('manipulation');
    expect(touchAction(read('src/games/letters/letters.css'), '.lb-picture')).toBe('manipulation');
  });
});

describe('.gitignore: env files', () => {
  const lines = read('.gitignore')
    .split('\n')
    .map((l) => l.trim());

  it('ignores .env and every .env.* file but keeps .env.example', () => {
    expect(lines).toContain('.env');
    expect(lines).toContain('.env.*');
    expect(lines).toContain('!.env.example');
    expect(lines.indexOf('!.env.example')).toBeGreaterThan(lines.indexOf('.env.*'));
  });
});
