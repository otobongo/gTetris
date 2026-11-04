import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { sfx } from '../../shared/sound';
import { cx } from '../../shared/ui';
import { gateMatches, gateQuestion, gateSpoken, makeGateSum, nextGateSum, type Random } from '../logic/gate';
import { Glyph } from './Glyph';

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

/* ---------- Grown-up check: add two numbers (Break and Settings, decision D1) ---------- */

export function GrownUpCheck({ onPass, onCancel, intro, random = Math.random }: { onPass: () => void; onCancel?: () => void; intro?: ReactNode; random?: Random }) {
  // A new sum every time the check opens (each mount), and a new one after each wrong answer.
  const [sum, setSum] = useState(() => makeGateSum(random));
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    field.current?.focus();
  }, []);

  const check = () => {
    if (gateMatches(answer, sum)) {
      sfx.tap();
      onPass();
      return;
    }
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
          aria-describedby={wrong ? `${id}-err` : undefined}
          onChange={(e) => setAnswer(e.target.value)}
          id={`${id}-num`}
        />
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
