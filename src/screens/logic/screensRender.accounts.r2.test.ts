/**
 * Decision 31 with accounts switched on: a real provider is in use, so Sign in and Sign up open with no
 * coming-soon notice. ACCOUNTS_ACTIVE is a build-time flag, so this file swaps the account module's flag
 * for true and keeps everything else.
 */
import { createElement, type RefObject } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../shared/account', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../shared/account')>()), ACCOUNTS_ACTIVE: true }));

import App from '../../App';
import { emptyState, progressStore } from '../../shared/progress';
import { answerNotice, pointAtSoon } from '../Signin';
import { SOON, authNotice } from './auth';
import { grownUpGate } from './session';

function renderAt(hash: string): string {
  vi.stubGlobal('window', {
    location: { hash, pathname: '/', search: '', replace: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    innerWidth: 390,
    innerHeight: 844,
    setTimeout: () => 0,
    clearTimeout: () => {},
  });
  return renderToString(createElement(App)).replace(/&#x27;/g, "'");
}

beforeEach(() => {
  progressStore.replace(emptyState());
  progressStore.setActivePlayer(progressStore.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' }).id);
  grownUpGate.pass();
});

afterEach(() => {
  grownUpGate.reset();
  vi.unstubAllGlobals();
});

describe('decision 31 with accounts on', () => {
  it('Sign in and Sign up show no coming-soon notice before anyone taps', () => {
    const signin = renderAt('#/signin');
    expect(signin).toContain('Welcome back');
    expect(signin).not.toContain(SOON.title);
    const signup = renderAt('#/signup');
    expect(signup).toContain('Create your family account');
    expect(signup).not.toContain(SOON.title);
  });

  it('an answer that is the coming-soon note still shows, since no notice sits at the top, and focus stays put', () => {
    expect(answerNotice(SOON)).toBe(SOON);
    const offline = authNotice('offline', 'google');
    expect(answerNotice(offline)).toBe(offline);
    const top = { focus: vi.fn(), scrollIntoView: vi.fn() };
    pointAtSoon({ current: top } as unknown as RefObject<HTMLDivElement>, 'apple', { ok: false, reason: 'not-enabled' });
    expect(top.focus).not.toHaveBeenCalled();
  });
});
