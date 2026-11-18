/**
 * Usability round 2, app screens (decisions 20, 29, 31, 35): the speakers Voice off hides, the
 * Discoveries copy that no longer promises a sticker, the coming-soon notice at the top of Sign in and
 * Sign up, and the rule that holds a Home game card after Play as. Rendered on the server, as in
 * screensRender.test.ts.
 */
import { createElement, type RefObject } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { emptyState, progressStore, type Player } from '../../shared/progress';
import { CARD_GUARD_MS, holdCardTap } from '../Home';
import { answerNotice, pointAtSoon } from '../Signin';
import { StickerCard, howToGet, stickerPageLine } from '../Stickers';
import { SOON, authNotice } from './auth';
import { grownUpGate, setResumePath } from './session';
import { STICKERS } from './stickers';

function renderAt(hash: string): string {
  vi.stubGlobal('window', {
    location: { hash, pathname: '/', search: '', replace: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    innerWidth: 390,
    innerHeight: 844,
    setTimeout: () => 0,
    clearTimeout: () => {},
  });
  return renderToString(createElement(App));
}

const decode = (html: string) => html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const card = (props: Parameters<typeof StickerCard>[0]) => decode(renderToString(createElement(StickerCard, props)));
/** The visible text of each button and link, in order. */
const controls = (html: string) => [...html.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2].replace(/<[^>]+>/g, '').trim());

const discovery = STICKERS.find((s) => s.page === 'discoveries')!;
const gameSticker = STICKERS.find((s) => s.page === 'games' && s.game === 'escape')!;
const noop = () => {};

let leo: Player;

beforeEach(() => {
  progressStore.replace(emptyState());
  leo = progressStore.addPlayer({ name: 'Leo', ageBand: '5-6', color: 'orange' });
  progressStore.setActivePlayer(leo.id);
  progressStore.setSetting('voice', true);
  grownUpGate.reset();
});

afterEach(() => {
  grownUpGate.reset();
  setResumePath('/');
  vi.unstubAllGlobals();
});

describe('decision 20: speakers are hidden while Voice is off', () => {
  it('the sticker book has its page speaker with Voice on, and none with Voice off, keeping the empty right slot', () => {
    const on = decode(renderAt('#/stickers'));
    expect(on).toContain('aria-label="Read this page aloud"');
    progressStore.setSetting('voice', false);
    const off = decode(renderAt('#/stickers'));
    expect(off).not.toContain('Read this page aloud');
    // The top bar keeps three cells, so the title stays in the middle.
    expect(off).toMatch(/<header class="bw-topbar">[\s\S]*?<\/div><span aria-hidden="true"><\/span><\/header>/);
  });

  it('the missing-sticker card offers Hear how to get it with Voice on, and not with Voice off', () => {
    expect(card({ sticker: gameSticker, got: false, young: true, voice: true, onClose: noop })).toContain('aria-label="Hear how to get it"');
    const off = card({ sticker: gameSticker, got: false, young: true, voice: false, onClose: noop });
    expect(off).not.toContain('Hear how to get it');
    expect(controls(off)).toEqual(['Play Brick Escape', 'Close']);
  });

  it('an earned sticker’s card offers Say the name with Voice on; with Voice off only Close, which takes the focus', () => {
    const on = card({ sticker: gameSticker, got: true, young: true, voice: true, onClose: noop });
    expect(controls(on)).toEqual(['Say the name', 'Close']);
    const off = card({ sticker: gameSticker, got: true, young: true, voice: false, onClose: noop });
    expect(off).not.toContain('Say the name');
    expect(controls(off)).toEqual(['Close']);
    expect(off).toMatch(/<button[^>]*data-autofocus[^>]*>Close<\/button>/);
  });

  it('Break has Read it aloud with Voice on and not with Voice off, and keeps its top row', () => {
    progressStore.addMinutesPlayed(leo.dailyLimit);
    const on = decode(renderAt('#/break'));
    expect(on).toContain('aria-label="Read it aloud"');
    progressStore.setSetting('voice', false);
    const off = decode(renderAt('#/break'));
    expect(off).toContain('Time for a break, Leo');
    expect(off).not.toContain('Read it aloud');
    expect(off).toContain('<div class="sc-break__top"></div>');
  });
});

describe('decision 20 at every age band', () => {
  for (const ageBand of ['3-4', '5-6', '7-8', '9-10'] as const) {
    const young = ageBand === '3-4' || ageBand === '5-6';

    it(`ages ${ageBand}: the book's speaker follows Voice, and only ages 3 to 6 have one`, () => {
      progressStore.setActivePlayer(progressStore.addPlayer({ name: 'Ada', ageBand, color: 'blue' }).id);
      expect(decode(renderAt('#/stickers')).includes('Read this page aloud')).toBe(young);
      progressStore.setSetting('voice', false);
      expect(decode(renderAt('#/stickers'))).not.toContain('Read this page aloud');
    });

    it(`ages ${ageBand}: Break reads aloud only with Voice on`, () => {
      const ada = progressStore.addPlayer({ name: 'Ada', ageBand, color: 'blue' });
      progressStore.setActivePlayer(ada.id);
      progressStore.addMinutesPlayed(ada.dailyLimit);
      expect(decode(renderAt('#/break'))).toContain('aria-label="Read it aloud"');
      progressStore.setSetting('voice', false);
      const off = decode(renderAt('#/break'));
      expect(off).toContain('Time for a break, Ada');
      expect(off).not.toContain('Read it aloud');
    });
  }
});

describe('decision 29: Discoveries say Discovery stickers are coming soon.', () => {
  it('gives every discovery sticker the coming-soon line and no button to go anywhere', () => {
    for (const st of STICKERS.filter((s) => s.page === 'discoveries')) {
      const how = howToGet(st);
      expect(how.line, st.id).toBe('Discovery stickers are coming soon.');
      expect(how.cta, st.id).toBeNull();
      expect(how.from, st.id).toBe("From Today's discovery");
    }
  });

  it('a missing discovery sticker’s card has the line and only Close, at every age', () => {
    for (const young of [true, false]) {
      const html = card({ sticker: discovery, got: false, young, voice: false, onClose: noop });
      expect(html).toContain('<p class="sc-overlay__text">Discovery stickers are coming soon.</p>');
      expect(controls(html)).toEqual(['Close']);
      expect(html).not.toContain('Go to Home');
      expect(html).not.toContain('href=');
      // With no green button, Close takes the focus when the card opens.
      expect(html).toMatch(/<button[^>]*data-autofocus[^>]*>Close<\/button>/);
    }
  });

  it('at ages 3 to 6 with Voice on, the card keeps Hear how to get it beside Close', () => {
    const html = card({ sticker: discovery, got: false, young: true, voice: true, onClose: noop });
    expect(controls(html)).toEqual(['', 'Close']);
    expect(html).toContain('aria-label="Hear how to get it"');
  });

  it('an earned discovery sticker still says where it came from', () => {
    expect(card({ sticker: discovery, got: true, young: false, voice: true, onClose: noop })).toContain("From Today's discovery");
  });

  it('game stickers keep their call to action', () => {
    expect(howToGet(gameSticker)).toMatchObject({ cta: 'Play Brick Escape', play: true });
  });

  it('no Go to Home anywhere in the book', () => {
    expect(decode(renderAt('#/stickers'))).not.toContain('Go to Home');
  });
});

describe('decision 29: the line above a sticker page', () => {
  const COMING = 'Discovery stickers are coming soon.';

  it('Discoveries with none earned say coming soon, in an empty book and in a book with game stickers', () => {
    expect(stickerPageLine('discoveries', 0, 0, 12)).toBe(COMING);
    expect(stickerPageLine('discoveries', 1, 0, 12)).toBe(COMING);
    expect(stickerPageLine('discoveries', 28, 0, 12)).toBe(COMING);
  });

  it('a discovery sticker from old saved data still counts on its page', () => {
    expect(stickerPageLine('discoveries', 1, 1, 12)).toBe('1 of 12 on this page');
    expect(stickerPageLine('discoveries', 12, 12, 12)).toBe('You found every sticker on this page.');
  });

  it('the Games page keeps its lines: empty book, some found, every one found', () => {
    expect(stickerPageLine('games', 0, 0, 28)).toBe('Each game chapter you finish adds a sticker here.');
    expect(stickerPageLine('games', 3, 0, 28)).toBe('0 of 28 on this page');
    expect(stickerPageLine('games', 3, 3, 28)).toBe('3 of 28 on this page');
    expect(stickerPageLine('games', 28, 28, 28)).toBe('You found every sticker on this page.');
  });
});

describe('decision 31: Sign in and Sign up open with the coming-soon notice while accounts are off', () => {
  const notices = (html: string) => html.split(SOON.title).length - 1;

  it('Sign in shows the compact notice under its heading, before any field or provider button', () => {
    grownUpGate.pass();
    const html = decode(renderAt('#/signin'));
    expect(notices(html)).toBe(1);
    const at = html.indexOf(SOON.title);
    expect(at).toBeGreaterThan(html.indexOf('<h1>Welcome back</h1>'));
    expect(at).toBeLessThan(html.indexOf('<input'));
    expect(at).toBeLessThan(html.indexOf('Continue with Apple'));
    expect(html).toMatch(/<div role="status" class="sc-notice sc-notice--compact">/);
  });

  it('Sign up step 1 shows the compact notice under its heading, before any field or provider button', () => {
    grownUpGate.pass();
    const html = decode(renderAt('#/signup'));
    expect(notices(html)).toBe(1);
    const at = html.indexOf(SOON.title);
    expect(at).toBeGreaterThan(html.indexOf('<h1>Create your family account</h1>'));
    expect(at).toBeLessThan(html.indexOf('<input'));
    expect(at).toBeLessThan(html.indexOf('Continue with Apple'));
  });

  it('an answer that is the coming-soon note adds no second copy; errors, offline and no answer pass through', () => {
    expect(answerNotice(SOON)).toBeNull();
    expect(answerNotice(authNotice('not-enabled', 'apple'))).toBeNull();
    expect(answerNotice(null)).toBeNull();
    for (const reason of ['offline', 'wrong-credentials', 'too-many-tries', 'cancelled', 'provider-failed', 'unknown'] as const) {
      const notice = authNotice(reason, 'google');
      expect(answerNotice(notice), reason).toBe(notice);
    }
  });

  it('a coming-soon answer moves focus to the top notice; a success or any other answer leaves focus where it is', () => {
    const top = { focus: vi.fn(), scrollIntoView: vi.fn() };
    const at = { current: top } as unknown as RefObject<HTMLDivElement>;
    pointAtSoon(at, 'email', { ok: false, reason: 'not-enabled' });
    expect(top.focus).toHaveBeenCalledTimes(1);
    expect(top.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    for (const provider of ['apple', 'google', 'facebook'] as const) pointAtSoon(at, provider, { ok: false, reason: 'not-enabled' });
    expect(top.focus).toHaveBeenCalledTimes(4);
    pointAtSoon(at, 'email', { ok: true, value: null });
    pointAtSoon(at, 'google', { ok: false, reason: 'offline' });
    pointAtSoon(at, 'apple', { ok: false, reason: 'provider-failed' });
    expect(top.focus).toHaveBeenCalledTimes(4);
    // No notice on screen (the ref is empty): nothing to point at, and nothing throws.
    expect(() => pointAtSoon({ current: null }, 'email', { ok: false, reason: 'not-enabled' })).not.toThrow();
  });
});

describe('decision 35: a Home game card holds a finger tap just after Play as', () => {
  it('holds a finger tap inside 700 ms of arriving from Who’s playing', () => {
    expect(CARD_GUARD_MS).toBe(700);
    expect(holdCardTap(true, 'touch', 0)).toBe(true);
    expect(holdCardTap(true, 'touch', 250)).toBe(true);
    expect(holdCardTap(true, 'touch', 699)).toBe(true);
  });

  it('lets the tap through from 700 ms on', () => {
    expect(holdCardTap(true, 'touch', 700)).toBe(false);
    expect(holdCardTap(true, 'touch', 800)).toBe(false);
  });

  it('never holds a mouse, pen or keyboard activation, or a tap after arriving from anywhere else', () => {
    for (const type of ['mouse', 'pen', '']) expect(holdCardTap(true, type, 100), type).toBe(false);
    expect(holdCardTap(false, 'touch', 100)).toBe(false);
  });
});
