import { expect, test } from '@playwright/test';
import { startGame, unitCount } from './helpers';

test('opening surrender pauses the battle and cancelling leaves it paused', async ({ page }) => {
  await startGame(page);
  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-hud')).toBeVisible();

  await page.locator('.battle-live-bar').getByRole('button', { name: 'Feladás' }).click();
  await expect(page.getByTestId('surrender-modal')).toBeVisible();
  await page.getByTestId('surrender-modal').getByRole('button', { name: 'Mégse' }).click();
  await expect(page.getByTestId('pause-modal')).toBeVisible();

  await page
    .getByTestId('pause-modal')
    .getByRole('button', { name: 'Folytatás', exact: true })
    .click();
  await expect(page.getByTestId('pause-modal')).toHaveCount(0);
  await expect(page.getByTestId('battle-hud')).toBeVisible();
});

test('confirming surrender returns to preparation without losing the army', async ({ page }) => {
  await startGame(page);
  expect(await unitCount(page)).toBe(3);
  await page.getByTestId('battle-button').click();
  await expect(page.getByTestId('battle-hud')).toBeVisible();

  await page.locator('.battle-live-bar').getByRole('button', { name: 'Feladás' }).click();
  await page.getByTestId('surrender-confirm').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  expect(await unitCount(page)).toBe(3);
});
