import { describe, expect, it } from 'vitest';
import { ALL_WORDS, ALPHABET, hasClearFirstSound, letterColor, soundsAlike } from './data';
import { CHAPTERS, LEVELS, chunkSizes, makeRound, type FillPrompt, type Prompt } from './levels';
import {
  checkSound,
  fillDone,
  hintFill,
  hintMatch,
  hintSound,
  matchDone,
  newFill,
  newMatch,
  nextCell,
  starsForSlips,
  tapFill,
  tapMatch,
  tileForKey,
} from './logic';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);

function count(chars: string[]): Map<string, number> {
  const m = new Map<string, number>();
  chars.forEach((c) => m.set(c, (m.get(c) ?? 0) + 1));
  return m;
}

/** Plays a fill prompt perfectly with the pure logic; returns false if it gets stuck. */
function solveFill(p: FillPrompt): boolean {
  let s = newFill(p);
  for (let guard = 0; guard < 50 && !fillDone(p, s); guard++) {
    const id = hintFill(p, s);
    if (!id) return false;
    const r = tapFill(p, s, id);
    if (r.result !== 'correct') return false;
    s = r.state;
  }
  return fillDone(p, s);
}

describe('word list', () => {
  it('has 60+ unique words, each with an emoji', () => {
    expect(ALL_WORDS.length).toBeGreaterThanOrEqual(60);
    expect(new Set(ALL_WORDS.map((w) => w.word)).size).toBe(ALL_WORDS.length);
    expect(new Set(ALL_WORDS.map((w) => w.emoji)).size).toBe(ALL_WORDS.length);
    for (const w of ALL_WORDS) {
      expect(w.emoji.length, w.word).toBeGreaterThan(0);
      expect(/[a-z]/i.test(w.emoji), w.word).toBe(false);
      expect(w.word).toMatch(/^[a-z]{3,6}$/);
    }
  });

  it('contains nothing from a basic blocklist', () => {
    const blocked = ['poo', 'butt', 'fart', 'kill', 'dead', 'gun', 'die', 'sex', 'ass', 'hell', 'damn', 'beer', 'wine'];
    for (const w of ALL_WORDS) expect(blocked.includes(w.word), w.word).toBe(false);
  });

  it('every letter has a brick color, A and a share it', () => {
    for (const c of ALPHABET) {
      expect(letterColor(c)).toBeTruthy();
      expect(letterColor(c.toLowerCase())).toBe(letterColor(c));
    }
    // neighbours differ so a train of letters never shows two same-colored bricks side by side
    for (let i = 1; i < ALPHABET.length; i++) expect(letterColor(ALPHABET[i])).not.toBe(letterColor(ALPHABET[i - 1]));
  });

  it('first-sound filter drops digraphs and odd vowels', () => {
    expect(hasClearFirstSound('cat')).toBe(true);
    expect(hasClearFirstSound('apple')).toBe(true);
    expect(hasClearFirstSound('sheep')).toBe(false);
    expect(hasClearFirstSound('owl')).toBe(false);
    expect(hasClearFirstSound('cheese')).toBe(false);
  });
});

describe('levels', () => {
  it('has ~24 levels split exactly into chapters', () => {
    expect(LEVELS.length).toBe(24);
    let at = 0;
    for (const c of CHAPTERS) {
      expect(c.start).toBe(at);
      at += c.count;
    }
    expect(at).toBe(LEVELS.length);
  });

  it('chunks long trains evenly', () => {
    expect(chunkSizes(26, 7)).toEqual([7, 7, 6, 6]);
    expect(chunkSizes(5, 7)).toEqual([5]);
    expect(chunkSizes(10, 7)).toEqual([5, 5]);
  });

  it('only uses curated words', () => {
    const known = new Set(ALL_WORDS.map((w) => w.word));
    for (const def of LEVELS) if ('words' in def) for (const w of def.words) expect(known.has(w.word)).toBe(true);
  });

  LEVELS.forEach((def, level) => {
    it(`level ${level + 1} (${def.kind}: ${def.name}) always generates a valid, solvable round`, () => {
      for (const seed of SEEDS) {
        const round = makeRound(level, seed);
        expect(round.prompts.length).toBeGreaterThanOrEqual(1);
        expect(round.prompts.length).toBeLessThanOrEqual(6);
        round.prompts.forEach((p: Prompt) => checkPrompt(p, def));
      }
    });
  });

  it('varies content between seeds', () => {
    for (let level = 0; level < LEVELS.length; level++) {
      const shapes = new Set(SEEDS.slice(0, 10).map((s) => JSON.stringify(makeRound(level, s).prompts)));
      expect(shapes.size, `level ${level + 1}`).toBeGreaterThan(1);
    }
  });

  it('is deterministic for a seed', () => {
    expect(JSON.stringify(makeRound(18, 42))).toBe(JSON.stringify(makeRound(18, 42)));
  });

  it('A to Z covers the whole alphabet in order with its first four runs', () => {
    // Four-puzzle levels (brief 4.3): runs of 7, the first ones covering the span: A to G, H to N, O to U, T to Z.
    for (const seed of SEEDS) {
      const round = makeRound(3, seed);
      const first = round.prompts.slice(0, 4).map((p) => (p as FillPrompt).cells.join(''));
      expect(first).toEqual(['ABCDEFG', 'HIJKLMN', 'OPQRSTU', 'TUVWXYZ']);
      const covered = new Set(first.join(''));
      expect([...covered].sort().join('')).toBe(ALPHABET.join(''));
      for (const p of round.prompts) expect((p as FillPrompt).cells.length).toBe(7);
    }
  });
});

function checkPrompt(p: Prompt, def: (typeof LEVELS)[number]) {
  const ids = (list: { id: string }[]) => expect(new Set(list.map((t) => t.id)).size).toBe(list.length);
  if (p.kind === 'train' || p.kind === 'missing' || p.kind === 'spell') {
    ids(p.tray);
    expect(p.given.length).toBe(p.cells.length);
    const needed = p.cells.filter((_, i) => !p.given[i]);
    expect(needed.length).toBeGreaterThan(0);
    // every letter the puzzle needs is in the tray, as many times as needed
    const tray = count(p.tray.map((t) => t.ch));
    for (const [c, n] of count(needed)) expect(tray.get(c) ?? 0, c).toBeGreaterThanOrEqual(n);
    // decoys can never fill any cell: no ambiguity about which brick goes where
    const decoys = p.tray.filter((t) => !needed.includes(t.ch));
    const expectedDecoys = def.kind === 'spell' || def.kind === 'missing' ? def.decoys : 0;
    expect(decoys.length).toBe(expectedDecoys);
    expect(p.tray.length).toBe(needed.length + expectedDecoys);
    for (const d of decoys) {
      expect(p.cells.includes(d.ch)).toBe(false);
      if (p.kind === 'spell') for (const c of p.cells) expect(soundsAlike(d.ch, c), `${d.ch} vs ${c}`).toBe(false);
    }
    if (p.kind === 'spell') {
      expect(p.word).toBeTruthy();
      expect(p.cells.join('')).toBe(p.word!.word.toUpperCase());
      expect(p.tray.length).toBeLessThanOrEqual(10);
    }
    if (p.kind === 'missing') expect(p.given[0]).toBe(true);
    if (def.kind === 'train' && def.lower) for (const c of p.cells) expect(c).toBe(c.toLowerCase());
    expect(solveFill(p)).toBe(true);
  } else if (p.kind === 'match') {
    ids([...p.upper, ...p.lower]);
    expect(new Set(p.letters).size).toBe(p.letters.length);
    expect(p.upper.map((t) => t.ch).sort()).toEqual([...p.letters].sort());
    expect(p.lower.map((t) => t.ch.toUpperCase()).sort()).toEqual([...p.letters].sort());
    if (def.kind === 'match') expect(p.letters.length).toBe(def.pairs);
    // solvable using hints only
    let s = newMatch();
    for (let g = 0; g < 40 && !matchDone(p, s); g++) {
      const [a, b] = hintMatch(p, s);
      s = tapMatch(p, s, 'upper', a).state;
      const r = tapMatch(p, s, 'lower', b);
      expect(r.result).toBe('pair');
      s = r.state;
    }
    expect(matchDone(p, s)).toBe(true);
  } else if (p.kind === 'sound') {
    ids(p.options);
    if (def.kind === 'sound') expect(p.options.length).toBe(def.choices);
    expect(hasClearFirstSound(p.word.word)).toBe(true);
    const right = p.options.filter((t) => checkSound(p, t.ch));
    expect(right.length).toBe(1);
    // no wrong choice sounds like the right one (no K for cat)
    for (const t of p.options) if (t.ch !== p.answer) expect(soundsAlike(t.ch, p.answer)).toBe(false);
    expect(new Set(p.options.map((t) => t.ch.toUpperCase())).size).toBe(p.options.length);
    expect(new Set(p.options.map((t) => letterColor(t.ch))).size).toBe(p.options.length);
    expect(hintSound(p)).toBe(right[0].id);
  }
}

describe('logic', () => {
  it('star rule', () => {
    expect(starsForSlips(0)).toBe(3);
    expect(starsForSlips(1)).toBe(3);
    expect(starsForSlips(2)).toBe(2);
    expect(starsForSlips(4)).toBe(2);
    expect(starsForSlips(5)).toBe(1);
    expect(starsForSlips(99)).toBe(1);
  });

  it('spelling accepts either copy of a doubled letter and rejects wrong bricks', () => {
    const p: FillPrompt = {
      kind: 'spell',
      cells: ['E', 'G', 'G'],
      given: [false, false, false],
      tray: [
        { id: 'a', ch: 'G' },
        { id: 'b', ch: 'E' },
        { id: 'c', ch: 'G' },
        { id: 'd', ch: 'M' },
      ],
      word: { word: 'egg', emoji: '🥚' },
    };
    let s = newFill(p);
    expect(tapFill(p, s, 'a').result).toBe('wrong');
    expect(tapFill(p, s, 'd').result).toBe('wrong');
    s = tapFill(p, s, 'b').state;
    expect(nextCell(p, s)).toBe(1);
    expect(tapFill(p, s, 'b').result).toBe('ignored'); // already placed
    s = tapFill(p, s, 'c').state;
    expect(tileForKey(p, s, 'g')).toBe('a');
    expect(tileForKey(p, s, 'z')).toBe(null);
    s = tapFill(p, s, 'a').state;
    expect(fillDone(p, s)).toBe(true);
    expect(hintFill(p, s)).toBe(null);
  });

  it('missing letters skip given cells', () => {
    const p: FillPrompt = {
      kind: 'missing',
      cells: ['A', 'B', 'C', 'D'],
      given: [true, false, true, false],
      tray: [
        { id: 'x', ch: 'D' },
        { id: 'y', ch: 'B' },
      ],
    };
    let s = newFill(p);
    expect(nextCell(p, s)).toBe(1);
    expect(tapFill(p, s, 'x').result).toBe('wrong');
    s = tapFill(p, s, 'y').state;
    expect(nextCell(p, s)).toBe(3);
  });

  it('matching pairs and mismatches', () => {
    const round = makeRound(7, 3);
    const p = round.prompts[0];
    if (p.kind !== 'match') throw new Error('expected match');
    const [u0, u1] = p.upper;
    const lowerOf = (ch: string) => p.lower.find((t) => t.ch === ch.toLowerCase())!;
    let s = newMatch();
    s = tapMatch(p, s, 'upper', u0.id).state;
    const wrong = tapMatch(p, s, 'lower', lowerOf(u1.ch).id);
    expect(wrong.result).toBe('wrong');
    expect(wrong.state.selected).toBe(null);
    s = tapMatch(p, wrong.state, 'lower', lowerOf(u0.ch).id).state;
    s = tapMatch(p, s, 'upper', u0.id).state;
    expect(s.selected).toBe(null); // already matched: ignored
    // lower first works too
    const r = tapMatch(p, tapMatch(p, s, 'lower', lowerOf(u1.ch).id).state, 'upper', u1.id);
    expect(r.result).toBe('pair');
    expect(r.state.matched).toEqual([u0.ch, u1.ch]);
  });
});
