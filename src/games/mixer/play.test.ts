/** Color Mixer tap rules (brief 4.1, 10.2): slots, slips and their keys, the solve, and what the bowl and result block show. */
import { describe, expect, it } from 'vitest';
import { rng } from '../../shared/rng';
import { PAINT_IDS, RESULT_IDS, SAME_TEXT, colorInfo, mixOf, pairKey, recipeFor, type ColorId, type PaintId, type ResultId } from './colors';
import { LEVELS } from './levels';
import { makePuzzles, type FinishPuzzle, type GuessPuzzle, type MakePuzzle, type Puzzle } from './puzzles';
import {
  hexOf,
  isGiven,
  isPicked,
  shelfOf,
  speechOf,
  startState,
  tapChoice,
  tapPaint,
  tapSlot,
  viewOf,
  type MixState,
  type Outcome,
  type Step,
} from './play';

// One puzzle of each form, as the level table makes them (Levels 1, 2 and 3).
const FINISH: FinishPuzzle = { form: 'finish', goal: 'green', given: 'blue', shelf: ['red', 'yellow'], answer: 'yellow' };
const GUESS: GuessPuzzle = { form: 'guess', paints: ['red', 'yellow'], choices: ['green', 'orange', 'purple'], answer: 'orange' };
const MAKE: MakePuzzle = { form: 'make', goal: 'green', shelf: ['blue', 'red', 'yellow'], answer: ['yellow', 'blue'] };
// Level 9: all four paints on the shelf.
const MAKE_ALL: MakePuzzle = { form: 'make', goal: 'cream', shelf: ['white', 'blue', 'yellow', 'red'], answer: ['yellow', 'white'] };

/** Taps pots one after another from the start, and returns every step. */
function paints(p: Puzzle, taps: PaintId[], from: MixState = startState(p)): Step[] {
  const steps: Step[] = [];
  let s = from;
  for (const t of taps) {
    const step = tapPaint(p, s, t);
    steps.push(step);
    s = step.state;
  }
  return steps;
}
const last = (steps: Step[]): Step => steps[steps.length - 1];
const kinds = (steps: Step[]): Outcome['kind'][] => steps.map((x) => x.outcome.kind);
const keys = (steps: Step[]): string[] => steps.flatMap((x) => (x.outcome.kind === 'slip' ? [x.outcome.key] : []));

describe('the start of a puzzle (4.1 screen, play)', () => {
  it('Finish: paint 1 is given and fixed, paint 2 is empty, the bowl shows the one paint', () => {
    const s = startState(FINISH);
    expect(s).toEqual({ slots: ['blue', null], solved: false, wrong: null });
    expect(isGiven(FINISH, 0)).toBe(true);
    expect(isGiven(FINISH, 1)).toBe(false);
    expect(viewOf(FINISH, s)).toEqual({ bowl: 'blue', name: 'Pick one more paint', text: null, help: 'Tap the paint that makes green.' });
  });

  it('Guess: both paints are in their slots and the bowl is empty', () => {
    const s = startState(GUESS);
    expect(s).toEqual({ slots: ['red', 'yellow'], solved: false, wrong: null });
    expect(isGiven(GUESS, 0)).toBe(true);
    expect(isGiven(GUESS, 1)).toBe(true);
    expect(viewOf(GUESS, s)).toEqual({ bowl: null, name: 'Pick a color', text: null, help: 'Tap the color they make.' });
  });

  it('Make it: both slots are empty and so is the bowl', () => {
    const s = startState(MAKE);
    expect(s).toEqual({ slots: [null, null], solved: false, wrong: null });
    expect(isGiven(MAKE, 0)).toBe(false);
    expect(isGiven(MAKE, 1)).toBe(false);
    expect(viewOf(MAKE, s)).toEqual({ bowl: null, name: 'Pick two paints', text: null, help: 'Tap two paints to mix them.' });
  });

  it('shows the shelf for Finish and Make it, and no pots for Guess', () => {
    expect(shelfOf(FINISH)).toEqual(['red', 'yellow']);
    expect(shelfOf(MAKE)).toEqual(['blue', 'red', 'yellow']);
    expect(shelfOf(GUESS)).toEqual([]);
  });

  it('starts every generated puzzle unsolved, with no slip showing', () => {
    for (let level = 0; level < LEVELS.length; level++) {
      for (const p of makePuzzles(level, 42)) {
        const s = startState(p);
        expect(s.solved).toBe(false);
        expect(s.wrong).toBeNull();
        expect(viewOf(p, s).text).toBeNull();
      }
    }
  });
});

describe('Finish the mix (4.1)', () => {
  it('solves on the paint that makes the goal', () => {
    const step = tapPaint(FINISH, startState(FINISH), 'yellow');
    expect(step.outcome).toEqual({ kind: 'solved' });
    expect(step.state).toEqual({ slots: ['blue', 'yellow'], solved: true, wrong: null });
    expect(viewOf(FINISH, step.state)).toEqual({
      bowl: 'green',
      name: 'Green',
      text: 'Blue and yellow make green, like grass and leaves.',
      help: 'You made green.',
    });
  });

  it('slips on another paint, keyed by the pair, and shows what the pair made', () => {
    const step = tapPaint(FINISH, startState(FINISH), 'red');
    expect(step.outcome).toEqual({ kind: 'slip', key: pairKey('red', 'blue') });
    expect(step.state).toEqual({ slots: ['blue', 'red'], solved: false, wrong: 'purple' });
    expect(viewOf(FINISH, step.state)).toEqual({
      bowl: 'purple',
      name: 'Purple',
      text: 'Red and blue make purple, like grapes.',
      help: 'Not green yet. Try another paint.',
    });
  });

  it('replaces paint 2 when another pot is tapped', () => {
    const steps = paints(FINISH, ['red', 'yellow']);
    expect(last(steps).state.slots).toEqual(['blue', 'yellow']);
    expect(kinds(steps)).toEqual(['slip', 'solved']);
  });

  it('gives the same wrong paint again the same key, so it counts once for stars', () => {
    const steps = paints(FINISH, ['red', 'red', 'red']);
    expect(kinds(steps)).toEqual(['slip', 'slip', 'slip']);
    expect(new Set(keys(steps)).size).toBe(1);
  });

  it('does nothing on a tap on the given slot or on the empty slot', () => {
    const s = startState(FINISH);
    expect(tapSlot(FINISH, s, 0)).toBe(s);
    expect(tapSlot(FINISH, s, 1)).toBe(s);
    const wrong = tapPaint(FINISH, s, 'red').state;
    expect(tapSlot(FINISH, wrong, 0)).toBe(wrong);
  });

  it('empties paint 2 on a tap on it, and the help line goes back to the start', () => {
    const wrong = tapPaint(FINISH, startState(FINISH), 'red').state;
    const s = tapSlot(FINISH, wrong, 1);
    expect(s).toEqual({ slots: ['blue', null], solved: false, wrong: null });
    expect(viewOf(FINISH, s)).toEqual(viewOf(FINISH, startState(FINISH)));
  });

  it('does nothing on a pot that is not on the shelf, the given paint included', () => {
    const s = startState(FINISH);
    for (const off of ['blue', 'white'] as const) expect(tapPaint(FINISH, s, off)).toEqual({ state: s, outcome: { kind: 'none' } });
  });
});

describe('Make it (4.1)', () => {
  it('solves on the right pair in either tap order', () => {
    for (const order of [['yellow', 'blue'], ['blue', 'yellow']] as PaintId[][]) {
      const steps = paints(MAKE, order);
      expect(kinds(steps)).toEqual(['none', 'solved']);
      expect(last(steps).state.solved).toBe(true);
      expect(viewOf(MAKE, last(steps).state)).toEqual({
        bowl: 'green',
        name: 'Green',
        text: 'Blue and yellow make green, like grass and leaves.',
        help: 'You made green.',
      });
    }
  });

  it('shows the one paint in the bowl and keeps "Pick two paints" while one slot is filled', () => {
    const step = tapPaint(MAKE, startState(MAKE), 'red');
    expect(step.outcome).toEqual({ kind: 'none' });
    expect(step.state.slots).toEqual(['red', null]);
    expect(viewOf(MAKE, step.state)).toEqual({ bowl: 'red', name: 'Pick two paints', text: null, help: 'Tap two paints to mix them.' });
  });

  it('counts the same paint twice as no slip, and shows that paint with the same-paint text', () => {
    for (const p of PAINT_IDS) {
      const steps = paints(MAKE_ALL, [p, p]);
      expect(kinds(steps)).toEqual(['none', 'none']);
      const s = last(steps).state;
      expect(s).toEqual({ slots: [p, p], solved: false, wrong: null });
      expect(viewOf(MAKE_ALL, s)).toEqual({ bowl: p, name: colorInfo(p).name, text: SAME_TEXT, help: 'Tap two paints to mix them.' });
    }
  });

  it('slips on a wrong pair, keyed by the pair in either order, and shows what the pair made', () => {
    const a = paints(MAKE, ['red', 'blue']);
    const b = paints(MAKE, ['blue', 'red']);
    expect(last(a).outcome).toEqual({ kind: 'slip', key: 'red+blue' });
    expect(last(b).outcome).toEqual({ kind: 'slip', key: 'red+blue' });
    expect(viewOf(MAKE, last(a).state)).toEqual({
      bowl: 'purple',
      name: 'Purple',
      text: 'Red and blue make purple, like grapes.',
      help: 'Not green yet. Try another pair.',
    });
  });

  it('counts a repeated wrong pair once for stars and every time for the stuck offer', () => {
    // red, blue (slip); red starts a new pair; blue (the same slip again); then blue, red the other way round
    const steps = paints(MAKE, ['red', 'blue', 'red', 'blue', 'blue', 'red']);
    expect(kinds(steps)).toEqual(['none', 'slip', 'none', 'slip', 'none', 'slip']);
    expect(keys(steps)).toEqual(['red+blue', 'red+blue', 'red+blue']);
    expect(new Set(keys(steps)).size).toBe(1);
  });

  it('starts a new pair with the third paint tapped', () => {
    const steps = paints(MAKE, ['red', 'blue', 'yellow']);
    expect(last(steps).outcome).toEqual({ kind: 'none' });
    expect(last(steps).state).toEqual({ slots: ['yellow', null], solved: false, wrong: null });
    expect(viewOf(MAKE, last(steps).state)).toEqual({ bowl: 'yellow', name: 'Pick two paints', text: null, help: 'Tap two paints to mix them.' });
    // and the new pair can still solve
    expect(tapPaint(MAKE, last(steps).state, 'blue').outcome).toEqual({ kind: 'solved' });
  });

  it('empties a filled slot on a tap, and the next pot fills that slot', () => {
    const wrong = last(paints(MAKE, ['red', 'blue'])).state;
    const s = tapSlot(MAKE, wrong, 0);
    expect(s).toEqual({ slots: [null, 'blue'], solved: false, wrong: null });
    expect(viewOf(MAKE, s)).toEqual({ bowl: 'blue', name: 'Pick two paints', text: null, help: 'Tap two paints to mix them.' });
    const step = tapPaint(MAKE, s, 'yellow');
    expect(step.state.slots).toEqual(['yellow', 'blue']);
    expect(step.outcome).toEqual({ kind: 'solved' });
    expect(tapSlot(MAKE, wrong, 1)).toEqual({ slots: ['red', null], solved: false, wrong: null });
  });

  it('does nothing on a tap on an empty slot', () => {
    const s = startState(MAKE);
    expect(tapSlot(MAKE, s, 0)).toBe(s);
    expect(tapSlot(MAKE, s, 1)).toBe(s);
    const one = tapPaint(MAKE, s, 'red').state;
    expect(tapSlot(MAKE, one, 1)).toBe(one);
  });

  it('does nothing on a pot that is not on the shelf', () => {
    const s = startState(MAKE);
    expect(tapPaint(MAKE, s, 'white')).toEqual({ state: s, outcome: { kind: 'none' } });
  });
});

describe('Guess the mix (4.1)', () => {
  it('slips on a wrong colour, keyed by that colour, and keeps the bowl empty and "Pick a color"', () => {
    const step = tapChoice(GUESS, startState(GUESS), 'green');
    expect(step.outcome).toEqual({ kind: 'slip', key: 'green' });
    expect(step.state.slots).toEqual(['red', 'yellow']);
    expect(step.state.solved).toBe(false);
    expect(viewOf(GUESS, step.state)).toEqual({ bowl: null, name: 'Pick a color', text: null, help: 'Not that one. Look at the two paints again.' });
  });

  it('solves on the colour the two paints make, and only then fills the bowl', () => {
    const step = tapChoice(GUESS, startState(GUESS), 'orange');
    expect(step.outcome).toEqual({ kind: 'solved' });
    expect(viewOf(GUESS, step.state)).toEqual({
      bowl: 'orange',
      name: 'Orange',
      text: 'Red and yellow make orange, like a sunset.',
      help: 'They make orange.',
    });
  });

  it('counts a wrong colour then the right one as one slip', () => {
    let s = startState(GUESS);
    const outcomes: Outcome[] = [];
    for (const c of ['purple', 'orange'] as ResultId[]) {
      const step = tapChoice(GUESS, s, c);
      outcomes.push(step.outcome);
      s = step.state;
    }
    expect(outcomes).toEqual([{ kind: 'slip', key: 'purple' }, { kind: 'solved' }]);
  });

  it('gives the same wrong colour again the same key', () => {
    const one = tapChoice(GUESS, startState(GUESS), 'green');
    const two = tapChoice(GUESS, one.state, 'green');
    expect(two.outcome).toEqual(one.outcome);
  });

  it('solves once on a double tap on the right colour', () => {
    const first = tapChoice(GUESS, startState(GUESS), 'orange');
    const second = tapChoice(GUESS, first.state, 'orange');
    expect(first.outcome).toEqual({ kind: 'solved' });
    expect(second).toEqual({ state: first.state, outcome: { kind: 'none' } });
  });

  it('does nothing on the slots, on pots, or on a colour that is not a choice', () => {
    const s = startState(GUESS);
    expect(tapSlot(GUESS, s, 0)).toBe(s);
    expect(tapSlot(GUESS, s, 1)).toBe(s);
    for (const p of PAINT_IDS) expect(tapPaint(GUESS, s, p)).toEqual({ state: s, outcome: { kind: 'none' } });
    expect(tapChoice(GUESS, s, 'cream')).toEqual({ state: s, outcome: { kind: 'none' } });
  });

  it('ignores swatch taps in Finish and Make it', () => {
    for (const p of [FINISH, MAKE]) {
      const s = startState(p);
      for (const c of RESULT_IDS) expect(tapChoice(p, s, c)).toEqual({ state: s, outcome: { kind: 'none' } });
    }
  });
});

describe('after the solve (4.1 edge cases)', () => {
  it('does nothing on any tap, so a double tap solves once', () => {
    const cases: [Puzzle, MixState][] = [
      [FINISH, tapPaint(FINISH, startState(FINISH), 'yellow').state],
      [MAKE, last(paints(MAKE, ['blue', 'yellow'])).state],
      [GUESS, tapChoice(GUESS, startState(GUESS), 'orange').state],
    ];
    for (const [p, s] of cases) {
      expect(s.solved).toBe(true);
      for (const paint of PAINT_IDS) expect(tapPaint(p, s, paint)).toEqual({ state: s, outcome: { kind: 'none' } });
      for (const c of RESULT_IDS) expect(tapChoice(p, s, c)).toEqual({ state: s, outcome: { kind: 'none' } });
      expect(tapSlot(p, s, 0)).toBe(s);
      expect(tapSlot(p, s, 1)).toBe(s);
    }
  });

  it('shows only the next puzzle after a swap or Next, even while a wrong mix showed', () => {
    const wrong = last(paints(MAKE, ['red', 'blue'])).state;
    expect(viewOf(MAKE, wrong).bowl).toBe('purple');
    // the kit swaps in a new puzzle, which starts from its own start state
    for (const next of [MAKE_ALL, GUESS]) expect(viewOf(next, startState(next)).bowl).toBeNull();
    expect(viewOf(FINISH, startState(FINISH)).bowl).toBe(FINISH.given);
  });
});

describe('pots pressed while in a slot (9.2)', () => {
  it('presses a pot while its paint is in a slot the child filled', () => {
    let s = startState(MAKE);
    for (const p of MAKE.shelf) expect(isPicked(MAKE, s, p)).toBe(false);
    s = tapPaint(MAKE, s, 'red').state;
    expect(MAKE.shelf.filter((p) => isPicked(MAKE, s, p))).toEqual(['red']);
    s = tapPaint(MAKE, s, 'blue').state;
    expect(MAKE.shelf.filter((p) => isPicked(MAKE, s, p))).toEqual(['blue', 'red']);
    s = tapSlot(MAKE, s, 0);
    expect(MAKE.shelf.filter((p) => isPicked(MAKE, s, p))).toEqual(['blue']);
  });

  it('presses one pot for the same paint twice', () => {
    const s = last(paints(MAKE, ['red', 'red'])).state;
    expect(MAKE.shelf.filter((p) => isPicked(MAKE, s, p))).toEqual(['red']);
  });

  it('never presses a pot for the given paint, and presses paint 2 in Finish', () => {
    let s = startState(FINISH);
    expect(isPicked(FINISH, s, 'blue')).toBe(false);
    s = tapPaint(FINISH, s, 'red').state;
    expect(isPicked(FINISH, s, 'red')).toBe(true);
    expect(isPicked(FINISH, s, 'yellow')).toBe(false);
    expect(isPicked(FINISH, s, 'blue')).toBe(false);
  });
});

describe('speech and colours (4.1 speech, 7.3)', () => {
  it('reads the chip alone before a mix, and the chip then the result text after one', () => {
    const chip = 'Can you make green?';
    expect(speechOf(chip, viewOf(MAKE, startState(MAKE)))).toBe(chip);
    expect(speechOf(chip, viewOf(MAKE, tapPaint(MAKE, startState(MAKE), 'red').state))).toBe(chip);
    const wrong = last(paints(MAKE, ['red', 'blue'])).state;
    expect(speechOf(chip, viewOf(MAKE, wrong))).toBe('Can you make green? Red and blue make purple, like grapes.');
    const same = last(paints(MAKE, ['red', 'red'])).state;
    expect(speechOf(chip, viewOf(MAKE, same))).toBe(`Can you make green? ${SAME_TEXT}`);
  });

  it('reads only the Guess question until the right colour is tapped', () => {
    const q = 'What do red and yellow make?';
    const wrong = tapChoice(GUESS, startState(GUESS), 'green').state;
    expect(speechOf(q, viewOf(GUESS, wrong))).toBe(q);
    const solved = tapChoice(GUESS, wrong, 'orange').state;
    expect(speechOf(q, viewOf(GUESS, solved))).toBe('What do red and yellow make? Red and yellow make orange, like a sunset.');
  });

  it('colours slots, pots and swatches with the board hex values', () => {
    for (const id of [...PAINT_IDS, ...RESULT_IDS] as ColorId[]) expect(hexOf(id)).toBe(colorInfo(id).hex);
    expect(hexOf('white')).toBe('#f6f3ff');
    expect(hexOf('cream')).toBe('#ffe9a6');
  });
});

/* ---------- a walk over every tap order (4.1 content check) ---------- */

type Tap = { kind: 'paint'; paint: PaintId } | { kind: 'choice'; color: ResultId } | { kind: 'slot'; slot: 0 | 1 };
const TAPS: Tap[] = [
  ...PAINT_IDS.map((paint): Tap => ({ kind: 'paint', paint })),
  ...RESULT_IDS.map((color): Tap => ({ kind: 'choice', color })),
  { kind: 'slot', slot: 0 },
  { kind: 'slot', slot: 1 },
];

function apply(p: Puzzle, s: MixState, t: Tap): Step {
  if (t.kind === 'paint') return tapPaint(p, s, t.paint);
  if (t.kind === 'choice') return tapChoice(p, s, t.color);
  const state = tapSlot(p, s, t.slot);
  return { state, outcome: { kind: 'none' } };
}

const stateKey = (s: MixState): string => `${s.slots[0]}|${s.slots[1]}|${s.solved}|${s.wrong}`;
const tapName = (t: Tap): string => (t.kind === 'paint' ? t.paint : t.kind === 'choice' ? t.color : `slot ${t.slot + 1}`);

/** Walks every state a puzzle can reach by any tap order and returns the rule breaks it finds. */
function walk(p: Puzzle): { problems: string[]; states: number; farthest: number } {
  const problems: string[] = [];
  const seen = new Map<string, MixState>();
  const edges = new Map<string, string[]>();
  const queue: MixState[] = [startState(p)];
  seen.set(stateKey(queue[0]), queue[0]);
  const goal: ResultId = p.form === 'guess' ? p.answer : p.goal;

  while (queue.length) {
    const s = queue.shift()!;
    const from = stateKey(s);
    const view = viewOf(p, s);
    // the given slots never change
    if (p.form === 'finish' && s.slots[0] !== p.given) problems.push(`${from}: paint 1 moved`);
    if (p.form === 'guess' && (s.slots[0] !== p.paints[0] || s.slots[1] !== p.paints[1])) problems.push(`${from}: a Guess slot moved`);
    // the bowl: nothing in Guess before the answer; the mix, the one paint or empty otherwise
    if (p.form === 'guess') {
      if (!s.solved && (view.bowl !== null || view.name !== 'Pick a color' || view.text !== null)) problems.push(`${from}: Guess shows the mix early`);
      if (s.solved && view.bowl !== p.answer) problems.push(`${from}: solved Guess bowl`);
    } else {
      const [a, b] = s.slots;
      const want = a && b ? (mixOf(a, b) ?? a) : (a ?? b);
      if (view.bowl !== want) problems.push(`${from}: bowl ${view.bowl}, want ${want}`);
    }
    const out: string[] = [];
    for (const t of TAPS) {
      const { state: next, outcome } = apply(p, s, t);
      const to = stateKey(next);
      const at = `${from} + ${tapName(t)}`;
      if (s.solved) {
        if (outcome.kind !== 'none' || to !== from) problems.push(`${at}: a tap after the solve changed something`);
        continue;
      }
      if ((outcome.kind === 'solved') !== next.solved) problems.push(`${at}: solved flag and outcome disagree`);
      if (outcome.kind === 'solved') {
        const right = p.form === 'guess' ? t.kind === 'choice' && t.color === p.answer : next.slots[0] && next.slots[1] && mixOf(next.slots[0], next.slots[1]) === goal;
        if (!right) problems.push(`${at}: solved without the right answer`);
      }
      if (outcome.kind === 'slip') {
        if (p.form === 'guess') {
          if (t.kind !== 'choice' || t.color === p.answer || outcome.key !== t.color) problems.push(`${at}: bad Guess slip`);
        } else {
          const [a, b] = next.slots;
          if (!a || !b) problems.push(`${at}: slip with an empty slot`);
          else if (a === b) problems.push(`${at}: the same paint twice slipped`);
          else if (mixOf(a, b) === goal || outcome.key !== pairKey(a, b)) problems.push(`${at}: bad pair slip`);
        }
      }
      if (p.form !== 'guess' && outcome.kind === 'none' && !next.solved) {
        const [a, b] = next.slots;
        if (t.kind === 'paint' && a && b && a !== b && to !== from) problems.push(`${at}: a wrong pair gave no slip`);
      }
      out.push(to);
      if (!seen.has(to)) {
        seen.set(to, next);
        queue.push(next);
      }
    }
    edges.set(from, out);
  }

  // From every state the child can reach, some tap order still reaches the solve.
  const dist = new Map<string, number>();
  for (const [k, s] of seen) if (s.solved) dist.set(k, 0);
  for (let changed = true; changed; ) {
    changed = false;
    for (const [k, out] of edges) {
      const best = Math.min(...out.map((o) => dist.get(o) ?? Infinity)) + 1;
      if (best < (dist.get(k) ?? Infinity)) {
        dist.set(k, best);
        changed = true;
      }
    }
  }
  for (const k of seen.keys()) if (!dist.has(k)) problems.push(`${k}: stuck, no tap order solves from here`);
  if (![...seen.values()].some((s) => s.solved)) problems.push('never solves');
  return { problems, states: seen.size, farthest: Math.max(...dist.values()) };
}

describe('a walk over every tap order reaches the solve and never gets stuck (4.1)', () => {
  const pick = rng(4242);
  const SEEDS = [0, 2 ** 31 - 1, ...Array.from({ length: 198 }, () => Math.floor(pick() * 2 ** 31))];

  LEVELS.forEach((def, level) => {
    it(`Level ${level + 1} (${def.form}), every puzzle over 200 seeds`, () => {
      const problems: string[] = [];
      for (const seed of SEEDS) {
        makePuzzles(level, seed).forEach((p, n) => {
          const { problems: found, farthest } = walk(p);
          for (const f of found) problems.push(`seed ${seed} puzzle ${n}: ${f}`);
          // the right taps are never more than 3 away: empty a slot or start a new pair, then the pair
          if (farthest > 3) problems.push(`seed ${seed} puzzle ${n}: ${farthest} taps from the solve`);
        });
      }
      expect(problems.slice(0, 10)).toEqual([]);
    });
  });

  it('solves from the start with the right taps in every order', () => {
    for (let level = 0; level < LEVELS.length; level++) {
      for (const p of makePuzzles(level, 2026)) {
        if (p.form === 'guess') expect(tapChoice(p, startState(p), p.answer).outcome.kind).toBe('solved');
        else if (p.form === 'finish') expect(tapPaint(p, startState(p), p.answer).outcome.kind).toBe('solved');
        else {
          const [a, b] = p.answer;
          expect(kinds(paints(p, [a, b]))).toEqual(['none', 'solved']);
          expect(kinds(paints(p, [b, a]))).toEqual(['none', 'solved']);
        }
      }
    }
  });

  it('finds the walk small: every puzzle has only a few states', () => {
    for (let level = 0; level < LEVELS.length; level++) {
      for (const p of makePuzzles(level, 7)) {
        const { states } = walk(p);
        expect(states).toBeGreaterThan(1);
        expect(states).toBeLessThanOrEqual(5 * 5 * 2 * (RESULT_IDS.length + 1));
      }
    }
  });

  it('makes each Finish wrong paint show its own recipe text', () => {
    for (const p of makePuzzles(6, 11) as FinishPuzzle[]) {
      for (const paint of p.shelf.filter((x) => x !== p.answer)) {
        const s = tapPaint(p, startState(p), paint).state;
        const made = mixOf(p.given, paint)!;
        expect(viewOf(p, s).text).toBe(recipeFor(made).text);
      }
    }
  });
});
