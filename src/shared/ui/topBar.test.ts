/**
 * The shared TopBar (F6): a `below` slot under the title for a block such as the puzzle dots, drawn as a
 * sibling of the h1 and outside the subtitle's paragraph, so the three game bars can use TopBar itself.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PuzzleDots } from './PuzzleDots';
import { TopBar, type TopBarProps } from './TopBar';

const bar = (props: TopBarProps) => renderToStaticMarkup(createElement(TopBar, props));

describe('TopBar', () => {
  it('draws the below slot right after the h1, inside the title block and outside any paragraph', () => {
    const html = bar({ title: 'Level 9', backLabel: 'Back to home', below: createElement(PuzzleDots, { solved: 2 }) });
    expect(html).toMatch(/<div class="bw-topbar__title"><h1>Level 9<\/h1><div class="bw-dots"[^>]*role="img"/);
    expect(html).not.toContain('<p>');
    // The dots' block never sits inside a <p>.
    expect(html).not.toMatch(/<p>[^]*bw-dots/);
  });

  it('keeps the subtitle paragraph, and puts the slot after it when both are given', () => {
    const html = bar({ title: 'Settings', subtitle: 'For grown-ups', below: createElement('span', { className: 'extra' }, 'x') });
    expect(html).toMatch(/<h1>Settings<\/h1><p>For grown-ups<\/p><span class="extra">x<\/span><\/div>/);
  });

  it('without a slot or subtitle the title block holds only the h1', () => {
    expect(bar({ title: 'Brick Escape' })).toContain('<div class="bw-topbar__title"><h1>Brick Escape</h1></div>');
  });

  it('back goes Home by default with the given label, and an empty slot stands in for a missing action', () => {
    const html = bar({ title: 'Stage 4', backLabel: 'Back to home' });
    expect(html).toMatch(/<a[^>]*href="#\/"[^>]*aria-label="Back to home"/);
    expect(html).toMatch(/<\/div><span aria-hidden="true"><\/span><\/header>$/);
  });
});
