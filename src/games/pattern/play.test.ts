/* Pattern Train's tap rules and screen lines (six-games brief 4.4, 7.6, 8.5, 9.2), in node: no DOM. */
import { describe, expect, it } from 'vitest';
import { carKey, type Car } from './cars';
import { HELP_MAX_CHARS, HELP_START, HELP_WRONG, PROMPT, speech, speechSolved, trainName } from './copy';
import { helpLine, judge, spokenFor, trainSlots } from './play';
import { FIXTURES, fixturePuzzle, makePuzzles } from './puzzles';

const car = (color: Car['color'], shape: Car['shape']): Car => ({ color, shape });

const level1 = fixturePuzzle(FIXTURES[0]);

describe('judge', () => {
  it('calls the answer right', () => {
    expect(judge(level1, level1.answer)).toEqual({ kind: 'right' });
  });

  it('calls every wrong option a slip keyed by the car', () => {
    for (const option of level1.options.filter((o) => carKey(o) !== carKey(level1.answer))) {
      expect(judge(level1, option)).toEqual({ kind: 'slip', key: carKey(option) });
    }
  });

  it('gives the same key for the same wrong car, so a repeat adds no star slip', () => {
    const wrong = level1.options.find((o) => carKey(o) !== carKey(level1.answer))!;
    expect(judge(level1, { ...wrong })).toEqual(judge(level1, wrong));
  });

  it('judges a car by colour and shape together', () => {
    const answer = level1.answer;
    const otherShape = car(answer.color, answer.shape === 'star' ? 'circle' : 'star');
    expect(judge(level1, otherShape).kind).toBe('slip');
  });

  it('finds exactly one right option in every generated puzzle', () => {
    for (let level = 0; level < 12; level++) {
      for (const p of makePuzzles(level, 7)) {
        expect(p.options.filter((o) => judge(p, o).kind === 'right')).toHaveLength(1);
      }
    }
  });
});

describe('helpLine', () => {
  it('starts with the start line', () => {
    expect(helpLine(level1, { solved: false, wrong: false })).toBe(HELP_START);
  });

  it('says to try again after a wrong tap', () => {
    expect(helpLine(level1, { solved: false, wrong: true })).toBe(HELP_WRONG);
  });

  it('names the answer once solved, even after a wrong tap', () => {
    const line = helpLine(level1, { solved: true, wrong: true });
    expect(line).toMatch(/ comes next\.$/);
    expect(line.charAt(0)).toBe(line.charAt(0).toUpperCase());
    expect(line.toLowerCase()).toContain(`${level1.answer.color} ${level1.answer.shape}`);
  });

  it('keeps every line inside the help style limit', () => {
    for (const wrong of [false, true]) {
      for (const solved of [false, true]) expect(helpLine(level1, { solved, wrong }).length).toBeLessThanOrEqual(HELP_MAX_CHARS);
    }
  });
});

describe('trainSlots', () => {
  it('draws the shown cars then the empty car', () => {
    const slots = trainSlots(level1, false);
    expect(slots).toHaveLength(level1.cars.length + 1);
    expect(slots.slice(0, -1).every((s) => s.state === 'car' && s.car !== null)).toBe(true);
    expect(slots.slice(0, -1).map((s) => s.car)).toEqual(level1.cars);
    expect(slots.at(-1)).toEqual({ car: null, state: 'empty' });
  });

  it('puts the answer in the empty car once solved', () => {
    const slots = trainSlots(level1, true);
    expect(slots).toHaveLength(level1.cars.length + 1);
    expect(slots.at(-1)).toEqual({ car: level1.answer, state: 'answer' });
  });

  it('matches the train name the screen reads', () => {
    expect(trainName(level1.cars, null)).toMatch(/, empty car\.$/);
    expect(trainName(level1.cars, level1.answer)).not.toMatch(/empty car/);
  });
});

describe('spokenFor', () => {
  it('reads the pattern and the question before the solve', () => {
    expect(spokenFor(level1, false)).toBe(speech(level1.cars));
    expect(spokenFor(level1, false)).toMatch(/What comes next\?$/);
  });

  it('reads the whole train and the solved line after it', () => {
    const said = spokenFor(level1, true);
    expect(said).toBe(speechSolved(level1.cars, level1.answer));
    expect(said).toMatch(/ comes next\.$/);
    expect(said.split(',').length).toBe(level1.cars.length + 1);
  });

  it('starts a sentence with a capital and keeps car names lower case inside', () => {
    expect(speechSolved([car('red', 'circle'), car('blue', 'square')], car('red', 'circle'))).toBe(
      'Red circle, blue square, red circle. Red circle comes next.',
    );
  });

  it('has no dashes or exclamation marks in any line', () => {
    for (const text of [PROMPT, spokenFor(level1, false), spokenFor(level1, true)]) expect(text).not.toMatch(/[—–!]/);
  });
});
