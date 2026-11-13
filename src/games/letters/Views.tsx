import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react';
import { letterName, say } from '../../shared/speech';
import { sfx } from '../../shared/sound';
import { useLayout } from '../../shared/ui';
import { LetterBrick, StaticBrick, type DropAt } from './Brick';
import { DRAG_NOTE, MID_LINE, solvedLine } from './copy';
import { WordPicture } from './Pictures';
import type { FillPrompt, MatchPrompt, SoundPrompt, Tile } from './levels';
import {
  checkSound,
  fillDone,
  hintFill,
  hintMatch,
  hintSound,
  matchDone,
  newFill,
  newMatch,
  nextCell,
  placeOwn,
  tapFill,
  tapMatch,
  tileForKey,
  usedIds,
} from './logic';
import { minViewHeight, slotSize, traySize, type SlotSize, type TraySize } from './sizing';

export interface ViewProps<P> {
  prompt: P;
  active: boolean;
  /** A wrong tap: a slip, and the stuck count signal (brief 3.1). */
  onSlip: () => void;
  /** A right tap that moves the puzzle on: it hides the stuck offer and resets the time signal (3.1, 3.2). */
  onProgress?: () => void;
  /** The puzzle is solved, called on the tap that solves it. The parent then shows Next in the tray well. */
  onDone: () => void;
  /** the parent's hint button calls this; it returns false when there is nothing to point at */
  hintRef: MutableRefObject<(() => boolean) | null>;
  /** The hint button, placed beside the help line. */
  hint: ReactNode;
  /** Width of the inner frame in px (the sizes of slots and tiles come from it). */
  innerW: number;
  /** What to tell the child before the first tap. */
  instruction: string;
  /** A line that takes the help line's place while it is set: the stuck offer (3.2). */
  helpOverride?: string | null;
  /** The green New puzzle button, shown in the help row's left slot while the offer is up. */
  offer?: ReactNode;
  /** Takes the tray's place inside its well once the puzzle is solved: Next, or Play Level after the level card. */
  slot?: ReactNode;
  /** Practice (Level 1, ages 3 to 4, FillView only): a dropped letter goes to its own cell in any order, and a tap only says it. */
  practice?: boolean;
}

/** Smallest slot that can be a real button. Below it the answer row is a plain list. */
const MIN_BUTTON = 44;

/** Re-triggerable wiggle: the nonce goes into the React key so the animation restarts every time. */
function useWiggle() {
  const [w, setW] = useState<{ ids: string[]; n: number }>({ ids: [], n: 0 });
  const timer = useRef<number>(0);
  const wiggle = (ids: string[]) => {
    setW((p) => ({ ids, n: p.n + 1 }));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setW((p) => ({ ids: [], n: p.n })), 450);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { wiggling: (id: string) => w.ids.includes(id), nonce: w.n, wiggle };
}

/**
 * Practice: a tapped brick hops once. Each tap counts into the brick's React key, so the hop restarts on
 * every tap; its end only takes the class off and keeps the key, so a drag the child began meanwhile is
 * not cut off by a new brick under the finger.
 */
function useHop() {
  const [h, setH] = useState<{ id: string | null; taps: Record<string, number> }>({ id: null, taps: {} });
  const timer = useRef<number>(0);
  const hop = (id: string) => {
    setH((p) => ({ id, taps: { ...p.taps, [id]: (p.taps[id] ?? 0) + 1 } }));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setH((p) => ({ ...p, id: null })), 450);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { hopping: (id: string) => h.id === id, taps: (id: string) => h.taps[id] ?? 0, hop };
}

function useHint() {
  const [ids, setIds] = useState<string[]>([]);
  const timer = useRef<number>(0);
  const show = (next: string[]) => {
    setIds(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setIds([]), 2600);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { hinted: (id: string) => ids.includes(id), show, clear: () => setIds([]) };
}

/** A short message that clears itself, for "Not that one" after a wrong tap. */
function useNote() {
  const [note, setNote] = useState<string | null>(null);
  const timer = useRef<number>(0);
  const show = (text: string, ms = 1600) => {
    setNote(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNote(null), ms);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { note, show, clear: () => setNote(null) };
}

/** Physical keyboard letters, for spelling, trains and first sounds. */
function useLetterKeys(active: boolean, onKey: (k: string) => void) {
  const ref = useRef(onKey);
  ref.current = onKey;
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (/^[a-z]$/i.test(e.key)) {
        e.preventDefault();
        ref.current(e.key);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [active]);
}

/** setTimeout that is cancelled when the view unmounts (child taps Back mid-celebration). */
function useLater() {
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  return (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
}

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The flight's leg and the snap's leg, each as long as the CSS snap (letters.css lb-snap). */
const FLIGHT_MS = 280;

/**
 * Practice: the placed brick flies from where the child let go into its cell, then snaps (FLIP). The cell is
 * drawn in place first and started at the release point; screen offsets are divided by the tablet zoom,
 * because the frame is scaled with CSS zoom and a translate inside it is scaled again. The flight runs over
 * the cell's CSS snap, so the snap's leg is part of it. None under reduced motion: the brick is simply there.
 */
function fly(el: HTMLElement, at: DropAt, zoom: number) {
  if (reducedMotion() || typeof el.animate !== 'function') return;
  // The cell's list item: the cell itself is already drawn at the snap's first frame (scale 1.3).
  const r = (el.parentElement ?? el).getBoundingClientRect();
  if (!r.width) return;
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const dx = (at.x - (r.left + r.width / 2)) / z;
  const dy = (at.y - (r.top + r.height / 2)) / z;
  const ease = getComputedStyle(el).getPropertyValue('--bw-ease').trim() || 'cubic-bezier(0.16, 1, 0.3, 1)';
  el.style.zIndex = '1';
  const a = el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${at.w / r.width})`, easing: ease },
      { transform: 'scale(1.3)', offset: 0.5, easing: ease },
      { transform: 'none' },
    ],
    { duration: FLIGHT_MS * 2 },
  );
  const done = () => el.style.removeProperty('z-index');
  a.onfinish = done;
  a.oncancel = done;
}

/* ---------- Pieces ---------- */

const px = (n: number) => `${n}px`;

function slotVars(s: SlotSize): CSSProperties {
  return {
    '--sw': px(s.w),
    '--sh': px(s.h),
    '--sgap': px(s.gap),
    '--sfs': px(s.font),
    '--srad': px(s.radius),
    '--sbd': px(s.border),
  } as CSSProperties;
}

function trayVars(t: TraySize): CSSProperties {
  return {
    '--tw': px(t.w),
    '--th': px(t.h),
    '--tfs': px(t.font),
    '--trad': px(t.radius),
    '--stw': px(t.studW),
    '--sth': px(t.studH),
    '--stin': px(t.studIn),
    '--per-row': t.perRow,
    '--tgap': px(t.gap),
    '--trgap': px(t.rowGap),
  } as CSSProperties;
}

/**
 * The help line, with the hint button at its right edge and the stuck offer in the left slot. The
 * offer comes last in the markup, so it is last in the tab order, and CSS places it on the left (brief 10).
 */
function HelpRow({ text, hint, offer }: { text: string; hint: ReactNode; offer?: ReactNode }) {
  return (
    <div className="lb-helprow">
      <p className="lb-help" role="status">
        {text}
      </p>
      <span className="lb-helprow__hint">{hint}</span>
      <span className="lb-helprow__offer">{offer}</span>
    </div>
  );
}

/** The inset well the tray sits in. Once the puzzle is solved, `slot` (the Next button) takes the tray's place, centred. */
function Well({ label, slot, children }: { label?: string; slot?: ReactNode; children: ReactNode }) {
  if (slot) return <div className="lb-well lb-well--slot">{slot}</div>;
  return (
    <div className="lb-well">
      {label && <p className="lb-well__label">{label}</p>}
      <div className="lb-tray">{children}</div>
    </div>
  );
}

/** A tray tile that has been placed: it stays as a faint ghost so the others never move under a finger. */
function Ghost({ ch }: { ch: string }) {
  return <span className="lb-brick lb-brick--tile lb-ghost" data-brick="white" aria-hidden="true">{ch}</span>;
}

const rotFor = (i: number) => (i % 2 ? 3 : -3);

/* ---------- Train, missing letters, spelling ---------- */

export function FillView({ prompt: p, active, onSlip, onProgress, onDone, hintRef, hint, innerW, instruction, helpOverride, offer, slot, practice = false }: ViewProps<FillPrompt>) {
  const later = useLater();
  const { zoom } = useLayout();
  const [fill, setFill] = useState(() => newFill(p));
  const [done, setDone] = useState(false);
  const [lastPlaced, setLastPlaced] = useState(-1);
  const { wiggling, nonce, wiggle } = useWiggle();
  const bounce = useHop();
  const hinting = useHint();
  const note = useNote();
  const used = usedIds(fill);
  const next = nextCell(p, fill);
  const spelling = p.kind === 'spell' && !!p.word;
  const word = p.word?.word ?? '';
  const slotsRef = useRef<HTMLOListElement>(null);
  /** Practice: the cell a dropped brick just went into and where it was let go, for its flight after the render. */
  const flight = useRef<{ cell: number; at: DropAt } | null>(null);

  useLayoutEffect(() => {
    const f = flight.current;
    flight.current = null;
    const el = f && slotsRef.current?.children[f.cell]?.querySelector<HTMLElement>('.lb-cell');
    if (f && el) fly(el, f.at, zoom);
  });

  /** A right brick goes into cell `at`: said aloud, and the puzzle is solved when the row is full. */
  const placeIn = (state: typeof fill, at: number) => {
    setFill(state);
    setLastPlaced(at);
    hinting.clear();
    note.clear();
    sfx.tap();
    say(letterName(p.cells[at]));
    if (fillDone(p, state)) {
      setDone(true);
      // Solved on this tap: the dot fills and Next takes the tray's place. The sound and the word follow the tap.
      onDone();
      later(() => {
        sfx.good();
        if (p.word) say(p.word.word);
        else say(p.kind === 'train' ? 'Choo choo!' : 'You found them!');
      }, 650);
    } else onProgress?.();
  };

  /** Practice: any brick goes into its own cell, never wrong. A drop brings where it was let go, for the flight. */
  const placeOwnCell = (id: string, at?: DropAt) => {
    if (done || !active) return;
    const r = placeOwn(p, fill, id);
    if (r.result === 'ignored') return;
    if (at) flight.current = { cell: r.cell, at };
    placeIn(r.state, r.cell);
  };

  /** Practice: a pointer tap says the letter, nudges the brick and asks for a drag. Not a slip, not progress. */
  const sayOnly = (t: Tile) => {
    if (done || !active) return;
    say(letterName(t.ch));
    bounce.hop(t.id);
    note.show(DRAG_NOTE, 2400);
  };

  const tap = (id: string) => {
    if (practice) return placeOwnCell(id);
    if (done || !active) return;
    const r = tapFill(p, fill, id);
    if (r.result === 'ignored') return;
    if (r.result === 'wrong') {
      sfx.wrong();
      wiggle([id]);
      onSlip();
      if (spelling) {
        note.show(`Not that one. Listen again: ${word}!`);
        say(word);
      } else note.show('Not that one. Try again.');
      return;
    }
    placeIn(r.state, next);
  };

  hintRef.current = () => {
    const id = hintFill(p, fill);
    if (!id || done) return false;
    hinting.show([id]);
    return true;
  };

  useLetterKeys(active && !done, (k) => {
    const id = tileForKey(p, fill, k);
    if (id) tap(id);
  });

  const slots = slotSize(p.cells.length, innerW);
  const tray = traySize(p.tray.length, innerW);
  const placedCount = fill.placed.filter(Boolean).length;
  // Practice keeps its line up: any order goes in, so "What comes next?" would mislead.
  const help = done ? solvedLine(p) : (helpOverride ?? note.note ?? (practice || placedCount === 0 ? instruction : MID_LINE));
  const canPress = slots.w >= MIN_BUTTON;

  return (
    <div className={`lb-view lb-fill lb-fill--${p.kind}${done ? ' is-done' : ''}`} style={{ ...slotVars(slots), ...trayVars(tray), '--lb-min': px(minViewHeight(slots.h, tray)) } as CSSProperties}>
      <div className="lb-top">
        {spelling ? (
          <button type="button" className="lb-picture" aria-label={`Picture of a ${word}, tap to hear it`} onClick={() => say(word)}>
            <WordPicture word={word} emoji={p.word!.emoji} />
          </button>
        ) : (
          <div className="lb-picture lb-picture--label">
            <span>{p.label}</span>
          </div>
        )}
        <ol ref={slotsRef} className="lb-slots" data-drop="slots" aria-label="Your answer">
          {p.cells.map((ch, i) => {
            const id = fill.placed[i];
            const cls = `lb-cell${id ? ' is-placed' : ' is-given'}${i === lastPlaced ? ' is-fresh' : ''}`;
            const style = { '--i': i } as CSSProperties;
            if (p.given[i] || id) {
              return (
                <li key={i}>
                  {canPress ? (
                    <LetterBrick shape="slot" ch={ch} className={cls} style={style} label={`${ch}, say it`} onTap={() => say(letterName(ch))} />
                  ) : (
                    <StaticBrick ch={ch} className={cls} style={style} />
                  )}
                </li>
              );
            }
            return (
              <li key={i}>
                <span className={`lb-slot${i === next ? ' is-next' : ''}`}>
                  <span className="lb-sr">empty</span>
                  {p.guide && (
                    <span className="lb-slot__ghost" aria-hidden="true">
                      {ch}
                    </span>
                  )}
                  {!p.guide && p.kind === 'missing' && (
                    <span className="lb-slot__ghost" aria-hidden="true">
                      ?
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
        <HelpRow text={help} hint={hint} offer={offer} />
      </div>
      <Well slot={slot}>
        {p.tray.map((t: Tile, i) =>
          used.has(t.id) ? (
            <Ghost key={t.id} ch={t.ch} />
          ) : (
            <LetterBrick
              key={`${t.id}:${wiggling(t.id) ? nonce : 0}:${bounce.taps(t.id)}`}
              id={t.id}
              ch={t.ch}
              rot={rotFor(i)}
              className={`${wiggling(t.id) ? 'is-wiggle ' : ''}${bounce.hopping(t.id) ? 'is-bounce ' : ''}${hinting.hinted(t.id) ? 'is-hint' : ''}`}
              onTap={() => tap(t.id)}
              onPointerTap={practice ? () => sayOnly(t) : undefined}
              onDrop={practice ? (at) => placeOwnCell(t.id, at) : () => tap(t.id)}
            />
          ),
        )}
      </Well>
    </div>
  );
}

/* ---------- Big and small ---------- */

export function MatchView({ prompt: p, active, onSlip, onProgress, onDone, hintRef, hint, innerW, instruction, helpOverride, offer, slot }: ViewProps<MatchPrompt>) {
  const [s, setS] = useState(newMatch);
  const { wiggling, nonce, wiggle } = useWiggle();
  const hinting = useHint();
  const note = useNote();
  const done = matchDone(p, s);

  const tap = (side: 'upper' | 'lower', t: Tile) => {
    if (done || !active) return;
    const r = tapMatch(p, s, side, t.id);
    if (r.result === 'ignored') return;
    setS(r.state);
    if (r.result === 'select') {
      sfx.tap();
      say(letterName(t.ch));
    } else if (r.result === 'pair') {
      hinting.clear();
      note.clear();
      sfx.good();
      say(`${letterName(t.ch)}`);
      if (matchDone(p, r.state)) onDone();
      else onProgress?.();
    } else {
      sfx.wrong();
      wiggle([t.id, r.other!]);
      onSlip();
      note.show('Not a pair. Try again.');
    }
  };

  hintRef.current = () => {
    const ids = hintMatch(p, s);
    if (!ids.length || done) return false;
    hinting.show(ids);
    return true;
  };

  const size = traySize(p.upper.length, innerW, 64);
  // Once solved, Next takes the small letters' well; the matched big letters stay in view.
  const row = (side: 'upper' | 'lower', list: Tile[]) => (
    <Well label={side === 'upper' ? 'Big letters' : 'Small letters'} slot={side === 'lower' ? slot : undefined}>
      {list.map((t, i) => {
        const matched = s.matched.includes(t.ch.toUpperCase());
        const selected = s.selected?.id === t.id;
        return (
          <LetterBrick
            key={`${t.id}:${wiggling(t.id) ? nonce : 0}`}
            id={t.id}
            ch={t.ch}
            rot={rotFor(i)}
            // Small letters are neutral white so the color never gives the answer away.
            color={side === 'lower' ? 'white' : undefined}
            className={[
              matched && 'is-matched',
              selected && 'is-selected',
              wiggling(t.id) && 'is-wiggle',
              hinting.hinted(t.id) && 'is-hint',
            ]
              .filter(Boolean)
              .join(' ')}
            label={matched ? `${t.ch}, matched` : t.ch}
            onTap={() => tap(side, t)}
          />
        );
      })}
    </Well>
  );

  const pairs = s.matched.length;
  const help = done ? solvedLine(p) : (helpOverride ?? note.note ?? (pairs === 0 ? instruction : `${pairs} of ${p.letters.length} pairs found.`));

  return (
    <div className={`lb-view lb-match${done ? ' is-done' : ''}`} style={trayVars(size)}>
      <HelpRow text={help} hint={hint} offer={offer} />
      {row('upper', p.upper)}
      {row('lower', p.lower)}
    </div>
  );
}

/* ---------- First sounds ---------- */

export function SoundView({ prompt: p, active, onSlip, onDone, hintRef, hint, innerW, instruction, helpOverride, offer, slot }: ViewProps<SoundPrompt>) {
  const [done, setDone] = useState(false);
  const [tried, setTried] = useState<string[]>([]);
  const { wiggling, nonce, wiggle } = useWiggle();
  const hinting = useHint();
  const note = useNote();

  const choose = (t: Tile) => {
    if (done || !active || tried.includes(t.id)) return;
    if (checkSound(p, t.ch)) {
      setDone(true);
      hinting.clear();
      note.clear();
      sfx.good();
      say(`${letterName(t.ch)} is for ${p.word.word}`);
      onDone();
    } else {
      sfx.wrong();
      wiggle([t.id]);
      setTried((x) => [...x, t.id]);
      onSlip();
      note.show('Not that one. Try again.');
    }
  };

  hintRef.current = () => {
    const id = hintSound(p);
    if (!id || done) return false;
    hinting.show([id]);
    return true;
  };

  useLetterKeys(active && !done, (k) => {
    const t = p.options.find((o) => o.ch.toUpperCase() === k.toUpperCase());
    if (t) choose(t);
  });

  const w = p.word.word;
  const display = p.answer === p.answer.toLowerCase() ? w : w.toUpperCase();
  const tray = traySize(p.options.length, innerW, 90);
  const help = done ? solvedLine(p) : (helpOverride ?? note.note ?? instruction);

  return (
    <div className={`lb-view lb-sound${done ? ' is-done' : ''}`} style={{ ...trayVars(tray), '--lb-min': px(minViewHeight(40, tray)) } as CSSProperties}>
      <div className="lb-top">
        <button type="button" className="lb-picture" aria-label={`Picture of a ${w}, tap to hear it`} onClick={() => say(w)}>
          <WordPicture word={w} emoji={p.word.emoji} />
        </button>
        <p className="lb-word" aria-live="polite">
          {done ? (
            <>
              <span className="lb-word__first">{display[0]}</span>
              {display.slice(1)}
            </>
          ) : (
            <>
              <span className="lb-word__blank">?</span>
              {display.slice(1)}
            </>
          )}
        </p>
        <HelpRow text={help} hint={hint} offer={offer} />
      </div>
      <Well slot={slot}>
        {p.options.map((t, i) => (
          <LetterBrick
            key={`${t.id}:${wiggling(t.id) ? nonce : 0}`}
            id={t.id}
            ch={t.ch}
            rot={rotFor(i)}
            className={[
              tried.includes(t.id) && 'is-tried',
              wiggling(t.id) && 'is-wiggle',
              hinting.hinted(t.id) && 'is-hint',
              done && t.ch === p.answer && 'is-right',
            ]
              .filter(Boolean)
              .join(' ')}
            onTap={() => choose(t)}
          />
        ))}
      </Well>
    </div>
  );
}
