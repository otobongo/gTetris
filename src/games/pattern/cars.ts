/* Pattern Train's cars (six-games brief 4.4): the board's 4 shapes in its 5 colours, so 20 cars and no new art.
   Colours are brick palette names, so the Play screen reads them as `--brick-<name>` tokens. */
import type { BrickColor } from '../../shared/ui/palette';

export const SHAPES = ['circle', 'square', 'triangle', 'star'] as const;
export type ShapeId = (typeof SHAPES)[number];

export const CAR_COLORS = ['red', 'blue', 'yellow', 'green', 'pink'] as const satisfies readonly BrickColor[];
export type CarColor = (typeof CAR_COLORS)[number];

export interface Car {
  shape: ShapeId;
  color: CarColor;
}

/** A stable text for a car, `<color>-<shape>`: the key for comparing and for the stuck key of a repeated wrong car. */
export const carKey = (c: Car): string => `${c.color}-${c.shape}`;

export const sameCar = (a: Car, b: Car): boolean => a.shape === b.shape && a.color === b.color;

/** The car's name inside a sentence, lower case: "red circle". */
export const carName = (c: Car): string => `${c.color} ${c.shape}`;

/** All 20 cars, shapes first. */
export const ALL_CARS: readonly Car[] = SHAPES.flatMap((shape) => CAR_COLORS.map((color) => ({ shape, color })));
