import { useEffect, useLayoutEffect, useReducer, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { go } from '../../shared/router';
import { sfx } from '../../shared/sound';
import { getProgress, recordBest, recordStars } from '../../shared/storage';
import { Icon, IconButton, ResultCard, Stars, TopBar } from '../../shared/ui';
import {
  PREVIEW,
  activeCells,
  ghostY,
  hardDrop,
  hold,
  move,
  newGame,
  rotate,
  softDrop,
  step,
  type GameEvent,
  type GameState,
} from './engine';
import { MiniPiece } from './MiniPiece';
import { PIECES } from './pieces';
import { STAGES, newPieces, starRule, starsEarned } from './stages';

type Action = 'left' | 'right' | 'down' | 'rotate' | 'rotateBack' | 'drop' | 'hold';
type Phase = 'intro' | 'playing' | 'paused' | 'won' | 'over';

/** Hold-to-repeat timings (ms). Gentle on purpose so small fingers don't overshoot. */
const REPEAT: Partial<Record<Action, { delay: number; every: number }>> = {
  left: { delay: 200, every: 75 },
  right: { delay: 200, every: 75 },
  down: { delay: 120, every: 45 },
};

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowUp: 'rotate',
  x: 'rotate',
  X: 'rotate',
  z: 'rotateBack',
  Z: 'rotateBack',
  ' ': 'drop',
  c: 'hold',
  C: 'hold',
  Shift: 'hold',
};

const WELL_PAD = 6;
const FIELD_GAP = 10;

export default function Play({ index }: { index: number }) {
  const stage = STAGES[index];
  const rule = starRule(stage);
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
      else if (e === 'clear') sfx.line(s.clearing.length);
      else if (e === 'win') sfx.win();
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
    const stars = won ? starsEarned(stage, s.placed) : 0;
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
      next.status !== prev.status
    )
      redraw();
    if (next.status !== prev.status && (next.status === 'won' || next.status === 'over')) finish(next, next.status === 'won');
  }

  function act(a: Action) {
    switch (a) {
      case 'left': return apply((s) => move(s, -1));
      case 'right': return apply((s) => move(s, 1));
      case 'down': return apply(softDrop);
      case 'rotate': return apply((s) => rotate(s, 1));
      case 'rotateBack': return apply((s) => rotate(s, -1));
      case 'drop': return apply(hardDrop);
      case 'hold': return apply(hold);
    }
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
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(endTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        if (!e.repeat) togglePause();
        return;
      }
      const a = KEYS[e.key];
      if (!a || phaseRef.current !== 'playing') return;
      e.preventDefault();
      if (!e.repeat) press(a);
    };
    const up = (e: KeyboardEvent) => {
      const a = KEYS[e.key];
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

  // Size the board from the space that is left after the top bar and the buttons.
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
  const wide = area.w >= 440;
  const sideW = wide ? 118 : 74;
  const cell = Math.max(
    10,
    Math.min(38, Math.floor(Math.min((area.w - sideW - FIELD_GAP - WELL_PAD * 2) / cols, (area.h - WELL_PAD * 2) / rows))),
  );
  const mini = Math.max(8, Math.min(Math.floor((sideW - 18) / 4), Math.round(cell * 0.62)));

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
    if (!t.axis && Math.hypot(dx, dy) > 12) t.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (t.axis !== 'h') return;
    const stepPx = Math.max(cell, 18);
    while (e.clientX - t.sx >= stepPx) {
      act('right');
      t.sx += stepPx;
    }
    while (e.clientX - t.sx <= -stepPx) {
      act('left');
      t.sx -= stepPx;
    }
  };
  const onBoardUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = touch.current;
    if (!t || t.id !== e.pointerId) return;
    touch.current = null;
    if (phaseRef.current !== 'playing') return;
    const dx = e.clientX - t.x0;
    const dy = e.clientY - t.y0;
    const ms = performance.now() - t.t0;
    if (t.axis === 'v' && dy > Math.max(40, cell * 2) && dy > Math.abs(dx) * 1.5) act('drop');
    else if (!t.axis && ms < 350) act('rotate');
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
          <span
            key={`b${x},${y}`}
            className={`brick brick--studs drop-cell${flashing.has(y) ? ' is-clearing' : ''}`}
            data-color={c}
            style={pos(x, y)}
          />,
        );
    }),
  );
  if (a) {
    const color = PIECES[a.id].color;
    const cells = activeCells(a);
    if (gy !== null && gy !== a.y)
      cells.forEach(([cx, cy]) =>
        bricks.push(<span key={`g${cx},${cy}`} className="drop-ghost" data-color={color} style={pos(a.x + cx, gy + cy)} />),
      );
    cells.forEach(([cx, cy]) =>
      bricks.push(
        <span key={`a${cx},${cy}`} className="brick brick--studs drop-cell is-active" data-color={color} style={pos(a.x + cx, a.y + cy)} />,
      ),
    );
  }

  const isLast = index === STAGES.length - 1;
  const fresh0 = newPieces(index);

  return (
    <div className="drop-play">
      <div className="drop-play__inner">
        <TopBar
          title={`Stage ${index + 1}`}
          subtitle={`${stage.name}${stage.speedy ? ' · speedy!' : ''}`}
          back="/drop"
          right={
            <IconButton
              icon={phase === 'paused' ? 'play' : 'pause'}
              label={phase === 'paused' ? 'Keep playing' : 'Pause'}
              onClick={togglePause}
              disabled={phase !== 'playing' && phase !== 'paused'}
            />
          }
        />

        <div className="drop-area" ref={areaRef}>
          <div className="drop-field" style={{ gap: FIELD_GAP }}>
            <div
              className="drop-well"
              style={{ width: cols * cell + WELL_PAD * 2, height: rows * cell + WELL_PAD * 2, padding: WELL_PAD }}
              onPointerDown={onBoardDown}
              onPointerMove={onBoardMove}
              onPointerUp={onBoardUp}
              onPointerCancel={() => (touch.current = null)}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Board. Tap to turn, drag sideways to move, swipe down to drop."
            >
              <div
                className="drop-grid"
                style={{ width: cols * cell, height: rows * cell, ['--cell' as string]: `${cell}px`, backgroundSize: `${cell}px ${cell}px` }}
              >
                {bricks}
                {g.clearing.map((y) => (
                  <span key={`f${y}-${g.lines}`} className="drop-flash" style={{ top: y * cell, height: cell }} />
                ))}
              </div>
            </div>

            <aside className="drop-side" style={{ width: sideW }}>
              <button
                type="button"
                tabIndex={-1}
                className={`drop-box drop-box--hold${g.holdUsed ? ' is-used' : ''}`}
                aria-label="Hold brick"
                onPointerDown={(e) => {
                  e.preventDefault();
                  press('hold');
                }}
              >
                <span className="drop-box__label">Hold</span>
                <span className="drop-box__slot" style={{ minHeight: mini * 2 }}>
                  <MiniPiece id={g.hold} size={mini} dim={g.holdUsed} />
                </span>
              </button>
              <div className="drop-box">
                <span className="drop-box__label">Next</span>
                {g.queue.slice(0, PREVIEW).map((id, i) => (
                  <span key={i} className={`drop-box__slot${i > 0 ? ' is-later' : ''}`} style={{ minHeight: mini * 2 }}>
                    <MiniPiece id={id} size={mini} />
                  </span>
                ))}
              </div>
              <div className="drop-stat">
                <span className="drop-stat__label">Rows</span>
                <b className="drop-stat__value">
                  {Math.min(g.lines, stage.goalRows)}
                  <small>/{stage.goalRows}</small>
                </b>
                <span className="drop-meter" aria-hidden="true">
                  <span style={{ width: `${(Math.min(g.lines, stage.goalRows) / stage.goalRows) * 100}%` }} />
                </span>
              </div>
              <div className="drop-stat">
                <span className="drop-stat__label">Bricks</span>
                <b className="drop-stat__value">{g.placed}</b>
              </div>
            </aside>
          </div>
        </div>

        <div className="drop-pad" role="group" aria-label="Controls">
          <PadButton act="hold" icon="hold" label="Hold" press={press} release={release} />
          <PadButton act="rotate" icon="rotate" label="Turn" variant="go" press={press} release={release} />
          <PadButton act="drop" icon="drop" label="Drop" variant="warm" press={press} release={release} />
          <PadButton act="left" icon="left" label="Left" press={press} release={release} />
          <PadButton act="down" icon="down" label="Down" press={press} release={release} />
          <PadButton act="right" icon="right" label="Right" press={press} release={release} />
        </div>
        <p className="drop-keys">
          Keys: <kbd>←</kbd> <kbd>→</kbd> move · <kbd>↑</kbd> turn · <kbd>↓</kbd> down · <kbd>Space</kbd> drop · <kbd>C</kbd> hold ·{' '}
          <kbd>P</kbd> pause
        </p>
      </div>

      {phase === 'intro' && (
        <ResultCard
          title={stage.name}
          message={
            <span className="drop-intro">
              <span className="drop-intro__goal">
                Goal: clear <b>{stage.goalRows}</b> rows
              </span>
              <span className="drop-intro__pieces">
                {stage.pieces.map((id) => (
                  <span key={id} className={`drop-intro__piece${fresh0.includes(id) ? ' is-new' : ''}`}>
                    <MiniPiece id={id} size={14} />
                    {fresh0.includes(id) && <span className="drop-intro__tag">New: {PIECES[id].name}</span>}
                  </span>
                ))}
              </span>
              <span className="drop-intro__tip">{stage.tip}</span>
              <span className="drop-intro__rule">
                <Stars value={3} /> use {rule.three} bricks or fewer
              </span>
            </span>
          }
        >
          <button
            className="btn btn--go"
            onClick={() => {
              sfx.tap();
              setPhase('playing');
            }}
          >
            Let's go!
          </button>
          <button className="btn" onClick={() => go('/drop')}>
            Stages
          </button>
        </ResultCard>
      )}

      {phase === 'paused' && (
        <ResultCard title="Paused" message="Take a break. Your bricks will wait for you.">
          <button className="btn btn--go" onClick={() => { sfx.tap(); setPhase('playing'); }}>
            Keep playing
          </button>
          <button className="btn" onClick={() => { sfx.tap(); restart(); }}>
            Start over
          </button>
          <button className="btn" onClick={() => go('/drop')}>
            Stages
          </button>
        </ResultCard>
      )}

      {phase === 'won' && (
        <ResultCard
          title={isLast ? 'Master Builder!' : 'Stage clear!'}
          stars={result.stars}
          message={
            <span className="drop-result">
              <span>
                You cleared {stage.goalRows} rows with <b>{g.placed}</b> bricks.
              </span>
              <span className="drop-result__rule">
                3 stars: {rule.three} bricks or fewer. 2 stars: {rule.two} or fewer.
              </span>
              <span className="drop-result__score">
                Score {g.score}
                {result.newBest && <b className="drop-result__best"> New best!</b>}
              </span>
              {isLast && <span>You finished every stage. Amazing planning!</span>}
            </span>
          }
        >
          {!isLast && (
            <button className="btn btn--go" onClick={() => { sfx.tap(); go(`/drop/${index + 2}`); }}>
              Next stage
            </button>
          )}
          <button className="btn" onClick={() => { sfx.tap(); restart(); }}>
            Play again
          </button>
          <button className="btn" onClick={() => { sfx.tap(); go('/drop'); }}>
            Stages
          </button>
        </ResultCard>
      )}

      {phase === 'over' && (
        <ResultCard
          title="Nice try!"
          message={
            <span className="drop-result">
              <span>
                The bricks reached the top. You cleared <b>{Math.min(g.lines, stage.goalRows)}</b> of {stage.goalRows} rows.
              </span>
              <span className="drop-result__rule">Tip: {stage.tip}</span>
            </span>
          }
        >
          <button className="btn btn--go" onClick={() => { sfx.tap(); restart(); }}>
            Try again
          </button>
          <button className="btn" onClick={() => { sfx.tap(); go('/drop'); }}>
            Stages
          </button>
        </ResultCard>
      )}
    </div>
  );
}

function PadButton({
  act,
  icon,
  label,
  variant,
  press,
  release,
}: {
  act: Action;
  icon: string;
  label: string;
  variant?: 'go' | 'warm';
  press: (a: Action) => void;
  release: (a: Action) => void;
}) {
  const up = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.currentTarget.classList.remove('is-down');
    release(act);
  };
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`btn drop-pad__btn drop-pad__btn--${act}${variant ? ` btn--${variant}` : ''}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        e.currentTarget.classList.add('is-down');
        press(act);
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Icon name={icon} size={28} />
      <span className="drop-pad__label">{label}</span>
    </button>
  );
}
