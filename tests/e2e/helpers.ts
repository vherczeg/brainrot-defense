import { expect, type Page } from '@playwright/test';

export async function startGame(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  const tutorial = page.getByTestId('tutorial-dismiss');
  if (await tutorial.isVisible()) {
    await tutorial.click();
  }
  await expect(page.getByTestId('battle-button')).toBeVisible();
}

export async function coins(page: Page): Promise<number> {
  const value = await page.getByTestId('coins-value').getAttribute('data-coins');
  return Number(value);
}

export async function unitCount(page: Page): Promise<number> {
  const value = await page.getByTestId('unit-count').getAttribute('data-count');
  return Number(value);
}

export async function openAccessiblePlacement(page: Page): Promise<void> {
  const panel = page.getByTestId('accessible-panel');
  if (!(await panel.getAttribute('open'))) {
    await panel.locator('summary').click();
  }
}
