# Family accounts: how a provider plugs in later

Status: **switched off.** The app ships with no sign-in, no sync and no network code. Progress
lives on the device in `localStorage` (`src/shared/progress`). This page explains the seam that
is already in place and the rules a real provider has to meet before the flag is turned on.

## What exists today

| Piece | File | What it does now |
|---|---|---|
| `AuthService` interface | `src/shared/account/types.ts` | `createAccount`, `signInWithEmail`, `sendEmailLink`, `signInWithGoogle`, `signInWithApple`, `signInWithFacebook`, `signOut`, `currentUser`, `onChange` |
| `SyncAdapter` interface | `src/shared/account/types.ts` | `pull()` and `push(snapshot)` of a versioned `ProgressSnapshot` |
| `disabledAuth` | `src/shared/account/disabledAuth.ts` | Every call resolves to `{ ok: false, reason: 'not-enabled' }`; `onChange` never fires |
| `localOnlySync` | `src/shared/account/localOnlySync.ts` | `pull` resolves to `{ ok: true, value: null }`, `push` does nothing |
| Merge rule | `src/shared/account/merge.ts` | `mergeProgress(local, remote)` and `mergeSnapshot(local, pulled, now)` |
| Flag | `src/shared/account/config.ts` | `ACCOUNTS_ENABLED` reads `VITE_ACCOUNTS_ENABLED`; only `true` or `1` turns it on. Default off |
| Provider list | `src/shared/account/config.ts` | `email` and `google` are `planned-first`; `apple` and `facebook` are `planned-later` |
| Registered provider | `src/shared/account/config.ts` | `REGISTERED_PROVIDER` holds a real provider's `{ auth, sync }`. It is `null` today |
| Service choice | `src/shared/account/config.ts` | `pickServices(flag, provider)`: flag off gives the disabled services; flag on with a provider gives that provider; flag on with no provider fails closed (disabled services and one `console.error`, never a throw at app start) |
| Active services | `src/shared/account/index.ts` | `auth` and `sync` from `pickServices(ACCOUNTS_ENABLED, REGISTERED_PROVIDER)`, so `disabledAuth` and `localOnlySync` today. `ACCOUNTS_ACTIVE` is true only when a real provider is in use |

Screens call `auth` and `sync` from `src/shared/account`, never a provider SDK directly. While the
flag is off, the Sign in and Sign up screens show their designed states, and every action ends in
the `not-enabled` result, which the screen turns into a calm message.

Sign up calls `createAccount(email, password)` for the email path. The email, Apple, Google and
Facebook paths all require the "parent or guardian, 18 or older" box first
(`src/screens/logic/signup.ts`); unticked, no AuthService call is made. Sign in and Sign up
sit behind the same grown-up check as Settings (`GrownUpOnly` in `src/App.tsx`). Support
(`src/screens/logic/help.ts`) promises sync across devices and deletion on every device only
when `ACCOUNTS_ACTIVE` is true, not just when the flag is on.

## Plugging in a provider

Supabase is the likely candidate (Postgres with row-level security, email and Google sign-in,
an official JS client). Any provider works if it meets the rules below.

1. Add the provider's official client as a dependency (check the exact package name, commit the
   lockfile, run `npm audit`).
2. Write `src/shared/account/supabaseAuth.ts` implementing `AuthService`, mapping provider errors
   to `FailReason` (`wrong-credentials`, `too-many-tries`, `offline`, `provider-failed`,
   `cancelled`). `createAccount` creates the family account (the server checks consent was
   given). `sendEmailLink` always resolves `ok`, so the screen never reveals which emails have
   accounts.
3. Write `src/shared/account/supabaseSync.ts` implementing `SyncAdapter`. `pull` returns the
   family's latest `ProgressSnapshot` or `null`; `push` stores one. The client never trusts what
   it pulls: `mergeSnapshot` runs the remote progress through the same `sanitize` as local storage.
4. In `src/shared/account/config.ts`, register the provider:
   `export const REGISTERED_PROVIDER = { auth: supabaseAuth, sync: supabaseSync };`.
   `index.ts` already picks the services with `pickServices(ACCOUNTS_ENABLED, REGISTERED_PROVIDER)`,
   so the provider is used only when the flag is also on.
5. Sync loop (to be written with the provider): on sign-in and on app start, `pull`, then
   `progressStore.replace(mergeSnapshot(progressStore.getState(), pulled, now))`, then `push`
   the merged state with `toSnapshot`. Push again after progress changes, debounced.
6. Keys (project URL, publishable key) come from build-time environment variables set in the
   host's settings, never from the repo. Service-role keys never reach the client.

### The merge rule

`mergeProgress` never loses an earned result:

- Players: union by id. Name, age band, colour, limit and timer come from the newer edit (`updatedAt`).
- Per game and level: the higher stars and the higher best score; `unlocked` is the further one.
- Stickers: union, keeping the earliest earn time; seen if seen on either device.
- Today's play time: the later day wins; on the same day the larger counts win.
- Settings: the newer change (`settingsUpdatedAt`) wins; a tie keeps the local value.
- The active player stays this device's choice.

Known gap: the four-puzzle levels added two fields to each game, `current` (the level a Home tap
opens) and `runs` (puzzles solved in levels not yet finished, keyed by level). When both devices
hold a game, `mergeGame` in `src/shared/account/merge.ts` keeps only `unlocked`, `stars` and
`best`, so a sync today would drop every level in progress and every grown-up's pick. Before sync
is switched on, the merge must carry both and merge them safely:

- `runs`, per level: a run only on one side is kept; when both sides hold a run on the same `set`,
  keep the one with more `solved` results (then the newer `updatedAt`); on different sets, keep
  the newer one. A level that has stars on either side after the merge drops its run. Letter
  Builder's `hintsLeft` takes the lower of the two on the same set, so a spent hint never comes back.
- `current`: the value of the side that has one; when both do, this device's value (as with the
  active player). Dropped when that level has stars after the merge, so the next Home tap works it
  out, as `currentLevel` in `src/games/meta.ts` does.
- The merged state goes through `sanitize` as today, so a broken run from the server is dropped
  rather than trusted.

Known gap: removing a child on one device does not remove them on others, because the union
brings them back. Before launch, add deletion markers (an id plus deletion time) to the snapshot
and drop marked players in the merge. Account deletion is a server action, not a merge.

## Rules a provider must meet before `ACCOUNTS_ENABLED` is turned on

- **Only grown-ups sign in.** Children never have accounts, passwords or emails. They pick their
  brick on Who's playing under the family account.
- **Least child data.** A child is a first name, an age band (3-4, 5-6, 7-8, 9-10), an avatar
  colour, and their progress. No birth dates, photos, surnames, locations, voice recordings or
  free text from children. The snapshot type carries nothing else.
- **Parental consent.** The grown-up who creates the family account gives verifiable consent
  before any child's data leaves the device, under the children's privacy laws that apply
  (for example COPPA in the US, GDPR-K and the UK Age Appropriate Design Code). Counsel signs this
  off, together with the Terms of use and Privacy policy, which are placeholders today.
- **Row-level security on every table**, with policies that let a signed-in grown-up read and
  write only their own family's rows. No table is readable without a policy. Never switch it off
  to make something work.
- **Server-side checks.** Validate every write on the server (types, ranges: stars 1 to 3, limits
  10 to 90 minutes, name length), not only in the client. Rate-limit sign-in, email links and
  password resets.
- **HTTPS only**, certificate checks on, no wildcard CORS, and session tokens kept by the
  provider's client in its own secure storage, never in URLs or logs.
- **No analytics, ads or third-party trackers** in the child-facing app, and no network calls
  from kid screens (Levels, Stickers, Break) beyond the sync itself.
- **Deletion.** "Delete my account" in Settings removes the family account and every child's data
  on the server and, on next sync, on every device.
- A full security review (OWASP Top 10) runs before the first deploy with accounts on.
