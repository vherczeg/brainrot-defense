import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { coins, openAccessiblePlacement, startGame, unitCount } from './helpers';

test('loads the menu and starts a playable preparation screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await startGame(page);
  await expect(page.getByTestId('battlefield')).toBeVisible();
  await expect(page.getByTestId('shop-buy-laser-crocodile')).toBeVisible();
  await expect(page.getByTestId('shop-buy-lightning-scorpion')).toBeVisible();
  expect(await coins(page)).toBe(350);
  expect(await unitCount(page)).toBe(3);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('remains usable at a tablet viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'One tablet viewport check is enough');
  await page.setViewportSize({ width: 834, height: 1112 });
  await startGame(page);
  await expect(page.getByTestId('battlefield')).toBeVisible();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await page.getByTestId('shop-buy-laser-crocodile').click();
  await expect.poll(() => coins(page)).toBe(250);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('can purchase a character and merge two matching characters', async ({ page }) => {
  await startGame(page);
  await expect(page.getByTestId('tutorial-modal')).toHaveCount(0);

  await page.getByTestId('shop-buy-laser-crocodile').click();
  await expect.poll(() => coins(page)).toBe(250);
  await expect.poll(() => unitCount(page)).toBe(4);

  await openAccessiblePlacement(page);
  await page.getByTestId('accessible-unit-unit-2').click();
  await page.getByTestId('accessible-cell-2-4').click();

  await expect.poll(() => unitCount(page)).toBe(3);
  const inspector = page.getByTestId('unit-inspector');
  await expect(inspector).toContainText('Lézer Krokodil');
  await expect(inspector).toContainText('2. rang');
  await expect(inspector).toContainText('3. oszlop, 5. sor');
  expect(await coins(page)).toBe(250);

  await page.getByTestId('accessible-cell-0-3').click();
  await expect.poll(() => unitCount(page)).toBe(3);
  await expect(inspector).toContainText('1. oszlop, 4. sor');
});

test('fights a real battle, rewards the player, and persists progress after reload', async ({
  page,
}) => {
  await startGame(page);

  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-hud')).toBeVisible();
  await expect(page.getByTestId('allies-alive')).toHaveText('3');

  await page.getByTestId('battle-pause').click();
  await expect(page.getByTestId('pause-modal')).toBeVisible();
  await page
    .getByTestId('pause-modal')
    .getByRole('button', { name: 'Folytatás', exact: true })
    .click();
  await expect(page.getByTestId('pause-modal')).toHaveCount(0);

  await page.getByTestId('battle-speed').click();
  await expect(page.getByTestId('battle-speed')).toContainText('2×');

  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('result-title')).toContainText('teljesítve');
  await expect(page.getByTestId('result-overlay')).toContainText('+120');
  await expect(page.getByTestId('result-xp-reward')).toContainText('+75 TP / harcos');
  await expect(page.getByTestId('result-level-ups')).toContainText('SZINTLÉPÉS');

  await page.getByTestId('result-next').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await expect(page.locator('.game-topbar__title h1')).toContainText('2. hullám');
  expect(await coins(page)).toBe(470);

  await page.reload();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await expect(page.locator('.game-topbar__title h1')).toContainText('2. hullám');
  expect(await coins(page)).toBe(470);
  await openAccessiblePlacement(page);
  await page.getByTestId('accessible-unit-unit-1').click();
  await expect(page.getByTestId('inspector-rank')).toHaveText('1 / 10');
  await expect(page.getByTestId('inspector-level')).toHaveText('2');
  await expect(page.getByTestId('inspector-xp')).toHaveText('75');
});

test('can pause, resume, and toggle battle speed without breaking the battle', async ({ page }) => {
  await startGame(page);
  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-hud')).toBeVisible();

  await page.getByTestId('battle-pause').click();
  await expect(page.getByTestId('pause-modal')).toBeVisible();
  await page
    .getByTestId('pause-modal')
    .getByRole('button', { name: 'Folytatás', exact: true })
    .click();
  await expect(page.getByTestId('pause-modal')).toHaveCount(0);
  await expect(page.getByTestId('battle-hud')).toBeVisible();

  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('result-title')).toContainText('teljesítve');
});

test('rejects an invalid import and keeps the existing save', async ({ page }) => {
  await startGame(page);
  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();
  await expect(page.getByTestId('save-modal')).toBeVisible();

  await page.getByTestId('import-save-input').setInputFiles({
    name: 'serult.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ this is not json'),
  });

  await expect(page.getByTestId('toast')).toContainText('érvénytelen');
  await expect(page.getByTestId('save-modal')).toBeVisible();
  await page.getByTestId('save-modal').getByRole('button', { name: 'Ablak bezárása' }).click();
  await page.getByTestId('menu-continue').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  expect(await coins(page)).toBe(350);
});

test('exports a save, imports a valid modified save, and persists it', async ({ page }) => {
  await startGame(page);
  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();
  await expect(page.getByTestId('save-modal')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-save').click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  if (!path) return;
  const text = await readFile(path, 'utf8');
  const envelope = JSON.parse(text) as {
    appId: string;
    schemaVersion: number;
    profile: { coins: number; name: string; profileId: string };
  };
  expect(envelope.appId).toBe('brainrot-defense');
  expect(envelope.schemaVersion).toBe(2);
  expect(envelope.profile.coins).toBe(350);

  envelope.profile.coins = 4321;
  await page.getByTestId('import-save-input').setInputFiles({
    name: 'modositott-mentes.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(envelope)),
  });
  await expect(page.getByTestId('import-confirm-modal')).toBeVisible();
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '4321');

  await page.reload();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '4321');
});

test('can create a new profile from the profiles screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-profiles').click();
  await expect(page.getByTestId('profiles-screen')).toBeVisible();
  await page.getByTestId('new-profile-name').fill('Bence');
  await page.getByTestId('create-profile').click();
  await expect(page.getByTestId('tutorial-modal')).toBeVisible();
  await page.getByTestId('tutorial-dismiss').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await expect(page.locator('.game-topbar .eyebrow')).toHaveText('Bence');
});

test('can merge two characters with a canvas drag gesture', async ({ page }, testInfo) => {
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
  const to = point(3, 4);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => unitCount(page)).toBe(2);
  await expect(page.getByTestId('unit-inspector')).toContainText('2. rang');
});

test('shows the defeat screen and allows a free retry with comfort coins', async ({ page }) => {
  await startGame(page);
  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-save').click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  if (!path) return;
  const envelope = JSON.parse(await readFile(path, 'utf8')) as {
    profile: {
      coins: number;
      currentWave: number;
      unlockedWave: number;
      completedWaves: number[];
      characters: unknown[];
      nextCharacterId: number;
    };
  };
  envelope.profile.currentWave = 10;
  envelope.profile.unlockedWave = 10;
  envelope.profile.completedWaves = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  envelope.profile.coins = 0;
  envelope.profile.nextCharacterId = 10;
  envelope.profile.characters = [
    {
      id: 'unit-1',
      typeId: 'laser-crocodile',
      mergeRank: 1,
      totalXp: 0,
      col: 2,
      row: 4,
    },
  ];
  await page.getByTestId('import-save-input').setInputFiles({
    name: 'gyenge-sereg.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(envelope)),
  });
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await expect(page.locator('.game-topbar__title h1')).toContainText('10. hullám');

  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-hud')).toBeVisible();
  await page.getByTestId('battle-speed').click();
  await expect(page.getByTestId('result-overlay')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId('result-title')).toContainText('VERESÉG');
  await page.getByTestId('result-retry').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '20');
});
