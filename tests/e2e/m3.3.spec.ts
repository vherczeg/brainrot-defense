import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { coins, openAccessiblePlacement, startGame, unitCount } from './helpers';

const FULL_BOARD = Array.from({ length: 12 }, (_, index) => {
  const row = index < 6 ? 3 : 4;
  const col = index % 6;
  return {
    id: `unit-${index + 1}`,
    typeId: index % 2 === 0 ? 'laser-crocodile' : 'lightning-scorpion',
    mergeRank: 1,
    totalXp: 0,
    col,
    row,
  };
});

async function importProfile(
  page: Page,
  mutate: (profile: Record<string, unknown>) => void,
): Promise<void> {
  await startGame(page);
  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();
  await expect(page.getByTestId('save-modal')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-save').click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('missing download path');
  const envelope = JSON.parse(await readFile(path, 'utf8')) as {
    profile: Record<string, unknown>;
  };
  mutate(envelope.profile);
  await page.getByTestId('import-save-input').setInputFiles({
    name: 'm3.3-teszt.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(envelope)),
  });
  await expect(page.getByTestId('import-confirm-modal')).toBeVisible();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
}

async function loadFullBoard(page: Page): Promise<void> {
  await importProfile(page, (profile) => {
    profile.characters = FULL_BOARD;
    profile.coins = 100;
    profile.nextCharacterId = 20;
  });
}

async function selectionText(page: Page): Promise<string> {
  return page.evaluate(() => window.getSelection()?.toString() ?? '');
}

test.describe('M3.3 selection safety', () => {
  test('dragging over gameplay text does not select it', async ({ page }) => {
    await startGame(page);
    const title = page.locator('.game-topbar__title h1');
    const shopCard = page.locator('.shop-card').first();
    const from = await title.boundingBox();
    const to = await shopCard.boundingBox();
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();
    if (!from || !to) return;

    await page.mouse.move(from.x + 10, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 16 });
    await page.mouse.up();

    expect(await selectionText(page)).toBe('');
    await expect(page.getByTestId('shop-buy-laser-crocodile')).toBeVisible();
  });

  test('dragging a unit on the canvas does not select surrounding page text', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop pointer drag test');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await startGame(page);
    const board = page.getByTestId('battlefield');
    const box = await board.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    const point = (col: number, row: number) => ({
      x: box.x + ((56 + (col + 0.5) * 108) / 760) * box.width,
      y: box.y + ((70 + (row + 0.5) * 108) / 640) * box.height,
    });
    const from = point(2, 4);
    const to = point(0, 3);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();

    expect(await selectionText(page)).toBe('');
    await expect(page.getByTestId('unit-inspector')).toContainText('Lézer Krokodil');
  });

  test('editable text fields remain editable', async ({ page }) => {
    await startGame(page);
    await page.getByTestId('game-menu').click();
    await page.getByTestId('menu-profiles').click();
    const input = page.getByTestId('new-profile-name');
    await expect(input).toBeEditable();
    await input.fill('Ábel2');
    await expect(input).toHaveValue('Ábel2');
    const userSelect = await input.evaluate((element) => getComputedStyle(element).userSelect);
    expect(userSelect).not.toBe('none');
  });
});

test.describe('M3.3 full-board selling flow', () => {
  test('sells one selected unit, frees one cell, and buys one replacement', async ({ page }) => {
    await loadFullBoard(page);
    await expect.poll(() => unitCount(page)).toBe(12);
    expect(await coins(page)).toBe(100);

    await openAccessiblePlacement(page);
    await page.getByTestId('accessible-unit-unit-1').click();
    const inspector = page.getByTestId('unit-inspector');
    await expect(inspector).toContainText('Lézer Krokodil');
    await expect(page.getByTestId('sell-refund')).toContainText('50');
    await expect(page.getByTestId('sell-button')).toBeVisible();

    await page.getByTestId('sell-button').click();
    const dialog = page.getByTestId('sell-confirm-modal');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Biztosan eladod ezt a harcost?');
    await expect(dialog).toContainText('Lézer Krokodil');
    await expect(dialog).toContainText('1. rang');
    await expect(dialog).toContainText('1. szint');
    await expect(page.getByTestId('sell-confirm-refund')).toContainText('50');
    await expect(page.getByTestId('sell-cancel')).toBeFocused();

    await page.getByTestId('sell-cancel').click();
    await expect(dialog).toHaveCount(0);
    expect(await unitCount(page)).toBe(12);
    expect(await coins(page)).toBe(100);

    await page.getByTestId('sell-button').focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('sell-cancel')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(await unitCount(page)).toBe(12);

    await page.getByTestId('sell-button').click();
    await expect(dialog).toBeVisible();
    await page.getByTestId('sell-confirm').click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => unitCount(page)).toBe(11);
    expect(await coins(page)).toBe(150);
    await expect(page.getByTestId('toast')).toContainText('Eladás sikeres');
    await expect(page.getByTestId('sell-button')).toHaveCount(0);

    await page.getByTestId('shop-buy-laser-crocodile').click();
    await expect.poll(() => unitCount(page)).toBe(12);
    expect(await coins(page)).toBe(50);
    await expect(page.getByTestId('toast')).toContainText('12/12 harcos');
  });

  test('a touch tap can open and confirm selling', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Touch device test');
    await loadFullBoard(page);
    await openAccessiblePlacement(page);
    await page.getByTestId('accessible-unit-unit-1').tap();
    await page.getByTestId('sell-button').tap();
    await expect(page.getByTestId('sell-confirm-modal')).toBeVisible();
    await page.getByTestId('sell-confirm').tap();
    await expect.poll(() => unitCount(page)).toBe(11);
    expect(await coins(page)).toBe(150);
  });

  test('cancelling selling leaves the full board unchanged', async ({ page }) => {
    await loadFullBoard(page);
    await openAccessiblePlacement(page);
    await page.getByTestId('accessible-unit-unit-2').click();
    await page.getByTestId('sell-button').click();
    await expect(page.getByTestId('sell-confirm-modal')).toBeVisible();
    await page.getByTestId('sell-cancel').click();
    await expect(page.getByTestId('sell-confirm-modal')).toHaveCount(0);
    expect(await unitCount(page)).toBe(12);
    expect(await coins(page)).toBe(100);
    await expect(page.getByTestId('sell-button')).toBeVisible();
  });
});

test.describe('M3.3 purchase transaction safety', () => {
  test('one click creates exactly one unit and deducts gold once', async ({ page }) => {
    await startGame(page);
    expect(await unitCount(page)).toBe(3);
    await page.getByTestId('shop-buy-laser-crocodile').click();
    await expect.poll(() => unitCount(page)).toBe(4);
    expect(await coins(page)).toBe(250);
    await expect(page.getByTestId('toast')).toContainText('Lézer Krokodil');
    await expect(page.getByTestId('toast')).toContainText('250 érme');
    await expect(page.getByTestId('toast')).toContainText('4/12 harcos');
  });

  test('holding the mouse button down still performs only one purchase', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Desktop mouse hold test');
    await startGame(page);
    const button = page.getByTestId('shop-buy-laser-crocodile');
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await expect.poll(() => unitCount(page)).toBe(4);
    await page.waitForTimeout(300);
    expect(await unitCount(page)).toBe(4);
    expect(await coins(page)).toBe(250);
  });

  test('two separate deliberate clicks create exactly two units', async ({ page }) => {
    await startGame(page);
    await page.getByTestId('shop-buy-laser-crocodile').click();
    await expect.poll(() => unitCount(page)).toBe(4);
    await page.getByTestId('shop-buy-lightning-scorpion').click();
    await expect.poll(() => unitCount(page)).toBe(5);
    expect(await coins(page)).toBe(100);
  });

  test('one touch tap creates exactly one unit', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Touch device test');
    await startGame(page);
    await page.getByTestId('shop-buy-laser-crocodile').tap();
    await expect.poll(() => unitCount(page)).toBe(4);
    await page.waitForTimeout(300);
    expect(await unitCount(page)).toBe(4);
    expect(await coins(page)).toBe(250);
  });
});
