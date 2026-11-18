/**
 * Decision 15: in Settings each child gets a Name field (top of the age panel) and a Remove button
 * (Progress panel, under Reset) that asks first. Decision 20: the Sound and alerts panel shows Sounds and
 * Voice only. Runs at 390x844 and 834x1194 (the projects), plus 375x667 and 1194x834.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { STORAGE_KEY, openSettings, passGrownUpCheck, seed } from './app';

/** What the app saved, with the fields these journeys read. */
interface Saved {
  players: { id: string; name: string; updatedAt: number }[];
  settings: Record<string, boolean>;
}
const savedState = (page: Page): Promise<Saved> => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);

const FAMILY = [
  { id: 'maya', name: 'Maya', ageBand: '7-8' as const },
  { id: 'leo', name: 'Leo', ageBand: '5-6' as const },
];

const chip = (page: Page, name: string): Locator => page.getByRole('button', { name: new RegExp(`^${name} Ages`) });
const nameField = (page: Page): Locator => page.getByRole('region', { name: /'s age$/ }).getByLabel('Name', { exact: true });

async function expectRealFont(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "Baloo 2"'))).toBe(true);
}

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

/** Home's greeting for the child who is playing. */
async function homeGreets(page: Page, name: string) {
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page.getByRole('heading', { name: `Hi ${name}!` })).toBeVisible();
}

const journeys = () => {
  test('rename Leo to Leon by leaving the field: chip, headings and Home update', async ({ page }) => {
    await seed(page, FAMILY, 'leo');
    await openSettings(page);
    await expectRealFont(page);
    await chip(page, 'Leo').click();
    await expect(nameField(page)).toHaveValue('Leo');
    await nameField(page).fill('Leon');
    await nameField(page).blur();
    await expect(chip(page, 'Leon')).toBeVisible();
    await expect(page.getByRole('heading', { name: "Leon's age" })).toBeVisible();
    await expect(page.getByRole('heading', { name: "Leon's game timer" })).toBeVisible();
    await expect(page.getByRole('button', { name: "Reset Leon's progress" })).toBeVisible();
    expect((await savedState(page)).players.find((p) => p.id === 'leo')?.name).toBe('Leon');
    await homeGreets(page, 'Leon');
  });

  test('rename Leo to Leon with Enter', async ({ page }) => {
    await seed(page, FAMILY, 'leo');
    await openSettings(page);
    await chip(page, 'Leo').click();
    await nameField(page).fill('  Leon ');
    await nameField(page).press('Enter');
    await expect(chip(page, 'Leon')).toBeVisible();
    await expect(nameField(page)).toHaveValue('Leon');
    await expect(nameField(page)).toBeFocused();
    await homeGreets(page, 'Leon');
  });

  test('an emptied name puts Leo back and saves nothing', async ({ page }) => {
    await seed(page, FAMILY, 'leo');
    await openSettings(page);
    await chip(page, 'Leo').click();
    const before = (await savedState(page)).players.find((p) => p.id === 'leo');
    await nameField(page).fill('   ');
    await nameField(page).blur();
    await expect(nameField(page)).toHaveValue('Leo');
    await expect(chip(page, 'Leo')).toBeVisible();
    const after = (await savedState(page)).players.find((p) => p.id === 'leo');
    expect(after?.name).toBe('Leo');
    expect(after?.updatedAt).toBe(before?.updatedAt);
  });

  test('the Name field keeps names to 24 letters, like Add a child', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    await expect(nameField(page)).toHaveAttribute('maxlength', '24');
  });

  test('remove the second of two: the first is selected, the toast shows, focus is on its chip, Who’s playing lists one child', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    await chip(page, 'Leo').click();
    await page.getByRole('button', { name: 'Remove Leo' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Remove Leo from this device?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Their stars, levels and stickers go too. This can't be undone.");
    await expect(dialog.getByRole('button', { name: 'Keep Leo' })).toBeFocused();
    await expectTall(dialog.getByRole('button', { name: 'Keep Leo' }), 'Keep Leo');
    await expectTall(dialog.getByRole('button', { name: 'Remove', exact: true }), 'Remove');
    await dialog.getByRole('button', { name: 'Remove', exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Leo was removed from this device.' })).toBeVisible();
    await expect(chip(page, 'Maya')).toHaveAttribute('aria-pressed', 'true');
    await expect(chip(page, 'Maya')).toBeFocused();
    await expect(chip(page, 'Leo')).toHaveCount(0);
    expect((await savedState(page)).players.map((p) => p.id)).toEqual(['maya']);

    await page.goto('/#/players');
    await expect(page.locator('.sc-player')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^Maya/ })).toBeVisible();
  });

  test('Keep Leo changes nothing and returns focus to the Remove button', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    await chip(page, 'Leo').click();
    const remove = page.getByRole('button', { name: 'Remove Leo' });
    await remove.click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Keep Leo' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(remove).toBeFocused();
    expect((await savedState(page)).players.map((p) => p.id)).toEqual(['maya', 'leo']);
  });

  test('removing the only child lands on the first-run form', async ({ page }) => {
    await seed(page, [FAMILY[0]]);
    await openSettings(page);
    await page.getByRole('button', { name: 'Remove Maya' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(page).toHaveURL(/#\/players$/);
    await expect(page.getByRole('heading', { name: 'Add your first child' })).toBeVisible();
    expect((await savedState(page)).players).toEqual([]);
  });

  test('Add a child with no name typed says where to change it', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    await page.getByRole('button', { name: 'Add a child' }).click();
    await page.getByRole('button', { name: 'Add child', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Player 3 was added. You can change the name under Name.' })).toBeVisible();
  });

  test('Add a child with a name keeps today’s toast', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    await page.getByRole('button', { name: 'Add a child' }).click();
    await page.getByLabel("Child's first name").fill('Ava');
    await page.getByRole('button', { name: 'Add child', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: "Ava was added. They can now pick their brick on Who's playing." })).toBeVisible();
  });

  test('the Name field and the Remove button are at least 44 pt tall, with no sideways scroll', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    await expectRealFont(page);
    await expectTall(nameField(page), 'Name field');
    await expectTall(page.getByRole('button', { name: 'Remove Maya' }), 'Remove Maya');
    await expectNoSidewaysScroll(page);
  });

  test('a name typed and left with the device Back is still saved', async ({ page }) => {
    await seed(page, FAMILY, 'leo');
    await page.goto('/#/');
    await page.getByRole('link', { name: 'Settings for grown-ups' }).click();
    await passGrownUpCheck(page);
    await chip(page, 'Leo').click();
    await nameField(page).fill('Leon');
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Hi Leon!' })).toBeVisible();
    expect((await savedState(page)).players.find((p) => p.id === 'leo')?.name).toBe('Leon');
  });

  test('a name typed and left by picking another child goes to the first child only', async ({ page }) => {
    await seed(page, FAMILY, 'leo');
    await openSettings(page);
    await chip(page, 'Leo').click();
    await nameField(page).fill('Leon');
    await chip(page, 'Maya').click();
    await expect(nameField(page)).toHaveValue('Maya');
    const names = (await savedState(page)).players.map((p) => p.name);
    expect(names).toEqual(['Maya', 'Leon']);
  });

  test('a child saved without a name loses the unnamed mark when named, and keeps it when the field is only visited', async ({ page }) => {
    await seed(page, FAMILY);
    await page.addInitScript((key) => {
      if (sessionStorage.getItem('e2e-unnamed-seeded')) return;
      sessionStorage.setItem('e2e-unnamed-seeded', '1');
      const raw = JSON.parse(localStorage.getItem(key) ?? 'null');
      raw.players[1].name = 'Player 2';
      raw.players[1].unnamed = true;
      localStorage.setItem(key, JSON.stringify(raw));
    }, STORAGE_KEY);
    await openSettings(page);
    await chip(page, 'Player 2').click();
    await nameField(page).focus();
    await nameField(page).blur();
    const unnamed = async () => (await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).players[1].unnamed, STORAGE_KEY)) as boolean;
    expect(await unnamed()).toBe(true);
    await nameField(page).fill('Leo');
    await nameField(page).press('Enter');
    await expect(chip(page, 'Leo')).toBeVisible();
    expect(await unnamed()).toBe(false);
  });

  test('after a child is removed, a child added with no name never repeats a name in use', async ({ page }) => {
    await seed(page, [
      { id: 'a', name: 'Player 1', ageBand: '7-8' },
      { id: 'b', name: 'Player 2', ageBand: '5-6' },
      { id: 'c', name: 'Player 3', ageBand: '5-6' },
    ]);
    await openSettings(page);
    await page.getByRole('button', { name: 'Remove Player 1' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByRole('button', { name: 'Add a child' }).click();
    await page.getByRole('button', { name: 'Add child', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Player 4 was added. You can change the name under Name.' })).toBeVisible();
    expect((await savedState(page)).players.map((p) => p.name)).toEqual(['Player 2', 'Player 3', 'Player 4']);
  });

  test('the longest name stays inside the Remove card and the page, with both answers on screen', async ({ page }) => {
    const longest = 'W'.repeat(24);
    await seed(page, [FAMILY[0], { id: 'long', name: longest, ageBand: '5-6' }]);
    await openSettings(page);
    await expectRealFont(page);
    await expectNoSidewaysScroll(page);
    await chip(page, longest).click();
    await expectNoSidewaysScroll(page);
    await page.getByRole('button', { name: `Remove ${longest}` }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    const card = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(viewport.width);
    for (const el of [dialog.getByRole('heading'), dialog.getByRole('button', { name: `Keep ${longest}` }), dialog.getByRole('button', { name: 'Remove', exact: true })]) {
      const box = (await el.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(card.x);
      expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width);
      expect(await el.evaluate((n) => n.scrollWidth - n.clientWidth)).toBeLessThanOrEqual(0);
    }
    await expectTall(dialog.getByRole('button', { name: `Keep ${longest}` }), 'Keep');
  });

  test('Sound and alerts shows Sounds and Voice only', async ({ page }) => {
    await seed(page, FAMILY);
    await openSettings(page);
    const sound = page.getByRole('region', { name: 'Sound and alerts' });
    await expect(sound.getByRole('switch')).toHaveCount(2);
    await expect(sound.getByRole('switch', { name: 'Sounds' })).toBeVisible();
    await expect(sound.getByRole('switch', { name: 'Voice' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Music' })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: 'Notifications' })).toHaveCount(0);
  });

  test('a saved Music: true loads and saves unchanged', async ({ page }) => {
    await seed(page, FAMILY);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('e2e-music-seeded')) return;
      sessionStorage.setItem('e2e-music-seeded', '1');
      const raw = JSON.parse(localStorage.getItem('brickwise:v2') ?? 'null');
      if (raw) {
        raw.settings.music = true;
        raw.settings.alerts = true;
        localStorage.setItem('brickwise:v2', JSON.stringify(raw));
      }
    });
    await openSettings(page);
    await page.getByRole('switch', { name: 'Voice' }).click();
    const s = (await savedState(page)).settings;
    expect(s).toMatchObject({ music: true, alerts: true, voice: false });
  });
};

test.describe('Settings children and switches', journeys);

for (const size of [
  { width: 375, height: 667, phone: true },
  { width: 1194, height: 834, phone: false },
]) {
  test.describe(`${size.width}x${size.height} @phone-only`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, isMobile: size.phone, hasTouch: true });
    journeys();
  });
}
