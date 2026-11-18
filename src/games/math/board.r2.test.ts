/** Brick Calculator's design board (design/canvas/Math.dc.html), usability round 2: the board has to show what the
    app does. Its script runs here without the canvas host. Decision 7: the board's speaker says the app's sentences.
    Decision 8: the New puzzle ring and its note, with the keyboard focus ring still drawn. Decision 19: the sticker on
    the level card is the real "Plus sign". Decision 28: the take-away number is blue. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STICKERS } from '../../screens/logic/stickers';
import { spokenHelp } from './copy';
import type { HelpKind } from './entry';

const html = readFileSync(resolve(process.cwd(), 'design/canvas/Math.dc.html'), 'utf8');
const script = /<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';
const css = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
const offerButton = /<button[^>]*aria-label="New puzzle"[^>]*>/.exec(html)?.[0] ?? '';

interface Vals {
  speak: () => void;
  bColor: string;
  showOffer: boolean;
  offerCue: string;
  cueNote: boolean;
  showSticker: boolean;
  stickerCells: { style: string }[];
  stickerLine: string;
  aText: string;
  opText: string;
  bText: string;
}
interface Board {
  props: Record<string, string>;
  say: (text: string) => void;
  press: (key: string) => void;
  renderVals: () => Vals;
}

class DCLogic {
  state: unknown;
  setState(next: unknown) {
    this.state = next;
  }
}
const Component = new Function('DCLogic', `${script}\nreturn Component;`)(DCLogic) as new (props: Record<string, string>) => Board;

/** A board on these levers, with what it says collected instead of spoken. */
function board(levers: Record<string, string>) {
  const props = { device: 'phone', level: 'add', puzzle: '1', moment: 'play', sticker: 'none', ...levers };
  const b = new Component(props);
  b.props = props;
  const spoken: string[] = [];
  b.say = (text) => spoken.push(text);
  return { b, spoken };
}

/** The sum a board shows, in the shape the app's copy reads. */
function sumOn(b: Board) {
  const v = b.renderVals();
  const [a, c] = [Number(v.aText), Number(v.bText)];
  const op = v.opText === '+' ? ('plus' as const) : ('minus' as const);
  return { op, a, b: c, answer: op === 'plus' ? a + c : a - c };
}

/** A two-digit number that is not this sum's answer. */
const wrongFor = (answer: number) => (answer === 11 ? ['2', '2'] : ['1', '1']);

function sendWrong(b: Board, answer: number) {
  for (const d of wrongFor(answer)) b.press(d);
  b.press('=');
}

describe('the board speaker says what the app says (decision 7)', () => {
  const heard = (spoken: string[], b: Board) => {
    spoken.length = 0;
    b.renderVals().speak();
    return spoken;
  };
  const says = (p: ReturnType<typeof sumOn>, help: HelpKind, solved = false) => [spokenHelp(p, solved, help)];

  for (const level of ['add', 'take'])
    it(`reads the sum, the slip sentence, the third-digit sentence and the solved line on the ${level} level`, () => {
      const { b, spoken } = board({ level });
      const p = sumOn(b);
      expect(heard(spoken, b)).toEqual(says(p, 'start'));

      sendWrong(b, p.answer);
      expect(heard(spoken, b)).toEqual(says(p, 'slip'));

      // A digit takes the slip line away, so the speaker goes back to the sum.
      b.press('1');
      expect(heard(spoken, b)).toEqual(says(p, 'start'));

      b.press('2');
      b.press('3');
      expect(heard(spoken, b)).toEqual(says(p, 'full'));

      b.press('C');
      expect(heard(spoken, b)).toEqual(says(p, 'start'));

      for (const d of String(p.answer)) b.press(d);
      b.press('=');
      expect(heard(spoken, b)).toEqual(says(p, 'start', true));
    });

  it('still reads the offer line while the offer shows', () => {
    const { b, spoken } = board({ moment: 'stuck' });
    expect(heard(spoken, b)).toEqual(['This one is tricky. Want a different puzzle?']);
  });
});

describe('the New puzzle ring on the board (decision 8)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('draws the ring from the stylesheet, so the keyboard focus ring still shows on the button', () => {
    expect(offerButton).toContain('aria-label="New puzzle"');
    expect(offerButton).not.toMatch(/outline/);
    expect(offerButton).toContain('data-cue="{{offerCue}}"');
    const ring = css.indexOf("button[data-cue='on'] { outline: 4px solid #ffc21a; outline-offset: 0; }");
    expect(ring).toBeGreaterThanOrEqual(0);
    // Same specificity, so the focus rule has to come later to win while the button has focus.
    expect(ring).toBeLessThan(css.indexOf('button:focus-visible'));
  });

  it('rings in the stuck still with its note on the board, and not in play', () => {
    const stuck = board({ moment: 'stuck' }).b.renderVals();
    expect(stuck.showOffer).toBe(true);
    expect(stuck.offerCue).toBe('on');
    expect(stuck.cueNote).toBe(true);
    const play = board({ moment: 'play' }).b.renderVals();
    expect(play.offerCue).toBe('off');
    expect(play.cueNote).toBe(false);
  });

  it('writes the note where the board shows it, not only in the source', () => {
    const note = /<p data-board-note="true"[^>]*>([^<]*)<\/p>/.exec(html);
    expect(note?.[1]).toBe('Board note. Ages 3 to 4: one chime and this ring for the first 2 s');
  });

  it('rings for 2 s each time the offer appears, while the offer itself stays', () => {
    const { b } = board({});
    const answer = sumOn(b).answer;
    for (let i = 0; i < 3 && !b.renderVals().showOffer; i++) sendWrong(b, answer);
    expect(b.renderVals().showOffer).toBe(true);
    expect(b.renderVals().offerCue).toBe('on');
    vi.advanceTimersByTime(1999);
    expect(b.renderVals().offerCue).toBe('on');
    vi.advanceTimersByTime(1);
    expect(b.renderVals().offerCue).toBe('off');
    expect(b.renderVals().cueNote).toBe(false);
    expect(b.renderVals().showOffer).toBe(true);
  });

  it('keeps the ring on a stuck still the designer moves to while an earlier ring is still timing', () => {
    const { b } = board({});
    const answer = sumOn(b).answer;
    for (let i = 0; i < 3 && !b.renderVals().showOffer; i++) sendWrong(b, answer);
    expect(b.renderVals().offerCue).toBe('on');
    b.props = { ...b.props, moment: 'stuck' };
    expect(b.renderVals().offerCue).toBe('on');
    vi.advanceTimersByTime(2100);
    expect(b.renderVals().offerCue).toBe('on');
  });
});

describe('the rest of the round 2 board', () => {
  it('colours the second number by its own operation (decision 28)', () => {
    expect(board({ level: 'add' }).b.renderVals().bColor).toBe('#ffab5e');
    expect(board({ level: 'take' }).b.renderVals().bColor).toBe('#7cc0ff');
  });

  it('draws the real Plus sign on the Level 4 card only when the lever asks for it (decision 19)', () => {
    const plus = STICKERS.find((s) => s.id === 'c1');
    const filled = (plus?.art.join('') ?? '').split('').flatMap((ch, i) => (ch === '.' ? [] : [i]));
    const card = board({ moment: 'levelDone', sticker: 'new' }).b.renderVals();
    expect(card.showSticker).toBe(true);
    expect(card.stickerLine).toBe(`New sticker: ${plus?.name}.`);
    expect(card.stickerCells.flatMap((c, i) => (c.style ? [i] : []))).toEqual(filled);
    expect(board({ moment: 'levelDone' }).b.renderVals().showSticker).toBe(false);
    expect(board({ moment: 'play', sticker: 'new' }).b.renderVals().showSticker).toBe(false);
  });
});
