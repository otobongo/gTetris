import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { go } from '../../shared/router';
import { sfx } from '../../shared/sound';
import { recordStars } from '../../shared/storage';
import { IconButton, ResultCard, TopBar } from '../../shared/ui';
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
  isFrozen,
  isLocked,
  isPlayable,
  isSolved,
  occupancy,
  starsFor,
  withMove,
} from './engine';
import { LEVELS } from './levels';
import { solve, type Move } from './solver';

interface Drag {
  block: number;
  pointerId: number;
  x0: number;
  y0: number;
  start: Cell;
  before: State;
  moved: boolean;
}

interface Exiting {
  block: number;
  side: Side;
}

function useCellSize(level: Level) {
  const calc = useCallback(() => {
    const w = Math.min(window.innerWidth - 32, 560);
    const h = window.innerHeight - 290;
    // leave room for the frame (about 0.8 of a cell across both sides)
    const size = Math.floor(Math.min(w / (level.cols + 0.8), h / (level.rows + 0.8)));
    return Math.max(34, Math.min(84, size));
  }, [level]);
  const [cell, setCell] = useState(calc);
  useEffect(() => {
    const onResize = () => setCell(calc());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [calc]);
  return cell;
}

export default function SlideGame({ index }: { index: number }) {
  const level = LEVELS[index];
  const cell = useCellSize(level);
  const pad = Math.round(cell * 0.4);

  const [state, setState] = useState<State>(() => initialState(level));
  const [history, setHistory] = useState<State[]>([]);
  const [moves, setMoves] = useState(0);
  const [usedHint, setUsedHint] = useState(false);
  const [hint, setHint] = useState<Move | null>(null);
  const [noHint, setNoHint] = useState(false);
  const [exiting, setExiting] = useState<Exiting | null>(null);
  const [bumped, setBumped] = useState<number | null>(null);
  const [showTip, setShowTip] = useState(Boolean(level.tip));
  const [won, setWon] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const movesRef = useRef(0);
  movesRef.current = moves;
  const hintRef = useRef(false);
  hintRef.current = usedHint;
  /** keyboard: consecutive arrow presses on the same brick count as one move */
  const keySession = useRef<number | null>(null);

  // reset when the level changes
  useEffect(() => {
    setState(initialState(level));
    setHistory([]);
    setMoves(0);
    setUsedHint(false);
    setHint(null);
    setExiting(null);
    setShowTip(Boolean(level.tip));
    setWon(null);
    keySession.current = null;
  }, [level]);

  const finishIfSolved = useCallback(
    (s: State) => {
      if (!isSolved(s)) return;
      const stars = starsFor(movesRef.current, level.par, hintRef.current);
      recordStars('slide', index, stars);
      window.setTimeout(() => {
        sfx.win();
        setWon(stars);
      }, 350);
    },
    [index, level.par],
  );

  /** Begin a new move: snapshot (the state before the move) for undo, bump the counter. */
  const beginMove = useCallback((before: State) => {
    setHistory((h) => [...h, before]);
    movesRef.current += 1;
    setMoves(movesRef.current);
    setHint(null);
    setNoHint(false);
  }, []);

  const doExit = useCallback(
    (block: number, gate: GateDef) => {
      sfx.exit();
      setExiting({ block, side: gate.side });
      window.setTimeout(() => {
        const ns = withMove(stateRef.current, block, null);
        stateRef.current = ns;
        setExiting(null);
        setState(ns);
        finishIfSolved(ns);
      }, 320);
    },
    [finishIfSolved],
  );

  /** Try to slide `block` one cell. Returns 'moved' | 'exit' | 'blocked'. */
  const step = useCallback(
    (block: number, dr: number, dc: number): 'moved' | 'exit' | 'blocked' => {
      const s = stateRef.current;
      const p = s.pos[block];
      if (!p) return 'blocked';
      const occ = occupancy(level, s);
      // already touching a matching open door and pushing toward it: leave
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
      const gi = exitGate(level, occ, ns, block, nr, nc);
      return gi >= 0 ? 'exit' : 'moved';
    },
    [level],
  );

  const exitNow = (block: number) => {
    const s = stateRef.current;
    const p = s.pos[block]!;
    const gi = exitGate(level, occupancy(level, s), s, block, p[0], p[1]);
    if (gi >= 0) doExit(block, level.gates[gi]);
  };

  const bump = (block: number) => {
    sfx.bump();
    setBumped(block);
    window.setTimeout(() => setBumped(null), 300);
  };

  /* ---------- pointer dragging ---------- */
  const onPointerDown = (e: React.PointerEvent, block: number) => {
    if (exiting || won !== null) return;
    if (isFrozen(level, state, block)) {
      bump(block);
      return;
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { block, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, start: state.pos[block]!, before: state, moved: false };
    keySession.current = null;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const target: Cell = [d.start[0] + Math.round((e.clientY - d.y0) / cell), d.start[1] + Math.round((e.clientX - d.x0) / cell)];
    // walk toward the target one cell at a time, preferring the axis with more distance left
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

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) {
      // a tap (or a push into a wall): nudge feedback, and select it for keyboard play
      const dist = Math.hypot(e.clientX - d.x0, e.clientY - d.y0);
      if (dist > cell * 0.3) bump(d.block);
    }
  };

  /* ---------- keyboard: focus a brick, use arrow keys ---------- */
  const onKeyDown = (e: React.KeyboardEvent, block: number) => {
    const dir = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key] as Cell | undefined;
    if (!dir || exiting || won !== null) return;
    e.preventDefault();
    if (isFrozen(level, state, block)) return bump(block);
    const before = stateRef.current;
    const res = step(block, dir[0], dir[1]);
    if (res === 'blocked') return bump(block);
    if (keySession.current !== block) beginMove(before);
    keySession.current = block;
    if (res === 'exit') {
      keySession.current = null;
      exitNow(block);
    }
  };

  /* ---------- toolbar ---------- */
  const undo = () => {
    if (!history.length || exiting) return;
    setState(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setMoves((m) => m - 1);
    setNoHint(false);
    setHint(null);
    keySession.current = null;
  };

  const restart = () => {
    setState(initialState(level));
    setHistory([]);
    setMoves(0);
    setHint(null);
    setWon(null);
    keySession.current = null;
  };

  const showHint = () => {
    const sol = solve(level, state, 200_000);
    if (!sol || !sol.moves.length) {
      setNoHint(true);
      return;
    }
    setUsedHint(true);
    setHint(sol.moves[0]);
  };

  const stuck = noHint;

  const boardW = level.cols * cell;
  const boardH = level.rows * cell;

  return (
    <div className="screen slide">
      <TopBar
        title={`Level ${index + 1}`}
        subtitle={level.name}
        back="/slide"
        right={<IconButton icon="restart" label="Restart level" onClick={restart} />}
      />
      <div className="stats">
        <span className="pill">Moves {moves}</span>
        <span className="pill" title="Fewest moves possible">
          ⭐ Best {level.par}
        </span>
      </div>

      <div className="slide-stage">
        <div
          className="slide-board"
          style={{ width: boardW + pad * 2, height: boardH + pad * 2, '--cell': `${cell}px`, '--pad': `${pad}px` } as CSSProperties}
        >
          <div className="slide-board__inner" style={{ left: pad, top: pad, width: boardW, height: boardH }}>
            {/* frame: each tray cell grown by the pad; corners round only where the tray outline turns */}
            {level.void.flatMap((row, r) =>
              row.map((v, c) => {
                if (v) return null;
                const open = (dr: number, dc: number) => !isPlayable(level, r + dr, c + dc);
                const corner = (dr: number, dc: number) => (open(dr, 0) && open(0, dc) ? pad : 0);
                return (
                  <div
                    key={`f${r}-${c}`}
                    className={`slide-frame${open(1, 0) ? ' is-bottom' : ''}`}
                    style={{
                      left: c * cell - pad,
                      top: r * cell - pad,
                      width: cell + pad * 2,
                      height: cell + pad * 2,
                      borderRadius: `${corner(-1, -1)}px ${corner(-1, 1)}px ${corner(1, 1)}px ${corner(1, -1)}px`,
                    }}
                  />
                );
              }),
            )}
            {level.void.flatMap((row, r) =>
              row.map((v, c) => (v ? null : <div key={`w${r}-${c}`} className="slide-well" style={{ left: c * cell, top: r * cell, width: cell, height: cell }} />)),
            )}
            {level.gates.map((g, gi) => (
              <Gate key={gi} level={level} gate={g} cell={cell} pad={pad} state={state} hinted={hint?.to === null && level.blocks[hint.block].color === g.color} />
            ))}
            {hint?.to && <Ghost block={level.blocks[hint.block]} at={hint.to} cell={cell} />}
            {level.blocks.map((b, i) => {
              const p = state.pos[i];
              if (!p) return null;
              return (
                <Brick
                  key={b.id}
                  block={b}
                  at={p}
                  cell={cell}
                  frozen={isFrozen(level, state, i) ? (b.frozen ?? 0) - state.exited : 0}
                  exiting={exiting?.block === i ? exiting.side : null}
                  hinted={hint?.block === i}
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

      <p className="slide-help muted" aria-live="polite">
        {stuck
          ? 'Hmm, no way out from here. Try undo!'
          : hint
            ? hint.to
              ? 'Try sliding the glowing brick to the dotted spot.'
              : 'The glowing brick can go out its door now!'
            : 'Drag a brick to its matching door.'}
      </p>

      <div className="slide-tools">
        <IconButton icon="undo" label="Undo" onClick={undo} disabled={!history.length} />
        <IconButton icon="hint" label="Hint (max 2 stars)" onClick={showHint} variant="warm" />
        <IconButton icon="restart" label="Restart" onClick={restart} disabled={!history.length} />
      </div>

      {showTip && level.tip && (
        <ResultCard title={level.name ?? `Level ${index + 1}`} message={level.tip}>
          <button className="btn btn--go" onClick={() => setShowTip(false)} autoFocus>
            Let's go!
          </button>
        </ResultCard>
      )}

      {won !== null && (
        <ResultCard
          title={won === 3 ? 'Brilliant!' : won === 2 ? 'Great job!' : 'You did it!'}
          stars={won}
          message={
            moves <= level.par
              ? `${moves} ${moves === 1 ? 'move' : 'moves'}, the fewest possible!`
              : `${moves} moves. Can you do it in ${level.par}?${usedHint ? ' (Hints give up to 2 stars.)' : ''}`
          }
        >
          <button className="btn" onClick={restart}>
            Replay
          </button>
          {index + 1 < LEVELS.length ? (
            <button className="btn btn--go" onClick={() => go(`/slide/${index + 2}`)} autoFocus>
              Next level
            </button>
          ) : (
            <button className="btn btn--go" onClick={() => go('/slide')} autoFocus>
              All levels
            </button>
          )}
        </ResultCard>
      )}
    </div>
  );
}

/* ---------- pieces ---------- */

function isRect(b: BlockDef) {
  const { h, w } = blockSize(b);
  return b.cells.length === h * w;
}

function Brick({
  block,
  at,
  cell,
  frozen,
  exiting,
  hinted,
  bumped,
  ...handlers
}: {
  block: BlockDef;
  at: Cell;
  cell: number;
  frozen: number;
  exiting: Side | null;
  hinted: boolean;
  bumped: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  const { h, w } = blockSize(block);
  let tx = at[1] * cell;
  let ty = at[0] * cell;
  if (exiting) {
    const [dr, dc] = DIRS[exiting];
    tx += dc * (w + 0.5) * cell;
    ty += dr * (h + 0.5) * cell;
  }
  const cls = ['slide-brick', exiting && 'is-exiting', hinted && 'is-hinted', bumped && 'is-bumped', frozen > 0 && 'is-frozen'].filter(Boolean).join(' ');
  const label = `${block.color} brick${frozen > 0 ? `, frozen for ${frozen} more` : ''}`;
  return (
    <div
      className={cls}
      style={{ width: w * cell, height: h * cell, transform: `translate(${tx}px, ${ty}px)` }}
      role="button"
      tabIndex={0}
      aria-label={label}
      {...handlers}
      onPointerCancel={handlers.onPointerUp}
    >
      {isRect(block) ? (
        <div className="brick slide-brick__body" data-color={block.color} style={{ inset: 2 }}>
          <div className="slide-studs" />
        </div>
      ) : (
        block.cells.map(([r, c]) => {
          const has = (dr: number, dc: number) => block.cells.some(([a, b]) => a === r + dr && b === c + dc);
          return (
            <div
              key={`${r}-${c}`}
              className="brick slide-brick__body"
              data-color={block.color}
              style={{
                left: c * cell + (has(0, -1) ? 0 : 2),
                top: r * cell + (has(-1, 0) ? 0 : 2),
                right: (w - c - 1) * cell + (has(0, 1) ? 0 : 2),
                bottom: (h - r - 1) * cell + (has(1, 0) ? 0 : 2),
                borderRadius: 6,
              }}
            >
              <div className="slide-studs" />
            </div>
          );
        })
      )}
      {frozen > 0 && (
        <div className="slide-ice" aria-hidden="true">
          <span>{frozen}</span>
        </div>
      )}
    </div>
  );
}

function Ghost({ block, at, cell }: { block: BlockDef; at: Cell; cell: number }) {
  return (
    <>
      {block.cells.map(([r, c]) => (
        <div key={`${r}-${c}`} className="slide-ghost" data-color={block.color} style={{ left: (at[1] + c) * cell, top: (at[0] + r) * cell, width: cell, height: cell }} />
      ))}
    </>
  );
}

const ARROW: Record<Side, string> = { right: 'M9 6l6 6-6 6', left: 'M15 6l-6 6 6 6', top: 'M6 15l6-6 6 6', bottom: 'M6 9l6 6 6-6' };

function Gate({ level, gate, cell, pad, state, hinted }: { level: Level; gate: GateDef; cell: number; pad: number; state: State; hinted: boolean }) {
  const d = gateDepth(level, gate);
  const horizontal = gate.side === 'left' || gate.side === 'right';
  const style: CSSProperties = horizontal
    ? { top: gate.at * cell + 3, height: gate.len * cell - 6, width: pad - 4, left: gate.side === 'right' ? (d + 1) * cell + 2 : d * cell - pad + 2 }
    : { left: gate.at * cell + 3, width: gate.len * cell - 6, height: pad - 4, top: gate.side === 'bottom' ? (d + 1) * cell + 2 : d * cell - pad + 2 };
  const locked = isLocked(gate, state);
  const left = (gate.lock ?? 0) - state.exited;
  return (
    <div className={`slide-gate brick${locked ? ' is-locked' : ''}${hinted ? ' is-hinted' : ''}`} data-color={gate.color} style={style} aria-label={`${gate.color} door${locked ? `, opens after ${left} more` : ''}`}>
      {locked ? (
        <span className="slide-gate__count">{left}</span>
      ) : (
        <svg viewBox="0 0 24 24" width={Math.min(pad, 26)} height={Math.min(pad, 26)} aria-hidden="true">
          <path d={ARROW[gate.side]} fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
