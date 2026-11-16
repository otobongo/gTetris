/**
 * Round 2: what PlayScreen hands the shared parts (decisions 8, 19, 20, 25). The shared ui module is
 * wrapped so each IconButton, PuzzleDots and LevelCard records the props it was given and then draws
 * itself as usual; the props batch ui adds (cue, capped, sticker) are checked here before that batch
 * is merged, and their visible results in e2e/postmerge-kit.spec.ts afterwards.
 *
 * - Decision 8: the offer's New puzzle button gets `cue` only at ages 3 to 4.
 * - Decision 19: the level card gets the run's `sticker` as it is.
 * - Decision 20: with Voice off there is no speaker at all, and the top bar's right cell is its empty slot.
 * - Decision 25: the dots get `capped` from `run.hintCapped`.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyState, progressStore, type AgeBand } from '../../shared/progress';
import type { LevelCardProps } from '../../shared/ui/LevelCard';
import { BACK_TO_GAMES, LEVEL_RULE, OFFER_LINE, OFFER_NAME, READ_HELP_ALOUD, levelDoneTitle, playLabel, slipFact } from './copy';
import type { LevelRunApi } from './levelRun';
import { PlayScreen } from './PlayScreen';

type Props = Record<string, unknown>;
const seen = vi.hoisted(() => ({ icon: [] as Record<string, unknown>[], dots: [] as Record<string, unknown>[], card: [] as Record<string, unknown>[] }));

vi.mock('../../shared/ui', async (orig) => {
  const real = await orig<typeof import('../../shared/ui')>();
  return {
    ...real,
    IconButton: (p: Parameters<typeof real.IconButton>[0]) => {
      seen.icon.push(p as unknown as Props);
      return real.IconButton(p);
    },
    PuzzleDots: (p: Parameters<typeof real.PuzzleDots>[0]) => {
      seen.dots.push(p as unknown as Props);
      return real.PuzzleDots(p);
    },
    LevelCard: (p: Parameters<typeof real.LevelCard>[0]) => {
      seen.card.push(p as unknown as Props);
      return real.LevelCard(p);
    },
  };
});

const noop = () => {};

function runOf(over: Partial<LevelRunApi<null>> = {}): LevelRunApi<null> {
  return {
    phase: 'play',
    level: 0,
    puzzleNo: 0,
    puzzle: null,
    band: '5-6',
    dots: { solved: 0, at: 1 },
    offer: false,
    shared: null,
    slip: noop,
    progress: noop,
    hold: noop,
    solve: noop,
    swap: noop,
    next: noop,
    hint: null,
    card: null,
    round: 0,
    finish: null,
    slot: 'controls',
    hintCapped: false,
    ...over,
  };
}

const SPEAKER = { label: 'Hear the question', text: 'Can you make green?' };

function draw(run: Partial<LevelRunApi<null>> = {}) {
  seen.icon.length = 0;
  seen.dots.length = 0;
  seen.card.length = 0;
  return renderToStaticMarkup(
    createElement(PlayScreen<null>, {
      run: runOf(run),
      speaker: SPEAKER,
      line: 'Tap the paint that makes green.',
      lineStyle: 'help',
      controls: createElement('button', { type: 'button' }, 'Red paint'),
    }),
  ).replace(/&#x27;/g, "'");
}

const iconNamed = (label: string) => seen.icon.find((p) => p.label === label);

beforeEach(() => progressStore.replace(emptyState()));
afterAll(() => progressStore.replace(emptyState()));

describe('decision 8: the offer cue at ages 3 to 4', () => {
  const bands: [AgeBand, boolean][] = [
    ['3-4', true],
    ['5-6', false],
    ['7-8', false],
    ['9-10', false],
  ];
  it.each(bands)('band %s: New puzzle gets cue %s, and nothing else about the offer changes', (band, cue) => {
    draw({ band, offer: true, shared: 'offer' });
    const offer = iconNamed(OFFER_NAME);
    expect(offer).toBeDefined();
    expect(offer!.cue).toBe(cue);
    expect(offer).toMatchObject({ icon: 'swap', variant: 'green', className: 'bw-appear' });
    // the speaker is never cued
    expect(iconNamed(READ_HELP_ALOUD)!.cue).toBeUndefined();
  });
});

describe('decision 25: the capped-star mark', () => {
  it('passes capped from run.hintCapped and leaves the dots as they are', () => {
    draw({ hintCapped: true, dots: { solved: 1, at: 2 } });
    expect(seen.dots).toHaveLength(1);
    expect(seen.dots[0]).toMatchObject({ solved: 1, puzzle: 2, capped: true });
    draw({ hintCapped: false, dots: { solved: 1, at: 2 } });
    expect(seen.dots[0]).toMatchObject({ solved: 1, puzzle: 2, capped: false });
  });
});

describe('decision 19: the sticker on the level card', () => {
  const card = (over: Partial<LevelCardProps> & Props = {}): LevelCardProps => ({
    title: levelDoneTitle(3),
    stars: 3,
    fact: slipFact(0),
    rule: LEVEL_RULE,
    primary: { label: playLabel(4), onClick: noop },
    secondary: { label: BACK_TO_GAMES, href: '#/' },
    onClose: noop,
    ...over,
  });
  const STAR = { name: 'Star', cells: Array.from({ length: 25 }, (_, i) => (i % 2 ? 'yellow' : null)) };

  it('hands the card the run’s sticker as it is', () => {
    draw({ phase: 'done', slot: 'empty', card: card({ sticker: STAR }) });
    expect(seen.card).toHaveLength(1);
    expect(seen.card[0].sticker).toEqual(STAR);
  });

  it('hands no sticker when the run has none', () => {
    draw({ phase: 'done', slot: 'empty', card: card() });
    expect(seen.card).toHaveLength(1);
    expect(seen.card[0].sticker).toBeUndefined();
  });
});

describe('decision 20: no speaker while Voice is off', () => {
  /** The header's last cell: the action, or the empty slot. */
  const rightCell = (html: string) => {
    const header = /<header class="bw-topbar">([\s\S]*?)<\/header>/.exec(html)![1];
    return header.slice(header.lastIndexOf('</div>') + 6);
  };

  it('Voice on: the speaker is there, as today', () => {
    const html = draw();
    expect(iconNamed(SPEAKER.label)).toBeDefined();
    expect(rightCell(html)).toContain(`aria-label="${SPEAKER.label}"`);
    draw({ offer: true, shared: 'offer' });
    expect(iconNamed(READ_HELP_ALOUD)).toBeDefined();
  });

  it('Voice off: no Hear the question and no Read the help line aloud, and the right cell is the empty slot', () => {
    progressStore.setSetting('voice', false);
    const html = draw();
    expect(iconNamed(SPEAKER.label)).toBeUndefined();
    expect(html).not.toContain('Hear the question');
    expect(rightCell(html)).toBe('<span aria-hidden="true"></span>');

    const offered = draw({ offer: true, shared: 'offer' });
    expect(iconNamed(READ_HELP_ALOUD)).toBeUndefined();
    expect(offered).not.toContain(READ_HELP_ALOUD);
    // the offer itself stays, and so does its line
    expect(iconNamed(OFFER_NAME)).toBeDefined();
    expect(offered).toContain(OFFER_LINE);
  });

  it('Voice turned back on brings the speaker back on the next draw', () => {
    progressStore.setSetting('voice', false);
    draw();
    expect(iconNamed(SPEAKER.label)).toBeUndefined();
    progressStore.setSetting('voice', true);
    draw();
    expect(iconNamed(SPEAKER.label)).toBeDefined();
  });
});
