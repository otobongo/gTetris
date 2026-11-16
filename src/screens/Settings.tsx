import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { GAMES, getGame, type GameId } from '../games/registry';
import { auth } from '../shared/account';
import {
  AGE_BANDS,
  LEGACY_KEY,
  LIMIT_MAX,
  LIMIT_MIN,
  emptyState,
  progressStore,
  totalStars,
  useProgressState,
  type AgeBand,
  type Player,
  type SettingKey,
  type TimerMode,
} from '../shared/progress';
import { go, pathFor, toHref } from '../shared/router';
import { sfx } from '../shared/sound';
import { Icon, Screen, TopBar } from '../shared/ui';
import { familyPin, isPinShape, type PinStatus } from './logic/familyPin';
import { pinClearedLine } from './logic/gate';
import { settingsRowName, settingsRowSub } from './logic/levels';
import { grownUpGate, settingsReturn } from './logic/session';
import { setScroll, takeScroll } from './logic/settingsScroll';
import { Notice, ProviderButtons, useAuthNotice, LegalLinks } from './parts/Account';
import { AddChild, BAND_LABEL, bandText } from './parts/AddChild';
import { Avatar } from './parts/Art';
import { Field, Overlay, Segmented, SwitchRow, Toast, useToast } from './parts/Controls';
import { Glyph } from './parts/Glyph';
import './screens.css';
import './pin.css';

/** Timer factor by age band (Settings board): 0 means relaxed play with no countdown. */
const FACTOR: Record<AgeBand, number> = { '3-4': 0, '5-6': 2, '7-8': 1.5, '9-10': 1 };
const LEVEL_TIMES = [
  { level: 'Easy level', base: 30 },
  { level: 'Middle level', base: 60 },
  { level: 'Hard level', base: 90 },
];
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;

/** Skill bars: the share of stars earned in the games behind each skill (games not built count as 0). */
const SKILLS: { name: string; games: GameId[]; color: string }[] = [
  { name: 'Planning (Brick Escape)', games: ['escape'], color: 'green' },
  { name: 'Shapes and space (Brick Drop)', games: ['drop'], color: 'purple' },
  { name: 'Letters and spelling', games: ['letters'], color: 'orange' },
  { name: 'Colors and shapes', games: ['mixer', 'sorter', 'pattern', 'builder'], color: 'pink' },
  { name: 'Numbers and math', games: ['numbers', 'math'], color: 'teal' },
];

function skillPercent(player: Player, games: GameId[]): number {
  let max = 0;
  let got = 0;
  for (const id of games) {
    const meta = getGame(id)?.meta;
    if (!meta) continue;
    max += meta.levelCount * 3;
    got += totalStars(player, id);
  }
  return max ? Math.round((got / max) * 100) : 0;
}
const skillNote = (p: number) => (p >= 70 ? 'Strong' : p >= 40 ? 'Growing' : p > 0 ? 'Just started' : 'Not yet');

/**
 * Decision 20: Music and Notifications are hidden until those features exist (nothing plays music or sends
 * a reminder yet). Their stored keys and defaults stay in the progress state.
 */
const TOGGLES: { key: SettingKey; label: string; note: string; icon: ReactNode }[] = [
  { key: 'sound', label: 'Sounds', note: 'Taps and brick sounds', icon: <Glyph name="sounds" strokeWidth={2.2} /> },
  { key: 'voice', label: 'Voice', note: 'Reads letters and words aloud', icon: <Glyph name="voice" strokeWidth={2.2} /> },
];

type Confirm = { kind: 'one'; player: Player } | { kind: 'all' } | { kind: 'delete' } | { kind: 'remove'; player: Player };

/**
 * Settings for grown-ups (design/canvas/Grownups.dc.html), behind the grown-up sum check (App puts
 * it behind GrownUpOnly, like Sign in and Sign up).
 * Children (each can be renamed and removed), timer and daily limit, skills, sound switches, the family
 * PIN, progress resets, the account panel (switched off: every provider answers with the coming-soon
 * note), help links and Delete.
 */
export default function Settings() {
  const state = useProgressState();
  // Coming back from the level picker shows the child whose game was open there.
  const [kidId, setKidId] = useState<string | null>(() => settingsReturn.child() ?? state.activePlayerId ?? state.players[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [toast, showToast] = useToast();
  const [notice, report] = useAuthNotice();

  const kid = state.players.find((p) => p.id === kidId) ?? state.players[0] ?? null;
  const scroller = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const chips = useRef(new Map<string, HTMLButtonElement>());
  // After Remove: the chip that takes the cursor, once the confirm card has closed (it returns focus first).
  const [focusChip, setFocusChip] = useState<string | null>(null);
  useEffect(() => {
    if (!focusChip) return;
    chips.current.get(focusChip)?.focus();
    setFocusChip(null);
  }, [focusChip]);
  // The form took the cursor when it opened; when it closes the cursor goes back to Add a child, not the page.
  const closeAdding = () => {
    addButton.current?.focus();
    setAdding(false);
  };

  // Back from a game's level picker, or Set Level N there, lands where the grown-up was (the Progress
  // row they tapped), once and without a smooth scroll. Before paint, so the top never flashes.
  useLayoutEffect(() => {
    const top = takeScroll();
    if (top !== null && scroller.current) scroller.current.scrollTop = top;
  }, []);

  // A level set for another child in the picker ends here, with its toast.
  useEffect(() => {
    const t = settingsReturn.takeToast();
    if (t) showToast(t);
  }, []);

  const doConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'one') {
      progressStore.resetPlayerProgress(confirm.player.id);
      showToast(`${confirm.player.name}'s progress was reset on this device.`);
    } else if (confirm.kind === 'all') {
      for (const p of state.players) progressStore.resetPlayerProgress(p.id);
      showToast('Everyone starts fresh on this device.');
    } else if (confirm.kind === 'remove') {
      const gone = confirm.player;
      progressStore.removePlayer(gone.id);
      const next = progressStore.getState().players[0];
      setConfirm(null);
      if (!next) {
        // The last child: the first-run form, as Delete does.
        settingsReturn.setChild(null);
        go('/players');
        return;
      }
      setKidId(next.id);
      settingsReturn.setChild(next.id);
      showToast(`${gone.name} was removed from this device.`);
      setFocusChip(next.id);
      return;
    } else {
      void auth.signOut();
      familyPin.clearPin('delete');
      try {
        window.localStorage.removeItem(LEGACY_KEY);
      } catch {
        /* storage blocked: nothing stored to remove */
      }
      progressStore.replace(emptyState());
      grownUpGate.reset();
      setConfirm(null);
      go('/players');
      return;
    }
    setConfirm(null);
  };

  const confirmCopy =
    confirm?.kind === 'remove'
      ? {
          title: `Remove ${confirm.player.name} from this device?`,
          body: "Their stars, levels and stickers go too. This can't be undone.",
          keep: `Keep ${confirm.player.name}`,
          go: 'Remove',
        }
      : confirm?.kind === 'delete'
      ? {
          title: 'Delete everything on this device?',
          body: "This removes every child and all their stars, levels and stickers from this device. It can't be undone.",
          keep: 'Keep it',
          go: 'Delete',
        }
      : {
          title: confirm?.kind === 'one' ? `Reset ${confirm.player.name}'s progress?` : "Reset every child's progress?",
          body: "Stars, levels and stickers go back to the start on this device. This can't be undone.",
          keep: 'Keep it',
          go: 'Reset',
        };

  return (
    <Screen>
      <TopBar title="Settings" subtitle="For grown-ups" back="/" backLabel="Back to home" />
      <div ref={scroller} className="sc-scroll">
        <section className="sc-panel" aria-labelledby="set-save">
          <div>
            <h2 id="set-save" className="sc-panel__title">
              Save your progress
            </h2>
            <p className="sc-sub sc-sub--small">Right now, progress is saved on this device only. Sign in to keep every child's stars and levels on all your family's devices.</p>
          </div>
          {notice && <Notice notice={notice} compact />}
          <ProviderButtons radius="sm" onResult={(provider, r) => report(provider, r)} />
          <a className="sc-textlink sc-self-center" href={toHref('/signin')}>
            Use email instead
          </a>
        </section>

        <section className="sc-stack" aria-labelledby="set-kids">
          <h2 id="set-kids" className="sc-section-label">
            Children
          </h2>
          <div className="sc-kids">
            {state.players.map((p) => (
              <button
                key={p.id}
                ref={(el) => {
                  if (el) chips.current.set(p.id, el);
                  else chips.current.delete(p.id);
                }}
                type="button"
                className="sc-chip-btn"
                aria-pressed={p.id === kid?.id}
                onClick={() => {
                  sfx.tap();
                  setKidId(p.id);
                  settingsReturn.setChild(p.id);
                  setAdding(false);
                }}
              >
                <Avatar name={p.name} color={p.color} size={36} radius={11} fontSize={19} />
                <span className="sc-chip-btn__text">
                  <span className="sc-chip-btn__name">{p.name}</span>
                  <span className="sc-chip-btn__age">{bandText(p.ageBand)}</span>
                </span>
              </button>
            ))}
            <button ref={addButton} type="button" className="sc-chip-btn sc-chip-btn--add" aria-expanded={adding} onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} strokeWidth={3} />
              Add a child
            </button>
          </div>
        </section>

        {adding && (
          <AddChild
            focusOnOpen
            onCancel={closeAdding}
            onAdded={(p, named) => {
              closeAdding();
              setKidId(p.id);
              showToast(named ? `${p.name} was added. They can now pick their brick on Who's playing.` : `${p.name} was added. You can change the name under Name.`);
            }}
          />
        )}

        {kid && <KidAge key={kid.id} kid={kid} />}
        {kid && <KidTimer kid={kid} />}
        {kid && <KidSkills kid={kid} />}

        <section className="sc-panel sc-panel--switches" aria-labelledby="set-sound">
          <h2 id="set-sound" className="sc-panel__title sc-panel__title--sm">
            Sound and alerts
          </h2>
          {TOGGLES.map((t) => (
            <SwitchRow key={t.key} label={t.label} note={t.note} icon={t.icon} checked={state.settings[t.key]} onChange={(v) => progressStore.setSetting(t.key, v)} />
          ))}
        </section>

        <PinSection onSaved={showToast} />

        {kid && (
          <section className="sc-panel" aria-labelledby="set-progress">
            <h2 id="set-progress" className="sc-panel__title sc-panel__title--sm">
              Progress
            </h2>
            <div className="sc-gamerows">
              {GAMES.filter((g) => g.playable).map((g) => (
                <a
                  key={g.id}
                  className="sc-gamerow"
                  href={toHref(pathFor({ name: 'levelPicker', game: g.id, playerId: kid.id }))}
                  aria-label={settingsRowName(g, kid)}
                  onClick={() => {
                    sfx.tap();
                    setScroll(scroller.current?.scrollTop ?? 0);
                  }}
                >
                  <span className="sc-gamerow__text">
                    <span className="sc-gamerow__name">{g.title}</span>
                    <span className="sc-gamerow__sub">{settingsRowSub(g, kid)}</span>
                  </span>
                  <span className="sc-gamerow__chev" aria-hidden="true">
                    <Icon name="chevronRight" size={20} strokeWidth={2.8} />
                  </span>
                </a>
              ))}
            </div>
            <button type="button" className="sc-btn sc-btn--outline-danger" onClick={() => setConfirm({ kind: 'one', player: kid })}>
              Reset {kid.name}'s progress
            </button>
            <button type="button" className="sc-btn sc-btn--outline-danger" onClick={() => setConfirm({ kind: 'remove', player: kid })}>
              Remove {kid.name}
            </button>
            {state.players.length > 1 && (
              <button type="button" className="sc-textlink sc-self-center" onClick={() => setConfirm({ kind: 'all' })}>
                Reset every child's progress
              </button>
            )}
          </section>
        )}

        <div className="sc-settings__foot">
          <LegalLinks separators={false} />
          <button type="button" className="sc-textlink sc-textlink--danger" onClick={() => setConfirm({ kind: 'delete' })}>
            <Glyph name="trash" size={18} />
            Delete my account
          </button>
        </div>
      </div>

      <Toast text={toast} />

      {confirm && (
        <Overlay role="alertdialog" label={confirmCopy.title} describedBy="set-confirm-body" onClose={() => setConfirm(null)}>
          <h2 className="sc-overlay__title">{confirmCopy.title}</h2>
          <p id="set-confirm-body" className="sc-sub">
            {confirmCopy.body}
          </p>
          <div className="sc-overlay__actions">
            <button type="button" className="sc-btn sc-btn--flat sc-btn--md" data-autofocus onClick={() => setConfirm(null)}>
              {confirmCopy.keep}
            </button>
            <button type="button" className="sc-btn sc-btn--danger sc-btn--md" onClick={doConfirm}>
              {confirmCopy.go}
            </button>
          </div>
        </Overlay>
      )}
    </Screen>
  );
}

/**
 * The child's name (decision 15) and age band (user decision D2). The name saves when the field is left or on
 * Enter, through the same cleaning as Add a child (trimmed, single spaces, 24 letters at most); an empty
 * name puts the saved one back. A new band applies from the next puzzle in every game: the puzzle on screen
 * keeps its clock, and solved puzzles stay solved. Settings keys this panel by child, so the field starts
 * from each child's own name.
 */
function KidAge({ kid }: { kid: Player }) {
  const [draft, setDraft] = useState(kid.name);
  // A rename from another tab shows here too.
  useEffect(() => setDraft(kid.name), [kid.name]);
  const commit = () => {
    const name = draft.replace(/\s+/g, ' ').trim();
    if (!name) {
      setDraft(kid.name);
      return;
    }
    setDraft(name);
    // Naming a player also clears its "unnamed" mark (the store does it with any real name).
    if (name !== kid.name) progressStore.updatePlayer(kid.id, { name });
  };
  return (
    <section className="sc-panel" aria-labelledby="set-age">
      <h2 id="set-age" className="sc-panel__title sc-panel__title--sm">
        {kid.name}'s age
      </h2>
      <Field
        label="Name"
        surface="well"
        name="child-rename"
        autoComplete="off"
        autoCapitalize="words"
        maxLength={24}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          commit();
        }}
      />
      <span className="sc-label">Age</span>
      <Segmented<AgeBand>
        label={`${kid.name}'s age`}
        value={kid.ageBand}
        onChange={(v) => progressStore.updatePlayer(kid.id, { ageBand: v })}
        options={AGE_BANDS.map((b) => ({ value: b, label: BAND_LABEL[b], name: bandText(b) }))}
      />
      <p className="sc-sub sc-sub--small">A new age applies from the next puzzle. Solved puzzles stay solved.</p>
    </section>
  );
}

type PinError = 'shape' | 'match' | 'save';
const PIN_ERRORS: Record<PinError, string> = { shape: 'Use 4 numbers.', match: 'The two PINs are not the same.', save: "This device didn't save the PIN. Try again." };

/**
 * The family PIN (decision 14): off, the set or change form, or on. A PIN replaces the sum on every grown-up
 * check; only its salted hash is stored (logic/familyPin.ts). The two fields are not React state: Save reads
 * them and empties them, so the PIN is never kept after it is saved.
 */
function PinSection({ onSaved }: { onSaved: (text: string) => void }) {
  const [status, setStatus] = useState<PinStatus>(() => familyPin.status());
  const [missing] = useState(() => familyPin.unavailable());
  const [form, setForm] = useState<{ error: PinError | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [focus, setFocus] = useState<'set' | 'change' | 'first' | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const second = useRef<HTMLInputElement>(null);
  const setButton = useRef<HTMLButtonElement>(null);
  const changeButton = useRef<HTMLButtonElement>(null);

  // Focus follows the section as it changes shape (after the confirm card has returned focus, so this wins).
  useEffect(() => {
    if (!focus) return;
    (focus === 'set' ? setButton : focus === 'change' ? changeButton : first).current?.focus();
    setFocus(null);
  }, [focus]);

  const open = () => {
    setForm({ error: null });
    setFocus('first');
  };
  const close = () => {
    setForm(null);
    setFocus(status.set ? 'change' : 'set');
  };
  const save = async () => {
    if (saving) return;
    const a = first.current?.value ?? '';
    const b = second.current?.value ?? '';
    if (!isPinShape(a)) {
      setForm({ error: 'shape' });
      first.current?.focus();
      return;
    }
    if (a !== b) {
      setForm({ error: 'match' });
      if (second.current) second.current.value = '';
      second.current?.focus();
      return;
    }
    setSaving(true);
    const ok = await familyPin.setPin(a);
    if (first.current) first.current.value = '';
    if (second.current) second.current.value = '';
    setSaving(false);
    if (!ok) {
      setForm({ error: 'save' });
      first.current?.focus();
      return;
    }
    setForm(null);
    setStatus(familyPin.status());
    onSaved('The PIN is on. Keep it somewhere safe.');
    setFocus('change');
  };
  const turnOff = () => {
    familyPin.clearPin('off');
    setStatus(familyPin.status());
    setAsking(false);
    setFocus('set');
  };

  const error = form?.error ?? null;
  const pinField = { surface: 'well', narrow: true, type: 'password', inputMode: 'numeric', pattern: '[0-9]{4}', autoComplete: 'off', maxLength: 4 } as const;

  return (
    <section className="sc-panel" aria-labelledby="set-pin">
      <h2 id="set-pin" className="sc-panel__title sc-panel__title--sm">
        Grown-up PIN
      </h2>
      {missing ? (
        <p className="sc-sub sc-sub--small sc-pin__note">{missing === 'secure' ? 'A PIN needs a secure connection.' : "This browser can't save a PIN."}</p>
      ) : form ? (
        <form
          className="sc-pin__form"
          aria-label={status.set ? 'Change PIN' : 'Set a PIN'}
          // The section's own errors ("Use 4 numbers.") replace the browser's pattern bubble.
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="sc-pin__fields">
            <Field {...pinField} inputRef={first} label="New PIN" name="new-pin" invalid={error === 'shape' || error === 'save'} aria-describedby={error ? 'set-pin-error' : undefined} />
            <Field {...pinField} inputRef={second} label="Type it again" name="new-pin-again" invalid={error === 'match'} aria-describedby={error ? 'set-pin-error' : undefined} />
          </div>
          {error && (
            <p id="set-pin-error" role="alert" className="sc-error">
              <Glyph name="alert" size={20} />
              {PIN_ERRORS[error]}
            </p>
          )}
          <div className="sc-row">
            <button type="button" className="sc-btn sc-btn--flat sc-grow-1" onClick={close}>
              Cancel
            </button>
            <button type="submit" className="sc-btn sc-btn--go sc-grow-2" disabled={saving}>
              Save
            </button>
          </div>
        </form>
      ) : status.set ? (
        <>
          <p className="sc-sub sc-sub--small sc-pin__note">The PIN is on.</p>
          <div className="sc-row sc-pin__actions">
            <button ref={changeButton} type="button" className="sc-btn sc-btn--flat" onClick={open}>
              Change PIN
            </button>
            <button type="button" className="sc-btn sc-btn--outline-danger" onClick={() => setAsking(true)}>
              Turn off PIN
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="sc-sub sc-sub--small sc-pin__note">Ask for a PIN instead of the sum before Settings, levels and more play time.</p>
          {status.clearedAt !== null && <p className="sc-sub sc-sub--small sc-pin__note">{pinClearedLine(status.clearedAt)}</p>}
          <button ref={setButton} type="button" className="sc-btn sc-btn--flat sc-pin__set" onClick={open}>
            Set a PIN
          </button>
        </>
      )}

      {asking && (
        <Overlay role="alertdialog" label="Turn off the PIN?" describedBy="set-pin-off-body" onClose={() => setAsking(false)}>
          <h2 className="sc-overlay__title">Turn off the PIN?</h2>
          <p id="set-pin-off-body" className="sc-sub">
            The sum check comes back.
          </p>
          <div className="sc-overlay__actions">
            <button type="button" className="sc-btn sc-btn--flat sc-btn--md" data-autofocus onClick={() => setAsking(false)}>
              Keep it
            </button>
            <button type="button" className="sc-btn sc-btn--danger sc-btn--md" onClick={turnOff}>
              Turn off
            </button>
          </div>
        </Overlay>
      )}
    </section>
  );
}

function KidTimer({ kid }: { kid: Player }) {
  const f = FACTOR[kid.ageBand];
  const relaxed = kid.timerMode === 'relaxed' || f === 0;
  const text =
    kid.timerMode === 'off'
      ? 'No timer at all. Stars come from moves and mistakes only.'
      : relaxed
        ? 'A gentle sand timer for fun. It never ends a game or costs a star.'
        : `Time is set by the level (harder levels get more) times ${kid.name}'s age factor (x${f}). Running out never ends the game. The level can then get at most 2 stars.`;
  const setLimit = (m: number) => progressStore.updatePlayer(kid.id, { dailyLimit: Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, m)) });

  return (
    <section className="sc-panel" aria-labelledby="set-timer">
      <h2 id="set-timer" className="sc-panel__title sc-panel__title--sm">
        {kid.name}'s game timer
      </h2>
      <Segmented<TimerMode>
        label={`${kid.name}'s game timer`}
        value={kid.timerMode}
        onChange={(v) => progressStore.updatePlayer(kid.id, { timerMode: v })}
        options={[
          { value: 'auto', label: 'Auto by age' },
          { value: 'relaxed', label: 'Relaxed' },
          { value: 'off', label: 'Off' },
        ]}
      />
      <p className="sc-sub sc-sub--small">{text}</p>
      <p className="sc-sub sc-sub--small">Only Brick Escape and Brick Drop use this timer.</p>
      <div className="sc-times">
        {LEVEL_TIMES.map((l) => {
          const timed = kid.timerMode === 'auto' && f > 0;
          return (
            <div key={l.level} className="sc-time">
              <div className="sc-time__level">{l.level}</div>
              <div className={timed ? 'sc-time__value' : 'sc-time__value is-off'}>{timed ? fmt(l.base * f) : kid.timerMode === 'off' ? 'Off' : 'Relaxed'}</div>
            </div>
          );
        })}
      </div>
      <div className="sc-limit">
        <span className="sc-limit__text">
          <span className="sc-limit__title" id="set-limit">
            Daily play limit
          </span>
          <span className="sc-helper">Then a friendly break screen</span>
        </span>
        <button type="button" className="sc-btn sc-btn--flat sc-step" aria-label="Less time" disabled={kid.dailyLimit <= LIMIT_MIN} onClick={() => setLimit(kid.dailyLimit - 5)}>
          <Glyph name="minus" size={22} strokeWidth={3} />
        </button>
        <span className="sc-limit__value" aria-live="polite" aria-describedby="set-limit">
          {kid.dailyLimit} min
        </span>
        <button type="button" className="sc-btn sc-btn--flat sc-step" aria-label="More time" disabled={kid.dailyLimit >= LIMIT_MAX} onClick={() => setLimit(kid.dailyLimit + 5)}>
          <Icon name="plus" size={22} strokeWidth={3} />
        </button>
      </div>
    </section>
  );
}

function KidSkills({ kid }: { kid: Player }) {
  const stars = totalStars(kid);
  return (
    <section className="sc-panel" aria-labelledby="set-skills">
      <div className="sc-panel__head">
        <h2 id="set-skills" className="sc-panel__title sc-panel__title--sm">
          {kid.name}'s skills
        </h2>
        <span className="sc-accent-text">
          {stars} {stars === 1 ? 'star' : 'stars'}
        </span>
      </div>
      {SKILLS.map((s) => {
        const pct = skillPercent(kid, s.games);
        return (
          <div key={s.name} className="sc-skill">
            <div className="sc-skill__row">
              <span>{s.name}</span>
              <span className="sc-skill__note">{skillNote(pct)}</span>
            </div>
            <div className="sc-bar" aria-hidden="true">
              <div className="sc-bar__fill" data-brick={s.color} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
