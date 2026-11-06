/**
 * Review: Sign in and Sign up sit behind the same grown-up check as Settings, while Support, Terms
 * and Privacy stay open. App is server-rendered with a stand-in window that only carries the hash.
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { grownUpGate, needsGrownUpCheck } from './screens/logic/session';
import { emptyState, progressStore } from './shared/progress';
import type { Route } from './shared/router';

function renderAt(hash: string): string {
  vi.stubGlobal('window', {
    location: { hash, pathname: '/', search: '', replace: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    innerWidth: 390,
    innerHeight: 844,
  });
  return renderToString(createElement(App));
}

const CHECK = 'Grown-up check';

beforeEach(() => {
  progressStore.replace(emptyState());
  progressStore.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' });
  grownUpGate.reset();
});

afterEach(() => {
  grownUpGate.reset();
  vi.unstubAllGlobals();
});

describe('which routes need the grown-up check', () => {
  it('Settings, Sign in and Sign up do; Support, Terms, Privacy and play screens do not', () => {
    const gated: Route[] = [{ name: 'settings' }, { name: 'signin' }, { name: 'signup' }];
    const open: Route[] = [{ name: 'help' }, { name: 'terms' }, { name: 'privacy' }, { name: 'home' }, { name: 'players' }, { name: 'stickers' }, { name: 'break' }];
    for (const r of gated) expect(needsGrownUpCheck(r), r.name).toBe(true);
    for (const r of open) expect(needsGrownUpCheck(r), r.name).toBe(false);
  });
});

describe('App: the grown-up check in front of the account screens', () => {
  for (const [hash, heading] of [
    ['#/signin', 'Welcome back'],
    ['#/signup', 'Create your family account'],
  ] as const) {
    it(`${hash} shows the check, not the screen, until a grown-up passes it`, () => {
      const locked = renderAt(hash);
      expect(locked).toContain(CHECK);
      expect(locked).not.toContain(heading);
      grownUpGate.pass();
      const open = renderAt(hash);
      expect(open).not.toContain(CHECK);
      expect(open).toContain(heading);
    });
  }

  it('Settings still shows the check first', () => {
    expect(renderAt('#/settings')).toContain(CHECK);
  });

  it('Support, Terms and Privacy open without the check', () => {
    for (const hash of ['#/help', '#/help/terms', '#/help/privacy']) {
      const html = renderAt(hash);
      expect(html, hash).not.toContain(CHECK);
      expect(html.length, hash).toBeGreaterThan(0);
    }
  });
});
