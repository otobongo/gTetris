/**
 * The kit's visual parts, server-rendered (six-games brief 3.1, 7.2, 8.1, 9.1, 10.1): the play frame in
 * each state a level goes through, the help row's cell order, the choice row's marks, the finished
 * state and the route guard. PlayScreen takes the level as a prop (`run`), so each state is drawn from
 * a run built here, with no store. Focus, timing and taps need a page: src/games/playScreens.test.ts
 * covers them on a stand-in DOM.
 */
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { emptyState, progressStore } from '../../shared/progress';
import type { LevelCardProps } from '../../shared/ui/LevelCard';
import { meta as mixerMeta } from '../mixer/meta';
import { meta as numbersMeta } from '../numbers/meta';
import { CHOICE_WRONG_MS, ChoiceRow, type ChoiceRowProps, type ChoiceState } from './ChoiceRow';
import {
  BACK_TO_GAMES,
  GAME_DONE_NOTE,
  GAME_DONE_TITLE,
  HINT_CAP,
  LEVEL_RULE,
  NEXT_PUZZLE,
  OFFER_LINE,
  OFFER_NAME,
  READ_HELP_ALOUD,
  SWAPPED_LINE,
  gameDoneFact,
  levelDoneTitle,
  playLabel,
  slipFact,
} from './copy';
import { Finished } from './Finished';
import { GameApp } from './GameApp';
import { HelpRow, type HelpRowProps } from './HelpRow';
import type { LevelRunApi } from './levelRun';
import { FIRST_CONTROL, PlayScreen, type PlayScreenProps } from './PlayScreen';

/* ---------- Reading the markup ---------- */

const decode = (html: string) =>
  html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const render = (node: ReactNode) => decode(renderToStaticMarkup(node as Parameters<typeof renderToStaticMarkup>[0]));

/** The opening tag that holds `needle` (an attribute, a class), and its start in `html`. */
function openingTag(html: string, needle: string, from = 0): { tag: string; start: number } {
  const at = html.indexOf(needle, from);
  if (at < 0) throw new Error(`Nothing holds ${needle}`);
  const start = html.lastIndexOf('<', at);
  return { tag: html.slice(start, html.indexOf('>', at) + 1), start };
}

/** The whole element whose opening tag holds `needle`, children included. */
function element(html: string, needle: string, from = 0): string {
  const { start } = openingTag(html, needle, from);
  const name = /^<([a-zA-Z0-9]+)/.exec(html.slice(start))![1];
  const re = new RegExp(`<(/?)${name}(?=[\\s>/])[^>]*?(/?)>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1]) depth--;
    else if (!m[2]) depth++;
    if (depth === 0) return html.slice(start, re.lastIndex);
  }
  throw new Error(`No end for ${needle}`);
}

const attrOf = (tag: string, name: string): string | null => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const count = (html: string, needle: string) => html.split(needle).length - 1;
/** Text with the tags taken out. */
const text = (html: string) => html.replace(/<[^>]+>/g, '');
/** The accessible names of every element with an aria-label, in markup order. */
const labels = (html: string) => [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);

/* ---------- A level, as useLevelRun hands it to a Play screen ---------- */

const noop = () => {};

function runOf(over: Partial<LevelRunApi<null>> = {}): LevelRunApi<null> {
  return {
    phase: 'play',
    level: 2,
    puzzleNo: 0,
    puzzle: null,
    band: '5-6',
    dots: { solved: 1, at: 2 },
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
    ...over,
  };
}

const levelCard = (over: Partial<LevelCardProps> = {}): LevelCardProps => ({
  title: levelDoneTitle(3),
  stars: 2,
  fact: slipFact(3),
  rule: LEVEL_RULE,
  primary: { label: playLabel(4), onClick: noop },
  secondary: { label: BACK_TO_GAMES, href: '#/' },
  onClose: noop,
  ...over,
});

const finishOf = (next: number | null) => ({ stars: 2, next, results: [] });

function screen(over: Partial<PlayScreenProps<null>> = {}, run: Partial<LevelRunApi<null>> = {}) {
  return render(
    createElement(PlayScreen<null>, {
      run: runOf(run),
      speaker: { label: 'Hear the question', text: 'Can you make green?' },
      line: 'Tap the paint that makes green.',
      lineStyle: 'help',
      top: createElement('div', { className: 'game-top' }, 'the goal chip'),
      children: createElement('div', { className: 'game-body' }, 'the board'),
      controls: createElement('button', { type: 'button', className: 'game-pot' }, 'Red paint'),
      ...over,
    }),
  );
}

/* ---------- HelpRow ---------- */

const row = (props: Partial<HelpRowProps> = {}) => render(createElement(HelpRow, { line: 'Drag each shape into its hole.', ...props }));

describe('HelpRow', () => {
  it('puts the line first, then the hint, then the offer, so the offer is last to tab to (brief 3.1, 9.1)', () => {
    const html = row({
      hint: createElement('button', { type: 'button', 'aria-label': 'Hint, 3 left' }),
      offer: createElement('button', { type: 'button', 'aria-label': OFFER_NAME }),
    });
    const line = html.indexOf('bw-helprow__line');
    const hint = html.indexOf('bw-helprow__hint');
    const offer = html.indexOf('bw-helprow__offer');
    expect(line).toBeGreaterThan(0);
    expect(hint).toBeGreaterThan(line);
    expect(offer).toBeGreaterThan(hint);
    expect(labels(html)).toEqual(['Hint, 3 left', OFFER_NAME]);
    expect(element(html, 'bw-helprow__offer')).toContain(`aria-label="${OFFER_NAME}"`);
    expect(element(html, 'bw-helprow__hint')).toContain('aria-label="Hint, 3 left"');
  });

  it('makes the line the row’s one status region, in the help style by default', () => {
    const html = row();
    expect(count(html, 'role="status"')).toBe(1);
    const { tag } = openingTag(html, 'role="status"');
    expect(tag).toMatch(/^<p /);
    expect(attrOf(tag, 'class')).toBe('bw-helprow__line bw-helprow__line--help');
    expect(text(element(html, 'role="status"'))).toBe('Drag each shape into its hole.');
    expect(html).not.toContain('aria-live');
  });

  it('draws a wrong line in the error colour in the prompt style only (brief 7.2)', () => {
    expect(attrOf(openingTag(row({ lineStyle: 'prompt', wrong: true }), 'role="status"').tag, 'class')).toBe(
      'bw-helprow__line bw-helprow__line--prompt is-wrong',
    );
    expect(attrOf(openingTag(row({ lineStyle: 'prompt' }), 'role="status"').tag, 'class')).toBe('bw-helprow__line bw-helprow__line--prompt');
    // The help style never turns red: Mixer, Pattern, Calculator and Builder say a slip in their own words.
    expect(row({ lineStyle: 'help', wrong: true })).not.toContain('is-wrong');
  });

  it('keeps both side cells when they are empty, so the line never moves when the offer comes and goes', () => {
    const html = row({ hint: null, offer: null });
    expect(element(html, 'bw-helprow__hint')).toBe('<span class="bw-helprow__hint"></span>');
    expect(element(html, 'bw-helprow__offer')).toBe('<span class="bw-helprow__offer"></span>');
    expect(attrOf(openingTag(row({ className: 'mix-help' }), 'bw-helprow').tag, 'class')).toBe('bw-helprow mix-help');
  });
});

/* ---------- ChoiceRow ---------- */

type Color = 'orange' | 'green' | 'purple';
const COLORS: Color[] = ['orange', 'green', 'purple'];
const NAMES: Record<Color, string> = { orange: 'Orange', green: 'Green', purple: 'Purple' };

function choices(over: Partial<ChoiceRowProps<Color>> = {}, seen: ChoiceState[] = []) {
  return render(
    createElement(ChoiceRow<Color>, {
      items: COLORS,
      name: (c) => NAMES[c],
      isRight: (c) => c === 'green',
      onPick: noop,
      locked: false,
      children: (c, _i, state) => {
        seen.push(state);
        return createElement('span', { className: 'tile', 'data-color': c }, NAMES[c]);
      },
      ...over,
    }),
  );
}

describe('ChoiceRow', () => {
  it('draws each answer as a plain button named by what it shows, in order, at rest', () => {
    const seen: ChoiceState[] = [];
    const html = choices({}, seen);
    expect(labels(html)).toEqual(['Orange', 'Green', 'Purple']);
    expect(count(html, '<button type="button" class="bw-choice"')).toBe(3);
    expect(html).not.toContain('is-wrong');
    expect(html).not.toContain('is-right');
    expect(seen).toEqual(['idle', 'idle', 'idle']);
    // The game draws its own tile inside each button.
    expect(count(html, 'class="tile"')).toBe(3);
  });

  it('is a named group when the game names it, and a plain row when it does not', () => {
    expect(openingTag(choices({ label: 'Colors' }), 'bw-choices').tag).toBe('<div class="bw-choices" role="group" aria-label="Colors">');
    expect(openingTag(choices(), 'bw-choices').tag).toBe('<div class="bw-choices">');
  });

  it('locks every choice with aria-disabled after the solve, and never with disabled, so each keeps its name for a reader', () => {
    const locked = choices({ locked: true });
    expect(count(locked, 'aria-disabled="true"')).toBe(3);
    expect(locked).not.toMatch(/\sdisabled(=|\s|>)/);
    expect(choices({ locked: false })).not.toContain('aria-disabled');
  });

  it('adds the game’s own class to each button and the row', () => {
    const html = choices({ className: 'mix-shelf', choiceClassName: 'mix-pot' });
    expect(openingTag(html, 'bw-choices').tag).toContain('class="bw-choices mix-shelf"');
    expect(count(html, 'class="bw-choice mix-pot"')).toBe(3);
  });

  it('brings a wrong choice back after 500 ms (brief 7.2)', () => {
    expect(CHOICE_WRONG_MS).toBe(500);
  });
});

/* ---------- PlayScreen ---------- */

describe('PlayScreen while a puzzle is in play', () => {
  const html = screen();

  it('titles the screen "Level N" with the dots under it, Back to home on the left and the speaker on the right (8.1, 9.1)', () => {
    const bar = element(html, 'bw-topbar');
    expect(element(bar, '<h1')).toBe('<h1>Level 3</h1>');
    expect(openingTag(bar, 'aria-label="Back to home"').tag).toMatch(/^<a [^>]*href="#\/"/);
    const dots = openingTag(bar, 'bw-dots').tag;
    expect(attrOf(dots, 'role')).toBe('img');
    expect(attrOf(dots, 'aria-label')).toBe('Puzzle 2 of 4. 1 solved.');
    expect(dots).not.toContain('aria-live');
    // Back, the dots and the speaker, in that order.
    expect(labels(bar)).toEqual(['Back to home', 'Puzzle 2 of 4. 1 solved.', 'Hear the question']);
    expect(openingTag(bar, 'aria-label="Hear the question"').tag).toMatch(/^<button /);
  });

  it('lays out the game’s top, the help row, the game’s body and the controls slot, top to bottom (3.1)', () => {
    const order = ['bw-topbar', 'game-top', 'bw-helprow', 'game-body', 'bw-play__slot', 'game-pot'].map((n) => html.indexOf(n));
    expect(order.every((at) => at > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(text(element(html, 'role="status"'))).toBe('Tap the paint that makes green.');
  });

  it('holds the game’s own controls in the slot, live, with no Next and no card', () => {
    const slot = element(html, 'bw-play__slot');
    expect(attrOf(openingTag(slot, 'bw-play__slot').tag, 'data-slot')).toBe('controls');
    const controls = openingTag(slot, 'bw-play__controls').tag;
    expect(controls).not.toContain('inert');
    expect(controls).not.toContain('aria-hidden');
    expect(slot).toContain('Red paint');
    expect(html).not.toContain('bw-next');
    expect(html).not.toContain(NEXT_PUZZLE);
    expect(html).not.toContain('role="dialog"');
    // No stuck offer yet: the offer cell is empty.
    expect(element(html, 'bw-helprow__offer')).toBe('<span class="bw-helprow__offer"></span>');
  });

  it('marks nothing as the first control by itself: the game opts in with FIRST_CONTROL', () => {
    expect(FIRST_CONTROL).toBe('data-kit-first');
    expect(html).not.toContain(FIRST_CONTROL);
  });

  it('puts the game’s classes on the frame and the slot', () => {
    const own = screen({ className: 'mix-screen', slotClassName: 'mix-controls' });
    expect(own).toContain('class="bw-screen__frame bw-screen__frame--standard bw-play mix-screen"');
    expect(attrOf(openingTag(own, 'bw-play__slot').tag, 'class')).toBe('bw-play__slot mix-controls');
  });

  it('shows the hint in the help row’s right cell, before the offer cell', () => {
    const own = screen({ hint: createElement('button', { type: 'button', 'aria-label': 'Hint, 3 left' }) });
    expect(element(own, 'bw-helprow__hint')).toContain('aria-label="Hint, 3 left"');
  });

  it('turns a prompt-style line red for a wrong move, and leaves a help-style line alone', () => {
    expect(openingTag(screen({ lineStyle: 'prompt', wrong: true, line: 'That hole is for the square.' }), 'role="status"').tag).toContain('is-wrong');
    expect(openingTag(screen({ lineStyle: 'help', wrong: true }), 'role="status"').tag).not.toContain('is-wrong');
  });

  it('draws no top block when the game has none', () => {
    expect(screen({ top: undefined })).not.toContain('bw-play__top');
    expect(html).toContain('bw-play__top');
  });
});

describe('PlayScreen once the puzzle is solved', () => {
  const html = screen({ line: 'You made green.' }, { phase: 'solved', slot: 'next', dots: { solved: 2, at: 2 } });

  it('fills the dot, states the result and puts Next puzzle in the controls slot (8.1)', () => {
    expect(attrOf(openingTag(html, 'bw-dots').tag, 'aria-label')).toBe('Puzzle 2 of 4. 2 solved.');
    expect(text(element(html, 'role="status"'))).toBe('You made green.');
    const slot = element(html, 'bw-play__slot');
    expect(attrOf(openingTag(slot, 'bw-play__slot').tag, 'data-slot')).toBe('next');
    const next = element(slot, 'bw-next');
    expect(next).toMatch(/^<button type="button" class="bw-press bw-press--lg bw-next bw-appear" data-tone="green"/);
    expect(text(next)).toBe(NEXT_PUZZLE);
  });

  it('keeps the game’s controls in place but hidden and inert, so the slot keeps its height (7.2)', () => {
    const slot = element(html, 'bw-play__slot');
    const controls = openingTag(slot, 'bw-play__controls').tag;
    expect(controls).toContain('inert=""');
    expect(attrOf(controls, 'aria-hidden')).toBe('true');
    expect(slot).toContain('Red paint');
    // The controls come first and Next is drawn over them.
    expect(slot.indexOf('bw-play__controls')).toBeLessThan(slot.indexOf('bw-next'));
  });

  it('shows no offer once the puzzle is solved', () => {
    expect(html).not.toContain(OFFER_LINE);
    expect(html).not.toContain(`aria-label="${OFFER_NAME}"`);
  });
});

describe('PlayScreen with the stuck offer', () => {
  const html = screen({ lineStyle: 'prompt', wrong: true, line: 'That hole is for the square.' }, { offer: true, shared: 'offer' });

  it('swaps the game’s line for the offer line and puts New puzzle in the left cell (8.1)', () => {
    expect(text(element(html, 'role="status"'))).toBe(OFFER_LINE);
    const offer = element(html, 'bw-helprow__offer');
    const button = openingTag(offer, `aria-label="${OFFER_NAME}"`).tag;
    expect(button).toMatch(/^<button type="button" class="bw-iconbtn bw-appear" data-tone="green"/);
    // The offer is never the focus target: it carries no autofocus marker.
    expect(offer).not.toContain('data-autofocus');
    expect(offer).not.toContain(FIRST_CONTROL);
  });

  it('names the speaker "Read the help line aloud" while the offer shows (8.1)', () => {
    expect(labels(element(html, 'bw-topbar'))).toEqual(['Back to home', 'Puzzle 2 of 4. 1 solved.', READ_HELP_ALOUD]);
  });

  it('does not paint the offer line as a wrong answer', () => {
    expect(openingTag(html, 'role="status"').tag).not.toContain('is-wrong');
  });

  it('keeps the dots and the controls as they were', () => {
    expect(attrOf(openingTag(html, 'bw-dots').tag, 'aria-label')).toBe('Puzzle 2 of 4. 1 solved.');
    expect(attrOf(openingTag(html, 'bw-play__slot').tag, 'data-slot')).toBe('controls');
  });
});

describe('PlayScreen after a swap', () => {
  it('says "Here is a different puzzle." in place of the game’s line, with no offer button (8.1)', () => {
    const html = screen({}, { shared: 'swapped' });
    expect(text(element(html, 'role="status"'))).toBe(SWAPPED_LINE);
    expect(element(html, 'bw-helprow__offer')).toBe('<span class="bw-helprow__offer"></span>');
    expect(labels(element(html, 'bw-topbar'))).toContain('Hear the question');
  });
});

describe('PlayScreen at the level’s end', () => {
  const done = { phase: 'done' as const, dots: { solved: 4, at: 4 }, finish: finishOf(3) };

  it('shows nothing in the slot while the level card waits its 600 ms (four-puzzle 2.1)', () => {
    const html = screen({}, { ...done, slot: 'empty' });
    expect(attrOf(openingTag(html, 'bw-dots').tag, 'aria-label')).toBe('4 of 4 solved.');
    expect(attrOf(openingTag(html, 'bw-play__slot').tag, 'data-slot')).toBe('empty');
    expect(html).not.toContain('bw-next');
    expect(html).not.toContain('role="dialog"');
    expect(openingTag(html, 'bw-play__controls').tag).toContain('inert=""');
  });

  it('opens the level card: title, stars, slips, the star rule, Play Level N and Back to games (8.1)', () => {
    const html = screen({}, { ...done, slot: 'empty', card: levelCard() });
    const dialog = element(html, 'role="dialog"');
    expect(text(element(dialog, '<h2'))).toBe('You finished Level 3');
    expect(dialog).toContain('aria-label="2 of 3 stars"');
    expect(dialog).toContain('4 puzzles, 3 slips.');
    expect(dialog).toContain('3 stars: 1 slip or none. 2 stars: 4 slips or fewer.');
    expect(dialog).not.toContain(HINT_CAP);
    expect(text(element(dialog, 'data-autofocus'))).toBe('Play Level 4');
    expect(openingTag(dialog, 'bw-levelcard__secondary').tag).toMatch(/^<a [^>]*href="#\/"/);
    // The card covers the slot, which stays empty behind it.
    expect(html).not.toContain('bw-next');
  });

  it('adds the cap line to the card only when a hint capped the level (Number Line-up)', () => {
    const html = screen({}, { ...done, slot: 'empty', card: levelCard({ cap: HINT_CAP }) });
    expect(element(html, 'role="dialog"')).toContain('Using a hint caps the level at 2 stars.');
  });

  it('puts the same Play Level N in the slot once the card is closed with Escape or the scrim (four-puzzle 10)', () => {
    const html = screen({}, { ...done, slot: 'play' });
    expect(html).not.toContain('role="dialog"');
    const next = element(element(html, 'bw-play__slot'), 'bw-next');
    expect(next).toMatch(/^<button /);
    expect(text(next)).toBe('Play Level 4');
  });

  it('puts Back to games in the slot when the closed card was the last level’s', () => {
    const html = screen({}, { ...done, finish: finishOf(null), slot: 'home' });
    const back = element(element(html, 'bw-play__slot'), 'bw-next');
    expect(back).toMatch(/^<a [^>]*href="#\/"/);
    expect(text(back)).toBe(BACK_TO_GAMES);
  });

  it('draws nothing in the slot for a Play Level with no level to play', () => {
    expect(screen({}, { ...done, finish: finishOf(null), slot: 'play' })).not.toContain('bw-next');
    expect(screen({}, { ...done, finish: null, slot: 'play' })).not.toContain('bw-next');
  });
});

/* ---------- Finished ---------- */

const MIXER = { id: 'mixer' as const, meta: mixerMeta, title: 'Color Mixer' };
const NUMBERS = { id: 'numbers' as const, meta: numbersMeta, title: 'Number Line-up' };

function starAll(game: string, levels: number, stars: (level: number) => number) {
  for (let i = 0; i < levels; i++) progressStore.recordStars(game, i, stars(i));
}

describe('Finished', () => {
  beforeEach(() => {
    progressStore.replace(emptyState());
  });
  afterAll(() => progressStore.replace(emptyState()));

  const finished = (game: typeof MIXER | typeof NUMBERS, className?: string) =>
    render(createElement(Finished, { game, className }, createElement('div', { className: 'empty-bowl' }, 'the empty bowl')));

  it('names the game in the top bar, with no dots and no speaker (four-puzzle 2.5)', () => {
    progressStore.addPlayer({ name: 'Maya', ageBand: '5-6', color: 'blue' });
    starAll('mixer', 9, (i) => (i < 6 ? 3 : 2));
    const html = finished(MIXER);
    const bar = element(html, 'bw-topbar');
    expect(element(bar, '<h1')).toBe('<h1>Color Mixer</h1>');
    expect(labels(bar)).toEqual(['Back to home']);
    expect(html).not.toContain('bw-dots');
  });

  it('shows the game’s star total, never the last level’s stars, with the note and one way back (D6, 8.1)', () => {
    progressStore.addPlayer({ name: 'Maya', ageBand: '5-6', color: 'blue' });
    starAll('mixer', 9, (i) => (i < 6 ? 3 : 2));
    const dialog = element(finished(MIXER), 'role="dialog"');
    expect(text(element(dialog, '<h2'))).toBe(GAME_DONE_TITLE);
    expect(dialog).toContain('aria-label="24 of 27 stars"');
    expect(dialog).not.toMatch(/aria-label="\d of 3 stars"/);
    expect(dialog).toContain(gameDoneFact(9, 24));
    expect(dialog).toContain('9 levels, 24 of 27 stars.');
    expect(dialog).toContain(GAME_DONE_NOTE);
    expect(dialog).not.toContain(LEVEL_RULE);
    // One button only, a link Home, where focus starts.
    expect(count(dialog, '<a ')).toBe(1);
    expect(count(dialog, '<button')).toBe(0);
    const back = openingTag(dialog, '<a ').tag;
    expect(attrOf(back, 'href')).toBe('#/');
    expect(back).toContain('data-autofocus');
    expect(text(element(dialog, '<a '))).toBe(BACK_TO_GAMES);
  });

  it('draws the game’s empty play area behind the card, hidden from assistive tech and inert', () => {
    progressStore.addPlayer({ name: 'Maya', ageBand: '5-6', color: 'blue' });
    const html = finished(MIXER, 'mix-screen');
    const body = openingTag(html, 'bw-play__body').tag;
    expect(attrOf(body, 'aria-hidden')).toBe('true');
    expect(body).toContain('inert=""');
    expect(element(html, 'bw-play__body')).toContain('the empty bowl');
    expect(html).toContain('bw-play mix-screen');
    // Nothing behind the card can be played.
    expect(html).not.toContain('bw-helprow');
    expect(html).not.toContain('bw-play__slot');
  });

  it('counts every level of a twelve-level game, and 0 stars with no child to read', () => {
    progressStore.addPlayer({ name: 'Leo', ageBand: '9-10', color: 'orange' });
    starAll('numbers', 12, () => 3);
    expect(finished(NUMBERS)).toContain('12 levels, 36 of 36 stars.');
    progressStore.replace(emptyState());
    const none = finished(MIXER);
    expect(none).toContain('9 levels, 0 of 27 stars.');
    expect(none).toContain('aria-label="0 of 27 stars"');
  });
});

/* ---------- GameApp ---------- */

describe('GameApp', () => {
  beforeEach(() => {
    progressStore.replace(emptyState());
    progressStore.addPlayer({ name: 'Maya', ageBand: '5-6', color: 'blue' });
  });
  afterAll(() => progressStore.replace(emptyState()));

  const app = (params: string[]) =>
    render(
      createElement(GameApp, {
        game: MIXER,
        params,
        play: (level: number) => createElement('p', { className: 'played' }, `level ${level}`),
        finished: () => createElement('p', { className: 'finished' }, 'finished'),
      }),
    );

  it('plays only the current level, with the 0-based index (brief 3.1)', () => {
    starAll('mixer', 2, () => 3);
    expect(app(['3'])).toBe('<p class="played">level 2</p>');
    // Any other level, finished or past the frontier, draws nothing and goes back to the game.
    for (const p of [['1'], ['2'], ['4'], ['9'], ['10'], ['0'], ['x'], ['3', 'x'], []]) expect(app(p), p.join('/')).toBe('');
  });

  it('shows the finished state on the game itself once every level has stars, and plays no level then', () => {
    starAll('mixer', 9, () => 1);
    expect(app([])).toBe('<p class="finished">finished</p>');
    for (const n of ['1', '9']) expect(app([n])).toBe('');
  });

  it('plays a grown-up’s pick, a level the child has not reached', () => {
    progressStore.pickLevel('mixer', 6, 9);
    expect(app(['7'])).toBe('<p class="played">level 6</p>');
    expect(app(['1'])).toBe('');
  });
});
