/**
 * Checks that need another batch: the short-screen mode from batch ui (decision 4) lets a phone held
 * sideways scroll the grown-up check. Until that batch is merged the check is clipped, so these fail here
 * and pass on the merged tree. The orchestrator runs this file after merging.
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { passGrownUpCheck, seed } from './app';

const PIN_ITEM = 'brickwise.familyPin.v1';

async function seedPin(page: Page, pin: string) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pin, salt, 150000, 32, 'sha256');
  const json = JSON.stringify({ v: 1, salt: salt.toString('base64'), hash: hash.toString('base64'), iterations: 150000, fails: 0, lockUntil: 0 });
  await page.addInitScript(
    ({ key, value }) => {
      if (sessionStorage.getItem('e2e-pin-seeded')) return;
      sessionStorage.setItem('e2e-pin-seeded', '1');
      localStorage.setItem(key, value);
    },
    { key: PIN_ITEM, value: json },
  );
}

/**
 * A finger can bring the control under it. Only what a person can scroll is moved: the page and boxes with
 * overflow auto or scroll. Playwright's own scrolling would also move an overflow: hidden box, which no
 * finger can, so it would call a clipped control reachable.
 */
async function expectReachable(el: Locator, name: string) {
  const reachable = await el.evaluate((node) => {
    const underFinger = () => {
      const b = node.getBoundingClientRect();
      const x = b.left + b.width / 2;
      const y = b.top + b.height / 2;
      if (y < 0 || y > window.innerHeight) return false;
      const top = document.elementFromPoint(x, y);
      return !!top && (top === node || node.contains(top));
    };
    if (underFinger()) return true;
    const page = document.scrollingElement;
    const boxes = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((e) => e !== page && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
    for (const box of [page, ...boxes]) {
      if (!box) continue;
      for (let top = 0; top <= box.scrollHeight; top += 16) {
        box.scrollTop = top;
        if (underFinger()) return true;
      }
    }
    return false;
  });
  expect(reachable, name).toBe(true);
}

async function expectWholeCheckReachable(page: Page) {
  const pinField = page.getByLabel('Family PIN', { exact: true });
  const check = page.getByRole('button', { name: 'Check', exact: true });
  const forgot = page.getByRole('button', { name: 'Forgot the PIN?' });
  for (const [el, name] of [[pinField, 'Family PIN'], [page.getByRole('button', { name: 'Cancel', exact: true }), 'Cancel'], [check, 'Check'], [forgot, 'Forgot the PIN?']] as const) await expectReachable(el, name);

  // A wrong PIN adds a line above the field: everything must still be in reach.
  await pinField.fill('1111');
  await check.click();
  await expect(page.getByRole('alert')).toHaveText('That PIN is not right.');
  for (const [el, name] of [[check, 'Check after a wrong PIN'], [forgot, 'Forgot after a wrong PIN']] as const) await expectReachable(el, name);

  await forgot.click();
  await passGrownUpCheck(page);
  await expectReachable(page.getByRole('button', { name: /^Hold to clear the PIN/ }), 'Hold to clear the PIN');
  await expectReachable(page.getByRole('button', { name: 'Cancel', exact: true }), 'Cancel on the hold');
}

for (const size of [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
]) {
  test.describe(`a phone held sideways, ${size.width}x${size.height} @phone-only`, () => {
    test.use({ viewport: size, isMobile: true, hasTouch: true });

    test('the PIN check on Settings can be reached whole', async ({ page }) => {
      await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8' }]);
      await seedPin(page, '2580');
      await page.goto('/#/settings');
      await expectWholeCheckReachable(page);
    });

    test('the PIN check on Break can be reached whole', async ({ page }) => {
      await seed(page, [{ id: 'maya', name: 'Maya', ageBand: '7-8', dailyLimit: 20, minutesToday: 20 }]);
      await seedPin(page, '2580');
      await page.goto('/#/');
      await page.getByRole('button', { name: 'Grown-ups: add time' }).click();
      await expectWholeCheckReachable(page);
    });
  });
}
