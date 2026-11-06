/* Color Mixer's tap rules as pure functions (brief 4.1): what each tap does to the two slots, whether it
   solves or slips, and what the bowl and result block show. The Play screen only draws this and feeds the
   kit's `slip(key)` and `solve()`. No React and no DOM, so Vitest can walk every tap order.

   Slips: a wrong pair (Finish, Make it) or a wrong colour (Guess). The slip key is that pair or colour, so
   the kit counts a repeat once for stars while every wrong tap still feeds the stuck offer. The same paint
   in both slots is not a wrong answer: it shows its own colour and teaches, and costs nothing. */
import {
  SAME_TEXT,
  colorInfo,
  mixOf,
  pairKey,
  recipeFor,
  type ColorId,
  type PaintId,
  type ResultId,
} from './colors';
import { RESULT_NAME_EMPTY, helpSlip, helpSolved, helpStart, resultName } from './copy';
import type { Puzzle } from './puzzles';

export type Slots = readonly [PaintId | null, PaintId | null];

export interface MixState {
  slots: Slots;
  solved: boolean;
  /** The wrong colour just made or tapped, until the next change; null when the last move was no slip. */
  wrong: ResultId | null;
}

export type Outcome = { kind: 'none' } | { kind: 'slip'; key: string } | { kind: 'solved' };

export interface Step {
  state: MixState;
  outcome: Outcome;
}

const NONE: Outcome = { kind: 'none' };

/** The state a puzzle starts in: Finish has its paint in slot 1, Guess has both, Make it has none. */
export function startState(p: Puzzle): MixState {
  const slots: Slots = p.form === 'finish' ? [p.given, null] : p.form === 'guess' ? p.paints : [null, null];
  return { slots, solved: false, wrong: null };
}

/** True for a slot the child cannot change: Finish's paint 1 and both Guess slots. */
export function isGiven(p: Puzzle, slot: 0 | 1): boolean {
  return p.form === 'guess' || (p.form === 'finish' && slot === 0);
}

/** The paints a puzzle offers on its shelf (Guess has none). */
export const shelfOf = (p: Puzzle): readonly PaintId[] => (p.form === 'guess' ? [] : p.shelf);

/** True while a paint sits in a slot the child filled: the pot's `aria-pressed`. */
export function isPicked(p: Puzzle, s: MixState, paint: PaintId): boolean {
  return s.slots.some((x, i) => x === paint && !isGiven(p, i as 0 | 1));
}

/** Evaluates two full slots. The same paint twice is no slip; a pair that is not the goal is. */
function judge(goal: ResultId, a: PaintId, b: PaintId): { outcome: Outcome; wrong: ResultId | null } {
  const made = mixOf(a, b);
  if (made === null) return { outcome: NONE, wrong: null };
  if (made === goal) return { outcome: { kind: 'solved' }, wrong: null };
  return { outcome: { kind: 'slip', key: pairKey(a, b) }, wrong: made };
}

/** A tap on a pot (Finish, Make it). Taps off the shelf, in Guess and after the solve do nothing. */
export function tapPaint(p: Puzzle, s: MixState, paint: PaintId): Step {
  if (s.solved || p.form === 'guess' || !p.shelf.includes(paint)) return { state: s, outcome: NONE };
  let slots: Slots;
  if (p.form === 'finish') slots = [p.given, paint];
  else if (!s.slots[0]) slots = [paint, s.slots[1]];
  else if (!s.slots[1]) slots = [s.slots[0], paint];
  else slots = [paint, null]; // a third tap starts a new pair
  const [a, b] = slots;
  const { outcome, wrong } = a && b ? judge(p.goal, a, b) : { outcome: NONE, wrong: null };
  return { state: { slots, solved: outcome.kind === 'solved', wrong }, outcome };
}

/** A tap on a swatch (Guess only). A wrong colour is a slip keyed by that colour; the right one solves. */
export function tapChoice(p: Puzzle, s: MixState, color: ResultId): Step {
  if (s.solved || p.form !== 'guess' || !p.choices.includes(color)) return { state: s, outcome: NONE };
  if (color === p.answer) return { state: { ...s, solved: true, wrong: null }, outcome: { kind: 'solved' } };
  return { state: { ...s, wrong: color }, outcome: { kind: 'slip', key: color } };
}

/** A tap on a slot: a given or empty slot does nothing; a filled one empties that slot. */
export function tapSlot(p: Puzzle, s: MixState, slot: 0 | 1): MixState {
  if (s.solved || isGiven(p, slot) || !s.slots[slot]) return s;
  const slots: Slots = slot === 0 ? [null, s.slots[1]] : [s.slots[0], null];
  return { slots, solved: false, wrong: null };
}

export interface View {
  /** The liquid colour; null shows the empty bowl (`--brick-white-light`). In Guess it stays null until the right colour is tapped. */
  bowl: ColorId | null;
  /** The result name. */
  name: string;
  /** The result text, or null when there is nothing to teach yet. */
  text: string | null;
  /** The help line: start, slip or solved. */
  help: string;
}

/** What the bowl, result block and help line show for a state. */
export function viewOf(p: Puzzle, s: MixState): View {
  const help = s.solved ? helpSolved(p) : s.wrong ? helpSlip(p) : helpStart(p);
  if (p.form === 'guess') {
    if (!s.solved) return { bowl: null, name: RESULT_NAME_EMPTY.guess, text: null, help };
    return { bowl: p.answer, name: resultName(p.answer), text: recipeFor(p.answer).text, help };
  }
  const [a, b] = s.slots;
  if (a && b) {
    const made = mixOf(a, b);
    if (made === null) return { bowl: a, name: resultName(a), text: SAME_TEXT, help };
    return { bowl: made, name: resultName(made), text: recipeFor(made).text, help };
  }
  const one = a ?? b;
  return { bowl: one, name: RESULT_NAME_EMPTY[p.form], text: null, help };
}

/** The line the speaker reads: the chip, and after a mix the result text. */
export function speechOf(chipText: string, view: View): string {
  return view.text ? `${chipText} ${view.text}` : chipText;
}

/** The colour of a paint or result, for a swatch or slot. */
export const hexOf = (id: ColorId): string => colorInfo(id).hex;
