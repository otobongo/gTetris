import { useState } from 'react';
import { auth } from '../shared/account';
import { progressStore, useProgressState } from '../shared/progress';
import { toHref } from '../shared/router';
import { PressButton, Screen } from '../shared/ui';
import { backTarget } from './logic/session';
import { Notice, OrDivider, ProviderButtons, useAuthNotice } from './parts/Account';
import { AddChild } from './parts/AddChild';
import { Avatar } from './parts/Art';
import { Field } from './parts/Controls';
import { Glyph } from './parts/Glyph';
import { AuthTop } from './Signin';
import './screens.css';

type Step = 0 | 1 | 2;

/**
 * Sign up (design/canvas/Signup.dc.html): family account, then children, then done. Wired to the
 * AuthService; while accounts are switched off every button shows the coming-soon note and the
 * steps after the first are not reached.
 */
export default function Signup() {
  const { players } = useProgressState();
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [adult, setAdult] = useState(false);
  const [needAdult, setNeedAdult] = useState(false);
  const [where, setWhere] = useState<'provider' | 'email'>('provider');
  const [notice, report] = useAuthNotice();
  const back = backTarget(['/settings', '/signin', '/help'], '/settings');
  const backLabel = back === '/signin' ? 'Back to sign in' : back === '/help' ? 'Back to support' : 'Back to settings';

  const create = async () => {
    if (!adult) {
      setNeedAdult(true);
      return;
    }
    setWhere('email');
    // AuthService has no separate sign-up call yet: an email link creates the account (see open issues).
    if (report('email', await auth.sendEmailLink(email.trim()))) setStep(1);
  };

  return (
    <Screen padding="roomy" gap={14}>
      <AuthTop back={back} backLabel={backLabel} />
      <div className="sc-steps" role="img" aria-label={`Step ${step + 1} of 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={i <= step ? 'is-on' : undefined} />
        ))}
      </div>

      {step === 0 && (
        <form
          className="sc-auth__body"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <div className="sc-auth__head">
            <h1>Create your family account</h1>
            <p>For a parent or guardian. Kids never need a password.</p>
          </div>
          {notice && where === 'provider' && <Notice notice={notice} />}
          <ProviderButtons
            onResult={(provider, r) => {
              setWhere('provider');
              if (report(provider, r)) setStep(1);
            }}
          />
          <OrDivider />
          <Field label="Your name" name="name" autoComplete="given-name" placeholder="Sam" value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Email" name="email" type="email" autoComplete="email" autoCapitalize="off" spellCheck={false} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Field label="Password" name="new-password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={pw} onChange={(e) => setPw(e.target.value)} />
          <label className="sc-check">
            <input
              type="checkbox"
              checked={adult}
              aria-describedby={needAdult && !adult ? 'su-adult' : undefined}
              onChange={(e) => {
                setAdult(e.target.checked);
                setNeedAdult(false);
              }}
            />
            I am a parent or guardian, 18 or older, and I agree to the Terms of use and Privacy policy.
          </label>
          <div className="sc-check__links">
            <a className="sc-textlink" href={toHref('/help/terms')}>
              Terms of use
            </a>
            <a className="sc-textlink" href={toHref('/help/privacy')}>
              Privacy policy
            </a>
          </div>
          {needAdult && !adult && (
            <p id="su-adult" role="alert" className="sc-error">
              <Glyph name="alert" size={20} />
              Tick the box above to create the account.
            </p>
          )}
          {notice && where === 'email' && <Notice notice={notice} compact />}
          <div className="sc-spacer" />
          <PressButton type="submit" variant="green" size="lg" block>
            Create account
          </PressButton>
          <p className="sc-auth__new">
            Already have one?
            <a className="sc-link" href={toHref('/signin')}>
              Sign in
            </a>
            and your children's progress appears.
          </p>
        </form>
      )}

      {step === 1 && (
        <div className="sc-auth__body">
          <div className="sc-auth__head">
            <h1>Add your children</h1>
            <p>Each child gets their own stars, levels and timer.</p>
          </div>
          <div className="sc-kidtags">
            {players.map((p) => (
              <span key={p.id} className="sc-kidtag">
                <Avatar name={p.name} color={p.color} size={34} radius={10} fontSize={18} />
                {p.name}
              </span>
            ))}
          </div>
          <AddChild onAdded={() => undefined} />
          <div className="sc-spacer" />
          <PressButton variant="green" size="lg" block disabled={players.length === 0} onClick={() => setStep(2)}>
            Continue
          </PressButton>
        </div>
      )}

      {step === 2 && (
        <div className="sc-auth__body sc-center">
          <h1 className="sc-auth__h1 sc-auth__h1--big">You're all set{name.trim() ? `, ${name.trim()}` : ''}!</h1>
          <p className="sc-body sc-body--soft">Hand the device to your child. They tap their brick to start, no password needed.</p>
          <div className="sc-notice">
            <span className="sc-devices">
              <Glyph name="devices" size={40} strokeWidth={2} />
            </span>
            <span className="sc-notice__text">
              <span className="sc-notice__title">More than one device?</span>
              <span className="sc-notice__body">Sign in with {email.trim() || 'your family email'} on each one. Every child's stars, levels and stickers stay in sync.</span>
            </span>
          </div>
          <div className="sc-kidrow">
            {players.map((p) => (
              <span key={p.id} className="sc-kidrow__item">
                <Avatar name={p.name} color={p.color} size={64} radius={20} fontSize={30} />
                {p.name}
              </span>
            ))}
          </div>
          <div className="sc-spacer" />
          <PressButton
            variant="green"
            size="lg"
            block
            href={toHref('/players')}
            onClick={() => {
              if (!progressStore.getState().activePlayerId && players[0]) progressStore.setActivePlayer(players[0].id);
            }}
          >
            Start playing
          </PressButton>
        </div>
      )}
    </Screen>
  );
}
