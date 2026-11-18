/**
 * Grown-up check (decision D1): a new two-digit addition every time the check opens, such as
 * "What is 23 + 19?". Each number is 11 to 49, so the answer is 22 to 98. A wrong answer brings a
 * new sum with a different answer. Randomness comes in as a function so tests can fix it.
 */
export const GATE_MIN = 11;
export const GATE_MAX = 49;

export interface GateSum {
  a: number;
  b: number;
}

export type Random = () => number;

/** One addend from a random number in [0, 1). Out-of-range or broken values still land in 11 to 49. */
function addend(random: Random): number {
  const r = random();
  const unit = Number.isFinite(r) ? Math.min(Math.max(r, 0), 1 - Number.EPSILON) : 0;
  return GATE_MIN + Math.floor(unit * (GATE_MAX - GATE_MIN + 1));
}

export function makeGateSum(random: Random = Math.random): GateSum {
  return { a: addend(random), b: addend(random) };
}

export const gateAnswer = (sum: GateSum): number => sum.a + sum.b;

/**
 * The sum after a wrong answer: a fresh one whose answer differs from the last, so the number
 * that was just typed (or guessed from the last sum) never passes. A random function that keeps
 * repeating itself still gets a different answer, by moving the second number one step.
 */
export function nextGateSum(previous: GateSum, random: Random = Math.random): GateSum {
  for (let i = 0; i < 8; i++) {
    const next = makeGateSum(random);
    if (gateAnswer(next) !== gateAnswer(previous)) return next;
  }
  const b = previous.b < GATE_MAX ? previous.b + 1 : previous.b - 1;
  return { a: previous.a, b };
}

/** What the check shows: "What is 23 + 19?" */
export const gateQuestion = (sum: GateSum): string => `What is ${sum.a} + ${sum.b}?`;

/** What a screen reader says for the answer field: the sum in words, "Answer for 23 plus 19". */
export const gateSpoken = (sum: GateSum): string => `Answer for ${sum.a} plus ${sum.b}`;

/** True only for digits that equal the answer (spaces around them are fine). */
export function gateMatches(answer: string, sum: GateSum): boolean {
  const v = answer.trim();
  return /^[0-9]{1,3}$/.test(v) && Number(v) === gateAnswer(sum);
}

/** What Check does with the typed answer: an empty field (or spaces only) is neither right nor wrong. */
export type GateResult = 'empty' | 'wrong' | 'right';

export function checkGateAnswer(answer: string, sum: GateSum): GateResult {
  if (answer.trim() === '') return 'empty';
  return gateMatches(answer, sum) ? 'right' : 'wrong';
}

/* ---------- Family PIN mode (decision 14): copy and the Forgot the PIN hold ---------- */

/** "Too many tries. Try again in 30 seconds." in whole seconds, rounded up. */
export function pinLockLine(ms: number): string {
  const s = Math.max(1, Math.ceil(ms / 1000));
  return `Too many tries. Try again in ${s} ${s === 1 ? 'second' : 'seconds'}.`;
}

/** Settings' line after Forgot the PIN: "The PIN was cleared with Forgot the PIN on 16 November." */
export function pinClearedLine(at: number): string {
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(new Date(at));
  return `The PIN was cleared with Forgot the PIN on ${day}.`;
}

/** Forgot the PIN clears it only after the button is held down this long without letting go. */
export const PIN_HOLD_MS = 10_000;

/**
 * Where a hold is after `elapsed` ms: whole seconds left (10 down to 0), how much of the bar is filled, and
 * whether it is done. Under Reduce Motion the bar moves once a second, in step with the count.
 */
export function holdProgress(elapsed: number, reduced: boolean): { left: number; fraction: number; done: boolean } {
  const ms = Math.min(Math.max(Number.isFinite(elapsed) ? elapsed : 0, 0), PIN_HOLD_MS);
  const done = ms >= PIN_HOLD_MS;
  const left = Math.ceil((PIN_HOLD_MS - ms) / 1000);
  const shown = reduced ? Math.floor(ms / 1000) * 1000 : ms;
  return { left, fraction: done ? 1 : shown / PIN_HOLD_MS, done };
}
