/**
 * Accounts architecture (switched off). Only grown-ups sign in; children never have accounts.
 * A real provider plugs in by implementing AuthService and SyncAdapter; see docs/accounts.md.
 */
import type { ProgressState } from '../progress';

export type ProviderId = 'email' | 'google' | 'apple' | 'facebook';

export type FailReason =
  /** Accounts are switched off in this build (ACCOUNTS_ENABLED is false). */
  | 'not-enabled'
  | 'cancelled'
  | 'offline'
  | 'wrong-credentials'
  | 'too-many-tries'
  | 'provider-failed'
  | 'unknown';

export type Result<T> = { ok: true; value: T } | { ok: false; reason: FailReason };

/** The signed-in grown-up. No child data lives here. */
export interface AuthUser {
  id: string;
  email: string | null;
  provider: ProviderId;
}

export interface AuthService {
  /** Creates a family account with email and password. Sign up calls it only after the parent or guardian box is ticked. */
  createAccount(email: string, password: string): Promise<Result<AuthUser>>;
  signInWithEmail(email: string, password: string): Promise<Result<AuthUser>>;
  /** Sends a sign-in or password reset link. Resolves ok whether or not the email has an account. */
  sendEmailLink(email: string): Promise<Result<void>>;
  signInWithGoogle(): Promise<Result<AuthUser>>;
  signInWithApple(): Promise<Result<AuthUser>>;
  signInWithFacebook(): Promise<Result<AuthUser>>;
  signOut(): Promise<Result<void>>;
  currentUser(): Promise<Result<AuthUser>>;
  /** Called with the user on sign-in and null on sign-out. Returns an unsubscribe function. */
  onChange(listener: (user: AuthUser | null) => void): () => void;
}

export const SNAPSHOT_VERSION = 1;

/**
 * What a SyncAdapter moves between devices. It carries the progress state as is: first names,
 * age bands, avatar colours, stars, levels, stickers, daily limits and settings, and nothing else.
 */
export interface ProgressSnapshot {
  snapshotVersion: typeof SNAPSHOT_VERSION;
  /** When this snapshot was taken (ms). */
  takenAt: number;
  progress: ProgressState;
}

export interface SyncAdapter {
  /** The family's latest snapshot from the server, or null when there is none yet. */
  pull(): Promise<Result<ProgressSnapshot | null>>;
  /** Store a merged snapshot on the server. */
  push(snapshot: ProgressSnapshot): Promise<Result<void>>;
}

/** The pair of services a real provider registers (see config.ts REGISTERED_PROVIDER). */
export interface AccountProvider {
  auth: AuthService;
  sync: SyncAdapter;
}

export type ProviderStage = 'planned-first' | 'planned-later';

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  stage: ProviderStage;
}
