/** Accounts: interfaces, the do-nothing implementations used today, and the services picked by the flag. See docs/accounts.md. */
export * from './types';
export { ACCOUNTS_ENABLED, PROVIDERS, REGISTERED_PROVIDER, parseFlag, pickServices, type PickedServices } from './config';
export { disabledAuth } from './disabledAuth';
export { localOnlySync } from './localOnlySync';
export { mergeProgress, mergeSnapshot, toSnapshot } from './merge';

import { ACCOUNTS_ENABLED, REGISTERED_PROVIDER, pickServices } from './config';
import type { AuthService, SyncAdapter } from './types';

const picked = pickServices(ACCOUNTS_ENABLED, REGISTERED_PROVIDER);

/** The services the app uses: the registered provider's when ACCOUNTS_ENABLED is on and one exists, else the disabled ones. */
export const auth: AuthService = picked.auth;
export const sync: SyncAdapter = picked.sync;
/** A real provider is in use (flag on and provider registered). Screens promise sync and deletion everywhere only when this is true. */
export const ACCOUNTS_ACTIVE: boolean = picked.active;
