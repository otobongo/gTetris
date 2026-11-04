/** Sign up and Support rules from the review: the grown-up box guards every way in, and Support only promises what is real. */
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser, ProviderId, Result } from '../../shared/account';
import { helpFaqs } from './help';
import { startSignup } from './signup';

const user: AuthUser = { id: 'u1', email: null, provider: 'google' };
const ok: Result<AuthUser> = { ok: true, value: user };

describe('Sign up: every path needs the parent or guardian box', () => {
  const paths: ProviderId[] = ['email', 'apple', 'google', 'facebook'];

  it('calls nothing and asks for the box when it is not ticked', async () => {
    for (const path of paths) {
      const run = vi.fn(() => Promise.resolve(ok));
      const needAdult = vi.fn();
      await expect(startSignup(false, run, needAdult), path).resolves.toBeNull();
      expect(run, path).not.toHaveBeenCalled();
      expect(needAdult, path).toHaveBeenCalledTimes(1);
    }
  });

  it('runs the path once and passes its result on when the box is ticked', async () => {
    for (const path of paths) {
      const run = vi.fn(() => Promise.resolve(ok));
      const needAdult = vi.fn();
      await expect(startSignup(true, run, needAdult), path).resolves.toBe(ok);
      expect(run).toHaveBeenCalledTimes(1);
      expect(needAdult).not.toHaveBeenCalled();
    }
  });

  it('passes a failed result on unchanged', async () => {
    const off: Result<void> = { ok: false, reason: 'not-enabled' };
    await expect(startSignup(true, () => Promise.resolve(off), () => {})).resolves.toBe(off);
  });
});

describe('Support answers', () => {
  const text = (active: boolean) => helpFaqs(active).map((f) => `${f.q} ${f.a}`).join('\n');

  it('promises sync across devices and deletion everywhere only with a real provider active', () => {
    expect(text(false)).not.toMatch(/stay in sync|every device/);
    expect(text(false)).toMatch(/this device/);
    expect(text(true)).toMatch(/stay in sync/);
    expect(text(true)).toMatch(/on every device/);
  });

  it('asks the same questions either way, with no en or em dashes', () => {
    expect(helpFaqs(true).map((f) => f.q)).toEqual(helpFaqs(false).map((f) => f.q));
    expect(text(true) + text(false)).not.toMatch(/[–—]/);
  });
});
