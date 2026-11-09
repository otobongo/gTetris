/* Picture Builder's Play screen (six-games brief 4.6, 7.8, 8.7, 9.2), built from design/canvas/Builder.dc.html and
   its state boards: the kit's PlayScreen around the model row (model panel, title line, match bar), the 334 px
   board and the palette. The rules live in board.ts, puzzles.ts and copy.ts; this file keeps the board for the
   puzzle on screen in local state, turns pointer strokes and key presses into paints, runs the memory levels'
   looks, and passes what comes back to the kit: progress() on a new right brick, slip(key) when a stroke ends
   with a slip, solve() on the last right brick, hold(on) while the picture shows on a memory level.
   Sounds follow brief 3.1: tap on a palette pick, good on a right brick; the kit plays the slip and the solve.
   Nothing speaks unless the speaker is tapped. */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type Ref } from 'react';
import { sfx } from '../../shared/sound';
import { Icon, cx, useLayout } from '../../shared/ui';
import { capturePointer, localPoint, type Point } from '../kit/dragToTarget';
import { FIRST_CONTROL, PlayScreen } from '../kit/PlayScreen';
import { useLevelRun } from '../kit/useLevelRun';
import {
  cancelStroke,
  endStroke,
  matchCount,
  moveFocus,
  newBoard,
  paintOnce,
  paintSquare,
  setLocked,
  squareAt,
  squaresAlong,
  startStroke,
  wrongCount,
  type Board,
  type Cell,
  type Paint,
  type PaintResult,
} from './board';
import {
  BOARD_NAME,
  MODEL_HIDDEN,
  PALETTE_NAME,
  PEEK_LABEL,
  PEEK_NAME,
  PEEK_SHOWN,
  SPEAKER_NAME,
  helpLine,
  matchText,
  modelName,
  paletteName,
  speechOf,
  squareName,
  titleLine,
  viewOf,
} from './copy';
import { GAME } from './game';
import { BUILDER_COLORS } from './pictures';
import { canPeek, firstLook, lookMs, pictureShows, type BuilderPuzzle, type LookKind } from './puzzles';
import './builder.css';

/** The palette in the board's order: red, yellow, green, blue / orange, white, eraser (7.8). */
const PALETTE: readonly Paint[] = [...BUILDER_COLORS, 'eraser'];
/** The colour picked when the level opens, as on the board. */
const FIRST_PAINT: Paint = 'red';
/** Keys that move the board's one tab stop (9.2). */
const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);
type MoveKey = Parameters<typeof moveFocus>[2];

const pageVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden';
const sizeVar = (size: number) => ({ '--pb-n': size }) as CSSProperties;

/* ---------- What the screen remembers about the puzzle on screen ---------- */

interface Ui {
  /** The kit's round this belongs to: a new puzzle (Next, a swap) starts from a fresh one. */
  round: number;
  board: Board;
  /** The look under way on a memory level: the first look, a Peek, or none (the picture is hidden). */
  look: LookKind | null;
  /** Goes up with every look, so each one gets its own timer. */
  lookSeq: number;
  /** The square that holds the board's one tab stop. */
  focus: number;
  /** The visually hidden status line: "Picture shown." while a Peek runs, so it is announced once per Peek. */
  shown: string;
}

function fresh(round: number, p: BuilderPuzzle): Ui {
  const look = firstLook(p.mode);
  return { round, board: newBoard(p.target, look !== null), look, lookSeq: 0, focus: 0, shown: '' };
}

/** A pointer stroke under way: its pointer, the puzzle it began on, and where it was last seen in the grid. */
interface StrokeTrack {
  id: number;
  round: number;
  last: Point | null;
}

/* ---------- The play screen ---------- */

export function Play({ level }: { level: number }) {
  const run = useLevelRun(GAME, level);
  const layout = useLayout();
  const p = run.puzzle;
  const playing = run.phase === 'play';

  const [paint, setPaint] = useState<Paint>(FIRST_PAINT);
  const [held, setHeld] = useState<Ui>(() => fresh(run.round, p));
  const [visible, setVisible] = useState(pageVisible);
  const ui = held.round === run.round ? held : fresh(run.round, p);

  /** The latest of everything handlers read, so two events in one frame (or a timer) see each other's effect. */
  const latest = useRef(held);
  const live = useRef({ run, paint, zoom: layout.zoom });
  live.current = { run, paint, zoom: layout.zoom };
  const stroke = useRef<StrokeTrack | null>(null);
  /** Set on a pointer down on the board: the click the browser sends after it must not paint again. */
  const swallowClick = useRef(false);
  /** The round a Peek was opened on, so focus can go back to Peek when it ends and focus was lost. */
  const peekFocus = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLButtonElement>(null);

  const current = (): Ui => {
    const r = live.current.run;
    return latest.current.round === r.round ? latest.current : fresh(r.round, r.puzzle);
  };
  const commit = (next: Ui) => {
    latest.current = next;
    setHeld(next);
  };
  const canPaint = (b: Board) => live.current.run.phase === 'play' && !b.locked && !b.solved;

  /** What a paint means to the kit: the last right brick solves at once; a new right brick is progress. */
  const report = (results: readonly PaintResult[]) => {
    const r = live.current.run;
    if (results.includes('solved')) r.solve();
    else if (results.includes('right')) {
      r.progress();
      sfx.good();
    }
  };

  /* ----- Pointer strokes: pointer down to pointer up paints every square passed over, with at most one slip ----- */

  /** The pointer in the grid's own px, with the tablet zoom taken out, and the grid's width in the same px. */
  const inGrid = (e: PointerEvent): { point: Point; width: number } | null => {
    const el = gridRef.current;
    if (!el) return null;
    const zoom = live.current.zoom;
    const r = el.getBoundingClientRect();
    const width = localPoint({ x: r.right, y: r.top }, el, zoom).x;
    return { point: localPoint({ x: e.clientX, y: e.clientY }, el, zoom), width };
  };

  const paintAll = (squares: readonly number[]) => {
    let cur = current();
    const results: PaintResult[] = [];
    for (const i of squares) {
      const step = paintSquare(cur.board, i);
      if (step.result === 'none') continue;
      cur = { ...cur, board: step.board };
      results.push(step.result);
      if (step.result === 'solved') break;
    }
    if (!results.length) return;
    commit(cur);
    report(results);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    swallowClick.current = true;
    // A second finger while one stroke is under way is ignored.
    if (stroke.current) return;
    const cur = current();
    if (!canPaint(cur.board)) return;
    const at = inGrid(e);
    if (!at) return;
    capturePointer(e.currentTarget, e.pointerId);
    stroke.current = { id: e.pointerId, round: cur.round, last: at.point };
    const first = squareAt(at.point, p.size, at.width);
    commit({ ...cur, board: startStroke(cur.board, live.current.paint), focus: first ?? cur.focus });
    if (first !== null) paintAll([first]);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s || s.id !== e.pointerId || s.round !== live.current.run.round) return;
    const at = inGrid(e);
    if (!at) return;
    const path = s.last ? squaresAlong(s.last, at.point, p.size, at.width) : [];
    s.last = at.point;
    if (path.length) paintAll(path);
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s || s.id !== e.pointerId) return;
    stroke.current = null;
    if (s.round !== live.current.run.round) return;
    const cur = current();
    const end = endStroke(cur.board);
    if (end.board !== cur.board) commit({ ...cur, board: end.board });
    if (end.slip) live.current.run.slip(end.slip);
  };

  /**
   * The mousedown a press sends after its pointer down (straight after it for a mouse, after the lift for a finger)
   * would focus the pressed square. Once that press solved the puzzle, the kit has already put focus on Next puzzle
   * (brief 9.1), so the browser's default is stopped and focus stays there. Before the solve, a press still focuses
   * its square as usual, so the board's one tab stop and DOM focus stay together for Tab, arrows, Enter and Space.
   */
  const onMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    if (current().board.solved || live.current.run.phase !== 'play') e.preventDefault();
  };

  /** pointercancel, or the capture lost before pointer up: the stroke ends and never counts. */
  const onPointerLost = (e: PointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s || s.id !== e.pointerId) return;
    stroke.current = null;
    if (s.round !== live.current.run.round) return;
    const cur = current();
    const board = cancelStroke(cur.board);
    if (board !== cur.board) commit({ ...cur, board });
  };

  /* ----- Keys: one tab stop, arrows move it, Enter or Space paints the focused square (9.2) ----- */

  const onSquareClick = (i: number, e: MouseEvent<HTMLButtonElement>) => {
    // A pointer tap already painted on pointer down; its click is swallowed. Enter and Space (detail 0) always paint.
    const keyboard = e.detail === 0;
    const swallow = swallowClick.current;
    swallowClick.current = false;
    if (!keyboard && swallow) return;
    const cur = current();
    if (!canPaint(cur.board)) return;
    const step = paintOnce(cur.board, live.current.paint, i);
    if (step.result === 'none' && step.slip === null) {
      if (cur.focus !== i) commit({ ...cur, focus: i });
      return;
    }
    commit({ ...cur, board: step.board, focus: i });
    report([step.result]);
    if (step.slip) live.current.run.slip(step.slip);
  };

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!MOVE_KEYS.has(e.key)) return;
    const from = Number((e.target as Element).getAttribute?.('data-cell') ?? Number.NaN);
    if (!Number.isInteger(from)) return;
    e.preventDefault();
    const to = moveFocus(p.size, from, e.key as MoveKey);
    const cur = current();
    if (to !== cur.focus) commit({ ...cur, focus: to });
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${to}"]`)?.focus();
  };

  /* ----- Palette ----- */

  const onPick = (c: Paint) => {
    live.current.paint = c;
    setPaint(c);
    sfx.tap();
  };

  /* ----- Memory levels: the first look and each Peek lock the board and hold the time signal ----- */

  const onPeek = () => {
    const cur = current();
    if (!canPeek(p.mode, cur.look, live.current.run.phase === 'play') || cur.board.solved) return;
    peekFocus.current = cur.round;
    // Peek is free and never stored: it only shows the picture again for a moment.
    commit({ ...cur, look: 'peek', lookSeq: cur.lookSeq + 1, board: setLocked(cur.board, true), shown: PEEK_SHOWN });
  };

  const endLook = (round: number, seq: number) => {
    const cur = current();
    if (cur.round !== round || cur.lookSeq !== seq || cur.look === null) return;
    commit({ ...cur, look: null, board: setLocked(cur.board, false), shown: '' });
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => setVisible(pageVisible());
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  // A look's timer runs only while the page shows. Hiding the page clears it, so a look the page was hidden for
  // starts again in full when the page shows. Leaving the level (unmount) clears it too.
  useEffect(() => {
    if (ui.look === null || !visible) return;
    const { round, lookSeq } = ui;
    const id = window.setTimeout(() => endLook(round, lookSeq), lookMs(run.band, ui.look));
    return () => window.clearTimeout(id);
  }, [ui.round, ui.lookSeq, ui.look, visible, run.band]);

  // No time counts toward the stuck offer while the picture shows (the kit's hold).
  const holding = playing && ui.look !== null;
  const hold = run.hold;
  useEffect(() => {
    hold(holding);
  }, [holding, hold]);

  // When a Peek ends, Peek comes back: focus goes to it if it was lost with the cover.
  useEffect(() => {
    if (ui.look !== null || peekFocus.current === null) return;
    const mine = peekFocus.current === ui.round;
    peekFocus.current = null;
    const active = typeof document === 'undefined' ? null : document.activeElement;
    if (mine && (!active || active === document.body)) peekRef.current?.focus();
  }, [ui.look, ui.round]);

  /* ----- Drawing ----- */

  const view = viewOf(ui.look);
  const title = titleLine(p, view);
  const help = helpLine(p, { view, wrong: wrongCount(ui.board), solved: !playing });
  const match = matchCount(ui.board);
  const looking = playing && ui.look !== null;
  const locked = !playing || ui.board.locked || ui.board.solved;

  const top = (
    <div className="pb-model-row">
      <Model
        puzzle={p}
        shows={pictureShows(p.mode, ui.look, playing)}
        peek={canPeek(p.mode, ui.look, playing) ? onPeek : null}
        peekRef={peekRef}
      />
      <div className="pb-goal">
        <h2 className="pb-title">{title}</h2>
        {p.mode === 'copy' && <MatchBar right={match.right} total={match.total} />}
      </div>
      <span className="pb-sr" role="status">
        {ui.shown}
      </span>
    </div>
  );

  const board = (
    <div className="pb-stage">
      <div
        className={cx('pb-board', looking && 'is-looking')}
        onPointerDown={onPointerDown}
        onMouseDown={onMouseDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerLost}
        onLostPointerCapture={onPointerLost}
      >
        <div ref={gridRef} className="pb-grid" style={sizeVar(p.size)} role="group" aria-label={BOARD_NAME} onKeyDown={onGridKey}>
          {ui.board.cells.map((c, i) => (
            <button
              key={i}
              type="button"
              className="pb-square"
              data-cell={i}
              data-brick={c ?? undefined}
              tabIndex={i === ui.focus ? 0 : -1}
              {...(i === ui.focus ? { [FIRST_CONTROL]: '' } : {})}
              aria-label={squareName(p.size, i, c)}
              aria-disabled={locked || undefined}
              onClick={(e) => onSquareClick(i, e)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const palette = (
    <div className="pb-palette" role="group" aria-label={PALETTE_NAME}>
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          className={cx('pb-swatch', c === 'eraser' && 'pb-swatch--eraser')}
          data-brick={c === 'eraser' ? undefined : c}
          aria-label={paletteName(c)}
          aria-pressed={paint === c}
          onClick={() => onPick(c)}
        >
          {c === 'eraser' && <Icon name="eraser" size={22} />}
        </button>
      ))}
    </div>
  );

  return (
    <PlayScreen
      run={run}
      className="pb-screen"
      speaker={{ label: SPEAKER_NAME, text: () => speechOf(title, help) }}
      line={help}
      lineStyle="help"
      top={top}
      controls={palette}
      slotClassName="pb-controls"
    >
      {board}
    </PlayScreen>
  );
}

/* ---------- The model panel: the picture to copy, or Peek over it ---------- */

interface ModelProps {
  puzzle: Pick<BuilderPuzzle, 'size' | 'target' | 'picture'>;
  /** The picture shows; otherwise the cells are drawn empty, so nothing of it is in the page. */
  shows: boolean;
  /** Peek's action while it covers the panel, or null. */
  peek?: (() => void) | null;
  peekRef?: Ref<HTMLButtonElement>;
}

function Model({ puzzle, shows, peek = null, peekRef }: ModelProps) {
  return (
    <div className="pb-model" style={sizeVar(puzzle.size)}>
      <div className="pb-model__grid" role="img" aria-label={shows ? modelName(puzzle.picture) : MODEL_HIDDEN}>
        {puzzle.target.map((c, i) => (
          <span key={i} className="pb-model__cell" data-brick={shows && c ? c : undefined} aria-hidden="true" />
        ))}
      </div>
      {peek && (
        <button ref={peekRef} type="button" className="pb-peek bw-appear" aria-label={PEEK_NAME} onClick={peek}>
          <Icon name="eye" size={26} strokeWidth={2.4} />
          {PEEK_LABEL}
        </button>
      )}
    </div>
  );
}

/** The match bar (copy levels): the picture's bricks in place, out of all its bricks. */
function MatchBar({ right, total }: { right: number; total: number }) {
  const text = matchText(right, total);
  const pct = total ? Math.round((right / total) * 100) : 0;
  return (
    <>
      <div className="pb-match" role="progressbar" aria-label={text} aria-valuemin={0} aria-valuemax={total} aria-valuenow={right}>
        <div className="pb-match__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="pb-match__text" aria-hidden="true">
        {text}
      </span>
    </>
  );
}

/* ---------- The finished state's empty play area ---------- */

/** A 4x4 board's worth of empty squares, as the Builder board draws its gameDone state. */
const EMPTY_SIZE = 4;
const EMPTY: readonly Cell[] = Array.from({ length: EMPTY_SIZE * EMPTY_SIZE }, () => null);

/**
 * The empty play area behind the finished card: the model panel and the board with nothing in them (the board's
 * gameDone state). The kit hides it from assistive tech and makes it inert.
 */
export function BuilderEmpty() {
  return (
    <>
      <div className="pb-model-row">
        <div className="pb-model" style={sizeVar(EMPTY_SIZE)}>
          <div className="pb-model__grid">
            {EMPTY.map((_, i) => (
              <span key={i} className="pb-model__cell" />
            ))}
          </div>
        </div>
      </div>
      <div className="pb-stage">
        <div className="pb-board">
          <div className="pb-grid" style={sizeVar(EMPTY_SIZE)}>
            {EMPTY.map((_, i) => (
              <span key={i} className="pb-square" />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
