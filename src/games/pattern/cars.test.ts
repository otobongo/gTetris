/** Pattern Train's cars (brief 4.4, 7.6, 8): the board's 4 shapes in its 5 colours, 20 cars, and how a car is keyed and named. */
import { describe, expect, it } from 'vitest';
import { BRICK_COLORS } from '../../shared/ui/palette';
import { ALL_CARS, CAR_COLORS, SHAPES, carKey, carName, sameCar, type Car } from './cars';

describe('the board’s shapes and colours (4.4)', () => {
  it('uses the board’s 4 shapes: circle, square, triangle and star', () => {
    expect([...SHAPES]).toEqual(['circle', 'square', 'triangle', 'star']);
  });

  it('uses the board’s 5 colours: red, blue, yellow, green and pink', () => {
    expect([...CAR_COLORS]).toEqual(['red', 'blue', 'yellow', 'green', 'pink']);
  });

  it('draws every colour from the brick palette, so the Play screen reads a --brick-* token', () => {
    for (const c of CAR_COLORS) expect(BRICK_COLORS, c).toContain(c);
  });

  it('holds no purple: the avoid list’s blue and purple pair can never meet in a train', () => {
    expect(CAR_COLORS as readonly string[]).not.toContain('purple');
  });
});

describe('all 20 cars, no new art (4.4)', () => {
  it('holds every shape in every colour once: 20 cars', () => {
    expect(ALL_CARS).toHaveLength(20);
    expect(new Set(ALL_CARS.map(carKey)).size).toBe(20);
    for (const shape of SHAPES) for (const color of CAR_COLORS) expect(ALL_CARS.filter((c) => c.shape === shape && c.color === color), `${color} ${shape}`).toHaveLength(1);
  });

  it('lists the shapes first, each in the 5 colours in order', () => {
    expect(ALL_CARS.slice(0, 5)).toEqual(CAR_COLORS.map((color) => ({ shape: 'circle', color })));
    expect(ALL_CARS.slice(15)).toEqual(CAR_COLORS.map((color) => ({ shape: 'star', color })));
  });
});

describe('carKey, sameCar and carName', () => {
  const red: Car = { shape: 'circle', color: 'red' };

  it('keys a car as colour, then shape', () => {
    expect(carKey(red)).toBe('red-circle');
    expect(carKey({ shape: 'triangle', color: 'yellow' })).toBe('yellow-triangle');
  });

  it('keys two equal cars the same, whatever object holds them', () => {
    expect(carKey({ ...red })).toBe(carKey(red));
    expect(carKey({ color: 'red', shape: 'circle' })).toBe(carKey(red));
  });

  it('keys cars that differ in shape or colour apart', () => {
    expect(carKey({ shape: 'square', color: 'red' })).not.toBe(carKey(red));
    expect(carKey({ shape: 'circle', color: 'pink' })).not.toBe(carKey(red));
  });

  it('finds two cars the same only when both shape and colour match', () => {
    expect(sameCar(red, { ...red })).toBe(true);
    expect(sameCar(red, { shape: 'square', color: 'red' })).toBe(false);
    expect(sameCar(red, { shape: 'circle', color: 'blue' })).toBe(false);
    expect(sameCar(red, { shape: 'star', color: 'green' })).toBe(false);
  });

  it('agrees with carKey on every pair of the 20 cars', () => {
    for (const a of ALL_CARS) for (const b of ALL_CARS) expect(sameCar(a, b)).toBe(carKey(a) === carKey(b));
  });

  it('names a car in lower case, colour first, for use inside a sentence (8)', () => {
    expect(carName(red)).toBe('red circle');
    expect(carName({ shape: 'triangle', color: 'yellow' })).toBe('yellow triangle');
    expect(carName({ shape: 'star', color: 'green' })).toBe('green star');
    for (const c of ALL_CARS) expect(carName(c)).toBe(carName(c).toLowerCase());
  });

  it('gives each of the 20 cars its own name', () => {
    expect(new Set(ALL_CARS.map(carName)).size).toBe(20);
  });
});
