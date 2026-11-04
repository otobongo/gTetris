import { useEffect, useLayoutEffect, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useActivePlayer } from '../../shared/progress';
import { toHref } from '../../shared/router';
import { sfx } from '../../shared/sound';
import { getProgress, recordBest, recordStars } from '../../shared/storage';
import { Brick, Icon, IconButton, PressButton, Screen, TopBar, type IconName } from '../../shared/ui';
import { PAD, REPEAT, applyAction, dragMoves, dragStep, gestureAxis, keyAction, keyCommand, releaseAction, type Action } from './controls';
import { activeCells, ghostY, newGame, step, type GameEvent, type GameState } from './engine';
import { MiniPiece } from './MiniPiece';
import { PIECES } from './pieces';
import { Sheet, StarRow } from './Sheet';
import { capRule } from '../stars';
import { STAGES, newPieces, stageStars, starRule } from './stages';
import { clearMessage, formatClock, ranOut, timerPlan, timerState } from './timer';

type Phase = 'intro' | 'playing' | 'paused' | 'won' | 'over';

const WELL_PAD = 6;
/** Room around the board for its 4px ring, plus the area's own 1px. */
const RING_ROOM = 10;
const MAX_CELL = 42;

/** The hourglass of the timer row (canvas glyph, stroke 2.6). */
function Hourglass() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
    </svg>
  );
}

export default function Play({ index }: { index: number }) {
  const stage = STAGES[index];
  const rule = starRule(stage);
  const player = useActivePlayer();
  const plan = timerPlan(stage, player?.timerMode ?? 'relaxed', player?.ageBand ?? '7-8');
  const fresh = () => newGame(stage, (Date.now() ^ Math.imul(index + 1, 2654435761)) >>> 0);

  const gameRef = useRef<GameState | null>(null);
  if (gameRef.current === null) gameRef.current = fresh();
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const [phase, setPhaseState] = useState<Phase>('intro');
  const phaseRef = useRef<Phase>('intro');
  const held = useRef(new Map<Action, number>());
  const lastBump = useRef(0);
  const endTimer = useRef(0);
  const [result, setResult] = useState({ stars: 0, newBest: false });

  // Seconds played on this stage, counted only while the game is running.
  const elapsedMs = useRef(0);
  const [secs, setSecs] = useState(0);
  // The word that pops up when rows clear.
  const [flash, setFlash] = useState('');
  const flashTimer = useRef(0);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    if (p !== 'playing') held.current.clear();
    setPhaseState(p);
  };

  function sounds(events: GameEvent[], s: GameState) {
    for (const e of events) {
      if (e === 'move') sfx.move();
      else if (e === 'rotate') sfx.tap();
      else if (e === 'hold') sfx.good();
      else if (e === 'drop') sfx.bump();
      else if (e === 'clear') {
        sfx.line(s.clearing.length);
        setFlash(clearMessage(s.clearing.length));
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(''), 900);
      } else if (e === 'win') sfx.win();
      else if (e === 'over') sfx.lose();
      else if (e === 'bump') {
        const now = performance.now();
        if (now - lastBump.current > 250) sfx.bump();
        lastBump.current = now;
      }
    }
  }

  function finish(s: GameState, won: boolean) {
    const key = `drop:${index}`;
    const before = getProgress().best[key] ?? 0;
    recordBest(key, s.score);
    const stars = won ? stageStars(stage, s.placed, ranOut(plan, elapsedMs.current / 1000)) : 0;
    if (won) recordStars('drop', index, stars);
    setResult({ stars, newBest: before > 0 && s.score > before });
    phaseRef.current = won ? 'won' : 'over';
    held.current.clear();
    window.clearTimeout(endTimer.current);
    endTimer.current = window.setTimeout(() => setPhase(won ? 'won' : 'over'), won ? 250 : 700);
  }

  function apply(fn: (s: GameState) => GameState) {
    const prev = gameRef.current!;
    const next = fn(prev);
    if (next === prev) return;
    gameRef.current = next;
    if (next.events.length) sounds(next.events, next);
    if (
      next.board !== prev.board ||
      next.active !== prev.active ||
      next.queue !== prev.queue ||
      next.hold !== prev.hold ||
      next.holdUsed !== prev.holdUsed ||
      next.status !== prev.status ||
      next.lines !== prev.lines
    )
      redraw();
    if (next.status !== prev.status && (next.status === 'won' || next.status === 'over')) finish(next, next.status === 'won');
  }

  function act(a: Action) {
    apply((s) => applyAction(s, a));
  }

  function press(a: Action) {
    if (phaseRef.current !== 'playing') return;
    act(a);
    const r = REPEAT[a];
    if (!r) return;
    if (a === 'left') held.current.delete('right');
    if (a === 'right') held.current.delete('left');
    held.current.set(a, performance.now() + r.delay);
  }

  function release(a: Action) {
    held.current.delete(a);
  }

  function togglePause() {
    if (phaseRef.current === 'playing') setPhase('paused');
    else if (phaseRef.current === 'paused') setPhase('playing');
  }

  function restart() {
    window.clearTimeout(endTimer.current);
    window.clearTimeout(flashTimer.current);
    setFlash('');
    elapsedMs.current = 0;
    setSecs(0);
    gameRef.current = fresh();
    setPhase('playing');
    redraw();
  }

  // Game loop. Every function it calls reads state through refs, so the first-render closures stay valid.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(Math.max(t - last, 0), 100);
      last = t;
      if (phaseRef.current === 'playing') {
        for (const [a, due] of held.current) {
          const every = REPEAT[a]!.every;
          let d = due;
          for (let n = 0; t >= d && n < 4; n++, d += every) act(a);
          held.current.set(a, t >= d ? t + every : d);
        }
        apply((s) => step(s, dt));
        elapsedMs.current += dt;
        setSecs(Math.floor(elapsedMs.current / 1000));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(endTimer.current);
      window.clearTimeout(flashTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const cmd = keyCommand(e);
      if (cmd === 'pause') {
        e.preventDefault();
        if (!e.repeat) togglePause();
        return;
      }
      if (!cmd || phaseRef.current !== 'playing') return;
      e.preventDefault();
      if (!e.repeat) press(cmd);
    };
    const up = (e: KeyboardEvent) => {
      const a = keyAction(e.key);
      if (a) release(a);
    };
    const away = () => {
      if (phaseRef.current === 'playing') setPhase('paused');
    };
    const vis = () => document.hidden && away();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', away);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', away);
      document.removeEventListener('visibilitychange', vis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Size the board from the space that is left between the tiles and the buttons.
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = areaRef.current!;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { cols, rows } = stage;
  const room = WELL_PAD * 2 + RING_ROOM;
  const cell = Math.max(10, Math.min(MAX_CELL, Math.floor(Math.min((area.w - room) / cols, (area.h - room) / rows))));
  const ghostBorder = cell >= 28 ? 3 : 2;
  const radius = cell >= 28 ? 5 : 4;

  // Swipe and tap on the board: drag sideways to move, swipe down to drop, tap to turn.
  const touch = useRef<{ id: number; x0: number; y0: number; t0: number; sx: number; axis: '' | 'h' | 'v' } | null>(null);
  const onBoardDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (phaseRef.current !== 'playing') return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    touch.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), sx: e.clientX, axis: '' };
  };
  const onBoardMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = touch.current;
    if (!t || t.id !== e.pointerId) return;
    const dx = e.clientX - t.x0;
    const dy = e.clientY - t.y0;
    if (!t.axis) t.axis = gestureAxis(dx, dy);
    if (t.axis !== 'h') return;
    const drag = dragMoves(e.clientX, t.sx, dragStep(cell));
    t.sx = drag.sx;
    for (let i = 0; i < Math.abs(drag.moves); i++) act(drag.moves > 0 ? 'right' : 'left');
  };
  const onBoardUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = touch.current;
    if (!t || t.id !== e.pointerId) return;
    touch.current = null;
    if (phaseRef.current !== 'playing') return;
    const dx = e.clientX - t.x0;
    const dy = e.clientY - t.y0;
    const ms = performance.now() - t.t0;
    const a = releaseAction(t.axis, dx, dy, ms, cell);
    if (a) act(a);
  };

  const g = gameRef.current;
  const a = g.active;
  const gy = a && g.status === 'playing' ? ghostY(g.board, a) : null;
  const flashing = new Set(g.clearing);
  const pos = (x: number, y: number) => ({ transform: `translate(${x * cell}px, ${y * cell}px)` });

  const bricks: ReactNode[] = [];
  g.board.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c)
        bricks.push(
          <Brick key={`b${x},${y}`} color={c} stud={cell - 2} radius={radius} className={`drop-cell${flashing.has(y) ? ' is-clearing' : ''}`} style={pos(x, y)} />,
        );
    }),
  );
  if (a) {
    const color = PIECES[a.id].color;
    const cells = activeCells(a);
    if (gy !== null && gy !== a.y)
      cells.forEach(([cx, cy]) =>
        bricks.push(
          <span
            key={`g${cx},${cy}`}
            className="drop-ghost"
            data-brick={color}
            style={{ ...pos(a.x + cx, gy + cy), width: cell - 2, height: cell - 2, borderWidth: ghostBorder, borderRadius: radius }}
          />,
        ),
      );
    cells.forEach(([cx, cy]) =>
      bricks.push(
        <Brick key={`a${cx},${cy}`} color={color} stud={cell - 2} radius={radius} className="drop-cell is-active" style={pos(a.x + cx, a.y + cy)} />,
      ),
    );
  }

  const isLast = index === STAGES.length - 1;
  const fresh0 = newPieces(index);
  const next = g.queue[0];
  const dialogOpen = phase === 'intro' || phase === 'won' || phase === 'over';
  const paused = phase === 'paused';

  // Timer row
  const left = plan.kind === 'countdown' ? plan.seconds - secs : 0;
  const tState = plan.kind === 'countdown' ? timerState(left, plan.seconds) : 'ok';
  const clock = plan.kind === 'countdown' ? formatClock(left) : formatClock(secs);

  return (
    <div className="drop-root">
      <Screen className="drop-frame">
        <div className="drop-content" inert={dialogOpen}>
          <TopBar
            title={`Stage ${index + 1}`}
            subtitle={`Brick Drop · ${stage.name}`}
            back="/game/drop/levels"
            backLabel="Back to stages"
            action={
              <IconButton
                icon={paused ? 'play' : 'pause'}
                label={paused ? 'Keep playing' : 'Pause'}
                onClick={togglePause}
                disabled={phase !== 'playing' && phase !== 'paused'}
              />
            }
          />

          {plan.kind !== 'off' && (
            <div className="drop-timer" data-state={tState}>
              <Hourglass />
              <span className="drop-timer__clock" role="timer" aria-label={plan.kind === 'countdown' ? `Time left ${clock}` : `Time played ${clock}`}>
                {clock}
              </span>
              {plan.kind === 'countdown' && (
                <span className="drop-timer__track" aria-hidden="true">
                  <span style={{ width: `${Math.max(0, Math.min(100, (left / plan.seconds) * 100))}%` }} />
                </span>
              )}
            </div>
          )}

          <div className="drop-tiles">
            <div className="drop-tile">
              <span className="drop-tile__label">Next</span>
              <span className="drop-tile__next">{next && <MiniPiece id={next} boxW={76} boxH={40} />}</span>
            </div>
            <div className="drop-tile">
              <span className="drop-tile__label">Rows</span>
              <span className="drop-tile__value">
                {Math.min(g.lines, stage.goalRows)}
                <small>/{stage.goalRows}</small>
              </span>
            </div>
          </div>

          <div className="drop-area" ref={areaRef}>
            <div
              className={`drop-well${paused ? ' is-paused' : ''}`}
              style={{ width: cols * cell + WELL_PAD * 2, height: rows * cell + WELL_PAD * 2, padding: WELL_PAD }}
              role="group"
              onPointerDown={onBoardDown}
              onPointerMove={onBoardMove}
              onPointerUp={onBoardUp}
              onPointerCancel={() => (touch.current = null)}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Board. Tap to turn, drag sideways to move, swipe down to drop."
            >
              <div
                className="drop-grid"
                style={{ width: cols * cell, height: rows * cell, backgroundSize: `${cell}px ${cell}px` }}
              >
                {bricks}
                {g.clearing.map((y) => (
                  <span key={`f${y}-${g.lines}`} className="drop-flash" style={{ top: y * cell, height: cell }} />
                ))}
              </div>
            </div>
          </div>

          <div className="drop-pad" role="group" aria-label="Controls">
            {PAD.map((p) => (
              <PadButton key={p.act} {...p} press={press} release={release} />
            ))}
          </div>
        </div>

        <p className="drop-say" role="status">
          {flash}
        </p>

        {phase === 'intro' && (
          <Sheet
            title={stage.name}
            actions={
              <PressButton
                variant="green"
                size="md"
                data-autofocus
                onClick={() => {
                  setPhase('playing');
                }}
              >
                Let's go!
              </PressButton>
            }
          >
            <p className="drop-sheet__line">
              Goal: clear <b>{stage.goalRows}</b> rows
            </p>
            <ul className="drop-intro__pieces">
              {stage.pieces.map((id) => (
                <li key={id} className={`drop-intro__piece${fresh0.includes(id) ? ' is-new' : ''}`}>
                  <MiniPiece id={id} unit={14} />
                  {fresh0.includes(id) && <span className="drop-intro__tag">New: {PIECES[id].name}</span>}
                </li>
              ))}
            </ul>
            <p className="drop-sheet__note">{stage.tip}</p>
            <p className="drop-sheet__note">
              Use {rule.three} bricks or fewer for 3 stars.{plan.kind === 'countdown' && ` ${capRule({ clock: true }, 'stage')}`}
            </p>
            <p className="drop-sheet__keys">Keys: arrow keys move, Up turns, Space drops, P pauses.</p>
          </Sheet>
        )}

        {phase === 'won' && (
          <Sheet
            title={isLast ? 'Master Builder!' : 'Stage clear!'}
            actions={
              <>
                <PressButton variant="purple" size="md" data-autofocus={isLast || undefined} onClick={restart}>
                  Play again
                </PressButton>
                {!isLast && (
                  <PressButton variant="green" size="md" href={toHref(`/game/drop/${index + 2}`)} data-autofocus>
                    Next stage
                  </PressButton>
                )}
              </>
            }
          >
            <StarRow value={result.stars} />
            <p className="drop-sheet__line">
              You cleared {stage.goalRows} rows with <b>{g.placed}</b> bricks.
            </p>
            <p className="drop-sheet__note">
              3 stars: {rule.three} bricks or fewer. 2 stars: {rule.two} or fewer.{plan.kind === 'countdown' && ` ${capRule({ clock: true }, 'stage')}`}
            </p>
            <p className="drop-sheet__note">
              Score {g.score}
              {result.newBest && <b className="drop-sheet__best"> New best!</b>}
            </p>
            {isLast && <p className="drop-sheet__note">You finished every stage. Amazing planning!</p>}
          </Sheet>
        )}

        {phase === 'over' && (
          <Sheet
            title="Nice try!"
            actions={
              <>
                <PressButton variant="purple" size="md" href={toHref('/game/drop/levels')}>
                  Stages
                </PressButton>
                <PressButton variant="green" size="md" data-autofocus onClick={restart}>
                  Try again
                </PressButton>
              </>
            }
          >
            <p className="drop-sheet__line">
              The bricks reached the top. You cleared <b>{Math.min(g.lines, stage.goalRows)}</b> of {stage.goalRows} rows.
            </p>
            <p className="drop-sheet__note">Tip: {stage.tip}</p>
          </Sheet>
        )}
      </Screen>
    </div>
  );
}

/** One control of the row: icon over label, 62px tall. Pressing and holding repeats; Enter works from the keyboard. */
function PadButton({
  act,
  icon,
  label,
  tone,
  press,
  release,
}: {
  act: Action;
  icon: IconName;
  label: string;
  tone: 'purple' | 'green';
  press: (a: Action) => void;
  release: (a: Action) => void;
}) {
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('is-pressed');
    release(act);
  };
  return (
    <button
      type="button"
      className="bw-press drop-pad__btn"
      data-tone={tone}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.currentTarget.classList.add('is-pressed');
        press(act);
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || e.repeat) return;
        e.preventDefault();
        press(act);
        release(act);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Icon name={icon} size={26} strokeWidth={3} />
      {label}
    </button>
  );
}
