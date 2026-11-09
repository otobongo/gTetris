/* Pattern Train's tap rules and what the screen shows, as pure functions (six-games brief 4.4, 7.6, 8.5, 9.2). The
   Play screen reads these and nothing else decides: which tap is right, which help line shows, what the train
   draws and what the speaker reads. No React, no DOM, so Vitest runs them in node. */
import { carKey, sameCar, type Car } from './cars';
import { HELP_START, HELP_WRONG, helpSolved, speech, speechSolved } from './copy';
import type { PatternPuzzle } from './puzzles';

/** What a tap on a car means: the right one solves; a wrong one is a slip, keyed by the car so a repeat adds no star slip (brief 3.1). */
export type Verdict = { kind: 'right' } | { kind: 'slip'; key: string };

export function judge(p: PatternPuzzle, car: Car): Verdict {
  return sameCar(car, p.answer) ? { kind: 'right' } : { kind: 'slip', key: carKey(car) };
}

/** The help-row line the game itself shows: the solved line, the wrong line after a wrong tap on this puzzle, or the start line. The kit's offer and swap lines take its place when they apply. */
export function helpLine(p: PatternPuzzle, state: { solved: boolean; wrong: boolean }): string {
  if (state.solved) return helpSolved(p.answer);
  return state.wrong ? HELP_WRONG : HELP_START;
}

/** One place on the rail after the locomotive: a shown car, the empty car, or the empty car filled with the answer (ringed). */
export interface TrainSlot {
  car: Car | null;
  state: 'car' | 'empty' | 'answer';
}

/** The cars on the rail: the shown cars, then the empty car, or the answer in it once solved. */
export function trainSlots(p: PatternPuzzle, solved: boolean): TrainSlot[] {
  const shown = p.cars.map((car): TrainSlot => ({ car, state: 'car' }));
  return [...shown, solved ? { car: p.answer, state: 'answer' } : { car: null, state: 'empty' }];
}

/** What the speaker reads: the pattern and the question, or, once solved, the whole train and the solved line. */
export const spokenFor = (p: PatternPuzzle, solved: boolean): string => (solved ? speechSolved(p.cars, p.answer) : speech(p.cars));
