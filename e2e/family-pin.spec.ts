/**
 * Decision 14: an optional 4-digit family PIN for the grown-up check, set in Settings. Only a salted PBKDF2
 * hash is stored; three wrong tries lock the check for 30 s, doubling to 5 minutes; Forgot the PIN needs the
 * sum and a 10 second hold, and Settings then says the PIN was cleared. Every place the check guards
 * (Settings, the level picker, Break's add time, Sign in and Sign up) asks for the PIN once it is set.
 * Locks and the hold run on Playwright's clock.
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { type Band, passGrownUpCheck, seed } from './app';

const PIN_ITEM = 'brickwise.familyPin.v1';
const FAMILY = [
  { id: 'maya', name: 'Maya', ageBand: '7-8' as const },
  { id: 'leo', name: 'Leo', ageBand: '5-6' as const },
];
const START = new Date('2026-11-16T09:00:00');

/** A stored PIN record, made the way the app makes it (the format is fixed by decision 14). */
function pinRecord(pin: string, extra: Record<string, unknown> = {}) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pin, salt, 150000, 32, 'sha256');
  return { v: 1, salt: salt.toString('base64'), hash: hash.toString('base64'), iterations: 150000, fails: 0, lockUntil: 0, ...extra };
}

/** Put a PIN record on the device before the app first loads in this tab (once, so a reload keeps what the app saved). */
async function seedPin(page: Page, pin: string) {
  await page.addInitScript(
    ({ key, json }) => {
      if (sessionStorage.getItem('e2e-pin-seeded')) return;
      sessionStorage.setItem('e2e-pin-seeded', '1');
      localStorage.setItem(key, json);
    },
    { key: PIN_ITEM, json: JSON.stringify(pinRecord(pin)) },
  );
}

const storedPin = (page: Page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), PIN_ITEM);
const pinField = (page: Page): Locator => page.getByLabel('Family PIN', { exact: true });
const check = (page: Page): Locator => page.getByRole('button', { name: 'Check', exact: true });
const lockLine = (page: Page): Locator => page.getByRole('status').filter({ hasText: /^Too many tries/ });

async function enterPin(page: Page, pin: string) {
  await pinField(page).fill(pin);
  await check(page).click();
}

/** Home, then the gear, then the PIN: Settings. */
async function openSettingsWithPin(page: Page, pin = '2580') {
  await page.goto('/#/');
  await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
  await enterPin(page, pin);
  await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
}

/** The check in PIN mode: the PIN field, and no sum anywhere. */
async function expectPinCheck(page: Page) {
  await expect(page.getByRole('heading', { name: 'Grown-up check' })).toBeVisible();
  await expect(page.getByText('Enter the family PIN.')).toBeVisible();
  await expect(pinField(page)).toBeVisible();
  await expect(page.locator('.sc-gate__sum')).toHaveCount(0);
}

/** Set the PIN through Settings' own form. */
async function setPinInSettings(page: Page, pin: string) {
  const section = page.getByRole('region', { name: 'Grown-up PIN' });
  await section.getByRole('button', { name: 'Set a PIN' }).click();
  await section.getByLabel('New PIN', { exact: true }).fill(pin);
  await section.getByLabel('Type it again', { exact: true }).fill(pin);
  await section.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'The PIN is on. Keep it somewhere safe.' })).toBeVisible();
  await expect(section.getByText('The PIN is on.', { exact: true })).toBeVisible();
}

async function expectRealFont(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "Baloo 2"'))).toBe(true);
}

/** Every localStorage and sessionStorage key and value, as one string. */
const allStorage = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const s of [localStorage, sessionStorage]) for (let i = 0; i < s.length; i++) out.push(`${s.key(i)}=${s.getItem(s.key(i)!)}`);
    return out.join('\n');
  });

/**
 * Stop Playwright's clock where the page is now, so only runFor moves it: an installed clock otherwise
 * keeps pace with real time, and a loaded machine then shifts the lock count and the hold.
 */
async function pauseClock(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

async function holdButton(page: Page, ms: number) {
  const button = page.getByRole('button', { name: /^Hold to clear the PIN/ });
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.clock.runFor(ms);
  await page.mouse.up();
}

test.describe('setting the PIN', () => {
  test('Set 2580 in Settings: only salt and hash are stored, never the PIN', async ({ page }) => {
    await seed(page, FAMILY);
    await page.goto('/#/');
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await passGrownUpCheck(page);
    await expectRealFont(page);
    await setPinInSettings(page, '2580');

    const all = await allStorage(page);
    expect(all).not.toContain('2580');
    const rec = await storedPin(page);
    expect(Object.keys(rec).sort()).toEqual(['fails', 'hash', 'iterations', 'lockUntil', 'salt', 'v']);
    expect(rec.iterations).toBe(150000);
    // Both fields are empty again after Save, and nothing typed stays in the page.
    expect(await page.evaluate(() => document.documentElement.outerHTML.includes('2580'))).toBe(false);
  });

  test('the form says what is wrong: not 4 numbers, or the two do not match', async ({ page }) => {
    await seed(page, FAMILY);
    await page.goto('/#/');
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await passGrownUpCheck(page);
    const section = page.getByRole('region', { name: 'Grown-up PIN' });
    await section.getByRole('button', { name: 'Set a PIN' }).click();
    await expect(section.getByLabel('New PIN', { exact: true })).toBeFocused();

    await section.getByLabel('New PIN', { exact: true }).fill('25');
    await section.getByLabel('Type it again', { exact: true }).fill('25');
    await section.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(section.getByRole('alert')).toHaveText('Use 4 numbers.');

    await section.getByLabel('New PIN', { exact: true }).fill('2580');
    await section.getByLabel('Type it again', { exact: true }).fill('2581');
    await section.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(section.getByRole('alert')).toHaveText('The two PINs are not the same.');
    expect(await storedPin(page)).toBeNull();

    await section.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(section.getByRole('button', { name: 'Set a PIN' })).toBeFocused();
    expect(await storedPin(page)).toBeNull();
  });

  test('Change PIN replaces it: the old one stops working', async ({ page }) => {
    await seed(page, FAMILY);
    await seedPin(page, '2580');
    await openSettingsWithPin(page, '2580');
    const section = page.getByRole('region', { name: 'Grown-up PIN' });
    await section.getByRole('button', { name: 'Change PIN' }).click();
    await section.getByLabel('New PIN', { exact: true }).fill('1357');
    await section.getByLabel('Type it again', { exact: true }).fill('1357');
    await section.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(section.getByRole('button', { name: 'Change PIN' })).toBeFocused();

    await page.getByRole('link', { name: 'Back to home' }).click();
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await enterPin(page, '2580');
    await expect(page.getByRole('alert')).toHaveText('That PIN is not right.');
    await enterPin(page, '1357');
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
  });
});

test.describe('every grown-up check asks for the PIN', () => {
  test('Settings, the level picker, Sign in and Sign up: the PIN, not the sum, and 2580 passes', async ({ page }) => {
    await seed(page, FAMILY);
    await seedPin(page, '2580');

    await page.goto('/#/');
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await expectPinCheck(page);
    await expect(pinField(page)).toBeFocused();
    await enterPin(page, '2580');
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();

    // Home ends the grown-up pass, so each of these opens the check again.
    for (const [path, done] of [
      ['/#/settings/levels/escape/maya', page.getByText(/^Maya · \d+ of \d+ stars$/)],
      ['/#/signin', page.getByRole('heading', { name: 'Welcome back' })],
      ['/#/signup', page.getByRole('heading', { name: 'Create your family account' })],
    ] as const) {
      await page.goto('/#/');
      await expect(page.getByRole('heading', { name: 'Hi Maya!' })).toBeVisible();
      await page.goto(path);
      await expectPinCheck(page);
      await enterPin(page, '2580');
      await expect(pinField(page)).toHaveCount(0);
      await expect(done).toBeVisible();
    }
  });

  test('Break: Grown-ups: add time asks for the PIN, and 2580 opens Add time', async ({ page }) => {
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8', dailyLimit: 20, minutesToday: 20 }]);
    await seedPin(page, '2580');
    await page.goto('/#/');
    await expect(page).toHaveURL(/#\/break$/);
    await page.getByRole('button', { name: 'Grown-ups: add time' }).click();
    await expectPinCheck(page);
    await expect(pinField(page)).toBeFocused();
    await enterPin(page, '1111');
    await expect(page.getByRole('alert')).toHaveText('That PIN is not right.');
    await enterPin(page, '2580');
    await expect(page.getByRole('heading', { name: 'Add time for Maya today' })).toBeVisible();
  });

  for (const band of ['3-4', '5-6', '7-8', '9-10'] as Band[]) {
    test(`ages ${band}: the same PIN check opens Settings @phone-only`, async ({ page }) => {
      await seed(page, [{ id: 'kid', name: 'Sam', ageBand: band }]);
      await seedPin(page, '2580');
      await page.goto('/#/');
      await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
      await expectPinCheck(page);
      await enterPin(page, '2580');
      await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
    });
  }
});

test.describe('wrong tries', () => {
  test('an empty Check is a hint, not a wrong try; a wrong PIN clears the field and keeps focus there', async ({ page }) => {
    await seed(page, FAMILY);
    await seedPin(page, '2580');
    await page.goto('/#/');
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();

    await check(page).click();
    await expect(page.getByRole('status').filter({ hasText: 'Type the PIN, then tap Check.' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect((await storedPin(page)).fails).toBe(0);

    await enterPin(page, '1111');
    await expect(page.getByRole('alert')).toHaveText('That PIN is not right.');
    await expect(pinField(page)).toHaveValue('');
    await expect(pinField(page)).toBeFocused();
    expect((await storedPin(page)).fails).toBe(1);
  });

  test('1111 three times locks for 30 s; a reload keeps the lock; the next wrong gives 60 s; the right PIN resets the count', async ({ page }) => {
    await page.clock.install({ time: START });
    await seed(page, FAMILY);
    await seedPin(page, '2580');
    await page.goto('/#/');
    await pauseClock(page);
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();

    await enterPin(page, '1111');
    await enterPin(page, '1111');
    await expect(lockLine(page)).toHaveCount(0);
    await enterPin(page, '1111');
    await expect(lockLine(page)).toHaveText('Too many tries. Try again in 30 seconds.');
    await expect(check(page)).toBeDisabled();
    await expect(pinField(page)).toBeFocused();
    await expect(page.getByRole('alert')).toHaveCount(0);

    await page.clock.runFor(10_000);
    await expect(lockLine(page)).toHaveText('Too many tries. Try again in 20 seconds.');

    // A reload during the lock keeps it.
    await page.reload();
    await expectPinCheck(page);
    await expect(lockLine(page)).toHaveText('Too many tries. Try again in 20 seconds.');
    await expect(check(page)).toBeDisabled();
    // Enter in the field does nothing while locked: no try is counted.
    await pinField(page).fill('2580');
    await pinField(page).press('Enter');
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toHaveCount(0);
    expect((await storedPin(page)).fails).toBe(3);

    await page.clock.runFor(20_000);
    await expect(lockLine(page)).toHaveCount(0);
    await expect(check(page)).toBeEnabled();

    await enterPin(page, '1111');
    await expect(lockLine(page)).toHaveText('Too many tries. Try again in 60 seconds.');
    await page.clock.runFor(60_000);
    await expect(check(page)).toBeEnabled();

    await enterPin(page, '2580');
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
    expect((await storedPin(page)).fails).toBe(0);

    // The count starts again: one wrong try is only wrong.
    await page.getByRole('link', { name: 'Back to home' }).click();
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await enterPin(page, '1111');
    await expect(page.getByRole('alert')).toHaveText('That PIN is not right.');
    await expect(lockLine(page)).toHaveCount(0);
  });
});

test.describe('the check stays honest', () => {
  test('every wrong PIN is announced, also the second in a row with the same words', async ({ page }) => {
    await seed(page, FAMILY);
    await seedPin(page, '2580');
    await page.goto('/#/');
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await enterPin(page, '1111');
    await expect(page.getByRole('alert')).toHaveText('That PIN is not right.');
    await page.evaluate(() => {
      const w = window as unknown as { alertsAdded: number };
      w.alertsAdded = 0;
      new MutationObserver((records) => {
        for (const r of records) for (const n of r.addedNodes) if (n instanceof HTMLElement && n.matches('[role="alert"]')) w.alertsAdded++;
      }).observe(document.body, { childList: true, subtree: true });
    });
    await enterPin(page, '2222');
    await expect.poll(async () => (await storedPin(page)).fails).toBe(2);
    await expect(page.getByRole('alert')).toHaveText('That PIN is not right.');
    expect(await page.evaluate(() => (window as unknown as { alertsAdded: number }).alertsAdded)).toBe(1);
  });

  test('the form announces the same mistake again on a second Save', async ({ page }) => {
    await seed(page, FAMILY);
    await page.goto('/#/');
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await passGrownUpCheck(page);
    const section = page.getByRole('region', { name: 'Grown-up PIN' });
    await section.getByRole('button', { name: 'Set a PIN' }).click();
    await section.getByLabel('New PIN', { exact: true }).fill('25');
    await section.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(section.getByRole('alert')).toHaveText('Use 4 numbers.');
    const first = await section.getByRole('alert').elementHandle();
    await section.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(section.getByRole('alert')).toHaveText('Use 4 numbers.');
    expect(await first!.evaluate((el) => el.isConnected)).toBe(false);
  });

  test('a PIN turned off in another tab: the check goes back to the sum instead of refusing the right PIN', async ({ page }) => {
    await seed(page, FAMILY);
    await seedPin(page, '2580');
    await page.goto('/#/');
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await expectPinCheck(page);
    await page.evaluate((key) => localStorage.removeItem(key), PIN_ITEM);
    await enterPin(page, '2580');
    await expect(page.locator('.sc-gate__sum')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByLabel(/^Answer for \d+ plus \d+$/)).toBeFocused();
    await passGrownUpCheck(page);
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
  });

  test('a stored cleared date that is not a real date still opens Settings', async ({ page }) => {
    await seed(page, FAMILY);
    await page.addInitScript((key) => localStorage.setItem(key, '{"v":1,"fails":0,"lockUntil":0,"clearedAt":1e20}'), PIN_ITEM);
    await page.goto('/#/');
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await passGrownUpCheck(page);
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
    const section = page.getByRole('region', { name: 'Grown-up PIN' });
    await expect(section.getByRole('button', { name: 'Set a PIN' })).toBeVisible();
    await expect(section.getByText(/was cleared/)).toHaveCount(0);
  });
});

test.describe('Forgot the PIN', () => {
  test('a wrong sum stays on the sum; a right sum shows the hold; 9 s clears nothing; 10 s clears the PIN and opens Settings', async ({ page }) => {
    await page.clock.install({ time: START });
    await seed(page, FAMILY);
    await seedPin(page, '2580');
    await page.goto('/#/');
    await pauseClock(page);
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();

    await page.getByRole('button', { name: 'Forgot the PIN?' }).click();
    await expect(page.locator('.sc-gate__sum')).toBeVisible();
    await expect(pinField(page)).toHaveCount(0);
    await page.getByLabel(/^Answer for \d+ plus \d+$/).fill('1');
    await check(page).click();
    await expect(page.getByRole('alert')).toHaveText("That answer doesn't match. Try this new sum.");
    await expect(page.locator('.sc-gate__sum')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Hold to clear the PIN/ })).toHaveCount(0);

    await passGrownUpCheck(page);
    const hold = page.getByRole('button', { name: /^Hold to clear the PIN/ });
    await expect(hold).toBeVisible();
    await expect(hold).toBeFocused();

    await holdButton(page, 9_000);
    expect((await storedPin(page)).hash).toBeTruthy();
    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toHaveCount(0);

    // Held part of the way, the count shows the seconds left.
    const box = (await hold.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.clock.runFor(3_000);
    await expect(page.getByText('Keep holding: 7')).toBeVisible();
    await page.clock.runFor(7_000);
    await page.mouse.up();
    await expect(page.getByRole('status').filter({ hasText: 'PIN cleared. The sum check is back.' })).toBeVisible();
    const rec = await storedPin(page);
    expect(rec.hash).toBeUndefined();
    expect(rec.salt).toBeUndefined();
    await page.clock.runFor(2_000);

    await expect(page.getByRole('heading', { name: 'Progress', exact: true })).toBeVisible();
    const section = page.getByRole('region', { name: 'Grown-up PIN' });
    await expect(section.getByText('The PIN was cleared with Forgot the PIN on 16 November.')).toBeVisible();
    await expect(section.getByRole('button', { name: 'Set a PIN' })).toBeVisible();

    // The next check is the sum.
    await page.getByRole('link', { name: 'Back to home' }).click();
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await expect(page.locator('.sc-gate__sum')).toBeVisible();
    await expect(pinField(page)).toHaveCount(0);
  });

  test('the hold also works with Space held down, and letting go early starts it again', async ({ page }) => {
    await page.clock.install({ time: START });
    await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8', dailyLimit: 20, minutesToday: 20 }]);
    await seedPin(page, '2580');
    await page.goto('/#/');
    await pauseClock(page);
    await page.getByRole('button', { name: 'Grown-ups: add time' }).click();
    await page.getByRole('button', { name: 'Forgot the PIN?' }).click();
    await passGrownUpCheck(page);
    const hold = page.getByRole('button', { name: /^Hold to clear the PIN/ });
    await hold.focus();

    await page.keyboard.down('Space');
    await page.clock.runFor(6_000);
    await page.keyboard.up('Space');
    await expect(page.getByText('Keep holding: 4')).toHaveCount(0);
    await page.keyboard.down('Space');
    await page.clock.runFor(5_000);
    await expect(page.getByText('Keep holding: 5')).toBeVisible();
    expect((await storedPin(page)).hash).toBeTruthy();
    await page.clock.runFor(5_000);
    await page.keyboard.up('Space');
    await expect(page.getByRole('status').filter({ hasText: 'PIN cleared. The sum check is back.' })).toBeVisible();
    await page.clock.runFor(2_000);
    await expect(page.getByRole('heading', { name: 'Add time for Maya today' })).toBeVisible();
    expect((await storedPin(page)).hash).toBeUndefined();
  });
});

test.describe('Forgot the PIN: what ends a hold', () => {
  async function openHold(page: Page) {
    await page.clock.install({ time: START });
    await seed(page, FAMILY);
    await seedPin(page, '2580');
    await page.goto('/#/');
    await pauseClock(page);
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await page.getByRole('button', { name: 'Forgot the PIN?' }).click();
    await passGrownUpCheck(page);
    return page.getByRole('button', { name: /^Hold to clear the PIN/ });
  }

  test('a finger or mouse keeps holding when the button loses focus, as it does on a press in Safari', async ({ page }) => {
    const hold = await openHold(page);
    const box = (await hold.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.clock.runFor(1_000);
    await hold.evaluate((el) => (el as HTMLElement).blur());
    await page.clock.runFor(2_000);
    await expect(page.getByText('Keep holding: 7')).toBeVisible();
    await page.clock.runFor(7_000);
    await page.mouse.up();
    await expect(page.getByRole('status').filter({ hasText: 'PIN cleared. The sum check is back.' })).toBeVisible();
  });

  test('a key hold ends when the button loses focus, because the key can no longer be seen letting go', async ({ page }) => {
    const hold = await openHold(page);
    await hold.focus();
    await page.keyboard.down('Space');
    await page.clock.runFor(2_000);
    await expect(page.getByText('Keep holding: 8')).toBeVisible();
    await hold.evaluate((el) => (el as HTMLElement).blur());
    await expect(page.getByText('Keep holding for 10 seconds.')).toBeVisible();
    await page.clock.runFor(10_000);
    await page.keyboard.up('Space');
    expect((await storedPin(page)).hash).toBeTruthy();
  });

  test('sliding the mouse off the button lets go', async ({ page }) => {
    const hold = await openHold(page);
    const box = (await hold.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.clock.runFor(2_000);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 120);
    await expect(page.getByText('Keep holding for 10 seconds.')).toBeVisible();
    await page.clock.runFor(10_000);
    await page.mouse.up();
    expect((await storedPin(page)).hash).toBeTruthy();
  });
});

test.describe('turning the PIN off', () => {
  test('Turn off PIN asks first; Keep it returns focus; Turn off removes the record', async ({ page }) => {
    await seed(page, FAMILY);
    await seedPin(page, '2580');
    await openSettingsWithPin(page);
    const section = page.getByRole('region', { name: 'Grown-up PIN' });
    const off = section.getByRole('button', { name: 'Turn off PIN' });

    await off.click();
    const dialog = page.getByRole('alertdialog', { name: 'Turn off the PIN?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('The sum check comes back.');
    await expect(dialog.getByRole('button', { name: 'Keep it' })).toBeFocused();
    // Focus stays inside the dialog.
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Turn off', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Keep it' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Keep it' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(off).toBeFocused();
    expect((await storedPin(page)).hash).toBeTruthy();

    await off.click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Turn off', exact: true }).click();
    expect(await storedPin(page)).toBeNull();
    await expect(section.getByRole('button', { name: 'Set a PIN' })).toBeFocused();

    await page.getByRole('link', { name: 'Back to home' }).click();
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await expect(page.locator('.sc-gate__sum')).toBeVisible();
  });

  test('Delete my account removes the PIN record too', async ({ page }) => {
    await seed(page, FAMILY);
    await seedPin(page, '2580');
    await openSettingsWithPin(page);
    await page.getByRole('button', { name: 'Delete my account' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/#\/players$/);
    expect(await storedPin(page)).toBeNull();
  });
});

/* ---------- Sizes: every new control at least 44 pt, and the PIN section fits at 375 wide ---------- */

async function expectTall(el: Locator, name: string) {
  const box = await el.boundingBox();
  expect(box, name).not.toBeNull();
  expect(box!.height, name).toBeGreaterThanOrEqual(44);
}

async function expectNoSidewaysScroll(page: Page) {
  const over = await page.evaluate(() => {
    const doc = document.documentElement;
    const scrollers = Array.from(document.querySelectorAll<HTMLElement>('.sc-scroll'));
    return [doc.scrollWidth - doc.clientWidth, ...scrollers.map((s) => s.scrollWidth - s.clientWidth)];
  });
  for (const o of over) expect(o).toBeLessThanOrEqual(0);
}

async function sizesJourney(page: Page) {
  await page.clock.install({ time: START });
  await seed(page, FAMILY);
  await page.goto('/#/');
  await pauseClock(page);
  await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
  await passGrownUpCheck(page);
  await expectRealFont(page);
  const section = page.getByRole('region', { name: 'Grown-up PIN' });
  await section.scrollIntoViewIfNeeded();
  await expectTall(section.getByRole('button', { name: 'Set a PIN' }), 'Set a PIN');
  await expectNoSidewaysScroll(page);

  await section.getByRole('button', { name: 'Set a PIN' }).click();
  for (const label of ['New PIN', 'Type it again']) await expectTall(section.getByLabel(label, { exact: true }), label);
  for (const name of ['Save', 'Cancel']) await expectTall(section.getByRole('button', { name, exact: true }), name);
  await expectNoSidewaysScroll(page);
  await section.getByLabel('New PIN', { exact: true }).fill('2580');
  await section.getByLabel('Type it again', { exact: true }).fill('2580');
  await section.getByRole('button', { name: 'Save', exact: true }).click();
  for (const name of ['Change PIN', 'Turn off PIN']) await expectTall(section.getByRole('button', { name }), name);
  await expectNoSidewaysScroll(page);
  await section.getByRole('button', { name: 'Turn off PIN' }).click();
  for (const name of ['Keep it', 'Turn off']) await expectTall(page.getByRole('alertdialog').getByRole('button', { name, exact: true }), name);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keep it' }).click();

  await page.getByRole('link', { name: 'Back to home' }).click();
  await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
  await expectTall(pinField(page), 'Family PIN field');
  await expectTall(check(page), 'Check');
  await expectTall(page.getByRole('button', { name: 'Forgot the PIN?' }), 'Forgot the PIN?');
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: 'Forgot the PIN?' }).click();
  await passGrownUpCheck(page);
  await expectTall(page.getByRole('button', { name: /^Hold to clear the PIN/ }), 'Hold to clear the PIN');
  await expectNoSidewaysScroll(page);
}

test('every new PIN control is at least 44 pt tall, with no sideways scroll', async ({ page }) => {
  await sizesJourney(page);
});

for (const size of [
  { width: 375, height: 667, phone: true },
  { width: 1194, height: 834, phone: false },
]) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, isMobile: size.phone, hasTouch: true });
    test(`every new PIN control is at least 44 pt tall, with no sideways scroll at ${size.width} wide @phone-only`, async ({ page }) => {
      await sizesJourney(page);
    });
  });
}

test.describe('Reduce Motion', () => {
  test('the hold bar steps once a second with no transition @phone-only', async ({ page }) => {
    await page.clock.install({ time: START });
    await seed(page, FAMILY);
    await seedPin(page, '2580');
    await page.goto('/#/');
    await pauseClock(page);
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await page.getByRole('button', { name: 'Forgot the PIN?' }).click();
    await passGrownUpCheck(page);
    const hold = page.getByRole('button', { name: /^Hold to clear the PIN/ });
    const fill = hold.locator('.sc-hold__layer--fill');
    // No transition: the bar's own rule says none, and the app-wide Reduce Motion rule caps every transition at 0.01 ms.
    const duration = await fill.evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.00001);
    const box = (await hold.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.clock.runFor(1_500);
    const at15 = await fill.evaluate((el) => el.style.clipPath);
    await page.clock.runFor(400);
    const at19 = await fill.evaluate((el) => el.style.clipPath);
    expect(at19).toBe(at15);
    expect(at15).toBe('inset(0px 90% 0px 0px)');
    await page.mouse.up();
  });
});
