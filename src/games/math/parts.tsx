/* Brick Calculator's pieces, drawn as the Math board draws them (brief 4.5, 7.7, 9.2): the display
   with the sum, the bricks panel with its two ten-frames and caption, and the 12-key keypad. They hold
   no game state: the Play screen passes in what to draw and what a press does. */
import type { CSSProperties } from 'react';
import { cx } from '../../shared/ui';
import { FIRST_CONTROL } from '../kit/PlayScreen';
import { CAPTION_LINES, KEYPAD_NAME, equationName, equationSolvedName, framesName, keyLabel, keyName, solvedCaption } from './copy';
import { KEY_CELLS, type KeyId } from './entry';
import { FRAME_SIZE, signOf, type FrameCell, type MathPuzzle } from './puzzles';

/** The answer place's "?" before anything is typed. */
const ANSWER_PLACE = '?';

export type AnswerLook = 'empty' | 'typed' | 'solved';

export interface DisplayProps {
  /** The sum to show; null draws the finished state's display, which holds only the "?". */
  puzzle: MathPuzzle | null;
  /** The digits typed so far, as typed; '' shows the "?". */
  entry: string;
  /** The right answer was sent: it shows in yellow and the equation's name gives it. */
  solved: boolean;
}

/** The dark display: "3 + 4 = ?", right-aligned, with the first number in blue and the second in orange. */
export function Display({ puzzle: p, entry, solved }: DisplayProps) {
  const look: AnswerLook = solved ? 'solved' : entry === '' ? 'empty' : 'typed';
  const answer = p && solved ? String(p.answer) : entry === '' ? ANSWER_PLACE : entry;
  return (
    <div className="calc-display">
      <div className="calc-eq" role={p ? 'img' : undefined} aria-label={p ? (solved ? equationSolvedName(p) : equationName(p)) : undefined}>
        {p && (
          <>
            <span className="calc-eq__a" aria-hidden="true">{p.a}</span>
            <span className="calc-eq__sign" aria-hidden="true">{signOf(p.op)}</span>
            <span className="calc-eq__b" aria-hidden="true">{p.b}</span>
            <span className="calc-eq__sign" aria-hidden="true">=</span>
          </>
        )}
        <span className="calc-eq__answer" data-look={look} aria-hidden={p ? true : undefined}>{answer}</span>
      </div>
    </div>
  );
}

/** One ten-frame: 10 cells in rows of 5. Taken-away bricks stay in place, faded. */
function Frame({ cells }: { cells: readonly FrameCell[] }) {
  return (
    <div className="calc-frame" aria-hidden="true">
      {cells.map((cell, i) => (
        <span
          key={i}
          className={cx('calc-cell', cell === 'taken' && 'is-taken', cell === 'empty' && 'is-empty')}
          data-brick={cell === 'orange' ? 'orange' : cell === 'empty' ? undefined : 'blue'}
        />
      ))}
    </div>
  );
}

export interface BricksPanelProps {
  /** The sum, for the frames' name and the count; null draws the finished state's empty frames. */
  puzzle: MathPuzzle | null;
  /** The 20 cells, from `frameCells` (or `EMPTY_FRAMES`). */
  cells: readonly FrameCell[];
  /** Once solved the caption adds "Count them: 7". */
  solved: boolean;
}

/** The bricks panel: the two ten-frames and the caption under them. */
export function BricksPanel({ puzzle: p, cells, solved }: BricksPanelProps) {
  return (
    <div className="calc-panel">
      <div className="calc-frames" role={p ? 'img' : undefined} aria-label={p ? framesName(p) : undefined}>
        <Frame cells={cells.slice(0, FRAME_SIZE)} />
        <Frame cells={cells.slice(FRAME_SIZE, FRAME_SIZE * 2)} />
      </div>
      <div className="calc-caption">
        <span className="calc-caption__lines">
          {CAPTION_LINES.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
        {p && solved && <span className="calc-count">{solvedCaption(p.answer)}</span>}
      </div>
    </div>
  );
}

export interface KeypadProps {
  onPress: (key: KeyId) => void;
}

/** The 12 keys: 7 8 9 C / 4 5 6 = / 1 2 3 = / 0 0 0 =. The 7 key takes focus after Next. */
export function Keypad({ onPress }: KeypadProps) {
  return (
    <div className="calc-keys" role="group" aria-label={KEYPAD_NAME}>
      {KEY_CELLS.map((cell) => {
        const name = keyName(cell.key);
        const label = keyLabel(cell.key);
        const kind = cell.key === 'equals' ? 'equals' : cell.key === 'clear' ? 'clear' : 'digit';
        const place = {
          '--calc-row': cell.row + 1,
          '--calc-col': cell.col + 1,
          '--calc-rows': cell.rowSpan,
          '--calc-cols': cell.colSpan,
        } as CSSProperties;
        const first = cell.key === 7 ? { [FIRST_CONTROL]: '' } : {};
        return (
          <button
            key={`${cell.row}-${cell.col}`}
            type="button"
            className={cx('calc-key', `calc-key--${kind}`)}
            style={place}
            aria-label={name === label ? undefined : name}
            onClick={() => onPress(cell.key)}
            {...first}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
