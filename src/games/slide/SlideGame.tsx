import { type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { go, toHref } from '../../shared/router';
import { sfx } from '../../shared/sound';
import { activePlayer, freshRun, progressStore, runOf, starsFor, totalStars, useActivePlayer } from '../../shared/progress';
import type { AgeBand, LevelRun, PuzzleResult, TimerMode } from '../../shared/progress';
import { IconButton, LEVEL_CARD_DELAY_MS, LevelCard, PressButton, PuzzleDots, SandTimer, Screen, Brick } from '../../shared/ui';
import { breakBefore } from '../../screens/logic/session';
import {
  SOLVES_PER_LEVEL,
  STUCK,
  STUCK_START,
  type StuckEvent,
  type StuckState,
  dotPosition,
  escapeLevelStars,
  puzzleOnScreen,
  rotateQueue,
  stuckStep,
} from '../run';
import {
  type BlockDef,
  type Cell,
  DIRS,
  type GateDef,
  type Level,
  type Side,
  type State,
  blockSize,
  gateDepth,
  initialState,
  isLocked,
  isSolved,
  locksLeft,
  withMove,
} from './engine';
import { EXIT_PAST, dragStep, keyStep } from './drag';
import {
  FINISHED_NOTE,
  GAME,
  HELP_LINE,
  HINT_LINE,
  OFFER_LINE,
  PUZZLE_LEVELS,
  SWAPPED_LINE,
  TIME_UP_LINE,
  clockCaption,
  escapeRules,
  finishedCard,
  levelCard,
  solvedLine,
} from './puzzles';
import { solve } from './solver';

/* ---------- clock (Grownups board: base seconds x the age factor) ---------- */

/** Age factor from the Grownups board: ages 3 to 4 get no countdown, then x2, x1.5 and x1. */
export function ageFactor(band: AgeBand): number {
  return band === '3-4' ? 0 : band === '5-6' ? 2 : band === '7-8' ? 1.5 : 1;
}

export interface Clock {
  /** counted: running out costs the speed star. relaxed: a sand timer for fun. off: no timer. */
  kind: 'counted' | 'relaxed' | 'off';
  seconds: number;
  factor: number;
}

export function clockFor(base: number, band: AgeBand, mode: TimerMode): Clock {
  const factor = ageFactor(band);
  if (mode === 'off') return { kind: 'off', seconds: 0, factor };
  // the relaxed sand timer has no age factor for ages 3 to 4, so it runs at the slowest factor there is (x2)
  if (mode === 'relaxed' || factor === 0) return { kind: 'relaxed', seconds: Math.round(base * (factor || 2)), factor };
  return { kind: 'counted', seconds: Math.round(base * factor), factor };
}

export const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/* ---------- board size ---------- */

const PAD = 22; // frame around the tray, also the door thickness + 4 (Escape board)

/**
 * Size of one square. The board draws a 304px grid (Escape board) and shrinks to fit the space the stage
 * gets between the status panel and the tools. The stage is measured in the frame's own px, so the tablet
 * zoom is already taken out.
 */
function useCell(level: Level) {
  const stage = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setRoom({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const n = Math.max(level.rows, level.cols);
  // 8px for the frame's bottom edge
  const grid = room ? Math.min(304, room.w - PAD * 2, room.h - PAD * 2 - 8) : 304;
  return { stage, cell: Math.max(24, Math.floor(grid / n)) };
}

/* ---------- copy ---------- */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function lockLine(level: Level, state: State): string {
  for (const g of level.gates) {
    if (!isLocked(g, state, level)) continue;
    if (g.lockColor && locksLeft(g, state) === 0) return `An icy door melts when every ${g.lockColor} brick is out.`;
    const n = locksLeft(g, state);
    return `An icy door melts after ${n} more ${n === 1 ? 'brick leaves' : 'bricks leave'}.`;
  }
  return '';
}

function doorLabel(level: Level, g: GateDef, state: State): string {
  if (!isLocked(g, state, level)) return `${cap(g.color)} door`;
  if (g.lockColor && locksLeft(g, state) === 0) return `Frozen door, melts when every ${g.lockColor} brick is out`;
  const n = locksLeft(g, state);
  return `Frozen door, melts after ${n} more ${n === 1 ? 'brick leaves' : 'bricks leave'}`;
}

/* ---------- the play screen ---------- */

interface Drag {
  block: number;
  pointerId: number;
  x0: number;
  y0: number;
  start: Cell;
  before: Snapshot;
  moved: boolean;
  /** the brick was pulled into its door at some point in this drag */
  pulled: boolean;
}

/** A brick being dragged out through its door: how far it shows past the edge, in squares. */
interface Pull {
  block: number;
  side: Side;
  depth: number;
}

interface Snapshot {
  state: State;
  moves: number;
}

/** play: a puzzle is on the board. solved: Next puzzle waits. done: the fourth solve, the level card. */
type Phase = 'play' | 'solved' | 'done';

interface Finish {
  stars: number;
  results: PuzzleResult[];
  next: number | null;
  total: number;
}

const HOME = '/';

/** The run to continue from, read from the store without writing (the mount effect saves it). */
function runToStart(index: number): LevelRun {
  const player = activePlayer(progressStore.getState());
  const rules = escapeRules(index);
  const stored = runOf(player, GAME, index);
  return stored && stored.set === rules.set ? stored : freshRun(rules, progressStore.now());
}

const focusLater = (selector: string) =>
  window.setTimeout(() => document.querySelector<HTMLElement>(selector)?.focus(), 0);

export default function SlideGame({ index }: { index: number }) {
  const boards = PUZZLE_LEVELS[index].puzzles;
  const player = useActivePlayer();
  const band: AgeBand = player?.ageBand ?? '5-6';
  const limit = STUCK.escape[band];

  const [run, setRun] = useState<LevelRun>(() => runToStart(index));
  const [puzzle, setPuzzle] = useState(() => puzzleOnScreen(run));
  const [phase, setPhase] = useState<Phase>('play');
  const [finish, setFinish] = useState<Finish | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [stuck, setStuck] = useState<StuckState>(STUCK_START);
  const [note, setNote] = useState('');

  const level = boards[puzzle] ?? boards[0];
  const { stage, cell } = useCell(level);
  const clock = clockFor(level.base ?? 45, band, player?.timerMode ?? 'auto');

  const [state, setState] = useState<State>(() => initialState(level));
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [moves, setMoves] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [hintBlock, setHintBlock] = useState<number | null>(null);
  const [exiting, setExiting] = useState<{ block: number; side: Side } | null>(null);
  const [bumped, setBumped] = useState<number | null>(null);
  const [pull, setPull] = useState<Pull | null>(null);
  const [tLeft, setTLeft] = useState(clock.seconds);

  const drag = useRef<Drag | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const movesRef = useRef(moves);
  movesRef.current = moves;
  const tLeftRef = useRef(tLeft);
  tLeftRef.current = tLeft;
  const hintRef = useRef(usedHint);
  hintRef.current = usedHint;
  const runRef = useRef(run);
  runRef.current = run;
  const puzzleRef = useRef(puzzle);
  puzzleRef.current = puzzle;
  const levelRef = useRef(level);
  levelRef.current = level;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  /** keyboard: consecutive arrow presses on the same brick count as one move */
  const keySession = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Save the run this level continues from (a new run, or one on a new set of boards), for the active player.
  useEffect(() => {
    const id = progressStore.ensureActivePlayer();
    const saved = progressStore.startRun(GAME, index, escapeRules(index), id);
    const shown = runRef.current;
    if (saved.set !== shown.set || saved.queue.join() !== shown.queue.join() || saved.solved.length !== shown.solved.length) {
      runRef.current = saved;
      setRun(saved);
      if (puzzleOnScreen(saved) !== puzzleRef.current) showPuzzle(puzzleOnScreen(saved), 'start');
    }
    // once per level: SlideApp mounts a new SlideGame for every level
  }, [index]);

  const stuckEvent = (e: StuckEvent) => setStuck((s) => stuckStep(s, e, limit));

  /** A fresh try at one board: the board, moves, hint and clock start again. */
  const freshBoard = useCallback(
    (lvl: Level) => {
      drag.current = null;
      keySession.current = null;
      stateRef.current = initialState(lvl);
      movesRef.current = 0;
      setState(stateRef.current);
      setHistory([]);
      setMoves(0);
      setUsedHint(false);
      setHintBlock(null);
      setExiting(null);
      setBumped(null);
      setPull(null);
      setTLeft(clockFor(lvl.base ?? 45, band, player?.timerMode ?? 'auto').seconds);
    },
    [band, player?.timerMode],
  );

  /** Put puzzle `p` of this level on the board (after Next or a swap). */
  const showPuzzle = (p: number, why: 'start' | 'swap') => {
    const lvl = boards[p] ?? boards[0];
    levelRef.current = lvl;
    puzzleRef.current = p;
    setPuzzle(p);
    freshBoard(lvl);
    stuckEvent({ type: why });
    setNote(why === 'swap' ? SWAPPED_LINE : '');
    setPhase('play');
  };

  const restart = () => {
    if (phaseRef.current !== 'play') return;
    freshBoard(levelRef.current);
    stuckEvent({ type: 'restart' });
    setNote('');
  };

  // Time counts while the puzzle is on screen, the page is visible and no card is open (brief 3.1).
  const playing = phase === 'play';
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setTLeft((t) => (t > 0 ? t - 1 : 0));
      setStuck((s) => stuckStep(s, { type: 'tick', seconds: 1 }, limit));
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, limit]);

  /** The puzzle is solved: save it, then show Next puzzle, or after the fourth the level card. */
  const finishIfSolved = useCallback(
    (s: State) => {
      if (!isSolved(s) || phaseRef.current !== 'play') return;
      const lvl = levelRef.current;
      const counted = clockFor(lvl.base ?? 45, band, player?.timerMode ?? 'auto').kind === 'counted';
      const result: PuzzleResult = {
        puzzle: puzzleRef.current,
        count: movesRef.current,
        par: lvl.par,
        usedHint: hintRef.current,
        outOfTime: counted && tLeftRef.current <= 0,
      };
      const outcome = progressStore.recordPuzzle(GAME, index, result, escapeRules(index));
      phaseRef.current = 'solved';
      sfx.win();
      if (outcome.kind === 'finished') {
        const total = totalStars(activePlayer(progressStore.getState()), GAME);
        setFinish({ stars: outcome.stars, results: outcome.results, next: outcome.next, total });
        setPhase('done');
        later(() => setCardOpen(true), LEVEL_CARD_DELAY_MS);
        return;
      }
      // 'ignored' only happens with no player to save to: carry on in memory so the child is never stuck.
      const next: LevelRun =
        outcome.kind === 'saved'
          ? outcome.run
          : { ...runRef.current, solved: [...runRef.current.solved, result], queue: runRef.current.queue.filter((n) => n !== result.puzzle) };
      if (next.solved.length >= SOLVES_PER_LEVEL) {
        setFinish({ stars: escapeLevelStars(next.solved), results: next.solved, next: index + 1 < PUZZLE_LEVELS.length ? index + 1 : null, total: 0 });
        setPhase('done');
        later(() => setCardOpen(true), LEVEL_CARD_DELAY_MS);
        return;
      }
      runRef.current = next;
      setRun(next);
      setPhase('solved');
      // the controls it replaces are gone, so focus moves to Next puzzle (brief 10)
      focusLater('.esc-next');
    },
    [index, band, player?.timerMode],
  );

  /** A new move starts: keep the state before it for undo, and count it. */
  const beginMove = useCallback(
    (before: Snapshot) => {
      setHistory((h) => [...h, before]);
      movesRef.current = before.moves + 1;
      setMoves(movesRef.current);
      setHintBlock(null);
      setNote('');
      setStuck((s) => stuckStep(s, { type: 'moves', moves: movesRef.current, best: levelRef.current.par }, limit));
    },
    [limit],
  );

  const leave = useCallback(
    (block: number, gate: GateDef) => {
      sfx.exit();
      setExiting({ block, side: gate.side });
      // keyboard players keep their place: focus moves to another brick when this one leaves
      const hadFocus = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('esc-brick');
      later(() => {
        const ns = withMove(stateRef.current, block, null);
        stateRef.current = ns;
        setExiting(null);
        setState(ns);
        setStuck((s) => stuckStep(s, { type: 'progress' }, limit));
        finishIfSolved(ns);
        if (hadFocus && !isSolved(ns)) later(() => document.querySelector<HTMLElement>('.esc-brick:not(.is-exiting)')?.focus(), 0);
      }, 320);
    },
    [finishIfSolved, limit],
  );

  /** Slide `block` to a legal spot on the board (never off it: leaving is `leave`). */
  const slideTo = (block: number, at: Cell) => {
    const ns = withMove(stateRef.current, block, at);
    stateRef.current = ns;
    setState(ns);
    sfx.move();
  };

  const bump = (block: number) => {
    sfx.bump();
    setBumped(block);
    later(() => setBumped(null), 350);
  };

  const busy = exiting !== null || phase !== 'play';

  /* ---------- dragging ---------- */
  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, block: number) => {
    if (busy) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety */
    }
    const start = stateRef.current.pos[block];
    if (!start) return;
    drag.current = { block, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, start, before: { state: stateRef.current, moves: movesRef.current }, moved: false, pulled: false };
    keySession.current = null;
  };

  /**
   * Follow the pointer: the brick slides to the nearest legal spot and leaves only once the drag has carried
   * it EXIT_PAST squares out through its own open door (drag.ts). Touching the door is not enough.
   * Returns true when the brick left.
   */
  const follow = (e: PointerEvent<HTMLButtonElement>, d: Drag): boolean => {
    // pointer distance is in screen px; the tablet frame is zoomed, so measure one square on screen
    const unit = e.currentTarget.getBoundingClientRect().width / ((blockSize(level.blocks[d.block]).w * cell - 4) / cell);
    const s = stateRef.current;
    const p = s.pos[d.block];
    if (!p) return false;
    const res = dragStep(level, s, d.block, d.start, [(e.clientY - d.y0) / unit, (e.clientX - d.x0) / unit]);
    const slid = res.at[0] !== p[0] || res.at[1] !== p[1];
    if ((slid || res.exit >= 0) && !d.moved) {
      d.moved = true;
      beginMove(d.before);
    }
    if (slid) slideTo(d.block, res.at);
    if (res.exit >= 0) {
      drag.current = null;
      setPull(null);
      leave(d.block, level.gates[res.exit]);
      return true;
    }
    if (res.pull) d.pulled = true;
    // the brick slides into the door opening while it is pulled, up to the point where it leaves
    setPull(res.pull ? { block: d.block, side: res.pull.side, depth: Math.min(res.pull.depth, EXIT_PAST) } : null);
    return false;
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    follow(e, d);
  };

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // a release past the door's threshold still takes the brick out; before it, the brick stays on the board
    // at its last legal spot and the pull springs back
    const left = follow(e, d);
    drag.current = null;
    setPull(null);
    // pushed into a wall or another brick: a small nudge says it can not go there
    if (!left && !d.moved && !d.pulled && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > cell * 0.3) bump(d.block);
  };

  /** A lost pointer (a system gesture, say) never takes a brick out: it just drops the drag. */
  const onPointerCancel = (e: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== e.pointerId) return;
    drag.current = null;
    setPull(null);
  };

  /*
   * ---------- keyboard: focus a brick, slide it with the arrow keys ----------
   * A press that brings the brick next to its door only slides it there; one more press toward the door takes
   * it out (drag.ts keyStep). Consecutive presses on the same brick count as one move, like one drag.
   */
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, block: number) => {
    const dir = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, Cell>)[e.key];
    if (!dir || busy) return;
    e.preventDefault();
    const before = { state: stateRef.current, moves: movesRef.current };
    const res = keyStep(level, stateRef.current, block, dir);
    if (res.kind === 'blocked') return bump(block);
    if (keySession.current !== block) beginMove(before);
    keySession.current = block;
    if (res.kind === 'exit') {
      keySession.current = null;
      leave(block, level.gates[res.gate]);
      return;
    }
    slideTo(block, res.at);
  };

  /* ---------- tools ---------- */
  const undo = () => {
    if (!history.length || busy) return;
    const last = history[history.length - 1];
    stateRef.current = last.state;
    movesRef.current = last.moves;
    setState(last.state);
    setMoves(last.moves);
    setHistory((h) => h.slice(0, -1));
    setHintBlock(null);
    setNote('');
    keySession.current = null;
  };

  const hint = () => {
    if (busy) return;
    const s = stateRef.current;
    // a short live search from where the child is now; the level's stored best order is the fallback
    const sol = solve(level, s, 40_000);
    const next = sol?.moves[0]?.block ?? (level.order ?? level.blocks.map((_, i) => i)).find((i) => s.pos[i] !== null) ?? null;
    if (next === null) return;
    setUsedHint(true);
    setHintBlock(next);
  };

  /** Next puzzle: Break first when the daily limit is used up (2.4), else the next unsolved puzzle. */
  const nextPuzzle = () => {
    if (phaseRef.current !== 'solved') return;
    if (breakBefore(`/game/escape/${index + 1}`)) return;
    showPuzzle(puzzleOnScreen(runRef.current), 'start');
    focusLater('.esc-brick');
  };

  /** The stuck offer: a different board of the same level, free (3.3). The dots stay where they are. */
  const swap = () => {
    if (phaseRef.current !== 'play' || exiting) return;
    const hadFocus = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('esc-offer');
    const saved = progressStore.swapPuzzle(GAME, index);
    const next = saved ?? { ...runRef.current, queue: rotateQueue(runRef.current.queue) };
    runRef.current = next;
    setRun(next);
    showPuzzle(puzzleOnScreen(next), 'swap');
    if (hadFocus) focusLater('.esc-brick');
  };

  /** Play Level 10 on the level card (or in the controls slot once the card is closed). */
  const playNextLevel = () => {
    if (!finish || finish.next === null) return;
    const to = `/game/escape/${finish.next + 1}`;
    if (breakBefore(to)) return;
    go(to);
  };

  const closeCard = () => {
    if (!finish || finish.next === null) return go(HOME);
    setCardOpen(false);
    // the controls slot shows the same Play button; focus goes there (brief 10)
    focusLater('.esc-next');
  };

  /* ---------- what the screen shows ---------- */
  const seconds = clock.seconds;
  const timerColor = tLeft > seconds * 0.33 ? 'ok' : tLeft > 0 ? 'low' : 'out';
  const timeUp = clock.kind === 'counted' && tLeft <= 0 && playing;
  const lockMsg = lockLine(level, state);
  const offer = playing && stuck.offer;
  const help = !playing
    ? solvedLine(moves)
    : offer
      ? OFFER_LINE
      : note
        ? note
        : timeUp
          ? TIME_UP_LINE
          : hintBlock !== null
            ? HINT_LINE
            : lockMsg || level.tip || HELP_LINE;
  // the relaxed sand timer (SandTimer) carries its own caption
  const caption = clock.kind === 'counted' ? clockCaption(player && !player.unnamed ? player.name : null, level.base ?? 45, clock.factor, fmtClock(seconds)) : '';

  const solvedDots = phase === 'done' ? SOLVES_PER_LEVEL : run.solved.length;
  const dotOnScreen = phase === 'play' ? dotPosition(run) : solvedDots;
  const card = finish ? levelCard(index + 1, finish.results, finish.next, finish.total) : null;

  return (
    <Screen className="esc">
      <EscapeBar
        title={`Level ${index + 1}`}
        dots={<PuzzleDots solved={solvedDots} puzzle={dotOnScreen} />}
        action={playing ? <IconButton icon="restart" label="Restart puzzle" onClick={restart} /> : null}
      />

      <section className="esc-status" aria-label="Puzzle status">
        <div className="esc-status__row">
          {clock.kind === 'counted' && (
            <>
              <svg className="esc-status__glass" data-state={timerColor} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
              </svg>
              <span className="esc-status__clock">
                <span className="esc-sr">Time left </span>
                {fmtClock(tLeft)}
              </span>
            </>
          )}
          <span className="esc-status__spacer" />
          <span className="esc-status__moves">Moves {moves}</span>
          <span className="esc-status__best">Best {level.par}</span>
        </div>
        {clock.kind === 'counted' && (
          <div className="esc-status__track" aria-hidden="true">
            <div className="esc-status__fill" data-state={timerColor} style={{ width: `${seconds ? Math.round((Math.max(0, tLeft) / seconds) * 100) : 0}%` }} />
          </div>
        )}
        {clock.kind === 'relaxed' && <SandTimer elapsed={seconds - tLeft} total={seconds} />}
        {caption && <p className="esc-status__caption">{caption}</p>}
      </section>

      <div className="esc-stage" ref={stage}>
        <Tray level={level} cell={cell}>
          {level.stone?.flatMap((row, r) =>
            row.map((s, c) =>
              s ? (
                <div key={`s${r}-${c}`} className="esc-stone" role="img" aria-label="Stone block, it never moves" style={{ left: c * cell + 2, top: r * cell + 2, width: cell - 4, height: cell - 4 }} />
              ) : null,
            ),
          )}
          {level.gates.map((g, gi) => (
            <Door key={gi} level={level} gate={g} cell={cell} state={state} />
          ))}
          {level.blocks.map((b, i) => {
            const p = state.pos[i];
            if (!p) return null;
            return (
              <BrickPiece
                key={`${puzzle}-${b.id}`}
                block={b}
                at={p}
                cell={cell}
                exiting={exiting?.block === i ? exiting.side : null}
                pull={pull?.block === i ? pull : null}
                hinted={hintBlock === i}
                bumped={bumped === i}
                onPointerDown={(e) => onPointerDown(e, i)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onKeyDown={(e) => onKeyDown(e, i)}
              />
            );
          })}
        </Tray>
      </div>

      <p className="esc-help" aria-live="polite">
        {help}
      </p>

      <div className="esc-tools">
        <span aria-hidden="true" />
        <div className="esc-tools__centre">
          {playing && (
            <>
              <IconButton icon="undo" label="Undo" onClick={undo} disabled={!history.length || busy} className="esc-tool" />
              <IconButton icon="hint" label="Hint" onClick={hint} variant="yellow" disabled={busy} className="esc-tool" />
            </>
          )}
          {phase === 'solved' && (
            <PressButton variant="green" icon="play" iconEnd onClick={nextPuzzle} className="esc-next bw-appear">
              Next puzzle
            </PressButton>
          )}
          {phase === 'done' && card && !cardOpen && !card.home && (
            <PressButton variant="green" icon="play" iconEnd onClick={playNextLevel} className="esc-next bw-appear">
              {card.primary}
            </PressButton>
          )}
        </div>
        <div className="esc-tools__end">{offer && <IconButton icon="swap" label="New puzzle" onClick={swap} variant="green" className="esc-tool esc-offer bw-appear" />}</div>
      </div>

      {phase === 'done' && finish && card && cardOpen && (
        <LevelCard
          title={card.title}
          stars={finish.stars}
          fact={card.fact}
          rule={card.rule}
          cap={card.cap}
          primary={card.home ? { label: card.primary, href: toHref(HOME) } : { label: card.primary, onClick: playNextLevel }}
          secondary={card.home ? undefined : { label: 'Back to games', href: toHref(HOME) }}
          onClose={closeCard}
        />
      )}
    </Screen>
  );
}

/**
 * The finished state (brief 2.5): every level has stars, so `#/game/escape` shows the game's top bar, the empty
 * tray well and the finished card. Its one button, the Escape key and a tap on the scrim all go Home.
 */
export function EscapeFinished() {
  const player = useActivePlayer();
  const last = PUZZLE_LEVELS.length - 1;
  const level = PUZZLE_LEVELS[last].puzzles[0];
  const { stage, cell } = useCell(level);
  const card = finishedCard(totalStars(player, GAME));
  return (
    <Screen className="esc">
      <EscapeBar title="Brick Escape" />
      <div className="esc-stage" ref={stage}>
        <Tray level={level} cell={cell} />
      </div>
      <LevelCard
        title={card.title}
        stars={starsFor(player, GAME, last)}
        fact={card.fact}
        note={FINISHED_NOTE}
        primary={{ label: card.primary, href: toHref(HOME) }}
        onClose={() => go(HOME)}
      />
    </Screen>
  );
}

/**
 * The game's top bar: Back to home, the title with the four dots under it, and Restart while a puzzle is on.
 * The shared TopBar puts its subtitle in a <p>, which cannot hold the dots' block, so the bar is drawn here
 * with the same classes.
 */
function EscapeBar({ title, dots, action }: { title: string; dots?: ReactNode; action?: ReactNode }) {
  return (
    <header className="bw-topbar">
      <IconButton icon="back" label="Back to home" href={toHref(HOME)} />
      <div className="bw-topbar__title">
        <h1>{title}</h1>
        {dots}
      </div>
      {action ?? <span aria-hidden="true" />}
    </header>
  );
}

/** The tray: its frame and wells, with the doors, stones and bricks drawn inside. */
function Tray({ level, cell, children }: { level: Level; cell: number; children?: ReactNode }) {
  const gridPx = cell * level.cols;
  const gridPy = cell * level.rows;
  const frames = useMemo(() => {
    const out: { key: string; style: CSSProperties; bottom: boolean }[] = [];
    const open = (r: number, c: number) => r < 0 || c < 0 || r >= level.rows || c >= level.cols || level.void[r][c];
    for (let r = 0; r < level.rows; r++)
      for (let c = 0; c < level.cols; c++) {
        if (level.void[r][c]) continue;
        const rad = (dr: number, dc: number) => (open(r + dr, c) && open(r, c + dc) && open(r + dr, c + dc) ? PAD : 0);
        out.push({
          key: `${r}-${c}`,
          bottom: open(r + 1, c),
          style: {
            left: c * cell - PAD,
            top: r * cell - PAD,
            width: cell + 2 * PAD,
            height: cell + 2 * PAD,
            borderRadius: `${rad(-1, -1)}px ${rad(-1, 1)}px ${rad(1, 1)}px ${rad(1, -1)}px`,
          },
        });
      }
    return out;
  }, [level, cell]);
  return (
    <div className="esc-board" style={{ width: gridPx + PAD * 2, height: gridPy + PAD * 2 }}>
      <div className="esc-board__grid" style={{ left: PAD, top: PAD, width: gridPx, height: gridPy }}>
        {frames.map((f) => (
          <div key={`f${f.key}`} className={`esc-frame${f.bottom ? ' is-bottom' : ''}`} style={f.style} />
        ))}
        {level.void.flatMap((row, r) =>
          row.map((v, c) => (v ? null : <div key={`w${r}-${c}`} className="esc-well" style={{ left: c * cell, top: r * cell, width: cell, height: cell }} />)),
        )}
        {children}
      </div>
    </div>
  );
}

/* ---------- pieces ---------- */

function BrickPiece({
  block,
  at,
  cell,
  exiting,
  pull,
  hinted,
  bumped,
  ...handlers
}: {
  block: BlockDef;
  at: Cell;
  cell: number;
  exiting: Side | null;
  pull: { side: Side; depth: number } | null;
  hinted: boolean;
  bumped: boolean;
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const { h, w } = blockSize(block);
  let x = at[1] * cell + 2;
  let y = at[0] * cell + 2;
  if (exiting) {
    const [dr, dc] = DIRS[exiting];
    x += dc * (w + 0.6) * cell;
    y += dr * (h + 0.6) * cell;
  } else if (pull) {
    // being dragged out: the brick follows the finger into the door opening
    const [dr, dc] = DIRS[pull.side];
    x += dc * pull.depth * cell;
    y += dr * pull.depth * cell;
  }
  if (bumped) x += 5;
  const cls = ['esc-brick', exiting && 'is-exiting', !exiting && pull && 'is-pulled', hinted && 'is-hinted'].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      style={{ width: w * cell - 4, height: h * cell - 4, transform: `translate(${x}px, ${y}px)` }}
      aria-label={`${cap(block.color)} brick`}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
      {...handlers}
    >
      <Brick color={block.color} stud={cell} width={w * cell - 4} height={h * cell - 4} radius={9} className="esc-brick__face" />
    </button>
  );
}

const ARROW: Record<Side, string> = { right: 'M9 6l6 6-6 6', left: 'M15 6l-6 6 6 6', top: 'M6 15l6-6 6 6', bottom: 'M6 9l6 6 6-6' };

function Door({ level, gate, cell, state }: { level: Level; gate: GateDef; cell: number; state: State }) {
  const d = gateDepth(level, gate);
  const span = gate.len * cell - 8;
  const thick = PAD - 4;
  const style: CSSProperties =
    gate.side === 'right'
      ? { left: (d + 1) * cell + 2, top: gate.at * cell + 4, width: thick, height: span }
      : gate.side === 'left'
        ? { left: d * cell - PAD + 2, top: gate.at * cell + 4, width: thick, height: span }
        : gate.side === 'bottom'
          ? { left: gate.at * cell + 4, top: (d + 1) * cell + 2, width: span, height: thick }
          : { left: gate.at * cell + 4, top: d * cell - PAD + 2, width: span, height: thick };
  const locked = isLocked(gate, state, level);
  const count = locksLeft(gate, state);
  const upright = gate.side === 'left' || gate.side === 'right';
  return (
    <div className={`esc-door${locked ? ' is-iced' : ''}`} data-brick={locked ? undefined : gate.color} role="img" aria-label={doorLabel(level, gate, state)} style={style}>
      {locked ? (
        <span className={`esc-door__ice${upright ? ' is-upright' : ''}`}>
          {gate.lockColor && <span className="esc-door__swatch" data-brick={gate.lockColor} />}
          {count > 0 && <span>{count}</span>}
        </span>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="esc-door__arrow">
          <path d={ARROW[gate.side]} />
        </svg>
      )}
    </div>
  );
}
