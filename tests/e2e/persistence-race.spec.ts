import { expect, test, type Page } from '@playwright/test';
import { startGame } from './helpers';

async function openProfile(page: Page): Promise<{
  profileId: string;
  coins: number;
  [key: string]: unknown;
}> {
  return page.evaluate(async () => {
    const request = indexedDB.open('brainrot-defense');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction('profiles', 'readonly');
    const records = await new Promise<{ payload: Record<string, unknown> }[]>((resolve, reject) => {
      const getAll = transaction.objectStore('profiles').getAll();
      getAll.onsuccess = () => resolve(getAll.result as { payload: Record<string, unknown> }[]);
      getAll.onerror = () => reject(getAll.error);
    });
    db.close();
    return records[0]?.payload as { profileId: string; coins: number };
  });
}

async function storedProfileIds(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const request = indexedDB.open('brainrot-defense');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = db.transaction('profiles', 'readonly');
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const getAllKeys = transaction.objectStore('profiles').getAllKeys();
      getAllKeys.onsuccess = () => resolve(getAllKeys.result);
      getAllKeys.onerror = () => reject(getAllKeys.error);
    });
    db.close();
    return keys.map(String);
  });
}

async function queueManySaves(page: Page, count = 1000): Promise<void> {
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('settings-modal')).toBeVisible();
  await page.evaluate((times) => {
    const modal = document.querySelector('[data-testid="settings-modal"]');
    if (!modal) return;
    const saveButton = [...modal.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Mentés',
    );
    if (!saveButton) return;
    for (let index = 0; index < times; index += 1) saveButton.click();
  }, count);
  await page.getByTestId('settings-modal').getByRole('button', { name: 'Ablak bezárása' }).click();
}

test('a confirmed import survives a large pending autosave backlog and reload', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await startGame(page);
  const profile = await openProfile(page);
  await queueManySaves(page);

  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-save').click();
  await expect(page.getByTestId('save-modal')).toBeVisible();
  const envelope = {
    format: 'brainrot-defense-save',
    appId: 'brainrot-defense',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    profile: { ...profile, coins: 4321, lastSavedAt: Date.now() },
  };
  await page.getByTestId('import-save-input').setInputFiles({
    name: 'race-save.json',
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

test('a deleted profile is not resurrected by a large pending autosave backlog', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await startGame(page);
  const profile = await openProfile(page);
  await queueManySaves(page);

  await page.getByTestId('game-menu').click();
  await page.getByTestId('menu-profiles').click();
  await expect(page.getByTestId('profiles-screen')).toBeVisible();
  await page
    .locator('.profile-card')
    .filter({ hasText: 'Ábel' })
    .getByRole('button', { name: 'Játékos törlése' })
    .click();
  await expect(page.getByTestId('delete-profile-modal')).toBeVisible();
  await page.getByTestId('delete-profile-modal').getByRole('button', { name: 'Törlés' }).click();

  await expect.poll(() => storedProfileIds(page)).toEqual([]);
  await page.reload();
  await expect(page.getByTestId('menu-continue')).toBeVisible();
  const ids = await storedProfileIds(page);
  expect(ids).not.toContain(profile.profileId);
});
