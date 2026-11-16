/**
 * The optional family PIN for the grown-up check (decision 14). When it is set, the check asks for it in
 * place of the sum (decision D1, which stays whenever no PIN is set).
 *
 * One localStorage item, `brickwise.familyPin.v1`, holds `{ v: 1, salt, hash, iterations, fails, lockUntil,
 * clearedAt? }`. The PIN itself is never stored, logged or kept: only a PBKDF2 hash (SHA-256, 150000
 * iterations, 32 bytes) of it with 16 random bytes of salt, both base64. Wrong tries are counted in the
 * same record, so a reload or a second tab does not reset them, and from the third wrong try in a row the
 * check locks for 30 s, doubling to at most 5 minutes. It is separate from the progress state on purpose:
 * progress may one day sync between devices, and a PIN hash must not.
 *
 * Storage, the clock and Web Crypto are passed in (`createFamilyPin`) so tests can use their own; the app
 * uses `familyPin`, which looks them up on each call.
 */

export const PIN_ITEM = 'brickwise.familyPin.v1';
export const PIN_ITERATIONS = 150_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
/** Stored iteration counts outside this range are not trusted (a huge one would freeze the check). */
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 2_000_000;

/** Wrong tries in a row before the first lock, and the lock's first and longest length. */
const LOCK_AFTER = 3;
const LOCK_FIRST_S = 30;
const LOCK_MAX_S = 300;

export type PinCheck = 'right' | 'wrong' | 'locked' | 'empty';
export type PinClear = 'forgot' | 'off' | 'delete';
/** Why a PIN cannot be set here: no Web Crypto (plain http), or no storage. */
export type PinUnavailable = 'secure' | 'storage' | null;

export interface PinStatus {
  set: boolean;
  /** How long the check stays locked from now, 0 when it is open. */
  lockedForMs: number;
  /** When Forgot the PIN cleared it (until a new PIN is set), else null. */
  clearedAt: number | null;
}

export interface PinStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface PinDeps {
  storage: PinStorage | null | undefined;
  now: () => number;
  subtle: SubtleCrypto | null | undefined;
  /** Fills the array with random bytes; defaults to `crypto.getRandomValues`. */
  randomBytes?: (bytes: Uint8Array<ArrayBuffer>) => unknown;
}

interface PinRecord {
  v: 1;
  salt?: string;
  hash?: string;
  iterations?: number;
  fails: number;
  lockUntil: number;
  clearedAt?: number;
}

export interface FamilyPin {
  unavailable(): PinUnavailable;
  status(): PinStatus;
  setPin(pin: string): Promise<boolean>;
  checkPin(pin: string): Promise<PinCheck>;
  clearPin(why: PinClear): void;
}

/** Exactly four ASCII digits. */
export const isPinShape = (pin: string): boolean => /^[0-9]{4}$/.test(pin);

/** Lock length after `fails` wrong tries in a row: none before the third, then 30 s doubling to 300 s. */
export function lockSeconds(fails: number): number {
  if (!Number.isFinite(fails) || fails < LOCK_AFTER) return 0;
  const steps = Math.min(fails - LOCK_AFTER, 8);
  return Math.min(LOCK_MAX_S, LOCK_FIRST_S * 2 ** steps);
}

/** Byte comparison that reads every byte whatever it finds, so the time taken says nothing about where two hashes differ. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) diff |= (i < a.length ? a[i] : 0) ^ (i < b.length ? b[i] : 0);
  return diff === 0;
}

/* ---------- base64 and the stored record ---------- */

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

function fromBase64(text: unknown, length: number): Uint8Array | null {
  if (typeof text !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return null;
  try {
    const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
    return bytes.length === length ? bytes : null;
  } catch {
    return null;
  }
}

const count = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0);
const time = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

/** The stored record, or null for nothing, corrupt JSON or anything this version did not write. */
function parseRecord(raw: string | null): PinRecord | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const r = data as Record<string, unknown>;
  if (r.v !== 1) return null;
  const rec: PinRecord = { v: 1, fails: count(r.fails), lockUntil: time(r.lockUntil) };
  const iterations = r.iterations;
  const hasPin =
    fromBase64(r.salt, SALT_BYTES) !== null &&
    fromBase64(r.hash, HASH_BYTES) !== null &&
    typeof iterations === 'number' &&
    Number.isInteger(iterations) &&
    iterations >= MIN_ITERATIONS &&
    iterations <= MAX_ITERATIONS;
  if (hasPin) {
    rec.salt = r.salt as string;
    rec.hash = r.hash as string;
    rec.iterations = iterations;
  }
  if (typeof r.clearedAt === 'number' && Number.isFinite(r.clearedAt)) rec.clearedAt = r.clearedAt;
  return rec;
}

const hasPin = (rec: PinRecord | null): rec is PinRecord & { salt: string; hash: string; iterations: number } => !!rec?.salt && !!rec.hash && !!rec.iterations;

async function derive(subtle: SubtleCrypto, pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, HASH_BYTES * 8);
  return new Uint8Array(bits);
}

/* ---------- the store ---------- */

export function createFamilyPin(source: PinDeps | (() => PinDeps)): FamilyPin {
  const deps = typeof source === 'function' ? source : () => source;

  const read = (): PinRecord | null => {
    try {
      return parseRecord(deps().storage?.getItem(PIN_ITEM) ?? null);
    } catch {
      return null;
    }
  };
  const write = (rec: PinRecord): boolean => {
    try {
      const storage = deps().storage;
      if (!storage) return false;
      storage.setItem(PIN_ITEM, JSON.stringify(rec));
      return true;
    } catch {
      return false;
    }
  };
  const remove = () => {
    try {
      deps().storage?.removeItem(PIN_ITEM);
    } catch {
      /* storage blocked: nothing stored to remove */
    }
  };

  const unavailable = (): PinUnavailable => {
    const d = deps();
    if (!d.subtle) return 'secure';
    if (!d.storage) return 'storage';
    return null;
  };

  /**
   * Time left on the lock. A clock turned back never makes it longer than the step it is on: the end is
   * moved to now plus that step and saved, so the lock then runs out on time.
   */
  const lockLeft = (rec: PinRecord, now: number): number => {
    const longest = lockSeconds(rec.fails) * 1000;
    const left = rec.lockUntil - now;
    if (left > longest) {
      write({ ...rec, lockUntil: now + longest });
      return longest;
    }
    return Math.max(0, left);
  };

  const checkOnce = async (pin: string): Promise<PinCheck> => {
    const d = deps();
    const rec = read();
    if (!hasPin(rec) || !d.subtle) return 'wrong';
    if (lockLeft(rec, d.now()) > 0) return 'locked';
    if (pin.trim() === '') return 'empty';
    let right = false;
    if (isPinShape(pin)) {
      try {
        const got = await derive(d.subtle, pin, fromBase64(rec.salt, SALT_BYTES)!, rec.iterations);
        right = sameBytes(got, fromBase64(rec.hash, HASH_BYTES)!);
      } catch {
        right = false;
      }
    }
    // Read again after hashing: another tab may have counted a try, or changed the PIN, meanwhile.
    const latest = read();
    if (!hasPin(latest) || latest.salt !== rec.salt) return 'wrong';
    if (right) {
      if (latest.fails !== 0 || latest.lockUntil !== 0) write({ ...latest, fails: 0, lockUntil: 0 });
      return 'right';
    }
    const fails = latest.fails + 1;
    const lock = lockSeconds(fails);
    write({ ...latest, fails, lockUntil: lock ? deps().now() + lock * 1000 : 0 });
    return 'wrong';
  };

  /**
   * Tries run one after another: each waits for the one before to count its result, so several sent at
   * once cannot all be hashed before the lock is written.
   */
  let queue: Promise<unknown> = Promise.resolve();
  const inTurn = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  return {
    unavailable,

    status() {
      const rec = read();
      // A PIN saved over https cannot be checked without Web Crypto: the sum check stays rather than locking a grown-up out.
      const set = hasPin(rec) && !!deps().subtle;
      return { set, lockedForMs: set ? lockLeft(rec, deps().now()) : 0, clearedAt: !hasPin(rec) && rec?.clearedAt !== undefined ? rec.clearedAt : null };
    },

    async setPin(pin) {
      const d = deps();
      if (!isPinShape(pin) || !d.subtle || !d.storage) return false;
      try {
        const salt: Uint8Array<ArrayBuffer> = new Uint8Array(SALT_BYTES);
        (d.randomBytes ?? ((b) => crypto.getRandomValues(b)))(salt);
        const hash = await derive(d.subtle, pin, salt, PIN_ITERATIONS);
        return write({ v: 1, salt: toBase64(salt), hash: toBase64(hash), iterations: PIN_ITERATIONS, fails: 0, lockUntil: 0 });
      } catch {
        return false;
      }
    },

    checkPin(pin) {
      return inTurn(() => checkOnce(pin));
    },

    clearPin(why) {
      if (why === 'forgot') {
        if (!write({ v: 1, fails: 0, lockUntil: 0, clearedAt: deps().now() })) remove();
        return;
      }
      remove();
    },
  };
}

/** The browser's storage and Web Crypto, looked up on each call (both can be missing, or throw, in a private window or over http). */
function browserDeps(): PinDeps {
  let storage: PinStorage | null = null;
  try {
    storage = typeof window !== 'undefined' ? (window.localStorage ?? null) : null;
  } catch {
    storage = null;
  }
  let subtle: SubtleCrypto | null = null;
  try {
    subtle = typeof crypto !== 'undefined' ? (crypto.subtle ?? null) : null;
  } catch {
    subtle = null;
  }
  return { storage, subtle, now: () => Date.now() };
}

export const familyPin: FamilyPin = createFamilyPin(browserDeps);
