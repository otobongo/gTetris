/**
 * Grown-up check (brief decision 2): type the number that is spelled out. The first check
 * always asks for 47; each wrong answer moves to the next number (Break board).
 */
export const GATE_ASKS: readonly (readonly [number, string])[] = [
  [47, 'forty-seven'],
  [62, 'sixty-two'],
  [38, 'thirty-eight'],
  [85, 'eighty-five'],
  [29, 'twenty-nine'],
  [74, 'seventy-four'],
];

export function gateAsk(attempt: number): { value: number; words: string } {
  const [value, words] = GATE_ASKS[((attempt % GATE_ASKS.length) + GATE_ASKS.length) % GATE_ASKS.length];
  return { value, words };
}

/** True only for digits that equal the asked number (spaces around them are fine). */
export function gateMatches(answer: string, attempt: number): boolean {
  const v = answer.trim();
  return /^[0-9]{1,3}$/.test(v) && Number(v) === gateAsk(attempt).value;
}
