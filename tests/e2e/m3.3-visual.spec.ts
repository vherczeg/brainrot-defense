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

async function loadFullBoard(page: Page): Promise<void> {
  await startGame(page);
  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-save').click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('missing download path');
  const envelope = JSON.parse(await readFile(path, 'utf8')) as {
    profile: Record<string, unknown>;
  };
  envelope.profile.characters = FULL_BOARD;
  envelope.profile.coins = 100;
  envelope.profile.nextCharacterId = 20;
  await page.getByTestId('import-save-input').setInputFiles({
    name: 'm3.3-visual.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(envelope)),
  });
  await page.getByTestId('import-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `docs/qa/m3.3/${name}.png`, fullPage: true });
}

test('M3.3 visual QA screenshots', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Desktop visual QA run');
  test.skip(process.env.VISUAL_QA !== '1', 'Set VISUAL_QA=1 to capture screenshots');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loadFullBoard(page);
  await expect.poll(() => unitCount(page)).toBe(12);
  await shot(page, 'A-full-board-12-of-12');

  await openAccessiblePlacement(page);
  await page.getByTestId('accessible-unit-unit-1').click();
  await expect(page.getByTestId('sell-button')).toBeVisible();
  await shot(page, 'B-selected-unit-sell-button');

  await page.getByTestId('sell-button').click();
  await expect(page.getByTestId('sell-confirm-modal')).toBeVisible();
  await shot(page, 'C-sell-confirmation');

  await page.getByTestId('sell-confirm').click();
  await expect.poll(() => unitCount(page)).toBe(11);
  expect(await coins(page)).toBe(150);
  await shot(page, 'D-sold-11-of-12');

  await page.getByTestId('shop-buy-laser-crocodile').click();
  await expect.poll(() => unitCount(page)).toBe(12);
  expect(await coins(page)).toBe(50);
  await shot(page, 'E-replacement-purchased-12-of-12');

  const title = page.locator('.game-topbar__title h1');
  const shopCard = page.locator('.shop-card').first();
  const from = await title.boundingBox();
  const to = await shopCard.boundingBox();
  if (from && to) {
    await page.mouse.move(from.x + 10, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 16 });
    await page.mouse.up();
  }
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
  await shot(page, 'F-after-drag-no-text-selection');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await shot(page, 'F-mobile-after-drag-no-text-selection');
});
