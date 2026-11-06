import type { Result, SyncAdapter } from './types';

/** The SyncAdapter used while accounts are off: progress stays on this device, so pull finds nothing and push does nothing. */
export const localOnlySync: SyncAdapter = {
  pull: () => Promise.resolve<Result<null>>({ ok: true, value: null }),
  push: () => Promise.resolve<Result<void>>({ ok: true, value: undefined }),
};
