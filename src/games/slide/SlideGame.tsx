import { type CSSProperties, Fragment, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { go, toHref } from '../../shared/router';
import { sfx } from '../../shared/sound';
import { say } from '../../shared/speech';
import { activePlayer, freshRun, progressStore, runOf, totalStars, useActivePlayer, useSettings } from '../../shared/progress';
import type { AgeBand, LevelRun, PuzzleResult, TimerMode } from '../../shared/progress';
import { IconButton, LEVEL_CARD_DELAY_MS, LevelCard, PressButton, PuzzleDots, SandTimer, Screen, Brick, TopBar } from '../../shared/ui';
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
  initialState,
  isLocked,
  isSolved,
  locksLeft,
  withMove,
} from './engine';
import { EXIT_PAST, dragStep, keyStep } from './drag';
import { pastThreshold } from '../kit/dragToTarget';
import { brickLabel, doorLabel, exitLine, exitTargetLabel, moveLine, slidLine, slideTargetLabel } from './labels';
import { markFill, markPath, markSize, MARK_MIN, MARKS } from './marks';
import { type Box, FRAME, NO_MOVE_LINE, SELECT_LINE, type TapTarget, cellsBox, doorBox, exitHit, tapButtons, tapMove } from './tap';
import {
  type CardSticker,
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
  hintCapped,
  levelCard,
  levelSticker,
  solvedLine,
} from './puzzles';
import { solve } from './solver';

/* ---------- clock (Grownups board: base seconds x the age factor) ---------- */

/** Age factor from the Grownups board: ages 3 to 4 get no countdown, then x2, x1.5 and x1. */
export function ageFactor(band: AgeBand): number {
  return band === '3-4' ? 0 : band === '5-6' ? 2 : band === '7-8' ? 1.5 : 1;
}

export interface Clock {
  /** counted: running out caps the level at 2 stars. relaxed: a sand timer for fun. off: no timer. */
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

const PAD = FRAME; // frame around the tray, also the door thickness + 4 (Escape board); tap.ts places the doors with it

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

function lockLine(level: Level, state: State): string {
  for (const g of level.gates) {
    if (!isLocked(g, state, level)) continue;
    if (g.lockColor && locksLeft(g, state) === 0) return `An icy door melts when every ${g.lockColor} brick is out.`;
    const n = locksLeft(g, state);
    return `An icy door melts after ${n} more ${n === 1 ? 'brick leaves' : 'bricks leave'}.`;
  }
  return '';
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
  /** the pointer travelled 8 px (the kit's drag threshold) at some point: a drag, never a tap */
  far: boolean;
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
  /** the sticker this level just earned, taken once when it finished (decision 19) */
  sticker?: CardSticker;
}

const HOME = '/';

/** The run to continue from, read from the store without writing (the mount effect saves it). */
function runToStart(index: number): LevelRun {
  const player = activePlayer(progressStore.getState());
  const rules = escapeRules(index);
  const stored = runOf(player, GAME, index);
  return stored && stored.set === rules.set ? stored : freshRun(rules, progressStore.now());
}

/** The age band and timer mode a puzzle started with. They hold until the next puzzle, so a band changed
 * in Settings or another tab never rewrites the clock, the stuck limits or the cap of the puzzle on screen (2.3). */
interface PuzzleAge {
  band: AgeBand;
  mode: TimerMode;
}

function ageNow(): PuzzleAge {
  const p = activePlayer(progressStore.getState());
  return { band: p?.ageBand ?? '5-6', mode: p?.timerMode ?? 'auto' };
}

const focusLater = (selector: string) =>
  window.setTimeout(() => document.querySelector<HTMLElement>(selector)?.focus(), 0);

export default function SlideGame({ index }: { index: number }) {
  const boards = PUZZLE_LEVELS[index].puzzles;
  const player = useActivePlayer();
  const [age, setAge] = useState<PuzzleAge>(ageNow);
  const ageRef = useRef(age);
  ageRef.current = age;
  const limit = STUCK.escape[age.band];
  const path = `/game/escape/${index + 1}`;

  const [run, setRun] = useState<LevelRun>(() => runToStart(index));
  const [puzzle, setPuzzle] = useState(() => puzzleOnScreen(run));
  const [phase, setPhase] = useState<Phase>('play');
  const [finish, setFinish] = useState<Finish | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [stuck, setStuck] = useState<StuckState>(STUCK_START);
  const [note, setNote] = useState('');

  const level = boards[puzzle] ?? boards[0];
  const { stage, cell } = useCell(level);
  const clock = clockFor(level.base ?? 45, age.band, age.mode);

  const [state, setState] = useState<State>(() => initialState(level));
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [moves, setMoves] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [hintBlock, setHintBlock] = useState<number | null>(null);
  const [exiting, setExiting] = useState<{ block: number; side: Side } | null>(null);
  const [bumped, setBumped] = useState<number | null>(null);
  const [pull, setPull] = useState<Pull | null>(null);
  /** the brick picked with a tap, waiting for a tap on where it should slide (decision 1) */
  const [selected, setSelected] = useState<number | null>(null);
  const { voice } = useSettings();
  const [tLeft, setTLeft] = useState(clock.seconds);
  /** The hidden status line read out after a move or an exit. `n` counts the lines, so the same words said twice are read twice. */
  const [said, setSaid] = useState({ text: '', n: 0 });
  const announce = useCallback((text: string) => setSaid((s) => ({ text, n: s.n + 1 })), []);

  const drag = useRef<Drag | null>(null);
  /** how the last pointer press on a brick ended, for the click after it: a tap selects, a drag never does */
  const press = useRef<{ block: number; tap: boolean } | null>(null);
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

  /** The bricks back where the board starts, with no moves made. The hint used and the clock stay as they are. */
  const bricksBack = (lvl: Level) => {
    drag.current = null;
    keySession.current = null;
    stateRef.current = initialState(lvl);
    movesRef.current = 0;
    setState(stateRef.current);
    setHistory([]);
    setMoves(0);
    setHintBlock(null);
    setExiting(null);
    setBumped(null);
    setPull(null);
    setSelected(null);
    announce('');
  };

  /** Put puzzle `p` of this level on the board (after Next or a swap): its own clock, at the band played now. */
  const showPuzzle = (p: number, why: 'start' | 'swap') => {
    const lvl = boards[p] ?? boards[0];
    const a = ageNow();
    ageRef.current = a;
    setAge(a);
    levelRef.current = lvl;
    puzzleRef.current = p;
    setPuzzle(p);
    bricksBack(lvl);
    hintRef.current = false;
    setUsedHint(false);
    setTLeft(clockFor(lvl.base ?? 45, a.band, a.mode).seconds);
    stuckEvent({ type: why });
    setNote(why === 'swap' ? SWAPPED_LINE : '');
    setPhase('play');
  };

  /**
   * Restart puzzle only puts the bricks back (user decision D1): a hint used on this board, or a counted
   * clock that ran out, still caps the level. It checks the daily limit first, like every puzzle boundary (2.4).
   * It can be undone: the board before it goes on the Undo list as one step, with its moves, so one Undo brings
   * it all back. A board already at its start keeps the Undo list it has. Not while a brick is sliding out,
   * which would land on the fresh board.
   */
  const restart = () => {
    if (phaseRef.current !== 'play' || exiting) return;
    if (breakBefore(path)) return;
    const before: Snapshot = { state: stateRef.current, moves: movesRef.current };
    bricksBack(levelRef.current);
    setHistory(before.moves > 0 ? [...history, before] : history);
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
      const counted = clockFor(lvl.base ?? 45, ageRef.current.band, ageRef.current.mode).kind === 'counted';
      const result: PuzzleResult = {
        puzzle: puzzleRef.current,
        count: movesRef.current,
        par: lvl.par,
        usedHint: hintRef.current,
        outOfTime: counted && tLeftRef.current <= 0,
      };
      const outcome = progressStore.recordPuzzle(GAME, index, result, escapeRules(index));
      phaseRef.current = 'solved';
      setSelected(null);
      sfx.win();
      if (outcome.kind === 'finished') {
        const saved = activePlayer(progressStore.getState());
        const total = totalStars(saved, GAME);
        // once, now: after the award stickersDue no longer lists it, so the card keeps what this returns
        const sticker = levelSticker(progressStore, saved?.id);
        setFinish({ stars: outcome.stars, results: outcome.results, next: outcome.next, total, sticker });
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
    [index],
  );

  /** A new move starts: keep the state before it for undo, and count it. */
  const beginMove = useCallback(
    (before: Snapshot) => {
      setHistory((h) => [...h, before]);
      movesRef.current = before.moves + 1;
      setMoves(movesRef.current);
      setHintBlock(null);
      setSelected(null);
      setNote('');
      setStuck((s) => stuckStep(s, { type: 'moves', moves: movesRef.current, best: levelRef.current.par }, limit));
    },
    [limit],
  );

  const leave = useCallback(
    (block: number, gate: GateDef) => {
      sfx.exit();
      const color = levelRef.current.blocks[block].color;
      setExiting({ block, side: gate.side });
      // keyboard players keep their place: focus moves to another brick when this one leaves
      const hadFocus = document.activeElement instanceof HTMLElement && document.activeElement.matches('.esc-brick, .esc-target');
      setSelected(null);
      later(() => {
        const ns = withMove(stateRef.current, block, null);
        stateRef.current = ns;
        setExiting(null);
        setState(ns);
        announce(exitLine(color));
        setStuck((s) => stuckStep(s, { type: 'progress' }, limit));
        finishIfSolved(ns);
        if (hadFocus && !isSolved(ns)) later(() => document.querySelector<HTMLElement>('.esc-brick:not(.is-exiting)')?.focus(), 0);
      }, 320);
    },
    [finishIfSolved, limit, announce],
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
    drag.current = { block, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, start, before: { state: stateRef.current, moves: movesRef.current }, moved: false, pulled: false, far: false };
    press.current = null;
    keySession.current = null;
  };

  /**
   * Follow the pointer: the brick slides to the nearest legal spot and leaves only once the drag has carried
   * it EXIT_PAST squares out through its own open door (drag.ts). Touching the door is not enough.
   * Returns true when the brick left.
   */
  const follow = (e: PointerEvent<HTMLButtonElement>, d: Drag): boolean => {
    // past 8 px a press is a drag for good: it lets go of any picked brick and its release is never a tap
    if (!d.far && pastThreshold(e.clientX - d.x0, e.clientY - d.y0)) {
      d.far = true;
      setSelected(null);
    }
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

  /** A drag that ends with the brick still on the board, somewhere new, is read out like a key press. */
  const sayWhereItWent = (d: Drag) => {
    const end = stateRef.current.pos[d.block];
    if (end && (end[0] !== d.start[0] || end[1] !== d.start[1])) announce(slidLine(level.blocks[d.block].color, d.start, end));
  };

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // a release past the door's threshold still takes the brick out; before it, the brick stays on the board
    // at its last legal spot and the pull springs back
    const left = follow(e, d);
    drag.current = null;
    setPull(null);
    // a wobble toward an open door is still a tap: only the 8 px limit makes a press a drag
    press.current = { block: d.block, tap: !left && !d.far && !d.moved };
    if (!left) sayWhereItWent(d);
    // pushed into a wall or another brick: a small nudge says it can not go there
    if (!left && !d.moved && !d.pulled && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > cell * 0.3) bump(d.block);
  };

  /** A lost pointer (a system gesture, say) never takes a brick out: it just drops the drag, where the brick got to. */
  const onPointerCancel = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setPull(null);
    sayWhereItWent(d);
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
    announce(moveLine(level.blocks[block].color, dir[0] ? 'row' : 'column', dir[0] ? res.at[0] : res.at[1]));
  };

  /*
   * ---------- tap: pick a brick, then tap where it should slide (decision 1) ----------
   * The click after a press that stayed under 8 px, a mouse click, and the synthetic click VoiceOver and Switch
   * Control send all pick the brick. A press that became a drag never does. A second tap on the picked brick
   * lets it go, so a palm resting on the board never moves anything. Enter, Space and those synthetic clicks
   * carry detail 0 and follow no press of their own: a finger drag sends no click, so what it left is not theirs.
   */
  const onBrickClick = (block: number, e: MouseEvent<HTMLButtonElement>) => {
    const p = e.detail === 0 ? null : press.current;
    press.current = null;
    if (busy || (p && (p.block !== block || !p.tap))) return;
    keySession.current = null;
    setSelected(selected === block ? null : block);
  };

  /** A tap on a ringed square or the picked brick's door: one move, read out like a drag. */
  const onTarget = (block: number, target: TapTarget) => {
    if (busy) return;
    const from = stateRef.current.pos[block];
    const res = from ? tapMove(level, stateRef.current, block, target) : null;
    setSelected(null);
    if (!from || !res) return;
    const hadFocus = document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('esc-target');
    keySession.current = null;
    beginMove({ state: stateRef.current, moves: movesRef.current });
    if (res.kind === 'exit') {
      if (res.from[0] !== from[0] || res.from[1] !== from[1]) slideTo(block, res.from);
      leave(block, level.gates[res.gate]);
      return;
    }
    slideTo(block, res.at);
    announce(slidLine(level.blocks[block].color, from, res.at));
    // the target that had focus is gone: keyboard and VoiceOver users stay on the brick they moved
    if (hadFocus) focusLater(`.esc-brick[data-block="${block}"]`);
  };

  /** A tap anywhere on the board that is not a brick or a target lets the picked brick go. */
  const onBoardClick = (e: MouseEvent<HTMLDivElement>) => {
    if (selected === null || (e.target instanceof Element && e.target.closest('.esc-brick, .esc-target'))) return;
    setSelected(null);
  };

  // Escape lets the picked brick go, wherever focus is
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // the target that had focus goes away with the selection: keyboard and VoiceOver users stay on the brick
      if (document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('esc-target')) focusLater(`.esc-brick[data-block="${selected}"]`);
      setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

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
    setSelected(null);
    setNote('');
    announce('');
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
    setSelected(null);
  };

  /** Next puzzle: Break first when the daily limit is used up (2.4), else the next unsolved puzzle. */
  const nextPuzzle = () => {
    if (phaseRef.current !== 'solved') return;
    if (breakBefore(path)) return;
    showPuzzle(puzzleOnScreen(runRef.current), 'start');
    focusLater('.esc-brick');
  };

  /** The stuck offer: a different board of the same level, free (3.3). The dots stay where they are. Break first when the limit is used up. */
  const swap = () => {
    if (phaseRef.current !== 'play' || exiting) return;
    if (breakBefore(path)) return;
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
  const picked = playing && !exiting && selected !== null && state.pos[selected] ? selected : null;
  const pickedTargets = picked !== null ? tapButtons(level, state, picked) : [];
  const restHelp = !playing
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
  const help = picked === null ? restHelp : pickedTargets.length ? SELECT_LINE : NO_MOVE_LINE;
  // the relaxed sand timer (SandTimer) carries its own caption
  const caption = clock.kind === 'counted' ? clockCaption(player && !player.unnamed ? player.name : null, level.base ?? 45, clock.factor, fmtClock(seconds)) : '';

  const solvedDots = phase === 'done' ? SOLVES_PER_LEVEL : run.solved.length;
  const dotOnScreen = phase === 'play' ? dotPosition(run) : solvedDots;
  const card = finish ? levelCard(index + 1, finish.results, finish.next, finish.total) : null;

  return (
    <Screen className="esc">
      <TopBar
        title={`Level ${index + 1}`}
        backLabel="Back to home"
        below={<PuzzleDots solved={solvedDots} puzzle={dotOnScreen} capped={hintCapped(usedHint, finish?.results ?? run.solved)} />}
        action={playing ? <IconButton icon="restart" label="Restart puzzle" onClick={restart} /> : undefined}
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
        <Tray level={level} cell={cell} onClick={onBoardClick}>
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
              <Fragment key={`${puzzle}-${b.id}`}>
                <BrickPiece
                  index={i}
                  block={b}
                  at={p}
                  cell={cell}
                  exiting={exiting?.block === i ? exiting.side : null}
                  pull={pull?.block === i ? pull : null}
                  hinted={hintBlock === i}
                  selected={picked === i}
                  bumped={bumped === i}
                  onClick={(e) => onBrickClick(i, e)}
                  onPointerDown={(e) => onPointerDown(e, i)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerCancel}
                  onKeyDown={(e) => onKeyDown(e, i)}
                />
                {/* right after the picked brick, so the next stop for Tab, VoiceOver and Switch Control is where it can go */}
                {picked === i &&
                  pickedTargets.map((t) => (
                    <Target key={t.kind === 'exit' ? `x${t.gate}` : `s${t.at[0]}-${t.at[1]}`} level={level} block={i} target={t} cell={cell} onTap={() => onTarget(i, t)} />
                  ))}
              </Fragment>
            );
          })}
        </Tray>
      </div>

      {/* while a brick is picked, the line it replaced still holds its room (data-hold), so the board never moves between the two taps */}
      <p className="esc-help" aria-live="polite" data-hold={picked !== null ? restHelp : undefined}>
        <span className="esc-help__line">{help}</span>
      </p>
      {/* VoiceOver hears where each brick went; the line on screen stays the help line */}
      <span className="esc-sr" role="status" aria-live="polite">
        {said.text && `${said.text}${said.n % 2 ? '\u00a0' : ''}`}
      </span>

      <div className="esc-tools">
        {/* Voice on: a speaker reads the help line on screen now, and only when it is tapped (decisions 17, 20) */}
        {voice ? <IconButton icon="speaker" label="Hear the help line" className="esc-tool esc-speaker" onClick={() => say(help)} /> : <span aria-hidden="true" />}
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
        <div className="esc-tools__end">{offer && <IconButton icon="swap" label="New puzzle" onClick={swap} variant="green" className="esc-tool esc-offer bw-appear" cue={age.band === '3-4'} />}</div>
      </div>

      {phase === 'done' && finish && card && cardOpen && (
        <LevelCard
          title={card.title}
          stars={finish.stars}
          fact={card.fact}
          rule={card.rule}
          cap={card.cap}
          sticker={finish.sticker}
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
      <TopBar title="Brick Escape" backLabel="Back to home" />
      <div className="esc-stage" ref={stage}>
        <Tray level={level} cell={cell} />
      </div>
      <LevelCard
        title={card.title}
        total={{ stars: totalStars(player, GAME), max: PUZZLE_LEVELS.length * 3 }}
        fact={card.fact}
        note={FINISHED_NOTE}
        primary={{ label: card.primary, href: toHref(HOME) }}
        onClose={() => go(HOME)}
      />
    </Screen>
  );
}

/** The tray: its frame and wells, with the doors, stones and bricks drawn inside. */
function Tray({ level, cell, children, onClick }: { level: Level; cell: number; children?: ReactNode; onClick?: (e: MouseEvent<HTMLDivElement>) => void }) {
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
    // the click only lets a picked brick go; Escape does the same from the keyboard
    <div className="esc-board" style={{ width: gridPx + PAD * 2, height: gridPy + PAD * 2 }} onClick={onClick}>
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
  index,
  block,
  at,
  cell,
  exiting,
  pull,
  hinted,
  selected,
  bumped,
  ...handlers
}: {
  index: number;
  block: BlockDef;
  at: Cell;
  cell: number;
  exiting: Side | null;
  pull: { side: Side; depth: number } | null;
  hinted: boolean;
  selected: boolean;
  bumped: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
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
      data-block={index}
      style={{ width: w * cell - 4, height: h * cell - 4, transform: `translate(${x}px, ${y}px)` }}
      aria-label={brickLabel(block, at)}
      aria-pressed={selected}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
      {...handlers}
    >
      <Brick color={block.color} stud={cell} width={w * cell - 4} height={h * cell - 4} radius={9} className="esc-brick__face">
        <Mark color={block.color} size={markSize(cell)} />
      </Brick>
    </button>
  );
}

/** A colour's geometric mark (decision 2): a plain shape pressed into the plastic, hidden from VoiceOver (the name has the colour). */
function Mark({ color, size }: { color: BlockDef['color']; size: number }) {
  return (
    <svg className="esc-mark" data-shape={MARKS[color].shape} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={markPath(color)} fill={markFill(color)} fillRule="evenodd" />
    </svg>
  );
}

const ARROW: Record<Side, string> = { right: 'M9 6l6 6-6 6', left: 'M15 6l-6 6 6 6', top: 'M6 15l6-6 6 6', bottom: 'M6 9l6 6 6-6' };

function Door({ level, gate, cell, state }: { level: Level; gate: GateDef; cell: number; state: State }) {
  const style: CSSProperties = doorBox(level, gate, cell);
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
        // the door's mark beside its chevron: side by side on a top or bottom door, stacked on a side door
        <span className={`esc-door__open${upright ? ' is-upright' : ''}`}>
          <Mark color={gate.color} size={MARK_MIN} />
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="esc-door__arrow">
            <path d={ARROW[gate.side]} />
          </svg>
        </span>
      )}
    </div>
  );
}

/**
 * A place the picked brick can slide to (a faint ring in the free squares at its leading edge once there), or
 * its own open door. The door's button grows outward and along the door to 44 px (exitHit), and reaches into
 * the free squares beside the door, so it never covers a brick.
 */
function Target({ level, block, target, cell, onTap }: { level: Level; block: number; target: TapTarget; cell: number; onTap: () => void }) {
  const color = level.blocks[block].color;
  const strip = cellsBox(target.kind === 'slide' ? target.cells : target.reach, cell);
  if (target.kind === 'slide') {
    return <button type="button" className="esc-target" style={strip ?? undefined} aria-label={slideTargetLabel(color, target.at)} onClick={onTap} />;
  }
  const gate = level.gates[target.gate];
  const door = doorBox(level, gate, cell);
  const hit = exitHit(level, gate, cell);
  const inside = (b: Box): CSSProperties => ({ left: b.left - hit.left, top: b.top - hit.top, width: b.width, height: b.height });
  return (
    <button type="button" className="esc-target is-exit" style={hit} aria-label={exitTargetLabel(color)} onClick={onTap}>
      <span className="esc-target__door" style={inside(door)} />
      {strip && <span className="esc-target__reach" style={inside(strip)} />}
    </button>
  );
}
