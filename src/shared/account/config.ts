import { disabledAuth } from './disabledAuth';
import { localOnlySync } from './localOnlySync';
import type { AccountProvider, AuthService, ProviderInfo, SyncAdapter } from './types';

/** Reads a build flag: only the exact strings 'true' or '1' turn it on. */
export function parseFlag(value: unknown): boolean {
  return value === 'true' || value === '1' || value === true;
}

/** Accounts stay off unless the build sets VITE_ACCOUNTS_ENABLED=true. */
export const ACCOUNTS_ENABLED: boolean = parseFlag(import.meta.env?.VITE_ACCOUNTS_ENABLED);

/**
 * The real provider's services (for example a Supabase AuthService and SyncAdapter), set here when
 * one is written. None exists yet, so turning the flag on alone changes nothing (see pickServices).
 */
export const REGISTERED_PROVIDER: AccountProvider | null = null;

export interface PickedServices {
  auth: AuthService;
  sync: SyncAdapter;
  /** True only when a real provider is in use: the app may then promise sync and deletion on every device. */
  active: boolean;
}

/**
 * Chooses the services by the flag. Flag off: the disabled services. Flag on with a provider: that
 * provider. Flag on with no provider: fail closed, keeping the disabled services and logging a
 * console error, never throwing at app start.
 */
export function pickServices(enabled: boolean, provider: AccountProvider | null, logError: (message: string) => void = (m) => console.error(m)): PickedServices {
  if (enabled && provider) return { auth: provider.auth, sync: provider.sync, active: true };
  if (enabled) logError('Brickwise: VITE_ACCOUNTS_ENABLED is on but no provider is registered, so accounts stay off.');
  return { auth: disabledAuth, sync: localOnlySync, active: false };
}

/** Sign-in providers in the order they are planned. Labels match the Signup and Sign in boards. */
export const PROVIDERS: readonly ProviderInfo[] = [
  { id: 'email', label: 'Email', stage: 'planned-first' },
  { id: 'google', label: 'Continue with Google', stage: 'planned-first' },
  { id: 'apple', label: 'Continue with Apple', stage: 'planned-later' },
  { id: 'facebook', label: 'Continue with Facebook', stage: 'planned-later' },
];
