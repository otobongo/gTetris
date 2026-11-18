/**
 * Decision 14: an optional family PIN in place of the grown-up sum. Only a salted PBKDF2 hash is kept on
 * the device (one localStorage key), wrong tries lock the check for longer each time from the third, and
 * the counters live in the stored record so a reload or a second tab does not reset them.
 * Storage, the clock and Web Crypto come in through `createFamilyPin`, so these tests pass their own.
 */
import { pbkdf2Sync, webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PIN_ITERATIONS,
  PIN_ITEM,
  createFamilyPin,
  isPinShape,
  lockSeconds,
  sameBytes,
  type PinDeps,
  type PinStorage,
} from './familyPin';

const subtle = webcrypto.subtle as unknown as SubtleCrypto;

/** A Storage stand-in over a plain map, shared between "tabs" when passed to several instances. */
function memoryStorage(seed: Record<string, string> = {}): PinStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k)! : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

/** A clock the test moves by hand. */
function clock(start = Date.UTC(2026, 10, 16, 9, 0, 0)) {
  let t = start;
  return { now: () => t, tick: (ms: number) => (t += ms), set: (ms: number) => (t = ms) };
}

/** Node's Web Crypto, wrapped so the test can count the hashing calls and see their parameters. */
function countingSubtle() {
  const calls: { iterations: number; hash: string; bits: number }[] = [];
  const wrapped = {
    importKey: (...args: Parameters<SubtleCrypto['importKey']>) => subtle.importKey(...args),
    deriveBits: (algorithm: Pbkdf2Params, key: CryptoKey, length: number) => {
      calls.push({ iterations: algorithm.iterations, hash: String(algorithm.hash), bits: length });
      return subtle.deriveBits(algorithm, key, length);
    },
  } as unknown as SubtleCrypto;
  return { subtle: wrapped, calls };
}

function setup(over: Partial<PinDeps> = {}) {
  const storage = memoryStorage();
  const c = clock();
  const deps: PinDeps = { storage, now: c.now, subtle, ...over };
  return { pin: createFamilyPin(deps), storage: (over.storage as ReturnType<typeof memoryStorage>) ?? storage, clock: c, deps };
}

const stored = (storage: PinStorage) => JSON.parse(storage.getItem(PIN_ITEM) ?? 'null');
const b64 = (s: string) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

// Each PIN check runs 150000 PBKDF2 rounds; a loaded machine needs more than the default 5 s for the longer cases.
vi.setConfig({ testTimeout: 30_000 });

afterEach(() => vi.restoreAllMocks());

describe('family PIN: what counts as a PIN', () => {
  it('takes exactly four digits', () => {
    for (const ok of ['0000', '2580', '9999']) expect(isPinShape(ok), ok).toBe(true);
    for (const bad of ['', '258', '25801', '25a0', ' 2580', '2580 ', '25 8', '٢٥٨٠', '+258', '-258']) expect(isPinShape(bad), bad).toBe(false);
  });
});

describe('family PIN: setting it stores only a salted PBKDF2 hash', () => {
  it('saves salt, hash and iteration count, and never the PIN', async () => {
    const { pin, storage } = setup();
    expect(await pin.setPin('2580')).toBe(true);
    const raw = storage.getItem(PIN_ITEM)!;
    expect(raw).not.toContain('2580');
    for (const [k, v] of storage.data) expect(`${k}${v}`).not.toContain('2580');
    const rec = JSON.parse(raw);
    expect(rec).toMatchObject({ v: 1, iterations: PIN_ITERATIONS, fails: 0, lockUntil: 0 });
    expect(PIN_ITERATIONS).toBe(150000);
    expect(b64(rec.salt)).toHaveLength(16);
    expect(b64(rec.hash)).toHaveLength(32);
    expect(Object.keys(rec).sort()).toEqual(['fails', 'hash', 'iterations', 'lockUntil', 'salt', 'v']);
  });

  it('uses PBKDF2 with SHA-256 and 150000 iterations: the stored hash matches an independent computation', async () => {
    const { pin, storage } = setup();
    await pin.setPin('2580');
    const rec = stored(storage);
    const expected = pbkdf2Sync('2580', Buffer.from(b64(rec.salt)), 150000, 32, 'sha256');
    expect(Buffer.from(b64(rec.hash)).equals(expected)).toBe(true);
  });

  it('passes the iteration count and SHA-256 to Web Crypto', async () => {
    const counting = countingSubtle();
    const { pin } = setup({ subtle: counting.subtle });
    await pin.setPin('1234');
    expect(counting.calls).toEqual([{ iterations: 150000, hash: 'SHA-256', bits: 256 }]);
  });

  it('draws a new salt every time, so the same PIN never gives the same hash', async () => {
    const { pin, storage } = setup();
    await pin.setPin('2580');
    const first = stored(storage);
    await pin.setPin('2580');
    const second = stored(storage);
    expect(second.salt).not.toBe(first.salt);
    expect(second.hash).not.toBe(first.hash);
    const other = setup();
    await other.pin.setPin('2580');
    expect(stored(other.storage).salt).not.toBe(second.salt);
  });

  it('refuses anything but four digits and stores nothing', async () => {
    const { pin, storage } = setup();
    for (const bad of ['', '123', '12345', 'abcd']) expect(await pin.setPin(bad), bad).toBe(false);
    expect(storage.getItem(PIN_ITEM)).toBeNull();
    expect(pin.status().set).toBe(false);
  });

  it('writes nothing to the console while setting and checking', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const { pin } = setup();
    await pin.setPin('2580');
    await pin.checkPin('1111');
    await pin.checkPin('2580');
    for (const s of spies) expect(s).not.toHaveBeenCalled();
  });
});

describe('family PIN: checking it', () => {
  it('passes the right PIN and fails another', async () => {
    const { pin } = setup();
    await pin.setPin('2580');
    expect(pin.status()).toEqual({ set: true, lockedForMs: 0, clearedAt: null });
    expect(await pin.checkPin('2580')).toBe('right');
    expect(await pin.checkPin('2581')).toBe('wrong');
    expect(await pin.checkPin('0000')).toBe('wrong');
  });

  it('treats an empty or spaces-only try as empty: no wrong try counted, no hashing', async () => {
    const counting = countingSubtle();
    const { pin, storage } = setup({ subtle: counting.subtle });
    await pin.setPin('2580');
    counting.calls.length = 0;
    expect(await pin.checkPin('')).toBe('empty');
    expect(await pin.checkPin('   ')).toBe('empty');
    expect(counting.calls).toHaveLength(0);
    expect(stored(storage).fails).toBe(0);
  });

  it('counts a try that is not four digits as wrong', async () => {
    const { pin, storage } = setup();
    await pin.setPin('2580');
    expect(await pin.checkPin('25')).toBe('wrong');
    expect(await pin.checkPin('abcd')).toBe('wrong');
    expect(stored(storage).fails).toBe(2);
  });

  it('says wrong, without counting, when no PIN is set', async () => {
    const { pin, storage } = setup();
    expect(await pin.checkPin('2580')).toBe('wrong');
    expect(storage.getItem(PIN_ITEM)).toBeNull();
  });
});

describe('family PIN: wrong tries lock the check', () => {
  it('gives 30 s after the third wrong in a row, then 60, 120, 240 and at most 5 minutes', () => {
    expect([0, 1, 2].map(lockSeconds)).toEqual([0, 0, 0]);
    expect([3, 4, 5, 6, 7, 8, 20, 400].map(lockSeconds)).toEqual([30, 60, 120, 240, 300, 300, 300, 300]);
  });

  it('locks for 30 s on the third wrong, refuses every try during it without hashing, then 60 s on the next wrong', async () => {
    const counting = countingSubtle();
    const { pin, storage, clock: c } = setup({ subtle: counting.subtle });
    await pin.setPin('2580');
    counting.calls.length = 0;

    expect(await pin.checkPin('1111')).toBe('wrong');
    expect(await pin.checkPin('1111')).toBe('wrong');
    expect(pin.status().lockedForMs).toBe(0);
    expect(await pin.checkPin('1111')).toBe('wrong');
    expect(pin.status().lockedForMs).toBe(30_000);
    expect(counting.calls).toHaveLength(3);

    c.tick(10_000);
    expect(pin.status().lockedForMs).toBe(20_000);
    // Even the right PIN is refused while locked, and nothing is hashed or counted.
    expect(await pin.checkPin('2580')).toBe('locked');
    expect(await pin.checkPin('1111')).toBe('locked');
    expect(counting.calls).toHaveLength(3);
    expect(stored(storage).fails).toBe(3);

    c.tick(20_000);
    expect(pin.status().lockedForMs).toBe(0);
    expect(await pin.checkPin('1111')).toBe('wrong');
    expect(pin.status().lockedForMs).toBe(60_000);

    c.tick(60_000);
    expect(await pin.checkPin('1111')).toBe('wrong');
    expect(pin.status().lockedForMs).toBe(120_000);
    c.tick(120_000);
    expect(await pin.checkPin('1111')).toBe('wrong');
    expect(pin.status().lockedForMs).toBe(240_000);
    c.tick(240_000);
    expect(await pin.checkPin('1111')).toBe('wrong');
    expect(pin.status().lockedForMs).toBe(300_000);
    c.tick(300_000);
    expect(await pin.checkPin('1111')).toBe('wrong');
    expect(pin.status().lockedForMs).toBe(300_000);
  });

  it('takes tries one at a time: ten sent together still lock after the third and hash only three', async () => {
    const counting = countingSubtle();
    const { pin, storage } = setup({ subtle: counting.subtle });
    await pin.setPin('2580');
    counting.calls.length = 0;
    const results = await Promise.all(['1111', '1112', '1113', '1114', '1115', '1116', '1117', '1118', '1119', '2580'].map((p) => pin.checkPin(p)));
    expect(results).toEqual(['wrong', 'wrong', 'wrong', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked', 'locked']);
    expect(counting.calls).toHaveLength(3);
    expect(stored(storage).fails).toBe(3);
  });

  it('resets the count after the right PIN, so the next wrong does not lock', async () => {
    const { pin, storage, clock: c } = setup();
    await pin.setPin('2580');
    for (let i = 0; i < 3; i++) await pin.checkPin('1111');
    c.tick(30_000);
    expect(await pin.checkPin('2580')).toBe('right');
    expect(stored(storage).fails).toBe(0);
    expect(await pin.checkPin('1111')).toBe('wrong');
    expect(pin.status().lockedForMs).toBe(0);
  });

  it('keeps the count and the lock in storage: a reload or a second tab sees them', async () => {
    const storage = memoryStorage();
    const c = clock();
    const first = createFamilyPin({ storage, now: c.now, subtle });
    await first.setPin('2580');
    await first.checkPin('1111');
    await first.checkPin('1111');
    const second = createFamilyPin({ storage, now: c.now, subtle });
    expect(await second.checkPin('1111')).toBe('wrong');
    expect(second.status().lockedForMs).toBe(30_000);
    const third = createFamilyPin({ storage, now: c.now, subtle });
    expect(await third.checkPin('2580')).toBe('locked');
    c.tick(30_000);
    expect(await third.checkPin('2580')).toBe('right');
  });

  it('never locks for longer than the current step when the clock is turned back', async () => {
    const { pin, clock: c } = setup();
    await pin.setPin('2580');
    for (let i = 0; i < 3; i++) await pin.checkPin('1111');
    c.tick(-24 * 3600_000);
    expect(pin.status().lockedForMs).toBeLessThanOrEqual(30_000);
    c.tick(30_000);
    expect(pin.status().lockedForMs).toBe(0);
  });
});

describe('family PIN: clearing it', () => {
  it('Turn off and Delete remove the whole record', async () => {
    for (const why of ['off', 'delete'] as const) {
      const { pin, storage } = setup();
      await pin.setPin('2580');
      await pin.checkPin('1111');
      pin.clearPin(why);
      expect(storage.getItem(PIN_ITEM), why).toBeNull();
      expect(pin.status()).toEqual({ set: false, lockedForMs: 0, clearedAt: null });
    }
  });

  it('Forgot the PIN removes salt and hash and keeps when it happened, until a new PIN is set', async () => {
    const { pin, storage, clock: c } = setup();
    await pin.setPin('2580');
    for (let i = 0; i < 3; i++) await pin.checkPin('1111');
    pin.clearPin('forgot');
    const rec = stored(storage);
    expect(rec.salt).toBeUndefined();
    expect(rec.hash).toBeUndefined();
    expect(rec.clearedAt).toBe(c.now());
    expect(pin.status()).toEqual({ set: false, lockedForMs: 0, clearedAt: c.now() });
    expect(await pin.checkPin('2580')).toBe('wrong');

    c.tick(1000);
    await pin.setPin('1357');
    expect(stored(storage).clearedAt).toBeUndefined();
    expect(pin.status()).toEqual({ set: true, lockedForMs: 0, clearedAt: null });
  });

  it('changing the PIN starts the count again', async () => {
    const { pin, storage } = setup();
    await pin.setPin('2580');
    await pin.checkPin('1111');
    await pin.checkPin('1111');
    await pin.setPin('1357');
    expect(stored(storage).fails).toBe(0);
    expect(await pin.checkPin('2580')).toBe('wrong');
    expect(await pin.checkPin('1357')).toBe('right');
  });
});

describe('family PIN: broken or missing pieces', () => {
  it('counts corrupt or foreign JSON as no PIN, and a new PIN can still be set over it', async () => {
    const good = setup();
    await good.pin.setPin('2580');
    const rec = stored(good.storage);
    const bad = [
      '{',
      'null',
      '[]',
      '"2580"',
      '42',
      JSON.stringify({ ...rec, v: 2 }),
      JSON.stringify({ ...rec, salt: 'AAAA' }),
      JSON.stringify({ ...rec, hash: 'not base64 at all!' }),
      JSON.stringify({ ...rec, hash: 123 }),
      JSON.stringify({ ...rec, iterations: 5 }),
      JSON.stringify({ ...rec, iterations: 1e12 }),
      JSON.stringify({ ...rec, iterations: '150000' }),
    ];
    for (const raw of bad) {
      const storage = memoryStorage({ [PIN_ITEM]: raw });
      const pin = createFamilyPin({ storage, now: () => 0, subtle });
      expect(pin.status().set, raw).toBe(false);
      expect(await pin.checkPin('2580'), raw).toBe('wrong');
      expect(await pin.setPin('2580'), raw).toBe(true);
      expect(pin.status().set, raw).toBe(true);
    }
  });

  it('reads a cleared date no calendar can show as no date, so Settings can still draw it', () => {
    for (const clearedAt of [1e20, -1e20, 8.64e15 + 1]) {
      const storage = memoryStorage({ [PIN_ITEM]: JSON.stringify({ v: 1, fails: 0, lockUntil: 0, clearedAt }) });
      const pin = createFamilyPin({ storage, now: () => 0, subtle });
      expect(pin.status().clearedAt, String(clearedAt)).toBeNull();
    }
  });

  it('keeps a real cleared date, up to the last day a date can hold', () => {
    for (const clearedAt of [0, Date.UTC(2026, 10, 16), 8.64e15]) {
      const storage = memoryStorage({ [PIN_ITEM]: JSON.stringify({ v: 1, fails: 0, lockUntil: 0, clearedAt }) });
      const pin = createFamilyPin({ storage, now: () => 0, subtle });
      expect(pin.status().clearedAt, String(clearedAt)).toBe(clearedAt);
    }
  });

  it('reads broken counters as zero', async () => {
    const good = setup();
    await good.pin.setPin('2580');
    const rec = stored(good.storage);
    const storage = memoryStorage({ [PIN_ITEM]: JSON.stringify({ ...rec, fails: -3, lockUntil: 'soon' }) });
    const pin = createFamilyPin({ storage, now: () => 0, subtle });
    expect(pin.status()).toEqual({ set: true, lockedForMs: 0, clearedAt: null });
  });

  it('without Web Crypto (plain http) a PIN cannot be set and the sum check stays', async () => {
    for (const missing of [undefined, null]) {
      const { pin, storage } = setup({ subtle: missing });
      expect(pin.unavailable()).toBe('secure');
      expect(await pin.setPin('2580')).toBe(false);
      expect(storage.getItem(PIN_ITEM)).toBeNull();
      expect(pin.status().set).toBe(false);
    }
  });

  it('with a PIN saved but no Web Crypto now, the check falls back to the sum instead of locking a grown-up out', async () => {
    const good = setup();
    await good.pin.setPin('2580');
    const pin = createFamilyPin({ storage: good.storage, now: () => 0, subtle: undefined });
    expect(pin.status().set).toBe(false);
  });

  it('without storage, or with storage that throws, there is no PIN and nothing breaks', async () => {
    const none = createFamilyPin({ storage: null, now: () => 0, subtle });
    expect(none.unavailable()).toBe('storage');
    expect(none.status().set).toBe(false);
    expect(await none.setPin('2580')).toBe(false);
    expect(() => none.clearPin('off')).not.toThrow();

    const boom = () => {
      throw new Error('blocked');
    };
    const throwing = createFamilyPin({ storage: { getItem: boom, setItem: boom, removeItem: boom }, now: () => 0, subtle });
    expect(throwing.status().set).toBe(false);
    expect(await throwing.setPin('2580')).toBe(false);
    expect(await throwing.checkPin('2580')).toBe('wrong');
    expect(() => throwing.clearPin('forgot')).not.toThrow();
  });

  it('says so when the record cannot be saved', async () => {
    const storage = memoryStorage();
    storage.setItem = () => {
      throw new Error('quota');
    };
    const pin = createFamilyPin({ storage, now: () => 0, subtle });
    expect(pin.unavailable()).toBeNull();
    expect(await pin.setPin('2580')).toBe(false);
  });
});

describe('family PIN: comparing hashes', () => {
  it('compares byte by byte and reports equal arrays only', () => {
    const a = Uint8Array.from({ length: 32 }, (_, i) => i);
    expect(sameBytes(a, a.slice())).toBe(true);
    const first = a.slice();
    first[0] ^= 1;
    const last = a.slice();
    last[31] ^= 1;
    expect(sameBytes(a, first)).toBe(false);
    expect(sameBytes(a, last)).toBe(false);
    expect(sameBytes(a, a.slice(0, 31))).toBe(false);
    expect(sameBytes(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });

  it('reads every byte whether the arrays differ at the start or the end (no early exit)', () => {
    const reads = (x: Uint8Array) => {
      let n = 0;
      const p = new Proxy(x, {
        get(target, prop) {
          if (typeof prop === 'string' && /^\d+$/.test(prop)) n++;
          const v = Reflect.get(target, prop, target);
          return typeof v === 'function' ? v.bind(target) : v;
        },
      });
      return { p, count: () => n };
    };
    const a = Uint8Array.from({ length: 32 }, (_, i) => i);
    const early = a.slice();
    early[0] ^= 0xff;
    const late = a.slice();
    late[31] ^= 0xff;
    const r1 = reads(early);
    sameBytes(a, r1.p as Uint8Array);
    const r2 = reads(late);
    sameBytes(a, r2.p as Uint8Array);
    expect(r1.count()).toBe(32);
    expect(r2.count()).toBe(32);
  });
});
