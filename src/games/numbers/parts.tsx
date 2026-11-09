/* Number Line-up's pieces, drawn as the Numbers board draws them (brief 7.5): the goal strip, the
   tower well with its right-spot marks, one tower, and the yellow Hint button with its badge. */
import type { CSSProperties, ReactNode } from 'react';
import { Brick, Icon, cx } from '../../shared/ui';
import { FIRST_CONTROL } from '../kit/PlayScreen';
import type { DragItemProps } from '../kit/useDragToTarget';
import { goalLine, hintName, towerName } from './copy';
import { TOWERS, type NumbersPuzzle, type TowerColor } from './puzzles';

/** The board's "GOAL" label on the strip. */
const GOAL_LABEL = 'GOAL';

/**
 * The goal strip: the order as six bars of rising or falling height, then the goal text. Stairs bars
 * take each number's colour; bigger numbers show only the stair shape, so the child reads the towers.
 */
export function GoalStrip({ puzzle }: { puzzle: Pick<NumbersPuzzle, 'kind' | 'dir' | 'goal' | 'colors'> }) {
  return (
    <div className="num-goal">
      <span className="num-goal__label">{GOAL_LABEL}</span>
      <span className="num-goal__bars" aria-hidden="true">
        {puzzle.goal.map((value, i) => (
          <span
            key={value}
            className="num-goal__bar"
            data-brick={puzzle.kind === 'stairs' ? puzzle.colors[value] : undefined}
            style={{ '--num-rank': puzzle.dir === 'up' ? i + 1 : TOWERS - i } as CSSProperties}
          />
        ))}
      </span>
      <span className="num-goal__text">{goalLine(puzzle)}</span>
    </div>
  );
}

/**
 * The well: six tower columns, and under them the six marks, filled green where a tower stands in
 * its right spot and ringed where it does not. The marks are hidden from assistive tech: each
 * tower's name says whether it is in the right spot (9.2). `marks` null draws six empty ones (the
 * finished state's empty well).
 */
export function TowerWell({ towers, marks }: { towers: ReactNode; marks: readonly boolean[] | null }) {
  const spots = marks ?? Array.from({ length: TOWERS }, () => false);
  return (
    <div className="num-well">
      <div className="num-well__towers">{towers}</div>
      <div className="num-well__marks" aria-hidden="true">
        {spots.map((right, i) => (
          <span key={i} className={cx('num-mark', right && 'is-right')} />
        ))}
      </div>
    </div>
  );
}

export interface TowerProps {
  value: number;
  color: TowerColor;
  /** Stud bricks above the number face: value - 1 on the stairs, none for bigger numbers. */
  studs: number;
  /** 0-based spot in the row. */
  spot: number;
  /** In its right spot for the level's order. */
  right: boolean;
  /** Lifted by the tap path. */
  picked: boolean;
  /** After the solve, and behind a card: no drags, no taps. */
  locked: boolean;
  /** The hint's ring: on the tower that belongs in the first wrong spot and on the tower standing there. */
  lit: boolean;
  /** The hint's arrow, above the tower that belongs in the first wrong spot. */
  arrow: boolean;
  /**
   * A swap just put this tower here: for one frame it is drawn `shift` columns away (where it came
   * from), then it slides home. Null when it is not jumping.
   */
  shift: number | null;
  /** Part of the swap on screen (under reduced motion it fades in instead of sliding). */
  moved: boolean;
  /** The first tower takes focus after Next (brief 9.1). */
  first: boolean;
  drag: DragItemProps;
}

/** One tower: a button the full column high, the number face at the base and its stud bricks above. */
export function Tower({ value, color, studs, spot, right, picked, locked, lit, arrow, shift, moved, first, drag }: TowerProps) {
  const marker = first ? { [FIRST_CONTROL]: '' } : {};
  return (
    <button
      type="button"
      className={cx('num-tower', 'bw-drag', picked && 'is-picked', shift !== null && 'is-jump', moved && 'is-moved')}
      style={shift !== null ? ({ '--num-shift': shift } as CSSProperties) : undefined}
      aria-label={towerName(value, spot, right)}
      aria-pressed={picked}
      aria-disabled={locked || undefined}
      data-digits={String(value).length}
      {...marker}
      {...drag}
    >
      <span className={cx('num-stack', lit && 'is-lit')}>
        <Brick color={color} width={48} height={40} radius={12} className="num-face">
          {value}
        </Brick>
        {Array.from({ length: studs }, (_, k) => (
          <Brick key={k} color={color} stud={20} width={40} height={22} radius={6} className="num-stud" />
        ))}
      </span>
      {arrow && (
        <svg className="num-arrow" width="34" height="34" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 21l-6-8h4V3h4v10h4z" />
        </svg>
      )}
    </button>
  );
}

/**
 * Letter Builder's yellow Hint button and its badge (brief 7.2), named "Hint, 2 left". It stays
 * focusable when it cannot give a hint (none left, after the solve, behind a card), so its name
 * still says how many are left.
 */
export function HintButton({ left, off, onUse }: { left: number; off: boolean; onUse: () => void }) {
  return (
    <button
      type="button"
      className="bw-iconbtn num-hint"
      data-tone="yellow"
      aria-label={hintName(left)}
      title={hintName(left)}
      aria-disabled={off || undefined}
      onClick={() => {
        if (!off) onUse();
      }}
    >
      <Icon name="hint" size={26} strokeWidth={2.8} />
      <span className="bw-iconbtn__badge" aria-hidden="true">
        {left}
      </span>
    </button>
  );
}
