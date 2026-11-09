/* Picture Builder's child-facing lines, exactly as brief 8.7 words them, plus the accessible names from 9.2.
   The shared lines (dots, Next, the offer, the level card) live in the kit's copy.ts. Help lines are help style:
   54 characters at most (7.2). Colour and picture names inside a sentence are lower case. No apostrophes here,
   so no curly one is needed. */
import { rowColOf, type Paint } from './board';
import { rowsOf, cellsOf, type BuilderColor, type Picture } from './pictures';
import { BUILDER_TITLE, type BuilderPuzzle } from './puzzles';

export const TITLE = BUILDER_TITLE;

/** Help-style lines stay within 54 characters (7.2). */
export const HELP_MAX_CHARS = 54;

/** The speaker's name; it reads the title line, then the help line. */
export const SPEAKER_NAME = 'Hear the help line';

/** The Peek cover's label and its accessible name. */
export const PEEK_LABEL = 'Peek';
export const PEEK_NAME = 'Peek at the picture';
/** Announced once when a Peek shows the picture. */
export const PEEK_SHOWN = 'Picture shown.';

/**
 * What a memory puzzle's model panel is doing: 'look' while the picture shows (the first look and each Peek),
 * 'hidden' once it is behind Peek. Copy levels always show the picture and ignore this.
 */
export type MemoryView = 'look' | 'hidden';

type Shown = Pick<BuilderPuzzle, 'mode' | 'picture'>;

/** The title line: "Build the house." in copy levels; "Look closely." or "Build it from memory." in memory levels. */
export function titleLine(p: Shown, view: MemoryView = 'hidden'): string {
  if (p.mode === 'copy') return `Build the ${p.picture.name}.`;
  return view === 'look' ? 'Look closely.' : 'Build it from memory.';
}

/** The help line before anything is wrong. */
export function helpStart(p: Shown, view: MemoryView = 'hidden'): string {
  if (p.mode === 'copy') return 'Pick a color, then tap or drag over the squares.';
  return view === 'look' ? 'Remember the colors and where they go.' : 'Tap Peek if you need another look.';
}

/** Copy levels only: "One brick is not quite right." or "3 bricks are not quite right." */
export const helpWrong = (wrong: number): string =>
  wrong === 1 ? 'One brick is not quite right.' : `${wrong} bricks are not quite right.`;

/** The help line once solved: "You built the house." or, in memory levels, "You built the house from memory." */
export function helpSolved(p: Shown): string {
  return p.mode === 'copy' ? `You built the ${p.picture.name}.` : `You built the ${p.picture.name} from memory.`;
}

/**
 * The help line for a moment of play. Solved wins; copy levels then name the wrong bricks; memory levels never
 * do, so a child cannot find the picture by trial (4.6).
 */
export function helpLine(p: Shown, state: { view?: MemoryView; wrong: number; solved: boolean }): string {
  if (state.solved) return helpSolved(p);
  if (p.mode === 'copy' && state.wrong > 0) return helpWrong(state.wrong);
  return helpStart(p, state.view);
}

/** The match text and the match bar's name (copy levels): "5 of 10 bricks right". */
export const matchText = (right: number, total: number): string => `${right} of ${total} bricks right`;

/** What the speaker reads: the title line, then the help line. */
export const speechOf = (title: string, help: string): string => `${title} ${help}`;

/* ---------- accessible names (brief 9.2) ---------- */

/** A palette button: "Red", or "Eraser". */
export const paletteName = (paint: Paint): string => (paint === 'eraser' ? 'Eraser' : paint[0].toUpperCase() + paint.slice(1));

/** A board square, rows and columns counted from 1: "Row 2, column 3, red" or "Row 2, column 3, empty". */
export function squareName(size: number, index: number, cell: BuilderColor | null): string {
  const { row, col } = rowColOf(size, index);
  return `Row ${row + 1}, column ${col + 1}, ${cell ?? 'empty'}`;
}

/** "a house", "an apple". */
export const withArticle = (name: string): string => `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`;

/** The model panel's name while the picture shows: "Picture of a house. Row 1: empty, red, red, empty. Row 2: ..." */
export function modelName(picture: Picture): string {
  const size = rowsOf(picture.art).length;
  const cells = cellsOf(picture.art);
  const rows = Array.from({ length: size }, (_, r) => {
    const words = cells.slice(r * size, r * size + size).map((c) => c ?? 'empty');
    return `Row ${r + 1}: ${words.join(', ')}.`;
  });
  return [`Picture of ${withArticle(picture.name)}.`, ...rows].join(' ');
}

/** The model panel's name while the picture hides behind Peek. */
export const MODEL_HIDDEN = 'Picture hidden. Tap Peek to look again.';

/** Every help-row line a puzzle can show, for the automatic length check: start, look, hidden, wrong (copy) and solved. */
export function helpLines(p: BuilderPuzzle): string[] {
  const lines = [helpSolved(p)];
  if (p.mode === 'copy') {
    lines.push(helpStart(p));
    for (let n = 1; n <= p.target.length; n++) lines.push(helpWrong(n));
  } else lines.push(helpStart(p, 'look'), helpStart(p, 'hidden'));
  return lines;
}
