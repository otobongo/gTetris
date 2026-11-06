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
