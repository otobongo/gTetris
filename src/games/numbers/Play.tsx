/* Number Line-up's play screen (brief 4.3): the goal strip, the help row (prompt style, Hint on the
   right), the tower well with its marks, and the footer slot that holds the legend during play and
   Next puzzle after the solve. The child swaps two towers at a time, by dragging one onto another or
   by tapping two, until the row is in the level's order. */
import { useEffect, useRef, useState } from 'react';
import { sfx } from '../../shared/sound';
import { PlayScreen } from '../kit/PlayScreen';
import { useDragToTarget } from '../kit/useDragToTarget';
import { useLevelRun } from '../kit/useLevelRun';
import { LEGEND, PICKED_LINE, SPEAKER_NAME, START_LINE, hintLine, solvedLine, spokenText } from './copy';
import { NUMBERS } from './game';
import { hintStep, inOrder, rightSpots, swapAt, swapKind, type HintStep } from './order';
import { studCount } from './puzzles';
import { GoalStrip, HintButton, Tower, TowerWell } from './parts';
import './numbers.css';

/** A swap on screen: each moved spot and how many columns away its tower came from. */
interface SwapMotion {
  /** Goes up on every swap, so a new swap restarts the slide. */
  id: number;
  shifts: Readonly<Record<number, number>>;
  /** false for the first frame (the towers drawn where they came from), then true while they slide home. */
  go: boolean;
}

/** The row on screen for one puzzle (one `round`): the towers, the hint showing, the swap moving. */
interface Board {
  round: number;
  row: readonly number[];
  hint: HintStep | null;
  motion: SwapMotion | null;
}

/** How long the slide lasts (--bw-base) plus a frame, before the moved towers settle. */
const SETTLE_MS = 250;

export function Play({ level }: { level: number }) {
  const run = useLevelRun(NUMBERS, level);
  const p = run.puzzle;
  const playing = run.phase === 'play';

  const [stored, setBoard] = useState<Board>(() => ({ round: run.round, row: p.start, hint: null, motion: null }));
  // A new puzzle (Next, a swap, a band change) starts from its own row: no hint, nothing moving.
  const board: Board = stored.round === run.round ? stored : { round: run.round, row: p.start, hint: null, motion: null };
  const live = useRef(board);
  live.current = board;
  const swaps = useRef(0);

  /** Swap the towers in spots a and b (a is the one picked or dragged). */
  const swap = (a: number, b: number, how: 'drag' | 'tap') => {
    const now = live.current;
    if (run.phase !== 'play' || a === b || !Number.isInteger(a) || !Number.isInteger(b)) return;
    const kind = swapKind(now.row, a, b, p.dir);
    const row = swapAt(now.row, a, b);
    // A dropped tower lands where the finger left it; the tower it displaced slides over. A tap swap slides both.
    const shifts: Record<number, number> = how === 'drag' ? { [a]: b - a } : { [a]: b - a, [b]: a - b };
    swaps.current += 1;
    setBoard({ round: now.round, row, hint: null, motion: { id: swaps.current, shifts, go: false } });
    if (inOrder(row, p.dir)) run.solve();
    else if (kind === 'forward') {
      sfx.good();
      run.progress();
    } else run.slip();
  };

  const drag = useDragToTarget<string>({
    itemsAreTargets: true,
    disabled: !playing,
    onDrop: (item, target, how) => swap(Number(item), Number(target), how),
    onPick: (item) => {
      if (item === null) return;
      sfx.tap();
      // A new tap cuts a swap's slide short.
      if (live.current.motion) setBoard({ ...live.current, motion: null });
    },
    onDragStart: () => sfx.tap(),
  });

  // A new puzzle puts any lifted tower down.
  const { pick } = drag;
  useEffect(() => pick(null), [run.round, pick]);

  // The swap's two frames: drawn where the towers came from, then (two frames later) sliding home.
  const motion = board.motion;
  useEffect(() => {
    if (!motion) return;
    if (motion.go) {
      const t = window.setTimeout(() => setBoard((b) => (b.motion?.id === motion.id ? { ...b, motion: null } : b)), SETTLE_MS);
      return () => window.clearTimeout(t);
    }
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() =>
        setBoard((b) => (b.motion?.id === motion.id ? { ...b, motion: { ...motion, go: true } } : b)),
      );
    });
    return () => {
      window.cancelAnimationFrame(first);
      window.cancelAnimationFrame(second);
    };
  }, [motion]);

  const hints = run.hint;
  const hintOff = !playing || !hints || hints.left <= 0;
  const askHint = () => {
    const now = live.current;
    if (hintOff || !hints) return;
    const step = hintStep(now.row, p.dir);
    if (!step) return;
    hints.use();
    sfx.tap();
    // The hint clears a pick and stays until the next swap.
    drag.pick(null);
    setBoard({ ...now, hint: step, motion: null });
  };

  const solved = run.phase !== 'play';
  const hint = playing ? board.hint : null;
  const line = solved
    ? solvedLine(p)
    : hint
      ? hintLine(hint.value, hint.to)
      : drag.picked !== null
        ? PICKED_LINE
        : START_LINE;

  const right = rightSpots(board.row, p.dir);
  const towers = board.row.map((value, spot) => {
    const shift = board.motion && !board.motion.go ? board.motion.shifts[spot] ?? null : null;
    return (
      <Tower
        key={spot}
        value={value}
        color={p.colors[value]}
        studs={studCount(p, value)}
        spot={spot}
        right={right[spot]}
        picked={drag.picked === String(spot)}
        locked={!playing}
        lit={hint !== null && (hint.from === spot || hint.to === spot)}
        arrow={hint !== null && hint.from === spot}
        shift={shift}
        moved={board.motion !== null && board.motion.shifts[spot] !== undefined}
        first={spot === 0}
        drag={drag.item(String(spot))}
      />
    );
  });

  return (
    <PlayScreen
      run={run}
      className="num-screen"
      speaker={{ label: SPEAKER_NAME, text: () => spokenText(p, line, solved) }}
      line={line}
      lineStyle="prompt"
      hint={hints && <HintButton left={hints.left} off={hintOff} onUse={askHint} />}
      top={<GoalStrip puzzle={p} />}
      controls={<p className="num-legend">{LEGEND}</p>}
    >
      <TowerWell towers={towers} marks={right} />
    </PlayScreen>
  );
}
