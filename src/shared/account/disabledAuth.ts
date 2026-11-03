import type { AuthService, Result } from './types';

const off = <T>(): Promise<Result<T>> => Promise.resolve({ ok: false, reason: 'not-enabled' });

/** The AuthService used while accounts are switched off: every call resolves to { ok: false, reason: 'not-enabled' }. */
export const disabledAuth: AuthService = {
  signInWithEmail: () => off(),
  sendEmailLink: () => off(),
  signInWithGoogle: () => off(),
  signInWithApple: () => off(),
  signInWithFacebook: () => off(),
  signOut: () => off(),
  currentUser: () => off(),
  onChange: () => () => {},
};
