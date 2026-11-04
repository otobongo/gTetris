import { useState, type ReactNode } from 'react';
import { getGame, type GameId } from '../games/registry';
import { auth } from '../shared/account';
import {
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
import { go, toHref } from '../shared/router';
import { sfx } from '../shared/sound';
import { Icon, Screen, TopBar } from '../shared/ui';
import { grownUpGate } from './logic/session';
import { Notice, ProviderButtons, useAuthNotice, LegalLinks } from './parts/Account';
import { AddChild, bandText } from './parts/AddChild';
import { Avatar } from './parts/Art';
import { Overlay, Segmented, SwitchRow, Toast, useToast } from './parts/Controls';
import { Glyph } from './parts/Glyph';
import './screens.css';

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

const TOGGLES: { key: SettingKey; label: string; note: string; icon: ReactNode }[] = [
  { key: 'sound', label: 'Sounds', note: 'Taps and brick sounds', icon: <Glyph name="sounds" strokeWidth={2.2} /> },
  { key: 'music', label: 'Music', note: 'Background music in games', icon: <Glyph name="music" strokeWidth={2.2} /> },
  { key: 'voice', label: 'Voice', note: 'Reads letters and words aloud', icon: <Glyph name="voice" strokeWidth={2.2} /> },
  { key: 'alerts', label: 'Notifications', note: 'Reminders for grown-ups', icon: <Glyph name="bell" strokeWidth={2.2} /> },
];

type Confirm = { kind: 'one'; player: Player } | { kind: 'all' } | { kind: 'delete' };

/**
 * Settings for grown-ups (design/canvas/Grownups.dc.html), behind the grown-up sum check (App puts
 * it behind GrownUpOnly, like Sign in and Sign up).
 * Children, timer and daily limit, skills, sound switches, progress resets, the account panel
 * (switched off: every provider answers with the coming-soon note), help links and Delete.
 */
export default function Settings() {
  const state = useProgressState();
  const [kidId, setKidId] = useState<string | null>(state.activePlayerId ?? state.players[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [toast, showToast] = useToast();
  const [notice, report] = useAuthNotice();

  const kid = state.players.find((p) => p.id === kidId) ?? state.players[0] ?? null;


  const doConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === 'one') {
      progressStore.resetPlayerProgress(confirm.player.id);
      showToast(`${confirm.player.name}'s progress was reset on this device.`);
    } else if (confirm.kind === 'all') {
      for (const p of state.players) progressStore.resetPlayerProgress(p.id);
      showToast('Everyone starts fresh on this device.');
    } else {
      void auth.signOut();
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
    confirm?.kind === 'delete'
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
      <div className="sc-scroll">
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
                type="button"
                className="sc-chip-btn"
                aria-pressed={p.id === kid?.id}
                onClick={() => {
                  sfx.tap();
                  setKidId(p.id);
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
            <button type="button" className="sc-chip-btn sc-chip-btn--add" aria-expanded={adding} onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} strokeWidth={3} />
              Add a child
            </button>
          </div>
        </section>

        {adding && (
          <AddChild
            onCancel={() => setAdding(false)}
            onAdded={(p) => {
              setAdding(false);
              setKidId(p.id);
              showToast(`${p.name} was added. They can now pick their brick on Who's playing.`);
            }}
          />
        )}

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

        {kid && (
          <section className="sc-panel" aria-labelledby="set-progress">
            <h2 id="set-progress" className="sc-panel__title sc-panel__title--sm">
              Progress
            </h2>
            <button type="button" className="sc-btn sc-btn--outline-danger" onClick={() => setConfirm({ kind: 'one', player: kid })}>
              Reset {kid.name}'s progress
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

function KidTimer({ kid }: { kid: Player }) {
  const f = FACTOR[kid.ageBand];
  const relaxed = kid.timerMode === 'relaxed' || f === 0;
  const text =
    kid.timerMode === 'off'
      ? 'No timer at all. Stars come from moves and mistakes only.'
      : relaxed
        ? 'A gentle sand timer for fun. It never ends a game or costs a star.'
        : `Time is set by the level (harder levels get more) times ${kid.name}'s age factor (x${f}). Running out never ends the game; it only skips the speed star.`;
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
