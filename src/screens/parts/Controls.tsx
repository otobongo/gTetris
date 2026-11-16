import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { sfx } from '../../shared/sound';
import { cx } from '../../shared/ui';
import { familyPin, type FamilyPin } from '../logic/familyPin';
import { checkGateAnswer, gateQuestion, gateSpoken, holdProgress, makeGateSum, nextGateSum, pinLockLine, type Random } from '../logic/gate';
import { Glyph } from './Glyph';
import '../pin.css';

/* ---------- Field: label above, inset input (Signup, Sign in, Settings) ---------- */

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  /** 'flat' sits on the ground (#30257a, inset shadow); 'well' sits inside a panel (#1d1550). */
  surface?: 'flat' | 'well';
  /** A control inside the field on the right, such as Show password. */
  trailing?: ReactNode;
  invalid?: boolean;
  narrow?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

export function Field({ label, surface = 'flat', trailing, invalid, narrow, id, inputRef, ...input }: FieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className={cx('sc-field', narrow && 'sc-field--narrow')}>
      <label htmlFor={fieldId} className="sc-label">
        {label}
      </label>
      <div className={cx('sc-field__box', `sc-field__box--${surface}`, invalid && 'is-invalid')}>
        <input ref={inputRef} id={fieldId} className="sc-field__input" aria-invalid={invalid || undefined} {...input} />
        {trailing}
      </div>
    </div>
  );
}

/* ---------- Segmented control (Settings timer modes, Break minutes, Sticker tabs) ---------- */

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when the visible label is short ("3 to 4" becomes "Ages 3 to 4"). */
  name?: string;
}

export function Segmented<T extends string>({ options, value, onChange, label, size = 'md' }: { options: SegmentOption<T>[]; value: T; onChange: (v: T) => void; label: string; size?: 'md' | 'lg' }) {
  return (
    <div className={cx('sc-seg', size === 'lg' && 'sc-seg--lg')} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="sc-seg__item"
          aria-pressed={o.value === value}
          aria-label={o.name}
          onClick={() => {
            sfx.tap();
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Switch row (Settings "Sound and alerts") ---------- */

export function SwitchRow({ label, note, icon, checked, onChange }: { label: string; note: string; icon: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-l`}
      aria-describedby={`${id}-d`}
      className="sc-switch"
      onClick={() => {
        sfx.tap();
        onChange(!checked);
      }}
    >
      <span className="sc-switch__icon">{icon}</span>
      <span className="sc-switch__text">
        <span id={`${id}-l`} className="sc-switch__label">
          {label}
        </span>
        <span id={`${id}-d`} className="sc-switch__note">
          {note}
        </span>
      </span>
      <span className="sc-switch__state" aria-hidden="true">
        {checked ? 'On' : 'Off'}
        <span className={cx('sc-switch__track', checked && 'is-on')}>
          <span className="sc-switch__thumb" />
        </span>
      </span>
    </button>
  );
}

/* ---------- Grown-up check (Break, Settings, the level picker, Sign in and Sign up) ---------- */

/**
 * The sum (decision D1) when no family PIN is set, exactly as before; the PIN when one is (decision 14).
 * Forgot the PIN swaps to a new sum, and a right sum then shows the 10 second hold that clears the PIN.
 * `pin` is the PIN store; tests pass their own.
 */
export function GrownUpCheck({
  onPass,
  onCancel,
  intro,
  random = Math.random,
  pin = familyPin,
}: {
  onPass: () => void;
  onCancel?: () => void;
  intro?: ReactNode;
  random?: Random;
  pin?: FamilyPin;
}) {
  const [mode, setMode] = useState<'sum' | 'pin' | 'forgot' | 'hold'>(() => (pin.status().set ? 'pin' : 'sum'));
  if (mode === 'pin') return <PinCheck pin={pin} onPass={onPass} onCancel={onCancel} intro={intro} onForgot={() => setMode('forgot')} />;
  if (mode === 'forgot') return <SumCheck onPass={() => setMode('hold')} onCancel={onCancel} intro={intro} random={random} />;
  if (mode === 'hold') return <ClearPinHold pin={pin} onDone={onPass} onCancel={onCancel} />;
  return <SumCheck onPass={onPass} onCancel={onCancel} intro={intro} random={random} />;
}

/** The family PIN in one secure field. The typed PIN is read from the field at Check and never kept in state. */
function PinCheck({ pin, onPass, onCancel, intro, onForgot }: { pin: FamilyPin; onPass: () => void; onCancel?: () => void; intro?: ReactNode; onForgot: () => void }) {
  const [wrong, setWrong] = useState(false);
  const [empty, setEmpty] = useState(false);
  // Moves on once a second while the check is locked, so the line counts down and Check comes back on time.
  const [tick, setTick] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const alive = useRef(true);
  const id = useId();

  const lockedFor = pin.status().lockedForMs;
  const locked = lockedFor > 0;

  useEffect(() => {
    // Set on every mount: React's development double mount runs the cleanup once before the real mount.
    alive.current = true;
    field.current?.focus();
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!locked) return;
    const t = window.setTimeout(() => setTick((n) => n + 1), lockedFor % 1000 || 1000);
    return () => window.clearTimeout(t);
  }, [tick, locked]);

  const check = async () => {
    if (busy.current) return;
    const el = field.current;
    const typed = el?.value ?? '';
    if (el) el.value = '';
    busy.current = true;
    const result = await pin.checkPin(typed);
    busy.current = false;
    if (!alive.current) return;
    if (result === 'right') {
      sfx.tap();
      onPass();
      return;
    }
    setEmpty(result === 'empty');
    // The third wrong try in a row starts a lock: the lock line says so, in place of the error.
    setWrong(result === 'wrong' && pin.status().lockedForMs === 0);
    setTick((n) => n + 1);
    field.current?.focus();
  };

  const line = locked ? pinLockLine(lockedFor) : empty ? 'Type the PIN, then tap Check.' : '';

  return (
    <section className="sc-panel sc-gate" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="sc-panel__title">
        Grown-up check
      </h2>
      {intro}
      {wrong && !locked && (
        <p id={`${id}-err`} role="alert" className="sc-error">
          <Glyph name="alert" size={20} />
          That PIN is not right.
        </p>
      )}
      <p className="sc-body sc-gate__prompt">Enter the family PIN.</p>
      {/* noValidate: a short PIN gets this panel's own line, not the browser's pattern bubble. */}
      <form
        className="sc-gate__form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <Field
          inputRef={field}
          label="Family PIN"
          surface="well"
          narrow
          name="family-pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4}"
          autoComplete="off"
          maxLength={4}
          invalid={wrong && !locked}
          aria-describedby={wrong && !locked ? `${id}-err` : line ? `${id}-hint` : undefined}
          id={`${id}-pin`}
        />
        {/* One live region for the empty hint and the lock line, on the page from the start (see SumCheck). */}
        <p id={`${id}-hint`} role="status" className={line ? 'sc-helper sc-gate__line' : 'sc-visually-hidden'}>
          {line}
        </p>
        <div className="sc-row">
          {onCancel && (
            <button type="button" className="sc-btn sc-btn--flat sc-grow-1" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="sc-btn sc-btn--go sc-grow-2" disabled={locked}>
            Check
          </button>
        </div>
      </form>
      <button type="button" className="sc-textlink sc-self-center" onClick={onForgot}>
        Forgot the PIN?
      </button>
    </section>
  );
}

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/** How long "PIN cleared" stays on screen before the check passes. */
const CLEARED_MS = 1500;

/**
 * Forgot the PIN, after a right sum: a button that clears the PIN only when held for 10 seconds without
 * letting go (pointer, or Space or Enter). Letting go early starts it again.
 */
function ClearPinHold({ pin, onDone, onCancel }: { pin: FamilyPin; onDone: () => void; onCancel?: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const [holding, setHolding] = useState(false);
  const [released, setReleased] = useState(false);
  const [cleared, setCleared] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const startedAt = useRef<number | null>(null);
  const reduced = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const done = useRef<number | undefined>(undefined);
  const id = useId();

  useEffect(() => {
    button.current?.focus();
    return () => {
      window.clearInterval(timer.current);
      window.clearTimeout(done.current);
    };
  }, []);

  const finish = () => {
    window.clearInterval(timer.current);
    startedAt.current = null;
    setHolding(false);
    pin.clearPin('forgot');
    setCleared(true);
    done.current = window.setTimeout(onDone, CLEARED_MS);
  };
  const start = () => {
    if (cleared || startedAt.current !== null) return;
    reduced.current = prefersReducedMotion();
    startedAt.current = Date.now();
    setHolding(true);
    setReleased(false);
    setElapsed(0);
    timer.current = window.setInterval(() => {
      if (startedAt.current === null) return;
      const ms = Date.now() - startedAt.current;
      if (holdProgress(ms, false).done) finish();
      else setElapsed(ms);
    }, 100);
  };
  const end = () => {
    if (startedAt.current === null) return;
    window.clearInterval(timer.current);
    startedAt.current = null;
    setHolding(false);
    setElapsed(0);
    setReleased(true);
  };
  const isHoldKey = (e: KeyboardEvent) => e.key === 'Enter' || e.key === ' ';

  const progress = cleared ? { left: 0, fraction: 1 } : holdProgress(elapsed, reduced.current);
  const status = cleared ? 'PIN cleared. The sum check is back.' : holding ? `Keep holding: ${progress.left}` : released ? 'Keep holding for 10 seconds.' : '';
  const label = (
    <>
      <Glyph name="trash" size={22} />
      Hold to clear the PIN
    </>
  );

  return (
    <section className="sc-panel sc-gate" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="sc-panel__title">
        Grown-up check
      </h2>
      <button
        ref={button}
        type="button"
        className={cx('sc-hold sc-pin-hold', holding && 'is-holding')}
        aria-label="Hold to clear the PIN for 10 seconds"
        aria-describedby={`${id}-status`}
        aria-disabled={cleared || undefined}
        onPointerDown={start}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        onKeyDown={(e) => {
          if (!isHoldKey(e)) return;
          e.preventDefault();
          if (!e.repeat) start();
        }}
        onKeyUp={(e) => {
          if (!isHoldKey(e)) return;
          e.preventDefault();
          end();
        }}
        onBlur={end}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="sc-hold__layer" aria-hidden="true">
          {label}
        </span>
        <span className="sc-hold__layer sc-hold__layer--fill" aria-hidden="true" style={{ clipPath: `inset(0 ${100 - Math.round(progress.fraction * 1000) / 10}% 0 0)` }}>
          {label}
        </span>
      </button>
      <p id={`${id}-status`} role="status" className="sc-hold__status">
        {status}
      </p>
      {onCancel && !cleared && (
        <button type="button" className="sc-btn sc-btn--flat" onClick={onCancel}>
          Cancel
        </button>
      )}
    </section>
  );
}

/** The sum (decision D1): add two numbers. Today's check, unchanged, used when no PIN is set and by Forgot the PIN. */
function SumCheck({ onPass, onCancel, intro, random = Math.random }: { onPass: () => void; onCancel?: () => void; intro?: ReactNode; random?: Random }) {
  // A new sum every time the check opens (each mount), and a new one after each wrong answer.
  const [sum, setSum] = useState(() => makeGateSum(random));
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  // Check with nothing typed: a gentle hint, the same sum, and no wrong answer counted.
  const [empty, setEmpty] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    field.current?.focus();
  }, []);

  const check = () => {
    const result = checkGateAnswer(answer, sum);
    if (result === 'right') {
      sfx.tap();
      onPass();
      return;
    }
    if (result === 'empty') {
      setWrong(false);
      setEmpty(true);
      setAnswer('');
      field.current?.focus();
      return;
    }
    setEmpty(false);
    setWrong(true);
    setAnswer('');
    setSum((s) => nextGateSum(s, random));
    field.current?.focus();
  };

  return (
    <section className="sc-panel sc-gate" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="sc-panel__title">
        Grown-up check
      </h2>
      {intro}
      {wrong && (
        <p id={`${id}-err`} role="alert" className="sc-error">
          <Glyph name="alert" size={20} />
          That answer doesn't match. Try this new sum.
        </p>
      )}
      {/* The answer field carries the sum in words for screen readers, so this line is not read twice. */}
      <p className="sc-body sc-gate__sum" aria-hidden="true">
        {gateQuestion(sum)}
      </p>
      <form
        className="sc-gate__form"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <Field
          inputRef={field}
          label="Answer"
          surface="well"
          narrow
          name="gate-answer"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          maxLength={3}
          value={answer}
          invalid={wrong}
          aria-label={gateSpoken(sum)}
          aria-describedby={wrong ? `${id}-err` : empty ? `${id}-hint` : undefined}
          onChange={(e) => setAnswer(e.target.value)}
          id={`${id}-num`}
        />
        {/* On the page from the start, empty and out of the layout, like the Toast slot: a live region that
            arrives with its text already in it is often not read (VoiceOver especially). */}
        <p id={`${id}-hint`} role="status" className={empty ? 'sc-helper' : 'sc-visually-hidden'}>
          {empty ? 'Type the answer, then tap Check.' : ''}
        </p>
        <div className="sc-row">
          {onCancel && (
            <button type="button" className="sc-btn sc-btn--flat sc-grow-1" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="sc-btn sc-btn--go sc-grow-2">
            Check
          </button>
        </div>
      </form>
    </section>
  );
}

/* ---------- Overlay card (win card style): scrim, focus trap, Escape, focus returns ---------- */

export function Overlay({ label, onClose, children, role = 'dialog', describedBy }: { label: string; onClose: () => void; children: ReactNode; role?: 'dialog' | 'alertdialog'; describedBy?: string }) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = card.current?.querySelector<HTMLElement>('[data-autofocus]') ?? card.current?.querySelector<HTMLElement>('a[href], button:not([disabled])');
    first?.focus();
    return () => {
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !card.current) return;
    const items = Array.from(card.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input'));
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
    <div className="sc-overlay">
      <div className="sc-overlay__scrim" aria-hidden="true" onClick={onClose} />
      <div ref={card} role={role} aria-modal="true" aria-label={label} aria-describedby={describedBy} className="sc-overlay__card" onKeyDown={onKeyDown}>
        {children}
      </div>
    </div>
  );
}

/* ---------- Toast (Settings): role=status, hides itself ---------- */

export function useToast(ms = 2600): [string, (text: string) => void] {
  const [text, setText] = useState('');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [
    text,
    (t: string) => {
      setText(t);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setText(''), ms);
    },
  ];
}

export function Toast({ text }: { text: string }) {
  return (
    <div className="sc-toast-slot" role="status" aria-live="polite">
      {text && <div className="sc-toast">{text}</div>}
    </div>
  );
}
