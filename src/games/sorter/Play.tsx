import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { sfx } from '../../shared/sound';
import { say } from '../../shared/speech';
import { cx, useLayout } from '../../shared/ui';
import { PlayScreen } from '../kit/PlayScreen';
import { useDragToTarget } from '../kit/useDragToTarget';
import { useLevelRun } from '../kit/useLevelRun';
import {
  HELP_SOLVED,
  HOLES_LABEL,
  SPEAKER_NAME,
  TRAY_LABEL,
  factFor,
  factStart,
  filledHoleLabel,
  helpDragging,
  helpPicked,
  helpStart,
  helpWrong,
  holeLabel,
  pieceLabel,
  spokenOnPlace,
} from './copy';
import { GAME } from './game';
import { compare, fits, pieceName, slipKey, type SorterPiece } from './puzzles';
import { SHAPE_STYLE } from './shapes';

/** The hole's red ring stays this long after a wrong placement; the help line stays until the next move. */
const WRONG_RING_MS = 660;
/**
 * The catch area around each hole, in the frame's px (brief 7.4, after play-testing): a piece let go within
 * this of a hole's edge drops in the nearest such hole, right or wrong. A release inside a hole still wins.
 */
export const SORTER_REACH_PX = 24;
/** Pieces in a tray row: 4 on a phone, 8 on a tablet (the board's values). */
const PER_ROW = { phone: 4, tablet: 8 } as const;

/* ---------- One shape, drawn the same way everywhere ---------- */

function Shape({ piece, sunk }: { piece: SorterPiece; sunk?: boolean }) {
  return (
    <span
      className={cx('sort-shape', sunk && 'is-sunk')}
      data-color={piece.color}
      style={SHAPE_STYLE[piece.shape] as CSSProperties}
      aria-hidden="true"
    />
  );
}

/* ---------- What the screen remembers about the puzzle on screen ---------- */

interface Ui {
  /** The kit's round this belongs to: a new puzzle starts from a fresh one. */
  round: number;
  /** Ids of the pieces now home (a piece and its hole share an id). */
  placed: readonly string[];
  /** The last piece placed: its fact and badge show in the fact bar. */
  last: string | null;
  /** The help line after a wrong placement, kept until the next pick, drag or placement. */
  wrongLine: string | null;
  /** The hole showing its red ring, cleared after WRONG_RING_MS. */
  wrongHole: string | null;
  /** Counts wrong placements, so the shake restarts on the same hole. */
  wrongSeq: number;
}

const fresh = (round: number): Ui => ({ round, placed: [], last: null, wrongLine: null, wrongHole: null, wrongSeq: 0 });

/** Narrow a lookup to an element that can take focus. */
const focusable = (el: Element | null): el is HTMLElement => el instanceof HTMLElement;

/* ---------- The play screen ---------- */

export function Play({ level }: { level: number }) {
  const run = useLevelRun(GAME, level);
  const layout = useLayout();
  const { puzzle } = run;
  const cm = puzzle.colorMatters;
  const pieces = puzzle.pieces;
  const playing = run.phase === 'play';

  const [state, setState] = useState<Ui>(() => fresh(run.round));
  const ui = state.round === run.round ? state : fresh(run.round);
  /** The latest Ui, written at once so two events in one frame see each other. */
  const ref = useRef(ui);
  ref.current = ui;
  const commit = (patch: Partial<Ui>) => {
    const base = ref.current.round === run.round ? ref.current : fresh(run.round);
    const next = { ...base, ...patch, round: run.round };
    ref.current = next;
    setState(next);
  };

  const trayRef = useRef<HTMLDivElement>(null);
  const holesRef = useRef<HTMLDivElement>(null);
  /** The piece that takes focus after a placement (the next one in the tray). */
  const focusPiece = useRef<string | null>(null);
  /** A keyboard pick sends focus to the first open hole. */
  const focusHole = useRef(false);

  const drag = useDragToTarget<string, string>({
    disabled: !playing,
    reach: SORTER_REACH_PX,
    onPick(id) {
      commit({ wrongLine: null, wrongHole: null });
      if (id === null) return;
      sfx.tap();
      const active = document.activeElement;
      let keyboard = false;
      try {
        keyboard = focusable(active) && active.dataset.piece === id && active.matches(':focus-visible');
      } catch {
        /* a browser without :focus-visible counts as pointer */
      }
      focusHole.current = keyboard;
    },
    onDragStart() {
      sfx.tap();
      commit({ wrongLine: null, wrongHole: null });
    },
    onDrop(pieceId, holeId) {
      const cur = ref.current.round === run.round ? ref.current : fresh(run.round);
      if (!playing || cur.placed.includes(pieceId) || cur.placed.includes(holeId)) return;
      const piece = pieces.find((p) => p.id === pieceId);
      const hole = puzzle.holes.find((h) => h.id === holeId);
      if (!piece || !hole) return;
      if (!fits(piece, hole, cm)) {
        // A wrong placement: the piece goes back (the hook already returned it), the hole shakes, the line names what matched.
        commit({ wrongLine: helpWrong(hole, compare(piece, hole), cm), wrongHole: hole.id, wrongSeq: cur.wrongSeq + 1 });
        run.slip(slipKey(piece.id, hole.id));
        // The pick is cleared, so a keyboard child lands back on the piece to try again.
        focusPiece.current = piece.id;
        return;
      }
      const placed = [...cur.placed, piece.id];
      commit({ placed, last: piece.id, wrongLine: null, wrongHole: null });
      say(spokenOnPlace(piece, cm));
      if (placed.length === pieces.length) {
        run.solve();
        return;
      }
      sfx.good();
      run.progress();
      // After a placement focus goes to the next piece still in the tray.
      const at = pieces.findIndex((p) => p.id === piece.id);
      for (let k = 1; k < pieces.length; k++) {
        const next = pieces[(at + k) % pieces.length];
        if (!placed.includes(next.id)) {
          focusPiece.current = next.id;
          break;
        }
      }
    },
  });

  // A new puzzle (Next, a swap) starts with nothing picked.
  useEffect(() => {
    drag.pick(null);
  }, [run.round]);

  // The red ring on a wrong hole fades out; the help line stays.
  useEffect(() => {
    if (ui.wrongHole === null) return;
    const id = window.setTimeout(() => commit({ wrongHole: null }), WRONG_RING_MS);
    return () => window.clearTimeout(id);
  }, [ui.wrongSeq, ui.wrongHole]);

  // Focus moves after the screen has drawn: to the next piece after a placement, to the first open hole after a keyboard pick.
  useEffect(() => {
    if (focusPiece.current !== null) {
      const el = trayRef.current?.querySelector(`[data-piece="${focusPiece.current}"]`) ?? null;
      focusPiece.current = null;
      if (focusable(el)) el.focus();
    }
    if (focusHole.current && drag.picked !== null) {
      focusHole.current = false;
      const open = puzzle.holes.find((h) => !ref.current.placed.includes(h.id));
      const el = open ? (holesRef.current?.querySelector(`[data-hole="${open.id}"]`) ?? null) : null;
      if (focusable(el)) el.focus();
    }
  });

  // Escape puts the picked piece down and sends focus back to it.
  const onHolesKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || drag.picked === null) return;
    const id = drag.picked;
    drag.pick(null);
    const el = trayRef.current?.querySelector(`[data-piece="${id}"]`) ?? null;
    if (focusable(el)) el.focus();
    e.stopPropagation();
  };

  const byId = (id: string | null) => pieces.find((p) => p.id === id) ?? null;
  const last = byId(ui.last);
  const picked = byId(drag.picked);
  const dragging = byId(drag.dragging);
  const solved = !playing;

  const line = solved
    ? HELP_SOLVED
    : (ui.wrongLine ??
      (dragging ? helpDragging(pieceName(dragging, cm)) : picked ? helpPicked(pieceName(picked, cm)) : helpStart(cm)));
  const fact = last ? factFor(last) : null;
  const factText = fact ? fact.text : factStart(cm);

  const perRow = PER_ROW[layout.mode];
  const cols = Math.min(pieces.length, perRow);
  const rows = Math.ceil(pieces.length / perRow);

  const tray = (
    <div
      ref={trayRef}
      className={cx('sort-tray', cols === 8 && 'is-tight')}
      style={{ '--sort-cols': cols } as CSSProperties}
      role="group"
      aria-label={TRAY_LABEL}
    >
      {pieces.map((p, i) =>
        ui.placed.includes(p.id) ? (
          // A placed piece leaves a faint ghost in its place, so nothing moves under a finger.
          <span key={p.id} className="sort-ghost" aria-hidden="true">
            <Shape piece={p} />
          </span>
        ) : (
          <button
            key={p.id}
            type="button"
            {...drag.item(p.id)}
            className={cx('sort-piece bw-drag', i % 2 === 1 && 'is-odd')}
            data-piece={p.id}
            aria-label={pieceLabel(p, cm)}
            aria-pressed={drag.picked === p.id}
          >
            <Shape piece={p} />
          </button>
        ),
      )}
    </div>
  );

  return (
    <PlayScreen
      run={run}
      speaker={{ label: SPEAKER_NAME, text: () => `${line} ${factText}` }}
      line={line}
      lineStyle="prompt"
      wrong={ui.wrongLine !== null && !solved}
      className={cx('sort', `sort--rows-${rows}`)}
      slotClassName="sort-well"
      controls={tray}
    >
      <div className="sort-holes">
        <div
          ref={holesRef}
          className="sort-holes__grid"
          style={{ '--sort-hole-cols': Math.min(puzzle.holes.length, 3) } as CSSProperties}
          role="group"
          aria-label={HOLES_LABEL}
          onKeyDown={onHolesKey}
        >
          {puzzle.holes.map((h) =>
            ui.placed.includes(h.id) ? (
              // Still a drop target, with no tap: a release on a filled hole, or nearer to it than to any
              // open one, lands there and goes back with no slip (brief 4.2), never in the open hole next to it.
              <div key={h.id} ref={drag.target(h.id).ref} className="sort-hole is-filled" role="img" aria-label={filledHoleLabel(h, cm)}>
                <Shape piece={h} />
              </div>
            ) : (
              <button
                key={h.id}
                type="button"
                {...drag.target(h.id)}
                className={cx('sort-hole', ui.wrongHole === h.id && 'is-wrong', ui.wrongHole === h.id && (ui.wrongSeq % 2 ? 'is-shake-a' : 'is-shake-b'))}
                data-hole={h.id}
                aria-label={holeLabel(h, cm)}
              >
                <Shape piece={h} sunk />
              </button>
            ),
          )}
        </div>
      </div>
      <div className="sort-fact">
        {fact ? (
          <span className="sort-fact__badge" role="img" aria-label={fact.badgeName}>
            {fact.badge}
          </span>
        ) : (
          <span className="sort-fact__badge" aria-hidden="true">
            ?
          </span>
        )}
        <span className="sort-fact__text">{factText}</span>
      </div>
    </PlayScreen>
  );
}

/**
 * The empty play area behind the finished card: the holes panel and the tray well with nothing in them
 * (the board's gameDone state). The kit hides it from assistive tech.
 */
export function SorterEmpty() {
  return (
    <>
      <div className="sort-holes is-empty">
        <div className="sort-holes__grid" />
      </div>
      <div className="sort-well is-empty" />
    </>
  );
}
