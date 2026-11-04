import { type CSSProperties, type KeyboardEvent, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toHref } from '../../shared/router';
import { sfx } from '../../shared/sound';
import { recordStars } from '../../shared/storage';
import { useActivePlayer } from '../../shared/progress';
import type { AgeBand, TimerMode } from '../../shared/progress';
import { Brick, IconButton, PressButton, Screen, TopBar } from '../../shared/ui';
import {
  type BlockDef,
  type Cell,
  DIRS,
  type GateDef,
  type Level,
  type Side,
  type State,
  blockSize,
  canPlace,
  exitGate,
  gateDepth,
  initialState,
  isLocked,
  isSolved,
  locksLeft,
  occupancy,
  starsFor,
  withMove,
} from './engine';
import { LEVELS } from './levels';
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
}

interface Snapshot {
  state: State;
  moves: number;
}

const LEVELS_ROUTE = '/game/escape/levels';

export default function SlideGame({ index }: { index: number }) {
  const level = LEVELS[index];
  const { stage, cell } = useCell(level);
  const player = useActivePlayer();
  const band: AgeBand = player?.ageBand ?? '5-6';
  const clock = clockFor(level.base ?? 45, band, player?.timerMode ?? 'auto');

  const [state, setState] = useState<State>(() => initialState(level));
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [moves, setMoves] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [hintBlock, setHintBlock] = useState<number | null>(null);
  const [exiting, setExiting] = useState<{ block: number; side: Side } | null>(null);
  const [bumped, setBumped] = useState<number | null>(null);
  const [tLeft, setTLeft] = useState(clock.seconds);
  const [won, setWon] = useState<{ stars: number; inTime: boolean } | null>(null);
  const [cardOpen, setCardOpen] = useState(false);

  const drag = useRef<Drag | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const movesRef = useRef(moves);
  movesRef.current = moves;
  const tLeftRef = useRef(tLeft);
  tLeftRef.current = tLeft;
  const hintRef = useRef(usedHint);
  hintRef.current = usedHint;
  /** keyboard: consecutive arrow presses on the same brick count as one move */
  const keySession = useRef<number | null>(null);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const reset = useCallback(() => {
    drag.current = null;
    keySession.current = null;
    stateRef.current = initialState(level);
    movesRef.current = 0;
    setState(stateRef.current);
    setHistory([]);
    setMoves(0);
    setUsedHint(false);
    setHintBlock(null);
    setExiting(null);
    setBumped(null);
    setTLeft(clock.seconds);
    setWon(null);
    setCardOpen(false);
  }, [level, clock.seconds]);

  // the clock ticks while the level is open, visible and not won
  const ticking = clock.kind !== 'off' && won === null;
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setTLeft((t) => (t > 0 ? t - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  const finishIfSolved = useCallback(
    (s: State) => {
      if (!isSolved(s)) return;
      const inTime = clock.kind !== 'counted' || tLeftRef.current > 0;
      const stars = starsFor(movesRef.current, level.par, hintRef.current, !inTime);
      recordStars('slide', index, stars);
      later(() => {
        sfx.win();
        setWon({ stars, inTime });
        setCardOpen(true);
      }, 350);
    },
    [index, level.par, clock.kind],
  );

  /** A new move starts: keep the state before it for undo, and count it. */
  const beginMove = useCallback((before: Snapshot) => {
    setHistory((h) => [...h, before]);
    movesRef.current = before.moves + 1;
    setMoves(movesRef.current);
    setHintBlock(null);
  }, []);

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
        finishIfSolved(ns);
        if (hadFocus) later(() => document.querySelector<HTMLElement>('.esc-brick:not(.is-exiting)')?.focus(), 0);
      }, 320);
    },
    [finishIfSolved],
  );

  /** Slide `block` one square. A brick at its open door that is pushed toward it leaves. */
  const step = useCallback(
    (block: number, dr: number, dc: number): 'moved' | 'exit' | 'blocked' => {
      const s = stateRef.current;
      const p = s.pos[block];
      if (!p) return 'blocked';
      const occ = occupancy(level, s);
      const here = exitGate(level, occ, s, block, p[0], p[1]);
      if (here >= 0) {
        const [gr, gc] = DIRS[level.gates[here].side];
        if (gr === dr && gc === dc) return 'exit';
      }
      const nr = p[0] + dr;
      const nc = p[1] + dc;
      if (!canPlace(level, occ, block, nr, nc)) return 'blocked';
      const ns = withMove(s, block, [nr, nc]);
      stateRef.current = ns;
      setState(ns);
      sfx.move();
      return exitGate(level, occ, ns, block, nr, nc) >= 0 ? 'exit' : 'moved';
    },
    [level],
  );

  const exitNow = (block: number) => {
    const s = stateRef.current;
    const p = s.pos[block];
    if (!p) return;
    const gi = exitGate(level, occupancy(level, s), s, block, p[0], p[1]);
    if (gi >= 0) leave(block, level.gates[gi]);
  };

  const bump = (block: number) => {
    sfx.bump();
    setBumped(block);
    later(() => setBumped(null), 350);
  };

  const busy = exiting !== null || won !== null;

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
    drag.current = { block, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, start, before: { state: stateRef.current, moves: movesRef.current }, moved: false };
    keySession.current = null;
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // pointer distance is in screen px; the tablet frame is zoomed, so measure one square on screen
    const unit = e.currentTarget.getBoundingClientRect().width / ((blockSize(level.blocks[d.block]).w * cell - 4) / cell);
    const target: Cell = [d.start[0] + Math.round((e.clientY - d.y0) / unit), d.start[1] + Math.round((e.clientX - d.x0) / unit)];
    // walk toward the target one square at a time, trying the longer way first
    for (let guard = 0; guard < 24; guard++) {
      const p = stateRef.current.pos[d.block];
      if (!p) return;
      const ry = target[0] - p[0];
      const rx = target[1] - p[1];
      if (!ry && !rx) return;
      const tries: Cell[] = Math.abs(ry) >= Math.abs(rx) ? [[Math.sign(ry), 0], [0, Math.sign(rx)]] : [[0, Math.sign(rx)], [Math.sign(ry), 0]];
      let progressed = false;
      for (const [dr, dc] of tries) {
        if (!dr && !dc) continue;
        const res = step(d.block, dr, dc);
        if (res === 'blocked') continue;
        if (!d.moved) {
          d.moved = true;
          beginMove(d.before);
        }
        if (res === 'exit') {
          drag.current = null;
          exitNow(d.block);
          return;
        }
        progressed = true;
        break;
      }
      if (!progressed) return;
    }
  };

  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    // pushed into a wall or another brick: a small nudge says it can not go there
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > cell * 0.3) bump(d.block);
  };

  /* ---------- keyboard: focus a brick, slide it with the arrow keys ---------- */
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, block: number) => {
    const dir = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, Cell>)[e.key];
    if (!dir || busy) return;
    e.preventDefault();
    const before = { state: stateRef.current, moves: movesRef.current };
    const res = step(block, dir[0], dir[1]);
    if (res === 'blocked') return bump(block);
    if (keySession.current !== block) beginMove(before);
    keySession.current = block;
    if (res === 'exit') {
      keySession.current = null;
      exitNow(block);
    }
  };

  /* ---------- tools ---------- */
  const undo = () => {
    if (!history.length || exiting) return;
    const last = history[history.length - 1];
    stateRef.current = last.state;
    movesRef.current = last.moves;
    setState(last.state);
    setMoves(last.moves);
    setHistory((h) => h.slice(0, -1));
    setHintBlock(null);
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

  /* ---------- what the screen shows ---------- */
  const limit = clock.seconds;
  const timerColor = tLeft > limit * 0.33 ? 'ok' : tLeft > 0 ? 'low' : 'out';
  const timeUp = clock.kind === 'counted' && tLeft <= 0 && won === null;
  const lockMsg = lockLine(level, state);
  const help = timeUp
    ? "Time's up! Keep going, you can still finish."
    : hintBlock !== null
      ? 'Try the glowing brick first.'
      : lockMsg || level.tip || 'Drag each brick to the door of its color.';
  const who = player && !player.unnamed ? `${player.name}: ` : '';
  const caption =
    clock.kind === 'counted'
      ? `${who}level ${index + 1} gets ${level.base ?? 45}s x ${clock.factor} = ${fmtClock(limit)}`
      : clock.kind === 'relaxed'
        ? 'A gentle sand timer for fun. It never costs a star.'
        : '';
  const hasNext = index + 1 < LEVELS.length;
  const stars = won?.stars ?? 0;
  const winText = won
    ? `${moves} ${moves === 1 ? 'move' : 'moves'}` +
      (clock.kind !== 'counted' ? '.' : won.inTime ? ', with time to spare!' : '. Next time, try to beat the clock!')
    : '';

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
    <Screen className="esc">
      <TopBar
        title={`Level ${index + 1}`}
        subtitle={`Brick Escape · ${level.name ?? ''}`}
        back={LEVELS_ROUTE}
        backLabel="Back to levels"
        action={<IconButton icon="restart" label="Restart level" onClick={reset} />}
      />

      <section className="esc-status" aria-label="Level status">
        <div className="esc-status__row">
          {clock.kind !== 'off' && (
            <>
              <svg className="esc-status__glass" data-state={timerColor} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
              </svg>
              {clock.kind === 'counted' && (
                <span className="esc-status__clock">
                  <span className="esc-sr">Time left </span>
                  {fmtClock(tLeft)}
                </span>
              )}
            </>
          )}
          <span className="esc-status__spacer" />
          <span className="esc-status__moves">Moves {moves}</span>
          <span className="esc-status__best">Best {level.par}</span>
        </div>
        {clock.kind !== 'off' && (
          <div className="esc-status__track" aria-hidden="true">
            <div className="esc-status__fill" data-state={timerColor} style={{ width: `${limit ? Math.round((Math.max(0, tLeft) / limit) * 100) : 0}%` }} />
          </div>
        )}
        {caption && <p className="esc-status__caption">{caption}</p>}
      </section>

      <div className="esc-stage" ref={stage}>
        <div className="esc-board" style={{ width: gridPx + PAD * 2, height: gridPy + PAD * 2 }}>
          <div className="esc-board__grid" style={{ left: PAD, top: PAD, width: gridPx, height: gridPy }}>
            {frames.map((f) => (
              <div key={`f${f.key}`} className={`esc-frame${f.bottom ? ' is-bottom' : ''}`} style={f.style} />
            ))}
            {level.void.flatMap((row, r) =>
              row.map((v, c) => (v ? null : <div key={`w${r}-${c}`} className="esc-well" style={{ left: c * cell, top: r * cell, width: cell, height: cell }} />)),
            )}
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
                  key={b.id}
                  block={b}
                  at={p}
                  cell={cell}
                  exiting={exiting?.block === i ? exiting.side : null}
                  hinted={hintBlock === i}
                  bumped={bumped === i}
                  onPointerDown={(e) => onPointerDown(e, i)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onKeyDown={(e) => onKeyDown(e, i)}
                />
              );
            })}
          </div>
        </div>
      </div>

      <p className="esc-help" aria-live="polite">
        {won && !cardOpen ? `${won.stars === 3 ? 'Brilliant!' : 'Great job!'} ${winText}` : help}
      </p>

      <div className="esc-tools">
        <IconButton icon="undo" label="Undo" onClick={undo} disabled={!history.length || busy} className="esc-tool" />
        <IconButton icon="hint" label="Hint" onClick={hint} variant="yellow" disabled={busy} className="esc-tool" />
      </div>

      {won && cardOpen && (
        <WinCard
          title={stars === 3 ? 'Brilliant!' : 'Great job!'}
          stars={stars}
          text={winText}
          onReplay={reset}
          nextLabel={hasNext ? `Next: Level ${index + 2}` : 'All levels'}
          nextHref={toHref(hasNext ? `/game/escape/${index + 2}` : LEVELS_ROUTE)}
          onClose={() => setCardOpen(false)}
        />
      )}
    </Screen>
  );
}

/* ---------- pieces ---------- */

function BrickPiece({
  block,
  at,
  cell,
  exiting,
  hinted,
  bumped,
  ...handlers
}: {
  block: BlockDef;
  at: Cell;
  cell: number;
  exiting: Side | null;
  hinted: boolean;
  bumped: boolean;
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const { h, w } = blockSize(block);
  let x = at[1] * cell + 2;
  let y = at[0] * cell + 2;
  if (exiting) {
    const [dr, dc] = DIRS[exiting];
    x += dc * (w + 0.6) * cell;
    y += dr * (h + 0.6) * cell;
  }
  if (bumped) x += 5;
  const cls = ['esc-brick', exiting && 'is-exiting', hinted && 'is-hinted'].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      style={{ width: w * cell - 4, height: h * cell - 4, transform: `translate(${x}px, ${y}px)` }}
      aria-label={`${cap(block.color)} brick`}
      aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
      {...handlers}
      onPointerCancel={handlers.onPointerUp}
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

function WinCard({
  title,
  stars,
  text,
  onReplay,
  nextLabel,
  nextHref,
  onClose,
}: {
  title: string;
  stars: number;
  text: string;
  onReplay: () => void;
  nextLabel: string;
  nextHref: string;
  onClose: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // the main action (Next) takes focus when the card opens; focus goes back when it closes
    card.current?.querySelector<HTMLElement>('.esc-win__next')?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  // keep focus inside the card; Escape closes it and the board stays as it is
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !card.current) return;
    const items = [...card.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <div className="esc-scrim" onKeyDown={onKeyDown}>
      <div ref={card} className="esc-win" role="dialog" aria-modal="true" aria-labelledby="esc-win-title" aria-describedby="esc-win-text">
        <h2 id="esc-win-title" className="esc-win__title">
          {title}
        </h2>
        <div className="esc-win__stars" role="img" aria-label={`${stars} of 3 stars`}>
          {[0, 1, 2].map((i) => (
            <svg key={i} width="48" height="48" viewBox="0 0 24 24" aria-hidden="true" className={i < stars ? 'is-on' : undefined}>
              <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" />
            </svg>
          ))}
        </div>
        <p id="esc-win-text" className="esc-win__text">
          {text}
        </p>
        <div className="esc-win__actions">
          <PressButton size="md" onClick={onReplay} className="esc-win__replay">
            Replay
          </PressButton>
          <PressButton size="md" variant="green" href={nextHref} className="esc-win__next">
            {nextLabel}
          </PressButton>
        </div>
      </div>
    </div>
  );
}
