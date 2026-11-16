/**
 * Settings after decisions 14, 15 and 20, as it renders: the Grown-up PIN section after Sound and alerts
 * in its off, on, cleared and unavailable states; Sounds and Voice as the only switches; and the
 * selected child's Name field and Remove button. Server-rendered with a stand-in window that has a
 * localStorage, so the app's PIN store reads and writes the way it does in a browser.
 */
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { emptyState, progressStore } from '../../shared/progress';
import { PIN_ITEM, familyPin } from './familyPin';
import { grownUpGate, settingsReturn } from './session';

let store: Map<string, string>;
// Rendering App and hashing a PIN (150000 PBKDF2 rounds) can pass 5 s on a loaded machine.
vi.setConfig({ testTimeout: 30_000 });

function stubWindow() {
  vi.stubGlobal('window', {
    location: { hash: '#/settings', pathname: '/', search: '', replace: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    innerWidth: 390,
    innerHeight: 844,
    setTimeout: () => 0,
    clearTimeout: () => {},
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  });
}

const decode = (html: string) => html.replace(/<!-- -->/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
const settings = () => decode(renderToString(createElement(App)));

/** The markup of one panel, from its heading id to the end of its section. */
function panel(html: string, headingId: string): string {
  const start = html.lastIndexOf('<section', html.indexOf(`id="${headingId}"`));
  const end = html.indexOf('</section>', start);
  return html.slice(start, end);
}

beforeEach(() => {
  store = new Map();
  stubWindow();
  progressStore.replace(emptyState());
  const maya = progressStore.addPlayer({ name: 'Maya', ageBand: '7-8', color: 'blue' });
  progressStore.addPlayer({ name: 'Leo', ageBand: '5-6', color: 'orange' });
  progressStore.setActivePlayer(maya.id);
  settingsReturn.setChild(null);
  grownUpGate.pass();
});

afterEach(() => {
  grownUpGate.reset();
  vi.unstubAllGlobals();
});

describe('Settings: Sound and alerts (decision 20)', () => {
  it('shows Sounds and Voice only', () => {
    const html = panel(settings(), 'set-sound');
    expect(html.match(/role="switch"/g)).toHaveLength(2);
    expect(html).toContain('>Sounds<');
    expect(html).toContain('>Voice<');
    expect(html).not.toContain('Music');
    expect(html).not.toContain('Notifications');
  });

  it('keeps the stored Music and Notifications values as they were', () => {
    progressStore.setSetting('music', true);
    progressStore.setSetting('alerts', true);
    settings();
    expect(progressStore.getState().settings).toMatchObject({ music: true, alerts: true });
  });
});

describe('Settings: the Grown-up PIN section (decision 14)', () => {
  it('sits right after Sound and alerts, off by default, with Set a PIN', () => {
    const html = settings();
    const sound = html.indexOf('id="set-sound"');
    const pinAt = html.indexOf('id="set-pin"');
    const progress = html.indexOf('id="set-progress"');
    expect(sound).toBeGreaterThan(0);
    expect(pinAt).toBeGreaterThan(sound);
    expect(progress).toBeGreaterThan(pinAt);
    const pin = panel(html, 'set-pin');
    expect(pin).toContain('class="sc-panel');
    expect(pin).toContain('>Grown-up PIN</h2>');
    expect(pin).toContain('Ask for a PIN instead of the sum before Settings, levels and more play time.');
    expect(pin).toMatch(/<button type="button"[^>]*>Set a PIN<\/button>/);
    expect(pin).not.toContain('The PIN is on.');
    expect(pin).not.toContain('<input');
  });

  it('with a PIN set, says it is on and offers Change PIN and Turn off PIN', async () => {
    await familyPin.setPin('2580');
    expect(store.get(PIN_ITEM)).toBeDefined();
    const pin = panel(settings(), 'set-pin');
    expect(pin).toContain('The PIN is on.');
    expect(pin).toMatch(/<button type="button"[^>]*>Change PIN<\/button>/);
    expect(pin).toMatch(/<button type="button"[^>]*>Turn off PIN<\/button>/);
    expect(pin).not.toContain('Set a PIN');
  });

  it('after Forgot the PIN, says when it was cleared until a new PIN is set', async () => {
    await familyPin.setPin('2580');
    familyPin.clearPin('forgot');
    const cleared = panel(settings(), 'set-pin');
    expect(cleared).toMatch(/The PIN was cleared with Forgot the PIN on \d{1,2} [A-Z][a-z]+\./);
    expect(cleared).toContain('Set a PIN');
    await familyPin.setPin('1357');
    expect(panel(settings(), 'set-pin')).not.toContain('was cleared');
  });

  it('without Web Crypto, says a PIN needs a secure connection and offers no Set a PIN', () => {
    vi.stubGlobal('crypto', {});
    const pin = panel(settings(), 'set-pin');
    expect(pin).toContain('A PIN needs a secure connection.');
    expect(pin).not.toContain('Set a PIN');
  });
});

describe('Settings: renaming and removing a child (decision 15)', () => {
  it('has a Name field with the child’s name at the top of the age panel', () => {
    const age = panel(settings(), 'set-age');
    const input = /<input[^>]*>/.exec(age)?.[0] ?? '';
    expect(input).toContain('value="Maya"');
    expect(input).toContain('maxLength="24"');
    expect(input).toContain('autoComplete="off"');
    const id = /id="([^"]+)"/.exec(input)![1];
    expect(age).toContain(`<label for="${id}" class="sc-label">Name</label>`);
    expect(age.indexOf('<input')).toBeLessThan(age.indexOf('role="group"'));
  });

  it('has a Remove button under Reset in the Progress panel', () => {
    const progress = panel(settings(), 'set-progress');
    const reset = progress.indexOf("Reset Maya's progress");
    const remove = progress.indexOf('>Remove Maya</button>');
    expect(reset).toBeGreaterThan(0);
    expect(remove).toBeGreaterThan(reset);
    expect(progress).toMatch(/<button type="button" class="sc-btn sc-btn--outline-danger">Remove Maya<\/button>/);
  });
});
