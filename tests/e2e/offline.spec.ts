import { expect, test } from '@playwright/test';

test('production app shell can reopen while offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();

  const registrations = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 0;
    await navigator.serviceWorker.ready;
    return (await navigator.serviceWorker.getRegistrations()).length;
  });
  expect(registrations).toBeGreaterThan(0);

  await page.reload();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.waitForTimeout(800);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await context.setOffline(false);
});

test('fresh first visit caches the complete app and survives an offline reload', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByTestId('menu-continue')).toBeVisible();

  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;
    await navigator.serviceWorker.ready;
  });

  const cachedPaths = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return [];
    const names = await caches.keys();
    const paths: string[] = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) paths.push(new URL(request.url).pathname);
    }
    return paths;
  });
  expect(cachedPaths.some((path) => path.includes('/assets/'))).toBe(true);

  await page.getByTestId('menu-continue').click();
  await expect(page.getByTestId('tutorial-dismiss')).toBeVisible();
  await page.getByTestId('tutorial-dismiss').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await page.getByTestId('shop-buy-laser-crocodile').click();
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '250');
  await expect(page.getByTestId('save-status')).toContainText('Elmentve');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  await expect(page.getByTestId('battle-button')).toBeVisible();
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '250');
  await expect(page.getByTestId('unit-count')).toHaveAttribute('data-count', '4');

  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  await page.getByTestId('menu-continue').click();
  await expect(page.getByTestId('coins-value')).toHaveAttribute('data-coins', '250');
});
