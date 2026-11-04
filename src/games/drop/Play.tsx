import { useEffect, useLayoutEffect, useReducer, useRef, useState, type ComponentProps, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import {
  activePlayer,
  freshRun,
  progressStore,
  runOf,
  totalStars,
  useActivePlayer,
  type LevelRun,
  type PuzzleOutcome,
} from '../../shared/progress';
import { go, toHref } from '../../shared/router';
import { sfx } from '../../shared/sound';
import { Brick, Icon, IconButton, LEVEL_CARD_DELAY_MS, LevelCard, PressButton, PuzzleDots, SandTimer, Screen, type IconName } from '../../shared/ui';
import { breakBefore } from '../../screens/logic/session';
import { STUCK, STUCK_START, puzzleOnScreen, stuckStep, type StuckState } from '../run';
import { PAD, REPEAT, dragMoves, dragStep, gestureAxis, keyAction, keyCommand, releaseAction, type Action } from './controls';
import { activeCells, ghostY, type GameEvent, type GameState } from './engine';
import { MiniPiece } from './MiniPiece';
import { PIECES } from './pieces';
import {
  RUN_INIT,
  STUCK_LINE,
  gameDoneCard,
  introLines,
  newRound,
  overLine,
  pressRound,
  puzzleGoalRows,
  puzzleResult,
  readyLines,
  runRules,
  solvedLine,
  stageCard,
  tickRound,
  type Phase,
  type Round,
} from './puzzles';
import { Sheet } from './Sheet';
import { STAGES } from './stages';
import { clearMessage, formatClock, ranOut, timerPlan, timerState } from './timer';

const GAME = 'drop';
const WELL_PAD = 6;
/** Room around the board for its 4px ring, plus the area's own 1px. */
const RING_ROOM = 10;
const MAX_CELL = 42;
const HOME = toHref('/');

/**
 * The level card's Play Stage button opens the next stage with its first brick waiting and no intro
 * sheet (brief 2.1 step 6). The intro still opens whenever a stage is entered from Home.
 */
let startedFromCard: number | null = null;

/** The hourglass of the timer row (canvas glyph, stroke 2.6). */
function Hourglass() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9" />
    </svg>
  );
}

/** Size the board's cells from the space left between the tiles and the controls. */
export function useCellSize(areaRef: RefObject<HTMLDivElement | null>, cols: number, rows: number): number {
  const [area, setArea] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = areaRef.current!;
    const measure = () => setArea({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [areaRef]);
  const room = WELL_PAD * 2 + RING_ROOM;
  return Math.max(10, Math.min(MAX_CELL, Math.floor(Math.min((area.w - room) / cols, (area.h - room) / rows))));
}

/** The top bar of the boards: back to Home, the title with the puzzle dots under it, and one action. */
export function DropBar({ title, dots, action }: { title: string; dots?: ReactNode; action?: ReactNode }) {
  return (
    <header className="bw-topbar">
      <IconButton icon="back" label="Back to home" href={HOME} />
      <div className="bw-topbar__title">
        <h1>{title}</h1>
        {dots}
      </div>
      {action ?? <span aria-hidden="true" />}
    </header>
  );
}

/** The well and its grid, empty or with bricks in it. */
export function Well({ cols, rows, cell, paused, children, ...board }: { cols: number; rows: number; cell: number; paused?: boolean } & Omit<ComponentProps<'div'>, 'className' | 'style'>) {
  return (
    <div
      className={`drop-well${paused ? ' is-paused' : ''}`}
      style={{ width: cols * cell + WELL_PAD * 2, height: rows * cell + WELL_PAD * 2, padding: WELL_PAD }}
      {...board}
    >
      <div className="drop-grid" style={{ width: cols * cell, height: rows * cell, backgroundSize: `${cell}px ${cell}px` }}>
        {children}
      </div>
    </div>
  );
}

type Finished = Extract<PuzzleOutcome, { kind: 'finished' }>;

export default function Play({ index }: { index: number }) {
  const stage = STAGES[index];
  const goal = puzzleGoalRows(index);
  const player = useActivePlayer();
  const band = player?.ageBand ?? '7-8';
  const plan = timerPlan({ goalRows: goal }, player?.timerMode ?? 'relaxed', band);
  const planRef = useRef(plan);
  planRef.current = plan;
  const limitRef = useRef(STUCK.drop[band]);
  limitRef.current = STUCK.drop[band];

  // Entered from Home: the intro sheet first. From the level card: straight to the waiting brick.
  const [fromCard] = useState(() => startedFromCard === index);
  // The level's run: what the store holds (startRun saves it once mounted), or a fresh one.
  const [run, setRun] = useState<LevelRun>(() => runOf(player, GAME, index) ?? freshRun(RUN_INIT, progressStore.now()));
  const runRef = useRef(run);
  runRef.current = run;

  const roundRef = useRef<Round | null>(null);
  if (roundRef.current === null) roundRef.current = newRound(index, puzzleOnScreen(run), fromCard ? 'ready' : 'intro');
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const [phase, setPhaseState] = useState<Phase>(roundRef.current.phase);
  const held = useRef(new Map<Action, number>());
  const lastBump = useRef(0);
  const endTimer = useRef(0);
  const cardTimer = useRef(0);
  const stuckRef = useRef<StuckState>(STUCK_START);
  const [offer, setOffer] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [done, setDone] = useState<Finished | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [cardClosed, setCardClosed] = useState(false);
  const [focusTo, setFocusTo] = useState<'' | 'board' | 'slot'>('');

  // Seconds on this puzzle's clock, counted only while it is being played.
  const [secs, setSecs] = useState(0);
  // The word that pops up when rows clear.
  const [flash, setFlash] = useState('');
  const flashTimer = useRef(0);

  const boardRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);

  const setPhase = (p: Phase) => {
    roundRef.current = { ...roundRef.current!, phase: p };
    if (p !== 'playing') held.current.clear();
    setPhaseState(p);
  };

  // Save the run once the screen is up (a new one, or one moved to a new set), so a solve, a swap and
  // the dots all work from what the store holds.
  useEffect(() => {
    const id = progressStore.ensureActivePlayer();
    const saved = progressStore.startRun(GAME, index, RUN_INIT, id);
    if (startedFromCard === index) startedFromCard = null;
    // from the level card the first brick is already waiting: the board takes focus, as after Next
    if (roundRef.current!.phase === 'ready') setFocusTo('board');
    setRun(saved);
    const r = roundRef.current!;
    if (r.puzzle !== puzzleOnScreen(saved) && (r.phase === 'intro' || r.phase === 'ready')) {
      roundRef.current = newRound(index, puzzleOnScreen(saved), r.phase);
      redraw();
    }
  }, [index]);

  function sounds(events: GameEvent[], s: GameState) {
    for (const e of events) {
      if (e === 'move') sfx.move();
      else if (e === 'rotate') sfx.tap();
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

  /** A puzzle solved: save it; the fourth finishes the stage and opens the level card after the last dot fills. */
  function solved(r: Round) {
    const outOfTime = ranOut(planRef.current, r.elapsedMs / 1000);
    const result = puzzleResult(index, r.puzzle, r.game, outOfTime);
    const outcome = progressStore.recordPuzzle(GAME, index, result, runRules(), progressStore.ensureActivePlayer());
    setFlash('');
    setPhase('solved');
    if (outcome.kind === 'saved') {
      setRun(outcome.run);
      setFocusTo('slot');
    } else if (outcome.kind === 'finished') {
      setDone(outcome);
      window.clearTimeout(cardTimer.current);
      cardTimer.current = window.setTimeout(() => setCardOpen(true), LEVEL_CARD_DELAY_MS);
    } else setFocusTo('slot');
  }

  /** The stack reached the top: one failed try for the stuck offer (3.1), then the sheet. */
  function outOfRoom() {
    stuckRef.current = stuckStep(stuckRef.current, { type: 'fail' }, limitRef.current);
    roundRef.current = { ...roundRef.current!, phase: 'over' };
    held.current.clear();
    window.clearTimeout(endTimer.current);
    endTimer.current = window.setTimeout(() => {
      setOffer(stuckRef.current.offer);
      setPhaseState('over');
    }, 700);
  }

  function commit(next: Round) {
    const prev = roundRef.current!;
    if (next === prev) return;
    roundRef.current = next;
    if (next.phase !== prev.phase) setPhaseState(next.phase);
    const g = next.game;
    const p = prev.game;
    if (g === p) return;
    if (g.events.length) sounds(g.events, g);
    if (g.board !== p.board || g.active !== p.active || g.queue !== p.queue || g.status !== p.status || g.lines !== p.lines) redraw();
    if (g.status !== p.status) {
      if (g.status === 'won') solved(next);
      else if (g.status === 'over') outOfRoom();
    }
  }

  function act(a: Action) {
    commit(pressRound(roundRef.current!, a));
  }

  function press(a: Action) {
    const ph = roundRef.current!.phase;
    if (ph !== 'playing' && ph !== 'ready') return;
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
    const ph = roundRef.current!.phase;
    if (ph === 'playing') setPhase('paused');
    else if (ph === 'paused') setPhase('playing');
  }

  /** Put a puzzle on screen with its stack drawn and its first brick waiting (brief 4.2). */
  function startPuzzle(puzzle: number, after: { swapped: boolean }) {
    window.clearTimeout(endTimer.current);
    window.clearTimeout(flashTimer.current);
    setFlash('');
    setSecs(0);
    setOffer(false);
    setSwapped(after.swapped);
    roundRef.current = newRound(index, puzzle, 'ready');
    setPhaseState('ready');
    held.current.clear();
    setFocusTo('board');
    redraw();
  }

  /** Next puzzle: the daily limit first (brief 2.4), then the next unsolved puzzle on the same screen. */
  function nextPuzzle() {
    if (breakBefore(`/game/drop/${index + 1}`)) return;
    stuckRef.current = stuckStep(stuckRef.current, { type: 'start' }, limitRef.current);
    startPuzzle(puzzleOnScreen(runRef.current), { swapped: false });
  }

  /** Try again: the same puzzle from its first position. Failed tries still count toward the offer. */
  function tryAgain() {
    startPuzzle(roundRef.current!.puzzle, { swapped: false });
  }

  /** New puzzle: a free swap (3.3). The dots stay; the next spare in the queue comes up. */
  function newPuzzle() {
    const id = progressStore.ensureActivePlayer();
    let swappedRun = progressStore.swapPuzzle(GAME, index, id);
    if (!swappedRun) {
      // no stored run yet (storage off, or a first swap before startRun saved): save one, then swap
      progressStore.startRun(GAME, index, RUN_INIT, id);
      swappedRun = progressStore.swapPuzzle(GAME, index, id);
    }
    if (swappedRun) setRun(swappedRun);
    stuckRef.current = stuckStep(stuckRef.current, { type: 'swap' }, limitRef.current);
    startPuzzle(puzzleOnScreen(swappedRun ?? runRef.current), { swapped: true });
  }

  /** Play Stage N from the level card: the daily limit first, then the next stage at its waiting brick. */
  function playStage(next: number) {
    const path = `/game/drop/${next + 1}`;
    if (breakBefore(path)) return;
    startedFromCard = next;
    go(path);
  }

  useEffect(() => {
    if (!focusTo) return;
    if (focusTo === 'board') boardRef.current?.focus();
    else slotRef.current?.querySelector<HTMLElement>('button, a[href]')?.focus();
    setFocusTo('');
  }, [focusTo, phase, cardOpen]);

  // Game loop. Every function it calls reads state through refs, so the first-render closures stay valid.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(Math.max(t - last, 0), 100);
      last = t;
      if (roundRef.current!.phase === 'playing') {
        for (const [a, due] of held.current) {
          const every = REPEAT[a]!.every;
          let d = due;
          for (let n = 0; t >= d && n < 4; n++, d += every) act(a);
          held.current.set(a, t >= d ? t + every : d);
        }
        commit(tickRound(roundRef.current!, dt));
        setSecs(Math.floor(roundRef.current!.elapsedMs / 1000));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(endTimer.current);
      window.clearTimeout(flashTimer.current);
      window.clearTimeout(cardTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const cmd = keyCommand(e);
      const ph = roundRef.current!.phase;
      if (cmd === 'pause') {
        if (ph !== 'playing' && ph !== 'paused') return;
        e.preventDefault();
        if (!e.repeat) togglePause();
        return;
      }
      if (!cmd || (ph !== 'playing' && ph !== 'ready')) return;
      e.preventDefault();
      if (!e.repeat) press(cmd);
    };
    const up = (e: KeyboardEvent) => {
      const a = keyAction(e.key);
      if (a) release(a);
    };
    const away = () => {
      if (roundRef.current!.phase === 'playing') setPhase('paused');
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

  const { cols, rows } = stage;
  const areaRef = useRef<HTMLDivElement>(null);
  const cell = useCellSize(areaRef, cols, rows);
  const ghostBorder = cell >= 28 ? 3 : 2;
  const radius = cell >= 28 ? 5 : 4;

  // Swipe and tap on the board: drag sideways to move, swipe down to drop, tap to turn. A waiting brick starts on the first one.
  const touch = useRef<{ id: number; x0: number; y0: number; t0: number; sx: number; axis: '' | 'h' | 'v' } | null>(null);
  const live = () => {
    const ph = roundRef.current!.phase;
    return ph === 'playing' || ph === 'ready';
  };
  const onBoardDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!live()) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    touch.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), sx: e.clientX, axis: '' };
  };
  const onBoardMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = touch.current;
    if (!t || t.id !== e.pointerId || !live()) return;
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
    if (!live()) return;
    const dx = e.clientX - t.x0;
    const dy = e.clientY - t.y0;
    const ms = performance.now() - t.t0;
    const a = releaseAction(t.axis, dx, dy, ms, cell);
    if (a) act(a);
  };

  const round = roundRef.current;
  const g = round.game;
  const a = g.active;
  const showBrick = phase === 'intro' || phase === 'ready' || phase === 'playing' || phase === 'paused';
  const gy = a && showBrick && g.status === 'playing' ? ghostY(g.board, a) : null;
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
  if (a && showBrick) {
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

  const next = g.queue[0];
  const dialogOpen = phase === 'intro' || phase === 'over' || cardOpen;
  const paused = phase === 'paused';

  // Dots (brief 7.1): right after a solve the dot just solved shows filled and stays wide.
  const solvedCount = done ? done.results.length : run.solved.length;
  const dotAt = phase === 'solved' ? solvedCount : undefined;

  // The help line: the waiting brick, the result, or the words that pop up when rows clear.
  const message: string[] = phase === 'ready' ? readyLines(index, swapped) : phase === 'solved' ? [solvedLine(g.placed)] : [];
  const say = message.length ? message : flash ? [flash] : [];

  // Timer row
  const left = plan.kind === 'countdown' ? plan.seconds - secs : 0;
  const tState = plan.kind === 'countdown' ? timerState(left, plan.seconds) : 'ok';
  const clock = formatClock(left);

  const card = done ? (done.next === null ? gameDoneCard(totalStars(activePlayer(progressStore.getState()), GAME)) : stageCard(index, done.results)) : null;
  const playLabel = done && done.next !== null ? `Play Stage ${done.next + 1}` : '';

  let slot: ReactNode;
  if (phase === 'solved' && !done)
    slot = (
      <PressButton variant="green" size="lg" icon="play" iconEnd className="drop-next bw-appear" onClick={nextPuzzle}>
        Next puzzle
      </PressButton>
    );
  else if (done && cardClosed && playLabel)
    slot = (
      <PressButton variant="green" size="lg" icon="play" iconEnd className="drop-next bw-appear" onClick={() => playStage(done.next!)}>
        {playLabel}
      </PressButton>
    );
  else if (done) slot = null;
  else
    slot = (
      <div className="drop-pad" role="group" aria-label="Controls">
        {PAD.map((p) => (
          <PadButton key={p.act} {...p} press={press} release={release} />
        ))}
      </div>
    );

  return (
    <div className="drop-root">
      <Screen className="drop-frame">
        <div className="drop-content" inert={dialogOpen}>
          <DropBar
            title={`Stage ${index + 1}`}
            dots={<PuzzleDots solved={solvedCount} puzzle={dotAt} />}
            action={
              phase === 'ready' || phase === 'playing' || phase === 'paused' ? (
                <IconButton icon={paused ? 'play' : 'pause'} label={paused ? 'Keep playing' : 'Pause'} onClick={togglePause} disabled={phase === 'ready'} />
              ) : undefined
            }
          />

          {plan.kind === 'countdown' && (
            <div className="drop-timer" data-state={tState}>
              <Hourglass />
              <span className="drop-timer__clock" role="timer" aria-label={`Time left ${clock}`}>
                {clock}
              </span>
              <span className="drop-timer__track" aria-hidden="true">
                <span style={{ width: `${Math.max(0, Math.min(100, (left / plan.seconds) * 100))}%` }} />
              </span>
            </div>
          )}
          {plan.kind === 'relaxed' && <SandTimer className="drop-sand" elapsed={secs} total={plan.seconds} />}

          <div className="drop-tiles">
            <div className="drop-tile">
              <span className="drop-tile__label">Next</span>
              <span className="drop-tile__next">{next && <MiniPiece id={next} boxW={76} boxH={40} />}</span>
            </div>
            <div className="drop-tile">
              <span className="drop-tile__label">Rows</span>
              <span className="drop-tile__value">
                {Math.min(g.lines, goal)}
                <small>/{goal}</small>
              </span>
            </div>
          </div>

          <div className="drop-area" ref={areaRef}>
            <Well
              cols={cols}
              rows={rows}
              cell={cell}
              paused={paused}
              ref={boardRef}
              tabIndex={-1}
              role="group"
              onPointerDown={onBoardDown}
              onPointerMove={onBoardMove}
              onPointerUp={onBoardUp}
              onPointerCancel={() => (touch.current = null)}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Board. Tap to turn, drag sideways to move, swipe down to drop."
            >
              {bricks}
              {g.clearing.map((y) => (
                <span key={`f${y}-${g.lines}`} className="drop-flash" style={{ top: y * cell, height: cell }} />
              ))}
            </Well>
          </div>

          <div className="drop-slot" ref={slotRef}>
            {slot}
          </div>
        </div>

        <p className={`drop-say${message.length ? ' is-message' : ''}`} role="status">
          {say.map((line) => (
            <span key={line} className="drop-say__line">
              {line}
            </span>
          ))}
        </p>

        {phase === 'intro' && (
          <Sheet
            title={stage.name}
            actions={
              <PressButton variant="green" size="lg" block data-autofocus onClick={() => startPuzzle(round.puzzle, { swapped: false })}>
                Start
              </PressButton>
            }
          >
            {introLines(index, plan.kind === 'countdown').map((line, i) => (
              <p key={line} className={i === 0 ? 'drop-sheet__line' : 'drop-sheet__note'}>
                {line}
              </p>
            ))}
            <p className="drop-sheet__keys">Keys: arrow keys move, Up turns, Space drops, P pauses.</p>
          </Sheet>
        )}

        {phase === 'over' && (
          <Sheet
            title="Out of room"
            actions={
              offer ? (
                <>
                  <PressButton variant="green" size="lg" block icon="swap" data-autofocus onClick={newPuzzle}>
                    New puzzle
                  </PressButton>
                  <PressButton size="md" block className="drop-secondary" onClick={tryAgain}>
                    Try again
                  </PressButton>
                  <a className="drop-sheet__link" href={HOME}>
                    Back to games
                  </a>
                </>
              ) : (
                <>
                  <PressButton variant="green" size="lg" block data-autofocus onClick={tryAgain}>
                    Try again
                  </PressButton>
                  <PressButton size="md" block className="drop-secondary" href={HOME}>
                    Back to games
                  </PressButton>
                </>
              )
            }
          >
            <p className="drop-sheet__line">{overLine(Math.min(g.lines, goal), goal)}</p>
            {offer && <p className="drop-sheet__line">{STUCK_LINE}</p>}
          </Sheet>
        )}

        {cardOpen && done && card && (
          <LevelCard
            title={card.title}
            stars={done.stars}
            fact={card.fact}
            rule={card.rule}
            cap={card.cap}
            primary={done.next === null ? { label: 'Back to games', href: HOME } : { label: playLabel, onClick: () => playStage(done.next!) }}
            secondary={done.next === null ? undefined : { label: 'Back to games', href: HOME }}
            onClose={() => {
              if (done.next === null) {
                go('/');
                return;
              }
              // the controls slot then shows the same Play button, and focus goes there (brief 10)
              setCardOpen(false);
              setCardClosed(true);
              setFocusTo('slot');
            }}
          />
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
