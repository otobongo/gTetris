/** Accounts, switched off: interfaces plus the do-nothing implementations used today. See docs/accounts.md. */
export * from './types';
export { ACCOUNTS_ENABLED, PROVIDERS, parseFlag } from './config';
export { disabledAuth } from './disabledAuth';
export { localOnlySync } from './localOnlySync';
export { mergeProgress, mergeSnapshot, toSnapshot } from './merge';

import { disabledAuth } from './disabledAuth';
import { localOnlySync } from './localOnlySync';
import type { AuthService, SyncAdapter } from './types';

/** The services the app uses. A provider replaces these two when ACCOUNTS_ENABLED is on. */
export const auth: AuthService = disabledAuth;
export const sync: SyncAdapter = localOnlySync;
