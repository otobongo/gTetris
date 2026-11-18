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
  /**
   * A counted hint caps this level (decision 25): a small outline star with a 2 sits beside the dots, named
   * "Hint used. Up to 2 stars." It is a sibling of the dots, so their own name stays as it is.
   */
  capped?: boolean;
  className?: string;
}

/** The capped-star mark's text equivalent. */
export const CAP_LABEL = 'Hint used. Up to 2 stars.';

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
export function PuzzleDots({ solved, puzzle, noun = 'puzzle', capped, className }: PuzzleDotsProps) {
  const n = SOLVES_PER_LEVEL;
  const done = clamp(solved, 0, n);
  const at = clamp(puzzle ?? done + 1, 1, n);
  const row = (
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
  if (!capped) return row;
  // The row centres the dots alone: the mark's margins cancel its own width and height (ui.css).
  return (
    <div className="bw-dots-row">
      {row}
      <span className="bw-dots__cap" role="img" aria-label={CAP_LABEL}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d={CAP_STAR} />
        </svg>
        <span className="bw-dots__cap-n" aria-hidden="true">
          2
        </span>
      </span>
    </div>
  );
}

/** The level card's star (Icon "star", 24 viewBox) scaled into the 20px box with room for its 2px stroke. */
const CAP_STAR = 'M10 1.47L12.75 7.16L19 8.01L14.45 12.37L15.59 18.53L10 15.59L4.41 18.53L5.55 12.37L1 8.01L7.25 7.16Z';
