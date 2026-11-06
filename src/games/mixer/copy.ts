/* Color Mixer's child-facing lines, exactly as brief 8.2 words them, plus the accessible names from 9.2.
   The shared lines (dots, Next, the offer, the level card) live in the kit's copy.ts. Colour names inside a
   sentence are lower case ("sky blue"); a name that starts a line is capitalised. */
import { colorInfo, colorWord, type ColorId, type PaintId, type ResultId } from './colors';
import type { Form } from './levels';
import type { Puzzle } from './puzzles';

export const TITLE = 'Color Mixer';

/** The speaker's name; it reads the chip, and after a mix the result text. */
export const SPEAKER_NAME = 'Hear the question';

/** The label inside an empty slot, by slot number (0 or 1). */
export const EMPTY_SLOT_LABEL = ['paint 1', 'paint 2'] as const;

export interface Chip {
  /** The whole line, for speech and the accessible name. */
  text: string;
  /** A colour circle shown before the name (the goal in Finish and Make it); none in Guess. */
  circle: ResultId | null;
}

/** The chip: "Can you make green?" (Finish, Make it) or "What do red and yellow make?" (Guess). */
export function chip(p: Puzzle): Chip {
  if (p.form === 'guess') return { text: `What do ${colorWord(p.paints[0])} and ${colorWord(p.paints[1])} make?`, circle: null };
  return { text: `Can you make ${colorWord(p.goal)}?`, circle: p.goal };
}

/** The result name before anything is mixed. */
export const RESULT_NAME_EMPTY: Record<Form, string> = {
  finish: 'Pick one more paint',
  make: 'Pick two paints',
  guess: 'Pick a color',
};

/** The result name after a mix: "Orange", "Sky blue"; the same paint twice shows that paint's name. */
export const resultName = (id: ColorId): string => colorInfo(id).name;

/** The help line at the start of a puzzle. */
export function helpStart(p: Puzzle): string {
  if (p.form === 'finish') return `Tap the paint that makes ${colorWord(p.goal)}.`;
  if (p.form === 'make') return 'Tap two paints to mix them.';
  return 'Tap the color they make.';
}

/** The help line after a wrong mix or a wrong swatch. */
export function helpSlip(p: Puzzle): string {
  if (p.form === 'finish') return `Not ${colorWord(p.goal)} yet. Try another paint.`;
  if (p.form === 'make') return `Not ${colorWord(p.goal)} yet. Try another pair.`;
  return 'Not that one. Look at the two paints again.';
}

/** The help line once the puzzle is solved. */
export function helpSolved(p: Puzzle): string {
  if (p.form === 'guess') return `They make ${colorWord(p.answer)}.`;
  return `You made ${colorWord(p.goal)}.`;
}

/* ---------- accessible names (brief 9.2) ---------- */

/** A pot on the shelf: "Red paint". */
export const potName = (paint: PaintId): string => `${colorInfo(paint).name} paint`;

/** A slot, by slot number (0 or 1): "Paint 1: red", "Paint 1: empty", "Paint 1: red, given". */
export function slotName(slot: 0 | 1, paint: PaintId | null, given: boolean): string {
  const head = `Paint ${slot + 1}`;
  if (!paint) return `${head}: empty`;
  return `${head}: ${colorWord(paint)}${given ? ', given' : ''}`;
}

/** The bowl: "Bowl: orange" or "Bowl: empty". */
export const bowlName = (color: ColorId | null): string => (color ? `Bowl: ${colorWord(color)}` : 'Bowl: empty');

/** A Guess swatch is named by its colour: "Sky blue". */
export const swatchName = (color: ResultId): string => colorInfo(color).name;
