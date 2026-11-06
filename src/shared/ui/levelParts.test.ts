/** The shared four-puzzle pieces (brief 7.1, 8, 9.1, 10): PuzzleDots, LevelCard and the swap icon. */
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Icon } from './Icon';
import { LEVEL_CARD_DELAY_MS, LevelCard, type LevelCardProps } from './LevelCard';
import { PuzzleDots, dotsLabel, type PuzzleDotsProps } from './PuzzleDots';

const dots = (props: PuzzleDotsProps) => renderToStaticMarkup(createElement(PuzzleDots, props));
const classesOf = (html: string) => [...html.matchAll(/class="(bw-dot[^"]*)"/g)].map((m) => m[1]).filter((c) => c.startsWith('bw-dot ') || c === 'bw-dot');
const card = (props: Partial<LevelCardProps> = {}) =>
  renderToStaticMarkup(
    createElement(LevelCard, {
      title: 'You finished Level 9',
      stars: 2,
      fact: '4 puzzles in 31 moves.',
      rule: '3 stars: 28 moves or fewer. 2 stars: 36 or fewer.',
      primary: { label: 'Play Level 10', onClick: () => {} },
      secondary: { label: 'Back to games', href: '#/' },
      onClose: () => {},
      ...props,
    }),
  );

describe('PuzzleDots', () => {
  it('names progress in words (9.1)', () => {
    expect(dotsLabel(2, 3)).toBe('Puzzle 3 of 4. 2 solved.');
    expect(dotsLabel(2, 3, 'word')).toBe('Word 3 of 4. 2 built.');
    expect(dotsLabel(4, 4)).toBe('4 of 4 solved.');
    expect(dotsLabel(4, 4, 'word')).toBe('4 of 4 built.');
    expect(dotsLabel(0, 1)).toBe('Puzzle 1 of 4. 0 solved.');
  });

  it('is one image with that name, always four dots', () => {
    const html = dots({ solved: 2 });
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Puzzle 3 of 4. 2 solved."');
    expect(classesOf(html)).toEqual(['bw-dot is-solved', 'bw-dot is-solved', 'bw-dot is-current', 'bw-dot']);
    expect(html).not.toContain('aria-live');
  });

  it('right after a solve the dot just solved is filled and still the wide one', () => {
    const html = dots({ solved: 3, puzzle: 3 });
    expect(classesOf(html)).toEqual(['bw-dot is-solved', 'bw-dot is-solved', 'bw-dot is-current is-solved', 'bw-dot']);
    expect(html).toContain('aria-label="Puzzle 3 of 4. 3 solved."');
  });

  it('a finished level fills all four', () => {
    const html = dots({ solved: 4 });
    expect(classesOf(html)).toEqual(['bw-dot is-solved', 'bw-dot is-solved', 'bw-dot is-solved', 'bw-dot is-current is-solved']);
    expect(html).toContain('aria-label="4 of 4 solved."');
  });

  it('pulls values outside 0 to 4 back in', () => {
    expect(dots({ solved: 9 })).toContain('4 of 4 solved.');
    expect(dots({ solved: -2 })).toContain('Puzzle 1 of 4. 0 solved.');
    expect(dots({ solved: Number.NaN })).toContain('Puzzle 1 of 4. 0 solved.');
  });
});

describe('LevelCard', () => {
  it('is a modal dialog labelled by its title and described by its fact line', () => {
    const html = card();
    expect(html).toMatch(/role="dialog" aria-modal="true" aria-labelledby="([^"]+)-title" aria-describedby="\1-fact"/);
    expect(html).toMatch(/<h2 id="[^"]+-title"[^>]*>You finished Level 9<\/h2>/);
    expect(html).toMatch(/<p id="[^"]+-fact"[^>]*>4 puzzles in 31 moves\.<\/p>/);
  });

  it('shows the stars with a text equivalent, the rule, and the cap only when given', () => {
    const html = card();
    expect(html).toContain('aria-label="2 of 3 stars"');
    expect(html.match(/class="is-on"/g)).toHaveLength(2);
    expect(html).toContain('3 stars: 28 moves or fewer. 2 stars: 36 or fewer.');
    expect(html).not.toContain('caps the level');
    expect(card({ cap: 'Using a hint caps the level at 2 stars.' })).toContain('Using a hint caps the level at 2 stars.');
  });

  it('primary is a green button that takes focus first; Back to games is a real link', () => {
    const html = card();
    expect(html).toMatch(/<button[^>]*data-tone="green"[^>]*data-autofocus="true"|<button[^>]*data-autofocus="true"[^>]*data-tone="green"/);
    expect(html).toContain('Play Level 10');
    expect(html).toMatch(/<a[^>]*href="#\/"[^>]*>.*Back to games/);
  });

  it('the finished card has one button, a note and no rule', () => {
    const html = card({
      title: 'You finished every level!',
      fact: '31 levels, 78 of 93 stars.',
      rule: undefined,
      note: 'A grown-up can pick a level to play again.',
      primary: { label: 'Back to games', href: '#/' },
      secondary: undefined,
    });
    expect(html.match(/<(a|button)\b/g)).toHaveLength(1);
    expect(html).toContain('A grown-up can pick a level to play again.');
    expect(html).toMatch(/<a[^>]*data-autofocus="true"/);
  });

  it('can leave the star row out', () => {
    expect(card({ stars: undefined })).not.toContain('of 3 stars');
    expect(card({ stars: 7 })).toContain('3 of 3 stars');
  });

  it('the finished state shows the game’s star total in place of a level’s star row (D6)', () => {
    const html = card({ stars: undefined, total: { stars: 78, max: 93 }, rule: undefined, secondary: undefined });
    expect(html).toContain('role="img" aria-label="78 of 93 stars"');
    expect(html).toContain('78 of 93');
    expect(html).not.toContain('of 3 stars');
    // Given both, the total wins: the card never shows a level's stars beside the game's.
    expect(card({ stars: 3, total: { stars: 63, max: 93 } })).not.toContain('3 of 3 stars');
    expect(card({ total: { stars: Number.NaN, max: 93 } })).toContain('aria-label="0 of 93 stars"');
  });

  it('opens 600ms after the last dot', () => {
    expect(LEVEL_CARD_DELAY_MS).toBe(600);
  });
});

describe('the swap icon and the styles', () => {
  it('draws the two arrows of section 8 on the 24 viewBox, inheriting currentColor', () => {
    const html = renderToStaticMarkup(createElement(Icon, { name: 'swap' }));
    expect(html).toContain('d="M4 8h12M13 5l3 3-3 3"');
    expect(html).toContain('d="M20 16H8M11 13l-3 3 3 3"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="2.6"');
    expect(html).toContain('aria-hidden="true"');
  });

  it('use only the values section 8 lists, and turn motion into a crossfade when reduced', () => {
    const css = readFileSync(new URL('./ui.css', import.meta.url), 'utf8');
    const block = (sel: string) => css.slice(css.indexOf(`${sel} {`), css.indexOf('}', css.indexOf(`${sel} {`)));
    expect(block('.bw-dot')).toContain('width: 22px');
    expect(block('.bw-dot')).toContain('height: 10px');
    expect(block('.bw-dot')).toContain('inset 0 0 0 2px var(--bw-decor)');
    expect(block('.bw-dot.is-current')).toContain('width: 32px');
    expect(block('.bw-dot.is-current')).toContain('var(--brick-blue-light)');
    expect(block('.bw-dot__fill')).toContain('var(--bw-accent)');
    expect(block('.bw-levelcard')).toContain('max-width: 330px');
    expect(block('.bw-levelcard')).toContain('var(--bw-card-shadow)');
    const reduced = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toContain('.bw-dot { transition: none; }');
    expect(reduced).toContain('.bw-dot__fill { transition: opacity 150ms linear; }');
    expect(reduced).toContain('.bw-levelcard { animation: bw-fade-in 150ms linear; }');
    expect(css).not.toMatch(/[–—]/);
  });
});
