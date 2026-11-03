import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { letterName, say } from '../../shared/speech';
import { sfx } from '../../shared/sound';
import { LetterBrick } from './Brick';
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
  tapFill,
  tapMatch,
  tileForKey,
  usedIds,
} from './logic';

export interface ViewProps<P> {
  prompt: P;
  active: boolean;
  onSlip: () => void;
  onDone: () => void;
  /** the parent's hint button calls this; it returns false when there is nothing to point at */
  hintRef: MutableRefObject<(() => boolean) | null>;
}

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

/** Tray of bricks; used bricks leave an invisible gap so nothing jumps under a child's finger. */
function trayCols(n: number) {
  return n <= 5 ? n : Math.min(5, Math.ceil(n / 2));
}

/* ---------- Train, missing letters, spelling ---------- */

export function FillView({ prompt: p, active, onSlip, onDone, hintRef }: ViewProps<FillPrompt>) {
  const later = useLater();
  const [fill, setFill] = useState(() => newFill(p));
  const [done, setDone] = useState(false);
  const [lastPlaced, setLastPlaced] = useState(-1);
  const { wiggling, nonce, wiggle } = useWiggle();
  const hint = useHint();
  const used = usedIds(fill);
  const next = nextCell(p, fill);

  const tap = (id: string) => {
    if (done || !active) return;
    const r = tapFill(p, fill, id);
    if (r.result === 'ignored') return;
    if (r.result === 'wrong') {
      sfx.wrong();
      wiggle([id]);
      onSlip();
      return;
    }
    const at = next;
    setFill(r.state);
    setLastPlaced(at);
    hint.clear();
    sfx.tap();
    say(letterName(p.cells[at]));
    if (fillDone(p, r.state)) {
      setDone(true);
      later(() => {
        sfx.good();
        if (p.word) say(p.word.word);
        else say(p.kind === 'train' ? 'Choo choo!' : 'You found them!');
      }, 650);
      later(onDone, 2000);
    }
  };

  hintRef.current = () => {
    const id = hintFill(p, fill);
    if (!id || done) return false;
    hint.show([id]);
    return true;
  };

  useLetterKeys(active && !done, (k) => {
    const id = tileForKey(p, fill, k);
    if (id) tap(id);
  });

  const n = p.cells.length;
  const cols = trayCols(p.tray.length);

  return (
    <div className={`lb-fill lb-fill--${p.kind}${done ? ' is-done' : ''}`}>
      <div className="lb-stage">
        {p.kind === 'spell' && p.word ? (
          <button type="button" className="lb-picture" aria-label={`Say ${p.word.word}`} onClick={() => say(p.word!.word)}>
            {p.word.emoji}
          </button>
        ) : (
          <div className="lb-engine" aria-hidden="true">
            <span className="lb-engine__icon">{p.kind === 'train' ? '🚂' : '🔍'}</span>
            <span className="lb-engine__label">{p.label}</span>
          </div>
        )}
        <div className="lb-slots" data-drop="slots" style={{ '--n': n } as CSSProperties} aria-label="Answer row">
          {p.cells.map((ch, i) => {
            const id = fill.placed[i];
            if (p.given[i] || id) {
              return (
                <LetterBrick
                  key={i}
                  ch={ch}
                  className={`lb-cell${id ? ' is-placed' : ' is-given'}${i === lastPlaced ? ' is-fresh' : ''}`}
                  style={{ '--i': i } as CSSProperties}
                  label={`${ch}, say it`}
                  onTap={() => say(letterName(ch))}
                />
              );
            }
            return (
              <div key={i} className={`lb-slot lb-cell${i === next ? ' is-next' : ''}`} aria-label="empty">
                {p.guide && <span className="lb-slot__ghost">{ch}</span>}
                {!p.guide && p.kind === 'missing' && <span className="lb-slot__ghost">?</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="lb-tray" style={{ '--cols': cols } as CSSProperties}>
        {p.tray.map((t: Tile) =>
          used.has(t.id) ? (
            <span key={t.id} className="lb-brick lb-gap" aria-hidden="true" />
          ) : (
            <LetterBrick
              key={`${t.id}:${wiggling(t.id) ? nonce : 0}`}
              id={t.id}
              ch={t.ch}
              scatter
              className={`${wiggling(t.id) ? 'is-wiggle ' : ''}${hint.hinted(t.id) ? 'is-hint' : ''}`}
              onTap={() => tap(t.id)}
              onDrop={() => tap(t.id)}
            />
          ),
        )}
      </div>
    </div>
  );
}

/* ---------- Big & small ---------- */

export function MatchView({ prompt: p, active, onSlip, onDone, hintRef }: ViewProps<MatchPrompt>) {
  const later = useLater();
  const [s, setS] = useState(newMatch);
  const { wiggling, nonce, wiggle } = useWiggle();
  const hint = useHint();
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
      hint.clear();
      sfx.good();
      say(`${letterName(t.ch)}`);
      if (matchDone(p, r.state)) later(onDone, 1200);
    } else {
      sfx.wrong();
      wiggle([t.id, r.other!]);
      onSlip();
    }
  };

  hintRef.current = () => {
    const ids = hintMatch(p, s);
    if (!ids.length || done) return false;
    hint.show(ids);
    return true;
  };

  const row = (side: 'upper' | 'lower', list: Tile[]) => (
    <div className={`lb-tray lb-tray--${side}`} style={{ '--cols': trayCols(list.length) } as CSSProperties}>
      {list.map((t) => {
        const matched = s.matched.includes(t.ch.toUpperCase());
        const selected = s.selected?.id === t.id;
        return (
          <LetterBrick
            key={`${t.id}:${wiggling(t.id) ? nonce : 0}`}
            id={t.id}
            ch={t.ch}
            // Lowercase bricks are neutral white so the color never gives the answer away.
            color={side === 'lower' ? 'white' : undefined}
            className={[
              matched && 'is-matched',
              selected && 'is-selected',
              wiggling(t.id) && 'is-wiggle',
              hint.hinted(t.id) && 'is-hint',
            ]
              .filter(Boolean)
              .join(' ')}
            label={matched ? `${t.ch}, matched` : t.ch}
            onTap={() => tap(side, t)}
          />
        );
      })}
    </div>
  );

  return (
    <div className={`lb-match${done ? ' is-done' : ''}`}>
      <div className="lb-match__label">BIG</div>
      {row('upper', p.upper)}
      <div className="lb-match__label">small</div>
      {row('lower', p.lower)}
    </div>
  );
}

/* ---------- First sounds ---------- */

export function SoundView({ prompt: p, active, onSlip, onDone, hintRef }: ViewProps<SoundPrompt>) {
  const later = useLater();
  const [done, setDone] = useState(false);
  const [tried, setTried] = useState<string[]>([]);
  const { wiggling, nonce, wiggle } = useWiggle();
  const hint = useHint();

  const choose = (t: Tile) => {
    if (done || !active || tried.includes(t.id)) return;
    if (checkSound(p, t.ch)) {
      setDone(true);
      hint.clear();
      sfx.good();
      say(`${letterName(t.ch)} is for ${p.word.word}`);
      later(onDone, 2200);
    } else {
      sfx.wrong();
      wiggle([t.id]);
      setTried((x) => [...x, t.id]);
      onSlip();
    }
  };

  hintRef.current = () => {
    const id = hintSound(p);
    if (!id || done) return false;
    hint.show([id]);
    return true;
  };

  useLetterKeys(active && !done, (k) => {
    const t = p.options.find((o) => o.ch.toUpperCase() === k.toUpperCase());
    if (t) choose(t);
  });

  const w = p.word.word;
  const display = p.answer === p.answer.toLowerCase() ? w : w.toUpperCase();

  return (
    <div className={`lb-sound${done ? ' is-done' : ''}`}>
      <div className="lb-stage">
        <button type="button" className="lb-picture" aria-label={`Say ${w}`} onClick={() => say(w)}>
          {p.word.emoji}
        </button>
        <div className="lb-word" aria-live="polite">
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
        </div>
      </div>
      <div className="lb-tray lb-tray--big" style={{ '--cols': p.options.length } as CSSProperties}>
        {p.options.map((t) => (
          <LetterBrick
            key={`${t.id}:${wiggling(t.id) ? nonce : 0}`}
            id={t.id}
            ch={t.ch}
            className={[
              tried.includes(t.id) && 'is-tried',
              wiggling(t.id) && 'is-wiggle',
              hint.hinted(t.id) && 'is-hint',
              done && t.ch === p.answer && 'is-right',
            ]
              .filter(Boolean)
              .join(' ')}
            onTap={() => choose(t)}
          />
        ))}
      </div>
    </div>
  );
}
