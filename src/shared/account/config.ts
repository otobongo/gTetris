import type { ProviderInfo } from './types';

/** Reads a build flag: only the exact strings 'true' or '1' turn it on. */
export function parseFlag(value: unknown): boolean {
  return value === 'true' || value === '1' || value === true;
}

/** Accounts stay off unless the build sets VITE_ACCOUNTS_ENABLED=true. */
export const ACCOUNTS_ENABLED: boolean = parseFlag(import.meta.env?.VITE_ACCOUNTS_ENABLED);

/** Sign-in providers in the order they are planned. Labels match the Signup and Sign in boards. */
export const PROVIDERS: readonly ProviderInfo[] = [
  { id: 'email', label: 'Email', stage: 'planned-first' },
  { id: 'google', label: 'Continue with Google', stage: 'planned-first' },
  { id: 'apple', label: 'Continue with Apple', stage: 'planned-later' },
  { id: 'facebook', label: 'Continue with Facebook', stage: 'planned-later' },
];
