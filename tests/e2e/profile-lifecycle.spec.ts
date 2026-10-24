import { expect, test, type Page } from '@playwright/test';
import { openAccessiblePlacement, startGame } from './helpers';

async function storedProfileCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const request = indexedDB.open('brainrot-defense');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction('profiles', 'readonly');
    const records = await new Promise<unknown[]>((resolve, reject) => {
      const getAll = transaction.objectStore('profiles').getAll();
      getAll.onsuccess = () => resolve(getAll.result as unknown[]);
      getAll.onerror = () => reject(getAll.error);
    });
    db.close();
    return records.length;
  });
}

test('double-clicking profile creation cannot store more than three profiles', async ({ page }) => {
  await startGame(page);
  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-profiles').click();
  await page.getByTestId('new-profile-name').fill('Bence');
  await page.getByTestId('create-profile').click();
  await expect(page.getByTestId('tutorial-modal')).toBeVisible();
  await page.getByTestId('tutorial-dismiss').click();

  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-profiles').click();
  await expect(page.getByTestId('profiles-screen')).toBeVisible();
  expect(await storedProfileCount(page)).toBe(2);

  await page.getByTestId('new-profile-name').fill('Csilla');
  await page.getByTestId('create-profile').dblclick();
  await page.waitForTimeout(500);
  if (await page.getByTestId('tutorial-modal').isVisible()) {
    await page.getByTestId('tutorial-dismiss').click();
  }

  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-profiles').click();
  await expect(page.getByTestId('profiles-screen')).toBeVisible();
  expect(await storedProfileCount(page)).toBeLessThanOrEqual(3);
  await expect(page.locator('.profile-card')).toHaveCount(3);
  await expect(page.locator('.profile-card').filter({ hasText: 'Aktív' })).toHaveCount(1);
});

test('sound is re-synchronized when a sound-off profile creates a sound-on profile', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      AudioContext?: typeof AudioContext;
      __ctx?: AudioContext;
      __resumeCalls?: number;
    };
    const Real = w.AudioContext;
    if (!Real) return;
    w.__resumeCalls = 0;
    class Wrapped extends Real {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        w.__ctx = this;
      }
      override resume(): Promise<void> {
        w.__resumeCalls = (w.__resumeCalls ?? 0) + 1;
        return super.resume();
      }
    }
    w.AudioContext = Wrapped as typeof AudioContext;
  });

  await startGame(page);
  await openAccessiblePlacement(page);
  await page.getByTestId('accessible-unit-unit-1').click();
  await page.waitForTimeout(100);

  await page.getByTestId('open-settings').click();
  await page.getByTestId('sound-toggle').click();
  await page.getByTestId('settings-modal').getByRole('button', { name: 'Ablak bezárása' }).click();
  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-profiles').click();
  await page.getByTestId('new-profile-name').fill('Néma');
  await page.getByTestId('create-profile').click();
  await expect(page.getByTestId('tutorial-modal')).toBeVisible();
  await page.getByTestId('tutorial-dismiss').click();

  await openAccessiblePlacement(page);
  await page.getByTestId('accessible-unit-unit-1').click();
  await page.waitForTimeout(200);

  const state = await page.evaluate(() => {
    const w = window as unknown as { __ctx?: AudioContext };
    return w.__ctx?.state ?? 'none';
  });
  expect(state).toBe('running');
});

test('the same profile cannot be edited from two tabs at once', async ({ context }) => {
  const first = await context.newPage();
  await startGame(first);
  await expect(first.getByTestId('battle-button')).toBeVisible();

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByTestId('error-screen')).toBeVisible();

  await first.close();
  await second.reload();
  await expect(second.getByTestId('menu-continue')).toBeVisible();
});
