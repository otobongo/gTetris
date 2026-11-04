/** Letter Builder four-puzzle levels (brief 2, 3, 4.3, 5, 7.1, 9): six puzzles per level, words, swaps, copy and the run through the store. */
import { readFileSync } from 'node:fs';
import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AGE_BANDS, PUZZLES_PER_LEVEL, createProgressStore, type AgeBand, type PuzzleResult } from '../../shared/progress';
import { rng } from '../../shared/rng';
import { lettersLevelStars, lettersSet } from '../run';
import { ALL_WORDS, EIGHT, SEVEN } from './data';
import {
  GAME_DONE_NOTE,
  GAME_DONE_TITLE,
  MID_LINE,
  gameDoneFact,
  levelFact,
  levelTitle,
  nextLabel,
  offerLine,
  offerName,
  playLabel,
  solvedLine,
  swapLine,
} from './copy';
import {
  LEVELS,
  isSpelling,
  levelWords,
  makePuzzles,
  spellOrder,
  tierIndex,
  trainRunLength,
  type FillPrompt,
  type LevelDef,
  type MatchPrompt,
  type Prompt,
  type SoundPrompt,
} from './levels';
import { LEVEL_RULE, STAR_RULE } from './logic';
import { DRAWN_WORDS } from './Pictures';
import { WORD_LENGTHS, spellWords, type SpellTier } from './spelling';
import { FillView } from './Views';

const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 11);
const PLAYERS = ['', 'p-1', 'maya', 'leo-42', '0b5e2c'];
const spellLevels = LEVELS.map((def, i) => ({ def, i })).filter((x): x is { def: Extract<LevelDef, { kind: 'spell' }>; i: number } => x.def.kind === 'spell');
const wordsOf = (ps: Prompt[]) => (ps as FillPrompt[]).map((p) => p.word!.word);
const levelOf = (name: string) => LEVELS.findIndex((d) => d.name === name);

describe('six puzzles per level, one idea at one difficulty (4.3)', () => {
  LEVELS.forEach((def, level) => {
    it(`level ${level + 1} (${def.name}) holds 6 puzzles that share its settings`, () => {
      for (const seed of SEEDS) {
        const ps = makePuzzles(level, seed, '7-8');
        expect(ps).toHaveLength(PUZZLES_PER_LEVEL);
        for (const p of ps) expect(p.kind).toBe(def.kind);
        if (def.kind === 'train') {
          const run = trainRunLength(def);
          for (const p of ps as FillPrompt[]) {
            expect(p.cells).toHaveLength(run);
            expect(p.guide).toBe(!!def.guide);
            for (const c of p.cells) expect(c).toBe(def.lower ? c.toLowerCase() : c.toUpperCase());
            // the tray is never already in the answer order
            expect(p.tray.map((t) => t.ch).join('')).not.toBe(p.cells.join(''));
          }
        }
        if (def.kind === 'missing') {
          const starts = new Set((ps as FillPrompt[]).map((p) => p.cells[0]));
          expect(starts.size, 'different runs').toBe(PUZZLES_PER_LEVEL);
          for (const p of ps as FillPrompt[]) {
            expect(p.cells).toHaveLength(def.window);
            // 2 gaps and 1 decoy on every puzzle: the old ramp to 3 gaps is gone
            expect(p.given.filter((g) => !g)).toHaveLength(2);
            expect(p.tray).toHaveLength(3);
            expect(p.given[0]).toBe(true);
          }
        }
        if (def.kind === 'match') {
          const sets = new Set((ps as MatchPrompt[]).map((p) => [...p.letters].sort().join('')));
          expect(sets.size, 'different letters').toBe(PUZZLES_PER_LEVEL);
          for (const p of ps as MatchPrompt[]) expect(p.letters).toHaveLength(def.pairs);
        }
        if (def.kind === 'sound') {
          expect(new Set((ps as SoundPrompt[]).map((p) => p.word.word)).size, '6 different words').toBe(PUZZLES_PER_LEVEL);
          for (const p of ps as SoundPrompt[]) {
            expect(p.options).toHaveLength(def.choices);
            expect(p.answer).toBe(def.lower ? p.answer.toLowerCase() : p.answer.toUpperCase());
          }
        }
        if (def.kind === 'spell') {
          expect(new Set(wordsOf(ps)).size, 'never twice inside a level').toBe(PUZZLES_PER_LEVEL);
          for (const p of ps as FillPrompt[]) expect(p.guide).toBe(def.guide);
        }
      }
    });
  });

  it('is the same level again for the same seed, so a resumed level shows the same puzzles', () => {
    for (let level = 0; level < LEVELS.length; level++) {
      expect(JSON.stringify(makePuzzles(level, 99, '5-6', [], 'maya'))).toBe(JSON.stringify(makePuzzles(level, 99, '5-6', [], 'maya')));
    }
  });

  it('Level 1 alternates A to D and B to E, each with its own tray order (decision 11)', () => {
    const level = levelOf('A to E');
    expect(level).toBe(0);
    for (const seed of SEEDS) {
      const ps = makePuzzles(level, seed) as FillPrompt[];
      expect(ps.map((p) => p.cells.join(''))).toEqual(['ABCD', 'BCDE', 'ABCD', 'BCDE', 'ABCD', 'BCDE']);
      expect(ps.map((p) => p.label)).toEqual(['A to D', 'B to E', 'A to D', 'B to E', 'A to D', 'B to E']);
      for (const p of ps) expect(p.guide).toBe(true);
      // A swap always brings the other run: queue[0] and queue[1] differ.
      expect(ps[0].cells).not.toEqual(ps[1].cells);
      const trays = (start: string) => ps.filter((p) => p.cells[0] === start).map((p) => p.tray.map((t) => t.ch).join(''));
      expect(new Set(trays('A')).size).toBe(3);
      expect(new Set(trays('B')).size).toBe(3);
    }
  });

  it('runs are as long as the longest piece today gives: 5 for A to J and A to O, 7 for A to Z, a to m and n to z', () => {
    const runOf = (name: string) => trainRunLength(LEVELS[levelOf(name)] as Extract<LevelDef, { kind: 'train' }>);
    expect(runOf('A to E')).toBe(4);
    expect(runOf('A to J')).toBe(5);
    expect(runOf('A to O')).toBe(5);
    expect(runOf('A to Z')).toBe(7);
    expect(runOf('a to m')).toBe(7);
    expect(runOf('n to z')).toBe(7);
  });

  it('starts every train run at a different letter, the first runs covering the whole span', () => {
    const expectCover: Record<string, string[]> = {
      'A to J': ['ABCDE', 'FGHIJ'],
      'A to O': ['ABCDE', 'FGHIJ', 'KLMNO'],
      'a to m': ['abcdefg', 'ghijklm'],
      'n to z': ['nopqrst', 'tuvwxyz'],
    };
    for (const [name, cover] of Object.entries(expectCover)) {
      for (const seed of SEEDS) {
        const ps = makePuzzles(levelOf(name), seed) as FillPrompt[];
        expect(ps.slice(0, cover.length).map((p) => p.cells.join('')), name).toEqual(cover);
        expect(new Set(ps.map((p) => p.cells[0])).size, name).toBe(PUZZLES_PER_LEVEL);
      }
    }
  });

  it('changes content with the seed', () => {
    for (let level = 0; level < LEVELS.length; level++) {
      const shapes = new Set(SEEDS.slice(0, 10).map((s) => JSON.stringify(makePuzzles(level, s, '7-8'))));
      expect(shapes.size, `level ${level + 1}`).toBeGreaterThan(1);
    }
  });
});

describe('spelling words: one order per player, band and tier (4.3)', () => {
  it('takes places 1 to 6, 7 to 12 and 13 to 18 of the tier order for the first, second and third level on a tier', () => {
    for (const band of AGE_BANDS) {
      for (const player of PLAYERS) {
        for (const { def, i } of spellLevels) {
          const order = spellOrder(player, band, def.tier).map((w) => w.word);
          const k = tierIndex(i);
          const places = Array.from({ length: PUZZLES_PER_LEVEL }, (_, j) => order[(PUZZLES_PER_LEVEL * k + j) % order.length]);
          for (const seed of SEEDS.slice(0, 5)) {
            expect(new Set(wordsOf(makePuzzles(i, seed, band, [], player))), `${band} ${player} level ${i + 1}`).toEqual(new Set(places));
          }
        }
      }
    }
  });

  it('numbers the levels on each tier 0, 1, 2 in level order', () => {
    expect(spellLevels.map(({ i }) => tierIndex(i))).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 0]);
    expect(tierIndex(0)).toBe(0);
  });

  it('uses the whole pool before a word comes back across the levels of a tier', () => {
    const tiers: SpellTier[] = [0, 1, 2, 3];
    for (const band of AGE_BANDS) {
      for (const tier of tiers) {
        const levels = spellLevels.filter(({ def }) => def.tier === tier).map(({ i }) => i);
        const pool = spellWords(band, tier).length;
        for (const player of PLAYERS) {
          const all = levels.flatMap((i) => wordsOf(makePuzzles(i, 7, band, [], player)));
          // Repeats happen only when the tier needs more places than the pool holds (decision 7).
          expect(new Set(all).size, `${band} tier ${tier}`).toBe(Math.min(pool, all.length));
        }
      }
    }
  });

  it('keeps the words of a level for a replay, in a new order with new trays', () => {
    for (const band of AGE_BANDS) {
      for (const { i } of spellLevels) {
        const first = makePuzzles(i, 1, band, [], 'maya') as FillPrompt[];
        let changed = false;
        for (const seed of SEEDS) {
          const again = makePuzzles(i, seed, band, [], 'maya') as FillPrompt[];
          expect(new Set(wordsOf(again))).toEqual(new Set(wordsOf(first)));
          if (JSON.stringify(again) !== JSON.stringify(first)) changed = true;
        }
        expect(changed, `${band} level ${i + 1}`).toBe(true);
      }
    }
  });

  it('gives different players their own order', () => {
    const a = spellOrder('maya', '5-6', 3).map((w) => w.word).join();
    const b = spellOrder('leo', '5-6', 3).map((w) => w.word).join();
    expect(a).not.toBe(b);
    expect(spellOrder('maya', '5-6', 3).map((w) => w.word).join()).toBe(a);
  });

  it('keeps every word inside the band’s lengths', () => {
    for (const band of AGE_BANDS) {
      const { min, max } = WORD_LENGTHS[band];
      for (const { i } of spellLevels) {
        for (const w of wordsOf(makePuzzles(i, 3, band, [], 'p-1'))) {
          expect(w.length).toBeGreaterThanOrEqual(min);
          expect(w.length).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('never repeats a built word after a band change mid-level, and fills every unsolved puzzle with the new band’s words', () => {
    const changes: [AgeBand, AgeBand][] = [
      ['7-8', '9-10'],
      ['9-10', '7-8'],
      ['3-4', '5-6'],
      ['5-6', '7-8'],
      ['5-6', '3-4'],
    ];
    for (const [from, to] of changes) {
      for (const { i } of spellLevels) {
        for (const player of PLAYERS) {
          for (const seed of SEEDS.slice(0, 10)) {
            const old = makePuzzles(i, seed, from, [], player) as FillPrompt[];
            for (let count = 1; count <= 3; count++) {
              // The child built the first `count` puzzles of the queue in the old band.
              const solved = old.slice(0, count).map((p, puzzle) => ({ puzzle, word: p.word!.word }));
              const fresh = makePuzzles(i, seed, to, solved, player) as FillPrompt[];
              const open = fresh.slice(count).map((p) => p.word!.word);
              const built = solved.map((s) => s.word);
              expect(new Set(open).size, `${from} to ${to} level ${i + 1}`).toBe(open.length);
              for (const w of open) {
                expect(built, `${from} to ${to} level ${i + 1} seed ${seed}`).not.toContain(w);
                expect(spellWords(to, (LEVELS[i] as Extract<LevelDef, { kind: 'spell' }>).tier).map((x) => x.word)).toContain(w);
              }
            }
          }
        }
      }
    }
  });

  it('keeps the unsolved puzzles’ words when one more puzzle is solved, so leaving and coming back changes nothing', () => {
    for (const { i } of spellLevels) {
      for (const seed of SEEDS.slice(0, 10)) {
        // Words built in the 7 to 8 order, now playing as 9 to 10 (the same 44 words, another order).
        const old = makePuzzles(i, seed, '7-8', [], 'maya') as FillPrompt[];
        const one = [{ puzzle: 0, word: old[0].word!.word }];
        const before = levelWords(i, '9-10', rng(seed), one, 'maya').map((w) => w.word);
        const two = [...one, { puzzle: 1, word: before[1] }];
        const after = levelWords(i, '9-10', rng(seed), two, 'maya').map((w) => w.word);
        expect(after.slice(2)).toEqual(before.slice(2));
      }
    }
  });

  it('only spelling levels count words', () => {
    expect(LEVELS.map((_, i) => isSpelling(i)).filter(Boolean)).toHaveLength(9);
    expect(isSpelling(15)).toBe(true);
    expect(isSpelling(14)).toBe(false);
    expect(isSpelling(99)).toBe(false);
  });
});

describe('copy (9.1)', () => {
  const fill = (kind: FillPrompt['kind'], cells: string[], word?: string): FillPrompt => ({
    kind,
    cells,
    given: cells.map(() => false),
    tray: [],
    word: word ? { word, emoji: '' } : undefined,
  });

  it('states each kind’s solved line', () => {
    expect(solvedLine(fill('train', ['A', 'B', 'C', 'D', 'E']))).toBe('A to E, all in order.');
    expect(solvedLine(fill('train', ['n', 'o', 'p']))).toBe('n to p, all in order.');
    expect(solvedLine(fill('missing', ['A', 'B']))).toBe('Every gap is filled.');
    expect(solvedLine({ kind: 'match', letters: [], upper: [], lower: [] })).toBe('Every pair matched.');
    expect(solvedLine({ kind: 'sound', word: { word: 'fish', emoji: '' }, options: [], answer: 'F' })).toBe('Fish starts with F.');
    expect(solvedLine(fill('spell', ['S', 'U', 'N'], 'sun'))).toBe('You built SUN.');
  });

  it('names Next, the offer and the swap by noun', () => {
    expect(MID_LINE).toBe('What comes next?');
    expect(nextLabel(false)).toBe('Next puzzle');
    expect(nextLabel(true)).toBe('Next word');
    expect(offerLine(false)).toBe('This one is tricky. Want a different puzzle?');
    expect(offerLine(true)).toBe('This word is tricky. Want a different one?');
    expect(offerName(false)).toBe('New puzzle');
    expect(offerName(true)).toBe('New word');
    expect(swapLine(false)).toBe('Here is a different puzzle.');
    expect(swapLine(true)).toBe('Here is a different word.');
  });

  it('writes the level card and the finished card', () => {
    expect(levelTitle(9)).toBe('You finished Level 9');
    expect(playLabel(10)).toBe('Play Level 10');
    expect(levelFact(false, 0)).toBe('4 puzzles, no slips.');
    expect(levelFact(false, 1)).toBe('4 puzzles, 1 slip.');
    expect(levelFact(false, 3)).toBe('4 puzzles, 3 slips.');
    expect(levelFact(true, 0)).toBe('4 words, no slips.');
    expect(levelFact(true, 1)).toBe('4 words, 1 slip.');
    expect(levelFact(true, 3)).toBe('4 words, 3 slips.');
    expect(LEVEL_RULE).toBe('3 stars: 1 slip or none. 2 stars: 4 slips or fewer.');
    expect(STAR_RULE).toBe('3 stars: 1 slip or none. 2 stars: 4 slips or fewer. Using a hint caps the level at 2 stars.');
    expect(GAME_DONE_TITLE).toBe('You finished every level!');
    expect(gameDoneFact(24, 60)).toBe('24 levels, 60 of 72 stars.');
    expect(GAME_DONE_NOTE).toBe('A grown-up can pick a level to play again.');
  });

  it('uses no em or en dashes in any Letter Builder line', () => {
    for (const file of ['./copy.ts', './LettersApp.tsx', './Views.tsx', './logic.ts']) {
      const src = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(src, file).not.toMatch(/[–—]/);
    }
  });
});

describe('stars over the 4 solved puzzles (5)', () => {
  const results = (slips: number[], hintAt = -1): PuzzleResult[] =>
    slips.map((count, puzzle) => ({ puzzle, count, usedHint: puzzle === hintAt, outOfTime: false }));

  it('counts slips over exactly 4 puzzles: S 1 is 3 stars, S 2 and 4 are 2, S 5 is 1', () => {
    expect(lettersLevelStars(results([0, 0, 0, 1]))).toBe(3);
    expect(lettersLevelStars(results([0, 1, 0, 1]))).toBe(2);
    expect(lettersLevelStars(results([1, 1, 1, 1]))).toBe(2);
    expect(lettersLevelStars(results([2, 1, 1, 1]))).toBe(1);
  });

  it('caps the level at 2 when any of the 4 used a hint', () => {
    expect(lettersLevelStars(results([0, 0, 0, 0], 2))).toBe(2);
    expect(lettersLevelStars(results([5, 0, 0, 0], 0))).toBe(1);
  });
});

describe('pictures', () => {
  it('draws CAT, DUCK and PENGUIN like the board, and every drawing has a word', () => {
    for (const w of ['cat', 'duck', 'penguin']) expect(DRAWN_WORDS).toContain(w);
    const known = new Set([...ALL_WORDS, ...SEVEN, ...EIGHT].map((w) => w.word));
    for (const w of DRAWN_WORDS) expect(known.has(w), w).toBe(true);
  });
});

describe('the puzzle view', () => {
  const prompt = makePuzzles(15, 4, '3-4')[0] as FillPrompt;
  const view = (extra: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      createElement(FillView, {
        prompt,
        active: true,
        onSlip: () => {},
        onDone: () => {},
        hintRef: createRef<(() => boolean) | null>() as { current: (() => boolean) | null },
        hint: createElement('button', { type: 'button', 'aria-label': 'Hint (3)' }),
        innerW: 358,
        instruction: 'Tap the letters to build the word.',
        ...extra,
      }),
    );

  it('shows the tray while playing, and Next in the well in its place once a slot is given', () => {
    expect(view()).toContain('lb-tray');
    const solved = view({ slot: createElement('button', { type: 'button', className: 'lb-next' }, 'Next word') });
    expect(solved).not.toContain('lb-tray');
    expect(solved).toContain('lb-well--slot');
    expect(solved).toContain('Next word');
  });

  it('puts the stuck offer last in the help row’s markup, after the hint, and shows its line', () => {
    const html = view({
      helpOverride: offerLine(true),
      offer: createElement('button', { type: 'button', 'aria-label': 'New word' }),
    });
    expect(html).toContain(offerLine(true));
    expect(html.indexOf('Hint (3)')).toBeLessThan(html.indexOf('New word'));
    expect(html).toMatch(/lb-helprow__offer"><button[^>]*aria-label="New word"/);
  });

  it('starts with the instruction, and a swap’s line takes its place', () => {
    expect(view()).toContain('Tap the letters to build the word.');
    expect(view({ instruction: swapLine(true) })).toContain('Here is a different word.');
  });
});

describe('the game screen follows the decided flow', () => {
  const app = readFileSync(new URL('./LettersApp.tsx', import.meta.url), 'utf8');
  const views = readFileSync(new URL('./Views.tsx', import.meta.url), 'utf8');

  it('has no level grid, Play again, All levels, or praise card', () => {
    expect(app).not.toMatch(/LevelGrid|Play again|All levels|Super builder|Great building|You did it/);
    expect(views).not.toMatch(/Well done!|Great! What comes next\?/);
  });

  it('speaks only from a tap handler: nothing is said when a level ends', () => {
    // Every say( in the screen sits inside an onClick handler.
    for (const m of app.matchAll(/say\(/g)) {
      const before = app.slice(Math.max(0, m.index! - 80), m.index);
      expect(before, before).toMatch(/onClick=\{\(\) => $/);
    }
  });

  it('checks the daily limit on Next and on Play Level', () => {
    expect(app).toMatch(/const next = \(\) => \{\s*if \(breakBefore\(levelPath\(level\)\)\) return;/);
    expect(app).toMatch(/const playNextLevel = \(to: number\) => \{\s*if \(breakBefore\(levelPath\(to\)\)\) return;/);
  });
});

describe('a level through the store (6.2)', () => {
  const memStore = () => {
    const data = new Map<string, string>();
    let id = 0;
    let clock = 1_000;
    return createProgressStore({
      storage: { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) },
      now: () => (clock += 1000),
      newId: () => `kid-${++id}`,
      events: null,
    });
  };
  const rulesFor = (band: AgeBand, seed: number) => ({
    set: lettersSet(band),
    seed,
    hintsLeft: 3,
    keepSolved: true,
    levelCount: LEVELS.length,
    stars: lettersLevelStars,
  });

  it('keeps solved words through a band change, never repeats one, and finishes on the fourth with the next level current', () => {
    const store = memStore();
    const kid = store.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' });
    store.setActivePlayer(kid.id);
    const level = 21; // Longer words: the 8 eight-letter words for ages 7 to 10
    const run = store.startRun('letters', level, { set: lettersSet('7-8'), seed: 77, hintsLeft: 3, keepSolved: true });
    expect(run.queue).toEqual([0, 1, 2, 3, 4, 5]);
    const old = makePuzzles(level, run.seed, '7-8', [], kid.id) as FillPrompt[];
    for (const puzzle of [0, 1]) {
      const out = store.recordPuzzle('letters', level, { puzzle, count: 0, word: old[puzzle].word!.word, usedHint: false, outOfTime: false }, rulesFor('7-8', 77));
      expect(out.kind).toBe('saved');
    }
    // A hint spent on puzzle 2, which the child then swaps away: it stays spent.
    expect(store.spendHint('letters', level)).toBe(2);
    const swapped = store.swapPuzzle('letters', level)!;
    expect(swapped.queue).toEqual([3, 4, 5, 2]);

    // A grown-up moves Maya to ages 9 to 10. The run keeps its two built words and its seed.
    store.updatePlayer(kid.id, { ageBand: '9-10' });
    const moved = store.startRun('letters', level, { set: lettersSet('9-10'), seed: 77, hintsLeft: 3, keepSolved: true });
    expect(moved.solved.map((r) => r.puzzle)).toEqual([0, 1]);
    expect(moved.set).toBe(lettersSet('9-10'));
    expect(moved.hintsLeft).toBe(2);
    const fresh = makePuzzles(level, moved.seed, '9-10', moved.solved, kid.id) as FillPrompt[];
    const built = moved.solved.map((r) => r.word);
    for (const p of moved.queue) expect(built).not.toContain(fresh[p].word!.word);

    const third = store.recordPuzzle('letters', level, { puzzle: moved.queue[0], count: 1, word: fresh[moved.queue[0]].word!.word, usedHint: false, outOfTime: false }, rulesFor('9-10', 77));
    expect(third.kind).toBe('saved');
    const q = third.kind === 'saved' ? third.run.queue[0] : -1;
    const fourth = store.recordPuzzle('letters', level, { puzzle: q, count: 0, word: fresh[q].word!.word, usedHint: false, outOfTime: false }, rulesFor('9-10', 77));
    expect(fourth.kind).toBe('finished');
    if (fourth.kind !== 'finished') return;
    // 1 slip and no counted hint (the hint was on the puzzle swapped away): 3 stars.
    expect(fourth.stars).toBe(3);
    expect(fourth.next).toBe(level + 1);
    const game = store.getState().players.find((p) => p.id === kid.id)!.games.letters;
    expect(game.stars[level]).toBe(3);
    expect(game.runs?.[level]).toBeUndefined();
    expect(game.current).toBe(level + 1);
  });
});
