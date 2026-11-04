import { useState } from 'react';
import { auth } from '../shared/account';
import { useProgressState } from '../shared/progress';
import { toHref } from '../shared/router';
import { IconButton, PressButton, Screen } from '../shared/ui';
import { backTarget } from './logic/session';
import { LegalLinks, Notice, OrDivider, ProviderButtons, useAuthNotice } from './parts/Account';
import { Avatar, Wordmark } from './parts/Art';
import { Field } from './parts/Controls';
import './screens.css';

type View = 'form' | 'reset' | 'resetSent' | 'done';

/** Top row of the account screens: back, the wordmark, an empty slot. */
export function AuthTop({ back, backLabel, onBack }: { back?: string; backLabel: string; onBack?: () => void }) {
  return (
    <div className="sc-auth__top">
      {onBack ? <IconButton icon="back" label={backLabel} onClick={onBack} /> : <IconButton icon="back" label={backLabel} href={toHref(back ?? '/')} />}
      <Wordmark />
      <span aria-hidden="true" />
    </div>
  );
}

/**
 * Sign in (design/canvas/Signin.dc.html, brief 3.1), wired to the AuthService. While accounts
 * are switched off every button answers with the calm coming-soon note, and Back always leads
 * out, so a child is never stuck here.
 */
export default function Signin() {
  const { players } = useProgressState();
  const [view, setView] = useState<View>('form');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [where, setWhere] = useState<'provider' | 'email'>('provider');
  const [notice, report, clear] = useAuthNotice();
  const back = backTarget(['/signup', '/settings', '/help'], '/settings');
  const backLabel = back === '/signup' ? 'Back to sign up' : back === '/help' ? 'Back to support' : 'Back to settings';

  const signIn = async () => {
    if (busy) return;
    setBusy(true);
    setWhere('email');
    const r = await auth.signInWithEmail(email.trim(), pw);
    setBusy(false);
    if (report('email', r)) setView('done');
  };

  const sendReset = async () => {
    setWhere('email');
    const r = await auth.sendEmailLink(email.trim());
    if (report('email', r)) setView('resetSent');
  };

  const toForm = () => {
    clear();
    setView('form');
  };

  const wrongCreds = notice?.title.startsWith('That email');
  const emailNotice = notice && where === 'email' ? notice : null;

  return (
    <Screen padding="roomy" gap={14}>
      {view === 'form' ? <AuthTop back={back} backLabel={backLabel} /> : <AuthTop backLabel="Back to sign in" onBack={toForm} />}

      {view === 'form' && (
        <form
          className="sc-auth__body"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void signIn();
          }}
        >
          <div className="sc-auth__head">
            <h1>Welcome back</h1>
            <p>Sign in to your family account. Your children's stars, levels and stickers come with you.</p>
          </div>

          {notice && where === 'provider' && <Notice notice={notice} />}
          <ProviderButtons
            onResult={(provider, r) => {
              setWhere('provider');
              if (report(provider, r)) setView('done');
            }}
          />
          <OrDivider />

          <Field label="Email" name="email" type="email" autoComplete="email" autoCapitalize="off" spellCheck={false} placeholder="you@example.com" value={email} invalid={wrongCreds} onChange={(e) => setEmail(e.target.value)} />
          <Field
            label="Password"
            name="password"
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            value={pw}
            invalid={wrongCreds}
            aria-describedby={emailNotice ? 'si-note' : undefined}
            onChange={(e) => setPw(e.target.value)}
            trailing={
              <button type="button" className="sc-field__toggle" aria-pressed={showPw} aria-label={`${showPw ? 'Hide' : 'Show'} password`} onClick={() => setShowPw((v) => !v)}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            }
          />
          {emailNotice && (
            <div id="si-note">
              <Notice notice={emailNotice} compact />
            </div>
          )}
          <button
            type="button"
            className="sc-textlink sc-forgot"
            onClick={() => {
              clear();
              setView('reset');
            }}
          >
            Forgot password?
          </button>

          <div className="sc-spacer" />
          <PressButton type="submit" variant="green" size="lg" block loading={busy} loadingLabel="Signing in…">
            Sign in
          </PressButton>

          <div className="sc-auth__foot">
            <div className="sc-auth__new">
              <span>New here?</span>
              <a className="sc-link" href={toHref('/signup')}>
                Create a family account
              </a>
            </div>
            <LegalLinks />
          </div>
        </form>
      )}

      {view === 'reset' && (
        <form
          className="sc-auth__body"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void sendReset();
          }}
        >
          <div className="sc-auth__head">
            <h1>Reset your password</h1>
          </div>
          <Field label="Email" name="email" type="email" autoComplete="email" autoCapitalize="off" spellCheck={false} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          {notice && <Notice notice={notice} compact />}
          <div className="sc-spacer" />
          <PressButton type="submit" variant="green" size="lg" block>
            Send reset link
          </PressButton>
          <button type="button" className="sc-textlink sc-self-center" onClick={toForm}>
            Back to sign in
          </button>
        </form>
      )}

      {view === 'resetSent' && (
        <div className="sc-auth__body">
          <h1 className="sc-auth__h1 sc-center">Check your email</h1>
          <div role="status" className="sc-notice">
            <span className="sc-notice__title sc-wrap">If {email.trim() || 'your email'} has a family account, a reset link is on its way.</span>
          </div>
          <div className="sc-spacer" />
          <PressButton variant="green" size="lg" block onClick={toForm}>
            Back to sign in
          </PressButton>
        </div>
      )}

      {view === 'done' && (
        <div className="sc-auth__body sc-center">
          <h1 className="sc-auth__h1 sc-auth__h1--big">You're signed in</h1>
          <p role="status" className="sc-body sc-body--soft">
            {players.length ? `${players.map((p) => p.name).join(' and ')} ${players.length === 1 ? 'is' : 'are'} ready on this device.` : 'Your family account has no children yet.'}
          </p>
          {players.length > 0 && (
            <div className="sc-kidrow">
              {players.map((p) => (
                <span key={p.id} className="sc-kidrow__item">
                  <Avatar name={p.name} color={p.color} size={64} radius={20} fontSize={30} />
                  {p.name}
                </span>
              ))}
            </div>
          )}
          <div className="sc-spacer" />
          <PressButton variant="green" size="lg" block href={toHref(players.length ? '/players' : '/settings')}>
            {players.length ? 'Start playing' : 'Add a child'}
          </PressButton>
        </div>
      )}
    </Screen>
  );
}
