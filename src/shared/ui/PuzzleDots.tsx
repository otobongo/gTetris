import { SOLVES_PER_LEVEL } from '../progress';
import { cx } from './cx';

export interface PuzzleDotsProps {
  /** Puzzles solved in this level, 0 to 4. */
  solved: number;
  /**
   * The dot on screen, 1 to 4. Defaults to the next unsolved one (solved + 1, at most 4). Right after
   * a solve, before Next, pass the puzzle just solved: its dot shows filled and stays wide.
   */
  puzzle?: number;
  /** Spelling levels count words built instead of puzzles solved. */
  noun?: 'puzzle' | 'word';
  className?: string;
}

/** The dots' accessible name (brief 9.1): "Puzzle 3 of 4. 2 solved.", "Word 3 of 4. 2 built.", "4 of 4 solved." */
export function dotsLabel(solved: number, puzzle: number, noun: 'puzzle' | 'word' = 'puzzle'): string {
  const done = noun === 'word' ? 'built' : 'solved';
  const n = SOLVES_PER_LEVEL;
  if (solved >= n) return `${n} of ${n} ${done}.`;
  return `${noun === 'word' ? 'Word' : 'Puzzle'} ${puzzle} of ${n}. ${solved} ${done}.`;
}

const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : lo);

/**
 * Four progress dots under a game's title (brief 7.1, 8, 10): solved dots fill yellow, the dot on
 * screen is light blue and wider, the rest are wells with a ring. Spares never show, and a swap
 * leaves the dots as they are. One image with a text name; not a live region (the help line speaks).
 */
export function PuzzleDots({ solved, puzzle, noun = 'puzzle', className }: PuzzleDotsProps) {
  const n = SOLVES_PER_LEVEL;
  const done = clamp(solved, 0, n);
  const at = clamp(puzzle ?? done + 1, 1, n);
  return (
    <div className={cx('bw-dots', className)} role="img" aria-label={dotsLabel(done, at, noun)}>
      {Array.from({ length: n }, (_, k) => {
        const i = k + 1;
        const filled = i <= done;
        const current = i === at;
        return (
          <span key={i} className={cx('bw-dot', current && 'is-current', filled && 'is-solved')}>
            <span className="bw-dot__fill" />
          </span>
        );
      })}
    </div>
  );
}
