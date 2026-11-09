import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../shared/ui';
import './kit.css';

/** How long a wrong choice stays dimmed and tilted before it comes back (brief 7.2). */
export const CHOICE_WRONG_MS = 500;

/** What a choice shows: at rest, a wrong pick on its way back, or the right pick (ring and lift). */
export type ChoiceState = 'idle' | 'wrong' | 'right';

export interface ChoiceRowProps<T> {
  /** The 2 to 4 answers, in the order they are drawn. */
  items: readonly T[];
  /** Each button's accessible name: the colour or the car it shows ("Orange", "Yellow triangle"). */
  name: (item: T, index: number) => string;
  /** True for the right answer. */
  isRight: (item: T, index: number) => boolean;
  /**
   * A tap the row took: `right` says which. The game answers with run.solve() or run.slip(key); the
   * row plays no sound (the kit's hook plays the slip and the solve).
   */
  onPick: (item: T, index: number, right: boolean) => void;
  /** After the solve (run.phase is not 'play'): every choice is aria-disabled and takes no taps. */
  locked: boolean;
  /** The game's tile inside each button. */
  children: (item: T, index: number, state: ChoiceState) => ReactNode;
  /** The row's name ("Which car comes next?"). With it the row is a `role="group"`. */
  label?: string;
  /** React key per item; the index by default. */
  itemKey?: (item: T, index: number) => string | number;
  className?: string;
  /** Classes on each button, for a game whose tile is the button itself (Pattern Train's raised cars). */
  choiceClassName?: string;
}

/**
 * A row of answer buttons (brief 3.1, 7.2), used by Color Mixer's Guess form and Pattern Train. Wrong:
 * the choice dims and tilts for CHOICE_WRONG_MS, then comes back. Right: the accent ring and a lift,
 * and the row takes no more taps. Locked: aria-disabled, nothing lifts.
 *
 * The row keeps its wrong and right marks itself, so give it a new key for each puzzle (run.round);
 * PlayScreen does that for everything in its top, body and controls.
 */
export function ChoiceRow<T>({ items, name, isRight, onPick, locked, children, label, itemKey, className, choiceClassName }: ChoiceRowProps<T>) {
  const [wrong, setWrong] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);
  /** Read in the click handler, so a second tap in the same frame sees the first one. */
  const done = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pick = (item: T, i: number) => {
    if (locked || done.current) return;
    const ok = isRight(item, i);
    if (ok) {
      done.current = true;
      window.clearTimeout(timer.current);
      setWrong(null);
      setRight(i);
    } else {
      setWrong(i);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setWrong(null), CHOICE_WRONG_MS);
    }
    onPick(item, i, ok);
  };

  const off = locked || right !== null;
  return (
    <div className={cx('bw-choices', className)} role={label ? 'group' : undefined} aria-label={label}>
      {items.map((item, i) => {
        const state: ChoiceState = right === i ? 'right' : wrong === i ? 'wrong' : 'idle';
        return (
          <button
            key={itemKey ? itemKey(item, i) : i}
            type="button"
            className={cx('bw-choice', state === 'wrong' && 'is-wrong', state === 'right' && 'is-right', choiceClassName)}
            aria-label={name(item, i)}
            aria-disabled={off || undefined}
            onClick={() => pick(item, i)}
          >
            {children(item, i, state)}
          </button>
        );
      })}
    </div>
  );
}
