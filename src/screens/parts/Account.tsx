import { useState } from 'react';
import { auth, type AuthUser, type ProviderId, type Result } from '../../shared/account';
import { toHref } from '../../shared/router';
import { sfx } from '../../shared/sound';
import { cx } from '../../shared/ui';
import { authNotice, type AuthNotice } from '../logic/auth';
import { Glyph } from './Glyph';

/* Brand marks for the sign-in buttons, as the Signup and Settings boards draw them. */
const APPLE =
  'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';
const FACEBOOK = 'M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z';

function Mark({ provider }: { provider: Exclude<ProviderId, 'email'> }) {
  if (provider === 'apple')
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d={APPLE} />
      </svg>
    );
  if (provider === 'facebook')
    return (
      <svg width="20" height="20" viewBox="-96 0 512 512" aria-hidden="true">
        <path fill="currentColor" d={FACEBOOK} />
      </svg>
    );
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

const PROVIDERS = [
  { id: 'apple', label: 'Continue with Apple', call: () => auth.signInWithApple() },
  { id: 'google', label: 'Continue with Google', call: () => auth.signInWithGoogle() },
  { id: 'facebook', label: 'Continue with Facebook', call: () => auth.signInWithFacebook() },
] as const;

/**
 * Apple, Google and Facebook buttons. Each calls the AuthService and reports the result. `start`
 * wraps the call (Sign up runs it only once the grown-up box is ticked); a null result reports nothing.
 */
export function ProviderButtons({
  onResult,
  start,
  busy,
  radius = 'md',
}: {
  onResult: (provider: ProviderId, r: Result<AuthUser>) => void;
  start?: (provider: ProviderId, run: () => Promise<Result<AuthUser>>) => Promise<Result<AuthUser> | null>;
  busy?: ProviderId | null;
  radius?: 'md' | 'sm';
}) {
  return (
    <>
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          className={cx('sc-provider', `sc-provider--${p.id}`, radius === 'sm' && 'sc-provider--sm')}
          aria-busy={busy === p.id || undefined}
          onClick={async () => {
            sfx.tap();
            const r = start ? await start(p.id, p.call) : await p.call();
            if (r) onResult(p.id, r);
          }}
        >
          <Mark provider={p.id} />
          {p.label}
        </button>
      ))}
    </>
  );
}

export function OrDivider() {
  return (
    <div className="sc-divider">
      <span aria-hidden="true" />
      or use email
      <span aria-hidden="true" />
    </div>
  );
}

/** Inline result line or panel. Errors are alerts; the coming-soon note and offline are status. */
export function Notice({ notice, compact }: { notice: AuthNotice; compact?: boolean }) {
  const error = notice.tone === 'error';
  return (
    <div role={error ? 'alert' : 'status'} className={cx('sc-notice', error && 'sc-notice--error', compact && 'sc-notice--compact')}>
      <Glyph name={notice.tone === 'info' && notice.title.startsWith('No internet') ? 'offline' : 'alert'} size={22} />
      <span className="sc-notice__text">
        <span className="sc-notice__title">{notice.title}</span>
        <span className="sc-notice__body">{notice.body}</span>
      </span>
    </div>
  );
}

/** Keeps the latest AuthService answer as a notice; null after a success. */
export function useAuthNotice(): [AuthNotice | null, <T>(provider: ProviderId, r: Result<T>) => boolean, () => void] {
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const report = <T,>(provider: ProviderId, r: Result<T>) => {
    if (r.ok) {
      setNotice(null);
      return true;
    }
    setNotice(authNotice(r.reason, provider));
    return false;
  };
  return [notice, report, () => setNotice(null)];
}

/** Support · Terms · Privacy (Sign in, Settings). */
export function LegalLinks({ separators = true }: { separators?: boolean }) {
  const links = [
    { href: '/help', label: 'Support' },
    { href: '/help/terms', label: 'Terms' },
    { href: '/help/privacy', label: 'Privacy' },
  ];
  return (
    <nav aria-label="Help and legal" className="sc-legal">
      {links.map((l, i) => (
        <span key={l.href} className="sc-legal__item">
          {separators && i > 0 && (
            <span aria-hidden="true" className="sc-legal__dot">
              ·
            </span>
          )}
          <a className="sc-textlink" href={toHref(l.href)}>
            {l.label}
          </a>
        </span>
      ))}
    </nav>
  );
}
